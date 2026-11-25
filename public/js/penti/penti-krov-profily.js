/* ==========================================================================
   PENTI — NÁVRH PROFILŮ KROVU PODLE STATIKY
   --------------------------------------------------------------------------
   K ČEMU TO JE
   Vybrat hranoly „od oka" nejde. Rozhoduje VOLNÉ ROZPĚTÍ prvku, ne
   velikost domu: sedlová 12×9 s vrcholovou vaznicí projde na výchozích
   profilech, ale 16×10 se stejnou soustavou vycházela na 213 % — a dřevo
   bylo podhodnocené skoro o 22 000 Kč. Tabulka „dům do 12 m → profil X"
   by lhala, musí se to spočítat.

   Tenhle modul dostane geometrii a zadání krovu a vrátí PROFILY, se
   kterými konstrukce staticky projde. U prvků, do kterých uživatel sáhl
   sám, se nic nemění.

   PROČ JE TO SAMOSTATNÝ SOUBOR
   Do 30. 8. 2026 to bylo zadrátované uvnitř `Rozpocet_profi.html` a viselo
   na jeho vnitřním stavu `Z`. Webová kalkulačka krovu se k tomu nedostala
   a měla by dvě možnosti: počítat s výchozími profily (a podhodnotit
   dřevo — přesně ta chyba, kterou tohle mělo odstranit), nebo si napsat
   druhý, vlastní návrh, který se s profi verzí dřív nebo později rozejde.
   Proto se to přestěhovalo sem a profi rozpočet to volá odtud.

   ŽÁDNÉ CENY
   Modul jde na veřejný web. Rozhoduje se podle statiky, ne podle ceny.
   Jediné, co o penězích ví, je pravidlo „lepené dřevo je větší zásah než
   vyšší hranol" — proto se na ně sahá až jako na poslední možnost, a jen
   tam, kde si uživatel druh řeziva nezvolil sám.
   ========================================================================== */
