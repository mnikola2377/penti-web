import { geometrieStrechy } from "../lib/geometry";
import {
  buildInquiry,
  type InquiryAttachment,
  type InquiryDraft,
  type ServiceId,
  SERVICES,
  SHAPES,
  PLANS,
  JOBS,
  STRUCTURES,
  ATTIC,
  ROLES,
  COVERINGS,
  FINISHES,
  GUTTERS,
  SHEATHING,
  TIMBER,
  SNOW,
  WIND,
} from "../lib/inquiry";
import { czMeters, czNum, isoWithOffset } from "../lib/format";

const DRAFT_KEY = "penti.inquiry.draft.v1";
const STEP_TITLES = ["Záměr", "Místo", "Tvar", "Konstrukce", "Vrstvy", "Podklady", "Náhled"];

const labels: Record<string, string> = {
  novostavba: "Novostavba",
  rekonstrukce: "Rekonstrukce",
  konstrukce: "Konstrukce",
  pokryvacstvi: "Pokrývačství",
  klempirstvi: "Klempířství",
  kompletni_strecha: "Kompletní střecha",
  material: "Jen materiál",
  vaznik: "Vazníky",
  krov: "Krov",
  hotova: "Konstrukce už stojí",
  sedlova: "Sedlová",
  valbova: "Valbová",
  pultova: "Pultová",
  mansardova: "Mansardová",
  jina: "Jiná",
  obdelnik: "Obdélník",
  jiny: "Jiný půdorys",
  nevyapene: "Nevytápěné",
  puda: "Půda",
  obytne: "Obytné",
  stavebnik: "Stavebník",
  projektant: "Projektant",
  firma: "Firma",
  betonova_taska: "Betonová taška",
  palena_taska: "Pálená taška",
  plechova: "Plechová krytina",
  vlaknocement: "Vláknocement",
  sindel: "Šindel",
  foliova: "Fóliová krytina",
  prirodni: "Přírodní",
  engoba: "Engoba",
  glazura: "Glazura",
  lak: "Lak",
  nezadam: "Nechám na návrhu",
  latovani: "Laťování",
  plne_bedneni: "Plné bednění",
  pozink: "Pozink",
  pozink_lak: "Lakovaný pozink",
  hlinik: "Hliník",
  med: "Měď",
  titanzinek: "Titanzinek",
  susene_hoblovane: "Sušené hoblované",
  kvh: "KVH",
  bsh: "BSH",
  dle_navrhu: "Podle návrhu",
  ano: "Ano",
  ne: "Ne",
  nevim: "Nevím",
};

