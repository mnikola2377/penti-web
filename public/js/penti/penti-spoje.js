/* ==========================================================================
   TESAŘSKÉ SPOJE — JEDNO MÍSTO S PRAVIDLY
   --------------------------------------------------------------------------
   PENTI 30. 9. 2026: „Sehnal jsem detaily tesařských spojů, které používáme.
   Nastuduj je a využij v naší kalkulačce." (7 stran z knihy o tesařských
   spojích: rohový plát, rovný čep a dlab, páskový čep, šikmý čep, šikmo
   podříznutý šikmý hákový plát, dvojitá a čelní zarážka.)

   PROČ JEDNO MÍSTO
   Do verze .120 si každá část kalkulačky počítala spoj po svém a rozešly se:
     • čep sloupku do vaznice 220 měl 73 mm, dlab ve vaznici jen 40 mm —
       čep by se do dlabu nevešel;
     • plát při nastavení vaznice: výkaz (objednací délka) počítal 2 × šířka,
       výrobní výkres 2,5 × výška, a kreslil rovný plát místo hákového.
   Proto teď rozměry spojů říká JEN tenhle soubor a výkaz, statika, výrobní
   výkresy, DXF, 3D i spojovák si je odsud berou.

   ROZHODNUTÍ PENTI (30. 9. 2026)
     • čep = dlab, pevně podle knihy: sloupek a věšák 60 mm, pásek 50 mm;
     • vaznice (spoj mimo podporu, v nulovém momentu) se nastavuje šikmým
       hákovým plátem 3 × výška; pozednice JEDNODUCHÝM plátem 2 × šířka
       (upřesněno týž den); svorníky vždy kolmo k ploše plátu;
     • roh pozednic = rohový plát (plát = šířka druhé pozednice, na ½ výšky);
       roh vaznic zůstává HÁKOVÝ rohový plát (zadání 21. 8. 2026, drží i tah);
     • věšadlo: čelní zarážka ⅙ výšky trámu; když statika nevyjde,
       dvojitá zarážka.

   Modul je čistý: jen čísla v milimetrech a stupních, nesahá na stránku.
   Smí na veřejný web (neobsahuje ceny).
   ========================================================================== */
