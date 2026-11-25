/* ==========================================================================
   NÁROŽÍ A ÚŽLABÍ — GEOMETRIE NA JEDNOM MÍSTĚ  (PENTI 1. 10. 2026)
   --------------------------------------------------------------------------
   PENTI: „Úžlabní a nárožní krokve jsou prvky, které mají složitá rohová
   sedla na pozednici a na vaznici a dělají se na nich gradování, aby střešní
   rovina procházela plynule až na střed nároží a úžlabí. Nastuduj, jak se
   konstruují … a aplikuj sedla i gradování na všechna nároží a úžlabí
   včetně výrobních výkresů … i lípance a námětky."

   Rozhodnutí PENTI (1. 10. 2026): námětky/lípance bočním šikmým řezem
   (Backenschmiege) + šrouby; úžlabník VYŽLABENÝ (Auskehlung); při různém
   sklonu rovin se nárožník posune (Gratgrundverschiebung).

   ZDROJE (německá tesařská praxe — rechnerischer Abbund):
     · Greifswalder Zimmerer: Walmdach/Gratsparren/Klauenschifter,
       Kehlsparren, Gratgrundverschiebung;
     · Zimmerer-Treff (A. Winkler): Austragung + rechnerischer Abbund
       Schifter und Gratsparren;
     · zimmerer.de, Anhang 1: Kehl-/Gratsparrengrafik (Herzkerve se měří
       ze dvou Ursenkelů; lotrechtes Obholz; Schmiegenwinkel oben).
   Vzorce jsou ověřené na příkladech z těchto zdrojů (testy/narozi.js).

   POJMY (česky → německy)
     nárožní krokev, nárožník ........ Gratsparren
     úžlabní krokev, úžlabník ........ Kehlsparren
     gradování (hřbet do dvou ploch) .. Abgratung
     vyžlabení (V-drážka nahoře) ...... Auskehlung
     osa nároží/úžlabí (hrana rovin) .. Grat-/Kehllinie
     úhel nároží v půdorysu ........... Grat-/Kehlgrundwinkel
     posun nárožníku v půdorysu ....... Gratgrundverschiebung
     srdcové sedlo (rohové) ........... Herzkerve (Pfetteneck)
     svislice v místě hrany podpory .. Ursenkel
     vzdálenost svislic podél osy ..... Verstichmaß
     svislá výška nad sedlem .......... lotrechtes Obholz
     námětek / lípanec ................ Grat-/Kehlschifter
     boční šikmý řez .................. Backenschmiege

   SOUŘADNICE: půdorys v metrech [x, y], výšky z v metrech (stejný počátek
   jako v krovu). Každá rovina je zadaná jako rovina HORNÍCH HRAN KROKVÍ:
       z(p) = zOkap + tg α · ((p − bod) · dovnitr)
   kde `bod` leží na okapové přímce roviny, `dovnitr` je jednotkový vodorovný
   směr do svahu (kolmo od okapu nahoru).

   Modul je čistý — jen čísla, nesahá na stránku. Neobsahuje ceny.
   ========================================================================== */
