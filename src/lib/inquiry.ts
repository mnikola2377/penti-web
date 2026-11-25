import { geometrieStrechy, type PlanShape, type RoofShape } from "./geometry";
import { isoWithOffset } from "./format";

export const SCHEMA_VERSION = "penti.inquiry.v1" as const;

export const SERVICES = [
  "konstrukce",
  "pokryvacstvi",
  "klempirstvi",
  "kompletni_strecha",
  "material",
] as const;

export const JOBS = ["novostavba", "rekonstrukce"] as const;
export const STRUCTURES = ["vaznik", "krov", "hotova"] as const;
export const ATTIC = ["nevyapene", "puda", "obytne"] as const;
export const ROLES = ["stavebnik", "projektant", "firma"] as const;
export const SHAPES: RoofShape[] = ["sedlova", "valbova", "pultova", "mansardova", "jina"];
export const PLANS: PlanShape[] = ["obdelnik", "ctverec", "L", "T", "U", "lichobeznik", "jiny", "vlastni"];
export const COVERINGS = [
  "betonova_taska",
  "palena_taska",
  "plechova",
  "vlaknocement",
  "sindel",
  "foliova",
  "jina",
] as const;
export const FINISHES = ["prirodni", "engoba", "glazura", "lak", "nezadam"] as const;
export const GUTTERS = ["pozink", "pozink_lak", "hlinik", "med", "titanzinek", "jiny"] as const;
export const SHEATHING = ["latovani", "plne_bedneni", "nezadam"] as const;
export const TIMBER = ["susene_hoblovane", "kvh", "bsh", "dle_navrhu"] as const;
export const SNOW = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"] as const;
export const WIND = ["I", "II", "III", "IV", "V"] as const;

export type ServiceId = (typeof SERVICES)[number];

export interface InquiryAttachment {
  id: string;
  type: "foto" | "vykres" | "jiny";
  filename: string;
  bytes: number;
  sha256?: string | null;
  url?: string | null;
}

export interface InquiryDraft {
  inquiry_id: string;
  draft_id: string;
  created_at?: string;
  job: (typeof JOBS)[number];
  services: ServiceId[];
  structure: (typeof STRUCTURES)[number] | null;
  keep_existing_structure: boolean | null;
  timber: (typeof TIMBER)[number] | null;
  truss_spacing_mm: number | null;
  knee_wall: boolean | null;
  address_line: string;
  municipality: string;
  postal_code: string;
  parcel: string;
  ruian_building_code: string;
  snow_region: (typeof SNOW)[number] | "";
  wind_region: (typeof WIND)[number] | "";
  shape: RoofShape;
  plan: PlanShape;
  width_m: number | null;
  length_m: number | null;
  pitch_deg: number | null;
  pitch_upper_deg: number | null;
  break_from_wall_m: number | null;
  eave_overhang_m: number | null;
  gable_overhang_m: number | null;
  dormers_count: number | null;
  dimensions_unknown: boolean;
  attic_use: (typeof ATTIC)[number] | null;
  insulation_interest: "ano" | "ne" | "nevim" | null;
  covering_material: (typeof COVERINGS)[number] | null;
  covering_finish: (typeof FINISHES)[number] | null;
  covering_color: string;
  sheathing: (typeof SHEATHING)[number] | null;
  gutter_material: (typeof GUTTERS)[number] | null;
  gutter_color: string;
  roof_windows_count: number | null;
  snow_guards: boolean;
  safety_points: boolean;
  wanted_start_month: string;
  note: string;
  name: string;
  email: string;
  phone: string;
  role: (typeof ROLES)[number];
  gdpr_consent_at: string;
  utm: { source?: string; medium?: string; campaign?: string } | null;
  attachments: InquiryAttachment[];
}

