/* ==========================================================================
   PENTI — KRESBA STŘECHY PRO WEB
   --------------------------------------------------------------------------
   K ČEMU TO JE
   Zákazník na webu zadá pár čísel a hned vidí, JAK jeho střecha vypadá:
   půdorys, jednotlivé roviny s jejich plochou a délky všech hran — okapu,
   hřebene, nároží, úžlabí a štítu. Čísla v tabulce si laik nepředstaví,
   obrázek ano. A když mu tvar nesedí, opraví zadání dřív, než pošle
   poptávku, kterou by pak rozpočtář počítal na špatnou střechu.

   ODKUD SE BEROU ČÍSLA
   Ze stejné geometrie jako všechno ostatní (`PentiEngine.geometrieStrechy`).
   Tenhle modul nic nepočítá — jen kreslí, co dostane. Kresba se proto
   nemůže rozejít s výměrami ani s cenou.

   ŽÁDNÉ CENY
   Modul jde na veřejný web. Nezná sazby a nikdy je znát nebude.

   KDYŽ SE NEDÁ KRESLIT
   Vrací se `null`, ne prázdný obrázek. Prázdné místo na stránce vypadá
   jako „tady nic není"; volající musí umět říct, že se kresba nepovedla.
   ========================================================================== */
(function (global) {
"use strict";

/* Barvy hran. Vychází z palety webu — zlatá je akcent PENTI. */
var BARVY = {
  okap:   "#C4A265",
  hreben: "#F7F5F1",
  narozi: "#A07850",
  uzlabi: "#8FA9C4",
  stit:   "#9AA39C",
  zed:    "#7A7870",
  rovina: "#C4A265"
};
var POPIS = {
  okap: "Okap", hreben: "Hřeben", narozi: "Nároží",
  uzlabi: "Úžlabí", stit: "Štít"
};

function m1(v) { return (Math.round(v * 10) / 10).toFixed(1).replace(".", ",") + " m"; }
function m2(v) { return (Math.round(v * 10) / 10).toFixed(1).replace(".", ",") + " m²"; }

/* ==========================================================================
   KRESBA
   geom  — výstup PentiEngine.geometrieStrechy
   volby — {sirka, vyska, zed:[[x,y]…] obrys zdiva, legenda:true}
   ========================================================================== */
function svg(geom, volby) {
  volby = volby || {};
  if (!geom || !geom.bbox || !geom.eave || !geom.eave.length) return null;
  var b = geom.bbox;
  var sirkaM = b.maxx - b.minx, vyskaM = b.maxy - b.miny;
  if (!(sirkaM > 0) || !(vyskaM > 0)) return null;

  var VW = volby.sirka || 520, VH = volby.vyska || 340, pad = 46;
  var s = Math.min((VW - 2 * pad) / sirkaM, (VH - 2 * pad) / vyskaM);
  var offx = (VW - sirkaM * s) / 2, offy = (VH - vyskaM * s) / 2;
  /* Svislá osa se obrací — v půdorysu roste y nahoru, na obrazovce dolů. */
  function X(x) { return offx + (x - b.minx) * s; }
  function Y(y) { return VH - (offy + (y - b.miny) * s); }

  function cara(x1, y1, x2, y2, barva, tloustka, carkovane) {
    return '<line x1="' + X(x1).toFixed(1) + '" y1="' + Y(y1).toFixed(1)
      + '" x2="' + X(x2).toFixed(1) + '" y2="' + Y(y2).toFixed(1)
      + '" stroke="' + barva + '" stroke-width="' + tloustka + '" stroke-linecap="round"'
      + (carkovane ? ' stroke-dasharray="5 4"' : '') + '/>';
  }
  function text(px, py, t, barva, velikost) {
    return '<text x="' + px.toFixed(1) + '" y="' + py.toFixed(1)
      + '" text-anchor="middle" dominant-baseline="middle" font-size="' + (velikost || 10)
      + '" fill="' + barva + '" style="paint-order:stroke;stroke:#1A1A17;stroke-width:3px;'
      + 'stroke-linejoin:round;font-weight:600">' + t + '</text>';
  }
  /* Popisek hrany se odsadí kolmo, ať neleží na čáře. */
  function popisHrany(x1, y1, x2, y2, t, barva) {
    var ax = X(x1), ay = Y(y1), bx = X(x2), by = Y(y2);
    var dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1;
    return text((ax + bx) / 2 - dy / L * 10, (ay + by) / 2 + dx / L * 10, t, barva, 10);
  }

  var g = '<svg viewBox="0 0 ' + VW + ' ' + VH + '" xmlns="http://www.w3.org/2000/svg" '
        + 'style="width:100%;height:auto;background:#1A1A17;display:block">';
  var popisky = "";

  /* ── PLOCHA STŘECHY ────────────────────────────────────────────────
     Vybarví se JEDNÍM tónem celý obrys, ne každá rovina zvlášť.

     Zkoušel jsem vyplnit jednotlivé roviny podle `planes[i].tvar` a bylo
     to špatně: `tvar` je ROZVINUTÁ rovina ve své vlastní soustavě (každá
     začíná v nule a měří se po spádu), ne půdorys ve světových
     souřadnicích. Všechny čtyři se proto nakreslily přes sebe do rohu
     a vznikl zlatý flek, který s tvarem střechy nesouvisel
     (nahlásil PENTI 28. 8. 2026: „to zlaté stínování je matoucí").

     Půdorysné hranice rovin engine nevrací a dopočítávat si je tady by
     znamenalo hádat. Plocha každé roviny se proto píše jako ČÍSLO na
     jejím těžišti — to engine zná a je to i ten údaj, který zákazníka
     zajímá. */
  g += '<polygon points="' + geom.eave.map(function (t) {
      return X(t[0]).toFixed(1) + "," + Y(t[1]).toFixed(1); }).join(" ")
    + '" fill="' + BARVY.rovina + '" fill-opacity="0.13" stroke="none"/>';

  /* Sklon se píše jen tehdy, když se roviny liší — jinak je to čtyřikrát
     zopakovaný údaj, který zákazník sám zadal o krok dřív. */
  var sklony = (geom.planes || []).map(function (p) { return Math.round((p.sklon || 0) * 10) / 10; });
  var ruzneSklony = sklony.some(function (s) { return s !== sklony[0]; });
  (geom.planes || []).forEach(function (p, i) {
    if (!(p.sikma > 3) || p.cx == null) return;
    popisky += text(X(p.cx), Y(p.cy) - (ruzneSklony ? 7 : 0), m2(p.sikma), "#F7F5F1", 13);
    if (ruzneSklony) popisky += text(X(p.cx), Y(p.cy) + 10, sklony[i] + "°", "#9AA39C", 10);
  });

  /* ── OBRYS ZDIVA ────────────────────────────────────────────────────
     Čárkovaně. Mezera mezi zdí a okapem ukazuje přesah — zákazník tak
     vidí, že střecha je větší než dům. */
  var zed = volby.zed;
  if (zed && zed.length >= 3) {
    g += '<polygon points="' + zed.map(function (t) {
      return X(t[0]).toFixed(1) + "," + Y(t[1]).toFixed(1); }).join(" ")
      + '" fill="none" stroke="' + BARVY.zed + '" stroke-width="1.3" stroke-dasharray="5 4"/>';
  }

  /* ── HRANY ──────────────────────────────────────────────────────────
     Pultová střecha má vlastní popis hran, ostatní tvary okap + segmenty. */
  if (geom.roof === "pultova" && geom.pultEdges) {
    var barvaPult = { okap: BARVY.okap, horni: BARVY.hreben, stit: BARVY.stit };
    geom.pultEdges.forEach(function (e) {
      var barva = barvaPult[e.type] || BARVY.stit;
      g += cara(e.a[0], e.a[1], e.b[0], e.b[1], barva, 4);
      var pudorysne = Math.hypot(e.b[0] - e.a[0], e.b[1] - e.a[1]);
      /* Štít pultové střechy je šikmý — v půdorysu se jeví kratší. */
      var delka = (e.type === "stit") ? pudorysne * (geom.sec || 1) : pudorysne;
      if (delka > 0.3) popisky += popisHrany(e.a[0], e.a[1], e.b[0], e.b[1], m1(delka), barva);
    });
  } else {
    var stity = {};
    (geom.gable || []).forEach(function (i) { stity[i] = true; });
    geom.eave.forEach(function (p, k) {
      var q = geom.eave[(k + 1) % geom.eave.length];
      var jeStit = !!stity[k];
      g += cara(p[0], p[1], q[0], q[1], jeStit ? BARVY.stit : BARVY.okap, 5);
      if (!jeStit) {
        var d = Math.hypot(q[0] - p[0], q[1] - p[1]);
        if (d > 0.3) popisky += popisHrany(p[0], p[1], q[0], q[1], m1(d), BARVY.okap);
      }
    });
    /* Štít se kótuje ve SKUTEČNÉ délce (šikmo), ne v půdorysné. */
    (geom.gableSegs || []).forEach(function (gs) {
      if (gs.delka > 0.3) popisky += popisHrany(gs.a[0], gs.a[1], gs.b[0], gs.b[1],
                                                m1(gs.delka), BARVY.stit);
    });
    (geom.segs || []).forEach(function (sg) {
      var barva = BARVY[sg.type] || BARVY.stit;
      g += cara(sg.A[0], sg.A[1], sg.B[0], sg.B[1], barva, 3);
      var d = (sg.delka != null) ? sg.delka
            : Math.hypot(sg.B[0] - sg.A[0], sg.B[1] - sg.A[1]);
      if (d > 0.3) popisky += popisHrany(sg.A[0], sg.A[1], sg.B[0], sg.B[1], m1(d), barva);
    });
  }

  g += popisky + '</svg>';
  if (volby.legenda === false) return g;
  return g + legenda(geom);
}

/* Legenda — jen k tomu, co je na obrázku vidět. */
function legenda(geom) {
  var typy = ["okap"];
  if (geom.roof === "pultova") { typy.push("hreben", "stit"); }
  else {
    var m = {};
    (geom.segs || []).forEach(function (s) { m[s.type] = true; });
    if (m.hreben) typy.push("hreben");
    if (m.narozi) typy.push("narozi");
    if (m.uzlabi) typy.push("uzlabi");
    if ((geom.gable || []).length) typy.push("stit");
  }
  var h = '<div class="penti-legenda" style="display:flex;flex-wrap:wrap;gap:14px;'
        + 'margin-top:10px;font-size:.78rem;color:#9AA39C">';
  typy.forEach(function (t) {
    h += '<span style="display:inline-flex;align-items:center;gap:6px">'
      + '<span style="width:16px;height:3px;background:' + BARVY[t] + ';display:inline-block"></span>'
      + POPIS[t] + '</span>';
  });
  h += '<span style="display:inline-flex;align-items:center;gap:6px">'
    + '<span style="width:16px;border-top:1.3px dashed ' + BARVY.zed + ';display:inline-block"></span>'
    + 'Obvodová zeď (mezera = přesah)</span></div>';
  return h;
}

/* Shrnutí výměr — stejná čísla, jen v textu. Pro poptávku i pro tabulku. */
function vymery(geom) {
  if (!geom) return null;
  return {
    plochaStrechy: Math.round(geom.roofArea * 10) / 10,
    pudorys:       Math.round(geom.area * 10) / 10,
    okap:          Math.round((geom.okap || 0) * 10) / 10,
    hreben:        Math.round((geom.ridge || 0) * 10) / 10,
    narozi:        Math.round((geom.hip || 0) * 10) / 10,
    uzlabi:        Math.round((geom.valley || 0) * 10) / 10,
    stit:          Math.round((geom.stit || 0) * 10) / 10,
    rovin:         (geom.planes || []).length,
    roviny:        (geom.planes || []).map(function (p) {
      return { cislo: p.cislo, sklon: Math.round((p.sklon || 0) * 10) / 10,
               plocha: Math.round(p.sikma * 10) / 10 };
    })
  };
}

/* ==========================================================================
   SCHÉMA PŮDORYSU — KTEROU STRANU PRÁVĚ ZADÁVÁM
   --------------------------------------------------------------------------
   U L, T, U a lichoběžníku se zadávají čtyři rozměry a z názvu pole („boční
   rameno – šířka") si člověk nevybaví, která strana to je. Vedle polí proto
   běží obrázek půdorysu a strana, jejíž pole má zákazník právě pod rukou,
   se v něm rozsvítí (nahlásil PENTI 28. 8. 2026).

   KDE SE KTERÝ ROZMĚR MĚŘÍ, musí odpovídat tomu, jak z něj jádro staví
   půdorys. Souřadnice níž jsou proto odvozené přímo z `buildPoly` — kdyby
   se schéma kreslilo „podle oka", ukazovalo by jinou stranu, než která se
   opravdu počítá, a to je horší než neukazovat nic.
   ========================================================================== */
function miry(fp, d) {
  var v = function (k) { return parseFloat(d[k]) || 0; };
  if (fp === "obdelnik") {
    var A = v("A"), B = v("B");
    return [{ k: "A", a: [0, 0], b: [A, 0] }, { k: "B", a: [A, 0], b: [A, B] }];
  }
  if (fp === "ctverec") {
    var S = v("A");
    return [{ k: "A", a: [0, 0], b: [S, 0] }];
  }
  if (fp === "L") {
    var L1 = v("L1"), W1 = v("W1"), L2 = v("L2"), W2 = v("W2");
    return [{ k: "L1", a: [0, 0],  b: [L1, 0] },
            { k: "W1", a: [L1, 0], b: [L1, W1] },
            { k: "L2", a: [0, 0],  b: [0, L2] },
            { k: "W2", a: [0, L2], b: [W2, L2] }];
  }
  if (fp === "T") {
    var TA = v("A"), TW = v("TW"), SW = v("SW"), SL = v("SL");
    var c0 = (TA - SW) / 2, c1 = (TA + SW) / 2;
    return [{ k: "A",  a: [0, SL + TW], b: [TA, SL + TW] },
            { k: "TW", a: [TA, SL],     b: [TA, SL + TW] },
            { k: "SW", a: [c0, 0],      b: [c1, 0] },
            { k: "SL", a: [c1, 0],      b: [c1, SL] }];
  }
  if (fp === "U") {
    var UA = v("UA"), UD = v("UD"), WW = v("WW"), WL = v("WL");
    return [{ k: "UA", a: [0, 0],            b: [UA, 0] },
            { k: "UD", a: [0, 0],            b: [0, UD] },
            { k: "WW", a: [UA - WW, UD + WL], b: [UA, UD + WL] },
            { k: "WL", a: [UA, UD],          b: [UA, UD + WL] }];
  }
  if (fp === "lichobeznik") {
    var LA = v("A"), LC = v("C"), LB = v("B");
    return [{ k: "A", a: [0, 0],  b: [LA, 0] },
            { k: "C", a: [0, LB], b: [LC, LB] },
            { k: "B", a: [0, 0],  b: [0, LB] }];
  }
  return [];
}

/* Obrázek půdorysu s okótovanými stranami.
   volby = {sirka, vyska, zvyraznit:"L1"} */
function schema(fp, dims, volby) {
  volby = volby || {};
  if (!global.PentiEngine || !global.PentiEngine.buildPoly) return null;
  var stavba;
  try { stavba = global.PentiEngine.buildPoly(fp, dims || {}); } catch (e) { return null; }
  if (!stavba || !stavba.poly || stavba.poly.length < 3) return null;
  var poly = stavba.poly;

  var minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
  poly.forEach(function (p) {
    minx = Math.min(minx, p[0]); maxx = Math.max(maxx, p[0]);
    miny = Math.min(miny, p[1]); maxy = Math.max(maxy, p[1]);
  });
  var sirkaM = maxx - minx, vyskaM = maxy - miny;
  if (!(sirkaM > 0) || !(vyskaM > 0)) return null;

  var VW = volby.sirka || 300, VH = volby.vyska || 220, pad = 34;
  var s = Math.min((VW - 2 * pad) / sirkaM, (VH - 2 * pad) / vyskaM);
  var offx = (VW - sirkaM * s) / 2, offy = (VH - vyskaM * s) / 2;
  function X(x) { return offx + (x - minx) * s; }
  function Y(y) { return VH - (offy + (y - miny) * s); }

  var g = '<svg viewBox="0 0 ' + VW + ' ' + VH + '" xmlns="http://www.w3.org/2000/svg" '
        + 'style="width:100%;height:auto;background:#1A1A17;display:block">';
  g += '<polygon points="' + poly.map(function (p) {
      return X(p[0]).toFixed(1) + "," + Y(p[1]).toFixed(1); }).join(" ")
    + '" fill="' + BARVY.rovina + '" fill-opacity="0.10" stroke="' + BARVY.zed
    + '" stroke-width="1.4"/>';

  miry(fp, dims || {}).forEach(function (m) {
    var aktivni = (m.k === volby.zvyraznit);
    var barva = aktivni ? BARVY.okap : "#6E6C66";
    var ax = X(m.a[0]), ay = Y(m.a[1]), bx = X(m.b[0]), by = Y(m.b[1]);
    var dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1;
    /* Kóta se odsadí ven z obrysu, ať neleží na stěně. */
    var ox = -dy / L * 13, oy = dx / L * 13;
    g += '<line x1="' + (ax + ox).toFixed(1) + '" y1="' + (ay + oy).toFixed(1)
      + '" x2="' + (bx + ox).toFixed(1) + '" y2="' + (by + oy).toFixed(1)
      + '" stroke="' + barva + '" stroke-width="' + (aktivni ? 2.6 : 1.2) + '"/>';
    [[ax, ay], [bx, by]].forEach(function (p) {
      g += '<line x1="' + p[0].toFixed(1) + '" y1="' + p[1].toFixed(1)
        + '" x2="' + (p[0] + ox).toFixed(1) + '" y2="' + (p[1] + oy).toFixed(1)
        + '" stroke="' + barva + '" stroke-width="0.8" stroke-dasharray="2 2"/>';
    });
    var hodnota = parseFloat((dims || {})[m.k]) || 0;
    g += text((ax + bx) / 2 + ox * 1.9, (ay + by) / 2 + oy * 1.9,
              hodnota ? m1(hodnota) : m.k, aktivni ? "#F7F5F1" : "#9AA39C",
              aktivni ? 12 : 10);
  });
  return g + '</svg>';

  function text(px, py, t, barva, velikost) {
    return '<text x="' + px.toFixed(1) + '" y="' + py.toFixed(1)
      + '" text-anchor="middle" dominant-baseline="middle" font-size="' + velikost
      + '" fill="' + barva + '" style="paint-order:stroke;stroke:#1A1A17;stroke-width:3px;'
      + 'stroke-linejoin:round;font-weight:600">' + t + '</text>';
  }
}

var API = { svg: svg, schema: schema, miry: miry, vymery: vymery, BARVY: BARVY };
if (typeof module !== "undefined" && module.exports) module.exports = API;
global.PentiKresbaWeb = API;
})(typeof window !== "undefined" ? window : globalThis);
