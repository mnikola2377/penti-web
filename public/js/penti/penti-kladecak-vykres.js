/* ==========================================================================
   ROZVINUTÉ STŘEŠNÍ PLOCHY PRO POKRÝVAČE
   Každá střešní rovina se rozvine do skutečné velikosti a rozkreslí se do
   ní opravdové tašky — celé, půlky, dořezy u nároží a úžlabí, krajovky
   u štítu, větrací tašky a sněhové háky. Pokrývač podle toho ví, kde má
   začít, kam přijde půltaška a kde bude řezat.

   Rozklad na tašky je převzatý ze staré kalkulačky a nechal jsem ho beze
   změny — je odladěný na skutečných zakázkách. Změněné je jen kreslení,
   aby sedělo do zbytku kalkulačky, a přidalo se počítání kusů, aby se dalo
   ověřit, že obrázek ukazuje totéž, co je ve výkazu.

   Je to čistá funkce: dostane rovinu a čísla, vrátí SVG jako text. Nesahá
   do stránky, takže se dá použít i v tisku.
   ========================================================================== */
(function (global) {
  "use strict";

  /* Barvy. Na tmavém podkladu se musí lišit i po vytištění načerno, proto
     mají odlišnou světlost, ne jen odstín. */
  var B = {
    plocha:   "#2a332a",   // rovina pod taškami
    obrys:    "#c4a070",
    cela:     "#d8c9ae",   // celá taška
    pul:      "#e0a85a",   // půltaška
    rez:      "#d98c8c",   // řezaná (nároží, úžlabí, okolo otvorů)
    krajovka: "#8bb673",   // krajová taška u štítu
    spara:    "#5c5445",
    lista:    "#9aa39c",   // závětrná lišta místo krajovek
    vetracka: "#7fa8d0",
    hak:      "#d94f4f",
    okno:     "#7fa8d0",
    lat:      "#c4a070",
    popis:    "#8a9a8a",
    text:     "#f0e6d0"
  };

  var CLIP = 0;            // čítač jedinečných značek pro ořez

  /* ── OD KTERÉHO ŠTÍTU SE ROVINA SKLÁDÁ ──────────────────────────────
     Každá rovina má vlastní vodorovnou osu `u`, která míří tam, kam míří
     její okapová hrana. Hrany obíhají střechu dokola, takže protilehlé
     roviny mají `u` proti sobě — a dořez by na každé půlce střechy vyšel
     u jiného štítu.

     Aby obě poloviny vypadaly stejně, vybere se pevný bod ve SKUTEČNÉM
     světě: skládá se vždycky od toho konce okapu, který má menší
     souřadnici (nejdřív X, při shodě Y). Rovina, jejíž `u` míří opačně,
     se na dobu výpočtu otočí. Volba je libovolná, ale hlavně STEJNÁ pro
     obě roviny — a to je celé, oč jde.

     Když rovina bázi nenese (starší data), nic se neotáčí. */
  /* Délka ve zvolené jednotce (mm / cm / m) s jednotkou. Funkci dodá
     stránka (kotaT); bez ní se píše v metrech jako dřív. Tisk stránka
     přepne na mm. PLAN_koty_3d.md, krok 2c (7. 10. 2026). */
  function delkaTxt(m) {
    var k = global.pentiKotaText;
    return k ? k(m, true) : (+m || 0).toFixed(2) + " m";
  }

  function zrcadlitRovinu(p) {
    var b = p && p.baze;
    if (!b || !b.a || !b.dir) return false;
    var sirka = p.sirka_okap || 0;
    if (!(sirka > 0)) return false;
    var zacatek = b.a;                                   // svět v místě u = 0
    var konec = [b.a[0] + b.dir[0] * sirka,              // svět v místě u = šířka
                 b.a[1] + b.dir[1] * sirka];
    if (Math.abs(konec[0] - zacatek[0]) > 1e-6) return konec[0] < zacatek[0];
    return konec[1] < zacatek[1] - 1e-6;
  }

  /* Rozsah roviny vodorovně ve výšce v — kde v té výšce rovina začíná
     a končí. Potřeba pro kreslení řad tašek u nároží a úžlabí. */
  function rozsahRady(rings, v) {
    var lo = Infinity, hi = -Infinity;
    rings.forEach(function (r) {
      for (var k = 0; k < r.length; k++) {
        var A = r[k], Bb = r[(k + 1) % r.length], a = A[1], b = Bb[1];
        if (((a <= v && b >= v) || (b <= v && a >= v)) && Math.abs(b - a) > 1e-9) {
          var t = (v - a) / (b - a), u = A[0] + t * (Bb[0] - A[0]);
          if (u < lo) lo = u;
          if (u > hi) hi = u;
        }
      }
    });
    return lo <= hi ? [lo, hi] : null;
  }

  /* ── ROZKLAD ROVINY NA SKUTEČNÉ TAŠKY ────────────────────────────────
     Vrací řady od okapu: {j, v0, v1, vm, uL, uR, tiles:[{a,b,typ,...}]}.
     Mřížka je kotvená na levý okraj roviny, takže liché řady jsou u vazby
     posunuté o půl tašky a vazba vychází geometricky správně i kolem
     prostupů. Převzato ze staré kalkulačky beze změny. */
  function radyTasek(rings, ksSir, vlm, vazba, okna, volby) {
    okna = okna || [];
    volby = volby || {};
    /* ── ZRCADLENÍ PROTILEHLÝCH ROVIN ────────────────────────────────
       Každá rovina má vlastní souřadnici `u` podél okapu a ta míří tam,
       kam míří její okapová hrana. U sedlové střechy obíhají hrany dokola,
       takže PROTILEHLÉ roviny mají `u` proti sobě. Mřížka kotvená vlevo
       pak na jedné rovině nechá dořez u východního štítu a na druhé
       u západního — obě poloviny střechy vyjdou zrcadlově, ne stejně
       (nahlášeno PENTI 16. 8. 2026).

       Řešení: rovinu, jejíž `u` míří "pozpátku", si na dobu výpočtu
       otočíme, spočítáme ji úplně stejně jako tu první a na konci hranice
       tašek otočíme zpátky. Kresba ani geometrie se tím nemění, mění se
       jen to, od kterého štítu se skládá. */
    var maxV = 0, uMin = Infinity, uMax = -Infinity;
    rings.forEach(function (r) { r.forEach(function (q) {
      if (q[1] > maxV) maxV = q[1];
      if (q[0] < uMin) uMin = q[0];
      if (q[0] > uMax) uMax = q[0];
    }); });
    if (!isFinite(uMin) || maxV <= 0 || ksSir <= 0 || vlm <= 0) return [];

    var zrc = !!volby.zrcadlit, OSA = uMin + uMax;
    var zrcU = function (u) { return OSA - u; };
    if (zrc) {
      rings = rings.map(function (r) {
        return r.map(function (q) { return [zrcU(q[0]), q[1]]; });
      });
      okna = okna.map(function (o) {
        return Object.assign({}, o, { u0: zrcU(o.u1), u1: zrcU(o.u0) });
      });
    }

    /* ── PRVNÍ PRŮCHOD: kde která řada začíná a končí ──────────────── */
    /* ── KDE ŘADY LEŽÍ ────────────────────────────────────────────────
       Přednost mají SKUTEČNÉ hranice řad z výpočtu (`rady_v`). Rovnoměrné
       dělení spád / rozteč je jen záloha pro starší volající — u krytin
       s vlastním kótováním okapu (Tondach Contiton) totiž první dvě řady
       rovnoměrné nejsou a plán by se rozešel s řezem laťování.
       Nahlásil PENTI 24. 8. 2026: v plánu 22 řad, v řezu 21. */
    var hranice = (Array.isArray(volby.radyV) && volby.radyV.length > 1)
      ? volby.radyV.filter(function (x) { return x <= maxV + 1e-6; })
      : null;
    /* K hřebeni se hranice NEDOPLŇUJE. Poslední lať je pár centimetrů pod
       osou hřebene a ten zbytek je pod hřebenáčem — kdyby se dokreslil,
       vznikl by tenký pruh, který se tváří jako další řada tašek. */

    var radyRozsah = [], nR = hranice ? (hranice.length - 1) : Math.ceil(maxV / vlm), j;
    for (j = 0; j < nR; j++) {
      var rv0 = hranice ? hranice[j] : j * vlm;
      var rv1 = hranice ? Math.min(hranice[j + 1], maxV) : Math.min((j + 1) * vlm, maxV);
      var rvm = (rv0 + rv1) / 2;
      /* Šířka řady = nejširší rozsah v rámci řady (dole, uprostřed, nahoře),
         aby tašky přesáhly přes nárožní a úžlabní diagonálu — ořez je pak
         schová. Jinak by u nároží zůstávaly nepokryté klínky. */
      var rL = Infinity, rR = -Infinity;
      [Math.min(rv0 + 0.01, maxV), rvm, Math.max(rv1 - 0.01, 0)].forEach(function (vv) {
        var sp = rozsahRady(rings, vv);
        if (sp) { if (sp[0] < rL) rL = sp[0]; if (sp[1] > rR) rR = sp[1]; }
      });
      radyRozsah.push({ j: j, v0: rv0, v1: rv1, vm: rvm, uL: rL, uR: rR,
                        platna: isFinite(rL) && (rR - rL >= 1e-3) });
    }

    /* ── KDE KONČÍ ROVINA ŠTÍTEM ───────────────────────────────────────
       U štítu je boční hrana svislá, takže všechny řady začínají (nebo
       končí) na stejné souřadnici. U nároží a úžlabí se hrana sbíhá.
       Stejné pravidlo používá i obarvení krajovek níž v souboru. */
    var platne = radyRozsah.filter(function (r) { return r.platna; });
    var gMin = Infinity, gMax = -Infinity;
    platne.forEach(function (r) {
      if (r.uL < gMin) gMin = r.uL;
      if (r.uR > gMax) gMax = r.uR;
    });
    var stitVlevo  = platne.length > 1 && platne.every(function (r) { return Math.abs(r.uL - gMin) < 0.002; });
    var stitVpravo = platne.length > 1 && platne.every(function (r) { return Math.abs(r.uR - gMax) < 0.002; });

    /* Na střih se u ŠTÍTU půltaška nevkládá — šířku dorovná krajovka.
       Přesně tak to počítá i výkaz (poloviční tašky u štítu = 0), takže
       kresba s ním konečně souhlasí. U nároží a úžlabí se řeže vždycky,
       tam půltaška zůstává. */
    var bezPulekUStitu = !!volby.naStrih;

    /* Krycí šířka krajové tašky. Bez údaje se bere plný modul, tedy
       chování jako před 24. 8. 2026. */
    var krajL = (volby.krajL > 0) ? volby.krajL : ksSir;
    var krajP = (volby.krajP > 0) ? volby.krajP : ksSir;

    /* Má model poloviční tašku? Když ne, nesmí se nikde vložit — ani
       u nároží, ani v posunuté řadě u kladení na vazbu. Chybí-li údaj,
       předpokládá se že ji má (chování jako před 19. 8. 2026). */
    var maPultasku = (volby.maPultasku !== false);

    var out = [];
    for (j = 0; j < nR; j++) {
      var rr = radyRozsah[j];
      if (!rr.platna) continue;
      var v0 = rr.v0, v1 = rr.v1, vm = rr.vm, uL = rr.uL, uR = rr.uR;

      var posunuta = (vazba && (j % 2));
      var bnds = [uL], x;
      if (volby.naStrih) {
        /* ── NA STŘIH: JEDNA MŘÍŽKA PRO CELOU ROVINU ──────────────────
           Svislé spáry musí lícovat přes všechny řady. Do 18. 8. 2026
           začínala každá řada na SVÉM levém okraji — na obdélníkové rovině
           to vyšlo nastejno, ale na VALBĚ se trojúhelník každou řadou
           zužuje, takže se mřížka pokaždé posunula a vypadalo to jako
           vazba, přestože je nastavený střih (nahlásil PENTI na Rubínu 9).

           Mřížka se proto ukotví k levému okraji celé roviny (`gMin`,
           tedy k nejširší řadě u okapu) a každá řada se z ní jen vyřízne.
           První taška v řadě je pak řezaná — a to je správně, u nároží
           se řeže vždycky. */
        /* ── KRAJOVKA MÁ VLASTNÍ KRYCÍ ŠÍŘKU ──────────────────────────
           U štítu nezabírá krajová taška celý modul: u Contitonu levá
           129 a pravá 94 mm proti 230 mm základní. Mřížka proto začíná
           až za levou krajovkou a končí před pravou — jinak by v plánu
           vyšla o tašku na řadu víc než ve výkazu (PENTI 24. 8. 2026).
           Když model vlastní šířky nemá, je krajL = krajP = ksSir
           a chová se to přesně jako dřív. */
        /* ── ZBYTEK SE ROZTÁHNE, NEDĚLÁ SE Z NĚJ PROUŽEK ─────────────
           Šířka střechy se skoro nikdy nedělí krycí šířkou beze zbytku.
           Do 31. 8. 2026 se ten zbytek nechal jako poslední „tašku" na
           konci řady — na zakázce Tištín to byl proužek 15 mm, kresba ho
           obarvila jako pravou krajovku, a protože byl neviditelný,
           vypadalo to, že krajovky jsou jen na jedné straně. Navíc
           kresba ukazovala o 30 tašek víc než výkaz.

           PENTI 31. 8. 2026: 15 mm na 13 m se na střeše vyřeší mírným
           roztažením spár, žádná řada se kvůli tomu nepřidává. Kresba to
           dělá stejně — do pole mezi krajovkami se vejde CELÝ počet tašek
           a rozteč se dorovná. Zbytek se tím rozpustí rovnoměrně, řada
           vyjde souměrně a krajovky jsou vidět na obou stranách.

           (Pozor: posuv posuvné tašky je po DÉLCE, ne po šířce. Šířku
           řídí střední krycí šířka, kterou je u pálené tašky nutné na
           stavbě změřit — jmenovitá hodnota z ceníku je jen orientační.)

           ROZTEČ SE POČÍTÁ Z CELÉ ROVINY, ne z jednotlivé řady. Na valbě
           se řady zužují a kdyby si každá počítala vlastní rozteč,
           svislé spáry by se rozjely. Mřížka proto vznikne jednou pro
           celou rovinu a každá řada se z ní jen vyřízne — stejně jako
           dosud. */
        /* Místo pro krajovku se odečítá JEN KDYŽ SE KRAJOVKY OPRAVDU
           POKLÁDAJÍ. Když se štít řeší závětrnou lištou (Bella Sara),
           žádná krajová taška tam není a pole je celá šířka roviny.
           `krajL`/`krajP` totiž bez údaje z modelu spadnou na plný modul,
           takže by se jinak ukrojily dvě tabule, které se objednávají —
           při zkoušce 31. 8. 2026 to udělalo −7 % proti plánu Budmatu. */
        /* Nová mřížka platí JEN pro krytiny, které mají krajové tašky
           a dají se roztáhnout — tedy pálenou a betonovou. Plechová
           taška (Bella Sara) má krycí šířku z lisu a štít řeší závětrná
           lišta; u ní zůstává mřížka přesně taková, jaká byla, aby se
           nehnul počet tabulí (ověřeno proti plánu Budmatu). */
        var sKrajovkami = (volby.okrajTyp !== "lista")
                       && (volby.krajL > 0) && (volby.krajP > 0)
                       && (volby.roztahovat !== false);
        if (sKrajovkami) {
          var poleL = gMin + (stitVlevo  ? krajL : 0);
          var poleP = gMax - (stitVpravo ? krajP : 0);
          var pole = poleP - poleL;
          var krok = ksSir;
          if (pole > ksSir * 0.5) {
            var nTasek = Math.max(1, Math.round(pole / ksSir));
            krok = pole / nTasek;      /* roztažená (nebo stažená) rozteč */
          }
          /* Hranice levé krajovky. */
          if (stitVlevo && poleL > uL + 1e-6 && poleL < uR - 1e-6) bnds.push(poleL);
          /* Vnitřní spáry. Index nikdy nezačíná nulou — ta by zopakovala
             hranici krajovky a vznikla by taška nulové šířky. */
          var k = Math.max(1, Math.ceil((uL - poleL) / krok + 1e-9));
          var mez = Math.min(poleP, uR);
          for (x = poleL + k * krok; x < mez - 1e-6; x += krok) bnds.push(x);
          /* Hranice pravé krajovky. */
          if (stitVpravo && poleP > uL + 1e-6 && poleP < uR - 1e-6) bnds.push(poleP);
        } else {
          /* PŮVODNÍ MŘÍŽKA — kotvená k levému okraji roviny, krok přesně
             krycí šířka, zbytek zůstane na konci řady. */
          var k0 = Math.ceil((uL - gMin) / ksSir - 1e-9);
          x = gMin + k0 * ksSir;
          if (x <= uL + 1e-6) x += ksSir;
          for (; x < uR - 1e-6; x += ksSir) bnds.push(x);
        }
      } else {
        /* Na kraji je vždycky CELÁ taška. U posunuté řady se půltaška
           vloží až jako druhá od kraje, aby půlka nikdy neležela na hraně
           střechy. */
        x = uL + ksSir;
        if (posunuta && x < uR - 1e-6) { bnds.push(x); x += ksSir / 2; }
        for (; x < uR - 1e-6; x += ksSir) bnds.push(x);
      }
      bnds.push(uR);

      /* Když by se poslední taška uřízla na míň než třetinu, vloží se před
         řez půltaška — drobný křehký dořez na nárožní linii se nedělá.
         Zbytek padá na konec řady, tedy tam, kde mřížka doběhla. */
      var pulUNarozi = -1;
      /* `stitVpravo` je spočítané v TÉŽE soustavě, ve které se teď skládá
         (tedy případně už otočené), takže se znovu nepřeklápí.

         Druhá podmínka: půltaška se smí vložit jen u modelů, které ji mají
         v sortimentu. Rubín 9, ERLUS XXL, Tondach Figaro a další ji nemají
         (dorovnávají se posunem nebo krajovkou) — tam se u nároží prostě
         řeže, jako se řeže tak jako tak. Nahlásil PENTI 19. 8. 2026. */
      var smiPulku = maPultasku && !(bezPulekUStitu && stitVpravo);
      if (smiPulku && bnds.length >= 3
          && (bnds[bnds.length - 1] - bnds[bnds.length - 2]) < ksSir / 3 - 1e-9) {
        var A2 = bnds[bnds.length - 3];
        bnds[bnds.length - 2] = A2 + ksSir / 2;
        pulUNarozi = bnds.length - 3;
      }

      /* Okno řady, kde taška leží celá uvnitř roviny — jen tam smí přijít
         větrací taška nebo hák. */
      var spB = rozsahRady(rings, Math.min(v0 + 0.01, maxV));
      var spT = rozsahRady(rings, Math.max(v1 - 0.01, 0));
      var inLo = Math.max(spB ? spB[0] : uL, spT ? spT[0] : uL);
      var inHi = Math.min(spB ? spB[1] : uR, spT ? spT[1] : uR);

      var tiles = [];
      for (var i = 0; i < bnds.length - 1; i++) {
        var a = bnds[i], b = bnds[i + 1], w = b - a;
        var jePul = maPultasku
                 && ((posunuta && i === 1 && w < 0.7 * ksSir) || (i === pulUNarozi));
        var typ = jePul ? "pul" : "cela";
        var cela = (typ === "cela") && (a >= inLo - 1e-6) && (b <= inHi + 1e-6)
                && (b - a >= 0.85 * ksSir);
        /* Střešní okna: taška celá uvnitř otvoru se nepokládá, taška na
           hraně otvoru se řeže. */
        var vOkne = false, uOkna = false;
        okna.forEach(function (o) {
          var ox = Math.min(b, o.u1) - Math.max(a, o.u0);
          var oy = Math.min(v1, o.v1) - Math.max(v0, o.v0);
          if (ox > 1e-6 && oy > 1e-6) {
            var celeX = a >= o.u0 - 1e-6 && b <= o.u1 + 1e-6;
            var celeY = v0 >= o.v0 - 1e-6 && v1 <= o.v1 + 1e-6;
            if (celeX && celeY) vOkne = true; else uOkna = true;
          }
        });
        if (vOkne || uOkna) cela = false;
        /* KOLIK Z TABULE SE OPRAVDU POLOŽÍ.
           `w` (tedy b − a) je šířka kusu, který na tom místě leží — mřížka
           je už oříznutá obrysem roviny, takže u řezu vyjde menší než celá
           tabule. Celá tabule má vždycky `ksSir`; rozdíl je odřezek.
           Z toho se pak počítá, jestli je odřezek dost velký na použití
           jinde (viz `tabuleSOdrezky`). */
        tiles.push({ a: a, b: b, typ: typ, cela: typ === "cela",
                     uncut: cela, okno: vOkne, cut: uOkna,
                     sirka: w, plna: ksSir });
      }
      out.push({ j: j, v0: v0, v1: v1, vm: vm, uL: uL, uR: uR, tiles: tiles });
    }

    /* Otočenou rovinu vrátíme do jejích vlastních souřadnic: hranice se
       překlopí zpět a pořadí tašek v řadě se obrátí, aby šly zleva doprava
       jako všude jinde. */
    if (zrc) out.forEach(function (r) {
      var nL = zrcU(r.uR), nR2 = zrcU(r.uL);
      r.uL = nL; r.uR = nR2;
      r.tiles = r.tiles.map(function (t) {
        return Object.assign({}, t, { a: zrcU(t.b), b: zrcU(t.a) });
      }).reverse();
    });
    return out;
  }

  /* ── KRESBA TAŠEK, VĚTRAČEK A HÁKŮ ──────────────────────────────────
     Vrací { svg, pocty } — počty se hodí na kontrolu, že obrázek ukazuje
     totéž, co je ve výkazu. */
  /* ══════════════════════════════════════════════════════════════════════
     KOLIK TABULÍ SE OPRAVDU OBJEDNÁ (odřezky se používají)
     ----------------------------------------------------------------------
     Platí JEN pro maloformátovou plechovou krytinu (Bella Sara). U pálené
     a betonové tašky se odřezek u úžlabí zahodí — ustřižená taška se na
     druhou stranu použít nedá — takže tam se dál počítá každá naříznutá
     taška jako celá. Kdyby se pravidlo pustilo na všechno, hnula by se
     cena u každé střechy s taškami.

     PROČ TO VZNIKLO (1. 9. 2026)
     Kladečský plán Budmat 1498 na RD Bohuslavice počítá 189 tabulí,
     kalkulačka jich počítala 208 — o 10 % víc. Na rovině bez řezů dávaly
     obě shodně 70 ks, takže mřížka byla správná; celý rozdíl dělaly řezané
     tabule, které kalkulačka počítala jako celé. Budmat u nich počítá
     ZLOMKY, protože odřezek se použije na protilehlou stranu úžlabí.

     JAK SE TO POČÍTÁ
     Každý řez potřebuje kus tabule o šířce `pouzito`. Zbytek (`sirka
     − pouzito`) je odřezek. Když je odřezek aspoň `MIN_ODREZEK`, uloží se
     do zásoby a další řez, který se do něj vejde, ho spotřebuje místo nové
     tabule. Zásoba se vede pro celou střechu, ne pro jednu rovinu —
     pokrývač si odřezek přenese, kam potřebuje.

     MIN_ODREZEK = 0,30 m podle PENTI: kratší kus se už nepoužije. */
  var MIN_ODREZEK = 0.30;

  function tabuleSOdrezky(vsechnyRady) {
    var cele = 0, zRezu = 0, zOdrezku = 0;
    var zasoba = [];                     // šířky použitelných odřezků

    (vsechnyRady || []).forEach(function (cells) {
      (cells || []).forEach(function (row) {
        (row.tiles || []).forEach(function (t) {
          if (t.okno) return;            // díra po okně — nic se nepokládá
          if (t.uncut) { cele++; return; }
          var treba = t.sirka || 0;      // šířka kusu, který tu leží
          var plna  = t.plna || treba;   // celá tabule z lisu
          if (treba <= 0) return;
          /* Nejdřív nejtěsnější odřezek, ať se velké kusy šetří na velké
             řezy. Kdyby se bral první vyhovující, spotřeboval by se velký
             odřezek na malý řez a další velký řez by musel z nové tabule. */
          var nej = -1;
          for (var i = 0; i < zasoba.length; i++) {
            if (zasoba[i] + 1e-6 >= treba &&
                (nej < 0 || zasoba[i] < zasoba[nej])) nej = i;
          }
          if (nej >= 0) {
            var zbytek = zasoba[nej] - treba;
            zasoba.splice(nej, 1);
            if (zbytek >= MIN_ODREZEK) zasoba.push(zbytek);
            zOdrezku++;
            return;
          }
          /* Odřezek se nenašel — bere se nová tabule a její zbytek jde
             do zásoby. Kus, který má plnou šířku a přesto se řeže (šikmý
             řez úžlabím přes celou tabuli), žádný použitelný odřezek
             nedává — zbytek je klín. */
          zRezu++;
          var novyZbytek = plna - treba;
          if (novyZbytek >= MIN_ODREZEK) zasoba.push(novyZbytek);
        });
      });
    });
    return { cele: cele, zRezu: zRezu, zOdrezku: zOdrezku,
             tabule: cele + zRezu, odrezkuVZasobe: zasoba.length };
  }

  function kresliTasky(cells, tx, ty, o) {
    o = o || {};
    var schema = o.schema, vetrackyKs = o.vetracky || 0;
    var rHak = o.rHak || 2, tah = o.tah || 0.4;
    var okna = o.okna || [], okrajTyp = o.okrajTyp || "krajovky";
    var g = "", nR = cells.length;
    var pocty = { cela: 0, pul: 0, rez: 0, krajovka: 0, vetracka: 0, hak: 0, okno: 0 };

    /* Krajovka patří jen tam, kde rovina končí ŠTÍTEM. Poznává se podle
       tvaru: u štítu je boční hrana roviny svislá, takže všechny řady
       začínají (nebo končí) na stejné souřadnici. U nároží se hrana sbíhá
       a každá řada je jinde — tam krajovka není, tam se řeže.
       Bez tohohle by valba dostala krajovky, přestože žádný štít nemá. */
    var uMin = Infinity, uMax = -Infinity;
    cells.forEach(function (row) {
      if (row.uL < uMin) uMin = row.uL;
      if (row.uR > uMax) uMax = row.uR;
    });
    var stitVlevo  = cells.length > 1 && cells.every(function (r) { return Math.abs(r.uL - uMin) < 0.002; });
    var stitVpravo = cells.length > 1 && cells.every(function (r) { return Math.abs(r.uR - uMax) < 0.002; });
    var jeKrajovka = function (row, ti) {
      var t = row.tiles[ti];
      if (okrajTyp === "lista" || t.cut || t.okno || !t.cela) return false;
      if (ti === 0) return stitVlevo;
      if (ti === row.tiles.length - 1) return stitVpravo;
      return false;
    };

    cells.forEach(function (row) {
      row.tiles.forEach(function (t, ti) {
        if (t.okno) { pocty.okno++; return; }        // díra po okně — taška se nepokládá
        var kraj = jeKrajovka(row, ti);
        /* Řezaná je každá taška, která se nepokládá celá — ať už ji ukrojí
           nároží, úžlabí, otvor, nebo se jen nevešla na konec řady.
           Pokrývač potřebuje vidět, kde bude řezat, ne jen kde je otvor. */
        var kod = kraj ? "krajovka"
                : (t.typ === "pul" ? "pul"
                : (t.uncut ? "cela" : "rez"));
        var fill = { krajovka: B.krajovka, pul: B.pul, cela: B.cela, rez: B.rez }[kod];
        pocty[kod]++;
        g += '<rect data-prvek="' + kod + '" x="' + tx(t.a).toFixed(1)
          + '" y="' + ty(row.v1).toFixed(1)
          + '" width="' + (tx(t.b) - tx(t.a)).toFixed(1)
          + '" height="' + (ty(row.v0) - ty(row.v1)).toFixed(1)
          + '" fill="' + fill + '" stroke="' + B.spara + '" stroke-width="' + tah + '"/>';
      });
    });

    /* Závětrná lišta místo krajovek — silná čára po vnější hraně ŠTÍTU.
       Platí pro ni totéž co pro krajovky: patří jen tam, kde rovina končí
       štítem. U nároží se hrana sbíhá, lišta tam nemá co dělat a kreslila
       se jako šikmé schodiště po celém nároží — na valbě 36 kusů, přestože
       ta střecha žádný štít nemá (nahlásil PENTI 17. 8. 2026). */
    if (okrajTyp === "lista") {
      cells.forEach(function (row) {
        var n = row.tiles.length; if (!n) return;
        var yA = ty(row.v0), yB = ty(row.v1);
        [[row.tiles[0], "a", stitVlevo], [row.tiles[n - 1], "b", stitVpravo]]
          .forEach(function (par) {
          var t = par[0];
          if (!par[2]) return;                        // tahle strana není štít
          if (!t || !t.cela || t.cut) return;
          var x = tx(t[par[1]]).toFixed(1);
          g += '<line data-prvek="zavetrna_lista" x1="' + x + '" y1="' + yA.toFixed(1)
            + '" x2="' + x + '" y2="' + yB.toFixed(1)
            + '" stroke="' + B.lista + '" stroke-width="' + (tah * 4).toFixed(1) + '"/>';
        });
      });
    }

    /* ── VĚTRACÍ TAŠKY ──────────────────────────────────────────────────
       Patří vždycky do DRUHÉ ŘADY pod hřeben, nebo VEDLE nároží či úžlabí
       (pravidlo PENTI 14. 8. 2026). Rozdělí se mezi obě místa podle toho,
       kolik je kde prostoru, a v každém se rozprostřou rovnoměrně.

       Dřív se nejdřív zaplnila celá druhá řada pod hřebenem a teprve zbytek
       šel k nároží. U valby je ta řada krátká, takže se větračky slily do
       jednoho bloku uprostřed a podél nároží nezbylo nic. */
    if (vetrackyKs > 0 && nR >= 2) {
      var rV = (rHak * 1.3).toFixed(1);
      var polozVetracku = function (row, t) {
        if (!t || t.hasVent) return false;
        t.hasVent = true; pocty.vetracka++;
        g += '<circle data-prvek="vetraci_taska" cx="' + tx((t.a + t.b) / 2).toFixed(1)
          + '" cy="' + ty(row.vm).toFixed(1) + '" r="' + rV + '" fill="' + B.vetracka + '"/>';
        return true;
      };
      /* Rovnoměrný výběr n položek ze seznamu — ne shluk na začátku. */
      var rovnomerne = function (seznam, n) {
        var vybrane = [], L = seznam.length;
        if (n <= 0 || !L) return vybrane;
        if (n >= L) return seznam.slice();
        /* Souměrně od obou konců (24. 9. 2026): první polovina se spočítá,
           druhá se zrcadlí — jinak by vyšlo pod hřebenem na jedné straně
           o větračku víc (zaokrouhlení vždy dolů). */
        var idx = [];
        for (var i = 0; i < Math.ceil(n / 2); i++) {
          var x = Math.min(L - 1, Math.floor((i + 0.5) * L / n));
          idx[i] = x; idx[n - 1 - i] = L - 1 - x;
        }
        if (n % 2) idx[(n - 1) / 2] = Math.floor((L - 1) / 2);
        idx.forEach(function (k) { vybrane.push(seznam[k]); });
        return vybrane;
      };

      /* ── HŘEBEN SE HLEDÁ GEOMETRICKY (PENTI 24. 9. 2026, varianta B) ──
         Do 24. 9. 2026 se za „řadu pod hřebenem" brala vždy jen druhá
         řada od NEJVYŠŠÍHO bodu roviny. Na L valbě 282_25 (rovina 6) je
         nahoře špička valby a hřeben (11 m) leží uprostřed tvaru — pod
         ním nevznikla ani jedna větračka a všech 23 ks spadlo k nároží.
         Teď je hřeben každá VODOROVNÁ HORNÍ hrana tvaru roviny, kterou
         nezakrývá jiný kus téže roviny (tvar je rozdělený na lichoběžníky,
         jejich vnitřní vodorovné švy se odečtou). Větračka jde do druhé
         řady pod ním, jen na celé tašky, které pod ním celé leží. */
      var hrebeny = [];                       // [{v, a, b}]
      (o.rings || []).forEach(function (r) {
        for (var k = 0; k < r.length; k++) {
          var A = r[k], Bq = r[(k + 1) % r.length];
          if (Math.abs(A[1] - Bq[1]) > 0.02 || A[1] < 0.05) continue;
          var v = (A[1] + Bq[1]) / 2;
          /* horní hrana = zbytek tvaru leží POD ní */
          var pod = r.every(function (q) { return q[1] <= v + 0.02; });
          if (!pod) continue;
          hrebeny.push({ v: v, a: Math.min(A[0], Bq[0]), b: Math.max(A[0], Bq[0]) });
        }
      });
      /* odečíst části zakryté spodní hranou jiného kusu (vnitřní šev) */
      var spodky = [];
      (o.rings || []).forEach(function (r) {
        for (var k = 0; k < r.length; k++) {
          var A = r[k], Bq = r[(k + 1) % r.length];
          if (Math.abs(A[1] - Bq[1]) > 0.02) continue;
          var v = (A[1] + Bq[1]) / 2;
          if (r.every(function (q) { return q[1] >= v - 0.02; }))
            spodky.push({ v: v, a: Math.min(A[0], Bq[0]), b: Math.max(A[0], Bq[0]) });
        }
      });
      var volne = [];
      hrebeny.forEach(function (h) {
        var kusy = [[h.a, h.b]];
        spodky.forEach(function (sp) {
          if (Math.abs(sp.v - h.v) > 0.03) return;
          var nove = [];
          kusy.forEach(function (ku) {
            if (sp.b <= ku[0] || sp.a >= ku[1]) { nove.push(ku); return; }
            if (sp.a > ku[0]) nove.push([ku[0], sp.a]);
            if (sp.b < ku[1]) nove.push([sp.b, ku[1]]);
          });
          kusy = nove;
        });
        kusy.forEach(function (ku) { if (ku[1] - ku[0] > 0.3) volne.push({ v: h.v, a: ku[0], b: ku[1] }); });
      });
      /* Bez tvaru (starší volání) se chová jako dřív: hřeben = vršek roviny. */
      if (!o.rings) volne = [{ v: Infinity, a: -Infinity, b: Infinity }];

      var podHrebenem = [], radyUHrebene = {};
      volne.forEach(function (h) {
        /* řada, která se hřebene dotýká = nejvyšší řada, co začíná pod ním */
        var kr = -1;
        for (var ri = nR - 1; ri >= 0; ri--) { if (cells[ri].v0 < h.v - 0.02) { kr = ri; break; } }
        var rv = kr - 1; if (rv < 0) return;
        radyUHrebene[kr] = true; radyUHrebene[rv] = true;
        cells[rv].tiles.forEach(function (t) {
          if (t.uncut && t.a >= h.a - 0.02 && t.b <= h.b + 0.02) podHrebenem.push({ row: cells[rv], t: t });
        });
      });
      podHrebenem.sort(function (x, y) { return x.t.a - y.t.a; });

      /* ── PEVNÝ VZOR Z ENGINU (2026.11.251) ─────────────────────────────
         Rovina se štítem na obou stranách: každá N-tá taška ve 2. řadě pod
         hřebenem, souměrně od středu. Krok i počet dává engine (`vetracky_krok`,
         výkaz) — kresba je jen položí. Krajovky se nepočítají. */
      if (o.vetrackyKrok > 0 && stitVlevo && stitVpravo && podHrebenem.length) {
        var bezKraj = podHrebenem.filter(function (m) {
          var ti = m.row.tiles.indexOf(m.t);
          return !jeKrajovka(m.row, ti);
        });
        var Lv = bezKraj.length, kv = o.vetrackyKrok;
        var nv = Math.min(vetrackyKs, Math.floor((Lv - 1) / kv) + 1);
        var start = Math.max(0, Math.floor((Lv - (kv * (nv - 1) + 1)) / 2));
        var zbyvaV = vetrackyKs;
        for (var iv = 0; iv < nv; iv++) {
          var mv = bezKraj[start + iv * kv];
          if (mv && polozVetracku(mv.row, mv.t)) zbyvaV--;
        }
        pocty.vetrackyKrok = kv; pocty.vetrackyPrvni = start + 1; pocty.vetrackyL = Lv;
        vetrackyKs = zbyvaV;     // kdyby se něco nevešlo, dořeší to pojistka níž
        podHrebenem = [];
      }

      /* Místa u nároží a úžlabí — první a poslední celá taška v řadě, ale
         jen na té straně, kde se hrana sbíhá. U štítu nároží není.
         Každá strana má vlastní seznam, aby se obě obsadily souměrně. */
      var narVlevo = [], narVpravo = [];
      for (var ri = nR - 3; ri >= 1; ri--) {
        var ru = cells[ri].tiles.filter(function (t) { return t.uncut; });
        if (!ru.length) continue;
        if (!stitVlevo) narVlevo.push({ row: cells[ri], t: ru[0] });
        if (!stitVpravo && ru.length > 1) narVpravo.push({ row: cells[ri], t: ru[ru.length - 1] });
      }

      /* ── ROZDĚLENÍ: HŘEBEN PŘEDNOSTNĚ, NÁROŽÍ ŘÍDCE ─────────────────
         Pod hřebenem nejvýš každá 3. taška, u nároží/úžlabí nejvýš každá
         3. řada. Co se nevejde, zhustí se na každou 2. (napřed hřeben,
         pak nároží); zbytek doplní pojistka níže. Počet se nemění —
         dává ho výkaz, tady se jen rozmisťuje. */
      var kap = function (n, krok) { return n ? Math.ceil(n / krok) : 0; };
      var nH = Math.min(vetrackyKs, kap(podHrebenem.length, 3)), nL = 0, nP = 0;
      var rozdelNaStrany = function (zbyva, krok) {
        var cL = kap(narVlevo.length, krok), cP = kap(narVpravo.length, krok);
        var volnoL = Math.max(0, cL - nL), volnoP = Math.max(0, cP - nP);
        var dat = Math.min(zbyva, volnoL + volnoP);
        if (!dat) return 0;
        var dL = Math.min(volnoL, Math.round(dat * volnoL / (volnoL + volnoP)));
        var dP = Math.min(volnoP, dat - dL);
        if (dL + dP < dat) dL = Math.min(volnoL, dat - dP);
        nL += dL; nP += dP; return dL + dP;
      };
      var zbyvaRozd = vetrackyKs - nH;
      zbyvaRozd -= rozdelNaStrany(zbyvaRozd, 3);
      if (zbyvaRozd > 0) {                                  // zhustit: hřeben po 2
        var navic = Math.min(zbyvaRozd, kap(podHrebenem.length, 2) - nH);
        if (navic > 0) { nH += navic; zbyvaRozd -= navic; }
      }
      if (zbyvaRozd > 0) zbyvaRozd -= rozdelNaStrany(zbyvaRozd, 2);   // nároží po 2
      if (zbyvaRozd > 0) {                                  // co zbyde, pod hřeben/k nároží naplno
        var navic2 = Math.min(zbyvaRozd, podHrebenem.length - nH);
        if (navic2 > 0) { nH += navic2; zbyvaRozd -= navic2; }
        if (zbyvaRozd > 0) zbyvaRozd -= rozdelNaStrany(zbyvaRozd, 1);
      }

      var zbyva = vetrackyKs;
      rovnomerne(podHrebenem, nH).forEach(function (m) { if (polozVetracku(m.row, m.t)) zbyva--; });
      rovnomerne(narVlevo,  nL).forEach(function (m) { if (polozVetracku(m.row, m.t)) zbyva--; });
      rovnomerne(narVpravo, nP).forEach(function (m) { if (polozVetracku(m.row, m.t)) zbyva--; });

      /* Kdyby se pořád všechny nevešly (malá rovina), doplní se po párech
         do zbylých řad odshora dolů — ať se nikde nehromadí. */
      for (var ri2 = nR - 3; ri2 >= 1 && zbyva > 0; ri2--) {
        var ru2 = cells[ri2].tiles.filter(function (t) { return t.uncut && !t.hasVent; });
        if (!ru2.length) continue;
        if (zbyva >= 2 && ru2.length >= 2) {
          if (polozVetracku(cells[ri2], ru2[0])) zbyva--;
          if (polozVetracku(cells[ri2], ru2[ru2.length - 1])) zbyva--;
        } else {
          if (polozVetracku(cells[ri2], ru2[Math.floor((ru2.length - 1) / 2)])) zbyva--;
        }
      }
    }

    /* SNĚHOVÉ HÁKY — druhá řada od okapu průběžně, výš každá N-tá taška
       s posunem o řadu, takže vznikne diagonála. Horní dvě řady zůstávají
       prázdné. Taška s větračkou se přeskočí. */
    /* KOLIK HÁKŮ SE KRESLÍ, URČUJE VÝKAZ — ne schéma.
       Do 24. 8. 2026 si kresba rozmísťovala háky podle vlastního pravidla
       (druhá řada celá + diagonála po N-té tašce) a vyšlo jí jich 202,
       zatímco se objednávalo 139. Pokrývač by podle plánu osadil o 63 víc,
       než by měl na paletě. Schéma teď říká jen ROZMÍSTĚNÍ, počet dává
       `hakyKs` z výkazu. Nahlásil PENTI. */
    var cilHaku = (o.hakyKs > 0) ? Math.round(o.hakyKs) : null;

    /* Kandidáti v pořadí, v jakém se osazují: nejdřív souvislá řada nad
       okapem, pak diagonála výš. Teprve z nich se vybere tolik, kolik
       jich je ve výkazu. */
    /* HÁK PATŘÍ JEN NA ZÁKLADNÍ TAŠKU, NIKDY NA KRAJOVOU.
       PENTI 31. 8. 2026: platí u všech modelů keramické i betonové
       krytiny bez výjimky. Krajovka je první a poslední taška v řadě,
       tam se hák neosazuje — proto se z kandidátů vyřazuje. */
    var kandidati = [];
    if (schema) cells.forEach(function (row) {
      var j = row.j; if (j < 1 || j > nR - 3) return;
      var tiles = row.tiles;
      var vhodna = function (k) {
        if (jeKrajovka(row, k)) return null;         /* krajovka — nikdy */
        var t = tiles[k];
        if (!t || !t.cela || t.okno) return null;
        if (t.hasVent || t.cut) {
          /* Uhnout na sousední tašku, ale zase ne na krajovku. */
          if (!jeKrajovka(row, k + 1)) {
            var r = tiles[k + 1];
            if (r && r.cela && !r.hasVent && !r.okno && !r.cut) return r;
          }
          if (!jeKrajovka(row, k - 1)) {
            var l = tiles[k - 1];
            if (l && l.cela && !l.hasVent && !l.okno && !l.cut) return l;
          }
          return null;
        }
        return t;
      };
      var vRade = [];
      tiles.forEach(function (t, k) {
        var c = vhodna(k);
        if (c) vRade.push(c);
      });
      if (vRade.length) kandidati.push({ tasky: vRade, vm: row.vm,
                                         prvniRada: (j === 1) });
    });

    /* ── OBRAZEC PODLE PŘÍRUČKY VÝROBCE ──────────────────────────────
       PENTI 2. 9. 2026: „Schémata protisněhových háků se vykreslují
       stále špatně a nemění se se změnou sněhové oblasti."

       Počty se s oblastí měnily správně, ale OBRAZEC ne. Od 24. 8. 2026
       se totiž kreslilo tak, že se vzal počet z výkazu a rovnoměrně se
       rozprostřel po ploše — háky pak stály ve svislých sloupcích a
       vypadaly na každé střeše stejně.

       Příručka Bramac (TP 2026, str. 76–91) přitom říká přesný obrazec:
       jedna průběžná řada nad okapem a v dalších řadách hák na každé
       N-té tašce, kde N je dané schématem A–G A MODELEM TAŠKY.
       Ten obrazec teď chodí z enginu (`schemaSnih`) a kreslí se doslova.

       Zbytek pravidel příručky, který platil už dřív:
         · háky až od 2. řady od okapu,
         · v horních dvou řadách pod hřebenem žádné,
         · nikdy na krajové tašce. */
    /* ── SOUMĚRNÝ ROZVRH ─────────────────────────────────────────────
       PENTI 31. 8. 2026: rozmístění má být souměrné, ať se pokrývači
       dobře rozměřuje.

       Do té doby se všechny tašky nad okapní řadou naskládaly do JEDNOHO
       seznamu za sebou a bral se každý n-tý prvek. Protože seznam běžel
       po řadách, vycházely háky pokaždé jinde a obrázek vypadal
       nahodile.

       Teď se počet rozdělí MEZI ŘADY a v každé řadě se rozmístí
       rovnoměrně: pro k háků a m tašek sedí i-tý hák na tašce
       round((i + 0.5)·m/k).

       ── DIAGONÁLA ────────────────────────────────────────────────────
       PENTI 2. 9. 2026: „Sněhové háky se zobrazují nesmyslně kolmo
       k okapu — to nic nezachytí. Musí být kromě první řady kladeny
       diagonálně."

       Měl pravdu a bylo to u všech krytin, ne jen u Contitonu. Vzorec
       výše dával v KAŽDÉ řadě tytéž pozice, takže háky stály nad sebou
       ve svislých sloupcích. U krytin kladených na střih (Classic,
       Contiton) to byly dokonalé svislé řady; u krytin na vazbu
       (Granát, Tegalit, Planoton) se pozice střídaly mezi dvěma
       hodnotami, což je jen posun samotných tašek, ne rozvrh háků.
       Sníh mezi sloupci projede.

       Řešení: každá další řada se posune o JEDNU TAŠKU do strany.
       Pokrývači se to dobře rozměřuje („každou řadu o tašku vedle")
       a vznikne skutečná diagonála. Posun je kruhový (modulo), takže
       rozestupy v řadě zůstanou stejné a POČET HÁKŮ SE NEMĚNÍ — ten
       pořád určuje výkaz, ne kresba. */
    function vRadeSoumerne(tasky, kolik, posunTasek) {
      var m = tasky.length, ven = [];
      if (kolik <= 0 || m === 0) return ven;
      if (kolik >= m) return tasky.slice();
      var rozestup = m / kolik;
      for (var i = 0; i < kolik; i++) {
        var idx = Math.floor((i + 0.5) * rozestup + (posunTasek || 0)) % m;
        if (idx < 0) idx += m;
        ven.push(tasky[idx]);
      }
      return ven;
    }

    var vybrane = [];
    if (kandidati.length) {
      var prvni = kandidati.filter(function (x) { return x.prvniRada; });
      var vyse  = kandidati.filter(function (x) { return !x.prvniRada; });

      /* Souvislá řada nad okapem se osazuje vždycky celá — na ni se sníh
         opírá. */
      prvni.forEach(function (r) {
        r.tasky.forEach(function (t) { vybrane.push({ t: t, vm: r.vm }); });
      });

      /* Krok obrazce. Chodí z enginu se schématem; když by chyběl
         (starší uložená nabídka), sáhne se po tabulce velkoformátových
         tašek, aby se kreslilo aspoň něco rozumného. */
      var K = o.krokHaku || {};
      var kT = K.tasek || ({ A:8, B:7, C:6, D:5, E:2, F:3, G:2 }[schema] || 5);
      var kR = K.rad || ((schema === "E") ? 2 : 1);
      var kStrida = K.strida || null;      // střídavý krok uvnitř řady
      var kSude   = K.sude   || null;      // jiný krok v sudých řadách

      vyse.forEach(function (r, i) {
        /* Jen každá kR-tá řada. `i` je pořadí nad průběžnou řadou,
           takže i=0 je vždycky obsazená. */
        if ((i % kR) !== 0) return;
        var tasky = r.tasky, m = tasky.length;
        /* Číslo řady od okapu: 0 = okapní, 1 = průběžná, i+2 = tahle. */
        var suda = (((i + 2) + 1) % 2) === 0;
        var krok = (kSude && suda) ? kSude : kT;
        /* Posun o jednu tašku na řadu — z toho vznikne diagonála.
           Nemění počet, jen polohu. */
        var posun = i;
        var k = posun % Math.max(1, krok);
        var lichy = true;
        while (k < m) {
          vybrane.push({ t: tasky[k], vm: r.vm });
          /* Střídavý krok („5, 4, 5, 4…"): sudé skoky jsou kratší. */
          k += kStrida ? (lichy ? krok : kStrida) : krok;
          lichy = !lichy;
        }
      });
    }
    vybrane.forEach(function (x) {
      pocty.hak++;
      g += '<circle data-prvek="snehovy_hak" cx="' + tx((x.t.a + x.t.b) / 2).toFixed(1)
        + '" cy="' + ty(x.vm).toFixed(1) + '" r="' + rHak + '" fill="' + B.hak + '"/>';
    });

    /* Střešní okna: otvor a montážní lať pod ním. */
    okna.forEach(function (o2) {
      var x0 = tx(o2.u0), x1 = tx(o2.u1), y0 = ty(o2.v1), y1 = ty(o2.v0);
      g += '<rect data-prvek="okno" x="' + Math.min(x0, x1).toFixed(1)
        + '" y="' + Math.min(y0, y1).toFixed(1)
        + '" width="' + Math.abs(x1 - x0).toFixed(1)
        + '" height="' + Math.abs(y1 - y0).toFixed(1)
        + '" fill="' + B.okno + '" fill-opacity="0.3" stroke="' + B.okno
        + '" stroke-width="' + (tah * 2.2).toFixed(1) + '"/>';
      g += '<line data-prvek="montazni_lat" x1="' + x0.toFixed(1) + '" y1="' + ty(o2.v0).toFixed(1)
        + '" x2="' + x1.toFixed(1) + '" y2="' + ty(o2.v0).toFixed(1)
        + '" stroke="' + B.lat + '" stroke-width="' + (tah * 3).toFixed(1) + '"/>';
    });

    return { svg: g, pocty: pocty };
  }

  /* ── SCHÉMA JEDNÉ ROVINY ─────────────────────────────────────────────
     nahled = true  → malý obrázek do karty
     nahled = false → velké schéma v reálných proporcích s kótami         */
  function rovina(p, opt) {
    opt = opt || {};
    var rings = p && p.tvarRings || [];
    if (!rings.length) return null;
    /* Rovina nemusí začínat na nule — u tvarů L, T a U vycházejí souřadnice
       některých rovin do záporu. Kdyby se počítalo jen s maximem, kreslila
       by se ta část mimo obrázek: u tvaru L bylo takhle 4,5 m roviny
       neviditelných (nalezeno PENTI 14. 8. 2026). */
    var minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    rings.forEach(function (r) { r.forEach(function (q) {
      if (q[0] < minU) minU = q[0];
      if (q[0] > maxU) maxU = q[0];
      if (q[1] < minV) minV = q[1];
      if (q[1] > maxV) maxV = q[1];
    }); });
    if (!isFinite(minU) || !isFinite(minV)) return null;
    var sirkaM = maxU - minU, spadM = maxV - minV;
    if (sirkaM <= 0 || spadM <= 0) return null;

    var nahled = !!opt.nahled;
    var W, H, pad, s;
    if (nahled) {
      W = 300; H = 210; pad = 14;
      s = Math.min((W - 2 * pad) / sirkaM, (H - 2 * pad) / spadM);
    } else {
      pad = 42;
      s = Math.min(62, 820 / sirkaM);
      W = Math.round(sirkaM * s + 2 * pad);
      H = Math.round(spadM * s + 2 * pad);
    }
    /* Posun o minU a minV — obrázek pak začíná tam, kde začíná rovina. */
    var tx = function (u) { return pad + (u - minU) * s; };
    var ty = function (v) { return H - pad - (v - minV) * s; };

    var g = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" '
      + 'style="width:100%;max-width:' + W + 'px;height:auto;background:var(--ink);'
      + 'border:1px solid var(--line);border-radius:8px">';

    var body = function (r) {
      return r.map(function (q) { return tx(q[0]).toFixed(1) + "," + ty(q[1]).toFixed(1); }).join(" ");
    };
    rings.forEach(function (r) {
      g += '<polygon data-prvek="rovina" points="' + body(r) + '" fill="' + B.plocha
        + '" stroke="' + B.obrys + '" stroke-width="1.5"/>';
    });

    /* Volby se předávají VŠECHNY, ne vyjmenované. Když se sem nový údaj
       nedostal, kresba si ho dopočítala po svém a rozešla se s výkazem —
       stalo se to hned dvakrát (krycí šířka krajovek a hranice řad,
       24. 8. 2026). */
    var cells = radyTasek(rings, opt.ksSir, opt.vlm, opt.vazba, opt.okna,
      Object.assign({}, opt, { zrcadlit: zrcadlitRovinu(p), naStrih: !opt.vazba,
        /* Zbytek po dělení šířkou se roztahuje jen u pálené a betonové
           tašky — plechová má krycí šířku danou lisem. */
        roztahovat: (opt.typKrytiny !== "plechová") ? true : false }));
    var kres = kresliTasky(cells, tx, ty, {
      schema: opt.schema, vetracky: p.vetracky_ks || 0,
      vetrackyKrok: p.vetracky_krok || 0,      /* pevný vzor pod hřebenem (2026.11.251) */
      /* tvar roviny — z něj se pozná hřeben i uprostřed roviny (24. 9. 2026) */
      rings: rings,
      /* Obrazec podle příručky výrobce — kolik tašek se přeskočí a jak
         často se řada zapojí. Chodí z enginu, aby kresba a výkaz
         vycházely z jednoho pravidla. */
      krokHaku: opt.krokHaku || null,
      rHak: nahled ? 2 : 4.2, tah: nahled ? 0.4 : 0.6,
      okna: opt.okna, okrajTyp: opt.okrajTyp
    });
    var cid = "kl" + (CLIP++);
    g += '<clipPath id="' + cid + '">'
      + rings.map(function (r) { return '<polygon points="' + body(r) + '"/>'; }).join("")
      + '</clipPath>';
    g += '<g clip-path="url(#' + cid + ')">' + kres.svg + '</g>';

    function txt(x, y, t, c, an, sz, rot) {
      return '<text x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" text-anchor="' + (an || "middle")
        + '" font-size="' + (sz || 10) + '" fill="' + (c || B.text) + '"'
        + (rot ? ' transform="rotate(' + rot + ' ' + x.toFixed(1) + ' ' + y.toFixed(1) + ')"' : "")
        + ' style="paint-order:stroke;stroke:#1c241c;stroke-width:3px;font-weight:600">' + t + '</text>';
    }
    g += txt(pad, 18, "Rovina " + p.cislo + " — sklon " + Math.round(p.sklon || 0) + "°",
             B.text, "start", nahled ? 10 : 12);
    if (!nahled) {
      g += txt(W / 2, H - 12, "šířka " + delkaTxt(sirkaM), B.popis, "middle", 11);
      g += txt(16, H / 2, "spád " + delkaTxt(spadM), B.popis, "middle", 11, -90);
    }
    return { svg: g + "</svg>", pocty: kres.pocty, rad: cells.length,
             /* Řady i s jednotlivými taškami — z nich se počítá objednací
                počet tabulí u plechové krytiny (viz `tabuleSOdrezky`). */
             rady: cells,
             sirka: sirkaM, spad: spadM, cislo: p.cislo,
             /* ── PŘEVOD KLIKU NA MÍSTO NA STŘEŠE ─────────────────────
                Aby se dalo do plánu kliknout a umístit střešní okno,
                musí volající umět z bodu v obrázku spočítat, kde na
                rovině leží. Vrací se proto celý převod, ne jen obrázek.
                `zObrazku(x, y)` bere souřadnice ve VLASTNÍCH jednotkách
                SVG (viewBox), ne v pixelech na obrazovce — přepočet
                z pixelů si musí udělat stránka podle skutečné velikosti
                obrázku. */
             W: W, H: H,
             doObrazku: function (u, v) { return { x: tx(u), y: ty(v) }; },
             zObrazku: function (x, y) {
               return { u: minU + (x - pad) / s, v: minV + (H - pad - y) / s };
             } };
  }

  /* Schémata všech rovin z výsledku `kladecakTasky`. */
  function vsechnyRoviny(kladecak, opt) {
    opt = opt || {};
    if (!kladecak || !kladecak.planes) return [];
    var s = kladecak.souhrn || {};
    var spolecne = {
      ksSir: (kladecak.kryci_sirka_mm || 0) / 1000,
      /* Krycí šířka krajovek — u Contitonu levá 129 a pravá 94 mm. */
      krajL: (kladecak.krajovka_l_mm || 0) / 1000,
      krajP: (kladecak.krajovka_p_mm || 0) / 1000,
      vazba: (kladecak.kladeni === "na vazbu"),
      schema: (s.snehove_haky && s.snehove_haky.ks > 0) ? s.snehove_haky.schema : null,
      /* Obrazec háků z příručky výrobce — viz `schemaSnih` v enginu. */
      krokHaku: (s.snehove_haky && s.snehove_haky.ks > 0) ? {
        tasek:  s.snehove_haky.krok_tasek,
        strida: s.snehove_haky.krok_strida,
        sude:   s.snehove_haky.krok_sude,
        rad:    s.snehove_haky.krok_rad
      } : null,
      okrajTyp: s.okraj_typ || "krajovky",
      /* Půltašku smí kresba použít jen u modelů, které ji mají v sortimentu.
         Když údaj chybí (starší volání), předpokládá se že ji má — chová se
         to pak jako dřív. */
      maPultasku: (kladecak.ma_pultasku !== false),
      /* Druh krytiny — podle něj se pozná, jestli se smí zbytek po dělení
         šířkou roztáhnout. Plechová taška má krycí šířku z lisu. */
      typKrytiny: kladecak.typ || "",
      nahled: !!opt.nahled
    };
    var out = [];
    kladecak.planes.forEach(function (p) {
      var r = rovina(p, Object.assign({}, spolecne, {
        vlm: (p.vl_mm || 0) / 1000,
        /* Skutečné hranice řad z výpočtu — mají přednost před rovnoměrným
           dělením, aby plán seděl s řezem laťování. */
        radyV: p.rady_v || null,
        okna: opt.oknaProRovinu ? opt.oknaProRovinu(p) : []
      }));
      if (r) out.push(r);
    });
    return out;
  }

  /* ══════════════════════════════════════════════════════════════════
     PLECHOVÁ KRYTINA — PÁSY
     Falcovaná a Click se nepokládají po kusech, ale po pásech od okapu
     k hřebeni. Každý pás se stříhá na vlastní míru, takže výsledek není
     počet kusů, ale ŘEZNÝ PLÁN: seznam délek a kolikrát se která opakuje.
     Přesně tak to dělá i kladečský plán od Budmatu.

     Nahoře se pás stříhá KOLMO, i když rovina končí nárožím — proto se
     kreslí i odpadní trojúhelník, aby bylo vidět, kolik plechu padne.
     ══════════════════════════════════════════════════════════════════ */
  function rovinaPasy(p, opt) {
    opt = opt || {};
    var rings = p && p.tvarRings || [];
    if (!rings.length || !p.pocet_pasu) return null;
    var minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    rings.forEach(function (r) { r.forEach(function (q) {
      if (q[0] < minU) minU = q[0];
      if (q[0] > maxU) maxU = q[0];
      if (q[1] < minV) minV = q[1];
      if (q[1] > maxV) maxV = q[1];
    }); });
    var sirkaM = maxU - minU, spadM = maxV - minV;
    if (!(sirkaM > 0) || !(spadM > 0)) return null;

    var nahled = !!opt.nahled, W, H, pad, s;
    if (nahled) { W = 300; H = 210; pad = 14;
      s = Math.min((W - 2 * pad) / sirkaM, (H - 2 * pad) / spadM);
    } else { pad = 42; s = Math.min(62, 820 / sirkaM);
      W = Math.round(sirkaM * s + 2 * pad); H = Math.round(spadM * s + 2 * pad); }
    var tx = function (u) { return pad + (u - minU) * s; };
    var ty = function (v) { return H - pad - (v - minV) * s; };
    var pid = "pas" + (CLIP++);

    var g = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" '
      + 'style="width:100%;max-width:' + W + 'px;height:auto;background:var(--ink);'
      + 'border:1px solid var(--line);border-radius:8px">';
    /* Šrafa pro odpad — plný odstín by se pletl s pásem. */
    g += '<defs><pattern id="' + pid + '" width="5" height="5" patternUnits="userSpaceOnUse" '
      + 'patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" stroke="' + B.rez
      + '" stroke-width="1"/></pattern></defs>';

    var body = function (r) {
      return r.map(function (q) { return tx(q[0]).toFixed(1) + "," + ty(q[1]).toFixed(1); }).join(" ");
    };
    rings.forEach(function (r) {
      g += '<polygon data-prvek="rovina" points="' + body(r) + '" fill="' + B.plocha
        + '" stroke="' + B.obrys + '" stroke-width="1.5"/>';
    });

    /* Nejvyšší bod obrysu nad danou vodorovnou polohou — kam až pás sahá. */
    var vrchNad = function (u) {
      var v = 0;
      rings.forEach(function (r) {
        for (var k = 0; k < r.length; k++) {
          var A = r[k], Bb = r[(k + 1) % r.length];
          if ((A[0] - u) * (Bb[0] - u) <= 0 && Math.abs(Bb[0] - A[0]) > 1e-9) {
            var t = (u - A[0]) / (Bb[0] - A[0]);
            var vv = A[1] + t * (Bb[1] - A[1]);
            if (vv > v) v = vv;
          }
        }
      });
      return v;
    };

    var hranice = p.hranice || [];
    var pocty = { pas: 0, odpad: 0, otvor: 0 };
    var odpadM2 = 0;
    /* KUSY PÁSŮ (13. 9. 2026). Když výpočet rozdělil pás otvorem vikýře na
       víc kusů, kreslí se každý kus zvlášť — pod otvorem a nad ním.
       Bez otvorů je kus jeden na pás a obrázek je jako dřív. */
    var kusyPasu = {};
    (p.kusy || []).forEach(function (k) { (kusyPasu[k.pas] = kusyPasu[k.pas] || []).push(k); });
    var maKusy = (p.kusy || []).length > 0;
    for (var i = 0; i < hranice.length - 1; i++) {
      var u0 = hranice[i], u1 = hranice[i + 1];
      if (u1 - u0 < 1e-4) continue;
      /* Profil skutečného obrysu napříč pásem a jeho nejvyšší bod. */
      var N = 8, prof = [], vMax = 0, vMin = 1e9;
      for (var q = 0; q <= N; q++) {
        var u = u0 + (u1 - u0) * q / N, tv = vrchNad(u);
        prof.push([u, tv]);
        if (tv > vMax) vMax = tv;
        if (tv < vMin) vMin = tv;
      }
      if (vMax <= 0) continue;
      if (maKusy) {
        var ks = kusyPasu[i] || [];
        ks.forEach(function (k) {
          pocty.pas++;
          g += '<rect data-prvek="pas" x="' + tx(k.u0).toFixed(1) + '" y="' + ty(k.v1).toFixed(1)
            + '" width="' + ((k.u1 - k.u0) * s).toFixed(1) + '" height="' + ((k.v1 - k.v0) * s).toFixed(1)
            + '" fill="' + B.cela + '" stroke="' + B.spara + '" stroke-width="0.7"/>';
          if (!nahled && k.delka != null && (k.v1 - k.v0) * s > 28) {
            g += '<text x="' + ((tx(k.u0) + tx(k.u1)) / 2).toFixed(1) + '" y="' + (ty(k.v1) + 14).toFixed(1)
              + '" text-anchor="middle" font-size="9" fill="#1c241c" '
              + 'transform="rotate(-90 ' + ((tx(k.u0) + tx(k.u1)) / 2).toFixed(1) + ' '
              + (ty(k.v1) + 14).toFixed(1) + ')" style="font-weight:700">'
              + delkaTxt(k.delka) + '</text>';
          }
        });
        if (!ks.length) continue;
      } else {
        pocty.pas++;
        g += '<rect data-prvek="pas" x="' + tx(u0).toFixed(1) + '" y="' + ty(vMax).toFixed(1)
          + '" width="' + ((u1 - u0) * s).toFixed(1) + '" height="' + ((vMax - minV) * s).toFixed(1)
          + '" fill="' + B.cela + '" stroke="' + B.spara + '" stroke-width="0.7"/>';
      }
      /* Odpad mezi skutečným obrysem a kolmým střihem. */
      if (vMax - vMin > 0.02) {
        var pts = prof.map(function (x) { return tx(x[0]).toFixed(1) + "," + ty(x[1]).toFixed(1); }).join(" ")
          + " " + tx(u1).toFixed(1) + "," + ty(vMax).toFixed(1)
          + " " + tx(u0).toFixed(1) + "," + ty(vMax).toFixed(1);
        g += '<polygon data-prvek="odpad" points="' + pts + '" fill="url(#' + pid + ')"/>';
        pocty.odpad++;
        odpadM2 += (u1 - u0) * (vMax - (vMin + vMax) / 2);   // hrubý odhad plochy odřezku
      }
      /* Kolmý horní střih — zvýrazněný, protože podle něj se stříhá. */
      g += '<line data-prvek="strih" x1="' + tx(u0).toFixed(1) + '" y1="' + ty(vMax).toFixed(1)
        + '" x2="' + tx(u1).toFixed(1) + '" y2="' + ty(vMax).toFixed(1)
        + '" stroke="' + B.vetracka + '" stroke-width="1.6"/>';
      /* Číslo pásu a jeho délka — v malém náhledu by se to nevešlo.
         U kusů je délka napsaná u každého kusu výš. */
      if (!nahled && !maKusy && p.delky && p.delky[i] != null) {
        g += '<text x="' + ((tx(u0) + tx(u1)) / 2).toFixed(1) + '" y="' + (ty(vMax) + 14).toFixed(1)
          + '" text-anchor="middle" font-size="9" fill="#1c241c" '
          + 'transform="rotate(-90 ' + ((tx(u0) + tx(u1)) / 2).toFixed(1) + ' '
          + (ty(vMax) + 14).toFixed(1) + ')" style="font-weight:700">'
          + delkaTxt(p.delky[i]) + '</text>';
      }
    }

    /* OTVORY VIKÝŘŮ — vyšrafované, přes pásy. Tam plech hlavní střechy
       není; vikýř má vlastní rovinu vedle. */
    (p.otvory || []).forEach(function (ot) {
      pocty.otvor++;
      g += '<rect data-prvek="otvor" x="' + tx(ot.u0).toFixed(1) + '" y="' + ty(ot.v1).toFixed(1)
        + '" width="' + ((ot.u1 - ot.u0) * s).toFixed(1) + '" height="' + ((ot.v1 - ot.v0) * s).toFixed(1)
        + '" fill="url(#' + pid + ')" stroke="' + B.rez + '" stroke-width="1.4" stroke-dasharray="6 3"/>';
      if (!nahled)
        g += '<text x="' + ((tx(ot.u0) + tx(ot.u1)) / 2).toFixed(1) + '" y="' + ((ty(ot.v0) + ty(ot.v1)) / 2).toFixed(1)
          + '" text-anchor="middle" font-size="11" fill="' + B.rez + '" '
          + 'style="paint-order:stroke;stroke:#1c241c;stroke-width:3px;font-weight:700">vikýř</text>';
    });

    function txt(x, y, t, c, an, sz, rot) {
      return '<text x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" text-anchor="' + (an || "middle")
        + '" font-size="' + (sz || 10) + '" fill="' + (c || B.text) + '"'
        + (rot ? ' transform="rotate(' + rot + ' ' + x.toFixed(1) + ' ' + y.toFixed(1) + ')"' : "")
        + ' style="paint-order:stroke;stroke:#1c241c;stroke-width:3px;font-weight:600">' + t + '</text>';
    }
    g += txt(pad, 18, (p.nazev ? p.nazev : ("Rovina " + p.cislo)) + " — " + pocty.pas + " pásů"
      + (p.spolehlivost === "přibližně" ? " (délky orientační)" : ""),
      B.text, "start", nahled ? 10 : 12);
    if (!nahled) {
      g += txt(W / 2, H - 12, "šířka " + delkaTxt(sirkaM), B.popis, "middle", 11);
      g += txt(16, H / 2, "spád " + delkaTxt(spadM), B.popis, "middle", 11, -90);
    }
    return { svg: g + "</svg>", pocty: pocty, cislo: p.cislo,
             sirka: sirkaM, spad: spadM, delky: (p.delky || []).slice(),
             bm: p.bm || 0, odpadM2: Math.max(0, odpadM2) };
  }

  /* Schémata pásů pro všechny roviny z výsledku `kladecakPlech`. */
  function vsechnyRovinyPasy(plech, opt) {
    if (!plech || !plech.planes) return [];
    var out = [];
    plech.planes.forEach(function (p) {
      var r = rovinaPasy(p, opt || {});
      if (r) out.push(r);
    });
    return out;
  }

  /* ŘEZNÝ PLÁN — délky pásů setříděné odshora a kolikrát se opakují.
     Přesně v podobě, jakou používá kladečský plán od Budmatu. */
  function rezniPlan(plech) {
    if (!plech || !plech.planes) return null;
    var mapa = {};
    plech.planes.forEach(function (p) {
      (p.delky || []).forEach(function (d) {
        var mm = Math.round(d * 1000);
        mapa[mm] = (mapa[mm] || 0) + 1;
      });
    });
    var radky = Object.keys(mapa).map(Number).sort(function (a, b) { return b - a; })
      .map(function (mm, i) {
        return { poradi: i + 1, delkaMm: mm, ks: mapa[mm],
                 bm: +(mm / 1000 * mapa[mm]).toFixed(2) };
      });
    return { radky: radky,
             kusuCelkem: radky.reduce(function (a, r) { return a + r.ks; }, 0),
             bmCelkem: +radky.reduce(function (a, r) { return a + r.bm; }, 0).toFixed(2),
             kryciSirkaMm: plech.kryci_sire_mm,
             m2Celkem: +(radky.reduce(function (a, r) { return a + r.bm; }, 0)
                         * (plech.kryci_sire_mm / 1000)).toFixed(2) };
  }

  /* Legenda — bez ní obrázek nikdo nepřečte. */
  function legenda() {
    var polozky = [
      [B.cela, "celá taška"], [B.pul, "půltaška"], [B.rez, "řezaná"],
      [B.krajovka, "krajovka"], [B.vetracka, "větrací taška"], [B.hak, "sněhový hák"]
    ];
    return '<div style="display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:'
      + B.popis + ';margin-top:6px">'
      + polozky.map(function (x) {
          return '<span style="display:flex;align-items:center;gap:5px">'
            + '<span style="width:12px;height:12px;border-radius:2px;background:' + x[0]
            + ';display:inline-block"></span>' + x[1] + '</span>';
        }).join("")
      + '</div>';
  }

  /* Legenda pro plechové pásy — jiné prvky, jiná legenda. */
  function legendaPlech() {
    var polozky = [[B.cela, "pás plechu"], [B.rez, "odřezek"], [B.vetracka, "kolmý střih"]];
    return '<div style="display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:'
      + B.popis + ';margin-top:6px">'
      + polozky.map(function (x) {
          return '<span style="display:flex;align-items:center;gap:5px">'
            + '<span style="width:12px;height:12px;border-radius:2px;background:' + x[0]
            + ';display:inline-block"></span>' + x[1] + '</span>';
        }).join("")
      + '</div>';
  }

  global.PentiKladecakVykres = {
    rovina: rovina, vsechnyRoviny: vsechnyRoviny,
    tabuleSOdrezky: tabuleSOdrezky, MIN_ODREZEK: MIN_ODREZEK,
    rovinaPasy: rovinaPasy, vsechnyRovinyPasy: vsechnyRovinyPasy,
    rezniPlan: rezniPlan,
    radyTasek: radyTasek, zrcadlitRovinu: zrcadlitRovinu,
    legenda: legenda, legendaPlech: legendaPlech
  };
})(typeof window !== "undefined" ? window : globalThis);
