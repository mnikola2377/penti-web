import puppeteer from "puppeteer-core";
import { mkdir } from "node:fs/promises";

const browser = await puppeteer.launch({
  executablePath: "/usr/local/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const out = "/opt/cursor/artifacts";
await mkdir(out, { recursive: true });

async function shot(page, name) {
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
  console.log("saved", name);
}

const home = await browser.newPage();
await home.evaluateOnNewDocument(() => localStorage.setItem("penti_consent", "denied"));
await home.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
await home.goto("http://127.0.0.1:4321/", { waitUntil: "networkidle0" });
await shot(home, "homepage-desktop");

await home.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await home.goto("http://127.0.0.1:4321/", { waitUntil: "networkidle0" });
await shot(home, "homepage-mobile");
await home.close();

const page = await browser.newPage();
await page.evaluateOnNewDocument(() => localStorage.setItem("penti_consent", "denied"));
await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
await page.goto("http://127.0.0.1:4321/poptavka/strecha", { waitUntil: "networkidle0" });

async function choose(selector) {
  await page.$eval(selector, (element) => {
    if (element instanceof HTMLInputElement) {
      element.checked = true;
      element.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
}

async function next() {
  await page.click("[data-next]");
  await new Promise((resolve) => setTimeout(resolve, 200));
}

await shot(page, "konfigurator-01-zamer");
await choose('input[name="job"][value="novostavba"]');
await choose('input[name="services"][value="konstrukce"]');
await choose('input[name="services"][value="pokryvacstvi"]');
await next();
await shot(page, "konfigurator-02-misto");

await page.type('input[name="address"]', "Ukázková 12");
await page.type('input[name="municipality"]', "Vyškov");
await page.type('input[name="postal"]', "68201");
await next();
await shot(page, "konfigurator-03-tvar");

await choose('input[name="shape"][value="sedlova"]');
await page.click('input[name="width"]', { clickCount: 3 });
await page.type('input[name="width"]', "9.6");
await page.type('input[name="length"]', "12.4");
await page.type('input[name="pitch"]', "40");
await new Promise((resolve) => setTimeout(resolve, 200));
const vykaz = await page.$eval("#vykaz", (node) => node.textContent || "");
if (!vykaz.includes("183,3")) throw new Error(`Výkaz neobsahuje 183,3: ${vykaz}`);
await shot(page, "konfigurator-03-tvar-vyplneno");
await next();
await shot(page, "konfigurator-04-konstrukce");

await choose('input[name="structure"][value="krov"]');
await choose('input[name="attic"][value="obytne"]');
await next();
await shot(page, "konfigurator-05-vrstvy");

await page.select('select[name="covering"]', "betonova_taska");
await page.select('select[name="finish"]', "engoba");
await page.type('input[name="covering_color"]', "antracit");
await next();
await shot(page, "konfigurator-06-podklady");

await page.type('textarea[name="note"]', "Ukázkový průchod konfigurátorem.");
await page.$eval('input[name="month"]', (input) => {
  input.value = "2027-04";
  input.dispatchEvent(new Event("input", { bubbles: true }));
});
await next();
await shot(page, "konfigurator-07-nahled");

await page.type('input[name="name"]', "Jan Novák");
await page.type('input[name="email"]', "jan@example.cz");
await page.type('input[name="phone"]', "+420777000000");
await page.select('select[name="role"]', "stavebnik");
await choose('input[name="gdpr"]');
await new Promise((resolve) => setTimeout(resolve, 250));
const json = await page.$eval("#json-nahled", (node) => node.textContent || "");
const data = JSON.parse(json);
if (data.schema_version !== "penti.inquiry.v1") throw new Error("špatné schéma");
if (data.estimate.area_m2 !== 183.3) throw new Error(`plocha ${data.estimate.area_m2}`);
if (data.estimate.range_from_czk !== null) throw new Error("cena nemá být vyplněná");
await shot(page, "konfigurator-07-nahled-vyplneno");
console.log("konfigurátor prošel, plocha", data.estimate.area_m2, "skóre", data.quality_score);

await browser.close();
