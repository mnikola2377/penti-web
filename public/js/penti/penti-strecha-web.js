/* ==========================================================================
   PENTI — SPOTŘEBA MATERIÁLU NA STŘECHU, PRO VEŘEJNÝ WEB
   --------------------------------------------------------------------------
   K ČEMU TO JE
   Zákazník na webu zadá tvar, krytinu, skladbu a okapy — a hned vidí,
   KOLIK ČEHO bude potřeba. Ne cenu: tu spočítá rozpočtář z projektu.
   „Kolik toho budu potřebovat" je přitom otázka, na kterou jinde odpověď
   nedostane, a je to i podklad, který si může poslat dál.

   ODKUD SE BEROU ČÍSLA
   Ze stejných modulů, které počítají profi rozpočet:
     · `PentiEngine.kladecakTasky`   — tašky, krajovky, hřebenáče
     · `PentiEngine.latovaniPENTI`   — latě a kontralatě
     · `PentiEngine.materialZaklop`  — bednění, když se volí
     · `PentiOkapy.spocitej`         — žlaby, háky, svody, kolena
   Tenhle modul jen skládá jejich výstupy do jednoho čitelného seznamu.
   Nic nepočítá znovu — kdyby ano, rozešlo by se to s nabídkou.

   ŽÁDNÉ CENY
   Modul jde na veřejný web a sazby nezná. Množství ano, cenu ne.

   KDYŽ SE NEDÁ POČÍTAT
   Vyhodí chybu. Prázdný seznam by vypadal jako „nic nepotřebujete".
   ========================================================================== */
