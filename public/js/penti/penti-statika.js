/* ==========================================================================
   STATIKA DŘEVĚNÝCH PRVKŮ KROVU — ČSN EN 1995-1-1 (EC5)
   --------------------------------------------------------------------------
   Vytaženo ze staré kalkulačky (`Strecha_z_pudorysu.html`, funkce
   `posudekEC5`), kde bylo 230 řádků zalitých do formuláře — četlo to dvacet
   políček přes `getElementById` a zapisovalo HTML. Bez formuláře se to
   nedalo ani zavolat, ani otestovat (PENTI 14. 8. 2026).

   Tady jsou z toho čisté funkce: dostanou čísla, vrátí čísla. Žádný DOM.

   CO SE PŘITOM OPRAVILO
   · Tabulky materiálu, sněhu, větru, vzpěru a kombinace byly v souboru
     TŘIKRÁT, pokaždé o kousek jinak. Ve třetí kopii materiálu chyběla
     pevnost v tahu `ft0`. Teď je všechno jednou.
   · Součinitel `kmod` si odporoval: starý posudek 0,8, nově psaný posudek
     nárožníku 0,9. Platí 0,8 — sníh jako střednědobé zatížení, třída
     provozu 2 (rozhodnuto PENTI 14. 8. 2026).

   CO SE NEZMĚNILO
   Vzorce ani hodnoty. Na stejném zadání musí vyjít přesně to, co vypisuje
   stará kalkulačka — hlídá to sada `statika`.

   POZOR: je to orientační posudek pro nabídku, ne náhrada statika.
   ========================================================================== */