(function (global) {
"use strict";

var VYSKY_ZAKLAD = [140, 160, 180, 200, 220, 240, 260, 280, 300, 320];

/* Výšky, ze kterých se u TOHOTO prvku dá vybírat. Řídí se druhem řeziva:
   BSH roste po 40 mm až do 1000 mm, KVH se nad 280 mm nevyrábí. */
function vyskyProfilu(kod, volby, druhNaZkousku) {
  var R = global.PentiRezivo;
  if (!R || !R.vyskyProfilu) return VYSKY_ZAKLAD;
  var rp = (volby.rezivoPrvku || {})[kod] || {};
  var druh = druhNaZkousku || rp.druh || volby.druhReziva || "pilarske";
  var v = R.vyskyProfilu(druh);
  return (v && v.length) ? v : VYSKY_ZAKLAD;
}

/* Nejhorší posudek daného prvku. `vyhovuje` je AND přes všechny jeho
   posudky — stačí, aby neprošel jeden. */
function statikaPrvku(kod, vysledek) {
  if (!vysledek || !vysledek.statika || !vysledek.statika.radky) return null;
  var moje = vysledek.statika.radky.filter(function (r) { return r.prvek === kod; });
  if (!moje.length) return null;
  var nejhorsi = moje[0];
  moje.forEach(function (r) {
    if ((r.vyuziti || 0) > (nejhorsi.vyuziti || 0)) nejhorsi = r;
  });
  return { vyuziti: nejhorsi.vyuziti,
           vyhovuje: moje.every(function (r) { return r.vyhovuje; }),
           rozhoduje: nejhorsi.nazev, posudku: moje.length };
}

/* ==========================================================================
   NÁVRH
   geom   — výstup PentiEngine.geometrieStrechy
   vstupy — zadání krovu (stejné, jaké bere PentiKrov.spocitej)
   volby  — { rucne:{kod:true}, rezivoPrvku:{}, druhReziva:"pilarske",
              vychozi:{kod:{b,h}}, kol:3 }

   Vrací { profily:{kod:{b,h,…}}, druh:{kod:"bsh"} } — JEN prvky, které se
   proti výchozímu stavu změnily. Prázdno znamená „výchozí profily stačí".
   ========================================================================== */
function navrhni(geom, vstupy, volby) {
  volby = volby || {};
  var K = global.PentiKrov;
  if (!K || !K.spocitej) return { profily: {}, druh: {} };
  if (!geom) return { profily: {}, druh: {} };

  var rucne = volby.rucne || {};
  var vychozi = volby.vychozi || (K.VYCHOZI && K.VYCHOZI.profily) || {};
  var zadane = (vstupy && vstupy.profily) || vychozi;
  var kandidati = Object.keys(zadane).filter(function (k) { return !rucne[k]; });
  if (!kandidati.length) return { profily: {}, druh: {} };

  /* Pracuje se na KOPII zadání. Původní objekt zůstane nedotčený —
     kdyby se do něj psalo, zůstal by po pádu výpočtu přepsaný zkušebním
     hranolem a uživatel by měl v políčku něco, co si nezadal. */
  var z = JSON.parse(JSON.stringify(vstupy || {}));
  z.profily = JSON.parse(JSON.stringify(zadane));
  var rezivo = JSON.parse(JSON.stringify(volby.rezivoPrvku || {}));
  z.rezivoPrvku = rezivo;

  /* Návrh vychází z VÝCHOZÍHO profilu, ne z toho, co zrovna zbylo
     v zadání. Jinak by se dal jen zvětšovat: kdo si jednou zadal velký
     hranol a pak se vrátil k návrhu, dostal by pořád ten velký. */
  kandidati.forEach(function (k) {
    if (vychozi[k]) z.profily[k] = { b: vychozi[k].b, h: vychozi[k].h };
  });
  /* Výchozí hranol věšáku se 22. 9. 2026 změnil ze 140/140 na 180/180
     (do hlavy se zapouštějí vzpěry). Starý uložený scénář má v zadání
     ještě ten starý; když do něj uživatel nesáhl, má dostat nový výchozí —
     proto se u věšáku výsledek zapíše i tehdy, když se dál nezvětšuje.
     U ostatních prvků se to záměrně nedělá, aby se nehnuly staré nabídky. */
  var vysledek = {}, autoDruh = {};
  ["sloupekVes"].forEach(function (k) {
    if (kandidati.indexOf(k) < 0) return;
    var zd = zadane[k], vy = vychozi[k];
    if (zd && vy && (zd.b !== vy.b || zd.h !== vy.h)) vysledek[k] = { b: vy.b, h: vy.h };
  });

  function spocti() {
    try { return K.spocitej(geom, z); } catch (e) { return null; }
  }

  /* Najde nejmenší vyšší hranol, se kterým prvek projde. Zkouší se
     v kopii zadání, takže se nic nemůže „zapomenout" přepsané. */
  function vyssiProfil(kod, druhNaZkousku) {
    var puvodni = z.profily[kod];
    if (!puvodni) return null;
    var vysky = vyskyProfilu(kod, { rezivoPrvku: rezivo, druhReziva: volby.druhReziva },
                             druhNaZkousku);
    var nalezeno = null;
    /* VĚŠÁK I JAKO OBDÉLNÍK (PENTI 14. 10. 2026, PLAN_dokonceni S1;
       navazuje na PLAN_statika_hlava_vesaku krok 2): b = tloušťka podél
       hřebene, h = šířka v rovině vazby (do ní se zapouštějí vzpěry).
       Zkouší se obdélníky s b jako vazný trám (aspoň jako vzpěra, ať se
       vejde celou šířkou) i čtverce a bere se NEJMENŠÍ PRŮŘEZ, který
       projde — u Odrůvek s podhledem 160/240 místo 220/220. */
    if (kod === "sloupekVes") {
      var bT = Math.max((z.profily.tram && z.profily.tram.b) || 0, (z.profily.vzpera && z.profily.vzpera.b) || 0);
      var kand = [];
      vysky.forEach(function (hh) {
        if (hh <= puvodni.h) return;
        kand.push({ b: hh, h: hh });                                   // čtverec
        if (bT > 0 && bT < hh) kand.push({ b: bT, h: hh });           // obdélník podle trámu
      });
      kand.sort(function (p1, p2) { return (p1.b * p1.h - p2.b * p2.h) || (p1.h - p2.h); });
      for (var iK = 0; iK < kand.length; iK++) {
        z.profily[kod] = { b: kand[iK].b, h: kand[iK].h };
        var stK = statikaPrvku(kod, spocti());
        if (stK && stK.vyhovuje) { nalezeno = { b: kand[iK].b, h: kand[iK].h, vyuziti: stK.vyuziti }; break; }
      }
      z.profily[kod] = puvodni;
      return nalezeno;
    }
    for (var i = 0; i < vysky.length; i++) {
      var h = vysky[i];
      if (h <= puvodni.h) continue;                 // menší nebo stejný nemá smysl
      /* Věšák věšadla roste jako ČTVEREC: do jeho boků se zapouštějí vzpěry
         a rozhoduje šířka (krk mezi zapuštěními), ne výška (22. 9. 2026). */
      var bZk = (kod === "sloupekVes") ? h : puvodni.b;
      z.profily[kod] = { b: bZk, h: h };
      var st = statikaPrvku(kod, spocti());
      if (st && st.vyhovuje) { nalezeno = { b: bZk, h: h, vyuziti: st.vyuziti }; break; }
    }
    z.profily[kod] = puvodni;                        // vrátit, ať se zkouší od stejného
    return nalezeno;
  }

  /* Pracuje se postupně: každý dosazený profil může změnit zatížení
     ostatních prvků (vyšší vaznice váží víc), takže se po každém kroku
     počítá znovu. Tři kola stačí — víc už se v praxi nikdy nesešlo. */
  var kol = volby.kol || 3;
  for (var kolo = 0; kolo < kol; kolo++) {
    var zmena = false;
    var v = spocti();
    if (!v || !v.statika) break;

    for (var i = 0; i < kandidati.length; i++) {
      var kod = kandidati[i];
      var st = statikaPrvku(kod, v);
      if (!st || st.vyhovuje) continue;
      var d = vyssiProfil(kod);

      /* ── KDYŽ ROSTLÉ ŘEZIVO NESTAČÍ, ZKUSÍ SE BSH ────────────────────
         Vrcholová vaznice přes velké rozpětí vychází i s nejvyšším
         hranolem na stovky procent a jediné, co by kalkulačka uměla
         říct, je „patří to statikovi". Přitom řešení je běžné: lepený
         nosník, který se dělá až do 1000 mm.

         Přepnout druh je ale VĚTŠÍ ZÁSAH než zvednout výšku. Udělá se
         proto jen tam, kde uživatel druh sám nezvolil. Když u prvku
         konkrétní řezivo vybral, zůstane jeho a BSH se jen doporučí. */
      var vlastniDruh = !!(rezivo[kod] && rezivo[kod].druh);
      var druhTed = (rezivo[kod] && rezivo[kod].druh) || volby.druhReziva || "pilarske";
      if (!d && druhTed !== "bsh") {
        var dBsh = vyssiProfil(kod, "bsh");
        if (dBsh) {
          if (vlastniDruh) {
            /* Nepřepisujeme — jen si poznamenáme doporučení. */
            var vysky = vyskyProfilu(kod, { rezivoPrvku: rezivo, druhReziva: volby.druhReziva });
            vysledek[kod] = { b: z.profily[kod].b, h: vysky[vysky.length - 1],
                              nestaci: true, bshMozne: dBsh };
            z.profily[kod] = { b: vysledek[kod].b, h: vysledek[kod].h };
            zmena = true;
            continue;
          }
          /* Prvek bez vlastní volby — přepneme na BSH i s profilem. */
          rezivo[kod] = Object.assign({}, rezivo[kod], { druh: "bsh" });
          autoDruh[kod] = "bsh";
          z.profily[kod] = { b: dBsh.b, h: dBsh.h };
          vysledek[kod] = { b: dBsh.b, h: dBsh.h, zBsh: true };
          zmena = true;
          continue;
        }
      }

      if (!d) {
        /* ANI NEJVYŠŠÍ HRANOL NESTAČÍ. Nechat prvek na nejmenším profilu
           by bylo zavádějící dvakrát: využití by vyšlo mnohem hůř, než
           jak to doopravdy dopadne, a dřeva by se napočítalo míň, než
           kolik ho tam ve skutečnosti musí být.

           Dosadí se proto NEJVYŠŠÍ dostupný hranol. Konstrukce tím
           nezačne vyhovovat — a musí se to říct nahlas — ale číslo,
           které uživatel uvidí, je pravdivé. */
        var vyskyK = vyskyProfilu(kod, { rezivoPrvku: rezivo, druhReziva: volby.druhReziva });
        var nej = vyskyK[vyskyK.length - 1];
        var ted = z.profily[kod];
        if (ted && ted.h < nej) {
          z.profily[kod] = { b: ted.b, h: nej };
          vysledek[kod] = { b: ted.b, h: nej, nestaci: true };
          zmena = true;
        }
        continue;
      }
      z.profily[kod] = { b: d.b, h: d.h };
      vysledek[kod] = { b: d.b, h: d.h };
      zmena = true;
    }
    if (!zmena) break;
  }

  return { profily: vysledek, druh: autoDruh };
}

var API = { navrhni: navrhni, statikaPrvku: statikaPrvku,
            vyskyProfilu: vyskyProfilu, VYSKY_ZAKLAD: VYSKY_ZAKLAD };
if (typeof module !== "undefined" && module.exports) module.exports = API;
global.PentiKrovProfily = API;
})(typeof window !== "undefined" ? window : globalThis);