(function (global) {
  "use strict";

  var RAD = Math.PI / 180;
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1]]; }
  function add(a, b) { return [a[0] + b[0], a[1] + b[1]]; }
  function mul(a, k) { return [a[0] * k, a[1] * k]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1]; }
  function cross(a, b) { return a[0] * b[1] - a[1] * b[0]; }
  function len(a) { return Math.hypot(a[0], a[1]); }
  function unit(a) { var l = len(a) || 1; return [a[0] / l, a[1] / l]; }
  function perp(a) { return [-a[1], a[0]]; }
  function r1(x) { return Math.round(x * 10) / 10; }
  function r2(x) { return Math.round(x * 100) / 100; }
  function r3(x) { return Math.round(x * 1000) / 1000; }
  function mmR(x) { return Math.round(x * 1000); }
  function deg(x) { return x / RAD; }

  /* průsečík přímek p + t·u a q + s·v → t (na první přímce) */
  function prusecik(p, u, q, v) {
    var k = cross(u, v);
    if (Math.abs(k) < 1e-12) return null;
    return cross(sub(q, p), v) / k;
  }

  /* Výška roviny v bodě. */
  function zRoviny(r, p) {
    return r.zOkap + Math.tan(r.sklonDeg * RAD) * dot(sub(p, r.bod), r.dovnitr);
  }

  /* ══ OSA NÁROŽÍ / ÚŽLABÍ ════════════════════════════════════════════════
     Průsečnice dvou rovin. Směr d je kolmý (v půdorysu) na rozdíl spádů
     g = t0·n0 − t1·n1, orientovaný DO SVAHU (výška roste). Úhel nároží
     v půdorysu k okapu roviny i: φ_i. Sklon nárožníku γ: tg γ = t0·(n0·d).
     Ověřeno: Greifswald (2,40/2,20 m, 30°) → φ = 47,49°, γ = 23,06°;
     Dietrich's „G.Rat" (45°/60°) → φ = 60°/30°, γ = 40,89°.
     ═══════════════════════════════════════════════════════════════════════ */
  function osa(r0, r1v, A) {
    var t0 = Math.tan(r0.sklonDeg * RAD), t1 = Math.tan(r1v.sklonDeg * RAD);
    var g = sub(mul(r0.dovnitr, t0), mul(r1v.dovnitr, t1));
    var d = unit(perp(g));
    if (dot(r0.dovnitr, d) < 0) d = mul(d, -1);
    /* bod osy: z bodu A (roh okapu) kolmo na osu tam, kde se roviny potkají */
    var m = unit(g), dz = zRoviny(r0, A) - zRoviny(r1v, A);
    var gm = dot(g, m) || 1e-9;
    var G0 = sub(A, mul(m, dz / gm));
    var tgGamma = t0 * dot(r0.dovnitr, d);
    return { d: d, g: g, G0: G0, t: [t0, t1], tgGamma: tgGamma,
             gammaDeg: deg(Math.atan(tgGamma)),
             /* úhel osy k okapu roviny i (Grat-/Kehlgrundwinkel) */
             phiDeg: [deg(Math.asin(Math.min(1, Math.abs(dot(r0.dovnitr, d))))),
                      deg(Math.asin(Math.min(1, Math.abs(dot(r1v.dovnitr, d)))))] };
  }

  /* ══ NÁROŽNÍK / ÚŽLABNÍK ════════════════════════════════════════════════
     o = { typ:"narozi"|"uzlabi", roviny:[r0, r1], A:[x,y] dolní konec (roh
           okapu), B:[x,y] horní konec, profil:{b,h} mm, posun:true|false,
           podpory:[{ nazev, kod, hrany:[{bod, smer, z}, {bod, smer, z}] }],
           pata:{ typ:"svisly"|"svisly_zkraceny"|"kolmy_zjemneny", vyskaCelaM } }
       podpora = vnější hrany podpory (pozednice / vaznice) v obou rovinách
       (přímka v půdorysu) a výška horní plochy podpory z.
       pata = tvar zhlaví krokví u okapu (prvek ho u okapu přebírá, viz níž).
     ═══════════════════════════════════════════════════════════════════════ */
  function prvek(o) {
    var R = o.roviny, je_u = (o.typ === "uzlabi");
    var b = ((o.profil && o.profil.b) || 140) / 1000, h = ((o.profil && o.profil.h) || 240) / 1000;
    var O = osa(R[0], R[1], o.A);
    var d = O.d, G0 = O.G0, cosG = Math.cos(Math.atan(O.tgGamma));
    /* Strana roviny i kolmo k ose (do její plochy). U nároží je střecha
       NIŽŠÍ z obou rovin (konvexní), u úžlabí VYŠŠÍ. */
    var gi = [O.g, mul(O.g, -1)];
    var strana = gi.map(function (g) { var s = unit(g); return je_u ? s : mul(s, -1); });
    /* k_i = pokles (u úžlabí stoupání) roviny i na 1 m kolmo od osy */
    var k = [0, 1].map(function (i) {
      return Math.abs(O.t[i] * dot(R[i].dovnitr, strana[i]));
    });
    /* POSUN (Gratgrundverschiebung): aby gradování vyšlo na obou stranách
       stejně vysoké. e > 0 = osa prvku se posune k rovině 0. */
    var e = (o.posun !== false && (k[0] + k[1]) > 0) ? (b / 2) * (k[1] - k[0]) / (k[0] + k[1]) : 0;
    var w = [b / 2 + e, b / 2 - e];                 // od osy nároží k boku prvku
    var aSvisle = [w[0] * k[0], w[1] * k[1]];        // lotrechte Abgratungshöhe
    var aKolmo = aSvisle.map(function (a) { return a * cosG; });   // rechtwinklig
    var hSvisle = h / cosG;
    var osaPrvku = add(G0, mul(strana[0], e));      // osa hranolu (v půdorysu)
    /* staničení podél osy od dolního konce A */
    var s0 = dot(sub(o.A, G0), d), sB = dot(sub(o.B, G0), d);
    var Lp = sB - s0;
    var zGrat = function (s) { return zRoviny(R[0], add(G0, mul(d, s))); };
    /* U úžlabí je vršek hranolu (před vyžlabením) o hloubku vyžlabení
       NAD úžlabní čarou — jinak by roviny nedošly k bokům prvku. */
    var zVrch = function (s) { return zGrat(s) + (je_u ? Math.max(aSvisle[0], aSvisle[1]) : 0); };

    /* ── SEDLA (Herzkerve) ─────────────────────────────────────────── */
    var sedla = (o.podpory || []).map(function (pd) {
      var H0 = pd.hrany[0], H1 = pd.hrany[1];
      var tC = prusecik(H0.bod, unit(H0.smer), H1.bod, unit(H1.smer));
      if (tC == null) return null;
      var C = add(H0.bod, mul(unit(H0.smer), tC));                   // roh hran podpor
      var sC = dot(sub(C, G0), d) - s0;                             // Ursenkel (staničení)
      var bocneC = dot(sub(C, G0), strana[0]) - e;                  // od osy hranolu
      var zS = Math.max(H0.z, H1.z);                                // rozhoduje vyšší podpora
      var obholz = zVrch(sC + s0) - zS;                             // lotrechtes Obholz
      var hloubka = hSvisle - obholz;                               // svislá hloubka sedla
      /* kde hrany podpor protínají boky hranolu → Verstich */
      var boky = [0, 1].map(function (i) {
        var bodBoku = add(osaPrvku, mul(strana[i], b / 2));
        var Hh = pd.hrany[i];
        var tt = prusecik(bodBoku, d, Hh.bod, unit(Hh.smer));
        return tt == null ? null : { s: r3(dot(sub(add(bodBoku, mul(d, tt)), G0), d) - s0), strana: i };
      });
      return {
        nazev: pd.nazev, kod: pd.kod,
        ursenkelM: r3(sC), bocneM: r3(bocneC),
        zSedlaM: r3(zS), rozdilVyskyMm: mmR(Math.abs(H0.z - H1.z)),
        obholzSvisleMm: mmR(obholz), hloubkaSvisleMm: mmR(hloubka),
        /* vodorovná plocha sedla končí, kde spodek hranolu (stoupá pod γ)
           dojde na výšku podpory: délka v půdorysu podél osy */
        delkaSedlaPudMm: mmR(hloubka / O.tgGamma),
        verstichMm: boky.map(function (bk) { return bk ? mmR(bk.s - sC) : null; }),
        bokyStaniceniM: boky.map(function (bk) { return bk ? bk.s : null; }),
        vyuzitiVysky: hloubka / hSvisle,
        /* Hloubka srdcového sedla je daná geometrií (nad sedlem musí zůstat
           stejná svislá výška jako u krokví — lotrechtes Obholz), proto je
           u vyššího nárožníku větší než u krokve. Hlídá se stejná mez jako
           u krokví v krovu: nejvýš polovina výšky prvku. */
        chyby: [].concat(
          hloubka > hSvisle / 2 + 1e-6 ? ["Sedlo " + pd.nazev + " je hlubší než polovina výšky "
            + (je_u ? "úžlabníku" : "nárožníku") + " (" + mmR(hloubka) + " z " + mmR(hSvisle) + " mm svisle) — prvek by se nepřípustně oslabil; zvyšte profil."] : [],
          hloubka < 0.005 ? [(je_u ? "Úžlabník" : "Nárožník") + " nad " + pd.nazev + " nedosedne (sedlo " + mmR(hloubka) + " mm)."] : [],
          Math.abs(H0.z - H1.z) > 0.005 ? ["Podpory " + pd.nazev + " v rohu nejsou stejně vysoko (rozdíl "
            + mmR(Math.abs(H0.z - H1.z)) + " mm) — sedlo se dělá na vyšší, pod nižší se podloží."] : [])
      };
    }).filter(Boolean);

    /* ── OKAPNÍ PATA (PENTI 3. 10. 2026) ─────────────────────────────
       PENTI: „Okapní pata nároží a úžlabí se nezařezává do linie
       navazujícího okapu. V tesařské praxi je to problém — linie
       nenavazuje, vyčnívá a nejde dobře osadit okapnice."
       Dřív končil prvek jedním svislým řezem kolmo na osu, takže rohy
       nárožníku vyčnívaly za čelo obou okapů a boky úžlabníku k čelu
       nedošly. Teď se konec zařízne DVĚMA řezy, každý přesně v linii čela
       svého okapu: polovina prvku na straně roviny i (od čáry nároží
       k boku) se ořízne stejnými rovinami jako zhlaví krokví roviny i —
       u nároží vznikne špička v rohu okapu, u úžlabí zářez do V.
       Pod čelem stejný tvar jako zhlaví krokví (schválená volba 1A):
         svislý ............ svislý řez po celé výšce,
         svislý zkrácený ... svislé čelo zadané výšky, pod ním vodorovný řez
                             ve STEJNÉ výšce jako u krokví (podbití lícuje),
         kolmý zjemněný .... řez kolmo na krokve roviny i (tatáž rovina jako
                             čela jejích krokví) a vodorovné sražení.
       Profil se vrací pro každý bok v (s, z): s = staničení od dolního
       konce A po ose (vodorovně), z = výška jako zDoleM. */
    var pataZadani = o.pata || {};
    var pataTyp = pataZadani.typ || "svisly";
    if (pataTyp !== "svisly" && pataTyp !== "svisly_zkraceny" && pataTyp !== "kolmy_zjemneny") pataTyp = "svisly_zkraceny";
    var vcM = (+pataZadani.vyskaCelaM > 0) ? +pataZadani.vyskaCelaM : 0.12;
    var aMaxS = Math.max(aSvisle[0], aSvisle[1]);
    var zSpod0 = zGrat(s0) + (je_u ? aMaxS : 0) - hSvisle;          // spodní líc v s = 0
    var zSpod = function (s) { return zSpod0 + O.tgGamma * s; };
    var sSpod = function (z) { return (z - zSpod0) / O.tgGamma; };  // kde spodní líc dojde na výšku z
    /* Pata jen tam, kde dolní konec opravdu leží v rohu okapu (na obou
       okapových přímkách). Nároží, které dole končí jinde (např. ve styku
       s úžlabím u valby do L), se nemění. */
    var naOkapu = [0, 1].every(function (i) {
      var r = R[i]; return Math.abs(cross(sub(o.A, r.bod), unit(r.smer))) < 0.02;
    });
    var pataBoky = !naOkapu ? [null, null] : [0, 1].map(function (i) {
      var r = R[i], al = r.sklonDeg * RAD, ca = Math.cos(al), ta = Math.tan(al);
      var bodB = add(G0, mul(strana[i], w[i]));                     // bok prvku na straně roviny i
      var sAbs = prusecik(bodB, d, r.bod, unit(r.smer));
      if (sAbs == null) return null;
      var sb = sAbs - s0;                                          // kde bok potká čelo okapu
      var zTop = zRoviny(r, add(bodB, mul(d, sAbs)));              // horní hrana boku na čele = jako krokve
      var c = dot(d, r.dovnitr);                                   // o kolik se po ose vzdaluje od okapu
      var tvar = pataTyp, zH = null, body = [[sb, zTop]];
      var hBoku = zTop - zSpod(sb);                                // svislá výška boku na čele
      if (tvar === "svisly_zkraceny" && vcM >= hBoku - 0.005) tvar = "svisly";
      if (tvar === "svisly") body.push([sb, zSpod(sb)]);
      else if (tvar === "svisly_zkraceny") { zH = zTop - vcM; body.push([sb, zH], [sSpod(zH), zH]); }
      else {
        /* kolmý řez: rovina čel krokví roviny i — na boku přímka
           z = zTop − (s − sb)·c / tg α, pak vodorovně ke spodnímu líci */
        zH = zTop - vcM * ca;
        var k = (c > 1e-6 && ta > 1e-6) ? c / ta : 1e6;
        var s1 = sb + (zTop - zH) / k, sH = sSpod(zH);
        if (sH <= s1 + 1e-6) {                                    // řez dojde ke spodku dřív, sražení netřeba
          var sX = (zTop + k * sb - zSpod0) / (k + O.tgGamma);
          body.push([sX, zSpod(sX)]); zH = null;
        } else body.push([s1, zH], [sH, zH]);
      }
      var phi = O.phiDeg[i];
      return { strana: i, tvar: tvar, sM: r3(sb), zHoreM: r3(zTop),
               zVodorovnyM: zH == null ? null : r3(zH),
               vodorovnyRezMm: zH == null ? 0 : mmR(body[body.length - 1][0] - body[body.length - 2][0]),
               vyskaCelaMm: mmR(zTop - body[1][1]),
               /* řez v půdorysu: úhel mezi osou prvku a čelem okapu; pila se
                  vychýlí o doplněk do 90° (0° = obyčejný řez kolmo na osu) */
               uhelKOseDeg: r2(phi), vychylkaPilyDeg: r2(90 - phi),
               body: body.map(function (q) { return [r3(q[0]), r3(q[1])]; }),
               konecRezuM: r3(body[body.length - 1][0]),
               _rovina: { bod: r.bod, dovnitr: r.dovnitr, sklonDeg: r.sklonDeg, zHore: zTop } };
    });
    var pataChyby = [];
    pataBoky.forEach(function (pb) {
      if (!pb || pb.zVodorovnyM == null) return;
      sedla.forEach(function (sd) {
        var zacatek = Math.min(sd.ursenkelM, sd.bokyStaniceniM[0] == null ? sd.ursenkelM : sd.bokyStaniceniM[0],
                               sd.bokyStaniceniM[1] == null ? sd.ursenkelM : sd.bokyStaniceniM[1]);
        if (pb.konecRezuM > zacatek - 0.005 && pb.zVodorovnyM > sd.zSedlaM + 0.002)
          pataChyby.push("Vodorovný řez okapní paty " + (je_u ? "úžlabníku" : "nárožníku") + " zasahuje až do sedla na "
            + sd.nazev + " — snižte výšku čela zhlaví nebo zvolte svislý řez.");
      });
    });
    var sbMin = Math.min(0, pataBoky[0] ? pataBoky[0].sM : 0, pataBoky[1] ? pataBoky[1].sM : 0);
    var pata = !naOkapu ? null : {
      typ: pataTyp, vyskaCelaMm: mmR(vcM), boky: pataBoky,
      /* špička (nároží) / dno zářezu (úžlabí) na čáře nároží v rohu okapu */
      nos: { sM: 0, zM: r3(zGrat(s0)) },
      /* úžlabník: boky jdou za roh okapu až k čelu → prvek je delší */
      prodlouzeniPudM: r3(-sbMin), prodlouzeniM: r3(-sbMin / cosG),
      chyby: pataChyby
    };

    /* úhel gradování (Abgratungswinkel): sklon plochy gradování přes
       šířku v kolmém řezu prvku */
    var uhelGrad = [0, 1].map(function (i) { return w[i] > 1e-6 ? deg(Math.atan(aKolmo[i] / w[i])) : 0; });

    return {
      typ: o.typ, nazev: je_u ? "úžlabní krokev" : "nárožní krokev",
      profil: { b: Math.round(b * 1000), h: Math.round(h * 1000) },
      sklonDeg: r2(O.gammaDeg), uhelPudorysDeg: O.phiDeg.map(r2),
      delkaPudorysM: r3(Lp), delkaM: r3(Lp / cosG),
      zDoleM: r3(zGrat(s0)), zNahoreM: r3(zGrat(sB)),
      osa: { G0: G0, d: d, strana: strana, s0: s0, osaPrvku: osaPrvku },
      roviny: R,
      posunMm: mmR(e), bokyOdOsyMm: w.map(mmR),
      /* gradování (nároží) / vyžlabení (úžlabí) po stranách 0 a 1 */
      gradovani: [0, 1].map(function (i) {
        return { svisleMm: r1(aSvisle[i] * 1000), kolmoMm: r1(aKolmo[i] * 1000),
                 uhelDeg: r2(uhelGrad[i]), sirkaMm: mmR(w[i]) };
      }),
      druhGradovani: je_u ? "vyžlabení" : "gradování",
      vyskaSvisleMm: mmR(hSvisle),
      /* příčný řez kolmo k ose (souřadnice t napříč od osy hranolu, z kolmo
         nahoru od spodní hrany) — pro výkres a 3D */
      prurez: (function () {
        var hm = h * 1000, bm = b * 1000, em = e * 1000;
        var aK = aKolmo.map(function (a) { return a * 1000; });
        /* strana 0 je +t */
        if (!je_u) return [[-bm / 2, 0], [bm / 2, 0], [bm / 2, hm - aK[0]], [em, hm], [-bm / 2, hm - aK[1]]].map(function (p) { return [r1(p[0]), r1(p[1])]; });
        return [[-bm / 2, 0], [bm / 2, 0], [bm / 2, hm], [em, hm - Math.max(aK[0], aK[1])], [-bm / 2, hm]].map(function (p) { return [r1(p[0]), r1(p[1])]; });
      })(),
      sedla: sedla,
      pata: pata,
      chyby: [].concat.apply([], sedla.map(function (s) { return s.chyby; })).concat(pataChyby)
    };
  }

  /* ══ NÁMĚTEK / LÍPANEC (Grat-/Kehlschifter) ══════════════════════════════
     Krokev roviny i, která končí na boku nárožníku (námětek, odspodu od
     okapu nahoru) nebo úžlabníku (lípanec, shora od hřebene dolů).
     o = { prvek: výsledek prvek(), rovina: 0|1, bod:[x,y] start osy krokve
           (u námětku na okapové přímce, u lípance u hřebene),
           profil:{b,h} mm (krokev) }
     Vrací délky po ose k boku prvku (v půdorysu i skutečné), nejdelší
     a nejkratší hranu, úhel bočního řezu na horní ploše (od osy krokve,
     „Schmiegenwinkel oben"), a úklon pily.
     Ověřeno: Dietrich's — sklon 60°, Gratgrundwinkel 30° → 40,9°;
     klasické nároží 45°/45° → 35,26°.
     ═══════════════════════════════════════════════════════════════════════ */
  function namet(o) {
    var P = o.prvek, i = o.rovina, je_u = (P.typ === "uzlabi");
    var r = (o.roviny || P.roviny)[i], tA = Math.tan(r.sklonDeg * RAD);
    var bk = ((o.profil && o.profil.b) || 100) / 1000;
    var smer = je_u ? mul(r.dovnitr, -1) : r.dovnitr;      // lípanec jde dolů k úžlabí
    var napric = perp(r.dovnitr);
    /* bok prvku na straně roviny i: osa prvku + b/2 ke straně i */
    var bodBoku = add(P.osa.osaPrvku, mul(P.osa.strana[i], P.profil.b / 2000));
    var mu = function (q) { return prusecik(q, smer, bodBoku, P.osa.d); };
    var muOsa = mu(o.bod);
    if (muOsa == null || !(muOsa > 0)) return null;
    var m1 = mu(add(o.bod, mul(napric, bk / 2))), m2 = mu(add(o.bod, mul(napric, -bk / 2)));
    var cosA = Math.cos(r.sklonDeg * RAD);
    /* úhel mezi osou krokve a osou nároží v půdorysu */
    var psi = Math.acos(Math.min(1, Math.abs(dot(smer, P.osa.d))));
    /* boční řez na HORNÍ ploše, od osy krokve: tg = cos α · tg ψ */
    var uhelHorni = deg(Math.atan(cosA * Math.tan(psi)));
    /* Úklon pily: řez je SVISLÁ rovina podél boku prvku. Normála řezu
       v soustavě krokve (x po ose do svahu, z kolmo k horní ploše). */
    var nCut = perp(P.osa.d);                           // vodorovná normála řezu
    var nx = dot(nCut, unit(smer)), ny = dot(nCut, napric);
    var sinA = Math.sin(r.sklonDeg * RAD);
    /* normála v souřadnicích krokve: x' = nx·cosα, z' = −nx·sinα (y' = ny) */
    var nzLoc = Math.abs(nx * sinA);
    var uklonPily = deg(Math.asin(Math.min(1, nzLoc)));
    return {
      typ: je_u ? "lipanec" : "namet", nazev: je_u ? "lípanec" : "námětek",
      rovina: i,
      delkaOsaPudM: r3(muOsa), delkaOsaM: r3(muOsa / cosA),
      delkaMaxM: r3(Math.max(m1, m2) / cosA), delkaMinM: r3(Math.min(m1, m2) / cosA),
      /* úhly řezu u nároží/úžlabí */
      uhelHorniDeg: r2(uhelHorni),               // Schmiegenwinkel oben (od osy krokve)
      uhelHorniOdPravehoDeg: r2(90 - uhelHorni), // tytéž, měřeno od pravoúhlého řezu
      svislyRezSklonDeg: r2(r.sklonDeg),          // řez je svislý (olovnice) — na boku pod sklonem
      uklonPilyDeg: r2(uklonPily),
      pudorysUhelDeg: r2(deg(psi))
    };
  }

  /* Pomocník: rovina ze dvou okapových bodů a sklonu (pro testy a krov). */
  function rovina(bodOkapu, smerOkapu, dovnitr, sklonDeg, zOkap) {
    return { bod: bodOkapu, smer: unit(smerOkapu), dovnitr: unit(dovnitr), sklonDeg: sklonDeg, zOkap: zOkap || 0 };
  }

  global.PentiNarozi = { prvek: prvek, namet: namet, osa: osa, rovina: rovina, zRoviny: zRoviny };
})(typeof window !== "undefined" ? window : globalThis);
