/* ==========================================================================
   PENTI — ORIENTAČNÍ ODHAD CENY VAZNÍKŮ PRO VEŘEJNÝ WEB
   --------------------------------------------------------------------------
   K ČEMU TO JE
   Zákazník na webu zadá tvar a rozměry domu a uvidí, v jakém rozpětí se
   vazníky pohybují. Není to nabídka. Úkolem toho čísla je dát rozumnou
   představu a přimět zákazníka poptat přesnou cenu — ne nahradit ji.

   PROČ ROZPĚTÍ A NE JEDNO ČÍSLO
   Jedno konkrétní číslo svádí k tomu, aby nás u něj zákazník držel.
   Rozpětí říká pravdu o tom, co odhad z obálky budovy umí: neví nic
   o vikýřích, prostupech, dostupnosti stavby ani o tom, jak vazník
   nakonec vyjde ze statiky.

   VZTAH K INTERNÍMU VÝPOČTU
   Vzorec je stejný jako v `penti-cenik-vazniky.js` (plocha × sazba
   × koeficienty + doprava), ale bere sazby ze `penti-sazby-web.js` —
   tedy sloučené a zaokrouhlené. Nákladová struktura a jména dopravců
   se sem nedostanou.

   PŘESNOU CENU POČÍTÁ NĚKDO JINÝ
   Rozpočtář používá `vazniky-vypocet.js` ve SkladPRO, který počítá zpětně
   z hotového návrhu — z kubatury pořezu, hmotnosti a šířky nákladu. Ten
   sedí na korunu, ale ta čísla vzniknou až po návrhu v Pamiru.
   ========================================================================== */
(function (global) {
"use strict";

/* Zaokrouhlovací krok — u větších čísel hrubší, ať je z pohledu jasné,
   že jde o odhad a ne o kalkulaci na koruny. */
function krok(castka) {
  if (castka < 100000) return 5000;
  if (castka < 500000) return 10000;
  return 25000;
}
const dolu  = (x, k) => Math.floor(x / k) * k;
const nahoru = (x, k) => Math.ceil(x / k) * k;

/* Koeficient velikosti podle půdorysu střechy VČETNĚ PŘESAHŮ.
   Malá střecha je na metr dražší — režie se nemá do čeho rozpustit. */
function koefVelikosti(plocha, S) {
  if (plocha < 80)  return S.velikost.do80;
  if (plocha > 400) return S.velikost.nad400;
  if (plocha > 250) return S.velikost.do400;
  return S.velikost.do250;
}

/* ==========================================================================
   ODHAD
   geom = výstup PentiEngine.geometrieStrechy
   v    = {fp, roof, slope, oOkap, km}
   ========================================================================== */
function odhad(geom, v) {
  const S = global.PENTI_SAZBY_WEB;
  /* Spadlý odhad nesmí vrátit nulu — z ceny 0 Kč by se stala nabídka. */
  if (!S) throw new Error("PENTI: chybí penti-sazby-web.js, odhad se nedá spočítat.");
  if (!geom || !(geom.roofArea > 0) || !(geom.area > 0))
    throw new Error("PENTI: geometrie střechy nevyšla, odhad se nedá spočítat.");
  v = v || {};

  const plochaPudorys = geom.area;          // půdorys střechy vč. přesahů
  const plochaSikma   = geom.roofArea;      // po tom se vazník vyrábí
  const span = geom.span, sklon = +v.slope || 0;
  const oOkap = +v.oOkap || 0;

  /* Obálka vazníku — rozhoduje jen o tom, jestli je náklad nadrozměrný. */
  const delkaVazniku = span + 2 * oOkap;
  const tgMax = Math.tan((geom.maxSlope || sklon) * Math.PI / 180);
  const vyskaVazniku = (v.roof === "pultova"
    ? span * Math.tan(sklon * Math.PI / 180)
    : (span / 2) * tgMax) + 0.15;

  const kStrecha = S.tvarStrechy[v.roof] || 1;
  const kPudorys = S.tvarPudorysu[v.fp] || 1;
  const kVelikost = koefVelikosti(plochaPudorys, S);

  const vyrobaAMontaz = plochaSikma * S.vyrobaAMontazKcM2 * kStrecha * kPudorys * kVelikost;

  /* Doprava se počítá tam i zpět. */
  const km = +v.km || 0;
  let doprava = 2 * km * S.dopravaKcKm;
  let nadrozmer = 0;
  if (vyskaVazniku > S.vyskaPovoleni)      nadrozmer = S.nadrozmerNad35;
  else if (vyskaVazniku >= S.vyskaDoprovod) nadrozmer = S.nadrozmerNad32;
  doprava += nadrozmer;

  const stred = vyrobaAMontaz + doprava;
  const r = S.rozptylProcent / 100;
  const k = krok(stred);

  return {
    plochaPudorys: Math.round(plochaPudorys * 10) / 10,
    plochaSikma:   Math.round(plochaSikma * 10) / 10,
    delkaVazniku:  Math.round(delkaVazniku * 100) / 100,
    vyskaVazniku:  Math.round(vyskaVazniku * 100) / 100,
    nadrozmerny:   nadrozmer > 0,
    /* Rozpětí: dolní mez dolů, horní nahoru — ať se odhad nezúží
       zaokrouhlením na něco přesnějšího, než ve skutečnosti je. */
    od: dolu(stred * (1 - r), k),
    do: nahoru(stred * (1 + r), k),
    stred: Math.round(stred)
  };
}

var API = { odhad: odhad, koefVelikosti: koefVelikosti };
if (typeof module !== "undefined" && module.exports) module.exports = API;
global.PentiVaznikWeb = API;
})(typeof window !== "undefined" ? window : globalThis);
