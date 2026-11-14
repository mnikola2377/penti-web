import { validateInquiry, type InquiryAttachment, type PentiInquiry } from "./inquiry";

export interface InquiryEnv {
  supabaseUrl?: string;
  serviceRoleKey?: string;
}

export interface InquiryResult {
  status: number;
  body: Record<string, unknown>;
}

const MAX_FILE_BYTES = 4_000_000;
const MAX_TOTAL_BYTES = 8_000_000;

export async function handleInquiryRequest(request: Request, env: InquiryEnv): Promise<InquiryResult> {
  if (request.method !== "POST") {
    return { status: 405, body: { ok: false, errors: ["Povolená metoda je POST."] } };
  }

  let payload: unknown;
  let files: File[] = [];
  let honeypot = "";

  try {
    const type = request.headers.get("content-type") ?? "";
    if (type.includes("application/json")) {
      const json = (await request.json()) as Record<string, unknown>;
      honeypot = typeof json.hp === "string" ? json.hp : "";
      delete json.hp;
      payload = json;
    } else {
      const form = await request.formData();
      honeypot = String(form.get("hp") ?? "");
      const raw = form.get("payload");
      if (typeof raw !== "string") {
        return { status: 400, body: { ok: false, errors: ["Chybí pole payload."] } };
      }
      payload = JSON.parse(raw);
      files = form.getAll("files").filter((item): item is File => item instanceof File && item.size > 0);
    }
  } catch {
    return { status: 400, body: { ok: false, errors: ["Poptávku se nepodařilo přečíst."] } };
  }

  if (honeypot.trim()) {
    return { status: 200, body: { ok: true, stored: false, ignored: true } };
  }

  const validated = validateInquiry(payload);
  if (!validated.ok) return { status: 400, body: { ok: false, errors: validated.errors } };

  const inquiry = validated.inquiry;
  const total = files.reduce((sum, file) => sum + file.size, 0);
  if (files.some((file) => file.size > MAX_FILE_BYTES) || total > MAX_TOTAL_BYTES) {
    return {
      status: 400,
      body: { ok: false, errors: ["Přílohy jsou větší než 4 MB na soubor nebo 8 MB dohromady. Pošlete je na poptavky@penti.cz."] },
    };
  }

  if (!env.supabaseUrl || !env.serviceRoleKey) {
    return {
      status: 200,
      body: {
        ok: true,
        stored: false,
        reason: "missing_env",
        inquiry_id: inquiry.inquiry_id,
        message: "Poptávka je v pořádku. Úložiště ještě není připojené, proto si JSON stáhněte a pošlete ho na poptavky@penti.cz.",
      },
    };
  }

  try {
    const storedFiles = await uploadFiles(inquiry, files, env);
    await insertInquiry(inquiry, storedFiles, env);
    return {
      status: 201,
      body: {
        ok: true,
        stored: true,
        inquiry_id: inquiry.inquiry_id,
        attachments: storedFiles.length,
        message: "Poptávku jsme přijali. Ozveme se na uvedený e-mail.",
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Uložení se nepovedlo.";
    return {
      status: 502,
      body: {
        ok: false,
        stored: false,
        inquiry_id: inquiry.inquiry_id,
        errors: [`Poptávku se nepodařilo zapsat do databáze. JSON si stáhněte. (${message})`],
      },
    };
  }
}

async function uploadFiles(inquiry: PentiInquiry, files: File[], env: InquiryEnv): Promise<InquiryAttachment[]> {
  const byName = new Map(files.map((file) => [file.name, file]));
  const stored: InquiryAttachment[] = [];

  for (const attachment of inquiry.attachments) {
    const file = byName.get(attachment.filename);
    if (!file) {
      stored.push(attachment);
      continue;
    }
    const safeName = attachment.filename.replace(/[^\w.\-]+/g, "_").slice(0, 120);
    const path = `${inquiry.inquiry_id}/${attachment.id}-${safeName}`;
    const response = await fetch(`${trim(env.supabaseUrl!)}/storage/v1/object/inquiry-attachments/${path}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.serviceRoleKey}`,
        apikey: env.serviceRoleKey!,
        "content-type": file.type || "application/octet-stream",
        "x-upsert": "false",
      },
      body: file,
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Úložiště příloh odpovědělo ${response.status}: ${detail.slice(0, 180)}`);
    }
    stored.push({ ...attachment, url: `storage://inquiry-attachments/${path}` });
  }
  return stored;
}

async function insertInquiry(inquiry: PentiInquiry, attachments: InquiryAttachment[], env: InquiryEnv) {
  const payload = { ...inquiry, attachments };
  const base = trim(env.supabaseUrl!);
  const headers = {
    authorization: `Bearer ${env.serviceRoleKey}`,
    apikey: env.serviceRoleKey!,
    "content-type": "application/json",
    prefer: "return=minimal",
  };

  const inquiryResponse = await fetch(`${base}/rest/v1/inquiries`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      id: inquiry.inquiry_id,
      schema_version: inquiry.schema_version,
      created_at: inquiry.created_at,
      status: "submitted",
      locale: inquiry.locale,
      channel: inquiry.channel,
      category: inquiry.intent.category,
      quality_score: inquiry.quality_score,
      payload,
      contact_name: inquiry.contact.name,
      contact_email: inquiry.contact.email,
      contact_phone: inquiry.contact.phone,
    }),
  });
  if (!inquiryResponse.ok) {
    const detail = await inquiryResponse.text();
    throw new Error(`Tabulka inquiries odpověděla ${inquiryResponse.status}: ${detail.slice(0, 180)}`);
  }

  if (attachments.length) {
    const rows = attachments.map((file) => ({
      id: file.id,
      inquiry_id: inquiry.inquiry_id,
      type: file.type,
      filename: file.filename,
      bytes: file.bytes,
      sha256: file.sha256 ?? null,
      url: file.url ?? null,
    }));
    const attachmentResponse = await fetch(`${base}/rest/v1/attachments`, {
      method: "POST",
      headers,
      body: JSON.stringify(rows),
    });
    if (!attachmentResponse.ok) {
      const detail = await attachmentResponse.text();
      throw new Error(`Tabulka attachments odpověděla ${attachmentResponse.status}: ${detail.slice(0, 180)}`);
    }
  }

  await fetch(`${base}/rest/v1/inquiry_events`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      inquiry_id: inquiry.inquiry_id,
      event_type: "submitted",
      detail: { quality_score: inquiry.quality_score, channel: inquiry.channel },
    }),
  });
}

function trim(url: string): string {
  return url.replace(/\/+$/, "");
}