export function initConfigurator(root: HTMLElement) {
  const formQuery = root.querySelector<HTMLFormElement>("#poptavka-form");
  if (!formQuery) return;
  const form: HTMLFormElement = formQuery;
  const steps = [...form.querySelectorAll<HTMLElement>("[data-step]")];
  const progress = root.querySelector<HTMLOListElement>("#postup");
  const restore = root.querySelector<HTMLElement>("#obnova");
  const result = root.querySelector<HTMLElement>("#vysledek");
  let step = 0;
  let maxReached = 0;
  let photoFiles: File[] = [];
  let planFiles: File[] = [];
  let savedNames: string[] = [];

  ensureIds(form);
  restoreDraft(form);
  bindFiles();
  applyVisibility(form);
  updateVykaz(form);
  renderProgress();

  const params = new URLSearchParams(location.search);
  const requested = Number(params.get("krok"));
  if (Number.isInteger(requested) && requested >= 1 && requested <= steps.length) {
    step = requested - 1;
    maxReached = Math.max(maxReached, step);
  }
  show(step);

  form.addEventListener("change", (event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.name === "services" && target.value === "kompletni_strecha" && target.checked) {
      for (const value of ["konstrukce", "pokryvacstvi", "klempirstvi"]) {
        const box = form.querySelector<HTMLInputElement>(`input[name="services"][value="${value}"]`);
        if (box) box.checked = true;
      }
    }
    applyVisibility(form);
    updateVykaz(form);
    if (step === steps.length - 1) fillSummary(form, photoFiles, planFiles);
    saveSoon();
  });
  form.addEventListener("input", () => {
    updateVykaz(form);
    if (step === steps.length - 1) fillSummary(form, photoFiles, planFiles);
    saveSoon();
  });

  root.querySelector("#pokracovat-draft")?.addEventListener("click", () => {
    const saved = readStorage();
    if (saved) show(Math.min(saved.step ?? 0, steps.length - 1));
    restore?.setAttribute("hidden", "");
  });
  root.querySelector("#zahodit-draft")?.addEventListener("click", () => {
    localStorage.removeItem(DRAFT_KEY);
    photoFiles = [];
    planFiles = [];
    form.reset();
    ensureIds(form);
    applyVisibility(form);
    updateVykaz(form);
    show(0);
    restore?.setAttribute("hidden", "");
  });

  form.querySelector("[data-back]")?.addEventListener("click", () => show(step - 1));
  form.querySelector("[data-next]")?.addEventListener("click", () => {
    const errors = validateStep(step, form, photoFiles, planFiles);
    if (errors.length) return setErrors(steps[step], errors);
    setErrors(steps[step], []);
    maxReached = Math.max(maxReached, step + 1);
    show(step + 1);
  });
  form.querySelector("#stahnout")?.addEventListener("click", () => download(currentInquiry()));
  form.querySelector("#odeslat")?.addEventListener("click", () => void submit());

  progress?.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-goto]");
    if (!button) return;
    const target = Number(button.dataset.goto);
    if (target <= maxReached) show(target);
    else if (target === step + 1) form.querySelector<HTMLButtonElement>("[data-next]")?.click();
  });

  let timer = 0;
  function saveSoon() {
    window.clearTimeout(timer);
    timer = window.setTimeout(save, 200);
  }

  function save() {
    const draft = collect(form, photoFiles, planFiles, false);
    const payload = { step, maxReached, values: serialize(form), files: [...photoFiles, ...planFiles].map((file) => file.name), draftId: draft.draft_id, inquiryId: draft.inquiry_id };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
    savedNames = payload.files;
  }

  function show(next: number) {
    step = Math.max(0, Math.min(steps.length - 1, next));
    steps.forEach((panel, index) => {
      panel.hidden = index !== step;
    });
    if (step === steps.length - 1) fillSummary(form, photoFiles, planFiles);
    const backButton = form.querySelector<HTMLElement>("[data-back]");
    if (backButton) backButton.hidden = step === 0;
    const nextButton = form.querySelector<HTMLElement>("[data-next]");
    const sendButton = form.querySelector<HTMLElement>("#odeslat");
    const downloadButton = form.querySelector<HTMLElement>("#stahnout");
    if (nextButton) nextButton.hidden = step === steps.length - 1;
    if (sendButton) sendButton.hidden = step !== steps.length - 1;
    if (downloadButton) downloadButton.hidden = step !== steps.length - 1;
    renderProgress();
    const heading = steps[step].querySelector("h2");
    if (heading instanceof HTMLElement) {
      heading.tabIndex = -1;
      heading.focus();
    }
    save();
  }

  function renderProgress() {
    if (!progress) return;
    progress.replaceChildren();
    STEP_TITLES.forEach((title, index) => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.goto = String(index);
      button.textContent = `${index + 1}. ${title}`;
      if (index === step) button.setAttribute("aria-current", "step");
      if (index < step || index <= maxReached) button.classList.add("is-done");
      item.append(button);
      progress.append(item);
    });
  }

  function bindFiles() {
    const photos = form.querySelector<HTMLInputElement>("#fotky");
    const plans = form.querySelector<HTMLInputElement>("#vykresy");
    photos?.addEventListener("change", () => {
      photoFiles = photos.files ? [...photos.files] : [];
      listFiles(form.querySelector("#seznam-fotek"), photoFiles);
      saveSoon();
    });
    plans?.addEventListener("change", () => {
      planFiles = plans.files ? [...plans.files] : [];
      listFiles(form.querySelector("#seznam-vykresu"), planFiles);
      saveSoon();
    });
  }

  function restoreDraft(target: HTMLFormElement) {
    const saved = readStorage();
    if (!saved) return;
    maxReached = saved.maxReached ?? saved.step ?? 0;
    writeForm(target, saved.values ?? {});
    if (saved.inquiryId) setValue(target, "inquiry_id", saved.inquiryId);
    if (saved.draftId) setValue(target, "draft_id", saved.draftId);
    savedNames = saved.files ?? [];
    if (restore) {
      restore.hidden = false;
      const text = restore.querySelector("p");
      if (text) {
        text.textContent = savedNames.length
          ? `Máme rozpracovanou poptávku. Přílohy (${savedNames.join(", ")}) je potřeba nahrát znovu.`
          : "Máme rozpracovanou poptávku v tomto prohlížeči.";
      }
    }
  }

  async function submit() {
    const errors = validateStep(steps.length - 1, form, photoFiles, planFiles);
    const earlier = [3, 5].flatMap((index) => validateStep(index, form, photoFiles, planFiles).map((item) => item));
    const all = [...earlier, ...errors];
    if (all.length) return setErrors(steps[step], [...new Set(all)]);
    setErrors(steps[step], []);
    const button = form.querySelector<HTMLButtonElement>("#odeslat");
    if (button) button.disabled = true;
    try {
      const inquiry = await currentInquiryAsync();
      const body = new FormData();
      body.set("payload", JSON.stringify(inquiry));
      body.set("hp", value(form, "hp"));
      for (const file of [...photoFiles, ...planFiles]) body.append("files", file, file.name);
      const response = await fetch("/api/poptavka", { method: "POST", body });
      const payload = (await response.json()) as { ok?: boolean; stored?: boolean; message?: string; errors?: string[]; inquiry_id?: string };
      if (!response.ok || !payload.ok) {
        setErrors(steps[step], payload.errors ?? ["Odeslání se nepovedlo. JSON si můžete stáhnout."]);
        return;
      }
      localStorage.removeItem(DRAFT_KEY);
      form.hidden = true;
      progress?.setAttribute("hidden", "");
      if (result) {
        result.hidden = false;
        const title = result.querySelector("h2");
        const text = result.querySelector("p");
        if (title) title.textContent = payload.stored ? "Poptávku jsme přijali" : "Poptávka je připravená";
        if (text) text.textContent = payload.message ?? "Hotovo.";
        const id = result.querySelector("[data-id]");
        if (id) id.textContent = payload.inquiry_id ?? inquiry.inquiry_id;
      }
      result?.querySelector("[data-download]")?.addEventListener("click", () => download(inquiry));
    } catch {
      setErrors(steps[step], ["Spojení se nepovedlo. JSON si stáhněte a pošlete ho na poptavky@penti.cz."]);
    } finally {
      if (button) button.disabled = false;
    }
  }

  function currentInquiry() {
    return buildInquiry(collect(form, photoFiles, planFiles, true));
  }
  async function currentInquiryAsync() {
    const draft = collect(form, photoFiles, planFiles, true);
    draft.attachments = await attachmentsFrom(photoFiles, planFiles);
    draft.gdpr_consent_at = isoWithOffset(new Date());
    draft.created_at = isoWithOffset(new Date());
    return buildInquiry(draft);
  }
}

