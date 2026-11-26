/* ==========================================================================
   ŘEZ LAŤOVÁNÍM
   Svislý řez jednou střešní rovinou od okapu k hřebeni. Ukazuje, kam přijde
   okapní lať, kde leží první polní lať, s jakou roztečí jdou ostatní a
   kolik zbývá k hřebeni. Pokrývač podle toho rozměřuje střechu.

   Tři míry, na kterých všechno stojí:
     VLO — odstup první polní latě od okapní latě
     rozteč — vzdálenost mezi polními latěmi (dána modelem tašky a sklonem)
     VLH — odstup poslední latě od hřebene

   Kreslí se z jedné roviny spočítané funkcí `materialBramacClassic`. Je to
   čistá funkce: dostane čísla, vrátí SVG jako text. Nesahá do stránky ani
   do žádných globálních proměnných, takže se dá použít i v tisku.
   ========================================================================== */
(function (global) {
  "use strict";

  /* Barvy stejné jako v ostatních výkresech kalkulačky, aby řezy laťování,
     krovu a hřebene vypadaly jako jedna sada výkresů, ne jako tři. */
  var B = {
    drevo:    "#c4a070",   // krokev
    bedneni:  "#9a8358",   // bednění
    lat:      "#e0b877",   // latě
    latObrys: "#1c241c",
    folie:    "#7fa8d0",   // DHV a kontralať
    kotaVLO:  "#7fbf9a",
    kotaRoz:  "#e0b877",
    kotaVLH:  "#d98c8c",
    kotaSpad: "#9aa39c",
    popis:    "#8a9a8a",
    okno:     "#7fa8d0",
    krytina:  "#9aa39c"    // plech
  };

  function esc(x) { return String(x == null ? "" : x); }

  /* ── ŘEZ JEDNOU ROVINOU ──────────────────────────────────────────────
     p        = rovina z `materialBramacClassic`
     latProfil = profil latě, např. "60/40"
     okna     = otvory podél spádu [{v0, v1}] v metrech od okapu           */
  function rez(p, latProfil, okna) {
    if (!p) return "";
    okna = okna || [];
    var L = p.delka_spad_kryt || p.delka_spad || 0;
    if (!(L > 0.1)) return "";
    var vlo = (p.vlo_mm || 0) / 1000,
        vlh = (p.vlh_mm || 0) / 1000,
        roz = (p.roztec_mm || 0) / 1000;

    /* Vpravo musí zbýt místo na popisky vrstev — po zvětšení písma pro
       tisk se do 56 bodů nevešly a ořezávaly se (nahlášeno PENTI
       15. 8. 2026). */
    var W = 700, H = 200, padL = 52, padR = 118;
    var sx = (W - padL - padR) / L;
    var X = function (v) { return padL + Math.max(0, Math.min(L, v)) * sx; };

    /* Profil latě: naplacato leží širším rozměrem, okapní stojí na kant. */
    var pr = String(latProfil || "60/40").split("/").map(function (n) { return parseInt(n, 10) || 0; });
    var pa = Math.max(pr[0], pr[1]) || 60, pb = Math.min(pr[0], pr[1]) || 40;
    var wLat = Math.max(7, (pa / 1000) * sx), hLat = 6;    // polní lať naplacato
    var wOkap = 7, hOkap = 13;                              // okapní lať na kant
    var yBase = 122;                                        // horní líc kontralatě

    /* Polní latě: poloha = HORNÍ (spádová) hrana latě. */
    var nPoli = Math.max(0, (p.pocet_rad_lati || 2) - 2);
    var pole = [];
    for (var k = 0; k <= nPoli; k++) pole.push(vlo + k * roz);

    var g = '<svg viewBox="0 0 ' + W + ' ' + H + '" '
      + 'style="width:100%;height:auto;background:var(--ink);'
      + 'border:1px solid var(--line);border-radius:8px">';

    function txt(x, y, t, c, an, sz) {
      return '<text x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" text-anchor="' + (an || "middle")
        + '" font-size="' + (sz || 10) + '" fill="' + (c || "#f0e6d0")
        + '" style="paint-order:stroke;stroke:#1c241c;stroke-width:3px;font-weight:600">' + t + '</text>';
    }
    function pas(y, h, barva, popis, kod) {
      var v = '<rect data-prvek="' + (kod || "") + '" x="' + padL + '" y="' + y + '" width="'
        + (W - padL - padR) + '" height="' + h + '" fill="' + barva + '" opacity="0.85"/>';
      if (popis) v += txt(W - padR + 4, y + h, popis, B.popis, "start", 8.5);
      return v;
    }

    /* --- hlavička --- */
    g += txt(padL, 16, "Rovina " + esc(p.cislo) + " — sklon " + Math.round(p.sklon || 0)
      + "° · latě " + esc(latProfil) + " mm"
      + (p.kontralate_profil ? " · kontralať " + esc(p.kontralate_profil) + " mm" : ""),
      "#f0e6d0", "start", 11);

    /* --- skladba pod latěmi --- */
    g += pas(yBase + 18, 16, B.drevo, "krokev", "krokev");
    g += pas(yBase + 8, 10, B.bedneni, "bednění", "bedneni");
    g += '<line data-prvek="dhv" x1="' + padL + '" y1="' + (yBase + 4) + '" x2="' + (W - padR)
      + '" y2="' + (yBase + 4) + '" stroke="' + B.folie + '" stroke-width="1.2" stroke-dasharray="4 2"/>';
    g += txt(W - padR + 4, yBase + 2, "DHV + kontralať", B.folie, "start", 8.5);

    /* --- okapní lať NA KANT, na okapní hraně --- */
    g += '<rect data-prvek="okapni_lat" x="' + X(0).toFixed(1) + '" y="' + (yBase - hOkap)
      + '" width="' + wOkap + '" height="' + hOkap + '" fill="' + B.lat
      + '" stroke="' + B.latObrys + '" stroke-width="0.8" rx="1"/>';
    var hranaOkapni = X(0) + wOkap;

    /* --- polní latě NAPLACATO --- */
    pole.forEach(function (v) {
      var xe = X(v);
      g += '<rect data-prvek="lat" x="' + (xe - wLat).toFixed(1) + '" y="' + (yBase - hLat)
        + '" width="' + wLat.toFixed(1) + '" height="' + hLat
        + '" fill="' + B.lat + '" stroke="' + B.latObrys + '" stroke-width="0.7" rx="1"/>';
    });

    /* ── ČÍSLA ŘAD TAŠEK ──────────────────────────────────────────────
       OKAPNÍ LAŤ ŽÁDNOU ŘADU NENESE. Jen zvedá spodní hranu první řady,
       aby ležela pod stejným úhlem jako ostatní — taška se zavěšuje až
       na DRUHOU lať (PENTI 24. 8. 2026). Čísluje se proto od první POLNÍ
       latě a řad je o jednu míň než latí.

       Když je řad moc, čísluje se každá pátá — jinak by se popisky slily. */
    var krokCisla = (pole.length > 26) ? 5 : 1;
    pole.forEach(function (v, i) {
      var posledni = (i === pole.length - 1);
      if (i !== 0 && !posledni && (i % krokCisla)) return;
      g += txt(X(v) - wLat / 2, yBase - hLat - 4, String(i + 1),
               B.kotaRoz, "middle", 7.5);
    });
    /* Ať je vidět, že ta lať u okapu do počtu řad nepatří. */
    g += txt(X(0) + wOkap / 2, yBase - hOkap - 4, "okap", B.kotaVLO, "middle", 6.5);

    g += txt(padL, H - 7, "okap", B.kotaVLO, "start", 9.5);
    g += txt(W - padR, H - 7, "hřeben", B.kotaVLH, "end", 9.5);

    /* ── KÓTY ────────────────────────────────────────────────────────────
       Vynášecí čáry jdou k HRANĚ latě, ne na osu.

       POPISEK SE ZARÁŽÍ DO PLÁTNA. Kóta se popisuje uprostřed, jenže
       u okapu je první rozteč jen pár bodů široká — dlouhý popisek se
       kolem jejího středu rozlil daleko za levý okraj obrázku a tam se
       oříznul. Přesně to se stalo první rozteči Contitonu (nahlásil PENTI
       25. 8. 2026): číslo 320 zůstalo za okrajem a vytiskla se jen
       závorka s vysvětlením. Text se proto posune tak, aby se vešel.

       PÍSMO 10 BODŮ, ne 9,5. Převod pro papír zvětšuje všechno pod deset
       bodů o čtvrtinu — popisek by na papíře byl širší než na obrazovce
       a mohl by se oříznout znovu, i když na monitoru vypadá dobře.
       Na desítce se nezvětšuje a tiskne se přesně to, co je vidět. */
    var KOTA_PISMO = 10;
    function popisekX(stred, text, sz) {
      /* Počítá se s velikostí, jakou bude mít popisek NA PAPÍŘE: převod
         pro tisk zvětšuje všechno pod deset bodů na nejméně deset. Kdyby
         se měřilo podle obrazovky, vešel by se text do obrázku na monitoru
         a na papíře by přetekl. */
      var szTisk = (sz < 10) ? Math.max(10, sz * 1.25) : sz;
      /* Odhad šířky: písmo je polotučné, průměrný znak zabírá zhruba
         0,58 své výšky. Přesně to spočítat bez prohlížeče nejde, takže
         se odhaduje raději nahoru — popisek pak od kraje o kus odsedne,
         ale nikdy se neořízne. */
      var sirka = String(text).length * szTisk * 0.58;
      return Math.max(6 + sirka / 2, Math.min(W - 6 - sirka / 2, stred));
    }
    function kota(x1, x2, popis, barva, yy) {
      return '<line x1="' + x1.toFixed(1) + '" y1="' + yy + '" x2="' + x2.toFixed(1) + '" y2="' + yy
          + '" stroke="' + barva + '" stroke-width="0.9"/>'
        + '<line x1="' + x1.toFixed(1) + '" y1="' + (yy - 3) + '" x2="' + x1.toFixed(1) + '" y2="'
          + (yBase - hLat) + '" stroke="' + barva + '" stroke-width="0.5" stroke-dasharray="2 2"/>'
        + '<line x1="' + x2.toFixed(1) + '" y1="' + (yy - 3) + '" x2="' + x2.toFixed(1) + '" y2="'
          + (yBase - hLat) + '" stroke="' + barva + '" stroke-width="0.5" stroke-dasharray="2 2"/>'
        + txt(popisekX((x1 + x2) / 2, popis, KOTA_PISMO), yy - 4, popis, barva,
              "middle", KOTA_PISMO);
    }
    /* U modelů s vlastním kótováním okapu (Tondach Contiton) se první
       rozteč měří od SPODNÍ hrany okapní latě k VRCHU druhé latě — přesně
       tak, jak to kótuje technický list. Kdyby se i tady kreslilo od vrchu
       k vrchu, ukazoval by výkres o šířku latě míň, než co se vytyčuje.

       Číslo a vysvětlení jsou dva řádky. Na jednom byl popisek tak dlouhý,
       že se u okapu nevešel — a co se ořízne první, je začátek, tedy to
       nejdůležitější: samotný rozměr. */
    if (p.okap_kota === "spodek1_vrch2") {
      g += kota(X(0), X(vlo), "1. rozteč " + (p.vlo_mm || 0), B.kotaVLO, 66);
      g += txt(popisekX((X(0) + X(vlo)) / 2,
                        "(spodek okapní latě → vrch 2. latě)", 8.5),
               52, "(spodek okapní latě → vrch 2. latě)", B.kotaVLO, "middle", 8.5);
    } else {
      g += kota(hranaOkapni, X(vlo), "VLO " + (p.vlo_mm || 0), B.kotaVLO, 66);
    }
    if (nPoli >= 1) {
      var mi = Math.floor(nPoli / 2);
      g += kota(X(vlo + mi * roz), X(vlo + (mi + 1) * roz),
                "rozteč " + (p.roztec_mm || 0), B.kotaRoz, 84);
    }
    g += kota(X(L - vlh), X(L), "VLH " + (p.vlh_mm || 0), B.kotaVLH, 66);
    /* „Latí" nestačí — pokrývač počítá ŘADY TAŠEK a chce vidět, že jich je
       tolik co latí (okapní lať nese první řadu). Kladečský plán ukazuje
       totéž číslo, takže se ta dvě čtení nesmí lišit. */
    /* Latí je o jednu víc než řad tašek — okapní lať žádnou nenese.
       Kladečský plán ukazuje ŘADY, takže se to musí shodovat s tím
       druhým číslem, ne s počtem latí. */
    var radTasek = (p.pocet_rad_tasek != null)
      ? p.pocet_rad_tasek : Math.max(0, (p.pocet_rad_lati || 1) - 1);
    g += kota(X(0), X(L), "spád " + L.toFixed(2) + " m · " + (p.pocet_rad_lati || 0)
              + " latí (z toho okapní) = " + radTasek + " řad tašek",
              B.kotaSpad, H - 24);

    /* --- střešní okna: otvor podél spádu + montážní lať pod ním --- */
    okna.forEach(function (o) {
      var x0 = X(o.v0), x1 = X(o.v1), a = Math.min(x0, x1), w = Math.abs(x1 - x0);
      g += '<rect data-prvek="okno" x="' + a.toFixed(1) + '" y="' + (yBase - 30).toFixed(1)
        + '" width="' + w.toFixed(1) + '" height="24" fill="' + B.okno
        + '" opacity="0.35" stroke="' + B.okno + '" stroke-width="1.2" rx="2"/>';
      g += txt(a + w / 2, yBase - 33, "okno", B.okno, "middle", 8.5);
      g += '<rect data-prvek="montazni_lat" x="' + (X(o.v0) - 1.8).toFixed(1) + '" y="'
        + (yBase - hLat - 2).toFixed(1) + '" width="3.6" height="' + (hLat + 2)
        + '" fill="' + B.latObrys + '"/>';
    });

    /* Poznámka, když se VLO muselo dorovnat — jinak by to vypadalo, že se
       kalkulačka spletla. */
    if (p.vlo_dorovnano) {
      g += txt(padL, H - 24 - 14, "VLO dorovnáno z " + (p.vlo_pozadovano_mm || 0)
        + " mm, aby rozteč nespadla pod minimum", B.popis, "start", 8.5);
    }
    return g + "</svg>";
  }

  /* Řezy všemi rovinami pod sebou. Roviny se stejným sklonem i spádem mají
     stejné laťování, takže se kreslí jen jednou a napíše se, kolikrát platí
     — u valby by jinak byly čtyři skoro totožné obrázky. */
  function rezyVsech(mat, latProfil, oknaProRovinu) {
    if (!mat || !mat.planes) return [];
    var videne = {}, out = [];
    mat.planes.forEach(function (p) {
      var klic = [Math.round(p.sklon * 10), p.roztec_mm, p.pocet_rad_lati,
                  p.vlo_mm, p.vlh_mm,
                  Math.round((p.delka_spad_kryt || p.delka_spad || 0) * 100)].join("|");
      if (videne[klic] != null) { out[videne[klic]].rovin.push(p.cislo); return; }
      videne[klic] = out.length;
      out.push({ rovina: p, rovin: [p.cislo],
                 svg: rez(p, latProfil, oknaProRovinu ? oknaProRovinu(p) : []) });
    });
    return out;
  }


  /* ══════════════════════════════════════════════════════════════════════
     ŘEZ SKLADBOU — falcovaný plech a Click
     ----------------------------------------------------------------------
     Tyhle krytiny NELEŽÍ NA LATÍCH. Kreslit u nich laťování bylo špatně
     (nahlášeno PENTI 15. 8. 2026) — nemá to co rozměřovat, protože plech
     se kotví do souvislého podkladu, ne na latě po roztečích.

     SKLADBA (převzato ze staré kalkulačky):
       falcovaná  krokve → bednění → DHV → kontralatě → BEDNĚNÍ → plech
       click      krokve → bednění → DHV → kontralatě → laťování z prken → plech

     U falcované je tedy bednění DVAKRÁT: spodní nosné a horní, do kterého
     se plech přichycuje příponkami.

     VÝŠKA KONTRALATĚ je větraná vzduchová mezera podle ČSN 73 1901-2,
     příloha B. U plechu platí vždycky tabulka B.2 (krytina s vysokým
     difuzním odporem), která ji určuje podle SKLONU:
         < 5°  → 100 mm      5–25° → 60 mm      nad 25° → 40 mm
     U tašek bez bednění platí tabulka B.1 podle DÉLKY KROKVE:
         ≤ 10 m → 40 mm      11–15 m → 60 mm
     Počítá to jádro, tady se to jen vykresluje a napíše se, odkud to je.
     ══════════════════════════════════════════════════════════════════════ */
  function rezSkladba(p, o) {
    if (!p) return "";
    o = o || {};
    var jeClick = (o.typ === "click");
    var L = p.delka_spad_kryt || p.delka_spad || 0;
    if (!(L > 0.1)) return "";

    var kontraMm = p.kontralate_mezera_mm || 40;
    var bedneniMm = o.bedneniMm || 24;          // tloušťka prken bednění
    var W = 700, H = 250, padL = 56, padR = 168;
    var sx = (W - padL - padR) / L;
    var X = function (v) { return padL + Math.max(0, Math.min(L, v)) * sx; };

    /* Vrstvy se kreslí v přehnaném měřítku — ve skutečném by kontralať
       40 mm na šestimetrové krokvi byla vlásečnice. Měřítko je zvolené
       tak, aby i nejtenčí vrstva (bednění 24 mm) šla přečíst. */
    var mmDoPx = 0.42;
    var vys = function (mmH) { return Math.max(9, mmH * mmDoPx); };

    var g = '<svg viewBox="0 0 ' + W + ' ' + H + '" '
      + 'style="width:100%;height:auto;background:var(--ink);'
      + 'border:1px solid var(--line);border-radius:8px">';

    function txt(x, y, t, c, an, sz) {
      return '<text x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" text-anchor="'
        + (an || "middle") + '" font-size="' + (sz || 10) + '" fill="' + (c || "#f0e6d0")
        + '" style="paint-order:stroke;stroke:#1c241c;stroke-width:3px;font-weight:600">'
        + t + '</text>';
    }

    /* Vrstvy odspodu nahoru. `y` je spodní hrana právě kreslené vrstvy.
       Popisky se sbírají stranou a rozmístí se až nakonec — u tenkých
       vrstev by jinak splynuly. */
    var y = 196, popisky = [];
    function vrstva(vyskaPx, barva, popis, kod) {
      var yy = y - vyskaPx;
      var v = '<rect data-prvek="' + kod + '" x="' + padL + '" y="' + yy.toFixed(1)
        + '" width="' + (W - padL - padR) + '" height="' + vyskaPx.toFixed(1)
        + '" fill="' + barva + '" opacity="0.9" stroke="' + B.latObrys
        + '" stroke-width="0.6"/>';
      /* Žádná vrstva se tu nekreslí přerušovaně. Řez vede od okapu
         k hřebeni, tedy PODÉL KROKVE — a kontralať leží na krokvi ve
         stejném směru, takže je v tomhle řezu jeden souvislý pruh.
         Dřív se kreslila jako kostky s mezerami, což by platilo jen pro
         řez rovnoběžný s okapem (nahlášeno PENTI 4. 9. 2026). */
      popisky.push({ y: y - vyskaPx / 2, popis: popis });
      y = yy;
      return v;
    }

    /* Rozmístí popisky tak, aby mezi nimi bylo aspoň `krok` bodů, a ke
       každému natáhne odkazovou čáru na jeho skutečnou vrstvu. */
    function vypisPopisky() {
      var krok = 14, out = "";
      var s = popisky.slice().sort(function (a, b) { return a.y - b.y; });
      for (var i = 1; i < s.length; i++)
        if (s[i].y - s[i - 1].y < krok) s[i].y = s[i - 1].y + krok;
      s.forEach(function (pp) {
        out += '<line x1="' + (W - padR + 1) + '" y1="' + pp.y.toFixed(1)
          + '" x2="' + (W - padR + 10) + '" y2="' + pp.y.toFixed(1)
          + '" stroke="' + B.popis + '" stroke-width="0.5" opacity="0.6"/>';
        out += txt(W - padR + 13, pp.y + 3, pp.popis, B.popis, "start", 9);
      });
      return out;
    }

    g += txt(padL, 16, "Rovina " + esc(p.cislo) + " — sklon "
      + Math.round(p.sklon || 0) + "° · "
      + (jeClick ? "Click panel" : "falcovaný plech")
      + " · kontralať " + esc(p.kontralate_profil || "") + " mm",
      "#f0e6d0", "start", 11);
    g += txt(padL, 30, "Plech neleží na latích — kotví se do souvislého podkladu.",
      B.popis, "start", 8.5);

    g += vrstva(vys(140), B.drevo, "krokev", "krokev");
    g += vrstva(vys(bedneniMm), B.bedneni, "bednění " + bedneniMm + " mm", "bedneni");
    /* DHV je fólie — čára, ne vrstva. */
    g += '<line data-prvek="dhv" x1="' + padL + '" y1="' + y.toFixed(1) + '" x2="'
      + (W - padR) + '" y2="' + y.toFixed(1) + '" stroke="' + B.folie
      + '" stroke-width="1.4" stroke-dasharray="4 2"/>';
    popisky.push({ y: y, popis: "DHV fólie" });
    g += vrstva(vys(kontraMm), B.lat,
      "kontralať " + kontraMm + " mm (po spádu, na krokvi)", "kontralat");
    g += vrstva(vys(bedneniMm), B.bedneni,
      (jeClick ? "laťování z prken " : "bednění ") + bedneniMm + " mm",
      jeClick ? "latovani_prkna" : "bedneni_horni");
    g += vrstva(vys(6), B.krytina || "#9aa39c",
      jeClick ? "Click panel" : "falcovaný plech", "krytina");
    g += vypisPopisky();

    /* Kóta výšky větrané mezery — to je jediné číslo, které se tu rozměřuje. */
    var xk = padL - 14;
    var yKontraDole = 196 - vys(140) - vys(bedneniMm);
    var yKontraNahore = yKontraDole - vys(kontraMm);
    g += '<line x1="' + xk + '" y1="' + yKontraDole.toFixed(1) + '" x2="' + xk
      + '" y2="' + yKontraNahore.toFixed(1) + '" stroke="' + B.kotaVLO
      + '" stroke-width="1" data-prvek="kota-mezera"/>'
      + '<line x1="' + (xk - 4) + '" y1="' + yKontraDole.toFixed(1) + '" x2="' + (xk + 4)
      + '" y2="' + yKontraDole.toFixed(1) + '" stroke="' + B.kotaVLO + '" stroke-width="1"/>'
      + '<line x1="' + (xk - 4) + '" y1="' + yKontraNahore.toFixed(1) + '" x2="' + (xk + 4)
      + '" y2="' + yKontraNahore.toFixed(1) + '" stroke="' + B.kotaVLO + '" stroke-width="1"/>'
      + txt(xk - 6, (yKontraDole + yKontraNahore) / 2 + 3, String(kontraMm),
            B.kotaVLO, "end", 9.5);

    /* Spád a odkud je výška mezery. */
    g += txt(padL, H - 22, "okap", B.kotaVLO, "start", 9.5);
    g += txt(W - padR, H - 22, "hřeben", B.kotaVLH, "end", 9.5);
    g += '<line x1="' + X(0) + '" y1="' + (H - 32) + '" x2="' + X(L) + '" y2="' + (H - 32)
      + '" stroke="' + B.kotaSpad + '" stroke-width="0.9"/>'
      + txt((X(0) + X(L)) / 2, H - 36, "spád " + L.toFixed(2) + " m", B.kotaSpad, "middle", 9.5);
    g += txt(padL, H - 7, "větraná mezera " + kontraMm + " mm — "
      + esc(p.kontralate_duvod || "ČSN 73 1901-2, příloha B"), B.popis, "start", 8.5);

    return g + "</svg>";
  }

  /* Řezy skladbou všemi rovinami — stejné slučování jako u laťování. */
  function rezySkladbou(mat, o) {
    if (!mat || !mat.planes) return [];
    var podle = {};
    mat.planes.forEach(function (p) {
      var klic = Math.round((p.sklon || 0) * 10) + "|"
        + Math.round((p.delka_spad_kryt || p.delka_spad || 0) * 100) + "|"
        + (p.kontralate_mezera_mm || 0);
      if (!podle[klic]) podle[klic] = { p: p, rovin: [] };
      podle[klic].rovin.push(p.cislo);
    });
    return Object.keys(podle).map(function (k) {
      return { rovin: podle[k].rovin, svg: rezSkladba(podle[k].p, o) };
    });
  }

  global.PentiRezLatovani = { rez: rez, rezyVsech: rezyVsech,
                              rezSkladba: rezSkladba, rezySkladbou: rezySkladbou };
})(typeof window !== "undefined" ? window : globalThis);