(function (global) {
  "use strict";

  /* Zaokrouhlení na celých 5 mm — tesař měří pásmem, ne mikrometrem. */
  function na5(x) { return Math.round(x / 5) * 5; }
  function dolu5(x) { return Math.floor(x / 5) * 5; }

  /* ── ROVNÝ ČEP A DLAB ────────────────────────────────────────────────
     Kniha: čep je PROSTŘEDNÍ TŘETINA šířky čepovaného prvku (po stranách
     zůstanou dvě třetiny jako ramena), délka čepu 6 cm. Dlab ve druhém
     prvku má stejnou šířku a hloubku jako čep — čep = dlab.

     Používá se: sloupek do vaznice (nahoře), věšák do vrcholové vaznice,
     sloupek do středu hákového rohového plátu vaznic. */
  var CEP_DELKA_MM = 60;

  /* PÁSKOVÝ ČEP — kniha: čep třetina šířky pásku, do sloupku jde 5 cm,
     horní i dolní konec čepu je seříznutý šikmo (aby nevyčníval z líce
     a dlab se dal vysekat). PENTI 30. 9.: pásek 50 mm na OBOU koncích
     (do sloupku i do vaznice). */
  var PASKOVY_CEP_MM = 50;

  /* Tloušťka čepu: třetina šířky zaokrouhlená NAHORU na celých 5 mm
     (dláta a frézy jsou po 5 mm; stejně to od začátku kreslil dlab ve
     vaznici), nejméně 30 mm (tenčí čep se při montáži ulomí). Do .120
     měl výkres sloupku čep 47 mm a dlab ve vaznici 50 mm — teď jedno číslo. */
  /* JEDNOTNÁ ŠÍŘKA ČEPŮ A DLABŮ (PENTI 14. 10. 2026: „ve výkresech dlabů by
     měla vždy být uvedena jejich šířka, ideálně stejná pro čepy sloupků
     i pásků", schválena varianta A, výchozí 40 mm). Nastavuje se v Zadání
     → Výrobní detaily; stránka ji sem předá přes `nastavSirkuCepu` před
     každým výpočtem. 0 = postaru (třetina šířky prvku) — tak zůstávají
     zakázky uložené dřív. Pojistka: čep nesmí být širší než 0,4 × šířka
     čepovaného prvku (zaokrouhleno dolů na 5 mm), jinak by ho rozřízl. */
  var SIRKA_JEDNOTNA_MM = 0;
  function nastavSirkuCepu(mm) {
    var x = Math.round(+mm || 0);
    SIRKA_JEDNOTNA_MM = (x >= 20 && x <= 80) ? x : 0;
    return SIRKA_JEDNOTNA_MM;
  }
  function tloustkaCepu(bMm) {
    var b = bMm || 120;
    if (SIRKA_JEDNOTNA_MM) return Math.min(SIRKA_JEDNOTNA_MM, Math.max(20, Math.floor(b * 0.4 / 5) * 5));
    return Math.max(30, Math.ceil(b / 3 / 5) * 5);
  }

  /* HORNÍ ČEP VĚŠÁKU DO VRCHOLOVÉ VAZNICE (PENTI 11. 10. 2026)
     Čep jde napříč vaznicí, takže jeho tloušťka (v rovině vazby) nesmí
     vzít víc než asi třetinu šířky vaznice — jinak dlab vaznici rozřízne.
     Počítá se proto z MENŠÍHO z rozměrů: šířka věšáku v rovině vazby (h)
     a šířka vaznice (b). U věšáku 160/240 pod vaznicí 160 → 55 mm
     (do .141 se brala šířka věšáku 240 → 80 mm, půl vaznice). Jedno místo
     pro výkaz, statiku (dlab ve vaznici), 3D i výrobní výkres. */
  function cepVesaku(hVesakuMm, bVazniceMm) {
    var h = +hVesakuMm || 180, bv = +bVazniceMm || h;
    return cep(Math.min(h, bv), "vesak");
  }
  /* druh: "sloupek" | "vesak" | "pasek"
     bMm = šířka ČEPOVANÉHO prvku (ten, na kterém je čep).
     Vrací i rozměry dlabu, aby je výkres protikusu nemusel dopočítávat. */
  function cep(bMm, druh) {
    var t = tloustkaCepu(bMm);
    var d = druh === "pasek" ? PASKOVY_CEP_MM : CEP_DELKA_MM;
    return {
      druh: druh || "sloupek",
      nazev: druh === "pasek" ? "páskový čep" : "rovný čep",
      tloustkaMm: t, delkaMm: d,
      dlabSirkaMm: t, dlabHloubkaMm: d,
      /* Páskový čep má šikmo seříznuté konce — výkres je kreslí pod 45°. */
      sikmeKonce: druh === "pasek"
    };
  }

  /* ── ŠIKMÝ ČEP ───────────────────────────────────────────────────────
     Kniha: vzpěra zapuštěná šikmo do trámu, čep třetina šířky, hloubka
     třetina výšky trámu. Zatím ho žádná soustava nepoužívá (pásky mají
     páskový čep), je tu, aby byl po ruce pro vzpěry. */
  function sikmyCep(bMm, hTramuMm) {
    return { nazev: "šikmý čep", tloustkaMm: tloustkaCepu(bMm),
             hloubkaMm: na5((hTramuMm || 160) / 3) };
  }

  /* ── ROHOVÝ PLÁT (rohové přeplátování) ───────────────────────────────
     Kniha: oba prvky se v rohu seříznou na polovinu výšky, délka plátu
     = šířka DRUHÉHO prvku. Přenese tlak, tah NEpřenese — proto jen na
     pozednici, která leží celou délkou na zdi a je kotvená. Jistí se
     jednou KOTVOU do věnce skrz oba pláty (PENTI 30. 9. 2026: na
     pozednici svorníky nemusí být, nahradí je kotvy). */
  function rohovyPlat(bMm, hMm, bDruhehoMm) {
    var h = hMm || 160;
    return { nazev: "rohový plát", platMm: bDruhehoMm || bMm || 140,
             hloubkaMm: Math.round(h / 2), svorniky: 0, kotvy: 1 };
  }

  /* ── ŠIKMO PODŘÍZNUTÝ ŠIKMÝ HÁKOVÝ PLÁT (nastavení trámu) ───────────
     Kniha: délka spoje 3 × výška; na obou koncích zůstane 1/5 výšky,
     uprostřed je hák (zub) vysoký 1/5 výšky, spoj se dělí na dvě stejné
     poloviny. Díky háku drží i tah, ne jen tlak — proto ho PENTI chce
     u vaznic pro spoje MIMO PODPORU v nulovém momentu (30. 9. 2026 upřesněno:
     pozednice leží na zdi, ta se nastavuje jednoduchým plátem).

     Geometrie řezu (bokorys, x od začátku spoje, z od spodní hrany):
         (0, h) → (0, 4/5 h)          svislý zářez 1/5 h u horní hrany
                → (1,5 h, 3/5 h)      šikmý řez první polovinou
                → (1,5 h, 2/5 h)      hák 1/5 h
                → (3 h, 1/5 h)        šikmý řez druhou polovinou
                → (3 h, 0)            svislý zářez 1/5 h u spodní hrany
     Levý kus leží pod touto čarou, pravý nad ní. Jistí se dvěma
     svorníky M12 (v každé polovině jeden) — KOLMO K PLOŠE PLÁTU, tedy
     kolmo k šikmému řezu, skrz oba kusy (PENTI 30. 9. 2026: „svorníky
     musí být kolmo k plátu, ne podél plátu, jinak nic nedrží"). */
  function hakovyPlat(hMm) {
    var h = hMm || 160;
    var L = Math.round(3 * h), p = h / 5;
    return {
      nazev: "šikmý hákový plát",
      delkaMm: L, konecMm: Math.round(p), hakMm: Math.round(p),
      svorniky: 2,
      /* Body řezu [x, z] v mm — z nich kreslí výkres i DXF. */
      rez: [[0, h], [0, h - p], [L / 2, h - 2 * p], [L / 2, h - 3 * p],
            [L, p], [L, 0]].map(function (b) { return [Math.round(b[0]), Math.round(b[1])]; }),
      /* Svorníky uprostřed obou šikmých ploch, směr = kolmice k ploše. */
      svornikyPoloha: (function () {
        var d = Math.hypot(L / 2, p), n = [p / d, (L / 2) / d];
        return [{ x: L / 4, z: h - 1.5 * p, smer: n }, { x: 3 * L / 4, z: 1.5 * p, smer: n }];
      })()
    };
  }

  /* ── JEDNODUCHÝ PLÁT (nastavení pozednice) ───────────────────────────
     PENTI 30. 9. 2026: „Pozednice bych spojoval jednoduchým plátem."
     Oba kusy se na konci seříznou na polovinu výšky a položí přes sebe;
     plocha plátu je vodorovná. Délka plátu 2 × šířka pozednice, nejméně
     300 mm (pravidlo z 16. 8. 2026). Svorníky na pozednici NEJSOU (PENTI
     30. 9. 2026: „na pozednici nemusí být svorníky, stačí je nahradit
     v místě plátu kotvami") — plát drží dvě KOTVY do věnce, svisle skrz
     oba kusy (kolmo k ploše plátu), ve čtvrtinách délky plátu. Nahrazují
     běžné kotvy, které by jinak padly do plátu. Tah plát nepřenese;
     pozednice leží celou délkou na zdi a je kotvená. */
  function jednoduchyPlat(bMm, hMm) {
    var b = bMm || 140, h = hMm || 160;
    var L = Math.max(300, Math.round(2 * b));
    return {
      nazev: "jednoduchý plát",
      delkaMm: L, hloubkaMm: Math.round(h / 2), svorniky: 0, kotvy: 2,
      rez: [[0, h], [0, Math.round(h / 2)], [L, Math.round(h / 2)], [L, 0]],
      svornikyPoloha: [],
      /* kotvy do věnce svisle skrz oba kusy, x od začátku plátu [mm] */
      kotvyPoloha: [L / 4, 3 * L / 4]
    };
  }

  /* ── JEDNODUCHÝ PLÁT NAD PODPOROU (vaznice jako prosté nosníky) ──────
     PENTI 1. 10. 2026: vaznice se může počítat jako řada PROSTÝCH nosníků
     a dělit NAD KAŽDOU PODPOROU (sloupek, rám, vazba). Spoj (volba 1a):
     oba kusy se seříznou na ½ výšky a položí přes sebe přímo nad
     podporou, sloupek jde čepem 60 mm do středu plátu (do spodního kusu),
     oba kusy drží JEDEN SVISLÝ SVORNÍK M12 ve čtvrtině plátu — mimo čep.
     Tah ani ohyb spoj nepřenáší; nemusí — u prostého nosníku je moment
     nad podporou nulový.
     Délka plátu = 2 × šířka vaznice, nejméně 300 mm, a vždy aspoň šířka
     sloupku + 2 × 50 mm, aby oba kusy ležely na sloupku celou plochou.
     Pod rámem (ocelová příčel) není čep — plát leží na příčli a kotví se
     k ní (`naRamu`). */
  function platNadPodporou(bMm, hMm, bPodporyMm, naRamu) {
    var b = bMm || 160, h = hMm || 220, bp = bPodporyMm || 140;
    var L = Math.max(300, Math.round(2 * b), Math.round(bp + 100));
    L = Math.ceil(L / 10) * 10;                       // na celé cm
    return {
      nazev: "jednoduchý plát nad podporou",
      delkaMm: L, hloubkaMm: Math.round(h / 2), svorniky: 1, kotvy: 0,
      cep: naRamu ? null : cep(bp, "sloupek"),
      rez: [[0, h], [0, Math.round(h / 2)], [L, Math.round(h / 2)], [L, 0]],
      /* svislý svorník (kolmo k ploše plátu) ve čtvrtině délky, mimo čep */
      svornikyPoloha: [{ x: 3 * L / 4, z: h / 2, smer: [0, 1] }]
    };
  }

  /* ── ROVNÝ PLÁT VAZNICE V NULOVÉM MOMENTU (PENTI 20. 10. 2026) ───────
     „Musí být vaznice v místě nulového momentu spojena vždy plátem
     s ozubem? Nešel by obyčejný plát?" — jde (Gerberův kloub). Oba kusy
     se seříznou na ½ výšky, plocha plátu je VODOROVNÁ, horní kus leží
     na spodním a předá mu posouvající sílu. Délka 2 × výška vaznice,
     nejméně 300 mm. Dva SVISLÉ svorníky M12 ve čtvrtinách plátu (kolmo
     k ploše) — drží kusy u sebe a stahují roh zářezu proti štípání.
     Podélnou sílu na rozdíl od háku přenáší jen svorníky. */
  function rovnyPlatVaznice(bMm, hMm) {
    var b = bMm || 160, h = hMm || 220;
    var L = Math.ceil(Math.max(300, 2 * h) / 10) * 10;
    var h2 = Math.round(h / 2);
    return {
      nazev: "rovný plát", druh: "rovny",
      delkaMm: L, hloubkaMm: h2, hakMm: 0, konecMm: 0, svorniky: 2, kramle: 0,
      rez: [[0, h], [0, h2], [L, h2], [L, 0]],
      svornikyPoloha: [{ x: L / 4, z: h2, smer: [0, 1] }, { x: 3 * L / 4, z: h2, smer: [0, 1] }]
    };
  }

  /* ── TUPÝ SRAZ NA SEDLE NAD SLOUPKEM (PENTI 20. 10. 2026) ────────────
     Spoj nad podporou: oba konce vaznice v PLNÉ výšce na sedle — krátkém
     trámku průřezu sloupku, délka 600 mm (volba PENTI), sloupek jde
     čepem do sedla. Vaznice se neoslabí, každý konec leží na sedle
     ~300 mm. Sraz se sepne dvěma kramlemi (z obou boků), každý konec
     vaznice drží k sedlu jeden svislý svorník M12. Přídavek délky
     vaznice = 0 (kusy končí v ose srazu). Sloupek pod sedlem je kratší
     o výšku sedla. */
  function tupySrazNaSedle(bMm, hMm, bSloupkuMm, hSloupkuMm) {
    var h = hMm || 220, bs = bSloupkuMm || 140, hs = hSloupkuMm || bs;
    return {
      nazev: "tupý sraz na sedle", druh: "sraz",
      delkaMm: 0, hloubkaMm: 0, hakMm: 0, konecMm: 0, svorniky: 2, kramle: 2,
      sedlo: { delkaMm: 600, bMm: bs, hMm: hs },
      rez: [[0, h], [0, 0]],
      /* svislý svorník vaznice–sedlo 150 mm od srazu na každou stranu */
      svornikyPoloha: [{ x: -150, z: 0, smer: [0, 1] }, { x: 150, z: 0, smer: [0, 1] }]
    };
  }

  /* Volba typu spoje vaznice (PENTI 20. 10. 2026). `nadPodporou` = spoj nad
     sloupkem / rámem, jinak v nulovém momentu. Typy:
       nulový moment: "hakovy" (výchozí) | "rovny"
       nad podporou:  "plat" (výchozí)   | "sraz"  (na rámu vždy plát)
     Výchozí = stav před touto volbou. */
  function spojVaznice(nadPodporou, typ, bMm, hMm, bSloupkuMm, naRamu, hSloupkuMm) {
    if (nadPodporou) {
      if (typ === "sraz" && !naRamu) return tupySrazNaSedle(bMm, hMm, bSloupkuMm, hSloupkuMm);
      var p = platNadPodporou(bMm, hMm, bSloupkuMm, naRamu); p.druh = "plat"; p.kramle = 0; return p;
    }
    if (typ === "rovny") return rovnyPlatVaznice(bMm, hMm);
    var hk = hakovyPlat(hMm); hk.druh = "hakovy"; hk.kramle = 0; return hk;
  }

  /* ── ČELNÍ ZARÁŽKA (čelní zapuštění) ─────────────────────────────────
     Kniha: vzpěra se zapustí do trámu do hloubky 1/6 výšky trámu, čelní
     plocha zářezu leží v OSE úhlu mezi vzpěrou a trámem (½ β) — tlak pak
     jde do obou prvků stejně šikmo.

     DVOJITÁ ZARÁŽKA — když jedna nestačí: za čelním zářezem je ještě
     hřbetní. Kniha kreslí oba 1/6 h; pravidlo DIN 1052 / ČSN EN 1995
     chce, aby zadní (hřbetní) byl aspoň o 10 mm hlubší než přední, jinak
     by se vzpěra opřela jen o jeden z nich. Proto:
         hřbetní = 1/6 h,  čelní = 1/6 h − 10 mm (nejméně 15 mm). */
  function celniZarazka(hTramuMm, betaDeg) {
    var h = hTramuMm || 200;
    return { nazev: "čelní zarážka", druh: "celni",
             /* dolů na 5 mm — hloubka nesmí přelézt ⅙ výšky trámu */
             hloubkaMm: Math.max(15, dolu5(h / 6)),
             rezUhelDeg: (betaDeg || 45) / 2 };
  }
  function dvojitaZarazka(hTramuMm, betaDeg) {
    var h = hTramuMm || 200;
    var zadni = Math.max(25, dolu5(h / 6));
    return { nazev: "dvojitá zarážka", druh: "dvojita",
             hloubkaMm: zadni,                       // hřbetní (hlubší)
             celniHloubkaMm: Math.max(15, zadni - 10),
             rezUhelDeg: (betaDeg || 45) / 2 };
  }

  global.PentiSpoje = {
    CEP_DELKA_MM: CEP_DELKA_MM, PASKOVY_CEP_MM: PASKOVY_CEP_MM,
    cep: cep, cepVesaku: cepVesaku, sikmyCep: sikmyCep, rohovyPlat: rohovyPlat,
    nastavSirkuCepu: nastavSirkuCepu, sirkaCepuJednotna: function () { return SIRKA_JEDNOTNA_MM; },
    hakovyPlat: hakovyPlat, jednoduchyPlat: jednoduchyPlat, platNadPodporou: platNadPodporou,
    rovnyPlatVaznice: rovnyPlatVaznice, tupySrazNaSedle: tupySrazNaSedle, spojVaznice: spojVaznice,
    celniZarazka: celniZarazka,
    dvojitaZarazka: dvojitaZarazka
  };
})(typeof window !== "undefined" ? window : globalThis);