function collect(form: HTMLFormElement, photos: File[], plans: File[], withConsent: boolean): InquiryDraft {
  const services = checkedValues(form, "services").filter((item): item is ServiceId => (SERVICES as readonly string[]).includes(item));
  const job = oneOf(value(form, "job"), JOBS, "novostavba");
  const shape = oneOf(value(form, "shape"), SHAPES, "sedlova");
  const plan = oneOf(value(form, "plan"), PLANS, "obdelnik");
  const now = isoWithOffset(new Date());
  return {
    inquiry_id: value(form, "inquiry_id"),
    draft_id: value(form, "draft_id"),
    job,
    services,
    structure: orNull(oneOf(value(form, "structure"), STRUCTURES, "vaznik"), value(form, "structure")),
    keep_existing_structure: value(form, "keep") === "ano" ? true : value(form, "keep") === "ne" ? false : null,
    timber: orNull(oneOf(value(form, "timber"), TIMBER, "dle_navrhu"), value(form, "timber")),
    truss_spacing_mm: numberValue(form, "spacing"),
    knee_wall: checked(form, "knee"),
    address_line: value(form, "address"),
    municipality: value(form, "municipality"),
    postal_code: value(form, "postal"),
    parcel: value(form, "parcel"),
    ruian_building_code: value(form, "ruian"),
    snow_region: (SNOW as readonly string[]).includes(value(form, "snow")) ? (value(form, "snow") as InquiryDraft["snow_region"]) : "",
    wind_region: (WIND as readonly string[]).includes(value(form, "wind")) ? (value(form, "wind") as InquiryDraft["wind_region"]) : "",
    shape,
    plan,
    width_m: numberValue(form, "width"),
    length_m: numberValue(form, "length"),
    pitch_deg: numberValue(form, "pitch"),
    pitch_upper_deg: numberValue(form, "pitch_upper"),
    break_from_wall_m: numberValue(form, "break_m"),
    eave_overhang_m: numberValue(form, "eave") ?? 0.6,
    gable_overhang_m: numberValue(form, "gable") ?? 0.3,
    dormers_count: numberValue(form, "dormers"),
    dimensions_unknown: checked(form, "dimensions_unknown"),
    attic_use: orNull(oneOf(value(form, "attic"), ATTIC, "puda"), value(form, "attic")),
    insulation_interest: (["ano", "ne", "nevim"] as const).includes(value(form, "insulation") as "ano")
      ? (value(form, "insulation") as InquiryDraft["insulation_interest"])
      : null,
    covering_material: orNull(oneOf(value(form, "covering"), COVERINGS, "betonova_taska"), value(form, "covering")),
    covering_finish: orNull(oneOf(value(form, "finish"), FINISHES, "nezadam"), value(form, "finish")),
    covering_color: value(form, "covering_color"),
    sheathing: orNull(oneOf(value(form, "sheathing"), SHEATHING, "latovani"), value(form, "sheathing")),
    gutter_material: orNull(oneOf(value(form, "gutter"), GUTTERS, "pozink_lak"), value(form, "gutter")),
    gutter_color: value(form, "gutter_color"),
    roof_windows_count: numberValue(form, "windows"),
    snow_guards: checked(form, "snow_guards"),
    safety_points: checked(form, "safety"),
    wanted_start_month: value(form, "month"),
    note: value(form, "note"),
    name: value(form, "name"),
    email: value(form, "email"),
    phone: value(form, "phone"),
    role: oneOf(value(form, "role"), ROLES, "stavebnik"),
    gdpr_consent_at: withConsent && checked(form, "gdpr") ? now : "",
    utm: readUtm(),
    attachments: filesToMeta(photos, plans),
  };
}