(function (global) {
"use strict";

function r1(x) { return Math.round(x * 10) / 10; }

/* Sněhová oblast se dá zadat jako číslo oblasti (I–VIII), nebo jako
   charakteristické zatížení s_k v kPa — clima-maps.info vrací kPa,
   ČSN mluví o oblastech. Zákazník opíše, co viděl, a nepřevádí. */
var SK_OBLASTI = [0.7, 1.0, 1.5, 2.0, 2.5, 3.0, 4.0];
function oblastZeSk(sk) {
  var v = parseFloat(sk);
  if (!isFinite(v) || v <= 0) return null;
  for (var i = 0; i < SK_OBLASTI.length; i++) {
    /* Hranice se berou shovívavě — 1,05 kPa je pořád II. oblast. */
    if (v <= SK_OBLASTI[i] + 0.001) return i + 1;
  }
  return 8;
}
function skOblasti(oblast) {
  var i = Math.round(parseFloat(oblast)) - 1;
  return SK_OBLASTI[i] != null ? SK_OBLASTI[i] : null;
}

/* ==========================================================================
   KDY JE BEDNĚNÍ POVINNÉ
   --------------------------------------------------------------------------
   PENTI 30. 8. 2026: **u vazníků nad vytápěným prostorem se vynutí záklop
   z prken.** Vazník tam nese i strop, takže nad hlavou je obytný prostor
   a plné bednění je konstrukční požadavek, ne preference — proto se
   nenabízí jako volba, ale rovnou se dosadí a napíše proč.

   Pravidlo je tady, ne ve stránce, aby platilo stejně v kalkulačce
   střechy i vazníků. Kdyby si ho každá stránka nesla po svém, jedna by
   ho dřív nebo později přestala držet a nikdo by si toho nevšiml.

   PENTI 7. 9. 2026: důvodů je víc než vazníky. Úžlabí, nároží a nízká
   třída doplňkové hydroizolace znamenají bednění úplně stejně. Seznam
   důvodů proto vede ENGINE (`duvodyProBedneni`), aby ho web a profi
   kalkulačka nemohly mít každý jiný — dřív web znal jen vazníky, takže
   valbová střecha přišla o bednění, které profi verze počítala.

   `nosna`   — vazniky / krov / mam / nevim
   `vyuziti` — nevytapene / uloziste / obytne
   `geom`    — geometrie (kvůli úžlabí a nároží); nepovinná
   ========================================================================== */
function bedneniPovinne(v, geom) {
  v = v || {};
  var lehky = (v.nosna === "vazniky" && v.vyuziti === "obytne");
  /* Engine se bere z `global` až tady — tahle funkce je mimo `spotreba`,
     kde je proměnná `E` lokální. */
  var E = global.PentiEngine;
  var duvody = (E && E.duvodyProBedneni)
    ? E.duvodyProBedneni(geom || {}, { lehkyStrop: lehky, tridaDHV: v.tridaDHV })
    : (lehky ? ["vazníky s lehkým stropem"] : []);
  if (!duvody.length) {
    /* Plech se klade na bednění vždycky, ale to řeší už výpočet plechu
       sám (viz `spotrebaPlech`), tady se to neopakuje. */
    return { povinne: false, typ: null, duvod: "" };
  }
  /* Vazníkový důvod má vlastní větu — je nejméně samozřejmý a zákazník
     u něj nejčastěji ptá proč. */
  var duvod = lehky
    ? "Vazníky nad vytápěným prostorem nesou i strop — střecha musí být "
      + "celoplošně bedněná prkny."
    : "Střecha má " + duvody.join(" a ") + " — pod krytinu patří "
      + "celoplošné bednění z prken.";
  return { povinne: true, typ: "prkna", duvod: duvod, duvody: duvody };
}

/* ==========================================================================
   SPOTŘEBA
   geom — výstup PentiEngine.geometrieStrechy
   v    — { model, snehovaOblast, kladeni, zaklop, nosna, vyuziti, okapy:{...} }
   ========================================================================== */
function spotreba(geom, v) {
  var E = global.PentiEngine;
  if (!E || !E.kladecakTasky) {
    throw new Error("PENTI: chybí penti-engine.js, spotřebu nelze spočítat.");
  }
  if (!geom || !(geom.roofArea > 0)) {
    throw new Error("PENTI: geometrie střechy nevyšla, spotřebu nelze spočítat.");
  }
  v = v || {};
  var oblast = v.snehovaOblast || 2;
  var polozky = [];
  var potize = [];

  function pol(nazev, mnozstvi, jednotka, skupina, podpolozka) {
    if (!(mnozstvi > 0)) return;
    polozky.push({ skupina: skupina, nazev: nazev,
                   mnozstvi: (jednotka === "ks") ? Math.ceil(mnozstvi) : r1(mnozstvi),
                   jednotka: jednotka,
                   /* `podpolozka` = údaj, který se NEOBJEDNÁVÁ; je součástí
                      některé položky nad ním. Stránka ho vykreslí odsazený
                      a světlejší, ať ho nikdo nesečte s ostatními. */
                   podpolozka: !!podpolozka });
  }

  /* ── KRYTINA ──────────────────────────────────────────────────────────
     NEJDŘÍV OVĚŘIT, ŽE MODEL VŮBEC ZNÁME. `kladecakTasky` u neznámého
     modelu tiše spočítá Bramac Classic — výkaz by pak vyšel celý, jen
     pro úplně jinou tašku. Takový omyl nikdo nepozná, dokud nepřijede
     paleta. */
  var plech = v.model && E.MODELY_PLECH && E.MODELY_PLECH[v.model];
  if (v.model && !plech && E.MODELY_TASEK && !E.MODELY_TASEK[v.model]) {
    throw new Error("PENTI: krytina \"" + v.model + "\" není v katalogu. "
      + "Výkaz by vyšel pro jinou tašku.");
  }

  /* ── PLECHOVÁ KRYTINA ────────────────────────────────────────────────
     Počítá se jinak než taška: falcovaná a click se vedou v pásech od
     okapu k hřebeni, Bella Sara je maloformátová taška na latě po
     350 mm. Kdyby se sem pustil taškový výpočet, `modelTasky` by na
     neznámý kód vrátil Bramac Classic a výkaz by vyšel celý — pro úplně
     jinou krytinu. */
  if (plech) {
    return spotrebaPlech(geom, v, plech, polozky, potize, pol, r1);
  }

  var kl = null;
  try {
    kl = E.kladecakTasky(geom, { model: v.model, snehovaOblast: oblast,
                                 kladeni: v.kladeni });
  } catch (e) {
    potize.push("Krytinu se nepodařilo rozvrhnout: " + e.message);
  }
  if (kl && kl.souhrn) {
    var s = kl.souhrn;
    pol(kl.krytina + " — základní tašky", s.tasky_celych, "ks", "Krytina");
    pol("Poloviční tašky",       s.polovicni,   "ks", "Krytina");
    pol("Krajové tašky levé",    s.krajove_L,   "ks", "Krytina");
    pol("Krajové tašky pravé",   s.krajove_P,   "ks", "Krytina");
    /* ŘEZANÉ TAŠKY SE NEOBJEDNÁVAJÍ. Je to počet tašek, které se u nároží
       a úžlabí uříznou — a ty už jsou započítané v základních taškách.
       Do 1. 9. 2026 stály ve výkazu jako samostatná položka a vypadaly
       jako tašky k dokoupení (nahlásil PENTI). Zůstávají jako údaj „z toho",
       protože z nich plyne práce navíc — řezání se platí na běžný metr. */
    pol("z toho řezaných u nároží a úžlabí", s.rezane, "ks", "Krytina", true);
    pol("Závětrná lišta",        s.zavetrna_lista_m, "m", "Krytina");
    pol("Hřebenáče",             s.hrebenace_ks, "ks", "Krytina");
    pol("Spony hřebenáčů",       s.hrebenace_spony, "ks", "Krytina");
    /* KONCOVÉ PRVKY PO DRUZÍCH, NE SOUHRNNĚ. `hrebenace_koncove` je součet
       uzávěrů hřebene a nárožních začátečních — a protože se pod ním
       vypisovaly i obě jeho části, byly tytéž kusy ve výkazu dvakrát pod
       dvěma jmény (u valbové střechy „koncové 4" + „nárožní začáteční 4",
       přitom jsou jen čtyři). Souhrn se proto netiskne. */
    pol("Uzávěry hřebene",       s.uzavery_hrebene, "ks", "Krytina");
    pol("Nárožní začáteční",     s.narozni_zacatecni, "ks", "Krytina");
    /* ROZDĚLOVACÍ PRVKY dosud ve výkazu chyběly úplně, přestože je profi
       kalkulačka objednává (u valbové střechy dva). Druh prvku určuje,
       co se v uzlu potkalo — viz penti-engine.js. */
    pol("Rozdělovací hřebenáče", s.hrebenace_rozdelovaci, "ks", "Krytina");
    pol("Rozdělovací hřebenáč typ T (spojení tří hřebenů)",
        s.rozdelovaci_t,  "ks", "Krytina");
    pol("Rozdělovací hřebenáč typ X (křížení čtyř hřebenů)",
        s.rozdelovaci_x,  "ks", "Krytina");
    pol("Rozdělovací hřebenáč typ XS (napojení čtyř nároží)",
        s.rozdelovaci_xs, "ks", "Krytina");
    pol("Větrací tašky",         s.vetraci_tasky_ks, "ks", "Krytina");
    pol("Podhřebenové tašky",    s.podhrebenova_ks, "ks", "Krytina");
    pol("Větrací pás hřebene",   s.vetraci_pas_hreben && s.vetraci_pas_hreben.bm,
        "m", "Krytina");
    pol("Větrací pás okapu",     s.vetraci_pas_okap_m, "m", "Krytina");
    pol("Větrací mřížky okapu",  s.vetraci_mrizky_ks, "ks", "Krytina");
    pol("Sněhové háky",          s.snehove_haky && s.snehove_haky.ks, "ks", "Krytina");
  }
  /* KDYŽ SE KRYTINA NESPOČÍTALA, NESMÍ TO ZMIZET. Seznam bez tašek vypadá
     jako hotový výkaz, jen o něco kratší — a to je horší než chyba. */
  if (v.model && !polozky.some(function (x) { return x.skupina === "Krytina"; })) {
    potize.push("Krytinu se nepodařilo rozvrhnout — v seznamu chybí tašky, "
      + "krajovky i hřebenáče. Spočítáme je ručně.");
  }

  /* ── LATĚ A KONTRALATĚ ──────────────────────────────────────────────── */
  try {
    var la = E.latovaniPENTI(geom, { model: v.model });
    pol("Latě 60×40",       la.latovani_60x40_ks, "ks", "Laťování");
    pol("Kontralatě",       la.kontralate_ks,     "ks", "Laťování");
    pol("Hřebenová lať",    la.hrebenova_lat_ks,  "ks", "Laťování");
  } catch (e) {
    potize.push("Laťování se nepodařilo spočítat: " + e.message);
  }

  /* ── POJISTNÁ HYDROIZOLACE ──────────────────────────────────────────
     Fólie se počítá z šikmé plochy s přesahy. Role má 75 m². */
  var role = 75;
  pol("Pojistná hydroizolace (role 75 m²)",
      Math.ceil(geom.roofArea * 1.15 / role), "ks", "Skladba");
  pol("Plocha střechy k pokrytí", geom.roofArea, "m²", "Skladba");

  /* ── BEDNĚNÍ, když se volí ──────────────────────────────────────────
     POZOR NA TVAR VÝSTUPU. `materialZaklop` vrací počty rovnou v kořeni
     (`ks_celkem`, `m2_celkem`, `bm_celkem`), NE v podobjektu `souhrn`,
     jak to dělá kladečák. Do 30. 8. 2026 se tu četlo `zk.souhrn` — což
     nikdy neexistovalo, takže se bednění TIŠE NEPŘIDALO a nikde nebylo
     napsané proč. Zákazník zvolil prkna a ve výkazu žádná nebyla.

     Proto se tady kontroluje i to, že něco vyšlo: když se bednění
     vybralo a ve výkazu není, musí to být napsané. */
  /* Povinné bednění se dosadí, i kdyby ho zákazník nezvolil. Vynucovat
     to jen v rozhraní by nestačilo — poptávka může přijít i jinudy
     (třeba z uloženého odkazu) a výkaz by pak byl bez bednění. */
  var pov = bedneniPovinne(v, geom);
  var zaklopTed = (pov.povinne && (!v.zaklop || v.zaklop === "zadne")) ? pov.typ : v.zaklop;
  if (zaklopTed && zaklopTed !== "zadne") {
    var pridano = false;
    try {
      var zk = E.materialZaklop(geom, { typ: zaklopTed });
      if (zk && zk.ks_celkem > 0) {
        pol("Bednění — " + (zaklopTed === "dhf"
              ? "desky DHF " + (zk.deska_rozmer || "")
              : "prkna " + (zk.prkno || "")).trim(),
            zk.ks_celkem, "ks", "Skladba");
        pol("Bednění — plocha", zk.m2_celkem, "m²", "Skladba");
        pridano = true;
      }
    } catch (e) {
      potize.push("Bednění se nepodařilo spočítat: " + e.message);
      pridano = true;                 // důvod je napsaný, nehlásit dvakrát
    }
    if (!pridano) {
      potize.push("Bednění jste vybrali, ale ve výkazu není — spočítáme ho ručně.");
    }
    /* Když se bednění dosadilo samo, musí být napsané PROČ. Položka
       navíc, kterou zákazník nezvolil, jinak vypadá jako omyl. */
    if (pov.povinne && (!v.zaklop || v.zaklop === "zadne")) {
      potize.push(pov.duvod + " Doplnili jsme ho do výkazu.");
    }
  }

  /* ── OKAPY ──────────────────────────────────────────────────────────── */
  if (v.okapy !== false && global.PentiOkapy) {
    try {
      var ok = global.PentiOkapy.spocitej(geom, v.okapyVstupy || {});
      pol("Žlab",              ok.okap_bm,      "m",  "Okapy");
      pol("Háky žlabu",        ok.haky_zlab_ks, "ks", "Okapy");
      pol("Čela žlabu",        ok.cela_zlab_ks, "ks", "Okapy");
      pol("Rohy žlabu",        ok.rohy_zlab_ks, "ks", "Okapy");
      pol("Kouty žlabu",       ok.kouty_zlab_ks,"ks", "Okapy");
      pol("Spojky žlabu",      ok.spojky_zlab_ks, "ks", "Okapy");
      pol("Kotlíky",           ok.kotlik_ks,    "ks", "Okapy");
      pol("Svod",              ok.svod_bm,      "m",  "Okapy");
      pol("Kolena svodu",      ok.koleno72_ks,  "ks", "Okapy");
      pol("Objímky svodu",     ok.objimka_ks,   "ks", "Okapy");
    } catch (e) {
      potize.push("Okapový systém se nepodařilo spočítat: " + e.message);
    }
  }

  /* Prázdný seznam by vypadal jako „nic nepotřebujete". */
  if (!polozky.length) {
    throw new Error("PENTI: spotřeba vyšla prázdná — zadání se nedá spočítat.");
  }

  return {
    polozky: polozky,
    /* Co se nepovedlo, musí být vidět — ne zmizet mezi řádky. */
    potize: potize,
    plochaStrechy: r1(geom.roofArea),
    skupiny: polozky.reduce(function (a, p) {
      if (a.indexOf(p.skupina) < 0) a.push(p.skupina);
      return a;
    }, [])
  };
}

/* ==========================================================================
   SPOTŘEBA U PLECHOVÉ KRYTINY
   --------------------------------------------------------------------------
   Volá se z `spotreba`, dostane už připravený seznam a pomocníky, aby
   výsledek vypadal stejně jako u tašek.

   DVA RŮZNÉ VÝROBKY POD JEDNOU HLAVIČKOU
   · falcovaná a click — svislé pásy od okapu k hřebeni, krycí šířka
     560 resp. 510 mm. Počítá je `PentiEngine.kladecakPlech`.
   · Bella Sara — maloformátová plechová TAŠKA. Klade se na latě
     s pevnou roztečí 350 mm, ne v pásech.

   BEDNĚNÍ SE NEVYNECHÁVÁ
   Plech se klade na celoplošné bednění. Kdyby ho zákazník nezvolil,
   výkaz by vyšel bez největší položky skladby a vypadal by hotově.
   Doplní se proto sám a je to napsané v názvu položky.
   ========================================================================== */
function spotrebaPlech(geom, v, model, polozky, potize, pol, r1) {
  var E = global.PentiEngine;
  var oblast = v.snehovaOblast || 2;
  var plocha = geom.roofArea;

  if (model.vPasech) {
    try {
      var pl = E.kladecakPlech(geom, { system: (v.model === "click") ? "click" : "falcovana" });
      pol(model.nazev + " — pásy (krycí " + pl.kryci_sire_mm + " mm)",
          pl.pocet_pasu_celkem, "ks", "Krytina");
      pol("Plech celkem — délka pásů", pl.bm_celkem, "m", "Krytina");
    } catch (e) {
      potize.push("Pásy plechu se nepodařilo rozvrhnout: " + e.message);
    }
  } else {
    /* Bella Sara — plocha a laťování s pevnou roztečí. */
    pol(model.nazev + " — krytina", plocha, "m²", "Krytina");
    var roztec = (model.roztecLatiMm || 350) / 1000;
    var bmLati = 0;
    (geom.planes || []).forEach(function (p) {
      var rad = Math.ceil((p.delka_spad || 0) / roztec);
      bmLati += rad * (p.sirka_okap || 0);
    });
    pol("Latě — rozteč " + (model.roztecLatiMm || 350) + " mm", bmLati, "m", "Laťování");
  }

  /* Hřebenáče a nároží. Délky hran dává geometrie přímo — `ridge` je
     hřeben, `hip` nároží; obojí se u plechu kryje stejným dílem. */
  var hreben = (geom.ridge || 0) + (geom.hip || 0);
  if (hreben > 0) {
    pol("Hřebenáč (krycí 1145 mm)", hreben / 1.145, "ks", "Krytina");
    pol("Větrací pás hřebene a nároží", hreben, "m", "Krytina");
  }
  if (geom.valley > 0) {
    pol("Úžlabní plech", geom.valley, "m", "Krytina");
  }
  if (geom.stit > 0) {
    pol("Lemování štítu", geom.stit, "m", "Krytina");
  }

  /* ── SKLADBA ────────────────────────────────────────────────────────
     Pod pásy patří pojistná fólie A separační rohož — ta odděluje plech
     od bednění, tlumí hluk deště a odvádí kondenzát.

     Bella Sara je ale TAŠKA, ne pás: klade se na latě a rohož pod ni
     nepatří. Profi rozpočet to rozlišuje stejně. */
  pol("Pojistná hydroizolace (role 75 m²)", Math.ceil(plocha * 1.15 / 75), "ks", "Skladba");
  if (model.vPasech) {
    pol("Separační rohož pod plech", plocha, "m²", "Skladba");
  }
  pol("Plocha střechy k pokrytí", plocha, "m²", "Skladba");

  var typZaklopu = (v.zaklop && v.zaklop !== "zadne") ? v.zaklop : "prkna";
  var samo = !(v.zaklop && v.zaklop !== "zadne");
  /* KOLIK VRSTEV. Do 7. 9. 2026 měl web vždycky jednu, i pod falcovanou
     krytinou — ta se přitom klade na dvojité bednění. Počet vrstev je
     teď vlastnost krytiny (`podklad` v modelech), takže se nemůže
     rozejít s profi verzí ani se starou kalkulačkou. */
  /* POZOR: krytina se sem předává jako `v.model` („falcovana", „click",
     „bella"). Do 7. 9. 2026 tu stálo `v.krytina` — pole, které web vůbec
     neposílá, takže dotaz vracel prázdno a vrstva vyšla vždycky jedna.
     Falcovaná tak měla poloviční bednění a nikdo si toho nevšiml. */
  var vrstev = E.vrstvyBedneni ? E.vrstvyBedneni(v.model) : 1;
  /* BELLA SARA JE TAŠKA, JEN Z PLECHU. Leží na latích, ne na bednění,
     takže sem spadne s nulou vrstev — a bednění dostane za stejných
     podmínek jako keramická taška: když je důvod (nároží, úžlabí,
     vazníky s lehkým stropem), nebo když si ho zákazník sám vybere.
     Do 7. 9. 2026 tu dostávala bednění vždycky, protože se rozhodovalo
     podle „je to plech", ne podle toho, na čem krytina leží. */
  var duvodBedneni = "";
  if (vrstev === 0) {
    var povB = bedneniPovinne(v, geom);
    if (povB.povinne) { vrstev = 1; duvodBedneni = povB.duvod; samo = false; }
    else if (v.zaklop && v.zaklop !== "zadne") { vrstev = 1; samo = false; }
  }
  if (vrstev === 0) {
    /* Bez důvodu a bez volby se bednění nepočítá — a nic se nehlásí,
       protože není co. */
  } else try {
    var zk = E.materialZaklop(geom, { typ: typZaklopu });
    if (zk && zk.ks_celkem > 0) {
      pol("Bednění — " + (typZaklopu === "dhf" ? "desky DHF" : "prkna")
            + (vrstev > 1 ? " (dvojité)" : "")
            + (samo ? " (plech se klade na celoplošné bednění)" : ""),
          zk.ks_celkem * vrstev, "ks", "Skladba");
      pol("Bednění — plocha" + (vrstev > 1 ? " (2 vrstvy)" : ""),
          +(zk.m2_celkem * vrstev).toFixed(1), "m²", "Skladba");
      /* Položka, kterou zákazník nezvolil, musí mít napsané proč —
         jinak vypadá jako omyl v rozpočtu. */
      if (duvodBedneni) potize.push(duvodBedneni + " Doplnili jsme ho do výkazu.");
    } else {
      potize.push("Bednění pod plech se nepodařilo spočítat.");
    }
  } catch (e) {
    potize.push("Bednění pod plech se nepodařilo spočítat: " + e.message);
  }

  /* ── ZACHYTÁVAČE SNĚHU ──────────────────────────────────────────────
     U plechu se nedávají háky jako u tašek, ale tyčový systém. */
  try {
    var s = E.zachytavacSnehu(geom, { oblast: oblast });
    pol("Zachytávač sněhu — tyče", s.tyce, "ks", "Krytina");
    pol("Zachytávač sněhu — držáky", s.drzaky, "ks", "Krytina");
    pol("Zachytávač sněhu — spojky", s.spojky, "ks", "Krytina");
    pol("Zachytávač sněhu — koncovky", s.koncovky, "ks", "Krytina");
  } catch (e) {
    potize.push("Zachytávače sněhu se nepodařilo spočítat: " + e.message);
  }

  /* ── OKAPY ──────────────────────────────────────────────────────────
     Stejné jako u tašek — okapový systém na krytině nezávisí. */
  if (v.okapy !== false && global.PentiOkapy) {
    try {
      var ok = global.PentiOkapy.spocitej(geom, v.okapyVstupy || {});
      pol("Žlab",          ok.okap_bm,        "m",  "Okapy");
      pol("Háky žlabu",    ok.haky_zlab_ks,   "ks", "Okapy");
      pol("Čela žlabu",    ok.cela_zlab_ks,   "ks", "Okapy");
      pol("Rohy žlabu",    ok.rohy_zlab_ks,   "ks", "Okapy");
      pol("Kouty žlabu",   ok.kouty_zlab_ks,  "ks", "Okapy");
      pol("Spojky žlabu",  ok.spojky_zlab_ks, "ks", "Okapy");
      pol("Kotlíky",       ok.kotlik_ks,      "ks", "Okapy");
      pol("Svod",          ok.svod_bm,        "m",  "Okapy");
      pol("Kolena svodu",  ok.koleno72_ks,    "ks", "Okapy");
      pol("Objímky svodu", ok.objimka_ks,     "ks", "Okapy");
    } catch (e) {
      potize.push("Okapový systém se nepodařilo spočítat: " + e.message);
    }
  }

  if (!polozky.length) {
    throw new Error("PENTI: spotřeba vyšla prázdná — zadání se nedá spočítat.");
  }
  return {
    polozky: polozky,
    potize: potize,
    plochaStrechy: r1(plocha),
    skupiny: polozky.reduce(function (a, p) {
      if (a.indexOf(p.skupina) < 0) a.push(p.skupina);
      return a;
    }, [])
  };
}

var API = { spotreba: spotreba, oblastZeSk: oblastZeSk, skOblasti: skOblasti,
            bedneniPovinne: bedneniPovinne, SK_OBLASTI: SK_OBLASTI };
if (typeof module !== "undefined" && module.exports) module.exports = API;
global.PentiStrechaWeb = API;
})(typeof window !== "undefined" ? window : globalThis);
