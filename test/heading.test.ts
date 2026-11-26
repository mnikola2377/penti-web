import assert from "node:assert/strict";
import test from "node:test";
import { splitHeading } from "../src/lib/heading.ts";

test("slogan se láme za realizujeme", () => {
  const parts = splitHeading("Vyrábíme a realizujeme dřevěné konstrukce a střechy na klíč");
  assert.equal(parts.light, "Vyrábíme a realizujeme");
  assert.equal(parts.strong, "dřevěné konstrukce a střechy na klíč");
});

test("krátký nadpis se spojkou nenechá klíč začínat na a", () => {
  const parts = splitHeading("Vazníky, krovy a pergoly");
  assert.equal(parts.light, "Vazníky,");
  assert.equal(parts.strong, "krovy a pergoly");
});

test("předložka nezůstane viset na konci lehkého úvodu", () => {
  const parts = splitHeading("Řemeslo v Ivanovicích na Hané");
  assert.equal(parts.light, "Řemeslo");
  assert.equal(parts.strong, "v Ivanovicích na Hané");
});

test("dvouslovné oslovení zůstane pohromadě", () => {
  const parts = splitHeading("Ozvěte se");
  assert.equal(parts.light, "");
  assert.equal(parts.strong, "Ozvěte se");
});
