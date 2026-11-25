/* ==========================================================================
   PENTI — SPOTŘEBA ŘEZIVA NA KROV, PRO VEŘEJNÝ WEB
   --------------------------------------------------------------------------
   K ČEMU TO JE
   Zákazník na webu zadá tvar střechy, soustavu a druh řeziva — a dostane
   výkaz krovu po prvcích: krokve, pozednice, vaznice, sloupky, kleštiny,
   s profily, počty kusů a objednacími délkami.

   PROFILY SE NEHÁDAJÍ
   Navrhne je `penti-krov-profily.js` podle statiky, stejně jako v profi
   rozpočtu. Kdyby se použily výchozí profily, na velkém domě by dřevo
   chybělo — sedlová 16×10 s vrcholovou vaznicí vychází na 213 % a výkaz
   by vypadal hotově. To je přesně ten druh chyby, kterou nikdo nenajde,
   dokud nepřijede kamion.

   POSUDEK JE ORIENTAČNÍ
   Statika se počítá, ale je to podklad pro nabídku, ne náhrada za statika.
   Musí to být napsané tak, aby si to nikdo nespletl.

   ŽÁDNÉ CENY
   Modul jde na veřejný web. Množství ano, cenu ne.
   ========================================================================== */
(function (global) {
"use strict";

function r1(x) { return Math.round(x * 10) / 10; }
function r3(x) { return Math.round(x * 1000) / 1000; }

/* ── KTERÁ SOUSTAVA KE KTERÉMU TVARU STŘECHY ─────────────────────────────
   Modul krovu kombinaci „pultová střecha × nepultová soustava" odmítne
   a vrátí prázdný výkaz. Nabídnout ji zákazníkovi by znamenalo poslat ho
   do slepé uličky, tak se rovnou nenabídne. */
var PRO_PULT = ["pultova_bez", "pultova_s"];
var PRO_OSTATNI = ["vrcholova", "stredove", "obe", "hambalek", "vesadlo"];

function soustavyProStrechu(roof) {
  var K = global.PentiKrov;
  var kody = (roof === "pultova") ? PRO_PULT : PRO_OSTATNI;
  var S = (K && K.SOUSTAVY) || {};
  return kody.filter(function (k) { return !!S[k]; })
             .map(function (k) { return { kod: k, nazev: S[k].nazev || S[k] }; });
}

/* Když si zákazník neví rady, vybere se za něj rozumná soustava podle
   rozponu. Je to VOLBA, ne výpočet — proto se vrací i důvod, ať je
   napsaný ve výsledku a rozpočtář ho může přebít. */
function doporucSoustavu(geom) {
  if (!geom) return null;
  if (geom.roof === "pultova") {
    var siroky = (geom.span || 0) > 6;
    return { kod: siroky ? "pultova_s" : "pultova_bez",
             proc: siroky
               ? "Rozpon nad 6 m — krokev potřebuje mezilehlou podporu."
               : "Rozpon do 6 m — krokev vyjde bez mezilehlé vaznice." };
  }
  var rozpon = geom.span || 0;
  if (rozpon <= 7) {
    return { kod: "hambalek",
             proc: "Do 7 m rozponu vyjde hambálkový krov — nepotřebuje sloupky, "
                 + "takže zůstane volné podkroví." };
  }
  if (rozpon <= 11) {
    return { kod: "vrcholova",
             proc: "Rozpon " + r1(rozpon) + " m — vrcholová vaznice na sloupcích "
                 + "je nejběžnější a nejlevnější řešení." };
  }
  return { kod: "stredove",
           proc: "Rozpon " + r1(rozpon) + " m — středové vaznice rozdělí krokev "
               + "na kratší pole, takže vyjde nižší profil." };
}

/* ==========================================================================
   VÝKAZ KROVU
   geom — výstup PentiEngine.geometrieStrechy
   v    — { soustava, roztecKrokvi, druhReziva, snehOblast, vitrOblast,
            teren, tridaDreva, nadezdivkaM, hmotnostKrytinyKgM2 }
   ========================================================================== */
function vykaz(geom, v) {
  var K = global.PentiKrov, P = global.PentiKrovProfily;
  if (!K || !K.spocitej) {
    throw new Error("PENTI: chybí penti-krov.js, krov nelze spočítat.");
  }
  if (!geom || !(geom.roofArea > 0)) {
    throw new Error("PENTI: geometrie střechy nevyšla, krov nelze spočítat.");
  }
  v = v || {};
  var potize = [];

  /* Soustava. „poradte" znamená, že si ji zákazník nevybral — vybereme
     ji za něj a NAPÍŠEME PROČ. Mlčky zvolená soustava by vypadala jako
     jeho rozhodnutí. */
  var doporuceni = null, soustava = v.soustava;
  if (!soustava || soustava === "poradte") {
    doporuceni = doporucSoustavu(geom);
    soustava = doporuceni ? doporuceni.kod : "vrcholova";
  }
  var moznosti = soustavyProStrechu(geom.roof).map(function (s) { return s.kod; });
  if (moznosti.indexOf(soustava) < 0) {
    throw new Error("PENTI: soustava \"" + soustava + "\" k tomuhle tvaru střechy "
      + "nepatří. Výkaz by vyšel prázdný.");
  }

  var vstupy = {
    soustava: soustava,
    roztecKrokvi: v.roztecKrokvi || 0.9,
    nadezdivkaM: v.nadezdivkaM || 0,
    snehOblast: v.snehOblast || 2,
    vitrOblast: v.vitrOblast || 2,
    teren: v.teren || "III",
    tridaDreva: v.tridaDreva || "C24",
    hmotnostKrytinyKgM2: (v.hmotnostKrytinyKgM2 != null) ? v.hmotnostKrytinyKgM2 : 45,
    stitoveHrany: (geom.roof === "valbova") ? [] : (v.stitoveHrany || [])
  };

  /* ── PROFILY PODLE STATIKY ────────────────────────────────────────────
     Stejný modul, jaký je navrhuje v profi rozpočtu. Kdyby chyběl,
     zůstaly by výchozí profily a dřevo by na velkém domě chybělo —
     proto se to nesmí přejít mlčky. */
  var navrh = { profily: {}, druh: {} };
  if (P && P.navrhni) {
    navrh = P.navrhni(geom, vstupy, { druhReziva: v.druhReziva || "pilarske" });
  } else {
    potize.push("Profily se nepodařilo navrhnout podle statiky — ve výkazu jsou "
      + "výchozí rozměry a na větším rozponu nemusí stačit.");
  }
  vstupy.profily = Object.assign({}, (K.VYCHOZI && K.VYCHOZI.profily) || {}, navrh.profily);
  if (Object.keys(navrh.druh || {}).length) {
    vstupy.rezivoPrvku = {};
    Object.keys(navrh.druh).forEach(function (profil) {
      (K.prvkyProfilu ? K.prvkyProfilu(profil) : []).forEach(function (kod) {
        vstupy.rezivoPrvku[kod] = { druh: navrh.druh[profil] };
      });
    });
  }

  var vysledek = K.spocitej(geom, vstupy);
  if (!vysledek || vysledek.chybnaSoustava) {
    throw new Error("PENTI: " + ((vysledek && vysledek.upozorneni && vysledek.upozorneni[0])
      || "krov se nepodařilo spočítat."));
  }
  /* NESMYSLNÝ TVAR VÝKAZ BLOKUJE. Znamená, že se plocha střechy rozchází
     se součtem rovin — typicky špatně určené štíty. Takový výkaz by
     vypadal hotově a byl by o kus dřeva vedle. */
  if (vysledek.nesmyslnyTvar) {
    throw new Error("PENTI: zadaný tvar střechy nedává smysl — plocha se rozchází "
      + "se součtem rovin. Zkontrolujte, které strany jsou štíty.");
  }
  if (!vysledek.prvky || !vysledek.prvky.length) {
    throw new Error("PENTI: výkaz krovu vyšel prázdný — zadání se nedá spočítat.");
  }

  /* ── POLOŽKY ──────────────────────────────────────────────────────────
     Ve stejném tvaru jako výkaz střechy, aby se daly zobrazit vedle sebe:
     { skupina, nazev, mnozstvi, jednotka }. U řeziva je navíc `detail`
     s profilem a délkami — to je u dřeva to hlavní. */
  var polozky = [];
  var R = global.PentiRezivo;
  var druh = v.druhReziva || "pilarske";

  vysledek.prvky.forEach(function (p) {
    if (!(p.ks > 0) && !(p.bm > 0)) return;
    var radek = {
      skupina: "Krov",
      nazev: p.nazev + " " + p.profil,
      mnozstvi: p.beh ? r1(p.bm) : p.ks,
      jednotka: p.beh ? "m" : "ks",
      profil: p.profil,
      m3: r3(p.m3 || 0),
      delkaMin: p.delkaMin, delkaMax: p.delkaMax
    };
    /* Objednací délky — z čeho se to řeže. Prořez je u dřeva peníze,
       takže to zákazník má vidět. Ceny se přitom nikde neberou. */
    if (R && R.rozpisDelek && p.kusy && p.kusy.length) {
      try {
        var rd = R.rozpisDelek(p.kusy, (vstupy.rezivoPrvku && vstupy.rezivoPrvku[p.kod]
                                        && vstupy.rezivoPrvku[p.kod].druh) || druh);
        var zdroj = rd.naMiru || rd.zTyci;
        if (zdroj && zdroj.radky) {
          radek.delky = zdroj.radky.map(function (x) {
            return x.ks + "× " + r1(x.objednatDelka || x.delka) + " m";
          }).join(", ");
          radek.prorezProcent = zdroj.prorezProcent;
        }
        /* Upozornění na příliš dlouhý kus dává smysl jen u SAMOSTATNÝCH
           prvků. Pozednice a vaznice jsou souvislé pásy — 34 m dlouhá
           pozednice se samozřejmě nedodává v jednom kuse a modul ji sám
           dělí na díly. Hlásit to jako problém by bylo plané. */
        if (!p.beh && rd.prilis && rd.prilis.length) {
          potize.push(p.nazev + ": " + rd.prilis.length + " kusů je delších, než se "
            + "v tomhle řezivu dodává — bude potřeba spoj.");
        }
      } catch (e) { /* rozpis je doplněk, výkaz platí i bez něj */ }
    }
    polozky.push(radek);
  });

  /* ── UPOZORNĚNÍ ───────────────────────────────────────────────────────
     Co modul říká, se nesmí ztratit — jsou tam i věci typu „statika
     nevyhoví". */
  (vysledek.upozorneni || []).forEach(function (u) { potize.push(u); });

  var st = vysledek.statika && vysledek.statika.souhrn;
  return {
    polozky: polozky,
    potize: potize,
    skupiny: ["Krov"],
    soustava: soustava,
    soustavaNazev: vysledek.soustavaNazev,
    doporuceni: doporuceni,
    krokvi: vysledek.krokvi,
    roztecKrokviSkutecna: vysledek.roztecKrokviSkutecna,
    vyskaStrechy: r1(vysledek.vyskaStrechy || 0),
    m3: r3(vysledek.m3Cista || 0),
    kusu: vysledek.kusuCelkem,
    bm: r1(vysledek.bmCelkem || 0),
    profily: vstupy.profily,
    /* Posudek je ORIENTAČNÍ — text si nese modul s sebou, aby ho nikdo
       nemohl zapomenout zobrazit. */
    statika: st ? { vyhovuje: st.vyhovuje,
                    maxVyuziti: Math.round((st.maxVyuziti || 0) * 100) / 100,
                    rozhoduje: st.rozhoduje } : null,
    statikaPoznamka: "Orientační posudek pro nabídku, ne náhrada statického "
      + "výpočtu. Ke stavebnímu povolení je potřeba posudek autorizovaného statika."
  };
}

var API = { vykaz: vykaz, soustavyProStrechu: soustavyProStrechu,
            doporucSoustavu: doporucSoustavu };
if (typeof module !== "undefined" && module.exports) module.exports = API;
global.PentiKrovWeb = API;
})(typeof window !== "undefined" ? window : globalThis);
