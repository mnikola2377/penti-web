import { expect, test, type Page } from "@playwright/test";
import { validateInquiry } from "../src/lib/inquiry";

const live = process.env.PLAYWRIGHT_LIVE === "1";

function sbirejChyby(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  return errors;
}

async function dalsi(page: Page) {
  const btn = page.locator(".wizard-panel.active [data-wizard-next]");
  await expect(btn).toBeVisible();
  await btn.click();
}

test.beforeEach(async ({ page }) => {
  if (live) return;
  await page.route("**/api/poptavka", async (route) => {
    const body = route.request().postDataJSON();
    const result = validateInquiry(body);
    if (!result.ok) {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, errors: result.errors }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, stored: false }),
    });
  });
});

test("střecha: chybějící rozměr zastaví krok a pak jde až k odeslání", async ({ page }, info) => {
  const errors = sbirejChyby(page);
  await page.goto("/poptavka/strecha/");
  await expect(page.locator(".rozmer-napoveda").first()).toContainText("vnější líc");
  await expect(page.locator("label[for='w-dim-A']")).toContainText("venkovní rozměr zdiva");
  await expect(page.locator("#w-strechy button")).toHaveCount(3);
  await expect(page.locator("script[src='/js/penti/penti-wizard.js']")).toHaveCount(1);

  await page.locator("#w-dim-A").fill("");
  await dalsi(page);
  await expect(page.locator("#wizard-chyba")).toContainText("Délka");
  await expect(page.locator("#w-sklon")).toBeHidden();

  await page.locator("#w-dim-A").fill("12");
  await dalsi(page);
  await expect(page.locator("#w-sklon")).toBeVisible();
  await dalsi(page);
  await expect(page.locator("#w-material")).toBeVisible();
  await expect(page.locator("#w-material option")).not.toHaveCount(0);
  await dalsi(page);
  await expect(page.locator("#w-zaklop")).toBeVisible();
  await page.locator(".wizard-panel.active [data-wizard-vysledek]").click();

  await expect(page.locator("#calc-result")).toHaveClass(/show/);
  await expect(page.locator("#res-vykaz")).not.toBeEmpty();
  await expect(page.locator("#res-nadpis")).not.toHaveText("Nepodařilo se spočítat");

  if (info.project.name !== "desktop") {
    expect(errors, errors.join("\n")).toEqual([]);
    return;
  }

  await page.locator("[name=jmeno]").fill("TEST poptávka – nevolat");
  await page.locator("[name=email]").fill("test-penti@example.com");
  await page.locator("[name=lokalita]").fill("TEST obec");
  await page.locator("#w-gdpr").check();

  const response = page.waitForResponse(
    (res) => res.url().includes("/api/poptavka") && res.request().method() === "POST",
  );
  await page.locator("#res-odeslat").click();
  const res = await response;
  const payload = res.request().postDataJSON() as {
    contact?: { name?: string };
    roof?: { dimensions_basis?: string; eave_overhang_m?: number; gable_overhang_m?: number };
  };
  expect(payload.contact?.name).toContain("TEST");
  expect(payload.roof?.dimensions_basis).toBe("outer_masonry");
  expect(payload.roof?.eave_overhang_m).toBe(0.5);
  expect(payload.roof?.gable_overhang_m).toBe(0.3);
  expect(res.ok(), await res.text()).toBeTruthy();
  await expect(page.locator("#res-stav")).toContainText("Poptávka odeslána");
  expect(errors, errors.join("\n")).toEqual([]);
});

test("krov a materiál jsou předvolby téhož průvodce", async ({ page }) => {
  const errors = sbirejChyby(page);

  await page.goto("/poptavka/strecha/?vypocet=krov");
  await expect(page.locator(".t-lead")).toContainText("řeziva");
  await dalsi(page);
  await dalsi(page);
  await dalsi(page);
  await expect(page.locator("#w-nosna")).toHaveValue("krov");
  await expect(page.locator("#w-krov-box")).toBeVisible();
  await page.locator(".wizard-panel.active [data-wizard-vysledek]").click();
  await expect(page.locator("#calc-result")).toHaveClass(/show/);
  await expect(page.locator("#res-krov")).toBeVisible();

  await page.goto("/poptavka/strecha/?poptavka=material");
  await expect(page.locator(".t-lead")).toContainText("jen materiál");
  await dalsi(page);
  await dalsi(page);
  await dalsi(page);
  await expect(page.locator("#w-rozsah")).toHaveValue("jen_material");
  await page.locator(".wizard-panel.active [data-wizard-vysledek]").click();
  await expect(page.locator("#calc-result")).toHaveClass(/show/);
  await expect(page.locator("#res-podnadpis")).toContainText("jen materiál");

  expect(errors, errors.join("\n")).toEqual([]);
});

test("vazník dojde k orientační ceně", async ({ page }) => {
  const errors = sbirejChyby(page);
  await page.goto("/kalkulatory/vaznik/");
  await expect(page.locator(".wizard-panel.active")).toContainText("Jaký tvar");
  await dalsi(page);
  await expect(page.locator("#w-sklon")).toBeVisible();
  await expect(page.locator(".rozmer-napoveda").first()).toContainText("vnější líc");
  await expect(page.locator("#w-presah")).toBeVisible();
  await expect(page.locator("#w-stit")).toBeVisible();
  await page.locator("#w-dim-A").fill("");
  await dalsi(page);
  await expect(page.locator("#wizard-chyba")).toContainText("Délka");
  await page.locator("#w-dim-A").fill("12");
  await dalsi(page);
  await expect(page.locator("#w-sneh")).toBeVisible();
  await page.locator(".wizard-panel.active [data-wizard-vysledek]").click();
  await expect(page.locator("#calc-result")).toHaveClass(/show/);
  await expect(page.locator("#res-cena")).toContainText("Kč");
  await expect(page.locator("#cena-upozorneni")).toContainText("orientační nezávazné nacenění");
  await expect(page.locator("#res-pozn")).toContainText("orientační nezávazné nacenění");
  expect(errors, errors.join("\n")).toEqual([]);
});