export interface PentiInquiry {
  schema_version: typeof SCHEMA_VERSION;
  inquiry_id: string;
  draft_id: string;
  created_at: string;
  locale: "cs-CZ";
  channel: "web";
  quality_score: number;
  utm: InquiryDraft["utm"];
  intent: {
    category: "strecha";
    job: InquiryDraft["job"];
    services: ServiceId[];
    structure: InquiryDraft["structure"];
    keep_existing_structure: boolean | null;
    timber: InquiryDraft["timber"];
    truss_spacing_mm: number | null;
    knee_wall: boolean | null;
  };
  site: {
    address: {
      line: string;
      municipality: string;
      postal_code: string;
      parcel: string | null;
      country: "CZ";
    };
    ruian_building_code: string | null;
    snow_region: string | null;
    wind_region: string | null;
    snow_load_kpa: null;
    distance_to_plant_km: null;
  };
  roof: {
    shape: RoofShape;
    plan_shape: PlanShape;
    width_m: number | null;
    length_m: number | null;
    pitch_deg: number | null;
    pitch_upper_deg: number | null;
    break_from_wall_m: number | null;
    eave_overhang_m: number | null;
    gable_overhang_m: number | null;
    dormers_count: number | null;
    attic_use: InquiryDraft["attic_use"];
    insulation_interest: InquiryDraft["insulation_interest"];
    covering: {
      material: InquiryDraft["covering_material"];
      finish: InquiryDraft["covering_finish"];
      color: string | null;
    } | null;
    gutters: {
      material: InquiryDraft["gutter_material"];
      color: string | null;
    } | null;
    sheathing: InquiryDraft["sheathing"];
    roof_windows_count: number | null;
    snow_guards: boolean;
    safety_points: boolean;
  };
  estimate: {
    kind: "orientacni_vykaz";
    area_m2: number | null;
    ridge_m: number | null;
    eave_m: number | null;
    verge_m: number | null;
    hip_m: number | null;
    span_m: number | null;
    developed_width_m: number | null;
    currency: "CZK";
    range_from_czk: null;
    range_to_czk: null;
    manual_quote: boolean;
    disclaimer: string;
  };
  wanted_start_month: string | null;
  note: string | null;
  contact: {
    name: string;
    email: string;
    phone: string;
    role: InquiryDraft["role"];
    gdpr_consent_at: string;
  };
  attachments: InquiryAttachment[];
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const OFFSET = /[+-]\d{2}:\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function qualityScore(draft: Pick<
  InquiryDraft,
  | "address_line"
  | "municipality"
  | "postal_code"
  | "width_m"
  | "length_m"
  | "pitch_deg"
  | "dimensions_unknown"
  | "attachments"
  | "wanted_start_month"
  | "name"
  | "email"
  | "phone"
  | "job"
>): number {
  let score = 0;
  if (draft.address_line.trim() && draft.municipality.trim() && normalizePostal(draft.postal_code)) score += 25;
  const hasDimensions =
    draft.width_m != null && draft.length_m != null && draft.pitch_deg != null && !draft.dimensions_unknown;
  const hasDrawing = draft.attachments.some((file) => file.type === "vykres");
  if (hasDimensions || hasDrawing) score += 25;
  if (draft.attachments.some((file) => file.type === "foto")) score += 15;
  if (MONTH.test(draft.wanted_start_month)) score += 10;
  if (draft.name.trim().length >= 2 && EMAIL.test(draft.email.trim()) && phoneDigits(draft.phone).length >= 9) score += 25;
  return score;
}

export function buildInquiry(draft: InquiryDraft, now = new Date()): PentiInquiry {
  const geometry =
    draft.width_m != null &&
    draft.length_m != null &&
    draft.pitch_deg != null &&
    draft.eave_overhang_m != null &&
    draft.gable_overhang_m != null &&
    !draft.dimensions_unknown
      ? geometrieStrechy({
          shape: draft.shape,
          plan: draft.plan,
          width_m: draft.width_m,
          length_m: draft.length_m,
          pitch_deg: draft.pitch_deg,
          pitch_upper_deg: draft.pitch_upper_deg ?? undefined,
          break_from_wall_m: draft.break_from_wall_m ?? undefined,
          eave_overhang_m: draft.eave_overhang_m,
          gable_overhang_m: draft.gable_overhang_m,
        })
      : null;

  const manual = !geometry?.ok || geometry.manual || draft.shape === "jina" || draft.plan === "jiny";
  const disclaimer = manual
    ? `Nejde o závaznou nabídku. ${geometry?.reason ?? "Podklady předáme k ručnímu nacenění."}`
    : "Nejde o závaznou nabídku. Jde o orientační výkaz plochy a délek, ne o cenu.";

  const wantsCover = draft.services.some((service) => service === "pokryvacstvi" || service === "kompletni_strecha");
  const wantsMetal = draft.services.some((service) => service === "klempirstvi" || service === "kompletni_strecha");

  return {
    schema_version: SCHEMA_VERSION,
    inquiry_id: draft.inquiry_id,
    draft_id: draft.draft_id,
    created_at: draft.created_at ?? isoWithOffset(now),
    locale: "cs-CZ",
    channel: "web",
    quality_score: qualityScore(draft),
    utm: draft.utm,
    intent: {
      category: "strecha",
      job: draft.job,
      services: draft.services,
      structure: draft.services.includes("konstrukce") || draft.services.includes("kompletni_strecha") ? draft.structure : null,
      keep_existing_structure: draft.job === "rekonstrukce" ? draft.keep_existing_structure : null,
      timber: draft.timber,
      truss_spacing_mm: draft.truss_spacing_mm,
      knee_wall: draft.knee_wall,
    },
    site: {
      address: {
        line: draft.address_line.trim(),
        municipality: draft.municipality.trim(),
        postal_code: normalizePostal(draft.postal_code) ?? draft.postal_code.trim(),
        parcel: draft.parcel.trim() || null,
        country: "CZ",
      },
      ruian_building_code: draft.ruian_building_code.trim() || null,
      snow_region: draft.snow_region || null,
      wind_region: draft.wind_region || null,
      snow_load_kpa: null,
      distance_to_plant_km: null,
    },
    roof: {
      shape: draft.shape,
      plan_shape: draft.plan,
      width_m: draft.width_m,
      length_m: draft.length_m,
      pitch_deg: draft.pitch_deg,
      pitch_upper_deg: draft.shape === "mansardova" ? draft.pitch_upper_deg : null,
      break_from_wall_m: draft.shape === "mansardova" ? draft.break_from_wall_m : null,
      eave_overhang_m: draft.eave_overhang_m,
      gable_overhang_m: draft.gable_overhang_m,
      dormers_count: draft.dormers_count,
      attic_use: draft.attic_use,
      insulation_interest: draft.insulation_interest,
      covering: wantsCover
        ? {
            material: draft.covering_material,
            finish: draft.covering_finish,
            color: draft.covering_color.trim() || null,
          }
        : null,
      gutters: wantsMetal
        ? {
            material: draft.gutter_material,
            color: draft.gutter_color.trim() || null,
          }
        : null,
      sheathing: wantsCover ? draft.sheathing : null,
      roof_windows_count: draft.roof_windows_count,
      snow_guards: draft.snow_guards,
      safety_points: draft.safety_points,
    },
    estimate: {
      kind: "orientacni_vykaz",
      area_m2: geometry?.area_m2 ?? null,
      ridge_m: geometry?.ridge_m ?? null,
      eave_m: geometry?.eave_m ?? null,
      verge_m: geometry?.verge_m ?? null,
      hip_m: geometry?.hip_m ?? null,
      span_m: geometry?.span_m ?? null,
      developed_width_m: geometry?.developed_width_m ?? null,
      currency: "CZK",
      range_from_czk: null,
      range_to_czk: null,
      manual_quote: manual,
      disclaimer,
    },
    wanted_start_month: MONTH.test(draft.wanted_start_month) ? draft.wanted_start_month : null,
    note: draft.note.trim() || null,
    contact: {
      name: draft.name.trim(),
      email: draft.email.trim(),
      phone: draft.phone.trim(),
      role: draft.role,
      gdpr_consent_at: draft.gdpr_consent_at,
    },
    attachments: draft.attachments,
  };
}

export function validateInquiry(input: unknown): { ok: true; inquiry: PentiInquiry } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!isRecord(input)) return { ok: false, errors: ["Tělo poptávky není objekt."] };
  const data = input;

  if (data.schema_version !== SCHEMA_VERSION) errors.push("schema_version musí být penti.inquiry.v1.");
  if (!isUuid(data.inquiry_id)) errors.push("inquiry_id musí být UUID.");
  if (!isUuid(data.draft_id)) errors.push("draft_id musí být UUID.");
  if (typeof data.created_at !== "string" || !OFFSET.test(data.created_at)) {
    errors.push("created_at musí obsahovat posun časového pásma.");
  }
  if (data.locale !== "cs-CZ") errors.push("locale musí být cs-CZ.");
  if (data.channel !== "web") errors.push("channel musí být web.");
  if (typeof data.quality_score !== "number" || data.quality_score < 0 || data.quality_score > 100) {
    errors.push("quality_score musí být číslo 0 až 100.");
  }

  const intent = isRecord(data.intent) ? data.intent : null;
  if (!intent) errors.push("Chybí intent.");
  else {
    if (intent.category !== "strecha") errors.push("V této verzi umíme jen kategorii strecha.");
    if (!includes(JOBS, intent.job)) errors.push("intent.job není povolená hodnota.");
    if (!Array.isArray(intent.services) || intent.services.length === 0 || intent.services.some((item) => !includes(SERVICES, item))) {
      errors.push("Vyberte alespoň jednu platnou službu.");
    }
    if (intent.structure != null && !includes(STRUCTURES, intent.structure)) errors.push("intent.structure není platný.");
  }

  const site = isRecord(data.site) ? data.site : null;
  const address = site && isRecord(site.address) ? site.address : null;
  if (!address) errors.push("Chybí adresa stavby.");
  else {
    if (typeof address.line !== "string" || address.line.trim().length < 2) errors.push("Doplňte ulici a číslo stavby.");
    if (typeof address.municipality !== "string" || address.municipality.trim().length < 2) errors.push("Doplňte obec.");
    if (address.postal_code != null && address.postal_code !== "" && (typeof address.postal_code !== "string" || !normalizePostal(address.postal_code))) {
      errors.push("PSČ musí mít pět číslic, nebo zůstat prázdné.");
    }
    if (address.country !== "CZ") errors.push("country musí být CZ.");
  }
  if (site) {
    if (site.snow_region != null && !includes(SNOW, site.snow_region)) errors.push("Sněhová oblast není platná.");
    if (site.wind_region != null && !includes(WIND, site.wind_region)) errors.push("Větrná oblast není platná.");
    if (site.snow_load_kpa != null && (typeof site.snow_load_kpa !== "number" || site.snow_load_kpa <= 0)) {
      errors.push("snow_load_kpa musí být kladné číslo, nebo null.");
    }
    if (site.distance_to_plant_km != null) errors.push("distance_to_plant_km dopočítáme až z mapy, teď musí být null.");
  }

  const roof = isRecord(data.roof) ? data.roof : null;
  if (!roof) errors.push("Chybí blok roof.");
  else {
    if (!includes(SHAPES, roof.shape)) errors.push("Neznámý tvar střechy.");
    if (!includes(PLANS, roof.plan_shape)) errors.push("Neznámý půdorys.");
    for (const key of ["width_m", "length_m", "pitch_deg", "eave_overhang_m", "gable_overhang_m"] as const) {
      if (roof[key] != null && (typeof roof[key] !== "number" || !Number.isFinite(roof[key]))) errors.push(`${key} musí být číslo, nebo null.`);
    }
  }

  const estimate = isRecord(data.estimate) ? data.estimate : null;
  if (!estimate) errors.push("Chybí estimate.");
  else {
    if (estimate.kind !== "orientacni_vykaz") errors.push("estimate.kind musí být orientacni_vykaz.");
    if (estimate.currency !== "CZK") errors.push("Měna musí být CZK.");
    if (estimate.range_from_czk != null || estimate.range_to_czk != null) {
      errors.push("Cenový rozsah zatím nezveřejňujeme. range_from_czk a range_to_czk musí být null.");
    }
    if (typeof estimate.disclaimer !== "string" || !estimate.disclaimer.includes("Nejde o závaznou nabídku")) {
      errors.push("Disclaimer musí říct, že nejde o závaznou nabídku.");
    }
  }

  const contact = isRecord(data.contact) ? data.contact : null;
  if (!contact) errors.push("Chybí kontakt.");
  else {
    if (typeof contact.name !== "string" || contact.name.trim().length < 2) errors.push("Doplňte jméno.");
    const email = typeof contact.email === "string" ? contact.email.trim() : "";
    const phone = typeof contact.phone === "string" ? contact.phone : "";
    if (!email && phoneDigits(phone).length < 9) errors.push("Doplňte e-mail, nebo telefon s alespoň 9 číslicemi.");
    if (email && !EMAIL.test(email)) errors.push("E-mail nemá platný tvar.");
    if (phoneDigits(phone).length > 0 && phoneDigits(phone).length < 9) errors.push("Telefon potřebuje alespoň 9 číslic.");
    if (!includes(ROLES, contact.role)) errors.push("Vyberte roli.");
    if (typeof contact.gdpr_consent_at !== "string" || !OFFSET.test(contact.gdpr_consent_at)) {
      errors.push("Chybí čas souhlasu se zpracováním údajů.");
    }
  }

  if (data.wanted_start_month != null && (typeof data.wanted_start_month !== "string" || !MONTH.test(data.wanted_start_month))) {
    errors.push("Termín uveďte jako RRRR-MM, nebo null.");
  }

  if (!Array.isArray(data.attachments)) errors.push("attachments musí být pole.");
  else {
    data.attachments.forEach((file, index) => {
      if (!isRecord(file)) {
        errors.push(`Příloha ${index + 1} není objekt.`);
        return;
      }
      if (typeof file.filename !== "string" || !file.filename.trim()) errors.push(`Příloha ${index + 1} nemá název.`);
      if (file.type !== "foto" && file.type !== "vykres" && file.type !== "jiny") errors.push(`Příloha ${index + 1} má neznámý typ.`);
      if (typeof file.bytes !== "number" || file.bytes < 0) errors.push(`Příloha ${index + 1} nemá velikost.`);
      if ("content" in file || "base64" in file) errors.push("Soubory nepatří dovnitř JSON, jen odkaz a kontrolní součet.");
    });
  }

  if (intent?.job === "rekonstrukce" && Array.isArray(data.attachments) && !data.attachments.some((file) => isRecord(file) && file.type === "foto")) {
    errors.push("U rekonstrukce přiložte alespoň jednu fotografii střechy.");
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, inquiry: data as unknown as PentiInquiry };
}

export function normalizePostal(value: string): string | null {
  const digits = value.replace(/\s/g, "");
  return /^\d{5}$/.test(digits) ? digits : null;
}

export function phoneDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

function includes<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (list as readonly string[]).includes(value);
}