function validateStep(step: number, form: HTMLFormElement, photos: File[], plans: File[]): string[] {
  const errors: string[] = [];
  const services = checkedValues(form, "services");
  const needsStructure = services.includes("konstrukce") || services.includes("kompletni_strecha");
  const manualShape = value(form, "shape") === "jina" || value(form, "plan") === "jiny" || checked(form, "dimensions_unknown");
  if (step === 0) {
    if (!value(form, "job")) errors.push("Vyberte, jestli jde o novostavbu, nebo rekonstrukci.");
    if (!services.length) errors.push("Vyberte alespoň jednu službu. Můžete jich zatrhnout víc.");
  }
  if (step === 1) {
    if (value(form, "address").trim().length < 2) errors.push("Doplňte ulici a číslo stavby.");
    if (value(form, "municipality").trim().length < 2) errors.push("Doplňte obec.");
    if (!/^\d{3}\s?\d{2}$/.test(value(form, "postal").trim())) errors.push("PSČ napište jako pět číslic.");
  }
  if (step === 2) {
    if (!value(form, "shape")) errors.push("Vyberte tvar střechy.");
    if (!manualShape) {
      const width = numberValue(form, "width");
      const length = numberValue(form, "length");
      const pitch = numberValue(form, "pitch");
      if (width == null || width < 2 || width > 80) errors.push("Šířka má být v metrech, mezi 2 a 80.");
      if (length == null || length < 2 || length > 200) errors.push("Délka má být v metrech, mezi 2 a 200.");
      if (pitch == null || pitch < 3 || pitch > 80) errors.push("Sklon uveďte ve stupních.");
      if (value(form, "shape") === "mansardova") {
        const upper = numberValue(form, "pitch_upper");
        const breakM = numberValue(form, "break_m");
        if (upper == null || pitch == null || upper <= pitch) errors.push("Horní sklon mansardy musí být strmější než dolní.");
        if (breakM == null || breakM <= 0) errors.push("Doplňte vzdálenost zlomu od pozednice v metrech.");
      }
    }
  }
  if (step === 3 && needsStructure && !value(form, "structure")) errors.push("Vyberte nosnou konstrukci.");
  if (step === 3 && value(form, "job") === "rekonstrukce" && !value(form, "keep")) {
    errors.push("Napište, jestli stávající konstrukce zůstává.");
  }
  if (step === 4 && (services.includes("pokryvacstvi") || services.includes("kompletni_strecha")) && !value(form, "covering")) {
    errors.push("Vyberte materiál krytiny, nebo zvolte „jiná“.");
  }
  if (step === 5 && value(form, "job") === "rekonstrukce" && photos.length === 0) {
    errors.push("U rekonstrukce přiložte alespoň jednu fotografii.");
  }
  if (step === 6) {
    if (value(form, "name").trim().length < 2) errors.push("Doplňte jméno.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value(form, "email").trim())) errors.push("E-mail nemá platný tvar.");
    if (value(form, "phone").replace(/\D/g, "").length < 9) errors.push("Telefon potřebuje alespoň 9 číslic.");
    if (!value(form, "role")) errors.push("Vyberte, jestli poptáváte jako stavebník, projektant, nebo firma.");
    if (!checked(form, "gdpr")) errors.push("Potvrďte souhlas se zpracováním údajů.");
    if (manualShape && plans.length === 0) errors.push("Bez rozměrů potřebujeme výkres nebo náčrt.");
    if (value(form, "job") === "rekonstrukce" && photos.length === 0) errors.push("U rekonstrukce chybí fotografie.");
  }
  return errors;
}

function fillSummary(form: HTMLFormElement, photos: File[], plans: File[]) {
  const box = form.querySelector("#shrnuti");
  const json = form.querySelector("#json-nahled");
  if (!box) return;
  const inquiry = buildInquiry(collect(form, photos, plans, true));
  box.replaceChildren();
  const score = document.createElement("p");
  score.className = "data";
  score.textContent = `Kvalita podkladů ${inquiry.quality_score} ze 100`;
  const meter = document.createElement("div");
  meter.className = "meter";
  const bar = document.createElement("span");
  bar.style.width = `${inquiry.quality_score}%`;
  meter.append(bar);
  meter.setAttribute("role", "meter");
  meter.setAttribute("aria-valuemin", "0");
  meter.setAttribute("aria-valuemax", "100");
  meter.setAttribute("aria-valuenow", String(inquiry.quality_score));
  box.append(score, meter);
  const rows: [string, string][] = [
    ["Záměr", `${labels[inquiry.intent.job]}. ${inquiry.intent.services.map((item) => labels[item] ?? item).join(", ")}`],
    ["Místo", `${inquiry.site.address.line}, ${inquiry.site.address.municipality} ${inquiry.site.address.postal_code}`],
    ["Střecha", `${labels[inquiry.roof.shape]}, půdorys ${labels[inquiry.roof.plan_shape].toLowerCase()}`],
    ["Plocha", inquiry.estimate.area_m2 == null ? "Doplníme z podkladů" : `${czNum(inquiry.estimate.area_m2, 1)} m²`],
    ["Hřeben", czMeters(inquiry.estimate.ridge_m)],
    ["Okap", czMeters(inquiry.estimate.eave_m)],
    ["Nároží", czMeters(inquiry.estimate.hip_m)],
    ["Upozornění", inquiry.estimate.disclaimer],
    ["Kontakt", `${inquiry.contact.name}, ${inquiry.contact.email}, ${inquiry.contact.phone}`],
  ];
  for (const [label, text] of rows) {
    const row = document.createElement("p");
    const strong = document.createElement("strong");
    strong.textContent = `${label}: `;
    row.append(strong, document.createTextNode(text));
    box.append(row);
  }
  if (json) json.textContent = JSON.stringify(inquiry, null, 2);
}

function updateVykaz(form: HTMLFormElement) {
  const box = form.querySelector("#vykaz");
  if (!box) return;
  const width = numberValue(form, "width");
  const length = numberValue(form, "length");
  const pitch = numberValue(form, "pitch");
  const shape = oneOf(value(form, "shape"), SHAPES, "sedlova");
  box.replaceChildren();
  const title = document.createElement("p");
  title.className = "data";
  if (checked(form, "dimensions_unknown") || value(form, "plan") === "jiny" || shape === "jina" || width == null || length == null || pitch == null) {
    title.textContent = "Orientační výkaz doplníme z výkresu.";
    box.append(title);
    return;
  }
  const geometry = geometrieStrechy({
    shape,
    plan: "obdelnik",
    width_m: width,
    length_m: length,
    pitch_deg: pitch,
    pitch_upper_deg: numberValue(form, "pitch_upper") ?? undefined,
    break_from_wall_m: numberValue(form, "break_m") ?? undefined,
    eave_overhang_m: numberValue(form, "eave") ?? 0.6,
    gable_overhang_m: numberValue(form, "gable") ?? 0.3,
  });
  title.textContent = geometry.area_m2 == null ? "Výkaz teď nespočítáme." : `Orientační plocha ${czNum(geometry.area_m2, 1)} m²`;
  box.append(title);
  const detail = document.createElement("p");
  detail.textContent = geometry.reason
    ? geometry.reason
    : `Rozvinutá šířka ${czMeters(geometry.developed_width_m)}, hřeben ${czMeters(geometry.ridge_m)}, okap ${czMeters(geometry.eave_m)}. Nejde o cenu.`;
  box.append(detail);
  if (shape !== "pultova" && width > 30) {
    const note = document.createElement("p");
    note.textContent = "Vazníky bez vnitřní podpory uvádíme do 30 m. Větší rozpětí posoudíme zvlášť.";
    box.append(note);
  }
}

function applyVisibility(form: HTMLFormElement) {
  const services = checkedValues(form, "services");
  const has = (...ids: string[]) => ids.some((id) => services.includes(id)) || services.includes("kompletni_strecha");
  const flags: Record<string, boolean> = {
    konstrukce: has("konstrukce"),
    rekonstrukce: value(form, "job") === "rekonstrukce",
    mansarda: value(form, "shape") === "mansardova",
    krytina: has("pokryvacstvi"),
    klempir: has("klempirstvi"),
    nzu: value(form, "job") === "rekonstrukce" || value(form, "attic") === "obytne",
    drevo: has("konstrukce") && (value(form, "structure") === "vaznik" || value(form, "structure") === "krov"),
    valba: value(form, "shape") === "valbova",
  };
  form.querySelectorAll<HTMLElement>("[data-when]").forEach((node) => {
    const key = node.dataset.when ?? "";
    node.hidden = !flags[key];
  });
}

function setErrors(step: HTMLElement, errors: string[]) {
  const box = step.querySelector<HTMLElement>(".errors");
  if (!box) return;
  box.replaceChildren();
  errors.forEach((error) => {
    const row = document.createElement("p");
    row.textContent = `! ${error}`;
    box.append(row);
  });
  if (errors.length) box.focus();
}

function filesToMeta(photos: File[], plans: File[]): InquiryAttachment[] {
  return [
    ...photos.map((file, index) => meta(file, "foto", index)),
    ...plans.map((file, index) => meta(file, "vykres", index)),
  ];
}

function meta(file: File, type: InquiryAttachment["type"], index: number): InquiryAttachment {
  return { id: `${type}_${index + 1}`, type, filename: file.name, bytes: file.size, sha256: null, url: null };
}

async function attachmentsFrom(photos: File[], plans: File[]): Promise<InquiryAttachment[]> {
  const all = filesToMeta(photos, plans);
  const files = [...photos, ...plans];
  for (let index = 0; index < all.length; index += 1) {
    all[index].sha256 = await sha256(files[index]);
    all[index].id = `att_${(await sha256(files[index])).slice(0, 8)}_${index + 1}`;
  }
  return all;
}

async function sha256(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function download(inquiry: unknown) {
  const blob = new Blob([JSON.stringify(inquiry, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "penti-inquiry.json";
  link.click();
  URL.revokeObjectURL(link.href);
}

function listFiles(node: Element | null, files: File[]) {
  if (!node) return;
  node.textContent = files.length ? files.map((file) => `${file.name} (${Math.ceil(file.size / 1024)} kB)`).join(", ") : "Zatím nic.";
}

function ensureIds(form: HTMLFormElement) {
  if (!value(form, "inquiry_id")) setValue(form, "inquiry_id", crypto.randomUUID());
  if (!value(form, "draft_id")) setValue(form, "draft_id", crypto.randomUUID());
}

function readUtm() {
  const params = new URLSearchParams(location.search);
  const source = params.get("utm_source") ?? undefined;
  const medium = params.get("utm_medium") ?? undefined;
  const campaign = params.get("utm_campaign") ?? undefined;
  return source || medium || campaign ? { source, medium, campaign } : null;
}

function readStorage(): { step?: number; maxReached?: number; values?: Record<string, string | boolean>; files?: string[]; inquiryId?: string; draftId?: string } | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as NonNullable<ReturnType<typeof readStorage>>) : null;
  } catch {
    return null;
  }
}

function serialize(form: HTMLFormElement): Record<string, string | boolean> {
  const output: Record<string, string | boolean> = {};
  const elements = [...form.elements].filter((element): element is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement => {
    return element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement;
  });
  for (const element of elements) {
    if (!element.name || element.name === "hp" || element.type === "file") continue;
    if (element instanceof HTMLInputElement && (element.type === "checkbox" || element.type === "radio")) {
      if (element.type === "radio") {
        if (element.checked) output[element.name] = element.value;
      } else if (element.name === "services") {
        output[`services:${element.value}`] = element.checked;
      } else output[element.name] = element.checked;
    } else output[element.name] = element.value;
  }
  return output;
}

function writeForm(form: HTMLFormElement, values: Record<string, string | boolean>) {
  for (const [key, stored] of Object.entries(values)) {
    if (key.startsWith("services:")) {
      const box = form.querySelector<HTMLInputElement>(`input[name="services"][value="${key.slice(9)}"]`);
      if (box) box.checked = Boolean(stored);
      continue;
    }
    const element = form.elements.namedItem(key);
    if (element instanceof RadioNodeList) {
      const radio = [...element].find((item) => item instanceof HTMLInputElement && item.value === stored);
      if (radio instanceof HTMLInputElement) radio.checked = true;
    } else if (element instanceof HTMLInputElement && element.type === "checkbox") {
      element.checked = Boolean(stored);
    } else if (element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) {
      element.value = String(stored ?? "");
    }
  }
}

function value(form: HTMLFormElement, name: string): string {
  const element = form.elements.namedItem(name);
  if (element instanceof RadioNodeList) return String(element.value ?? "");
  if (element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) return element.value;
  return "";
}

function setValue(form: HTMLFormElement, name: string, next: string) {
  const element = form.elements.namedItem(name);
  if (element instanceof HTMLInputElement) element.value = next;
}

function checked(form: HTMLFormElement, name: string): boolean {
  const element = form.elements.namedItem(name);
  return element instanceof HTMLInputElement && element.checked;
}

function checkedValues(form: HTMLFormElement, name: string): string[] {
  return [...form.querySelectorAll<HTMLInputElement>(`input[name="${name}"]:checked`)].map((input) => input.value);
}

function numberValue(form: HTMLFormElement, name: string): number | null {
  const raw = value(form, name).trim().replace(",", ".");
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function oneOf<T extends string>(value: string, list: readonly T[], fallback: T): T {
  return (list as readonly string[]).includes(value) ? (value as T) : fallback;
}

function orNull<T extends string>(parsed: T, raw: string): T | null {
  return raw ? parsed : null;
}
