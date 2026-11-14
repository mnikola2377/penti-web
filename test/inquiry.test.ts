import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { buildInquiry, validateInquiry, type InquiryDraft } from "../src/lib/inquiry.ts";
import { handleInquiryRequest } from "../src/lib/handle-inquiry.ts";
import { handleContactRequest } from "../src/lib/handle-contact.ts";

const draft: InquiryDraft = {
  inquiry_id: "8f2c1a0e-4b3d-4c1a-9e77-0c0d1b2a3e4f",
  draft_id: "11111111-2222-4333-8444-555555555555",
  created_at: "2026-11-10T21:00:00+01:00",
  job: "rekonstrukce",
  services: ["konstrukce", "pokryvacstvi", "klempirstvi"],
  structure: "krov",
  keep_existing_structure: false,
  timber: "susene_hoblovane",
  truss_spacing_mm: 900,
  knee_wall: false,
  address_line: "Ukázková 12",
  municipality: "Vyškov",
  postal_code: "682 01",
  parcel: "",
  ruian_building_code: "",
  snow_region: "II",
  wind_region: "II",
  shape: "sedlova",
  plan: "obdelnik",
  width_m: 9.6,
  length_m: 12.4,
  pitch_deg: 40,
  pitch_upper_deg: null,
  break_from_wall_m: null,
  eave_overhang_m: 0.6,
  gable_overhang_m: 0.3,
  dormers_count: 0,
  dimensions_unknown: false,
  attic_use: "obytne",
  insulation_interest: "ano",
  covering_material: "betonova_taska",
  covering_finish: "engoba",
  covering_color: "antracit",
  sheathing: "latovani",
  gutter_material: "pozink_lak",
  gutter_color: "antracit",
  roof_windows_count: 2,
  snow_guards: true,
  safety_points: false,
  wanted_start_month: "2027-04",
  note: "Ukázková poptávka pro ověření schématu.",
  name: "Jan Novák",
  email: "jan@example.cz",
  phone: "+420777000000",
  role: "stavebnik",
  gdpr_consent_at: "2026-11-10T21:05:00+01:00",
  utm: null,
  attachments: [
    {
      id: "att_01",
      type: "foto",
      filename: "strecha-jih.jpg",
      bytes: 2450000,
      sha256: null,
      url: "https://storage.example/att_01",
    },
  ],
};

test("platná poptávka projde a má plochu z geometrie", () => {
  const inquiry = buildInquiry(draft);
  assert.equal(inquiry.estimate.area_m2, 183.3);
  assert.equal(inquiry.estimate.range_from_czk, null);
  assert.equal(inquiry.site.address.postal_code, "68201");
  assert.equal(inquiry.site.distance_to_plant_km, null);
  assert.equal(inquiry.quality_score, 100);
  const result = validateInquiry(inquiry);
  assert.equal(result.ok, true);
});

test("ukázkový soubor v repozitáři je platný balíček", () => {
  const example = JSON.parse(readFileSync(new URL("../examples/penti.inquiry.v1.example.json", import.meta.url), "utf8"));
  const result = validateInquiry(example);
  assert.equal(result.ok, true, result.ok ? "" : result.errors.join(" "));
  if (result.ok) {
    assert.equal(result.inquiry.schema_version, "penti.inquiry.v1");
    assert.equal(result.inquiry.estimate.area_m2, 183.3);
    assert.equal(result.inquiry.estimate.range_to_czk, null);
  }
});

test("cenový rozsah a chybějící fotka u rekonstrukce neprojdou", () => {
  const inquiry = buildInquiry(draft);
  const withPrice = { ...inquiry, estimate: { ...inquiry.estimate, range_from_czk: 1000 } };
  const price = validateInquiry(withPrice);
  assert.equal(price.ok, false);

  const withoutPhoto = { ...inquiry, attachments: [] };
  const photo = validateInquiry(withoutPhoto);
  assert.equal(photo.ok, false);
  if (!photo.ok) assert.match(photo.errors.join(" "), /fotografi/);
});

test("bez klíčů Supabase se poptávka nezahodí", async () => {
  const inquiry = buildInquiry(draft);
  const response = await handleInquiryRequest(
    new Request("http://local/api/poptavka", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(inquiry) }),
    {},
  );
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.stored, false);
  assert.equal(response.body.reason, "missing_env");
});

test("honeypot se tiše ignoruje", async () => {
  const response = await handleInquiryRequest(
    new Request("http://local/api/poptavka", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ hp: "bot" }),
    }),
    { supabaseUrl: "https://example.supabase.co", serviceRoleKey: "secret" },
  );
  assert.equal(response.status, 200);
  assert.equal(response.body.ignored, true);
});

test("kontakt bez úložiště vrátí srozumitelnou odpověď", async () => {
  const response = await handleContactRequest(
    new Request("http://local/api/kontakt", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "kontakt", name: "Anna Nová", email: "anna@example.cz", phone: "777111222", message: "Potřebuji krov.", gdpr: true }),
    }),
    {},
  );
  assert.equal(response.status, 200);
  assert.equal(response.body.stored, false);
});
