export interface ContactEnv {
  supabaseUrl?: string;
  serviceRoleKey?: string;
}

export interface ContactMessage {
  kind: "kontakt" | "kariera";
  name: string;
  email: string;
  phone: string;
  message: string;
  trade: string | null;
  gdpr: boolean;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateContact(input: unknown): { ok: true; message: ContactMessage } | { ok: false; errors: string[] } {
  if (typeof input !== "object" || input === null) return { ok: false, errors: ["Chybí údaje."] };
  const data = input as Record<string, unknown>;
  const errors: string[] = [];
  const kind = data.kind === "kariera" ? "kariera" : data.kind === "kontakt" ? "kontakt" : null;
  if (!kind) errors.push("Neznámý typ zprávy.");
  const name = typeof data.name === "string" ? data.name.trim() : "";
  const email = typeof data.email === "string" ? data.email.trim() : "";
  const phone = typeof data.phone === "string" ? data.phone.trim() : "";
  const message = typeof data.message === "string" ? data.message.trim() : "";
  const trade = typeof data.trade === "string" && data.trade.trim() ? data.trade.trim() : null;
  if (name.length < 2) errors.push("Doplňte jméno.");
  if (!EMAIL.test(email)) errors.push("E-mail nemá platný tvar.");
  if (phone.replace(/\D/g, "").length < 9) errors.push("Telefon potřebuje alespoň 9 číslic.");
  if (kind === "kontakt" && message.length < 5) errors.push("Napište, s čím můžeme pomoci.");
  if (kind === "kariera" && !trade) errors.push("Vyberte řemeslo.");
  if (data.gdpr !== true) errors.push("Potvrďte souhlas se zpracováním údajů.");
  if (errors.length || !kind) return { ok: false, errors };
  return { ok: true, message: { kind, name, email, phone, message, trade, gdpr: true } };
}

export async function handleContactRequest(request: Request, env: ContactEnv) {
  if (request.method !== "POST") return { status: 405, body: { ok: false, errors: ["Povolená metoda je POST."] } };
  let json: Record<string, unknown>;
  try {
    json = (await request.json()) as Record<string, unknown>;
  } catch {
    return { status: 400, body: { ok: false, errors: ["Zprávu se nepodařilo přečíst."] } };
  }
  if (typeof json.hp === "string" && json.hp.trim()) return { status: 200, body: { ok: true, stored: false } };
  const validated = validateContact(json);
  if (!validated.ok) return { status: 400, body: { ok: false, errors: validated.errors } };

  if (!env.supabaseUrl || !env.serviceRoleKey) {
    return {
      status: 200,
      body: {
        ok: true,
        stored: false,
        reason: "missing_env",
        message: "Zpráva je v pořádku, úložiště ale ještě není připojené. Napište nám prosím přímo na info@penti.cz.",
      },
    };
  }

  const response = await fetch(`${env.supabaseUrl.replace(/\/+$/, "")}/rest/v1/contact_messages`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.serviceRoleKey}`,
      apikey: env.serviceRoleKey,
      "content-type": "application/json",
      prefer: "return=minimal",
    },
    body: JSON.stringify({
      kind: validated.message.kind,
      name: validated.message.name,
      email: validated.message.email,
      phone: validated.message.phone,
      message: validated.message.message,
      trade: validated.message.trade,
    }),
  });
  if (!response.ok) {
    return { status: 502, body: { ok: false, errors: ["Zprávu se nepodařilo uložit. Napište na info@penti.cz."] } };
  }
  return { status: 201, body: { ok: true, stored: true, message: "Děkujeme. Ozveme se vám." } };
}
