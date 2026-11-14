import assert from "node:assert/strict";
import test from "node:test";
import { geometrieStrechy } from "../src/lib/geometry.ts";

test("sedlová střecha sedí s jádrem koncepce", () => {
  const geometry = geometrieStrechy({
    shape: "sedlova",
    plan: "obdelnik",
    width_m: 9.6,
    length_m: 12.4,
    pitch_deg: 40,
    eave_overhang_m: 0.6,
    gable_overhang_m: 0.3,
  });
  assert.equal(geometry.manual, false);
  assert.equal(geometry.plan_area_m2, 140.4);
  assert.equal(geometry.area_m2, 183.3);
  assert.equal(geometry.ridge_m, 13);
  assert.equal(geometry.eave_m, 26);
  assert.equal(geometry.verge_m, 28.2);
  assert.equal(geometry.span_m, 9.6);
});

test("valbová střecha má nároží a kratší hřeben", () => {
  const geometry = geometrieStrechy({
    shape: "valbova",
    plan: "obdelnik",
    width_m: 9.6,
    length_m: 12.4,
    pitch_deg: 40,
    eave_overhang_m: 0.6,
    gable_overhang_m: 0.3,
  });
  assert.equal(geometry.area_m2, 191.7);
  assert.equal(geometry.ridge_m, 2.8);
  assert.equal(geometry.eave_m, 48.8);
  assert.equal(geometry.hip_m, 35.52);
});

test("pultová střecha počítá jednu rovinu", () => {
  const geometry = geometrieStrechy({
    shape: "pultova",
    plan: "obdelnik",
    width_m: 9.6,
    length_m: 12.4,
    pitch_deg: 40,
    eave_overhang_m: 0.6,
    gable_overhang_m: 0.3,
  });
  assert.equal(geometry.plan_area_m2, 138.72);
  assert.equal(geometry.area_m2, 181.1);
  assert.equal(geometry.eave_m, 10.2);
  assert.equal(geometry.verge_m, 35.51);
});

test("mansarda dá plochu a zároveň ruční nacenění", () => {
  const geometry = geometrieStrechy({
    shape: "mansardova",
    plan: "obdelnik",
    width_m: 9.6,
    length_m: 12.4,
    pitch_deg: 30,
    pitch_upper_deg: 60,
    break_from_wall_m: 2.2,
    eave_overhang_m: 0.6,
    gable_overhang_m: 0.3,
  });
  assert.equal(geometry.ok, true);
  assert.equal(geometry.manual, true);
  assert.equal(geometry.area_m2, 219.3);
});

test("neznámý tvar nejde nacenit automaticky", () => {
  const geometry = geometrieStrechy({
    shape: "jina",
    plan: "obdelnik",
    width_m: 9,
    length_m: 12,
    pitch_deg: 35,
    eave_overhang_m: 0.5,
    gable_overhang_m: 0.3,
  });
  assert.equal(geometry.manual, true);
  assert.equal(geometry.area_m2, null);
});
