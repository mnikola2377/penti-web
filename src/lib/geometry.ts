/**
 * Geometrie obdélníkové střechy.
 * Vzorce jsou ověřené proti jádru koncepce (geometrieStrechy) pro sedlovou,
 * valbovou a pultovou střechu a pro lomenou sedlovou (mansardu).
 * Cenu nepočítáme. Atypický půdorys a neznámý tvar jdou k ručnímu nacenění.
 */

export type RoofShape = "sedlova" | "valbova" | "pultova" | "mansardova" | "jina";
export type PlanShape = "obdelnik" | "ctverec" | "L" | "T" | "U" | "lichobeznik" | "jiny" | "vlastni";

export interface RoofGeometryInput {
  shape: RoofShape;
  plan: PlanShape;
  /** Rozpětí mezi okapy, v metrech. U pultové střechy šířka okapu. */
  width_m: number;
  /** Délka ve směru hřebene. U pultové střechy vodorovný průřez po spádu. */
  length_m: number;
  pitch_deg: number;
  pitch_upper_deg?: number;
  /** Vodorovná vzdálenost zlomu od pozednice, v metrech. */
  break_from_wall_m?: number;
  eave_overhang_m: number;
  gable_overhang_m: number;
}

export interface RoofGeometry {
  ok: boolean;
  /** True = bez orientační ceny, rozpočet připraví člověk. */
  manual: boolean;
  reason?: string;
  plan_area_m2: number | null;
  area_m2: number | null;
  ridge_m: number | null;
  eave_m: number | null;
  verge_m: number | null;
  hip_m: number | null;
  span_m: number | null;
  developed_width_m: number | null;
}

const empty = (manual: boolean, reason: string): RoofGeometry => ({
  ok: false,
  manual,
  reason,
  plan_area_m2: null,
  area_m2: null,
  ridge_m: null,
  eave_m: null,
  verge_m: null,
  hip_m: null,
  span_m: null,
  developed_width_m: null,
});

const round = (value: number, digits: number) => {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

const rad = (deg: number) => (deg * Math.PI) / 180;

export function geometrieStrechy(input: RoofGeometryInput): RoofGeometry {
  if (input.shape === "jina" || input.plan === "jiny") {
    return empty(true, "Atypický tvar nebo půdorys naceníme ručně z výkresu.");
  }

  const width = input.width_m;
  const length = input.length_m;
  const pitch = input.pitch_deg;
  const eave = input.eave_overhang_m;
  const gable = input.gable_overhang_m;

  if (!(width > 0 && length > 0 && pitch > 0 && pitch < 89)) {
    return empty(true, "Rozměry nebo sklon zatím nestačí pro výkaz.");
  }
  if (eave < 0 || gable < 0 || eave > 3 || gable > 3) {
    return empty(true, "Přesah je mimo běžný rozsah. Naceníme ho ručně.");
  }

  const sec = 1 / Math.cos(rad(pitch));

  if (input.shape === "sedlova" || input.shape === "mansardova") {
    const roofW = width + 2 * eave;
    const roofL = length + 2 * gable;
    const plan = roofW * roofL;

    if (input.shape === "sedlova") {
      const developed = roofW * sec;
      return {
        ok: true,
        manual: false,
        plan_area_m2: round(plan, 2),
        area_m2: round(plan * sec, 1),
        ridge_m: round(roofL, 2),
        eave_m: round(2 * roofL, 2),
        verge_m: round(2 * developed, 2),
        hip_m: 0,
        span_m: round(width, 2),
        developed_width_m: round(developed, 2),
      };
    }

    const upper = input.pitch_upper_deg ?? 0;
    const breakM = input.break_from_wall_m ?? 0;
    if (!(upper > pitch && upper < 89 && breakM > 0)) {
      return empty(true, "U mansardy potřebujeme horní sklon a vzdálenost zlomu od pozednice.");
    }
    const half = roofW / 2;
    const lowerRun = eave + breakM;
    const upperRun = half - lowerRun;
    if (upperRun <= 0.05) {
      return empty(true, "Zlom vychází za polovinu rozpětí. Mansardu naceníme z výkresu.");
    }
    const lowerLen = lowerRun / Math.cos(rad(pitch));
    const upperLen = upperRun / Math.cos(rad(upper));
    const developed = lowerLen + upperLen;
    return {
      ok: true,
      manual: true,
      reason: "Mansardu naceníme ručně. Plocha níže je jen orientační výkaz.",
      plan_area_m2: round(plan, 2),
      area_m2: round(2 * roofL * developed, 1),
      ridge_m: round(roofL, 2),
      eave_m: round(2 * roofL, 2),
      verge_m: round(2 * developed, 2),
      hip_m: 0,
      span_m: round(width, 2),
      developed_width_m: round(developed, 2),
    };
  }

  if (input.shape === "valbova") {
    const roofW = width + 2 * eave;
    const roofL = length + 2 * eave;
    const plan = roofW * roofL;
    const ridge = Math.max(0, Math.abs(roofL - roofW));
    const half = Math.min(roofW, roofL) / 2;
    const rise = half * Math.tan(rad(pitch));
    const hipOne = Math.hypot(half * Math.SQRT2, rise);
    return {
      ok: true,
      manual: false,
      plan_area_m2: round(plan, 2),
      area_m2: round(plan * sec, 1),
      ridge_m: round(ridge, 2),
      eave_m: round(2 * (roofW + roofL), 2),
      verge_m: 0,
      hip_m: round(4 * hipOne, 2),
      span_m: round(Math.min(width, length), 2),
      developed_width_m: round(Math.min(roofW, roofL) * sec, 2),
    };
  }

  const roofW = width + 2 * gable;
  const roofL = length + 2 * eave;
  const plan = roofW * roofL;
  return {
    ok: true,
    manual: false,
    plan_area_m2: round(plan, 2),
    area_m2: round(plan * sec, 1),
    ridge_m: null,
    eave_m: round(roofW, 2),
    verge_m: round(2 * roofL * sec, 2),
    hip_m: 0,
    span_m: round(length, 2),
    developed_width_m: round(roofL * sec, 2),
  };
}
