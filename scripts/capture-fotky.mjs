import puppeteer from "puppeteer-core";
import { mkdir } from "node:fs/promises";

const browser = await puppeteer.launch({
  executablePath: "/usr/local/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const out = "/opt/cursor/artifacts";
await mkdir(out, { recursive: true });

async function open(width, height, scale, path) {
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => localStorage.setItem("penti_consent", "denied"));
  await page.setViewport({ width, height, deviceScaleFactor: scale });
  await page.goto(`http://127.0.0.1:4321${path}`, { waitUntil: "networkidle0" });
  return page;
}

const desktop = await open(1440, 900, 1, "/");
await desktop.screenshot({ path: `${out}/homepage-desktop.png`, fullPage: true });
await desktop.close();

const mobile = await open(390, 844, 2, "/");
await mobile.screenshot({ path: `${out}/homepage-mobile.png`, fullPage: true });
await mobile.close();

const realizace = await open(1440, 900, 1, "/realizace");
await realizace.screenshot({ path: `${out}/realizace-desktop.png`, fullPage: true });
await realizace.close();

const onas = await open(1440, 900, 1, "/o-nas");
await onas.screenshot({ path: `${out}/o-nas-casova-osa.png`, fullPage: true });
await onas.close();

console.log("screenshots saved");
await browser.close();