(function (global) {
  "use strict";

  /* ── MATERIÁL ────────────────────────────────────────────────────────
     fm  ohyb · fv smyk · fc90 tlak kolmo · fc0 tlak podél · ft0 tah podél
     Em  průměrný modul pružnosti · E05 pátý percentil (pro vzpěr)
     gM  dílčí součinitel materiálu                       [MPa = N/mm²] */
  var MATERIALY = {
    C24:   { nazev:"C24",   fm:24, fv:4.0, fc90:2.5, fc0:21, ft0:14,   Em:11000, E05:7400, gM:1.3 },
    C30:   { nazev:"C30",   fm:30, fv:4.0, fc90:2.7, fc0:23, ft0:18,   Em:12000, E05:8000, gM:1.3 },
    GL24h: { nazev:"GL24h", fm:24, fv:3.5, fc90:2.5, fc0:24, ft0:16.5, Em:11500, E05:9600, gM:1.25 }
  };
  /* Sníh jako střednědobé zatížení, třída provozu 2. */
  var KMOD = 0.8;
  /* Součinitel dotvarování — průhyb konečný = okamžitý × (1 + k_def). */
  var KDEF = 0.8;

  function material(trida){ return MATERIALY[trida] || MATERIALY.C24; }

  /* Návrhové pevnosti: f_d = kmod · f_k / γ_M */
  function navrhovePevnosti(trida, kmod){
    var m = material(trida), k = (kmod != null) ? kmod : KMOD;
    return {
      material: m, kmod: k,
      fmd:   k*m.fm  /m.gM,
      fvd:   k*m.fv  /m.gM,
      fc90d: k*m.fc90/m.gM,
      fc0d:  k*m.fc0 /m.gM,
      ft0d:  k*m.ft0 /m.gM
    };
  }

  /* ── SNÍH ────────────────────────────────────────────────────────────
     Oblast I–VIII se NEHÁDÁ, zadává se podle oficiální mapy.
     Tvarový součinitel: do 30° plných 0,8, nad 60° nula, mezi tím lineárně. */
  var SNIH_SK = {1:0.7, 2:1.0, 3:1.5, 4:2.0, 5:2.5, 6:3.0, 7:4.0, 8:4.5};
  /* NAVÁTÝ SNÍH — PROČ SE NEPŘIČÍTÁ.
     Norma vedle rovnoměrného sněhu uvádí i nerovnoměrné rozdělení: μ₁ na
     jedné polovině střechy a polovina na druhé. Pro prvky, které aplikace
     posuzuje, ale ROZHODUJE ROVNOMĚRNÝ PŘÍPAD:

       · krokev i vaznice se posuzují na SVÉ rovině, kde je v rovnoměrném
         případě plných μ₁ — nerovnoměrné rozdělení jim dá stejně nebo míň;
       · síla v kleštině vychází z celkového zatížení vazby, které je
         v rovnoměrném případě největší.

     Přičítat tedy není co. Kde nerovnoměrné rozdělení opravdu rozhoduje —
     hromadění u vikýřů, atik, komínů a v úžlabí — aplikace nepočítá vůbec
     a protokol to musí říct nahlas. Doplnit to naslepo, bez tabulek
     z normy, by bylo horší než to přiznat. */
  function snihNaStrese(oblast, sklonDeg){
    var sk = SNIH_SK[oblast|0] || 1.0, a = +sklonDeg || 0;
    var mu = (a <= 30) ? 0.8 : (a >= 60 ? 0 : 0.8*(60-a)/30);
    return { oblast:oblast|0, sk:sk, mu:mu, s:mu*sk,
      poznamka: "Rovnoměrné rozdělení. Pro posuzované prvky je rozhodující; "
        + "hromadění u vikýřů, atik a v úžlabí aplikace nepočítá." };
  }

  /* ── VÍTR ────────────────────────────────────────────────────────────
     Základní rychlost podle oblasti, součinitel expozice podle terénu. */
  var VITR_VB = {1:22.5, 2:25, 3:27.5, 4:30, 5:36};
  var VITR_CE = {II:2.4, III:1.8, IV:1.5};
  function vitr(oblast, teren){
    var vb = VITR_VB[oblast|0] || 25;
    var qb = 0.5*1.25*vb*vb/1000;
    var ce = VITR_CE[teren] || VITR_CE.III;
    var qp = ce*qb;
    return { vb:vb, qb:qb, ce:ce, qp:qp, w:qp*0.9 };
  }
  /* ── SÁNÍ VĚTRU — ZJEDNODUŠENÝ POSTUP ────────────────────────────────
     Norma dělí střechu na zóny F–J a každé dává jiný součinitel. Tabulky
     7.4a a 7.4b nemáme k dispozici, takže se použije ZJEDNODUŠENÍ:
     na celou střechu se vezme jedna hodnota odpovídající nejnepříznivější
     zóně (roh u okapu) včetně vnitřního tlaku.

     PROČ JE TO BEZPEČNÉ. Sání je v rozích největší a směrem doprostřed
     klesá. Když se nejhorší hodnota použije všude, vyjde zatížení vyšší
     nebo stejné než skutečné — nikdy nižší. Zjednodušení tedy může stát
     víc kotev, ale nemůže vést k poddimenzování.

     CO TO STOJÍ. Uprostřed střechy vychází kotvy hustěji, než by musely.
     Až budou tabulkové součinitele k dispozici, doplní se sem — geometrie
     zón je spočítaná ve `zonyVetru` a čeká na ně.

     Hodnotu jde přebít zvenku (`o.cpe`), kdyby ji statik určil sám. */
  var CPE_SANI_ZJEDNODUSENE = [
    { doSklonu: 15, cpe: 1.8 },
    { doSklonu: 30, cpe: 1.6 },
    { doSklonu: 90, cpe: 1.4 }
  ];
  function saniVetru(qp, sklonDeg, cpeRucne){
    var a = +sklonDeg || 0;
    var cpe = null;
    for(var i=0;i<CPE_SANI_ZJEDNODUSENE.length;i++){
      if(a <= CPE_SANI_ZJEDNODUSENE[i].doSklonu){
        cpe = CPE_SANI_ZJEDNODUSENE[i].cpe; break;
      }
    }
    if(cpe == null) cpe = 1.4;
    var rucne = (cpeRucne != null && +cpeRucne > 0);
    if(rucne) cpe = +cpeRucne;
    return {
      cpe: cpe, w: qp*cpe,
      zjednodusene: !rucne,
      popis: rucne
        ? "součinitel sání zadaný ručně"
        : "zjednodušeně — nejnepříznivější zóna (roh u okapu) použitá na "
          + "celou střechu, včetně vnitřního tlaku; na bezpečné straně"
    };
  }

  /* ── KOMBINACE ───────────────────────────────────────────────────────
     Zatížení se přepočítává na PŮDORYS, proto gk/cos(sklon).

     Do 18. 8. 2026 tu byla JEDINÁ kombinace, ve které byl vítr vždycky
     vedlejší. Chyběly dvě další, které EN 1990 (výraz 6.10) vyžaduje —
     a hlavně ta třetí, na NADZVEDNUTÍ, která jediná rozhoduje o kotvení
     pozednice. Bez ní se kotvy neměly z čeho spočítat a kladly se natvrdo
     po metru (metodika odsouhlasená statikem, verze 2).

     k_mod SE LIŠÍ PODLE KOMBINACE, protože se řídí nejkratším trváním
     zatížení v ní obsaženého: se sněhem střednědobé 0,80, s větrem
     krátkodobé 0,90 (EN 1995-1-1, tab. 3.1, třída provozu 2).

     ψ₀ = 0,5 pro sníh (stavby do 1000 m n. m.), 0,6 pro vítr.

     Sání je záporné — směřuje od střechy pryč. V KZ3 se proto vlastní
     tíha bere jako PŘÍZNIVÁ, tedy γ_G = 1,0, a výsledek může vyjít
     záporný: to je tah, který musí udržet kotvy. */
  var PSI0_SNIH = 0.5, PSI0_VITR = 0.6;
  var KMOD_STREDNEDOBE = 0.8, KMOD_KRATKODOBE = 0.9;

  function kombinace(gkPlochaStrechy, sklonDeg, snihKNm2, vitrKNm2, saniKNm2){
    var cosA = Math.cos((+sklonDeg||0)*Math.PI/180);
    var gkPlan = gkPlochaStrechy / (cosA || 1);
    var s = +snihKNm2 || 0, w = +vitrKNm2 || 0;
    /* Sání se zadává kladně jako velikost; do kombinace vstupuje záporně. */
    var wSani = (saniKNm2 != null) ? Math.abs(+saniKNm2 || 0) : 0;

    var kz = [
      { kod:"KZ1", nazev:"sníh hlavní",
        popis:"1,35·G + 1,50·S + 1,50·0,6·W",
        kmod: KMOD_STREDNEDOBE,
        q: 1.35*gkPlan + 1.5*s + 1.5*PSI0_VITR*w },
      { kod:"KZ2", nazev:"vítr hlavní",
        popis:"1,35·G + 1,50·W + 1,50·0,5·S",
        kmod: KMOD_KRATKODOBE,
        q: 1.35*gkPlan + 1.5*w + 1.5*PSI0_SNIH*s }
    ];
    /* KZ3 dává SMĚREM VZHŮRU — nepočítá se s ní ohyb dolů, ale kotvení. */
    var qUplift = 1.5*wSani - 1.0*gkPlan;     // kladné = tah ze střechy
    kz.push({ kod:"KZ3", nazev:"nadzvednutí",
      popis:"1,00·G + 1,50·W_sání   (G příznivá)",
      kmod: KMOD_KRATKODOBE, q: 0, qTah: qUplift, tahova:true });

    /* Rozhodující tlaková kombinace — na ni se posuzuje ohyb a smyk. */
    var vedouci = kz[0];
    kz.forEach(function(k){ if(!k.tahova && k.q > vedouci.q) vedouci = k; });

    return {
      gkPlan: gkPlan,
      kombinace: kz,
      vedouci: vedouci,
      qUls: vedouci.q,                          // návrhové [kN/m² půdorysu]
      kmod: vedouci.kmod,
      qSls: gkPlan + s,                         // charakteristické, pro průhyby
      /* Nadzvednutí zvlášť — kotvení pozednice se posuzuje jen na ně. */
      qTahUls: qUplift,
      nadzvedava: qUplift > 0
    };
  }

  /* ── VZPĚR ───────────────────────────────────────────────────────────
     Rostlé dřevo, β_c = 0,2. Vrací součinitel vzpěrnosti k_c. */
  function soucinitelVzperu(bMm, hMm, delkaM, trida){
    var m = material(trida);
    var iMin = Math.min(bMm, hMm)/Math.sqrt(12);
    var lam = (delkaM*1000)/iMin;
    var lamRel = (lam/Math.PI)*Math.sqrt(m.fc0/m.E05);
    var k = 0.5*(1 + 0.2*(lamRel-0.3) + lamRel*lamRel);
    var kc = 1/(k + Math.sqrt(Math.max(0, k*k - lamRel*lamRel)));
    return { iMin:iMin, lam:lam, lamRel:lamRel, kc:kc };
  }

  /* Ohybová tuhost EI v kN·m² z profilu v mm a modulu pružnosti v MPa.
     E [N/mm²] · I [mm⁴] = N·mm², a to je 1e-9 kN·m². Do řešiče, který
     počítá v kN a metrech, musí jít právě takhle. */
  function tuhostEI(bMm, hMm, trida){
    var m = material(trida);
    return m.Em * (bMm*Math.pow(hMm,3)/12) * 1e-9;
  }

  /* Průřezové charakteristiky z profilu v milimetrech. */
  function prurez(bMm, hMm){
    return {
      b:bMm, h:hMm,
      A:  bMm*hMm,                    // mm²
      Wy: bMm*hMm*hMm/6,              // mm³
      Iy: bMm*Math.pow(hMm,3)/12      // mm⁴
    };
  }

  /* ══ NÁROŽNÍ A ÚŽLABNÍ KROKEV ═══════════════════════════════════════
     Nárožnice je nejdelší a nejnamáhanější prvek krovu. Počítá se jinak
     než běžná krokev ve třech věcech:

     ZATĚŽOVACÍ PLOCHA. Nárožnice sbírá z obou přilehlých rovin. Zkrácené
     krokve na ni dosedají a odevzdávají jí POLOVINU svého zatížení, druhou
     polovinu nese pozednice. Když si roh rozkreslíme: krokev vzdálená x od
     rohu má rozpon x, tedy zatížení q·x, z toho na nárožnici jde q·x/2.
     Sečteno po celé délce dá ∫q·x/2 dx = q·Lp²/4, a to z každé strany
     stejně… ale Lp je úhlopříčka, takže obě strany dohromady dají

         W = q · Lp² / 4        (Lp = půdorysný průmět nárožnice)

     TVAR ZATÍŽENÍ. U rohu jsou zkrácené krokve krátké a skoro nic nenesou,
     u hřebene jsou plné. Zatížení tedy roste od okapu k hřebeni — je to
     trojúhelník s nulou na pozednici, ne rovnoměrné břemeno.

     PODPORY. Nárožnice neleží jen na pozednici a hřebeni. Kde ji kříží
     středová vaznice, je podepřená taky — u valby se vaznice v rohu kříží
     a nárožnice jde přesně přes to křížení. Přes tři podpory je moment
     zhruba o polovinu menší než přes dvě.

     PŘESAH OKAPU se zanedbává. Převislý konec vytváří nad pozednicí opačný
     moment, který ten v poli zmenšuje — počítat bez něj je na straně
     bezpečné.

     Je to ORIENTAČNÍ posudek pro nabídku, ne náhrada statika.
     ══════════════════════════════════════════════════════════════════ */

  /* Podpory se zadávají jako podíl rozpětí (0 = pozednice, 1 = hřeben).
     Tady se z nich udělá seřazený seznam bez duplicit a s oběma konci. */
  function podporyNarozniku(podil){
    var v = [0, 1];
    (podil||[]).forEach(function(x){
      x = +x;
      if(!(x > 0.05) || !(x < 0.95)) return;
      if(v.some(function(y){ return Math.abs(y-x) < 0.03; })) return;
      v.push(x);
    });
    return v.sort(function(a,b){ return a-b; });
  }

  function posudekNarozniku(o){
    var L  = +o.rozpetiM || 0;          // pozednice → hřeben, po sklonu [m]
    var Lp = +o.pudorysnaDelkaM || 0;   // půdorysný průmět téhož        [m]
    var b  = (o.profil && o.profil.b) || 140;
    var h  = (o.profil && o.profil.h) || 240;
    var solver = o.solver
      || (typeof global.PentiEngine !== "undefined" && global.PentiEngine.solveFrame2D);
    if(!(L > 0.2) || !(Lp > 0.1) || !solver) return null;

    var f = navrhovePevnosti(o.trida, o.kmod);
    var pr = prurez(b, h);
    var EI = tuhostEI(b, h, o.trida);

    var plocha = Lp*Lp/4;                          // zatěžovací plocha [m²]
    var Wuls = (+o.qUls||0) * plocha;              // celková síla      [kN]
    var Wsls = (+o.qSls||0) * plocha;

    /* Rozdělení na pole mezi podporami. */
    var podil = podporyNarozniku(o.podporyPodil);
    var pole = [];
    for(var i=1;i<podil.length;i++) pole.push((podil[i]-podil[i-1])*L);

    /* Trojúhelník: nula na pozednici, vrchol u hřebene. Intenzita v místě
       x je 2·W·x/L², aby se po celé délce sečetla právě na W. */
    var trojuhelnik = function(W){
      return function(x){ return 2*W*x/(L*L); };
    };
    var uls = spojityNosnik({ pole:pole, w:0, EI:1,  EA:1e6, solver:solver,
                              wFn:trojuhelnik(Wuls) });
    var sls = spojityNosnik({ pole:pole, w:0, EI:EI, EA:1e6, solver:solver,
                              wFn:trojuhelnik(Wsls) });
    if(!uls || !sls) return null;

    var sig = uls.Mmax*1e6/pr.Wy;                  // [N/mm²]
    var tau = smykObdelniku(uls.Vmax, pr.b, pr.h);     // k_cr (11. 10. 2026)
    /* Průhyb se posuzuje na nejdelším poli mezi podporami, ne na celé délce. */
    var Lpole = Math.max.apply(null, pole);
    var mez = Lpole*1000/300;
    var prohybMm = sls.prohybM*1000;

    var radky = [
      radek("Nárožnice — ohyb", "σ_m,d = M/W ≤ f_m,d",
        "zatěžovací plocha Lp²/4 = "+F(plocha)+" m² → W = "+F(Wuls)+" kN; "
        +"M = "+F(uls.Mmax)+" kNm přes "+pole.length+" pole; W_y = "
        +Math.round(pr.Wy/1000)+" cm³ → σ = "+F(sig)+" N/mm²; f_m,d = "+F(f.fmd),
        sig/f.fmd),
      radek("Nárožnice — smyk", "τ_d = 1,5·V/(k_cr·b·h) ≤ f_v,d,  k_cr = 0,67",
        "V = "+F(uls.Vmax)+" kN → τ = "+F(tau)+" N/mm²; f_v,d = "+F(f.fvd),
        tau/f.fvd),
      radek("Nárožnice — průhyb", "w ≤ L/300",
        "w = "+F(prohybMm,1)+" mm na poli "+F(Lpole)+" m ≤ "+F(mez,1)+" mm",
        prohybMm/mez)
    ];
    var max = Math.max.apply(null, radky.map(function(r){ return r.vyuziti; }));
    var rozhoduje = radky.filter(function(r){ return r.vyuziti === max; })[0];

    return {
      radky: radky,
      profil: { b:b, h:h }, rozpetiM: L, pudorysnaDelkaM: Lp,
      plochaM2: plocha, silaKN: Wuls, momentKNm: uls.Mmax,
      posouvajiciKN: uls.Vmax,
      napetiMPa: sig, pevnostMPa: f.fmd,
      prohybMm: prohybMm, mezProhybuMm: mez,
      podpory: podil, poli: pole.length,
      podporyM: podil.map(function(x){ return x*L; }),
      vyuziti: max, vyhovuje: radky.every(function(r){ return r.vyhovuje; }),
      rozhoduje: rozhoduje ? rozhoduje.nazev.replace("Nárožnice — ","") : ""
    };
  }

  /* Nejmenší hranol z nabídky, který projde. Šířka zůstává zadaná, zvedá se
     jen výška — tak se to na stavbě dělá a tak se to i objednává. */
  var VYSKY_HRANOLU = [140,160,180,200,220,240,260,280,300,320];
  function navrhniNaroznik(o){
    for(var i=0;i<VYSKY_HRANOLU.length;i++){
      var h = VYSKY_HRANOLU[i];
      if(h < (o.minVyskaMm||0)) continue;          // musí stačit i na zářez
      var pos = posudekNarozniku(Object.assign({}, o,
        { profil:{ b:(o.profil&&o.profil.b)||140, h:h } }));
      if(pos && pos.vyhovuje) return { b:(o.profil&&o.profil.b)||140, h:h, posudek:pos };
    }
    return null;
  }

  /* Jeden řádek posudku — všude stejný tvar, ať se to dá vypsat i porovnat. */
  function radek(nazev, vzorec, dosazeni, vyuziti){
    return { nazev:nazev, vzorec:vzorec, dosazeni:dosazeni,
             vyuziti:vyuziti, vyhovuje:(vyuziti<=1.0) };
  }

  /* ══ POSUDKY ═══════════════════════════════════════════════════════════
     Vstup `o`:
       profil {b,h} [mm] · delkaM · trida · kmod
       wh [kN/m]  zatížení na běžný metr prvku (návrhové)
       whSls      totéž charakteristické (pro průhyby)
     Všechny vrací pole řádků. */

  var F = function(x,n){ return (+x).toFixed(n==null?2:n); };

  /* ── SMYK DŘEVA: SOUČINITEL k_cr (PENTI 11. 10. 2026, PLAN_kcr_smyk.md) ──
     EN 1995-1-1 čl. 6.1.7: smyk se počítá se zmenšenou šířkou
     b_ef = k_cr·b, k_cr = 0,67 pro rostlé i lepené dřevo (výsušné trhliny
     zmenšují smykovou plochu). Do 11. 10. 2026 se k_cr nepoužíval nikde.
     Jedno místo pro všechny posudky smyku dřeva. */
  var K_CR = 0.67;
  /* smykové napětí obdélníku: τ = 1,5·V/(k_cr·b·h)   [V kN, b h mm → N/mm²] */
  function smykObdelniku(VkN, bMm, hMm){ return 1.5*VkN*1000/(K_CR*bMm*hMm); }

  /* KROKEV — ohyb, smyk, průhyb okamžitý i konečný. */
  function posudekKrokve(o){
    var p = prurez(o.profil.b, o.profil.h);
    var f = navrhovePevnosti(o.trida, o.kmod);
    var Lh = o.vodorovnyPrumet, Ls = o.delkaM*1000;
    var M = o.wh*Lh*Lh/8, V = o.wh*Lh/2;
    /* SÍLY Z RÁMU VAZBY (PENTI 13. 10. 2026, PLAN_vazba_ram.md B4): když
       volající dodá MEd / VEd, posoudí se na ně — jinak postaru (prostý
       nosník přes nejdelší pole). Průhyb zůstává z prostého nosníku
       (na bezpečné straně). */
    var zRamu = (o.MEd != null);
    if(zRamu){ M = Math.abs(+o.MEd); V = Math.abs(+o.VEd || 0); }
    var sig = M*1e6/p.Wy, tau = smykObdelniku(V, o.profil.b, o.profil.h);   // k_cr (11. 10. 2026)
    var cosA = Math.cos((o.sklonDeg||0)*Math.PI/180);
    var wPerp = o.whSls*cosA*cosA;
    var dInst = 5*wPerp*Math.pow(Ls,4)/(384*f.material.Em*p.Iy);
    var dFin = dInst*(1+KDEF);
    return [
      radek("Krokev — ohyb", "σ_m,d = M/W ≤ f_m,d",
        (zRamu ? "M z rámu vazby (" + (o.zdrojRam || "obálka") + ") = " + F(M) + " kNm"
               : "M = wₕ·Lₕ²/8 = "+F(o.wh)+"·"+F(Lh)+"²/8 = "+F(M)+" kNm")+"; W = "
        +Math.round(p.Wy/1000)+" cm³ → σ = "+F(sig)+" N/mm²; f_m,d = "+F(f.fmd),
        sig/f.fmd),
      radek("Krokev — smyk", "τ_d = 1,5·V/(k_cr·b·h) ≤ f_v,d,  k_cr = 0,67",
        (zRamu ? "V z rámu vazby = " + F(V) + " kN" : "V = wₕ·Lₕ/2 = "+F(V)+" kN")+" → τ = "+F(tau)+" N/mm²; f_v,d = "+F(f.fvd),
        tau/f.fvd),
      radek("Krokev — průhyb okamžitý", "w_inst = 5·q·L⁴/(384·E·I) ≤ L/300",
        "w_inst = "+F(dInst,1)+" mm ≤ "+F(Ls/300,1)+" mm", dInst/(Ls/300)),
      radek("Krokev — průhyb konečný", "w_fin = w_inst·(1+k_def) ≤ L/250",
        "w_fin = "+F(dInst,1)+"·"+(1+KDEF)+" = "+F(dFin,1)+" mm ≤ "+F(Ls/250,1)+" mm",
        dFin/(Ls/250))
    ];
  }

  /* ══ PROSTÝ NOSNÍK S BODOVÝMI A ÚSEKOVÝMI ZATÍŽENÍMI (krok 3b, 2026.11.208) ══
     Pro výměnu a zesílenou krokev u vikýře. Zatížení:
       bodove  [{x [m], F [kN]}]
       spojite [{a, b [m], q [kN/m]}]  (rovnoměrné na úseku a…b)
     Vrací reakce, největší moment, posouvající sílu a průhyb (numericky:
     křivost M/EI integrovaná dvakrát, okrajové podmínky w(0) = w(L) = 0).
     Jednoduchá statika bez řešiče — na bezpečné straně (spojitost
     nad podporami se zanedbává). */
  function prostyNosnikObecny(o){
    var L = +o.L || 0; if(!(L > 0.01)) return null;
    var B = (o.bodove||[]).filter(function(f){ return f && f.x >= 0 && f.x <= L && f.F; });
    var S = (o.spojite||[]).map(function(q){ return { a:Math.max(0,Math.min(L,q.a)), b:Math.max(0,Math.min(L,q.b)), q:q.q }; })
                           .filter(function(q){ return q.b > q.a && q.q; });
    /* reakce z momentové podmínky k levé podpoře */
    var celkem = 0, mom = 0;
    B.forEach(function(f){ celkem += f.F; mom += f.F*f.x; });
    S.forEach(function(q){ var F=q.q*(q.b-q.a); celkem += F; mom += F*(q.a+q.b)/2; });
    var RB = mom/L, RA = celkem - RB;
    var N = 400, dx = L/N, Mx = [], Mmax = 0, Vmax = Math.max(Math.abs(RA), Math.abs(RB));
    var Mv = function(x){
      var m = RA*x;
      B.forEach(function(f){ if(f.x < x) m -= f.F*(x-f.x); });
      S.forEach(function(q){ if(x > q.a){ var e=Math.min(x,q.b), F=q.q*(e-q.a); m -= F*(x-(q.a+e)/2); } });
      return m;
    };
    for(var i=0;i<=N;i++){ var M=Mv(i*dx); Mx.push(M); if(Math.abs(M) > Math.abs(Mmax)) Mmax = M; }
    /* průhyb: θ' = M/EI, w' = θ; w(0)=0, θ(0)=C tak, aby w(L)=0. EI v kNm². */
    var EI = +o.EI || 1, th = [0], w = [0];
    for(var j=1;j<=N;j++){ th.push(th[j-1] + (Mx[j-1]+Mx[j])/2*dx/EI); }
    for(var k=1;k<=N;k++){ w.push(w[k-1] + (th[k-1]+th[k])/2*dx); }
    var C = -w[N]/L, wmax = 0;
    for(var m=0;m<=N;m++){ var wm = w[m] + C*m*dx; if(Math.abs(wm) > Math.abs(wmax)) wmax = wm; }
    return { RA:RA, RB:RB, Mmax:Math.abs(Mmax), Vmax:Vmax, wmaxM:Math.abs(wmax), celkem:celkem };
  }

  /* POSUDEK NOSNÍKU U VIKÝŘE — ohyb, smyk, průhyb (stejné meze jako krokev).
     o: nazev, profil {b,h}, trida, kmod, L [m] (vodorovně), cosSklonu (1 =
     vodorovný nosník), uls {bodove, spojite}, sls {bodove, spojite}. Průhyb
     šikmého nosníku kolmo k ose = vodorovný výpočet / cos² (délka po spádu
     L/cos, složka zatížení kolmo k ose q·cos²). */
  function posudekNosnikuVikyre(o){
    var p = prurez(o.profil.b, o.profil.h);
    var f = navrhovePevnosti(o.trida, o.kmod);
    var cs = (o.cosSklonu > 0.1) ? o.cosSklonu : 1;
    var EI = f.material.Em * p.Iy * 1e-9;               // kNm²
    var U = prostyNosnikObecny(Object.assign({ L:o.L, EI:EI }, o.uls));
    var Sv = prostyNosnikObecny(Object.assign({ L:o.L, EI:EI }, o.sls));
    if(!U || !Sv) return [];
    var sig = U.Mmax*1e6/p.Wy, tau = smykObdelniku(U.Vmax, o.profil.b, o.profil.h);
    var Ls = o.L/cs*1000, dInst = Sv.wmaxM*1000/(cs*cs), dFin = dInst*(1+KDEF);
    var n = o.nazev || "Nosník";
    return [
      radek(n + " — ohyb", "σ_m,d = M/W ≤ f_m,d",
        "M = " + F(U.Mmax) + " kNm (prostý nosník L = " + F(o.L) + " m, " + (o.popisZatizeni || "") + "); W = "
        + Math.round(p.Wy/1000) + " cm³ → σ = " + F(sig) + " N/mm²; f_m,d = " + F(f.fmd), sig/f.fmd),
      radek(n + " — smyk", "τ_d = 1,5·V/(k_cr·b·h) ≤ f_v,d,  k_cr = 0,67",
        "V = " + F(U.Vmax) + " kN → τ = " + F(tau) + " N/mm²; f_v,d = " + F(f.fvd), tau/f.fvd),
      radek(n + " — průhyb okamžitý", "w_inst ≤ L/300",
        "w_inst = " + F(dInst,1) + " mm ≤ " + F(Ls/300,1) + " mm", dInst/(Ls/300)),
      radek(n + " — průhyb konečný", "w_fin = w_inst·(1+k_def) ≤ L/250",
        "w_fin = " + F(dFin,1) + " mm ≤ " + F(Ls/250,1) + " mm", dFin/(Ls/250))
    ];
  }

  /* OHYB + TLAK S VZPĚREM (PENTI 13. 10. 2026, B4) — EN 1995-1-1 rov. 6.23:
       σ_c,0,d/(k_c,y·f_c,0,d) + σ_m,y,d/f_m,y,d ≤ 1
     Krokev je podle rámu vazby tlačená (3–10 kN) a zároveň ohýbaná. Vzpěr
     v rovině vazby (osa y, výška h) na vzpěrnou délku = nejdelší pole po
     spádu; z roviny ji drží latě. M a N se berou jako největší hodnoty
     z obálky — i když nenastanou ve stejném místě (na bezpečné straně). */
  function posudekOhybTlak(o){
    var p = prurez(o.profil.b, o.profil.h);
    var f = navrhovePevnosti(o.trida, o.kmod);
    var vz = soucinitelVzperu(o.profil.h, o.profil.h, o.vzpernaDelkaM, o.trida);
    var N = Math.abs(+o.NEd || 0), M = Math.abs(+o.MEd || 0);
    var sc = N*1000/(o.profil.b*o.profil.h), sm = M*1e6/p.Wy;
    var u = sc/(vz.kc*f.fc0d) + sm/f.fmd;
    return [ radek((o.nazev || "Krokev") + " — ohyb + tlak (rám vazby)",
      "σ_c,0,d/(k_c,y·f_c,0,d) + σ_m,d/f_m,d ≤ 1   (EN 1995-1-1, rov. 6.23)",
      "N = " + F(N) + " kN, M = " + F(M) + " kNm; vzpěr v rovině vazby L = " + F(o.vzpernaDelkaM) + " m, λ = " + Math.round(vz.lam)
      + ", k_c = " + F(vz.kc) + " → " + F(sc) + "/(" + F(vz.kc) + "·" + F(f.fc0d) + ") + " + F(sm) + "/" + F(f.fmd) + " = " + F(u, 3),
      u) ];
  }

  /* OSEDLÁNÍ — otlačení kolmo k vláknům v zářezu na pozednici. */
  function posudekOsedlani(o){
    var f = navrhovePevnosti(o.trida, o.kmod);
    var alpha = (o.sklonDeg||0)*Math.PI/180;
    var Lseat = o.profil.h/(3*Math.sin(alpha));
    var R = o.wh*o.vodorovnyPrumet/2;
    var sig = (R*1.25)*1000/(o.profil.b*Lseat);
    return [ radek("Osedlání — otlačení ⊥ vláknům",
      "σ_c,90,d = R/(b·ℓ) ≤ k_c,90·f_c,90,d",
      "R = "+F(R*1.25)+" kN; ℓ = h/(3·sinα) = "+Math.round(Lseat)
      +" mm → σ = "+F(sig)+" N/mm²; limit = 1,5·"+F(f.fc90d)+" = "+F(1.5*f.fc90d),
      sig/(1.5*f.fc90d)) ];
  }

  /* VAZNICE — ohyb a průhyb.
     `souciniteleM` a `souciniteleW` dovolují dosadit spojitý nosník místo
     prostého (S2). Bez nich se počítá jako prostý: M = wL²/8, w = 5qL⁴/384EI. */
  function posudekVaznice(o){
    var p = prurez(o.profil.b, o.profil.h);
    var f = navrhovePevnosti(o.trida, o.kmod);
    var L = o.rozpetiM, cM = (o.soucinitelM != null) ? o.soucinitelM : 1/8;
    var cW = (o.soucinitelW != null) ? o.soucinitelW : 5/384;
    var M = cM*o.wp*L*L;
    var sig = M*1e6/p.Wy;
    var d = cW*o.wpSls*Math.pow(L*1000,4)/(f.material.Em*p.Iy);
    /* SMYK (PENTI 11. 10. 2026, PLAN_kcr_smyk.md) — do té doby vaznice
       posudek smyku neměla. V = c_V·w_p·L (spojitý nosník: největší
       posouvající síla z téhož výpočtu jako moment; prostý 0,5), nad
       podporou průřez oslabený dlabem čepu sloupku (h − dlab), k_cr. */
    var cV = (o.soucinitelV != null && o.soucinitelV > 0) ? o.soucinitelV : ((cM === 1/8) ? 0.5 : 0.625);
    var V = cV*o.wp*L, dlab = Math.max(0, +o.dlabMm || 0), hn = o.profil.h - dlab;
    var tau = smykObdelniku(V, o.profil.b, hn);
    return [
      radek("Vaznice — ohyb", "σ_m,d = M/W ≤ f_m,d",
        "M = "+(cM===1/8?"w_p·L²/8":"c·w_p·L², c = "+F(cM,4))+" = "
        +F(o.wp)+"·"+F(L)+"² → "+F(M)+" kNm; W = "+Math.round(p.Wy/1000)
        +" cm³ → σ = "+F(sig)+" N/mm²; f_m,d = "+F(f.fmd), sig/f.fmd),
      radek("Vaznice — smyk", "τ_d = 1,5·V/(k_cr·b·(h − dlab)) ≤ f_v,d,  k_cr = 0,67",
        "V = c_V·w_p·L = "+F(cV,3)+"·"+F(o.wp)+"·"+F(L)+" = "+F(V)+" kN; "
        +(dlab > 0 ? ("nad podporou dlab čepu "+dlab+" mm → ") : "")+"0,67×"+o.profil.b+"×"+hn+" mm → τ = "+F(tau)
        +" N/mm²; f_v,d = "+F(f.fvd), tau/f.fvd),
      radek("Vaznice — průhyb", "w = c·q·L⁴/(E·I) ≤ L/300",
        "w = "+F(d,1)+" mm ≤ "+F(L*1000/300,1)+" mm", d/(L*1000/300))
    ];
  }

  /* SLOUPEK — tlak se vzpěrem. */
  function posudekSloupku(o){
    var f = navrhovePevnosti(o.trida, o.kmod);
    var vz = soucinitelVzperu(o.profil.b, o.profil.h, o.vzpernaDelkaM, o.trida);
    var sig = o.N*1000/(o.profil.b*o.profil.h);
    return [ radek("Sloupek — tlak + vzpěr", "σ_c,0,d/(k_c·f_c,0,d) ≤ 1",
      "N = "+F(o.N)+" kN; λ = "+Math.round(vz.lam)+", λ_rel = "+F(vz.lamRel)
      +", k_c = "+F(vz.kc)+" → σ = "+F(sig)+" N/mm²; limit = "+F(vz.kc*f.fc0d),
      sig/(vz.kc*f.fc0d)) ];
  }

  /* ══ SVORNÍKOVÉ SPOJE — PODKLADY ══════════════════════════════════════
     ČSN EN 1995-1-1, čl. 8.5.1.1. Doplněno 18. 8. 2026 z podkladu od
     PENTI (výtisk normy).

     CO TENHLE BLOK UMÍ: spočítat vstupy do posudku spoje — pevnost
     v otlačení, plastický moment svorníku, minimální rozteče a účinný
     počet svorníků v řadě.

     CO NEUMÍ: samotnou únosnost F_v,Rk. Ta se počítá podle čl. 8.2.2
     jako MINIMUM ze šesti způsobů porušení (rovnice 8.6 a 8.7) a ten
     článek zatím k dispozici není. Vynechat část způsobů porušení nejde —
     výsledkem je jejich minimum, takže by únosnost vyšla VYŠŠÍ, než jaká
     je. To je špatný směr chyby, proto se posudek zatím nedělá.
     ══════════════════════════════════════════════════════════════════════ */
  var OCEL_SVORNIK = { "4.6":400, "4.8":420, "5.6":500, "5.8":520, "8.8":800 };

  function svornikPodklady(o){
    var d = +o.prumerMm || 12;                       // průměr svorníku [mm]
    var rhoK = +o.hustotaKgM3 || 350;                // ρ_k, C24 = 350 kg/m³
    var trida = o.tridaOceli || "4.8";
    var fuk = OCEL_SVORNIK[trida] || 420;
    var alfaDeg = (+o.uhelKVlaknumDeg || 0);         // úhel zatížení k vláknům
    var a = alfaDeg*Math.PI/180;

    /* (8.32) pevnost v otlačení rovnoběžně s vlákny */
    var fh0k = 0.082*(1 - 0.01*d)*rhoK;
    /* (8.33) jehličnaté dřevo */
    var k90 = 1.35 + 0.015*d;
    /* (8.31) pod úhlem α k vláknům */
    var fhak = fh0k / (k90*Math.pow(Math.sin(a),2) + Math.pow(Math.cos(a),2));
    /* (8.30) plastický moment únosnosti svorníku */
    var MyRk = 0.3*fuk*Math.pow(d, 2.6);

    /* Tabulka 8.4 — minimální rozteče a vzdálenosti. */
    var rozt = {
      a1:  (4 + Math.abs(Math.cos(a)))*d,            // rovnoběžně s vlákny
      a2:  4*d,                                      // kolmo k vláknům
      a3t: Math.max(7*d, 80),                        // zatížený konec
      a4c: 3*d,                                      // nezatížený okraj
      a4t: Math.max((2 + 2*Math.sin(a))*d, 3*d)      // zatížený okraj
    };

    /* (8.34) účinný počet svorníků v řadě rovnoběžně s vlákny.
       Při zatížení kolmo k vláknům je n_ef = n (8.35); mezi tím se
       lineárně interpoluje. */
    var n = Math.max(1, Math.round(+o.pocetVRade || 1));
    var a1sk = (+o.roztecVRadeMm > 0) ? +o.roztecVRadeMm : rozt.a1;
    var nef;
    if(n === 1){
      /* Osamělý svorník žádnou řadu netvoří — oslabení se na něj nevztahuje.
         Vzorec 8.34 by pro n = 1 a minimální rozteč dal 0,79, což by
         znamenalo, že jeden svorník unese míň než jeden svorník. */
      nef = 1;
    } else {
      var nefPodel = Math.min(n, Math.pow(n, 0.9)*Math.pow(a1sk/(13*d), 0.25));
      var podil = Math.min(1, Math.abs(alfaDeg)/90);  // 0 = podél, 1 = kolmo
      nef = nefPodel + podil*(n - nefPodel);
    }

    return {
      d: d, rhoK: rhoK, tridaOceli: trida, fuk: fuk,
      uhelDeg: r2(alfaDeg),
      fh0k: r2(fh0k), k90: r2(k90), fhak: r2(fhak), MyRk: Math.round(MyRk),
      rozteceMm: {
        a1: Math.round(rozt.a1), a2: Math.round(rozt.a2),
        a3t: Math.round(rozt.a3t), a4c: Math.round(rozt.a4c),
        a4t: Math.round(rozt.a4t)
      },
      pocetVRade: n, nef: r2(nef),
      vzorce: {
        fh0k: "f_h,0,k = 0,082·(1−0,01·d)·ρ_k   (8.32)",
        k90:  "k₉₀ = 1,35 + 0,015·d   (8.33, jehličnaté)",
        fhak: "f_h,α,k = f_h,0,k / (k₉₀·sin²α + cos²α)   (8.31)",
        MyRk: "M_y,Rk = 0,3·f_u,k·d^2,6   (8.30)",
        nef:  "n_ef = min{ n ; n^0,9·⁴√(a₁/(13·d)) }   (8.34)"
      }
    };
  }

  /* ══ ÚNOSNOST DVOJSTŘIŽNÉHO SPOJE DŘEVO–DŘEVO ═════════════════════════
     ČSN EN 1995-1-1, čl. 8.2.2, rovnice 8.7. Doplněno 18. 8. 2026.

     SPOJ KLEŠTINA–KROKEV–KLEŠTINA. Svorník prochází napříč třemi prvky:

         kleština t₁ │ krokev t₂ │ kleština t₁

     POZOR NA t₂: rozhoduje TLOUŠŤKA krokve, ne její výška. U krokve
     100/180 je t₂ = 100 mm. Kdyby se dosadilo 180, vyšel by spoj
     únosnější, než ve skutečnosti je — u módu (h) roste únosnost přímo
     s t₂ (zachyceno při kontrole podkladu 18. 8. 2026).

     ÚHLY K VLÁKNŮM. Síla je vodorovná, po délce kleštiny:
       · v kleštině je rovnoběžná s vlákny → α₁ = 0°
       · v krokvi svírá s vlákny úhel sklonu střechy → α₂ = sklon

     ČTYŘI ZPŮSOBY PORUŠENÍ (8.7), bere se NEJMENŠÍ:
       (g) otlačení v krajním prvku
       (h) otlačení v prostředním prvku
       (j) otlačení + jeden plastický kloub
       (k) otlačení + dva plastické klouby

     F_v,Rk je únosnost NA JEDNU STŘIŽNOU ROVINU A JEDEN SVORNÍK. Spoj je
     dvojstřižný, takže jeden svorník přenese 2 × F_v,Rk.

     ROPE EFFECT (F_ax,Rk) se ZANEDBÁVÁ. Přispěl by k módům (j) a (k), ale
     závisí na skutečném předpětí a stavu podložek, které se v čase mění.
     Nulou se počítá na bezpečné straně.
     ══════════════════════════════════════════════════════════════════════ */
  var GAMMA_M_SPOJ = 1.3;

  function unosnostSvorniku(o){
    var d = +o.prumerMm || 12;
    var t1 = +o.tloustkaKrajniMm || 60;      // kleština
    var t2 = +o.tloustkaProstredniMm || 100; // TLOUŠŤKA krokve
    var rhoK = +o.hustotaKgM3 || 350;
    var sklon = +o.sklonDeg || 0;

    var p1 = svornikPodklady({ prumerMm:d, hustotaKgM3:rhoK,
      tridaOceli:o.tridaOceli, uhelKVlaknumDeg:0 });
    var p2 = svornikPodklady({ prumerMm:d, hustotaKgM3:rhoK,
      tridaOceli:o.tridaOceli, uhelKVlaknumDeg:sklon });
    var fh1 = p1.fhak, fh2 = p2.fhak, My = p1.MyRk;
    var beta = fh2/fh1;                                   // (8.8)
    var Fax = 0;                                          // rope effect zanedbán

    var g = fh1*t1*d / 1000;                              // (8.7g) [kN]
    var hh = 0.5*fh2*t2*d / 1000;                         // (8.7h)
    var odm = Math.sqrt(2*beta*(1+beta)
              + 4*beta*(2+beta)*My/(fh1*d*t1*t1));
    var j = (1.05*fh1*t1*d/(2+beta))*(odm - beta)/1000 + Fax/4;   // (8.7j)
    var k = 1.15*Math.sqrt(2*beta/(1+beta))
            * Math.sqrt(2*My*fh1*d)/1000 + Fax/4;         // (8.7k)

    var mody = [
      { kod:"g", popis:"otlačení v kleštině",            F:g },
      { kod:"h", popis:"otlačení v krokvi",              F:hh },
      { kod:"j", popis:"otlačení + 1 plastický kloub",   F:j },
      { kod:"k", popis:"otlačení + 2 plastické klouby",  F:k }
    ];
    var nej = mody[0];
    mody.forEach(function(m){ if(m.F < nej.F) nej = m; });

    var kmod = (o.kmod != null) ? o.kmod : KMOD;
    var FvRk = nej.F;                       // na jednu střižnou rovinu
    var naSvornik = 2*FvRk;                 // dvojstřižný spoj
    return {
      d:d, t1:t1, t2:t2, sklonDeg:r2(sklon),
      fh1k:r2(fh1), fh2k:r2(fh2), beta:r2(beta), MyRk:My,
      mody: mody.map(function(m){
        return { kod:m.kod, popis:m.popis, FkN:r2(m.F),
                 rozhoduje:(m===nej) }; }),
      rozhodujiciMod: nej.kod,
      FvRk: r2(FvRk),
      FvRkNaSvornik: r2(naSvornik),
      FvRdNaSvornik: r2(kmod*naSvornik/GAMMA_M_SPOJ),
      kmod:kmod, gammaM:GAMMA_M_SPOJ,
      popis:"F_v,Rk = " + F(FvRk) + " kN na střižnou rovinu (rozhoduje mód "
        + nej.kod + " — " + nej.popis + "); dvojstřižný spoj → "
        + F(naSvornik) + " kN na svorník"
    };
  }

  /* ══ ÚNOSNOST JEDNOSTŘIŽNÉHO SPOJE DŘEVO–DŘEVO (21. 9. 2026) ═══════════
     ČSN EN 1995-1-1, čl. 8.2.2, rovnice 8.6. HAMBÁLEK PŘILOŽENÝ Z BOKU
     KROKVE — jeden kus, jedna střižná rovina:

         hambálek t₁ │ krokev t₂

     Do 21. 9. 2026 se hambálek počítal jako kleštiny (dva kusy, svorník
     dvojstřižně). U hambálku z jedné strany to nadhodnocovalo únosnost
     spoje zhruba na dvojnásobek. Šest způsobů porušení (8.6), bere se
     nejmenší:
       (a) otlačení v hambálku          (d) otlačení + 1 kloub v krokvi
       (b) otlačení v krokvi            (e) otlačení + 1 kloub v hambálku
       (c) otlačení + pootočení         (f) dva plastické klouby
     Rope effect se zanedbává, stejně jako u dvojstřižného spoje.
     ══════════════════════════════════════════════════════════════════════ */
  function unosnostSvornikuJednostrizne(o){
    var d = +o.prumerMm || 12;
    var t1 = +o.tloustkaHambalkuMm || 100;   // hambálek (síla podél vláken)
    var t2 = +o.tloustkaKrokveMm || 100;     // TLOUŠŤKA krokve
    var rhoK = +o.hustotaKgM3 || 350;
    var sklon = +o.sklonDeg || 0;
    var p1 = svornikPodklady({ prumerMm:d, hustotaKgM3:rhoK, tridaOceli:o.tridaOceli, uhelKVlaknumDeg:0 });
    var p2 = svornikPodklady({ prumerMm:d, hustotaKgM3:rhoK, tridaOceli:o.tridaOceli, uhelKVlaknumDeg:sklon });
    var fh1 = p1.fhak, fh2 = p2.fhak, My = p1.MyRk;
    var beta = fh2/fh1, r = t2/t1;
    var a = fh1*t1*d/1000;                                                   // (8.6a)
    var b = fh2*t2*d/1000;                                                   // (8.6b)
    var c = fh1*t1*d/(1+beta) * (Math.sqrt(beta + 2*beta*beta*(1 + r + r*r) + beta*beta*beta*r*r) - beta*(1 + r))/1000;  // (8.6c)
    var dd = 1.05*fh1*t1*d/(2+beta) * (Math.sqrt(2*beta*(1+beta) + 4*beta*(2+beta)*My/(fh1*d*t1*t1)) - beta)/1000;   // (8.6d)
    var e = 1.05*fh1*t2*d/(1+2*beta) * (Math.sqrt(2*beta*beta*(1+beta) + 4*beta*(1+2*beta)*My/(fh1*d*t2*t2)) - beta)/1000; // (8.6e)
    var f = 1.15*Math.sqrt(2*beta/(1+beta)) * Math.sqrt(2*My*fh1*d)/1000;    // (8.6f)
    var mody = [
      { kod:"a", popis:"otlačení v hambálku", F:a },
      { kod:"b", popis:"otlačení v krokvi", F:b },
      { kod:"c", popis:"otlačení s pootočením svorníku", F:c },
      { kod:"d", popis:"otlačení + 1 plastický kloub (v krokvi)", F:dd },
      { kod:"e", popis:"otlačení + 1 plastický kloub (v hambálku)", F:e },
      { kod:"f", popis:"dva plastické klouby", F:f }
    ];
    var nej = mody[0];
    mody.forEach(function(m){ if(m.F < nej.F) nej = m; });
    var kmod = (o.kmod != null) ? o.kmod : KMOD;
    return {
      d:d, t1:t1, t2:t2, sklonDeg:r2(sklon), jednostrizny:true,
      fh1k:r2(fh1), fh2k:r2(fh2), beta:r2(beta), MyRk:My,
      mody: mody.map(function(m){ return { kod:m.kod, popis:m.popis, FkN:r2(m.F), rozhoduje:(m===nej) }; }),
      rozhodujiciMod: nej.kod,
      FvRk: r2(nej.F),
      FvRkNaSvornik: r2(nej.F),                 // jedna střižná rovina
      FvRdNaSvornik: r2(kmod*nej.F/GAMMA_M_SPOJ),
      kmod:kmod, gammaM:GAMMA_M_SPOJ,
      popis:"F_v,Rk = " + F(nej.F) + " kN na střižnou rovinu (rozhoduje mód "
        + nej.kod + " — " + nej.popis + "); jednostřižný spoj → "
        + F(nej.F) + " kN na svorník"
    };
  }

  /* ══ TUHOST SVORNÍKOVÉHO SPOJE (21. 9. 2026) ══════════════════════════
     ČSN EN 1995-1-1, čl. 7.1, tab. 7.1: pro svorníky
         K_ser = ρ_m^1,5 · d / 23        [N/mm] na svorník a střižnou rovinu
     ρ_m je PRŮMĚRNÁ hustota (C24: 420 kg/m³), ne charakteristická.
     Čl. 7.1(3): u svorníků se má k prokluzu přičíst vůle otvoru — bere se
     1 mm (otvor d + 1) jako počáteční prokluz spoje, který táhlo nejdřív
     "vybere", než začne nést. Mezní stav únosnosti: K_u = 2/3 · K_ser.
     ══════════════════════════════════════════════════════════════════════ */
  var RHO_MEAN = { C16:370, C18:380, C20:390, C22:410, C24:420, C27:430, C30:460, C35:480, C40:500 };
  function tuhostSvorniku(o){
    var d = +o.prumerMm || 12;
    var rhoM = +o.hustotaMeanKgM3 || RHO_MEAN[o.trida || "C24"] || 420;
    var n = Math.max(1, +o.pocet || 1);
    var roviny = Math.max(1, +o.striznychRovin || 1);
    var Kser1 = Math.pow(rhoM, 1.5)*d/23;      // N/mm
    var Kser = Kser1*n*roviny;
    return {
      d:d, rhoMean:rhoM, pocet:n, striznychRovin:roviny,
      KserNaSvornikNmm: Math.round(Kser1),
      KserKNmm: r3(Kser/1000), KuKNmm: r3(2/3*Kser/1000),
      vuleMm: (o.vuleMm != null) ? +o.vuleMm : 1,
      vzorec: "K_ser = ρ_m^1,5·d/23 na svorník a střižnou rovinu (tab. 7.1); K_u = ⅔·K_ser"
    };
  }

  /* ══ NÁVRH SVORNÍKŮ SPOJE KLEŠTINY ════════════════════════════════════
     PENTI používá M12 a M16 (rozhodnuto 18. 8. 2026). Aplikace vybere
     sama: začne u menšího a jde nahoru, teprve když nestačí.

     JAK SE SVORNÍKY ROZMÍSŤUJÍ. Dva nad sebou přes výšku kleštiny (to je
     dnešní zvyklost) a další dvojice za sebou po délce. Rozteče drží
     tabulku 8.4:
       · nad sebou  — a₂  = 4 d  (kolmo k vláknům)
       · od okrajů  — a₄c = 3 d
       · za sebou   — a₁  = 5 d  (rovnoběžně s vlákny, α = 0)

     OSLABENÍ ŘADY. Svorníky ZA SEBOU ve směru vláken si navzájem ubírají
     únosnost (rov. 8.34). Svorníky NAD SEBOU ne — kolmo k vláknům je
     n_ef = n. Účinný počet je tedy 2 · n_ef(počet dvojic).
     ══════════════════════════════════════════════════════════════════════ */
  var PRUMERY_SVORNIKU = [12, 16];

  function navrhniSvorniky(silaKN, o){
    o = o || {};
    var N = Math.abs(+silaKN || 0);
    var vyskaKlestiny = +o.vyskaKlestinyMm || 160;
    var delkaNaSvorniky = +o.delkaProSvornikyMm || 400;   // co je k dispozici
    var nejlepsi = null, nejsilnejsi = null;
    var pridejTuhost = function(k){
      if(!k || k.nevyhovi) return k;
      k.tuhost = tuhostSvorniku({ prumerMm:k.prumerMm, pocet:k.celkem,
        striznychRovin: o.jednostrizne ? 1 : 2, trida:o.trida });
      return k;
    };

    /* ── TYPOVÝ SPOJ PENTI (21. 9. 2026) ─────────────────────────────────
       Pro opakovanou výrobu se spoj hambálku nenavrhuje pokaždé znovu:
       nejdřív se zkusí typový spoj (výchozí 3 × M12 — dva nad sebou a
       třetí za nimi, velkoplošné podložky). Když vyhoví, bere se on, aby
       výroba měla pořád stejný detail. Když nevyhoví, hledá se dál. */
    if(o.typovy && o.typovy.prumerMm > 0 && o.typovy.pocet > 0){
      var dT = +o.typovy.prumerMm, nT = Math.round(+o.typovy.pocet);
      var pkT = svornikPodklady({ prumerMm:dT, hustotaKgM3:o.hustotaKgM3, uhelKVlaknumDeg:0 });
      var nadSebouT = (2*pkT.rozteceMm.a4c + pkT.rozteceMm.a2 <= vyskaKlestiny) ? Math.min(2, nT) : 1;
      var sloupcu = Math.ceil(nT/nadSebouT);
      var vejdeSe = (sloupcu-1)*pkT.rozteceMm.a1 + 2*pkT.rozteceMm.a3t <= delkaNaSvorniky;
      if(vejdeSe){
        var uT = o.jednostrizne
          ? unosnostSvornikuJednostrizne({ prumerMm:dT, tloustkaHambalkuMm:o.tloustkaKrajniMm,
              tloustkaKrokveMm:o.tloustkaProstredniMm, sklonDeg:o.sklonDeg, kmod:o.kmod, hustotaKgM3:o.hustotaKgM3 })
          : unosnostSvorniku({ prumerMm:dT, tloustkaKrajniMm:o.tloustkaKrajniMm,
              tloustkaProstredniMm:o.tloustkaProstredniMm, sklonDeg:o.sklonDeg, kmod:o.kmod, hustotaKgM3:o.hustotaKgM3 });
        /* účinný počet: řada podél vláken s `sloupcu` svorníky se oslabuje,
           řady nad sebou ne; u lichého počtu má jedna řada o svorník míň */
        var nefCelkem = 0;
        for(var rada = 0; rada < nadSebouT; rada++){
          var vRade = Math.floor(nT/nadSebouT) + (rada < nT % nadSebouT ? 1 : 0);
          if(vRade <= 0) continue;
          nefCelkem += svornikPodklady({ prumerMm:dT, pocetVRade:vRade, uhelKVlaknumDeg:0, hustotaKgM3:o.hustotaKgM3 }).nef;
        }
        var uneseT = nefCelkem * uT.FvRdNaSvornik;
        if(uneseT >= N){
          return pridejTuhost({ prumerMm:dT, nadSebou:nadSebouT, dvojic:sloupcu, celkem:nT, nef:r2(nefCelkem),
            unosnostKN:r2(uneseT), vyuziti:r2(N/uneseT), rozteceMm:pkT.rozteceMm, unosnost:uT,
            jednostrizny:!!o.jednostrizne, typovy:true, silaKN:r2(N),
            popis: nT + "× M" + dT + " (typový spoj PENTI: " + nadSebouT + " nad sebou, " + sloupcu + " za sebou)" });
        }
      }
    }
    /* Vybírá se varianta s NEJMÉNĚ svorníky — každá díra je vrtání, kování
       a oslabený průřez. Při shodě vyhraje menší průměr. Kdyby se prostě
       bral první vyhovující, M16 by se nevybral nikdy a na velké síly by
       aplikace navrhovala osm M12 tam, kde stačí čtyři M16. */
    var lepsiNez = function(a, b){
      if(!b) return true;
      if(a.celkem !== b.celkem) return a.celkem < b.celkem;
      return a.prumerMm < b.prumerMm;
    };

    PRUMERY_SVORNIKU.forEach(function(d){
      var pk = svornikPodklady({ prumerMm:d, hustotaKgM3:o.hustotaKgM3,
        uhelKVlaknumDeg:0 });
      var a2 = pk.rozteceMm.a2, a4c = pk.rozteceMm.a4c, a1 = pk.rozteceMm.a1;
      /* Vejdou se dva nad sebou? */
      var nadSebou = (2*a4c + a2 <= vyskaKlestiny) ? 2 : 1;
      /* Hambálek z boku krokve = jeden kus, jednostřižně (21. 9. 2026). */
      var u = o.jednostrizne
        ? unosnostSvornikuJednostrizne({ prumerMm:d,
            tloustkaHambalkuMm:o.tloustkaKrajniMm, tloustkaKrokveMm:o.tloustkaProstredniMm,
            sklonDeg:o.sklonDeg, kmod:o.kmod, hustotaKgM3:o.hustotaKgM3 })
        : unosnostSvorniku({ prumerMm:d,
            tloustkaKrajniMm:o.tloustkaKrajniMm, tloustkaProstredniMm:o.tloustkaProstredniMm,
            sklonDeg:o.sklonDeg, kmod:o.kmod, hustotaKgM3:o.hustotaKgM3 });
      for(var dvojic=1; dvojic<=4; dvojic++){
        /* Vejdou se dvojice za sebou na délku, která je k dispozici? */
        if((dvojic-1)*a1 + 2*pk.rozteceMm.a3t > delkaNaSvorniky) break;
        var pr = svornikPodklady({ prumerMm:d, pocetVRade:dvojic,
          uhelKVlaknumDeg:0, hustotaKgM3:o.hustotaKgM3 });
        var unese = nadSebou * pr.nef * u.FvRdNaSvornik;
        if(!nejsilnejsi || unese > nejsilnejsi.unosnostKN)
          nejsilnejsi = { prumerMm:d, celkem:nadSebou*dvojic, unosnostKN:r2(unese) };
        if(unese >= N){
          var kand = { prumerMm:d, nadSebou:nadSebou, dvojic:dvojic,
            celkem: nadSebou*dvojic, nef:pr.nef,
            unosnostKN: r2(unese), vyuziti: r2(N/unese),
            rozteceMm: pk.rozteceMm, unosnost: u, jednostrizny: !!o.jednostrizne,
            popis: "" + (nadSebou*dvojic) + "× M" + d
              + (dvojic > 1 ? " (" + nadSebou + " nad sebou × " + dvojic
                  + " za sebou)" : " nad sebou") };
          if(lepsiNez(kand, nejlepsi)) nejlepsi = kand;
          break;                       // víc svorníků téhož průměru netřeba
        }
      }
    });

    if(!nejlepsi){
      return { nevyhovi:true, silaKN:r2(N), nejsilnejsi:nejsilnejsi,
        popis: o.jednostrizne
          ? ("Spoj hambálku s krokví na " + F(N) + " kN nevyhoví: do přesahu "
             + Math.round(delkaNaSvorniky) + " mm se vejde nejvýš "
             + (nejsilnejsi ? (nejsilnejsi.celkem + "× M" + nejsilnejsi.prumerMm + " (" + F(nejsilnejsi.unosnostKN) + " kN)") : "nic")
             + ". Hambálek níž, kleštiny z obou stran, nebo spoj navrhne statik.")
          : ("Ani čtyři dvojice M16 na tenhle spoj nestačí (" + F(N)
             + " kN). Zvětši profil kleštiny, sniž ji, nebo spoj navrhne statik.") };
    }
    nejlepsi.silaKN = r2(N);
    return pridejTuhost(nejlepsi);
  }

  /* Kolik svorníků je potřeba na zadanou sílu. */
  function pocetSvorniku(silaKN, o){
    var u = unosnostSvorniku(o||{});
    var Fd = u.FvRdNaSvornik;
    if(!(Fd > 0)) return null;
    var n = Math.max(1, Math.ceil(Math.abs(silaKN)/Fd));
    /* Účinný počet v řadě — víc svorníků za sebou nese míň než jejich součet. */
    for(var i=0;i<8;i++){
      var pk = svornikPodklady({ prumerMm:u.d, pocetVRade:n,
        uhelKVlaknumDeg:0, hustotaKgM3:(o&&o.hustotaKgM3)||350 });
      if(pk.nef*Fd >= Math.abs(silaKN) - 1e-6) break;
      n++;
    }
    var pk2 = svornikPodklady({ prumerMm:u.d, pocetVRade:n,
      uhelKVlaknumDeg:0, hustotaKgM3:(o&&o.hustotaKgM3)||350 });
    return { pocet:n, nef:pk2.nef, unosnost:u,
             vyuziti: r2(Math.abs(silaKN)/(pk2.nef*Fd)) };
  }

  /* ══ PÁSEK ════════════════════════════════════════════════════════════
     Statik odsouhlasil model (metodika, otázka E): tlačená vzpěra pod 45°
     mezi sloupkem a vaznicí, posuzovaná na vzpěr po vlastní délce.

     JAK SE URČÍ SÍLA. Pásek podepře vaznici ve vzdálenosti `a` (náběh) od
     sloupku. Na bezpečné straně se uvažuje, že přebírá zatížení vaznice
     na délce jednoho náběhu:

         V = w_p · a          svislá složka [kN]
         N = V / sin 45° = V·√2   osová síla ve vzpěře

     Délka pásku mezi dosedy je L = a·√2 a na ni se počítá vzpěr.

     PROČ TO STAČÍ NA NABÍDKU. Přesná síla vychází z rámové soustavy
     sloupek–pásek–vaznice a je zpravidla menší, protože část zatížení jde
     přímo do sloupku. Tenhle odhad tedy nadhodnocuje, ne naopak.

     OTLAČENÍ V DOSEDU. Pásek tlačí do vaznice i do sloupku pod 45° k
     vláknům. Pevnost se interpoluje Hankinsonovým vztahem mezi f_c,0,d
     a f_c,90,d (EN 1995-1-1, čl. 6.2.2):

         f_c,α,d = f_c,0,d / [ (f_c,0,d/(k_c,90·f_c,90,d))·sin²α + cos²α ]
     ══════════════════════════════════════════════════════════════════════ */
  function posudekPasku(o){
    var f = navrhovePevnosti(o.trida, o.kmod);
    var pr = o.profil || { b:120, h:120 };
    var a = +o.nabehM || 0;                 // vodorovný náběh od sloupku
    if(!(a > 0.05)) return [];
    var wp = Math.abs(+o.wp || 0);          // zatížení vaznice [kN/m]
    var V = wp * a;                         // svislá složka
    var N = V * Math.SQRT2;                 // osová síla ve vzpěře (45°)
    var L = a * Math.SQRT2;                 // délka pásku mezi dosedy

    var vz = soucinitelVzperu(pr.b, pr.h, L, o.trida);
    var sig = N*1000/(pr.b*pr.h);
    var radky = [ radek("Pásek — tlak + vzpěr",
      "σ_c,0,d/(k_c·f_c,0,d) ≤ 1",
      "V = w_p·a = " + F(wp) + "·" + F(a) + " = " + F(V) + " kN; N = V·√2 = "
      + F(N) + " kN; ℓ = " + F(L) + " m, λ = " + Math.round(vz.lam)
      + ", k_c = " + F(vz.kc) + " → σ = " + F(sig) + " N/mm²; limit = "
      + F(vz.kc*f.fc0d),
      sig/(vz.kc*f.fc0d)) ];

    /* Otlačení v dosedu pod 45° — Hankinson. */
    var kc90 = 1.5;
    var s2 = 0.5, c2 = 0.5;                 // sin²45° = cos²45° = 0,5
    var fcAlfa = f.fc0d / ((f.fc0d/(kc90*f.fc90d))*s2 + c2);
    /* Dosedová plocha: čelo pásku seříznuté pod 45°. */
    var Adosed = pr.b * pr.h * Math.SQRT2;
    var sigD = N*1000/Adosed;
    radky.push(radek("Pásek — otlačení v dosedu pod 45°",
      "σ_c,α,d ≤ f_c,α,d  (Hankinson)",
      "A = " + pr.b + "·" + pr.h + "·√2 = " + Math.round(Adosed)
      + " mm² → σ = " + F(sigD) + " N/mm²; f_c,45,d = " + F(fcAlfa)
      + " (mezi f_c,0,d " + F(f.fc0d) + " a k_c,90·f_c,90,d "
      + F(kc90*f.fc90d) + ")",
      sigD/fcAlfa));
    return radky;
  }

  /* ══ ROZPĚR VAZBY A SÍLA V KLEŠTINĚ ═══════════════════════════════════
     Statik odsouhlasil, že kleštiny berou rozpěr (metodika, otázka D).
     Síla se odvodí z rovnováhy jedné krokve, ne z tabulky.

     ZNAČENÍ. Vazba je symetrická: pata krokve v A (0,0), hřeben v C na
     vodorovné vzdálenosti L/2 a výšce H nad pozednicí. L je vodorovný
     rozpon celé vazby. Kleština je vodorovné táhlo ve výšce h nad
     pozednicí. Zatížení w je na běžný metr VODOROVNÉHO průmětu.

     ODVOZENÍ. Svislá reakce v patě je V = w·L/2. Momentová podmínka ke
     hřebeni pro levou krokev:

         V·(L/2) − w·(L/2)·(L/4) − T·(H − h) = 0
         T = (w·L²/8) / (H − h)

     KONTROLA: pro h = 0 (táhlo až u pozednice, tedy vazný trám) vyjde
     klasický rozpěr T = w·L²/(8·H). Sedí.

     KOLIK ZBYDE NA VĚNEC. Z vodorovné rovnováhy téže krokve vychází, že
     síla od druhé krokve v hřebeni je také T, takže v patě zbyde nula:
     ideální táhlo převezme rozpěr celý. Do věnce tedy jde jen to, co
     kleština nepřevezme — u tuhého spoje prakticky nic.

     BEZ KLEŠTIN je to jiné. Když krokve leží na vrcholové vaznici, jsou
     to prosté nosníky a rozpěr nevzniká vůbec. Když vaznice není a
     kleštiny taky ne, jde do pozednice celý rozpěr w·L²/(8·H).
     ══════════════════════════════════════════════════════════════════════ */
  function rozperVazby(o){
    var w = +o.wh || 0;                       // kN/m vodorovného průmětu
    var L = +o.rozponVodorovnyM || 0;         // celá vazba
    var H = +o.vyskaHrebeneM || 0;            // hřeben nad pozednicí
    if(!(w > 0) || !(L > 0.3) || !(H > 0.1)) return null;

    var moment = w*L*L/8;                     // kNm
    /* Vrcholová vaznice = svislá podpora v hřebeni → žádný rozpěr. */
    if(o.maVrcholovouVaznici){
      return { moment:r3(moment), maTahlo:false, rozperCelkovyKNm:0,
        silaVKlestineKN:0, doVenceKNm:0,
        popis:"Krokve leží na vrcholové vaznici, takže se chovají jako "
          + "prosté nosníky a rozpěr nevzniká." };
    }

    var rozperCely = moment / H;              // kN na vazbu (bez táhla)
    var h = +o.vyskaKlestinyM || 0;
    var maTahlo = !!o.maKlestiny && h > 0.05 && h < H - 0.05;

    if(!maTahlo){
      return { moment:r3(moment), maTahlo:false,
        rozperCelkovyKNm:r3(rozperCely), silaVKlestineKN:0,
        doVenceKNm:r3(rozperCely),
        popis: o.maKlestiny
          ? "Kleštiny jsou zadané, ale jejich výška je mimo rozsah vazby — "
            + "rozpěr se počítá, jako by táhlo nebylo."
          : "Bez táhla jde celý rozpěr do pozednice a věnce." };
    }

    var T = moment / (H - h);                 // kN na vazbu
    return {
      moment:r3(moment), maTahlo:true,
      vyskaKlestinyM:r3(h), vyskaHrebeneM:r3(H),
      rozperCelkovyKNm:r3(rozperCely),
      silaVKlestineKN:r3(T),
      /* Ideální táhlo převezme rozpěr celý; do věnce nejde nic. */
      doVenceKNm:0,
      popis:"Kleština ve výšce " + F(h) + " m převezme rozpěr celý; "
        + "do věnce nejde nic. Bez ní by v patě působilo "
        + F(rozperCely) + " kN na vazbu."
    };
  }

  /* KLEŠTINA — tah rovnoběžně s vlákny na OSLABENÉM průřezu.
     Díra pro svorník ubírá z výšky; u dvou kleštin se síla dělí na dvě. */
  function posudekKlestiny(o){
    var f = navrhovePevnosti(o.trida, o.kmod);
    var b = (o.profil && o.profil.b) || 60, h = (o.profil && o.profil.h) || 160;
    var kusu = o.kusu || 2;                   // dvě kleštiny na krokev
    var dDira = o.prumerSvornikuMm || 12;
    var Anet = b * (h - dDira) * kusu;         // mm²
    var N = Math.abs(+o.silaKN || 0);
    var sig = N*1000/Anet;
    /* TLAČENÁ KLEŠTINA (rám vazby, 13. 10. 2026): kleština může krokve
       rozpírat — pak je v tlaku a každá fošna se může vybočit mezi spoji
       (vzpěr kolem slabé osy b na délku mezi svorníky). Posoudí se, jen
       když volající dá záporné silaKN a vzpěrnou délku. */
    if(+o.silaKN < 0 && o.vzpernaDelkaM > 0){
      var vz = soucinitelVzperu(b, h, o.vzpernaDelkaM, o.trida);
      var sc = N*1000/(b*h*kusu);
      return [ radek("Kleština — tlak + vzpěr (každá fošna mezi spoji)",
        "σ_c,0,d/(k_c·f_c,0,d) ≤ 1",
        "N = " + F(N) + " kN (tlak, z rámu vazby); " + kusu + "×" + b + "×" + h + " mm; L = " + F(o.vzpernaDelkaM) + " m, λ = " + Math.round(vz.lam)
        + ", k_c = " + F(vz.kc) + " → σ = " + F(sc) + " N/mm²; limit = " + F(vz.kc*f.fc0d),
        sc/(vz.kc*f.fc0d)) ];
    }
    return [ radek("Kleština — tah podél vláken",
      "σ_t,0,d = N/A_net ≤ f_t,0,d",
      "N = " + F(N) + " kN; A_net = " + kusu + "×" + b + "×(" + h + "−"
      + dDira + ") = " + Math.round(Anet) + " mm² → σ = " + F(sig)
      + " N/mm²; f_t,0,d = " + F(f.ft0d),
      sig/f.ft0d) ];
  }

  /* ══ ZÓNY VĚTRU NA STŘEŠE ═════════════════════════════════════════════
     EN 1991-1-4, čl. 7.2.5. Sání není po střeše stejné: u okapů a u štítů
     se proud odtrhne a saje mnohem víc než uprostřed. Norma proto dělí
     střechu na pásy F, G, H (návětrná polovina) a I, J (závětrná).

     ŠÍŘKA OKRAJOVÉHO PÁSU

         e = min(b ; 2h)

     kde b je rozměr kolmo na směr větru a h výška budovy k hřebeni.
     Z ní se odvodí rozsahy:

         F — rohy u okapu:      šířka e/4 od každého štítu, hloubka e/10
         G — okap mezi rohy:    zbytek okapní hrany,        hloubka e/10
         H — zbytek návětrné poloviny až k hřebeni
         J — pás u hřebene na závětrné straně, hloubka e/10
         I — zbytek závětrné poloviny

     TADY SE POČÍTÁ JEN GEOMETRIE. Součinitele c_pe pro jednotlivé zóny
     se liší podle sklonu a směru větru a jsou v tabulkách 7.4a a 7.4b;
     do aplikace se doplní až je potvrdí statik (viz metodika). Do té doby
     se dál počítá obálkou nejnepříznivější zóny přes celou střechu — je
     to na bezpečné straně, jen z toho vychází víc kotev, než je nutné.
     ══════════════════════════════════════════════════════════════════════ */
  function zonyVetru(o){
    var b = +o.sirkaKolmoM || 0;      // rozměr kolmo na vítr [m]
    var h = +o.vyskaBudovyM || 0;     // výška k hřebeni [m]
    var okap = +o.delkaOkapuM || 0;   // délka okapní hrany roviny [m]
    var spad = +o.delkaSpaduM || 0;   // délka roviny po spádu [m]
    if(!(b > 0.1) || !(h > 0.1) || !(okap > 0.1) || !(spad > 0.1)) return null;

    var e = Math.min(b, 2*h);
    var pasF = e/4;                   // šířka rohového pásu u každého štítu
    var hloubka = e/10;               // hloubka pásu od okapu i od hřebene

    /* Rohy se nesmí přeložit — u úzké střechy zabere F celý okap. */
    var sirkaF = Math.min(pasF, okap/2);
    var sirkaG = Math.max(0, okap - 2*sirkaF);
    var hlObvod = Math.min(hloubka, spad);
    var zbytek = Math.max(0, spad - hlObvod);

    var pl = function(s, d){ return r3(Math.max(0, s)*Math.max(0, d)); };
    return {
      e: r2(e), sirkaPasuF: r2(sirkaF), hloubkaPasu: r2(hlObvod),
      zony: [
        { kod:"F", nazev:"rohy u okapu", sirkaM:r2(2*sirkaF),
          hloubkaM:r2(hlObvod), plochaM2:pl(2*sirkaF, hlObvod) },
        { kod:"G", nazev:"okap mezi rohy", sirkaM:r2(sirkaG),
          hloubkaM:r2(hlObvod), plochaM2:pl(sirkaG, hlObvod) },
        { kod:"H", nazev:"zbytek roviny", sirkaM:r2(okap),
          hloubkaM:r2(zbytek), plochaM2:pl(okap, zbytek) }
      ],
      /* Kotvení pozednice leží v okapním pásu, tedy v F a G. */
      pozedniceVZonach: [
        { kod:"F", delkaM:r2(2*sirkaF) },
        { kod:"G", delkaM:r2(sirkaG) }
      ],
      poznamka: "Rozsahy zón podle EN 1991-1-4, čl. 7.2.5. Součinitele c_pe "
        + "zatím nejsou po zónách rozlišené — počítá se obálkou nejhorší "
        + "zóny přes celou střechu, tedy na bezpečné straně."
    };
  }

  /* ══ KOTVENÍ POZEDNICE DO VĚNCE ═══════════════════════════════════════
     Do 18. 8. 2026 se kotvy kladly natvrdo po metru (u vaznicových soustav
     po dvou). Nebylo to z čeho spočítat, protože chyběla kombinace na
     nadzvednutí. Teď je.

     CO POZEDNICI DRŽÍ A CO JI TRHÁ. Vítr nad střechou saje; když je sání
     větší než vlastní tíha, celá střecha táhne pozednici vzhůru a drží ji
     jen kotvy. Na běžný metr pozednice připadá:

         f_tah,d = q_tah,d · b_zat        [kN/m]

     kde q_tah,d je z kombinace KZ3 (1,0·G + 1,5·W_sání) a b_zat je pruh
     střechy, který pozednice nese — vodorovně půlka prvního pole krokve.

     ÚNOSNOST KOTVY se bere z ETA-20/0867 (Hilti HUS4-H ⌀10), hodnoty pro
     BETON S TRHLINAMI, protože věnec je ohýbaný prvek a v tažené oblasti
     trhliny vzniknou. Při h_ef 59,5 mm (což odpovídá hloubce vrtání 75 mm,
     se kterou aplikace počítá) je N_Rd = 10,5 kN a V_Rd = 21,1 kN.

     Hodnoty platí pro beton C20/25, jednotlivou kotvu bez vlivu okraje,
     minimální tloušťku podkladu a vrtání příklepem. Proto se kontroluje
     výška věnce (aspoň 130 mm) a vzdálenost od hrany (aspoň 40 mm) —
     když nesedí, posudek to řekne a nepočítá dál, jako by platily.
     ══════════════════════════════════════════════════════════════════════ */
  var KOTVA_HUS4H10 = {
    nazev: "Hilti HUS4-H ⌀10", eta: "ETA-20/0867",
    hef: 59.5, hnom: 75, hmin: 130, smin: 40, cmin: 40,
    NRd_trhliny: 10.5, VRd_trhliny: 21.1,
    NRd_bez: 14.7, VRd_bez: 23.0
  };
  var ROZTEC_KOTEV_MAX = 1.5;      // m — dál od sebe se pozednice zvedá mezi kotvami
  var ROZTEC_KOTEV_MIN = 0.15;     // m — blíž než 150 mm nemá smysl vrtat

  function kotveniPozednice(o){
    var K = KOTVA_HUS4H10;
    var strhlinami = (o.betonSTrhlinami !== false);
    var NRd = strhlinami ? K.NRd_trhliny : K.NRd_bez;
    var VRd = strhlinami ? K.VRd_trhliny : K.VRd_bez;
    var chyby = [], radky = [];

    /* Tah na běžný metr pozednice. Záporné = střecha drží sama tíhou. */
    var bZat = +o.zatezovaciSirkaM || 0;
    var fTah = (+o.qTahUls || 0) * bZat;             // kN/m
    /* Vodorovná síla (rozpěr) na běžný metr — smyk v kotvě. */
    var fSmyk = Math.abs(+o.vodorovnaSilaKNm || 0);

    /* Podmínky platnosti tabulkových hodnot. */
    if(o.vyskaVenceMm != null && o.vyskaVenceMm < K.hmin)
      chyby.push("Věnec je vysoký " + Math.round(o.vyskaVenceMm) + " mm, ale "
        + "únosnost kotvy " + K.nazev + " platí od " + K.hmin + " mm. "
        + "Kotvení je nutné posoudit zvlášť.");
    if(o.odHranyMm != null && o.odHranyMm < K.cmin)
      chyby.push("Kotva by byla " + Math.round(o.odHranyMm) + " mm od hrany "
        + "věnce, minimum je " + K.cmin + " mm.");

    /* Když střecha netáhne vzhůru, rozhoduje montážní pravidlo, ne výpočet. */
    var rozhodujeTah = fTah > 0.01;
    var sTah = rozhodujeTah ? (NRd / fTah) : ROZTEC_KOTEV_MAX;
    var sSmyk = (fSmyk > 0.01) ? (VRd / fSmyk) : ROZTEC_KOTEV_MAX;
    /* Interakce tahu a smyku — lineárně, na bezpečné straně (do potvrzení
       statikem; EN 1992-4 připouští pro beton exponent 1,5). */
    var sInterakce = (rozhodujeTah || fSmyk > 0.01)
      ? 1 / (fTah/NRd + fSmyk/VRd) : ROZTEC_KOTEV_MAX;
    if(!(sInterakce > 0)) sInterakce = ROZTEC_KOTEV_MAX;

    var s = Math.min(ROZTEC_KOTEV_MAX, sTah, sSmyk, sInterakce);
    /* Zaokrouhlení DOLŮ na 50 mm — nahoru by se překročila únosnost. */
    var sNavrh = Math.max(ROZTEC_KOTEV_MIN, Math.floor(s*20)/20);

    radky.push(radek("Kotvení pozednice — tah z nadzvednutí",
      "n = f_tah,d · s / N_Rd ≤ 1",
      "q_tah,d = " + F(o.qTahUls) + " kN/m²; b_zat = " + F(bZat)
      + " m → f_tah,d = " + F(fTah) + " kN/m; při rozteči " + F(sNavrh)
      + " m je N_Ed = " + F(fTah*sNavrh) + " kN; N_Rd = " + F(NRd) + " kN",
      (fTah*sNavrh)/NRd));
    if(fSmyk > 0.01)
      radky.push(radek("Kotvení pozednice — smyk z rozpěru",
        "V_Ed = f_h,d · s ≤ V_Rd",
        "f_h,d = " + F(fSmyk) + " kN/m → V_Ed = " + F(fSmyk*sNavrh)
        + " kN; V_Rd = " + F(VRd) + " kN", (fSmyk*sNavrh)/VRd));
    if(rozhodujeTah && fSmyk > 0.01)
      radky.push(radek("Kotvení pozednice — tah a smyk společně",
        "N_Ed/N_Rd + V_Ed/V_Rd ≤ 1",
        F(fTah*sNavrh) + "/" + F(NRd) + " + " + F(fSmyk*sNavrh) + "/" + F(VRd),
        (fTah*sNavrh)/NRd + (fSmyk*sNavrh)/VRd));

    return {
      kotva: K, betonSTrhlinami: strhlinami, NRd: NRd, VRd: VRd,
      zatezovaciSirkaM: r3(bZat),
      tahKNm: r3(fTah), smykKNm: r3(fSmyk),
      nadzvedava: rozhodujeTah,
      roztecM: r3(sNavrh),
      roztecZTahu: r3(Math.min(ROZTEC_KOTEV_MAX, sTah)),
      rozhoduje: !rozhodujeTah ? "montážní maximum"
               : (sInterakce < sTah - 0.001 ? "tah a smyk společně" : "tah"),
      radky: radky, chyby: chyby
    };
  }

  /* Souhrn — nejvyšší využití a co rozhoduje. */
  function souhrn(radky){
    if(!radky || !radky.length) return null;
    var nej = radky.reduce(function(a,r){ return r.vyuziti>a.vyuziti?r:a; }, radky[0]);
    return { radky:radky, maxVyuziti:nej.vyuziti, rozhoduje:nej.nazev,
             vyhovuje: radky.every(function(r){ return r.vyhovuje; }) };
  }

  /* ══ SPOJITÝ NOSNÍK ═══════════════════════════════════════════════════
     Vaznice neleží na dvou podporách, ale na řadě sloupků. Dosud se počítala
     jako prostý nosník `M = wL²/8`, což ji přes čtyři podpory předimenzuje
     asi o čtvrtinu. Tady se spočítá doopravdy (zadání PENTI 14. 8. 2026).

     Používá se rámový řešič z jádra (`solveFrame2D`) — nosník se položí na
     přímku, do každé podpory se zamkne svislý posun a spojité zatížení se
     rozpustí do uzlů, přesně jako to dělá hambálkový model.

     Vrací i POLOHY NULOVÉHO MOMENTU. Tam patří spoj při dělení vaznice:
     spoj v nulovém momentu není namáhaný ohybem a může být jednoduchý.
     ══════════════════════════════════════════════════════════════════════ */
  function spojityNosnik(o){
    var pole = (o.pole||[]).filter(function(x){ return x>0.01; });
    if(pole.length < 1) return null;
    var w = o.w || 0;                       // spojité zatížení [kN/m]
    var EI = o.EI || 1, EA = o.EA || 1e6;
    var solver = o.solver
      || (typeof global.PentiEngine !== "undefined" && global.PentiEngine.solveFrame2D);
    if(!solver) return null;

    /* Prostý nosník o jednom poli řešič nepotřebuje — a i kdyby, výsledek
       je stejný. Necháváme ho projít stejnou cestou kvůli jednotnosti. */
    var DILKU = 12;                         // dílků na pole; víc už nic nezmění
    var uzly = [], podpory = [], x = 0;
    uzly.push([0,0]); podpory.push(0);
    pole.forEach(function(L){
      for(var i=1;i<=DILKU;i++) uzly.push([x + L*i/DILKU, 0]);
      x += L;
      podpory.push(uzly.length-1);
    });
    var prvky = [];
    for(var i=0;i<uzly.length-1;i++) prvky.push({a:i, b:i+1, EA:EA, EI:EI});

    /* Podpory: svislý posun všude, vodorovný jen v první (jinak by nosník
       ujel do strany a řešič by neměl co počítat). */
    var fixed = [0];                        // ux prvního uzlu
    podpory.forEach(function(i){ fixed.push(i*3+1); });

    /* Spojité zatížení → uzlové síly podle přilehlé poloviny dílků.
       `wFn(x)` dovolí zatížení proměnné po délce — nárožní krokev nese
       trojúhelník, který k hřebeni roste. Bez ní platí konstantní `w`. */
    var wFn = o.wFn || function(){ return w; };
    var loads = {};
    for(var i=0;i<uzly.length;i++){
      var xp = i>0 ? uzly[i-1][0] : uzly[i][0];
      var xn = i<uzly.length-1 ? uzly[i+1][0] : uzly[i][0];
      var trib = (uzly[i][0]-xp)/2 + (xn-uzly[i][0])/2;
      loads[i*3+1] = -(wFn(uzly[i][0])*trib);
    }
    var r = solver(uzly, prvky, fixed, loads);

    /* Momentová čára: na každém uzlu moment z konce prvku.
       Znaménko sjednotíme tak, aby PROVĚS byl kladný. */
    var M = [];
    for(var i=0;i<prvky.length;i++){
      if(i===0) M.push({ x:uzly[0][0], M:-r.forces[i][2] });
      M.push({ x:uzly[i+1][0], M:r.forces[i][5] });
    }
    var Mmax = 0, Mmin = 0;
    M.forEach(function(b){ if(b.M>Mmax) Mmax=b.M; if(b.M<Mmin) Mmin=b.M; });

    /* Největší posouvající síla — pro posudek ve smyku. */
    var Vmax = 0;
    for(var i=0;i<prvky.length;i++){
      var v1 = Math.abs(r.forces[i][1]), v2 = Math.abs(r.forces[i][4]);
      if(v1 > Vmax) Vmax = v1;
      if(v2 > Vmax) Vmax = v2;
    }

    /* Průhyb — největší svislý posun mezi podporami. */
    var prohyb = 0;
    for(var i=0;i<uzly.length;i++){
      var uy = Math.abs(r.u[i*3+1]);
      if(uy > prohyb) prohyb = uy;
    }

    /* NULOVÉ MOMENTY — kde momentová čára protne nulu.
       Konce nosníku se nepočítají: tam je moment nulový vždycky a spoj
       na konci prvku nedává smysl. */
    var nuly = [];
    for(var i=1;i<M.length;i++){
      var a2=M[i-1], b2=M[i];
      if((a2.M<0 && b2.M>0) || (a2.M>0 && b2.M<0)){
        var t = Math.abs(a2.M)/(Math.abs(a2.M)+Math.abs(b2.M));
        var xn = Math.round((a2.x + (b2.x-a2.x)*t)*1000)/1000;
        if(xn > 0.05 && xn < x - 0.05) nuly.push(xn);
      }
    }

    var Lref = Math.max.apply(null, pole);
    return {
      pole: pole.slice(), poli: pole.length, delka: x,
      podporyX: podpory.map(function(i){ return uzly[i][0]; }),
      Mpole: Math.abs(Mmax), Mpodpora: Math.abs(Mmin),
      Mmax: Math.max(Math.abs(Mmax), Math.abs(Mmin)),
      Vmax: Vmax,
      /* reakce v podporách na zadané zatížení (2026.10.191 — styky vaznice
         nad zvolenými podporami skládají nosník z kusů a reakce sčítají) */
      reakceX: podpory.map(function(i){ return Math.abs((r.R && r.R[i*3+1]) || 0); }),
      prohybM: prohyb,
      nulovyMoment: nuly,
      /* Součinitele, které se dají rovnou dosadit do posudku vaznice. */
      soucinitelM: (w>0 && Lref>0) ? Math.max(Math.abs(Mmax),Math.abs(Mmin))/(w*Lref*Lref) : 1/8,
      soucinitelW: (w>0 && Lref>0) ? prohyb*EI/(w*Math.pow(Lref,4)) : 5/384,
      Lref: Lref
    };
  }

  /* ══ DĚLENÍ VAZNICE ═══════════════════════════════════════════════════
     Vaznice bývá delší, než je nejdelší dodávaný kus, takže se musí někde
     nastavit. Spoj patří do NULOVÉHO MOMENTU — tam vaznice není namáhaná
     ohybem a spoj může být jednoduchý (rozhodnuto PENTI 14. 8. 2026).

     Nejhorší možné místo je nad podporou: tam je moment největší. Spoj
     uprostřed pole je skoro stejně špatný.

     Postup: jde se od začátku a vždycky se vezme NEJVZDÁLENĚJŠÍ nulový
     moment, na který ještě dosáhne nejdelší dodávaný kus. Tím vznikne
     nejmíň spojů. Když v dosahu žádný není, spoj se udělá nouzově na
     hranici délky a řekne se to.
     ══════════════════════════════════════════════════════════════════════ */
  function deleniVaznice(o){
    var L = o.delka || 0;
    var maxKus = o.maxDelka || 13;
    var nuly = (o.nulovyMoment || []).slice().sort(function(a,b){ return a-b; });
    var podpory = o.podpory || [];
    if(!(L > 0.05)) return null;
    /* ŘEZNÁ DÉLKA KUSU I S PLÁTEM (PENTI 2. 11. 2026, 2026.10.200): kus
       přesahuje osu spoje o ½ plátu na každém konci, který končí ve spoji.
       Dřív se hlídala jen délka mezi osami — kus pak vyšel 13,257 m a z 13m
       tyče nešel. `pulPlatuM` = ½ délky spoje v nulovém momentu,
       `pulNouzovyM` = ½ hákového plátu (nouzový spoj je vždy hákový). */
    var pulN = +o.pulPlatuM || 0, pulH = (o.pulNouzovyM != null) ? (+o.pulNouzovyM || 0) : pulN;

    /* Vejde se celá — nedělí se. */
    if(L <= maxKus + 1e-9){
      return { deli:false, kusy:[{ od:0, do:r3(L), delka:r2(L) }], spoje:[],
               maxDelka:maxKus, delka:r2(L),
               poznamka:"Vaznice se vejde v jednom kuse, dělit se nemusí." };
    }

    var kusy = [], spoje = [], x = 0, nouzovych = 0, pojistka = 0, pulZac = 0;
    while(L - x + pulZac > maxKus + 1e-9 && pojistka++ < 50){
      /* Nejvzdálenější nulový moment v dosahu — a zároveň dost daleko,
         aby kus nebyl směšně krátký. Dosah = nejdelší kus minus plát na
         začátku (z předchozího spoje) a na konci (tento spoj). */
      var cil = null;
      nuly.forEach(function(n){
        if(n > x + 0.3 && n <= x + maxKus - pulZac - pulN + 1e-9) cil = n;
      });
      var nouzovy = (cil === null);
      if(nouzovy){ cil = r3(x + maxKus - pulZac - pulH); nouzovych++; }
      kusy.push({ od:r3(x), do:r3(cil), delka:r2(cil - x) });
      /* Jak daleko je spoj od nejbližší podpory — tesaře to zajímá. */
      var kPodpore = podpory.length
        ? Math.min.apply(null, podpory.map(function(p){ return Math.abs(cil-p); }))
        : null;
      spoje.push({ x:r3(cil), nouzovy:nouzovy,
                   odPodpory: kPodpore!=null ? r2(kPodpore) : null });
      x = cil; pulZac = nouzovy ? pulH : pulN;
    }
    kusy.push({ od:r3(x), do:r3(L), delka:r2(L - x) });

    var pozn;
    if(nouzovych === 0)
      pozn = "Všechny spoje leží v nulovém momentu — nejsou namáhané ohybem "
           + "a stačí jednoduché přeplátování.";
    else
      pozn = nouzovych + " spoj"+(nouzovych>1?"e":"")+" se nevešl"
           + (nouzovych>1?"y":"") + " do nulového momentu a musel"
           + (nouzovych>1?"y":"") + " se udělat na hranici délky kusu — "
           + "tam už je vaznice ohybem namáhaná, spoj musí být tuhý.";

    return { deli:true, kusy:kusy, spoje:spoje, nouzovych:nouzovych,
             maxDelka:maxKus, delka:r2(L), poznamka:pozn };
  }

  /* ══ DĚLENÍ NAD PODPORAMI — VAZNICE JAKO PROSTÉ NOSNÍKY (1. 10. 2026) ══
     PENTI: „Vaznice jsou asi počítány jako spojité nosníky, šlo by je
     volitelně počítat jako prosté nosníky a dělit je nad podporami?"
     Každé pole je samostatný nosník, spoj je nad KAŽDOU vnitřní podporou
     (tam je u prostého nosníku moment nulový). Kus = jedno pole. Když je
     pole delší než nejdelší manipulovatelný kus, řekne se to — dělit
     uprostřed pole by bylo nejhorší místo. */
  function deleniNadPodporami(o){
    var L = o.delka || 0, maxKus = o.maxDelka || 13, pul = +o.pulPlatuM || 0;   // ½ plátu nad podporou (2026.10.200)
    if(!(L > 0.05)) return null;
    var vnitrni = (o.podpory || []).filter(function(x){ return x > 0.05 && x < L - 0.05; })
      .sort(function(a,b){ return a-b; });
    var hranice = [0].concat(vnitrni, [L]);
    var kusy = [], spoje = [], prilisDlouhych = 0;
    for(var i = 0; i + 1 < hranice.length; i++){
      var dk = hranice[i+1] - hranice[i];
      var rez = dk + (i > 0 ? pul : 0) + (i + 2 < hranice.length ? pul : 0);   // řezná délka i s pláty
      if(rez > maxKus + 1e-9) prilisDlouhych++;
      kusy.push({ od:r3(hranice[i]), do:r3(hranice[i+1]), delka:r2(dk) });
    }
    vnitrni.forEach(function(x){
      spoje.push({ x:r3(x), nouzovy:false, odPodpory:0, nadPodporou:true });
    });
    var pozn = spoje.length
      ? ("Prosté nosníky: " + spoje.length + " spoj" + (spoje.length>1?(spoje.length<5?"e":"ů"):"")
         + " nad podporami, kde je moment nulový — jednoduchý plát.")
      : "Jedno pole — vaznice je prostý nosník v jednom kuse.";
    if(prilisDlouhych)
      pozn += " " + prilisDlouhych + " pole je delší než " + maxKus + " m — kus se nedá "
            + "dodat v jednom; zvažte hustší podpory.";
    return { deli: spoje.length > 0, model:"prosty", kusy:kusy, spoje:spoje,
             nouzovych:0, prilisDlouhych:prilisDlouhych,
             maxDelka:maxKus, delka:r2(L), poznamka:pozn };
  }

  function r3(x){ return Math.round((x||0)*1000)/1000; }
  function r2(x){ return Math.round((x||0)*100)/100; }

  /* ══ SPOJ KROKEV–POZEDNICE NA SÁNÍ VĚTRU (PENTI 21. 9. 2026) ═══════════
     Otázka PENTI: „Počítají se u hambálkového krovu vodorovné reakce
     působící na zdivo a pozednici a také kotvení krokví do pozednice?"
     Vodorovné reakce ano (rozperVazby), kotvení pozednice ano
     (kotveniPozednice), ale spoj KROKVE s pozednicí se do té doby jen
     počítal na kusy ve spojováku — jeden tesařský vrut na styk, bez
     posudku. Tady se posuzuje.

     CO VRUT DRŽÍ. Rozpěr (vodorovnou sílu) přenáší čelo osedlání
     otlačením, vrut na něj není. Vrut drží krokev proti NADZVEDNUTÍ
     sáním větru — kombinace KZ3 (1,0·G + 1,5·W sání) dává q_tah,d na m²
     půdorysu; když je záporné, střecha drží tíhou a vrut je montážní.

     SÍLA NA JEDEN SPOJ. Reakce krokve na pozednici z nadzvednutí: převislý
     konec (přesah a) jde do pozednice celý, z prvního pole L₁ půlka, a k
     tomu přírůstek z převislého konce (nosník s převislým koncem):

         N_Ed = q_tah,d · s · (a + L₁/2 + a²/(2·L₁))       [kN]

     ÚNOSNOST podle ČSN EN 1995-1-1, čl. 8.7.2 (vruty namáhané osově):
       vytažení ze spodního prvku (pozednice), vrut kolmo k jejím vláknům,
       takže úhlový součinitel (1,2·cos²α + sin²α) = 1:
         f_ax,k  = 0,52 · d^−0,5 · l_ef^−0,1 · ρ_k^0,8     [N/mm²]  (8.39)
         F_ax,Rk = f_ax,k · d · l_ef · k_d,  k_d = min(d/8; 1)      (8.38)
       l_ef = zavrtání do pozednice bez špičky (délka − výška krokve − d),
       nejvýš výška pozednice − d.
       protažení hlavy krokví: F_head,Rk = f_head,k · d_h² · (ρ_k/ρ_a)^0,8.
       Hodnoty f_head,k a d_h dává ETA výrobce — pro Hilti S-WWP-Z je tu
       zatím KONZERVATIVNÍ ODHAD (f_head,k = 10 N/mm², d_h = 2·d) označený
       v protokolu; jakmile bude ETA k ruce, dosadí se.
       Více vrutů: n_ef = n^0,9 (čl. 8.7.2(8)).
       Návrhově F_Rd = k_mod · F_Rk / γ_M, k_mod = 0,9 jako u KZ3
       v této aplikaci (na bezpečné straně proti 1,1 pro okamžikové
       zatížení), γ_M = 1,3 pro spoje.

     NÁVRH. Zkouší se kandidáti vrutů v pořadí od volajícího (nejlevnější
     první) s 1 až `maxVrutu` kusy na styk; první vyhovující se vezme.
     Když nevyhoví nic, protokol řekne, že spoj potřebuje úhelník — to už
     je mimo rozsah kalkulačky.
     ══════════════════════════════════════════════════════════════════════ */
  var VRUT_SWWP = {
    nazev: "Hilti S-WWP-Z (talířová hlava)",
    fHeadK: 10,          // N/mm² — odhad, doplnit z ETA
    dHlavyNasobek: 2,    // d_h = 2·d — odhad, doplnit z ETA
    etaDoplnit: true
  };
  function posudekSpojeKrokvePozednice(o){
    var q = +o.qTahUls || 0;                    // kN/m² půdorysu, + = nadzvedává
    var s = +o.roztecKrokvi || 0.9;
    var a = Math.max(0, +o.presahM || 0);
    var L1 = +o.prvniPoleM || 0;
    var radky = [];
    var vzorecN = "N_Ed = q_tah,d · s · (a + L₁/2 + a²/(2·L₁))";
    if(!(L1 > 0.1)) return null;
    if(!(q > 0.01)){
      radky.push(radek("Kotvení krokve k pozednici — vytažení vrutu při sání", vzorecN,
        "q_tah,d = " + F(q) + " kN/m² ≤ 0 — střecha se nenadzvedává, vrut je jen montážní", 0));
      return { nadzvedava:false, NEdKN:0, vrutuNaStyk:1, vyhovuje:true, nevyhovi:false,
               radky:radky, popis:"Střecha se nenadzvedává, vrut krokve je montážní." };
    }
    var NEd = q * s * (a + L1/2 + a*a/(2*L1));  // kN na spoj
    var rho = +o.hustotaKgM3 || 350, kmod = (o.kmod != null) ? o.kmod : 0.9, gM = o.gM || 1.3;
    var hK = +o.hKrokveMm || 180, hP = +o.hPozedniceMm || 160;
    var maxVrutu = o.maxVrutu || 2;
    var kandidati = (o.vruty && o.vruty.length) ? o.vruty : [{ d:8, delkaMm: hK + 48 }];
    var volba = null, nejlepsi = null;      // nejlepsi = nejnižší využití, když nic nevyhoví
    for(var i = 0; i < kandidati.length && !volba; i++){
      var vr = kandidati[i], d = +vr.d, delka = +vr.delkaMm;
      if(!(d >= 6) || !(delka > hK)) continue;
      var zavrtani = delka - hK;
      var lef = Math.min(zavrtani, hP) - d;
      if(!(lef >= 4*d)) continue;              // moc krátké zavrtání — vzorec neplatí
      var faxk = 0.52 * Math.pow(d, -0.5) * Math.pow(lef, -0.1) * Math.pow(rho, 0.8);
      var kd = Math.min(d/8, 1);
      var FaxRk = faxk * d * lef * kd / 1000;  // kN
      var dh = VRUT_SWWP.dHlavyNasobek * d;
      var FheadRk = VRUT_SWWP.fHeadK * dh * dh / 1000;
      var FRk = Math.min(FaxRk, FheadRk);
      var rozhoduje = (FheadRk < FaxRk) ? "protažení hlavy" : "vytažení z pozednice";
      for(var n = 1; n <= maxVrutu; n++){
        var nef = Math.pow(n, 0.9);
        var FRd = kmod * nef * FRk / gM;
        var kand = { d:d, delkaMm:delka, zavrtaniMm:zavrtani, lefMm:lef, faxk:r2(faxk),
                     FaxRkKN:r3(FaxRk), FheadRkKN:r3(FheadRk), FRkKN:r3(FRk), rozhoduje:rozhoduje,
                     vrutuNaStyk:n, nef:r3(nef), FRdKN:r3(FRd), vyuziti:NEd/FRd };
        if(!nejlepsi || kand.vyuziti < nejlepsi.vyuziti) nejlepsi = kand;
        if(NEd/FRd <= 1){ volba = kand; break; }
      }
    }
    var v = volba || nejlepsi;
    if(!v){
      radky.push(radek("Kotvení krokve k pozednici — vytažení vrutu při sání", vzorecN,
        "N_Ed = " + F(NEd) + " kN; žádný vrut ze skladu nezajede do pozednice aspoň 4·d — spoj posoudit zvlášť", 9));
      /* Nuly místo chybějících čísel: kdo výsledek čte (věšadlo skládá
         z FRdKN a d text posudku), nesmí spadnout (22. 9. 2026 — pád kroku
         Krov při profilu trámu zadaném v cm). */
      return { nadzvedava:true, NEdKN:r3(NEd), vrutuNaStyk:0, d:0, delkaMm:0, FRdKN:0, vyuziti:9,
               vyhovuje:false, nevyhovi:true, zadnyVrut:true,
               radky:radky, popis:"Spoj krokve s pozednicí nejde posoudit — vrut nezajede do pozednice dost hluboko." };
    }
    var nevyhovi = !volba;
    radky.push(radek("Kotvení krokve k pozednici — vytažení vrutu při sání",
      "N_Ed ≤ k_mod · n_ef · min(F_ax,Rk; F_head,Rk) / γ_M   (EN 1995-1-1, čl. 8.7.2)",
      "q_tah,d = " + F(q) + " kN/m²; s = " + F(s) + " m; a = " + F(a) + " m; L₁ = " + F(L1)
        + " m → N_Ed = " + F(NEd) + " kN; vrut " + VRUT_SWWP.nazev + " ⌀" + v.d + "×" + v.delkaMm
        + ", zavrtání " + v.zavrtaniMm + " mm, l_ef = " + v.lefMm + " mm; f_ax,k = " + F(v.faxk)
        + " N/mm² → F_ax,Rk = " + F(v.FaxRkKN) + " kN; F_head,Rk = " + F(v.FheadRkKN)
        + " kN (odhad, doplnit z ETA); " + v.vrutuNaStyk + " ks, n_ef = " + F(v.nef)
        + " → F_Rd = " + F(v.FRdKN) + " kN",
      v.vyuziti));
    return {
      nadzvedava:true, NEdKN:r3(NEd), vrut:VRUT_SWWP.nazev, d:v.d, delkaMm:v.delkaMm,
      zavrtaniMm:v.zavrtaniMm, lefMm:v.lefMm, FaxRkKN:v.FaxRkKN, FheadRkKN:v.FheadRkKN,
      rozhoduje:v.rozhoduje, vrutuNaStyk:v.vrutuNaStyk, FRdKN:v.FRdKN, vyuziti:r3(v.vyuziti),
      vyhovuje:!nevyhovi, nevyhovi:nevyhovi, etaDoplnit:VRUT_SWWP.etaDoplnit, radky:radky,
      popis: nevyhovi
        ? ("Spoj krokve s pozednicí nevyhoví ani s " + v.vrutuNaStyk + " vruty ⌀" + v.d
           + " (N_Ed " + F(NEd) + " kN, F_Rd " + F(v.FRdKN) + " kN) — je potřeba úhelník, "
           + "to už kalkulačka neřeší.")
        : (v.vrutuNaStyk + " × vrut ⌀" + v.d + "×" + v.delkaMm + " na styk krokve s pozednicí; "
           + "N_Ed " + F(NEd) + " kN, F_Rd " + F(v.FRdKN) + " kN, rozhoduje " + v.rozhoduje + ".")
    };
  }

  /* ══ HAMBÁLEK JAKO NEDOKONALÉ TÁHLO — PRUTOVÝ MODEL POLOVINY VAZBY ═════
     (PENTI 21. 9. 2026, pracovní rámec „hambálek není automaticky dokonale
     tuhé táhlo")

     Dosud se u hambálkového krovu bralo, že hambálek převezme rozpěr
     celý a do věnce nejde nic. Skutečnost závisí na tuhostech: hambálku
     (EA/L), spoje hambálek–krokev (K_ser svorníků + vůle otvoru) a
     VODOROVNÉ TUHOSTI PODPORY k_w (věnec, kotvení pozednice, zdivo).
     Když se pata krokve může volně posouvat, převezme hambálek rozpěr
     celý bez ohledu na svou tuhost; když je držená tuze, dělí se rozpěr
     podle tuhostí. Proto se počítá deformačně kompatibilní model a
     výsledky se dávají pro tři modely spoje a pro několik k_w.

     MODEL (polovina vazby, symetrie v hřebeni):
       · krokev = nosník (EI, EA) ve dvou prvcích: pata A → uzel hambálku
         B → hřeben C; osa krokve prochází podporou;
       · pata A: svisle podepřená, vodorovně pružina k_w, pootočení volné;
       · hřeben C: vodorovný posun nula (symetrie), svisle i pootočení
         volné (kloub v hřebeni);
       · hambálek = vodorovná pružina v B k ose symetrie:
             k_h = 1 / ( 1/K_spoj + L_h/(2·E·A_h) )
         s vůlí g (otvor svorníku d+1 → 1 mm), kterou táhlo nejdřív vybere;
       · zatížení w [kN/m vodorovného průmětu] svisle na krokev.

     Řeší se soustava 9 rovnic (3 stupně volnosti × 3 uzly) přímo —
     Gaussova eliminace. Výstupem je vodorovná síla do věnce H_věnec,
     síla v hambálku N_h, průběh momentu na krokvi a průhyb.

     KONTROLA ŘEŠIČE: bez táhla (k_h = 0) s tuhou patou musí vyjít přesně
     H = w·L²/(8·h) — třetí kloub je v hřebeni. S volnou patou a tuhým
     spojem musí být H_věnec = 0 a N_h = w·L²/(8·(h − h_h)).
     ══════════════════════════════════════════════════════════════════════ */
  function resSoustavu(K, F){
    var n = F.length, A = K.map(function(r){ return r.slice(); }), b = F.slice();
    for(var i=0;i<n;i++){
      var p = i;
      for(var r=i+1;r<n;r++) if(Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
      if(Math.abs(A[p][i]) < 1e-14) return null;
      if(p !== i){ var t=A[i]; A[i]=A[p]; A[p]=t; var tb=b[i]; b[i]=b[p]; b[p]=tb; }
      for(var r2=i+1;r2<n;r2++){
        var f = A[r2][i]/A[i][i]; if(!f) continue;
        for(var c=i;c<n;c++) A[r2][c] -= f*A[i][c];
        b[r2] -= f*b[i];
      }
    }
    var x = new Array(n);
    for(var i2=n-1;i2>=0;i2--){
      var sum = b[i2];
      for(var c2=i2+1;c2<n;c2++) sum -= A[i2][c2]*x[c2];
      x[i2] = sum/A[i2][i2];
    }
    return x;
  }

  /* Matice tuhosti rovinného prutu (EA, EI) v globálních souřadnicích. */
  function prutMatice(EA, EI, L, c, sn){
    var a = EA/L, b12 = 12*EI/(L*L*L), b6 = 6*EI/(L*L), b4 = 4*EI/L, b2 = 2*EI/L;
    var kl = [
      [ a,   0,    0,   -a,   0,    0  ],
      [ 0,   b12,  b6,   0,  -b12,  b6 ],
      [ 0,   b6,   b4,   0,  -b6,   b2 ],
      [-a,   0,    0,    a,   0,    0  ],
      [ 0,  -b12, -b6,   0,   b12, -b6 ],
      [ 0,   b6,   b2,   0,  -b6,   b4 ]
    ];
    var T = [
      [ c, sn, 0, 0, 0, 0], [-sn, c, 0, 0, 0, 0], [0, 0, 1, 0, 0, 0],
      [ 0, 0, 0, c, sn, 0], [0, 0, 0, -sn, c, 0], [0, 0, 0, 0, 0, 1]
    ];
    /* K = Tᵀ·kl·T */
    var tmp = [], K = [];
    for(var i=0;i<6;i++){ tmp.push([]); for(var j=0;j<6;j++){ var v=0; for(var k=0;k<6;k++) v += kl[i][k]*T[k][j]; tmp[i].push(v); } }
    for(var i2=0;i2<6;i2++){ K.push([]); for(var j2=0;j2<6;j2++){ var v2=0; for(var k2=0;k2<6;k2++) v2 += T[k2][i2]*tmp[k2][j2]; K[i2].push(v2); } }
    return { K:K, kl:kl, T:T };
  }

  function ramHambalek(o){
    var L = +o.rozponM || 0, alfa = (+o.sklonDeg || 0)*Math.PI/180;
    var hH = +o.vyskaHambalkuM || 0;                    // osa hambálku nad osou paty krokve
    var w = +o.wKNm || 0;                               // kN/m vodorovného průmětu
    if(!(L > 0.5) || !(alfa > 0.05) || !(hH > 0.05)) return null;
    var tg = Math.tan(alfa), cs = Math.cos(alfa), sn = Math.sin(alfa);
    var H = (L/2)*tg;                                   // výška hřebene (osa)
    if(!(hH < H - 0.05)) return null;
    var pk = o.profilKrokve || {b:100,h:180}, ph = o.profilHambalku || {b:100,h:160};
    var E = (+o.EkNmm2 || 11) * 1e6;                    // kN/m²  (11 000 N/mm²)
    var Ik = (pk.b/1000)*Math.pow(pk.h/1000,3)/12, Ak = (pk.b/1000)*(pk.h/1000);
    var Ah = (ph.b/1000)*(ph.h/1000);
    var xB = hH/tg, Lh = L - 2*xB;                      // délka hambálku mezi osami krokví
    if(!(Lh > 0.2)) return null;
    var kHam = 2*E*Ah/Lh;                               // kN/m — polovina hambálku k ose symetrie
    var Kspoj = (o.KspojKNmm == null) ? Infinity : (+o.KspojKNmm)*1000;   // kN/m
    var kw = (o.kwKNmm == null) ? Infinity : (+o.kwKNmm)*1000;             // kN/m
    var g = (o.vuleMm != null) ? (+o.vuleMm)/1000 : 0;                     // m
    var tahloJe = !(Kspoj <= 0);
    var kh = !tahloJe ? 0 : (isFinite(Kspoj) ? 1/(1/Kspoj + 1/kHam) : kHam);

    /* uzly: 0 = A (0,0), 1 = B (xB, hH), 2 = C (L/2, H); dof = [u,v,θ]·3 */
    var L1 = Math.hypot(xB, hH), L2 = Math.hypot(L/2 - xB, H - hH);
    var EA = E*Ak, EI = E*Ik;
    var p1 = prutMatice(EA, EI, L1, cs, sn), p2 = prutMatice(EA, EI, L2, cs, sn);
    var K = []; for(var i=0;i<9;i++){ K.push([0,0,0,0,0,0,0,0,0]); }
    var pridej = function(Ke, uzly){
      for(var i=0;i<6;i++) for(var j=0;j<6;j++)
        K[uzly[Math.floor(i/3)]*3 + i%3][uzly[Math.floor(j/3)]*3 + j%3] += Ke[i][j];
    };
    pridej(p1.K, [0,1]); pridej(p2.K, [1,2]);

    /* Ekvivalentní uzlové síly od svislého rovnoměrného zatížení.
       Na metr délky prutu působí w·cosα svisle (w je na půdorys): kolmo
       k prutu q_n = w·cos²α, podél q_t = w·cosα·sinα. */
    var F = [0,0,0,0,0,0,0,0,0];
    var qv = w*cs;                                      // kN/m délky prutu, svisle dolů
    var zatiz = function(Lp, uzly){
      var qn = qv*cs, qt = qv*sn;                       // kolmo (dolů), podél (k patě)
      /* lokálně: y kolmo k prutu; kladné y "nahoru" od prutu ve směru otočení */
      var fl = [ -qt*Lp/2, -qn*Lp/2, -qn*Lp*Lp/12,  -qt*Lp/2, -qn*Lp/2, +qn*Lp*Lp/12 ];
      /* globálně: Fg = Tᵀ·fl */
      var T = [[cs, sn, 0],[ -sn, cs, 0],[0,0,1]];
      for(var k=0;k<2;k++){
        var fx = T[0][0]*fl[3*k] + T[1][0]*fl[3*k+1];
        var fy = T[0][1]*fl[3*k] + T[1][1]*fl[3*k+1];
        F[uzly[k]*3]   += fx; F[uzly[k]*3+1] += fy; F[uzly[k]*3+2] += fl[3*k+2];
      }
    };
    zatiz(L1, [0,1]); zatiz(L2, [1,2]);
    /* Kontrola: součet svislých sil = −w·L/2 */
    var Fv = F[1]+F[4]+F[7];

    /* HAMBÁLEK NESE TAH I TLAK. Je to hranol, ne lano: když se pata drží
       tuze a krokev se prohne, hambálek se opře (tlak) a působí jako
       rozpěra — to je ta situace, kdy do věnce jde víc než bez táhla.
       Vůle otvoru g platí na obě strany: |Δ| ≤ g → hambálek nenese. */
    var TUHA = 1e10;                                    // kN/m — "nekonečná" pružina
    var kwEf = isFinite(kw) ? kw : TUHA;
    var vyres = function(smer){                         // smer: +1 tah, −1 tlak, 0 bez táhla
      var Kk = K.map(function(r){ return r.slice(); }), Ff = F.slice();
      Kk[1][1] += TUHA;                                 // A: v = 0
      Kk[0][0] += kwEf;                                 // A: vodorovná pružina
      Kk[6][6] += TUHA;                                 // C: u = 0 (symetrie)
      if(smer && kh > 0){ Kk[3][3] += kh; Ff[3] += -kh*g*smer; }
      var d = resSoustavu(Kk, Ff);
      if(!d) return null;
      var uA = d[0], uB = d[3];
      var Nh = (smer && kh > 0) ? kh*(-uB - g*smer) : 0;   // tah kladný, tlak záporný
      return { d:d, uA:uA, uB:uB, Nh:Nh, Hv:-kwEf*uA, smer:smer };
    };
    /* Volná pata bez táhla = mechanismus; nemá řešení. */
    if(!(kwEf > 0) && !(tahloJe && kh > 0)) return { nestabilni:true };
    var r0 = vyres(0);
    if(!r0) return null;
    var r = r0, delta0 = -r0.uB;                         // posun B ven (+) / dovnitř (−) bez táhla
    if(tahloJe && kh > 0 && Math.abs(delta0) > g){
      var smer = delta0 > 0 ? 1 : -1;
      if(smer < 0 && o.hambalekTlak === false) smer = 0;
      if(smer){
        var r1 = vyres(smer);
        if(r1 && (-r1.uB)*smer > g) r = r1;
      }
    }
    r.tahloNeaktivni = tahloJe && kh > 0 && !r.smer;

    /* Vnitřní síly z koncových sil prutů (lokálně). */
    var koncove = function(p, Lp, uzly, d){
      var de = [];
      for(var k=0;k<2;k++) for(var j=0;j<3;j++) de.push(d[uzly[k]*3+j]);
      /* lokální posuny = T·d */
      var dl = []; for(var i=0;i<6;i++){ var v=0; for(var j2=0;j2<6;j2++) v += p.T[i][j2]*de[j2]; dl.push(v); }
      var fe = []; for(var i2=0;i2<6;i2++){ var v2=0; for(var j3=0;j3<6;j3++) v2 += p.kl[i2][j3]*dl[j3]; fe.push(v2); }
      /* odečíst primární (vetknuté) síly od zatížení */
      var qn = qv*cs, qt = qv*sn;
      var fl = [ -qt*Lp/2, -qn*Lp/2, -qn*Lp*Lp/12,  -qt*Lp/2, -qn*Lp/2, +qn*Lp*Lp/12 ];
      for(var i3=0;i3<6;i3++) fe[i3] -= fl[i3];
      /* fe = síly, kterými prut působí… = koncové síly prutu: N1 = −fe[0], V1 = fe[1], M1 = fe[2] */
      return { N1:-fe[0], V1:fe[1], M1:-fe[2], N2:fe[3], V2:-fe[4], M2:fe[5], qn:qn, qt:qt, dl:dl, L:Lp };
    };
    var k1 = koncove(p1, L1, [0,1], r.d), k2 = koncove(p2, L2, [1,2], r.d);
    /* průběh momentu: M(x) = M1 + V1·x − q_n·x²/2, sample po desetinách */
    var Mmax = 0, Mkde = 0, prubeh = [];
    [k1, k2].forEach(function(k, idx){
      for(var i=0;i<=10;i++){
        var x = k.L*i/10, M = k.M1 + k.V1*x - k.qn*x*x/2;
        prubeh.push({ prvek:idx+1, sM: r3((idx? L1:0) + x), M:r3(M) });
        if(Math.abs(M) > Math.abs(Mmax)){ Mmax = M; Mkde = (idx? L1:0) + x; }
      }
    });
    /* průhyb kolmo k prutu: Hermite + partikulární člen q_n·x²(L−x)²/(24EI) */
    var wMax = 0;
    [ [k1, L1], [k2, L2] ].forEach(function(pair){
      var k = pair[0], Lp = pair[1], dl = k.dl;
      for(var i=1;i<10;i++){
        var x = Lp*i/10, xi = x/Lp;
        var h1 = 1 - 3*xi*xi + 2*xi*xi*xi, h2 = x*(1-xi)*(1-xi), h3 = 3*xi*xi - 2*xi*xi*xi, h4 = x*xi*(xi-1);
        var v = h1*dl[1] + h2*dl[2] + h3*dl[4] + h4*dl[5] - k.qn*x*x*(Lp-x)*(Lp-x)/(24*EI);
        if(Math.abs(v) > Math.abs(wMax)) wMax = v;
      }
    });
    var HvKN = r.Hv;                                    // kN, síla krokve do zdi ven (+)
    var VA = w*L/2;
    return {
      geometrie: { LM:r3(L), HM:r3(H), hHM:r3(hH), xBM:r3(xB), LhM:r3(Lh), L1M:r3(L1), L2M:r3(L2),
                   IkM4:Ik, AkM2:Ak, AhM2:Ah, EkNm2:E },
      tuhosti: { kHambalekKNmm:r3(kHam/1000), KspojKNmm:(isFinite(Kspoj)? r3(Kspoj/1000) : null),
                 khKNmm:r3(kh/1000), kwKNmm:(isFinite(kw)? r3(kw/1000) : null), vuleMm:r3(g*1000) },
      w:r3(w), reakceVKN:r3(VA),
      HvenecKN: r3(HvKN), NhambalekKN: r3(r.Nh),        // N_h: tah +, tlak −
      hambalekVTlaku: r.Nh < -1e-6,
      tahloNeaktivni: !!r.tahloNeaktivni, tahloJe: tahloJe,
      posunPatyMm: r2(-r.uA*1000), posunHambalkuMm: r2(-r.uB*1000),
      MmaxKNm: r3(Mmax), MkdeM: r3(Mkde), prubehM: prubeh,
      MhambalekKNm: r3(k1.M2), MpataKNm: r3(k1.M1),
      NkrokvePataKN: r3(k1.N1),
      wMaxMm: r2(Math.abs(wMax)*1000),
      kontrolaSvisle: r3(-Fv)
    };
  }

  /* Tři modely spoje × několik podpor — obálka pro návrh. */
  function hambalekObalka(o){
    var modely = [
      { kod:"bez_tahla", nazev:"bez účinného hambálku (K_spoj → 0)", KspojKNmm:0 },
      { kod:"realny",    nazev:"reálný spoj (K_u = ⅔·K_ser)",        KspojKNmm:o.KspojKNmm },
      { kod:"tuhy",      nazev:"tuhý spoj (K_spoj → ∞)",              KspojKNmm:null }
    ];
    /* VODOROVNÁ TUHOST PATY k_w — nejméně jistá veličina modelu. Pro
       představu: železobetonový věnec 250×250 mezi příčnými stěnami po
       12 m má vodorovnou tuhost uprostřed jen ~0,04 kN/mm na metr délky,
       po 6 m ~0,6 kN/mm; u příčné stěny je prakticky tuhý. Proto se počítá
       rozsah a v protokolu je vidět, jak moc na tom záleží. Ručně zadané
       k_w (o.kwKNmm) se přidá jako čtvrtý sloupec. */
    var podpory = o.podpory || [
      { kod:"volna",    nazev:"pata volná (k_w = 0) — klasický předpoklad, hambálek = táhlo", kwKNmm:0 },
      { kod:"poddajna", nazev:"poddajný věnec (k_w = 0,1 kN/mm) — dlouhá stěna bez příčných stěn", kwKNmm:0.1 },
      { kod:"tuhy_venec", nazev:"tuhý věnec (k_w = 1 kN/mm) — příčné stěny nablízku", kwKNmm:1 },
      { kod:"tuha",     nazev:"pata nekonečně tuhá (k_w → ∞)", kwKNmm:null }
    ];
    if(o.kwKNmm != null && +o.kwKNmm >= 0)
      podpory.push({ kod:"zadana", nazev:"zadané k_w = " + (+o.kwKNmm).toFixed(2) + " kN/mm", kwKNmm:+o.kwKNmm, zadana:true });
    var tab = [];
    modely.forEach(function(m){
      podpory.forEach(function(pd){
        var r = ramHambalek(Object.assign({}, o, { KspojKNmm:m.KspojKNmm, kwKNmm:pd.kwKNmm,
          vuleMm: (m.kod === "realny") ? o.vuleMm : 0 }));
        var ok = r && !r.nestabilni;
        tab.push({ model:m.kod, modelNazev:m.nazev, podpora:pd.kod, podporaNazev:pd.nazev, zadana:!!pd.zadana,
          nestabilni: !!(r && r.nestabilni),
          HvenecKN: ok ? r.HvenecKN : null, NhambalekKN: ok ? r.NhambalekKN : null,
          MmaxKNm: ok ? r.MmaxKNm : null, wMaxMm: ok ? r.wMaxMm : null,
          posunPatyMm: ok ? r.posunPatyMm : null, tahloNeaktivni: ok ? r.tahloNeaktivni : false });
      });
    });
    var extrem = function(k, filtr, minimum){
      var m = null;
      tab.forEach(function(t){
        if(t[k] == null || (filtr && !filtr(t))) return;
        if(m == null || (minimum ? t[k] < m : t[k] > m)) m = t[k];
      });
      return m == null ? 0 : m;
    };
    var sTahlem = function(t){ return t.model !== "bez_tahla"; };
    return {
      tabulka: tab, podpory: podpory, modely: modely,
      /* OBÁLKA PRO NÁVRH: každý prvek na svůj nejhorší případ.
         · věnec a kotvení: největší H_věnec přes všechny modely (u tuhé
           paty bývá VĚTŠÍ než bez táhla — hambálek se opře jako rozpěra);
         · hambálek a spoj: největší tah (volná pata) i největší tlak
           (tuhá pata, vzpěr);
         · krokev: největší moment a průhyb s táhlem. */
      navrh: {
        HvenecKN: extrem("HvenecKN"),
        HvenecBezTahlaKN: extrem("HvenecKN", function(t){ return t.model === "bez_tahla"; }),
        HvenecRealnyMinKN: extrem("HvenecKN", function(t){ return t.model === "realny"; }, true),
        HvenecRealnyMaxKN: extrem("HvenecKN", function(t){ return t.model === "realny"; }),
        NhambalekTahKN: Math.max(0, extrem("NhambalekKN")),
        NhambalekTlakKN: Math.max(0, -extrem("NhambalekKN", null, true)),
        MmaxKNm: extrem("MmaxKNm", sTahlem),
        wMaxMm: extrem("wMaxMm", sTahlem)
      }
    };
  }

  /* ══ VĚNEC POD POZEDNICÍ JAKO VODOROVNÝ NOSNÍK (PENTI 22. 9. 2026) ═══════
     Otázka PENTI: „uměl bys předběžně posoudit i věnec šířky 340 mm a
     výšky 250 mm, délka 10 520 mm?"

     Rozpěr krokví tlačí na věnec vodorovně; věnec ho nese jako nosník
     ohýbaný kolem SVISLÉ osy mezi štítovými (příčnými) stěnami. Samotné
     M = q·L²/8 by tady lhalo: kde věnec uhne, tam krokev tlačí míň a
     rozpěr přebírá hambálek (tah); u štítů je věnec tuhý, krokev tlačí
     naplno a hambálek je v tlaku. Proto se řeší SDRUŽENĚ:

       · věnec = prostý nosník (MKP, hermitovské prvky), EI kolem svislé
         osy = E·h·b³/12 (b = šířka betonu, h = výška věnce);
       · v místě každé krokve působí síla H(u) — závislost rozpěru na
         posunu paty, kterou dá model hambálku (`ramHambalek`) přes
         rozsah tuhostí k_w; křivka je monotónní, interpoluje se;
       · iteruje se, dokud posuny nesedí se silami.

     Věnec se určitě potrhá (moment trhlin je jen pár kNm), takže se počítá
     dvakrát: s EI bez trhlin (horní odhad momentu) a s 0,4·EI (trhliny,
     typické pro obdélník s ρ ≈ 0,5 %). Návrh výztuže bere případ
     s trhlinami — je konzistentní s tím, že se věnec rozpraská; případ bez
     trhlin se ukazuje jako horní mez. Průhyb se bere z případu s trhlinami.

     CO SE NEPOČÍTÁ: spolupůsobení zdiva pod věncem (bere kus rozpěru,
     takže moment i průhyb vyjdou reálně menší), vítr na věnec, kotvení
     věnce do štítu. Je to předběžný výpočet, ne statický posudek.
     ══════════════════════════════════════════════════════════════════════ */
  var BETONY = {
    "C16/20": { fck:16, fctm:1.9, Ecm:29 },
    "C20/25": { fck:20, fctm:2.2, Ecm:30 },
    "C25/30": { fck:25, fctm:2.6, Ecm:31 },
    "C30/37": { fck:30, fctm:2.9, Ecm:33 }
  };
  var FYK_B500 = 500, GAMMA_S = 1.15, GAMMA_C = 1.5;

  /* Křivka H(u) paty krokve: rozpěr do věnce podle vodorovného posunu paty
     (u ven kladné, mm). Skenuje se k_w od tuhé po měkkou. */
  function krivkaPaty(o){
    var pts = [];
    [null, 1000, 300, 100, 30, 10, 3, 1, 0.5, 0.3, 0.2, 0.15, 0.1, 0.07, 0.05, 0.03, 0.02, 0.01, 0.005, 0.002, 0.001, 0.0003, 0.0001]
      .forEach(function(kw){
        var r = ramHambalek(Object.assign({}, o, { kwKNmm: kw }));
        if(!r || r.nestabilni) return;
        pts.push({ u: r.posunPatyMm, H: r.HvenecKN, N: r.NhambalekKN });
      });
    pts.sort(function(a, b){ return a.u - b.u; });
    return pts;
  }
  function naKrivce(pts, u){
    if(!pts.length) return { H:0, N:0 };
    if(u <= pts[0].u) return pts[0];
    for(var i=1;i<pts.length;i++){
      if(u <= pts[i].u){
        var a = pts[i-1], b = pts[i], t = (b.u - a.u) > 1e-12 ? (u - a.u)/(b.u - a.u) : 0;
        return { H: a.H + t*(b.H - a.H), N: a.N + t*(b.N - a.N) };
      }
    }
    return pts[pts.length-1];
  }

  /* Nosník s krokvemi jako nelineárními pružinami. */
  function venecNosnik(o){
    var L = +o.LM || 0, EI = +o.EIkNm2 || 0;
    var xR = o.krokveX || [], pts = o.krivka || [];
    if(!(L > 0.5) || !(EI > 0) || !xR.length || pts.length < 2) return null;
    var n = Math.max(20, Math.min(160, Math.round(L/0.1))), h = L/n, N = n+1;
    var K = []; for(var i=0;i<2*N;i++){ K.push(new Array(2*N).fill(0)); }
    var c = EI/(h*h*h);
    var ke = [[12,6*h,-12,6*h],[6*h,4*h*h,-6*h,2*h*h],[-12,-6*h,12,-6*h],[6*h,2*h*h,-6*h,4*h*h]];
    for(var e=0;e<n;e++) for(var a=0;a<4;a++) for(var b=0;b<4;b++) K[2*e+a][2*e+b] += ke[a][b]*c;
    var TUHA = 1e12; K[0][0] += TUHA; K[2*n][2*n] += TUHA;      // u = 0 na obou koncích, kloubově
    var uzel = function(x){ return Math.max(0, Math.min(n, Math.round(x/h))); };
    var u = new Array(N).fill(0), H = xR.map(function(){ return 0; }), iter = 0, diff = 1, sol = null;
    for(iter=0; iter<300 && diff>1e-7; iter++){
      var F = new Array(2*N).fill(0);
      H = xR.map(function(x){ return naKrivce(pts, u[uzel(x)]*1000).H; });
      xR.forEach(function(x, i){ F[2*uzel(x)] += H[i]; });
      sol = resSoustavu(K, F);
      if(!sol) return null;
      diff = 0;
      for(var k=0;k<N;k++){ var un = sol[2*k]; diff = Math.max(diff, Math.abs(un - u[k])); u[k] = 0.5*u[k] + 0.5*un; }
    }
    /* Moment z koncových sil prvků (přesné pro osamělé síly v uzlech):
       na pravém konci prvku e je M = EI/h²·(6u₁ + 2hθ₁ − 6u₂ + 4hθ₂). */
    var Mmax = 0, xM = 0, umax = 0, xU = 0;
    for(var e2=0;e2<n;e2++){
      var u1 = sol[2*e2], t1 = sol[2*e2+1], u2 = sol[2*e2+2], t2 = sol[2*e2+3];
      var M = EI/(h*h)*(6*u1 + 2*h*t1 - 6*u2 + 4*h*t2);
      if(Math.abs(M) > Math.abs(Mmax)){ Mmax = M; xM = (e2+1)*h; }
    }
    for(var j=1;j<N-1;j++){ if(u[j] > umax){ umax = u[j]; xU = j*h; } }
    var R = H.reduce(function(a, b){ return a + b; }, 0)/2;
    var stred = naKrivce(pts, umax*1000);
    return {
      LM: r3(L), EIkNm2: Math.round(EI), krokvi: xR.length, iteraci: iter,
      H: H.map(r3), Hmin: r3(Math.min.apply(null, H)), Hmax: r3(Math.max.apply(null, H)),
      MmaxKNm: r3(Math.abs(Mmax)), xMM: r2(xM), umaxMm: r2(umax*1000), xUM: r2(xU),
      reakceKN: r3(R), NhambalekStredKN: r3(stred.N), NhambalekKrajKN: r3(naKrivce(pts, 0).N),
      kwStredKNmm: umax > 1e-9 ? r3(stred.H/(umax*1000)) : null,
      Htuhy: r3(naKrivce(pts, 0).H)
    };
  }

  /* Průřezový posudek věnce (EN 1992-1-1, zjednodušeně) a sestavení případů. */
  function venecPosudek(o){
    var bet = BETONY[o.beton] || BETONY["C20/25"];
    var b = +o.sirkaMm || 340, hv = +o.vyskaMm || 250, L = +o.LM || 0;
    var kryti = (o.krytiMm != null) ? +o.krytiMm : 30;
    var nV = Math.max(1, Math.round(+o.vyztuzKs || 2)), dV = +o.vyztuzMm || 12;   // u KAŽDÉHO svislého líce
    var dT = +o.trminkyMm || 6, sT = +o.trminkyRoztecMm || 200;
    var E = bet.Ecm*1e6;                                     // kN/m²
    var I = (hv/1000)*Math.pow(b/1000, 3)/12, EI = E*I;      // kolem svislé osy
    var W = hv*b*b/6;                                        // mm³
    var Mcr = bet.fctm*W/1e6;                                // kNm
    var fcd = bet.fck/GAMMA_C, fyd = FYK_B500/GAMMA_S;
    var d = b - kryti - dT - dV/2;                           // účinná výška = ve směru šířky
    var As = nV*Math.PI*dV*dV/4;                             // mm² u taženého líce
    var x = As*fyd/(0.8*fcd*hv), z = d - 0.4*x;              // tlačená oblast má šířku h věnce
    var MRd = As*fyd*z/1e6;                                  // kNm
    var pripady = [];
    var pridej = function(kod, nazev, krivka, EIx){
      var r = venecNosnik({ LM:L, EIkNm2:EIx, krokveX:o.krokveX, krivka:krivka });
      if(r){ r.kod = kod; r.nazev = nazev; pripady.push(r); }
      return r;
    };
    var ulsN = pridej("uls_bez", "ULS, věnec bez trhlin", o.krivkaULS, EI);
    var ulsT = pridej("uls_trh", "ULS, věnec s trhlinami (0,4·EI)", o.krivkaULS, 0.4*EI);
    var slsN = pridej("sls_bez", "SLS, věnec bez trhlin", o.krivkaSLS, EI);
    var slsT = pridej("sls_trh", "SLS, věnec s trhlinami (0,4·EI)", o.krivkaSLS, 0.4*EI);
    if(!ulsT || !ulsN) return null;
    var MEd = ulsT.MmaxKNm, MEdHorni = ulsN.MmaxKNm;
    var AsReq = MEd*1e6/(z*fyd);
    var VEd = Math.max(ulsT.reakceKN, ulsN.reakceKN);
    /* smyk: b_w = výška věnce (kolmo na rovinu ohybu) */
    var bw = hv, rho = Math.min(0.02, As/(bw*d)), kS = Math.min(2, 1 + Math.sqrt(200/d));
    var VRdc = Math.max(0.12*kS*Math.pow(100*rho*bet.fck, 1/3), 0.035*Math.pow(kS, 1.5)*Math.sqrt(bet.fck))*bw*d/1000;
    var Asw = 2*Math.PI*dT*dT/4;                              // dvě větve třmínku v rovině ohybu
    var VRds = Asw/sT*z*fyd*2.5/1000;
    var ni1 = 0.6*(1 - bet.fck/250);
    var VRdmax = bw*z*ni1*fcd/(2.5 + 0.4)/1000;
    var VRd = Math.min(VRds, VRdmax);
    var uSls = slsT ? slsT.umaxMm : null;
    var radky = [];
    radky.push(radek("Věnec — ohyb kolem svislé osy (rozpěr krokví)",
      "M_Ed ≤ M_Rd = A_s·f_yd·z",
      "sdružený model, věnec s trhlinami: M_Ed = " + F(MEd,1) + " kNm (bez trhlin " + F(MEdHorni,1)
        + "); " + nV + " Ø " + dV + " u líce = " + Math.round(As) + " mm², d = " + Math.round(d) + " mm, z = "
        + Math.round(z) + " mm → M_Rd = " + F(MRd,1) + " kNm; potřeba " + Math.round(AsReq) + " mm²",
      MEd/MRd));
    radky.push(radek("Věnec — smyk u štítu", "V_Ed ≤ max(V_Rd,c; V_Rd,s)",
      "V_Ed = " + F(VEd,1) + " kN; V_Rd,c = " + F(VRdc,1) + " kN; třmínky Ø " + dT + "/" + sT
        + " → V_Rd,s = " + F(VRds,1) + " kN (V_Rd,max " + F(VRdmax,1) + ")",
      VEd/Math.max(VRdc, VRd)));
    if(uSls != null)
      radky.push(radek("Věnec — vodorovný průhyb (informativně, L/250)", "u ≤ L/250",
        "SLS s trhlinami: u = " + F(uSls,1) + " mm; L/250 = " + F(L*1000/250,1) + " mm",
        uSls/(L*1000/250)));
    return {
      beton: o.beton || "C20/25", sirkaMm: b, vyskaMm: hv, LM: r3(L), krytiMm: kryti,
      vyztuz: { ks:nV, prumerMm:dV, AsMm2: Math.round(As), AsReqMm2: Math.round(AsReq) },
      trminky: { prumerMm:dT, roztecMm:sT },
      EIkNm2: Math.round(EI), McrKNm: r2(Mcr), dMm: Math.round(d), zMm: Math.round(z),
      MEdKNm: r2(MEd), MEdHorniKNm: r2(MEdHorni), MRdKNm: r2(MRd),
      VEdKN: r2(VEd), VRdcKN: r2(VRdc), VRdsKN: r2(VRds), VRdmaxKN: r2(VRdmax),
      uSlsMm: uSls, uLimitMm: r2(L*1000/250),
      pripady: pripady, radky: radky,
      vyhovuje: radky.slice(0,2).every(function(r){ return r.vyhovuje; })
    };
  }

  /* ══ JEDNODUCHÉ VĚŠADLO — VAZBA A JEJÍ SPOJE (PENTI 22. 9. 2026) ═════════
     Postup a vzorce odpovídají statickému výpočtu podobné realizace
     (175_16 mlýn Mořice, Ing. Michal Janči, 2016), který PENTI dodalo jako
     vzor: jednoduché šikmé zapuštění s čelní plochou v ose úhlu, únosnost
     v otlačení pod úhlem podle EN 1995-1-1 čl. 6.2.2 s k_c,90 = 1,5,
     usmyknutí předsazení na délce 8·t_v, oslabený průřez trámu na tah
     s ohybem, kampování okapové vaznice.

     RÁMOVÝ MODEL VAZBY: vazný trám jako nosník (osa v polovině výšky) na
     dvou podporách (vlevo pevný kloub, vpravo posuvný), věšák a vzpěry
     jako pruty s kloubovými konci (přípoje jsou zapuštění a třmen — moment
     nepřenesou). Zatížení: reakce vrcholové vaznice do hlavy věšáku,
     reakce okapových vaznic na konce trámu, spojité po trámu (vlastní tíha
     a případný podhled). Řeší se řešičem z jádra (solveFrame2D).
     ══════════════════════════════════════════════════════════════════════ */
  var KC90_ZAPUSTENI = 1.5;

  /* Únosnost v tlaku pod úhlem α k vláknům — EN 1995-1-1 (6.16). */
  function pevnostPodUhlem(f, alfaRad, kc90){
    var k = (kc90 != null) ? kc90 : KC90_ZAPUSTENI;
    var sn = Math.sin(alfaRad), cs = Math.cos(alfaRad);
    return f.fc0d / ((f.fc0d/(k*f.fc90d))*sn*sn + cs*cs);
  }

  /* JEDNODUCHÉ ŠIKMÉ ZAPUŠTĚNÍ — čelní plocha v ose úhlu.
       NkN       síla ve vzpěře (tlak)
       uhelDeg   úhel mezi vzpěrou a prvkem, do kterého je zapuštěná
       bMm       šířka čela (menší z obou prvků)
       tvMm      hloubka zapuštění
       lvMm      délka dřeva za čelem (předsazení / hlava)
       hMm       výška prvku se zářezem (kvůli mezi t_v ≤ h/4)
     Vrací řádky posudku a potřebnou hloubku, aby otlačení vyšlo. */
  function posudekZapusteni(o){
    var f = navrhovePevnosti(o.trida, o.kmod);
    var N = Math.abs(+o.NkN || 0), uhel = (+o.uhelDeg || 45)*Math.PI/180, alfa = uhel/2;
    var b = +o.bMm || 140, tv = +o.tvMm || 40, lv = +o.lvMm || 0;
    var fca = pevnostPodUhlem(f, alfa, o.kc90);
    var cos2 = Math.cos(alfa)*Math.cos(alfa);
    var sig = N*1000*cos2/(b*tv);
    var tvPotreba = Math.ceil(N*1000*cos2/(b*fca)/5)*5;
    /* u dvojité zarážky: smyk a strop ¼ h na hlubším čele (tvSmykMm) */
    var tvS = +o.tvSmykMm || tv;
    var lvEf = Math.min(lv, 8*tvS);
    /* b_ef = k_cr·b (EN 1995-1-1 6.1.7, jako FRILO / Harzer; 11. 10. 2026) */
    var tau = (lvEf > 0) ? N*1000*Math.cos(uhel)/(K_CR*b*lvEf) : 1e9;
    var lvPotreba = Math.ceil(N*1000*Math.cos(uhel)/(K_CR*b*f.fvd)/10)*10;
    var kdo = o.nazev || "Zapuštění";
    var radky = [
      radek(kdo + " — otlačení čela pod úhlem", "σ_c,α,d = N·cos²(α)/(b·t_v) ≤ f_c,α,d   (α = úhel/2, EN 1995-1-1 6.2.2, k_c,90 = 1,5)",
        "N = " + F(N) + " kN; úhel " + F(uhel*180/Math.PI,1) + "°, α = " + F(alfa*180/Math.PI,1)
        + "°; b = " + b + " mm, t_v = " + (o.popisTv ? (o.popisTv + " = ") : "") + tv + " mm → σ = " + F(sig) + " N/mm²; f_c,α,d = " + F(fca)
        + " N/mm² (potřeba t_v ≥ " + tvPotreba + " mm)", sig/fca),
      radek(kdo + " — usmyknutí dřeva za čelem", "τ_d = N·cos(úhel)/(k_cr·b·l_v,ef) ≤ f_v,d,  l_v,ef = min(l_v; 8·t_v),  k_cr = 0,67",
        "l_v = " + Math.round(lv) + " mm, l_v,ef = " + Math.round(lvEf) + " mm → τ = " + F(tau)
        + " N/mm²; f_v,d = " + F(f.fvd) + " (potřeba l_v ≥ " + lvPotreba + " mm)", tau/f.fvd)
    ];
    var chyby = [];
    /* mez hloubky: ¼ výšky prvku; u zapuštění z OBOU stran (hlava věšáku)
       ⅙ šířky (o.mezNasobek = 6, 11. 10. 2026) */
    var nas = +o.mezNasobek || 4;
    if(o.hMm && tvS > o.hMm/nas + 0.01)
      chyby.push(kdo + ": hloubka " + tvS + " mm je víc než " + (nas === 6 ? "šestina" : "čtvrtina") + " výšky prvku (" + Math.round(o.hMm/nas) + " mm).");
    return { radky:radky, sigma:r2(sig), fca:r2(fca), tau:r2(tau), tvPotrebaMm:tvPotreba,
             lvPotrebaMm:lvPotreba, lvEfMm:Math.round(lvEf), vyhovuje: sig<=fca && tau<=f.fvd, chyby:chyby };
  }

  /* SVORNÍKY OCEL–DŘEVO, DVOJSTŘIŽNĚ, TENKÉ VNĚJŠÍ PLECHY (t ≤ 0,5·d)
     — EN 1995-1-1 (8.12 j, k). Třmen z pásoviny 60×8 s M16: 8 ≤ 0,5·16,
     tenký plech. Pro tlustý plech (t ≥ d) rovnice (8.13 l, m). */
  function unosnostSvornikuOcel(o){
    var d = +o.prumerMm || 16, t2 = +o.tloustkaDrevaMm || 180, tp = +o.plechMm || 8;
    var rho = +o.hustotaKgM3 || 350, fu = OCEL_SVORNIK[o.tridaOceli || "4.8"] || 420;
    var fh = 0.082*(1 - 0.01*d)*rho;                  // otlačení dřeva ⊥? — pro svorník podél vláken
    var My = 0.3*fu*Math.pow(d, 2.6);
    var tlusty = tp >= d, tenky = tp <= 0.5*d;
    var Fj, Fk, rezim;
    if(tlusty){
      Fj = 0.5*fh*t2*d;
      Fk = 2.3*Math.sqrt(My*fh*d);
      rezim = "tlustý plech (8.13)";
    } else {
      /* tenký plech; mezi tenkým a tlustým se interpoluje lineárně */
      var Fjt = 0.5*fh*t2*d, Fkt = 1.15*Math.sqrt(2*My*fh*d);
      if(tenky){ Fj = Fjt; Fk = Fkt; rezim = "tenký plech (8.12)"; }
      else {
        var w = (tp - 0.5*d)/(0.5*d);
        Fj = Fjt; Fk = Fkt + w*(2.3*Math.sqrt(My*fh*d) - Fkt);
        rezim = "plech mezi tenkým a tlustým — interpolace";
      }
    }
    var FvRk = Math.min(Fj, Fk);                        // na jednu střižnou rovinu [N]
    return { d:d, fh:r2(fh), MyNmm:Math.round(My), FvRkKN:r3(FvRk/1000), naSvornikKN:r3(2*FvRk/1000),
             rezim:rezim, rozhoduje: (Fj <= Fk) ? "otlačení dřeva" : "plastický kloub" };
  }

  /* TŘMEN VĚŠÁKU — pásovina kolem trámu + svorníky ve věšáku. */
  function posudekTrmenu(o){
    var N = Math.abs(+o.NkN || 0), kmod = (o.kmod != null) ? o.kmod : 0.8, gM = 1.3;
    var sv = unosnostSvornikuOcel({ prumerMm:o.prumerMm || 16, tloustkaDrevaMm:o.bVesakuMm || 180, plechMm:o.plechMm || 8 });
    var n = +o.pocet || 2;
    var FRd = kmod*n*sv.naSvornikKN/gM;
    var bp = +o.pasovinaMm || 60, tp = +o.plechMm || 8, fy = 235;
    var NRdPas = 2*bp*tp*fy/1000;                      // dvě ramena, γ_M0 = 1,0
    var potreba = Math.ceil(N/(kmod*sv.naSvornikKN/gM) - 1e-9);
    var radky = [
      radek("Třmen věšáku — svorníky M" + sv.d + " ocel–dřevo", "N_Ed ≤ k_mod·n·F_v,Rk/γ_M   (EN 1995-1-1 8.2.3, " + sv.rezim + ")",
        "N_Ed = " + F(N) + " kN (tah ve věšáku); F_v,Rk = " + F(sv.FvRkKN) + " kN na střih, " + n + "× dvojstřižně → F_Rd = " + F(FRd) + " kN",
        (FRd > 0) ? N/FRd : 9),
      radek("Třmen věšáku — pásovina " + bp + "×" + tp + " v tahu", "N_Ed ≤ 2·A·f_y",
        "2 ramena × " + bp + "×" + tp + " mm, S235 → N_Rd = " + F(NRdPas) + " kN", N/NRdPas)
    ];
    return { radky:radky, svornik:sv, pocet:n, FRdKN:r3(FRd), potrebaKs:Math.max(2, potreba), vyhovuje: N<=FRd && N<=NRdPas };
  }

  /* RÁMOVÝ MODEL VAZBY VĚŠADLA. Souřadnice v metrech, viz PentiVesadlo.
       o.S, o.tlZdi, o.xh            rozpon líc–líc, tloušťka zdi, hřeben
       o.ulozeniOdM                  konec trámu od líce zdi (líc betonu věnce), 0 = líc
       o.hTramM                      výška trámu (osa v polovině)
       o.pataX [xL, xP]              průsečíky os vzpěr s osou trámu
       o.hlavaY                      výška uzlu hlavy (průsečík os) nad věncem
       o.VvrcholKN, o.VokapKN        reakce vaznic na vazbu (ULS)
       o.wTramKNm                    spojité po trámu (vlastní tíha + podhled)
       o.profily {tram, vesak, vzpera} [mm], o.trida, o.solver          */
  function vesadloRam(o){
    var solver = o.solver
      || (typeof global.PentiEngine !== "undefined" && global.PentiEngine.solveFrame2D);
    if(!solver) return null;
    var m = material(o.trida), E = m.Em*1e3;           // kPa (kN/m²)
    var pr = function(p){ var b=(p.b||140)/1000, h=(p.h||140)/1000; return { EA:E*b*h, EI:E*b*h*h*h/12 }; };
    var T = pr(o.profily.tram), V = pr(o.profily.vesak), Z = pr(o.profily.vzpera);
    var y0 = o.hTramM/2, S = o.S, tl = o.tlZdi, xh = o.xh;
    /* podpora uprostřed uložení trámu: od konce trámu (líc betonu věnce,
       `ulozeniOdM`) po vnitřní líc zdi; bez zadání = střed zdi */
    var uOd = Math.max(0, +o.ulozeniOdM || 0);
    var xA = (uOd + tl)/2, xB = S - (uOd + tl)/2, xF1 = o.pataX[0], xF2 = o.pataX[1];
    if(!(xF1 > xA - 0.3) || !(xF2 < xB + 0.3) || !(xh > xF1) || !(xh < xF2)) return null;
    /* uzly trámu: A, dělení, F1, dělení, D, dělení, F2, dělení, B */
    var nodes = [], tramUzly = [];
    var pridejUsek = function(x0, x1, dilu){
      for(var i=0;i<dilu;i++){ var x = x0 + (x1-x0)*i/dilu; nodes.push([x, y0]); tramUzly.push(nodes.length-1); }
    };
    var dil = 3;
    pridejUsek(xA, xF1, dil); var iF1 = nodes.length;
    pridejUsek(xF1, xh, dil); var iD = nodes.length;
    pridejUsek(xh, xF2, dil); var iF2 = nodes.length;
    pridejUsek(xF2, xB, dil); nodes.push([xB, y0]); tramUzly.push(nodes.length-1);
    var iA = 0, iB = nodes.length-1;
    nodes.push([xh, o.hlavaY]); var iC = nodes.length-1;
    var el = [];
    for(var k=0;k+1<tramUzly.length;k++) el.push({ a:tramUzly[k], b:tramUzly[k+1], EA:T.EA, EI:T.EI });
    var KLOUB = 1e-6;                                   // pruty s klouby: skoro nulová ohybová tuhost
    var iVes = el.length; el.push({ a:iD, b:iC, EA:V.EA, EI:V.EI*KLOUB });
    var iVzL = el.length; el.push({ a:iF1, b:iC, EA:Z.EA, EI:Z.EI*KLOUB });
    var iVzP = el.length; el.push({ a:iF2, b:iC, EA:Z.EA, EI:Z.EI*KLOUB });
    var fixed = [iA*3, iA*3+1, iB*3+1], loads = {};
    var pridej = function(uzel, silaDolu){ loads[uzel*3+1] = (loads[uzel*3+1]||0) - silaDolu; };
    pridej(iC, +o.VvrcholKN || 0);
    pridej(iA, +o.VokapKN || 0); pridej(iB, +o.VokapKN || 0);
    var w = +o.wTramKNm || 0;
    if(w > 0) for(var u=0;u<tramUzly.length;u++){
      var xi = nodes[tramUzly[u]][0];
      var xp = (u>0) ? nodes[tramUzly[u-1]][0] : xi, xn = (u+1<tramUzly.length) ? nodes[tramUzly[u+1]][0] : xi;
      pridej(tramUzly[u], w*((xi-xp)/2 + (xn-xi)/2));
    }
    var r = solver(nodes, el, fixed, loads);
    if(!r) return null;
    var os = function(i){ return r.forces[i][0]; };
    var Nves = os(iVes), NvzL = os(iVzL), NvzP = os(iVzP);
    var Ntram = 0, Mmax = 0, xM = 0, Vmax = 0, MuPaty = 0, Muzel = 0;
    for(var e=0;e<iVes;e++){
      var fo = r.forces[e];
      if(-fo[0] > Ntram) Ntram = -fo[0];                // tah je záporný
      [fo[2], fo[5]].forEach(function(M, j){
        if(Math.abs(M) > Mmax){ Mmax = Math.abs(M); xM = nodes[j ? el[e].b : el[e].a][0]; }
      });
      Vmax = Math.max(Vmax, Math.abs(fo[1]), Math.abs(fo[4]));
    }
    /* moment v místě paty vzpěry (uzly iF1, iF2) */
    var Mu = function(uzel){
      var mx = 0;
      el.forEach(function(x, e){ if(e >= iVes) return; if(x.a===uzel) mx = Math.max(mx, Math.abs(r.forces[e][2])); if(x.b===uzel) mx = Math.max(mx, Math.abs(r.forces[e][5])); });
      return mx;
    };
    MuPaty = Math.max(Mu(iF1), Mu(iF2));
    return {
      NvzperaKN: r3(Math.max(NvzL, NvzP)),               // tlak (+)
      /* Věšák visí na třmenu a pod ním je mezera — tlak přenést nemůže.
         Když model spočítá nepatrný tlak (lehký trám bez podhledu se
         mezi patami vzpěr unese sám), bere se nula. */
      NvesakKN: r3(Math.max(0, -Nves)),                  // tah (+)
      NvesakModelKN: r3(-Nves),
      NtramKN: r3(Ntram),                                // tah v trámu
      MtramKNm: r3(Mmax), xMtramM: r2(xM), MpatyKNm: r3(MuPaty), VtramKN: r3(Vmax),
      /* moment uprostřed trámu pod věšákem — tam je dlab pro spodní čep (9. 10. 2026) */
      MstredKNm: r3(Mu(iD)),
      VaKN: r3(r.R[iA*3+1]), VbKN: r3(r.R[iB*3+1]), HaKN: r3(Math.abs(r.R[iA*3])),
      vzperaTlak: NvzL >= 0 && NvzP >= 0, vesakTah: Nves < -0.01,
      uzly: nodes.length, prvky: el.length
    };
  }

  global.PentiStatika = {
    ramHambalek: ramHambalek, hambalekObalka: hambalekObalka,
    /* věšadlo (22. 9. 2026) */
    vesadloRam: vesadloRam, posudekZapusteni: posudekZapusteni, posudekTrmenu: posudekTrmenu,
    unosnostSvornikuOcel: unosnostSvornikuOcel, pevnostPodUhlem: pevnostPodUhlem,
    KOTVA_HUS4H10: KOTVA_HUS4H10, radek: radek,
    krivkaPaty: krivkaPaty, naKrivce: naKrivce, venecNosnik: venecNosnik, venecPosudek: venecPosudek, BETONY: BETONY,
    posudekSpojeKrokvePozednice: posudekSpojeKrokvePozednice, VRUT_SWWP: VRUT_SWWP,
    unosnostSvornikuJednostrizne: unosnostSvornikuJednostrizne, tuhostSvorniku: tuhostSvorniku, RHO_MEAN: RHO_MEAN,
    spojityNosnik: spojityNosnik,
    tuhostEI: tuhostEI,
    posudekNarozniku: posudekNarozniku,
    navrhniNaroznik: navrhniNaroznik,
    podporyNarozniku: podporyNarozniku,
    VYSKY_HRANOLU: VYSKY_HRANOLU,
    deleniVaznice: deleniVaznice, deleniNadPodporami: deleniNadPodporami,
    MATERIALY: MATERIALY, KMOD: KMOD, KDEF: KDEF,
    material: material, navrhovePevnosti: navrhovePevnosti,
    snihNaStrese: snihNaStrese, SNIH_SK: SNIH_SK,
    vitr: vitr, saniVetru: saniVetru, kombinace: kombinace,
    soucinitelVzperu: soucinitelVzperu, prurez: prurez,
    K_CR: K_CR, smykObdelniku: smykObdelniku,
    posudekKrokve: posudekKrokve, prostyNosnikObecny: prostyNosnikObecny, posudekNosnikuVikyre: posudekNosnikuVikyre, posudekOsedlani: posudekOsedlani, posudekOhybTlak: posudekOhybTlak,
    posudekVaznice: posudekVaznice, posudekSloupku: posudekSloupku,
    kotveniPozednice: kotveniPozednice, KOTVA_HUS4H10: KOTVA_HUS4H10,
    zonyVetru: zonyVetru,
    rozperVazby: rozperVazby, posudekKlestiny: posudekKlestiny,
    posudekPasku: posudekPasku, svornikPodklady: svornikPodklady,
    unosnostSvorniku: unosnostSvorniku, pocetSvorniku: pocetSvorniku,
    navrhniSvorniky: navrhniSvorniky, PRUMERY_SVORNIKU: PRUMERY_SVORNIKU,
    souhrn: souhrn
  };
})(typeof window !== "undefined" ? window : globalThis);
