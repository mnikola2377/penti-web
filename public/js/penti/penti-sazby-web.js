/* ==========================================================================
   PENTI — VEŘEJNÉ SAZBY VAZNÍKŮ PRO WEBOVÝ ODHAD
   --------------------------------------------------------------------------
   TENTO SOUBOR SE NEUPRAVUJE RUČNĚ.
   Vygeneroval ho `node nastroje/sazby-web.js` z interního ceníku
   `penti-cenik-vazniky.js` dne 2026-08-28. Když se změní interní ceník,
   spusť generátor znovu — jinak bude web nabízet loňské ceny.

   Čísla jsou SLOUČENÁ A ZAOKROUHLENÁ NAHORU. Výroba a montáž jsou jedno
   číslo, doprava jedna sazba bez jména dopravce, nadrozměr jedna přirážka.
   Rozpad na jednotlivé náklady tu záměrně není — jsou to ceny pro
   zákazníka, ne naše kalkulace.

   Je to ORIENTAČNÍ ODHAD. Přesnou cenu spočítá rozpočtář z návrhu vazníků.
   ========================================================================== */
(function (global) {
"use strict";
global.PENTI_SAZBY_WEB = {
  "vyrobaAMontazKcM2": 810,
  "tvarStrechy": {
    "sedlova": 1,
    "pultova": 0.94,
    "valbova": 1.21
  },
  "tvarPudorysu": {
    "obdelnik": 1,
    "ctverec": 1,
    "L": 1.05,
    "U": 1.08,
    "T": 1.05,
    "lichobeznik": 1.05,
    "vlastni": 1.05
  },
  "velikost": {
    "do80": 1.05,
    "do250": 1,
    "do400": 1.02,
    "nad400": 0.9
  },
  "dopravaKcKm": 60,
  "nadrozmerNad32": 6000,
  "nadrozmerNad35": 17000,
  "vyskaDoprovod": 3.2,
  "vyskaPovoleni": 3.5,
  "rozptylProcent": 15
};
})(typeof window !== "undefined" ? window : globalThis);
