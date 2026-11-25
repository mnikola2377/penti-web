/* ==========================================================================
   PENTI — VÝPOČETNÍ JÁDRO DŘEVOSTAVEB (sloupkové/rámové stěny)
   --------------------------------------------------------------------------
   Převzato z kalkulačky dřevostaveb, kde byly vzorce ověřené s majitelem.
   Výpočty materiálu jsou beze změny. ZMĚNIL SE POUZE MODEL CENY PRÁCE:

     dřív:  jeden paušál za m² stěny (850 Kč/m² — dočasná výplň)
     teď:   tři samostatné sazby
            1) výroba a montáž konstrukce  — Kč / bm fošen
            2) opláštění                   — Kč / m² nařízané plochy
            3) manipulace ve výrobě        — Kč / t celkové hmotnosti

   Hmotnost jádro dřív nepočítalo, teď ano:
     dřevo    = kubatura vč. odpadu × 0,45 t/m³ (stejný přepočet jako u střech)
     opláštění = plocha vč. připřezu × hmotnost desky (kg/m², viz HMOTNOSTI_DESEK)

   Používá se stejně jako střešní jádro: window.PentiDrevostavba.spocitat(zadani, ceny)
   ========================================================================== */

window.PentiDrevostavba = (function(){

  /* --- Průřezy profilů (m²) pro výpočet objemu KVH ---
     KVH se cení na m³, takže z bm × průřez dostaneme objem.
     Steico Joist je dutý I-nosník → nelze cenit objemem, cení se na bm. */
  const PRUREZY = {
    kvh60x80:  0.06 * 0.08,   // = 0,0048 m² — příčka 80 mm
    kvh60x100: 0.06 * 0.10,   // = 0,0060 m² — příčka 100 mm
    kvh60x160: 0.06 * 0.16,   // = 0,0096 m²
    kvh60x200: 0.06 * 0.20,   // = 0,0120 m²
    preklad160x200: 0.16 * 0.20, // = 0,0320 m²
    preklad160x240: 0.16 * 0.24  // = 0,0384 m²
  };
  /* Které profily se cení objemem (KVH) a které na bm (Steico) */
  const JE_STEICO = p => p === 'steico240' || p === 'steico300';

  /* --- Přepočet dřeva na hmotnost ---
     0,45 t/m³ = sušené jehličnaté řezivo. Stejná hodnota, jakou používá
     střešní kalkulačka pro přesun hmot, ať obě části počítají stejně. */
  const DREVO_T_NA_M3 = 0.45;

  /* --- Hmotnost opláštění (kg na m² desky) ---
     POZOR: ORIENTAČNÍ HODNOTY z běžných technických listů — ve skladu nejsou
     evidované. Ovlivňují jen sazbu za manipulaci, ne spotřebu materiálu.
     Až budou známy skutečné hodnoty, přepsat tady. */
  const HMOTNOSTI_DESEK = {
    dhf:        9.0,    // dřevovláknitá deska ~15 mm
    rigistabil: 13.0,   // sádrovláknitá deska ~12,5 mm
    osb:        10.0,   // OSB 3 ~15 mm
    fermacell125: 15.0, // Fermacell 12,5 mm ~1 200 kg/m³ (5. 10. 2026)
    osb25:      16.0    // OSB 3 25 mm ~640 kg/m³ (5. 10. 2026)
  };
  /* Steico Joist je dutý nosník — hmotnost na bm, ne z objemu */
  const HMOTNOST_STEICO_KG_BM = { steico240: 5.4, steico300: 6.2 };

  /* --- Pomocná tabulka: profil překladu podle šířky otvoru ---
     Hodnoty jsou OBECNÉ (dle běžné praxe). Uživatel/firma si je může upravit.
     Pravidlo: čím širší otvor, tím vyšší profil překladu.
     Nad 2,5 m a u rohových oken → upozornění na statika. */
  const TABULKA_PREKLADU = [
    { doSirky:1.2, profil:'profilSloupku', popis:'profil sloupku (60×160/200)' },
    { doSirky:2.0, profil:'preklad160x200', popis:'překlad 160×200' },
    { doSirky:2.8, profil:'preklad160x240', popis:'překlad 160×240' },
    { doSirky:Infinity, profil:'preklad160x240', popis:'překlad 160×240 — NUTNÝ STATIK' }
  ];

  /* Vybere profil překladu podle šířky otvoru */
  function vyberPreklad(sirka){
    for(const r of TABULKA_PREKLADU){
      if(sirka <= r.doSirky) return r;
    }
  }

  /* Spočítá obvod a délku stěn podle tvaru a rozměrů (v metrech).
     Vrací { obvod, pocetRohu, steny:[délky jednotlivých stěn] } */
  function geometrie(tvar, r){
    let steny=[], rohy=0;
    if(tvar==='vlastni' && r.body && r.body.length>=3){
      // nakreslený obrys: délky stěn = vzdálenosti mezi sousedními body
      // (poslední bod se spojuje s prvním — uzavřený obrys)
      const b=r.body;
      for(let i=0;i<b.length;i++){
        const p=b[i], q=b[(i+1)%b.length];
        steny.push(Math.hypot(q[0]-p[0], q[1]-p[1]));
      }
      rohy=b.length;
    } else if(tvar==='obdelnik' || tvar==='ctverec'){
      // 4 stěny, 4 rohy
      steny=[r.a, r.b, r.a, r.b];
      rohy=4;
    } else if(tvar==='L'){
      // L má 6 stran a 6 rohů (jeden vnitřní)
      // a = celková šířka, b = celková výška, c = výřez šířka, d = výřez výška
      steny=[r.a, r.d, r.a - r.c, r.b - r.d, r.c, r.b];
      rohy=6;
    } else if(tvar==='U'){
      // U má 8 stran a 8 rohů (dva vnitřní)
      // a = celková šířka, b = celková výška, c = šířka výřezu, d = hloubka výřezu
      steny=[r.a, r.b, (r.a-r.c)/2, r.d, r.c, r.d, (r.a-r.c)/2, r.b];
      rohy=8;
    }
    const obvod = steny.reduce((s,x)=>s+x, 0);
    return { obvod, pocetRohu:rohy, steny };
  }

  /* Hlavní výpočet. zadani = {tvar, rozmery, vyska, roztec, profil, oplasteni, prorez, otvory[]} */
  function spocitat(zadani, ceny){
    const g = geometrie(zadani.tvar, zadani.rozmery);
    const vyska = zadani.vyska;          // výška stěny v m
    const roztec = zadani.roztec/1000;   // mm → m
    const polozky = [];                  // jednotlivé řádky výsledku
    const DELKA_TYCE = 13;               // KVH se kupuje po 13m kusech
    const bmPodleProfilu = {};           // sčítá čisté bm pro každý KVH profil zvlášť

    /* Pomocná funkce: přidá položku z KVH/Steico dřeva.
       - KVH: počítá ČISTOU kubaturu (co je ve stěně) i REÁLNOU spotřebu
              (čistá × přirážka na odpad z řezání). Cení se reálná spotřeba,
              protože platíte za to, co koupíte. Délky (bm) se zároveň sčítají
              podle profilu — počet 13m tyčí se spočítá až na konci ze součtu,
              aby se využily odřezky napříč prvky stejného profilu.
       - Steico: cena = bm × cena za bm (bez přepočtu na tyče). */
    function pridejDrevo(skupina, nazev, bm, profilKlic, extraInfo){
      if(JE_STEICO(profilKlic)){
        polozky.push({ skupina, nazev, mnozstvi:bm, jedn:'bm', druh:'bm', cenaKlic:profilKlic, info:extraInfo });
      } else {
        const prurez = PRUREZY[profilKlic] || 0;
        const objemCisty = bm * prurez;                          // co je ve stěně
        const objemRealny = objemCisty * (1 + zadani.odpad/100); // co reálně koupíte (cena z tohoto)
        // posbírej bm podle profilu (pro výpočet tyčí na konci)
        bmPodleProfilu[profilKlic] = (bmPodleProfilu[profilKlic] || 0) + bm;
        polozky.push({
          skupina, nazev,
          mnozstvi:objemRealny, jedn:'m³', druh:'objem', cenaKlic:'kvhM3',
          info:(extraInfo||'')+` (čistě ${bm.toFixed(1)} bm / ${objemCisty.toFixed(3)} m³)`,
          objemCisty
        });
      }
    }

    /* --- 1) SVISLÉ SLOUPKY (základní rastr) ---
       Počet sloupků = obvod / rozteč + 1 (koncový).
       Přídavek za rohy: každý roh = 3 sloupky místo 1 → +2 navíc/roh.
       Dřevo KOLEM OTVORŮ (king/jack study, cripples) se počítá zvlášť
       v sekci 3 podle nastudovaných pravidel rámování — přesněji než dřív. */
    const pocetZakl = Math.ceil(g.obvod / roztec) + 1;
    const pridavekRohy = g.pocetRohu * 2;
    const pocetSloupku = pocetZakl + pridavekRohy;
    const bmSloupky = pocetSloupku * vyska;
    pridejDrevo('Nosná konstrukce', `Svislé sloupky (${pocetSloupku} ks)`, bmSloupky, zadani.profil);

    /* --- 1b) SLOUPKY NA SPÁRY DESEK (přizpůsobení opláštění) ---
       Deska opláštění (1250 mm) potřebuje na spáře sloupek. Rastr 625 většinu
       spár pokryje, ale u rohů/za otvory se rastr posune a spára padne mimo.
       Doplníme sloupek na každou spáru, kde v rastru není. Jen v režimu kreslení,
       kde známe délky jednotlivých stěn. */
    const sirkaDesky = 1.25;
    let pocetSpar = 0;
    if(zadani.tvar==='vlastni' && zadani.rozmery.body && zadani.rozmery.body.length>=3){
      const b = zadani.rozmery.body;
      for(let i=0;i<b.length;i++){
        const A=b[i], B=b[(i+1)%b.length];
        const delkaS = Math.hypot(B[0]-A[0], B[1]-A[1]);
        // rastrové pozice na této stěně
        const rastr=[];
        for(let x=0;x<delkaS-0.001;x+=roztec) rastr.push(x);
        rastr.push(delkaS);
        // spáry desek po 1,25 m, které nemají rastrový sloupek
        for(let x=sirkaDesky; x<delkaS-0.05; x+=sirkaDesky){
          if(!rastr.some(p=>Math.abs(p-x)<0.03)) pocetSpar++;
        }
      }
    }
    if(pocetSpar>0){
      const bmSpary = pocetSpar * vyska;
      pridejDrevo('Nosná konstrukce', `Sloupky na spáry desek (${pocetSpar} ks)`, bmSpary, zadani.profil);
    }

    /* --- 2) VODOROVNÉ PRVKY: spodní práh + dvojitá horní pásnice ---
       Nosná stěna má dole 1 práh a nahoře DVOJITOU pásnici (2 vrstvy, které
       se v rozích převazují). Celkem 3 vodorovné vrstvy → obvod × 3.
       Množství je stejné jako dřív (dřív nazváno "práh + pásnice + věnec"). */
    const bmVodorovne = g.obvod * 3;
    pridejDrevo('Nosná konstrukce', 'Spodní práh + dvojitá horní pásnice', bmVodorovne, zadani.profil);

    /* --- 3) PŘEKLADY + PARAPETY + RÁMOVÁNÍ OTVORŮ ---
       Podle nastudovaných pravidel rámování sloupkové dřevostavby. Pro každý otvor:
       - PŘEKLAD (header): vodorovný nosník nad otvorem, délka = šířka + 0,4 m uložení
       - KING STUD (nárožní sloupek): 1 na stranu, plný přes celou výšku stěny
       - JACK STUD (ostění): 1 na stranu (do 2,5 m) / 2 na stranu (nad 2,5 m),
         výška = od prahu k překladu = výška otvoru (+ parapet u oken)
       - NADPRAŽNÍ CRIPPLE: krátké sloupky mezi překladem a pásnicí, v rastru 625
       - PARAPETNÍ PRÁH (jen okna) + PARAPETNÍ CRIPPLE pod ním (jen okna)
       King/jack/cripple se počítají v profilu sloupku (stejný jako stěna). */
    let bmPreklad200=0, bmPreklad240=0, bmParapet=0;
    let bmRamovani=0;  // king + jack + cripple study kolem otvorů (bm, profil sloupku)
    let nutnyStatik=false;
    let pocetPrekladu=0;
    const vyskaPrekladu=0.2; // přibližná výška překladového nosníku (m)
    zadani.otvory.forEach(o=>{
      const p = vyberPreklad(o.sirka);
      const delkaPrekladu = o.sirka + 0.4;
      if(p.profil==='preklad160x200'){ bmPreklad200 += delkaPrekladu; pocetPrekladu++; }
      else if(p.profil==='preklad160x240'){ bmPreklad240 += delkaPrekladu; pocetPrekladu++; }
      if(p.popis.includes('STATIK')) nutnyStatik=true;
      if(o.roh) nutnyStatik=true;

      const jeOkno = o.typ==='okno';
      const parapet = jeOkno ? (o.parapet||0) : 0;
      // výška otvoru: spodní hrana (parapet) → horní hrana (parapet + výška)
      const hornHrana = parapet + o.vyska;

      // KING STUDY: 2 ks, plné přes celou výšku
      bmRamovani += 2 * vyska;
      // JACK STUDY: 1 nebo 2 na stranu podle šířky, výška = k překladu (horní hrana otvoru)
      const jackNaStranu = o.sirka > 2.5 ? 2 : 1;
      bmRamovani += 2 * jackNaStranu * hornHrana;
      // NADPRAŽNÍ CRIPPLE: krátké sloupky nad překladem, v rastru přes šířku otvoru
      const pocetCrippleNad = Math.max(0, Math.floor(o.sirka/roztec));
      const delkaCrippleNad = Math.max(0, vyska - hornHrana - vyskaPrekladu);
      bmRamovani += pocetCrippleNad * delkaCrippleNad;
      // PARAPETNÍ ČÁST (jen okna): práh + cripple pod parapetem
      if(jeOkno){
        bmParapet += o.sirka; // parapetní práh
        const pocetCrippleParapet = Math.max(0, Math.floor(o.sirka/roztec));
        bmRamovani += pocetCrippleParapet * parapet; // sloupky pod parapetem
      }
    });
    if(bmPreklad200>0) pridejDrevo('Otvory', 'Překlady 160×200', bmPreklad200, 'preklad160x200');
    if(bmPreklad240>0) pridejDrevo('Otvory', 'Překlady 160×240', bmPreklad240, 'preklad160x240');
    if(bmParapet>0) pridejDrevo('Otvory', 'Parapetní prahy', bmParapet, zadani.profil);
    if(bmRamovani>0) pridejDrevo('Otvory', 'Rámování otvorů (king/jack/cripple)', bmRamovani, zadani.profil);

    /* --- 4) OPLÁŠTĚNÍ (jen vnější strana) ---
       Plocha stěn = obvod × výška, mínus plocha otvorů, plus prořez. */
    const plochaSteny = g.obvod * vyska;
    const plochaOtvoru = zadani.otvory.reduce((s,o)=>s + o.sirka*o.vyska, 0);
    const plochaCista = Math.max(0, plochaSteny - plochaOtvoru);
    const plochaSProrezem = plochaCista * (1 + zadani.prorez/100);
    polozky.push({ skupina:'Opláštění', nazev:'Opláštění vnější (s prořezem)', mnozstvi:plochaSProrezem, jedn:'m²', druh:'bm', cenaKlic:zadani.oplasteni });

    /* --- 5a) SPONKY na opláštění ---
       Deska se kotví po celém obvodu i v ploše. Sčítáme délku všech
       sponkovaných linií, rozteč 20 ks/bm (50 mm) všude:
        1) svislé spáry mezi deskami ≈ plocha / šířka desky (1,25 m)
        2) vodorovné pasy: obvod × 2 (spodní práh + horní pásnice)
        3) svislé linie do každého sloupku: počet sloupků × výška
           (deska se kotví do každého sloupku, přes který přechází) */
    const bmSpary = plochaCista / 1.25;            // svislé spáry mezi deskami
    const bmPasy = g.obvod * 2;                    // spodní + horní pas po obvodu
    const bmSloupkoveLinhie = pocetSloupku * vyska;// kotvení do každého sloupku
    const bmSponkovaneLinie = bmSpary + bmPasy + bmSloupkoveLinhie;
    const pocetSponek = bmSponkovaneLinie * 20;    // 20 ks na bm (rozteč 50 mm)
    polozky.push({ skupina:'Spojovací materiál', nazev:'Sponky opláštění', mnozstvi:pocetSponek, jedn:'ks', druh:'bm', cenaKlic:'sponka',
                   info:`${Math.round(bmSponkovaneLinie)} bm linií (spáry ${Math.round(bmSpary)} + pasy ${Math.round(bmPasy)} + sloupky ${Math.round(bmSloupkoveLinhie)})` });

    /* --- 5b) VRUTY 6×140 talířová hlava (vždy 2 ks/spoj) ---
       Schválené počty: 6 vrutů/sloupek (osazení 4 + věnec 2) + 4 vruty/překlad. */
    const pocetVrutu = pocetSloupku * 6 + pocetPrekladu * 4;
    polozky.push({ skupina:'Spojovací materiál', nazev:`Vruty 6×140 (sloupky + překlady)`, mnozstvi:pocetVrutu, jedn:'ks', druh:'bm', cenaKlic:'vrut' });

    /* --- 6) PRÁCE ---
       Řeší se až na konci výpočtu (po příčkách), aby se sečetly běžné metry
       a hmotnost za celou stavbu včetně příček. Viz blok „CENA PRÁCE" níže. */

    /* ======================================================================
       VNITŘNÍ NENOSNÉ PŘÍČKY
       Každá příčka zadaná v seznamu: { delka, tloustka(80/100), dvere }.
       - sloupky: délka/rozteč + 1, + 2 za každé dveře (ostění) → × výška
       - prahy + pásnice: délka × 2 (bez věnce, příčka je nenosná)
       - opláštění: délka × výška × 1 strana (jednostranně RigiStabil) − dveře + prořez
       - sponky: pasy (délka×2) + sloupky (počet×výška) + spáry, jen 1 strana
       - vruty: 4/sloupek (bez věnce)
       Profil: 60×80 nebo 60×100 podle tloušťky, cení se objemem (kvhM3).
       Vše jde do samostatné skupiny 'Vnitřní příčky'. */
    let prickyPlochaCelkem = 0;     // pro práci
    (zadani.pricky || []).forEach((pr, idx)=>{
      if(!pr.delka || pr.delka<=0) return;
      const profilPr = pr.tloustka==100 ? 'kvh60x100' : 'kvh60x80';
      const nazevTl = pr.tloustka==100 ? '100' : '80';

      // sloupky příčky
      const sloupkuPr = Math.ceil(pr.delka/roztec) + 1 + (pr.dvere||0)*2;
      const bmSloupkyPr = sloupkuPr * vyska;
      pridejDrevo('Vnitřní příčky', `Příčka ${idx+1} (${pr.delka} m, tl. ${nazevTl}) — sloupky (${sloupkuPr} ks)`, bmSloupkyPr, profilPr);

      // prahy + pásnice (bez věnce)
      const bmVodorovnePr = pr.delka * 2;
      pridejDrevo('Vnitřní příčky', `Příčka ${idx+1} — práh + pásnice`, bmVodorovnePr, profilPr);

      // opláštění jednostranně
      const plochaPr = pr.delka * vyska;
      const plochaDvere = (pr.dvere||0) * 0.9 * 2.0; // typické dveře 0,9×2,0
      const plochaPrCista = Math.max(0, plochaPr - plochaDvere);
      const plochaPrProrez = plochaPrCista * (1 + zadani.prorez/100);
      prickyPlochaCelkem += plochaPr;
      polozky.push({ skupina:'Vnitřní příčky', nazev:`Příčka ${idx+1} — opláštění RigiStabil (1 strana)`, mnozstvi:plochaPrProrez, jedn:'m²', druh:'bm', cenaKlic:'rigistabil' });

      // sponky (1 strana): pasy + sloupky + spáry
      const bmSparyPr = plochaPrCista / 1.25;
      const bmPasyPr = pr.delka * 2;
      const bmSloupkyLinPr = sloupkuPr * vyska;
      const pocetSponekPr = (bmSparyPr + bmPasyPr + bmSloupkyLinPr) * 20;
      polozky.push({ skupina:'Vnitřní příčky', nazev:`Příčka ${idx+1} — sponky`, mnozstvi:pocetSponekPr, jedn:'ks', druh:'bm', cenaKlic:'sponka' });

      // vruty 4/sloupek (bez věnce)
      const vrutyPr = sloupkuPr * 4;
      polozky.push({ skupina:'Vnitřní příčky', nazev:`Příčka ${idx+1} — vruty 6×140`, mnozstvi:vrutyPr, jedn:'ks', druh:'bm', cenaKlic:'vrut' });
    });
    /* ======================================================================
       CENA PRÁCE — tři samostatné sazby (nahradily dřívější paušál za m²)
       ====================================================================== */

    /* 1) Běžné metry fošen — sečtou se všechny délky řeziva (sloupky, prahy,
          pásnice, překlady, rámování otvorů i příčky). To je základ pro sazbu
          za výrobu a montáž konstrukce. */
    let bmFosenCelkem = 0;
    for(const p in bmPodleProfilu) bmFosenCelkem += bmPodleProfilu[p];

    /* 2) Nařízaná plocha opláštění — obvodové stěny s připřezem + příčky.
          Účtuje se to, co skutečně projde rukama, ne čistá plocha stěny. */
    const plochaOplasteniCelkem = plochaSProrezem + prickyPlochaCelkem;

    /* 3) Celková hmotnost — vše, co se do výroby doveze, včetně odpadu.
          Dřevo z kubatury (0,45 t/m³), Steico z běžných metrů, desky z plochy. */
    let hmotnostDrevaT = 0;
    polozky.forEach(p=>{
      if(p.druh === 'objem') hmotnostDrevaT += (p.mnozstvi || 0) * DREVO_T_NA_M3;   // mnozstvi = kubatura vč. odpadu
    });
    let hmotnostSteicoT = 0;
    for(const profil in bmPodleProfilu){
      if(HMOTNOST_STEICO_KG_BM[profil]){
        const bmSOdpadem = bmPodleProfilu[profil] * (1 + zadani.odpad/100);
        hmotnostSteicoT += bmSOdpadem * HMOTNOST_STEICO_KG_BM[profil] / 1000;
      }
    }
    const kgDesky = HMOTNOSTI_DESEK[zadani.oplasteni] || 0;
    const hmotnostDeskyT = plochaOplasteniCelkem * kgDesky / 1000;
    const hmotnostCelkemT = hmotnostDrevaT + hmotnostSteicoT + hmotnostDeskyT;

    polozky.push({ skupina:'Práce', nazev:'Výroba a montáž konstrukce',
      mnozstvi:+bmFosenCelkem.toFixed(1), jedn:'bm', druh:'bm', cenaKlic:'prace_konstrukce_bm',
      info:'běžné metry veškerého řeziva včetně rámování otvorů a příček' });

    polozky.push({ skupina:'Práce', nazev:'Opláštění',
      mnozstvi:+plochaOplasteniCelkem.toFixed(2), jedn:'m²', druh:'bm', cenaKlic:'prace_oplasteni_m2',
      info:'nařízaná plocha desek včetně připřezu' });

    polozky.push({ skupina:'Práce', nazev:'Manipulace ve výrobě',
      mnozstvi:+hmotnostCelkemT.toFixed(3), jedn:'t', druh:'bm', cenaKlic:'prace_manipulace_t',
      info:'dřevo '+hmotnostDrevaT.toFixed(2)+' t + desky '+hmotnostDeskyT.toFixed(2)+' t'
           +(hmotnostSteicoT>0?(' + Steico '+hmotnostSteicoT.toFixed(2)+' t'):'')+', vše včetně odpadu' });

    /* --- Dopočet cen ---
       Každá položka má 'druh': 'objem' (KVH za m³) nebo 'bm' (cena × množství).
       U obou je výpočet stejný (množství × cena za jednotku), jen jednotka se liší. */
    let celkem=0;
    polozky.forEach(p=>{
      const cena = ceny[p.cenaKlic] || 0;
      p.cenaJedn = cena;
      p.cenaCelkem = p.mnozstvi * cena;
      celkem += p.cenaCelkem;
    });

    /* --- Souhrn KVH ---
       Tyče se počítají PODLE PROFILU: pro každý profil sečteme čisté bm,
       přidáme odpad a teprve pak rozpočítáme na 13m tyče (zaokrouhleno nahoru).
       Tím se odřezky využijí napříč prvky stejného profilu. */
    let kvhCistaKubatura=0, kvhRealnaKubatura=0, kvhTyce=0;
    const tyceDleProfilu = [];   // pro výpis: [{profil, bm, tyce}]
    for(const profil in bmPodleProfilu){
      const bm = bmPodleProfilu[profil];
      const bmRealny = bm * (1 + zadani.odpad/100);
      const tyce = Math.ceil(bmRealny / DELKA_TYCE);
      kvhTyce += tyce;
      tyceDleProfilu.push({ profil, bm, tyce });
    }
    // čistá a reálná kubatura ze všech objemových položek
    polozky.forEach(p=>{
      if(p.druh==='objem'){
        kvhCistaKubatura += p.objemCisty || 0;
        kvhRealnaKubatura += p.mnozstvi || 0;
      }
    });

    /* --- ROZPIS PO STĚNÁCH (jen pro kreslení, kde otvory znají svou stěnu) ---
       Pro každou stěnu spočítáme její sloupky (pozice po rozteči od rohu)
       a seznam otvorů na ní. Souhrnný výpočet výše tím není dotčen — tohle je
       navíc, jako "mapa" pro pohledy na stěny a budoucí DXF export. */
    let steny = null;
    if(zadani.tvar==='vlastni' && zadani.rozmery.body && zadani.rozmery.body.length>=3){
      const b = zadani.rozmery.body;
      steny = [];
      for(let i=0;i<b.length;i++){
        const A=b[i], B=b[(i+1)%b.length];
        const delka = Math.hypot(B[0]-A[0], B[1]-A[1]);
        // pozice sloupků na stěně: základní rastr od 0 po rozteči + koncový
        let poziceSloupku = [];
        for(let x=0; x<delka-0.001; x+=roztec) poziceSloupku.push(+x.toFixed(3));
        poziceSloupku.push(+delka.toFixed(3)); // koncový sloupek
        // PŘIZPŮSOBENÍ OPLÁŠTĚNÍ: doplň sloupek na každou spáru desky (1250 mm),
        // pokud tam ještě sloupek není. Deska drží spáru → spára musí mít sloupek.
        const sirkaDesky = 1.25; // formát desky opláštění (m)
        for(let x=sirkaDesky; x<delka-0.05; x+=sirkaDesky){
          const jeTam = poziceSloupku.some(p => Math.abs(p-x)<0.03); // už tam sloupek je?
          if(!jeTam) poziceSloupku.push(+x.toFixed(3));
        }
        poziceSloupku.sort((a,b)=>a-b); // seřaď podle polohy
        // otvory na této stěně (z CAD otvorů, které mají index stěny)
        const otvoryNaStene = (zadani.otvory||[])
          .filter(o => o.stena===i)
          .map(o=>{
            const pre = vyberPreklad(o.sirka);
            return {
              odRohu:o.odRohu, sirka:o.sirka, vyska:o.vyska,
              parapet:o.parapet||0, typ:o.typ,
              preklad:pre.popis, nutnyStatik:pre.popis.includes('STATIK')||!!o.roh
            };
          })
          .sort((p,q)=>p.odRohu-q.odRohu);
        steny.push({
          cislo:i+1,            // S1, S2…
          delka:+delka.toFixed(3),
          vyska:zadani.vyska,
          pocetSloupku:poziceSloupku.length,
          poziceSloupku,        // vzdálenosti od počátečního rohu (m)
          otvory:otvoryNaStene
        });
      }
    }

    return { polozky, celkem, geometrie:g, nutnyStatik, plochaSteny, plochaCista,
             kvhCistaKubatura, kvhRealnaKubatura, kvhTyce, tyceDleProfilu, steny,
             /* podklady pro cenu práce — ať je v nabídce vidět, z čeho se počítá */
             bmFosenCelkem:+bmFosenCelkem.toFixed(1),
             plochaOplasteniCelkem:+plochaOplasteniCelkem.toFixed(2),
             hmotnost:{ celkemT:+hmotnostCelkemT.toFixed(3),
                        drevoT:+hmotnostDrevaT.toFixed(3),
                        deskyT:+hmotnostDeskyT.toFixed(3),
                        steicoT:+hmotnostSteicoT.toFixed(3) } };
  }

  /* ══════════════════════════════════════════════════════════════════════
     STĚNY Z MODELU MiTek PAMIRU (PENTI 5. 10. 2026, PLAN_drevostavba_z_pamiru
     krok 3). Dřevo se NEODHADUJE — bere se z modelu po profilech (bm, m³),
     jen se přidá odpad z řezání. Opláštění z obvodu stavby × výška stěn
     mínus skutečné otvory z IFC; příčky z obou stran. Spojovací materiál
     a práce stejnými pravidly a sazbami jako u odhadu, aby se výsledky daly
     porovnat. Vrací stejný tvar výsledku jako `spocitat`.

     m = souhrn z PentiPamirModel.sloz (Z.pamirModel)
     o = { oplasteni, oplasteniPricek, odpad, prorez }
     ════════════════════════════════════════════════════════════════════ */
  function spocitatZModelu(m, o, ceny){
    o = o || {};
    const polozky = [];
    const odpad = (+o.odpad || 0)/100, prorez = (+o.prorez || 0)/100;
    const DELKA_TYCE = 13;
    const tyceDleProfilu = [];
    let kvhCista = 0, kvhRealna = 0, kvhTyce = 0, bmFosen = 0;

    /* dřevo jedné části (obvodové stěny / příčky) po profilech */
    function drevo(skupina, dr, nazevCasti){
      (dr && dr.drevo || []).forEach(x => {
        const m3c = x.m3, m3r = m3c * (1 + odpad);
        const lep = !!x.lepene;
        polozky.push({ skupina, nazev:`${nazevCasti} ${x.klic}${lep?' (lepené)':''} — ${x.ks} ks`,
          mnozstvi:m3r, jedn:'m³', druh:'objem', cenaKlic: lep ? 'lepeneM3' : 'kvhM3',
          info:`z modelu Pamiru: ${x.bm.toFixed(2)} bm / ${m3c.toFixed(3)} m³ + odpad ${Math.round(odpad*100)} %`,
          objemCisty:m3c });
        kvhCista += m3c; kvhRealna += m3r; bmFosen += x.bm;
        const tyce = Math.ceil(x.bm * (1 + odpad) / DELKA_TYCE);
        kvhTyce += tyce; tyceDleProfilu.push({ profil:x.klic, bm:x.bm, tyce });
      });
    }
    const S = m.steny || {}, P = m.pricky || {};
    drevo('Nosná konstrukce', S.dr, 'Obvodové stěny');
    /* vaznice a sloupy nad terasou z IFC (rozhodnuto PENTI 6. 10. 2026:
       cení se v dřevostavbě; lepené GL za cenu lepeného dřeva) */
    if (m.podpory && m.podpory.dr) drevo('Nosná konstrukce', m.podpory.dr, 'Vaznice a sloupy nad terasou');

    /* --- opláštění vnější: obvod stavby × výška − otvory --- */
    const obvod = (m.obrys && m.obrys.obvodM) || S.delkaM || 0;
    /* výška opláštění = výška panelu obvodové stěny (PENTI 7. 10. 2026);
       starší uložené modely ji nemají → výška stěny */
    const vyska = S.vyskaOplM || S.vyskaM || 0;
    const plochaSteny = obvod * vyska;
    const plochaOtvoru = S.otvoryM2 || 0;
    const plochaCista = Math.max(0, plochaSteny - plochaOtvoru);
    const plochaSProrezem = plochaCista * (1 + prorez);
    const opl = o.oplasteni || 'fermacell125';
    polozky.push({ skupina:'Opláštění', nazev:'Opláštění vnější (s prořezem)', mnozstvi:plochaSProrezem, jedn:'m²', druh:'bm', cenaKlic:opl,
      info:`obvod ${obvod.toFixed(2)} m × výška ${vyska.toFixed(2)} m = ${plochaSteny.toFixed(2)} m² − otvory ${plochaOtvoru.toFixed(2)} m² (${(S.otvory||[]).length} ks z IFC) + prořez ${Math.round(prorez*100)} %` });

    /* --- spojovací materiál (stejná pravidla jako odhad) ---
       sponky: spáry desek (plocha / 1,25) + všechny prvky stěny (deska se
       kotví do každého prvku, přes který přechází), 20 ks/bm;
       vruty 6×140: 4 na prvek (2 na každém konci). */
    const prvkuSten = (S.dr && S.dr.drevo || []).reduce((a,x)=>a + x.ks, 0);
    const bmSten = (S.dr && S.dr.bm) || 0;
    const bmSponek = plochaCista / 1.25 + bmSten;
    polozky.push({ skupina:'Spojovací materiál', nazev:'Sponky opláštění', mnozstvi:bmSponek*20, jedn:'ks', druh:'bm', cenaKlic:'sponka',
      info:`${Math.round(bmSponek)} bm linií (spáry ${Math.round(plochaCista/1.25)} + prvky stěn ${Math.round(bmSten)})` });
    polozky.push({ skupina:'Spojovací materiál', nazev:`Vruty 6×140 (${prvkuSten} prvků × 4)`, mnozstvi:prvkuSten*4, jedn:'ks', druh:'bm', cenaKlic:'vrut' });

    /* --- štíty nad zdí (krok 5, zadání PENTI 5. 10. 2026) ---
       Fermacell 12,5 jako stěny: 2 boční štíty + vyšší čelo + nízký pás
       u okapu (pás jde vypnout). Plochy počítá penti-pamir-model.js
       z horního pásu vazníku. Sponky: spáry desek (plocha / 1,25)
       + svislé prvky štítového vazníku zhruba po 0,625 m (plocha / 0,625). */
    let plochaStitu = 0;
    const ST = m.stity;
    if(ST && o.stity !== false){
      const sPasem = o.stityPas !== false;
      const plSt = sPasem ? ST.plochaM2 : ST.plochaBezPasuM2;
      plochaStitu = plSt * (1 + prorez);
      /* sedlová střecha (156_23N): 2 štíty + 2 nízké pásy u okapu */
      const infoSt = ST.druh === 'sedlo'
        ? `2 štíty ${ST.stit.delkaM.toFixed(2)} m, výška ${ST.hPataM.toFixed(2)}→${ST.hHrebenM.toFixed(2)} m (${(2*ST.stit.plochaM2).toFixed(2)} m²)`
          + (sPasem ? ` + 2 nízké pásy u okapu ${ST.pas.delkaM.toFixed(2)} × ${ST.hPataM.toFixed(2)} m (${(2*ST.pas.plochaM2).toFixed(2)} m²)` : '')
          + ` = ${plSt.toFixed(2)} m² + prořez ${Math.round(prorez*100)} %; výšky z vazníku ${ST.vaznik}`
        : null;
      polozky.push({ skupina:'Štíty', nazev:'opláštění vnější (s prořezem)', mnozstvi:plochaStitu, jedn:'m²', druh:'bm', cenaKlic:opl,
        info: infoSt || `2 boční ${ST.bocni.delkaM.toFixed(2)} m × výška ${ST.hNizkaM.toFixed(2)}→${ST.hVysokaM.toFixed(2)} m (${(2*ST.bocni.plochaM2).toFixed(2)} m²) + vyšší čelo ${ST.celo.delkaM.toFixed(2)} × ${ST.hVysokaM.toFixed(2)} m (${ST.celo.plochaM2.toFixed(2)} m²)`
          + (sPasem ? ` + nízký pás ${ST.pas.delkaM.toFixed(2)} × ${ST.hNizkaM.toFixed(2)} m (${ST.pas.plochaM2.toFixed(2)} m²)` : '')
          + ` = ${plSt.toFixed(2)} m² + prořez ${Math.round(prorez*100)} %; výšky z vazníku ${ST.vaznik}` });
      const bmSpSt = plSt / 1.25 + plSt / 0.625;
      polozky.push({ skupina:'Štíty', nazev:'sponky', mnozstvi:bmSpSt*20, jedn:'ks', druh:'bm', cenaKlic:'sponka',
        info:`${Math.round(bmSpSt)} bm linií (spáry desek + svislé prvky po 0,625 m)` });
    }

    /* --- příčky: dřevo z modelu, opláštění z obou stran --- */
    let plochaPricek = 0;
    if(P.panely && P.panely.length && o.pricky !== false){
      drevo('Vnitřní příčky', P.dr, 'Příčky');
      const oplPr = o.oplasteniPricek || 'rigistabil';
      const plPr = Math.max(0, (P.plochaM2 || 0) - (P.otvoryM2 || 0)) * 2;
      plochaPricek = plPr * (1 + prorez);
      polozky.push({ skupina:'Vnitřní příčky', nazev:'Příčky — opláštění z obou stran (s prořezem)', mnozstvi:plochaPricek, jedn:'m²', druh:'bm', cenaKlic:oplPr,
        info:`2 × (${(P.plochaM2||0).toFixed(2)} m² − dveře ${(P.otvoryM2||0).toFixed(2)} m²) + prořez ${Math.round(prorez*100)} %` });
      const prvkuPr = (P.dr && P.dr.drevo || []).reduce((a,x)=>a + x.ks, 0);
      const bmSponekPr = plPr / 1.25 + 2 * ((P.dr && P.dr.bm) || 0);
      polozky.push({ skupina:'Vnitřní příčky', nazev:'Příčky — sponky', mnozstvi:bmSponekPr*20, jedn:'ks', druh:'bm', cenaKlic:'sponka',
        info:`${Math.round(bmSponekPr)} bm linií, obě strany` });
      polozky.push({ skupina:'Vnitřní příčky', nazev:`Příčky — vruty 6×140 (${prvkuPr} prvků × 4)`, mnozstvi:prvkuPr*4, jedn:'ks', druh:'bm', cenaKlic:'vrut' });
    }

    /* --- práce: stejné tři sazby jako u odhadu --- */
    const plochaOplasteniCelkem = plochaSProrezem + plochaStitu + plochaPricek;
    const hmotnostDrevaT = kvhRealna * DREVO_T_NA_M3;
    const hmotnostDeskyT = ((plochaSProrezem + plochaStitu) * (HMOTNOSTI_DESEK[opl] || 0)
                          + plochaPricek * (HMOTNOSTI_DESEK[o.oplasteniPricek || 'rigistabil'] || 0)) / 1000;
    const hmotnostCelkemT = hmotnostDrevaT + hmotnostDeskyT;
    polozky.push({ skupina:'Práce', nazev:'Výroba a montáž konstrukce', mnozstvi:+bmFosen.toFixed(1), jedn:'bm', druh:'bm', cenaKlic:'prace_konstrukce_bm',
      info:'běžné metry veškerého řeziva z modelu (stěny, vaznice a sloupy, příčky)' });
    polozky.push({ skupina:'Práce', nazev:'Opláštění', mnozstvi:+plochaOplasteniCelkem.toFixed(2), jedn:'m²', druh:'bm', cenaKlic:'prace_oplasteni_m2',
      info:'nařízaná plocha desek včetně připřezu' });
    polozky.push({ skupina:'Práce', nazev:'Manipulace ve výrobě', mnozstvi:+hmotnostCelkemT.toFixed(3), jedn:'t', druh:'bm', cenaKlic:'prace_manipulace_t',
      info:'dřevo '+hmotnostDrevaT.toFixed(2)+' t + desky '+hmotnostDeskyT.toFixed(2)+' t, vše včetně odpadu' });

    let celkem = 0;
    polozky.forEach(p => { const c = ceny[p.cenaKlic] || 0; p.cenaJedn = c; p.cenaCelkem = p.mnozstvi * c; celkem += p.cenaCelkem; });

    /* --- ÚPRAVY PROTI MODELU (PLAN_ifc_3d krok 6, rozhodnuto PENTI 6. 10. 2026:
       „průměr z modelu") ---
       Neupravené prvky drží cenu z Pamiru (vše výše). Úprava ve výkresu se
       ocení ROZDÍLEM proti stavu z modelu sazbou spočítanou z modelu samého:
         dřevo stěny  = (řezivo + vruty + práce na bm řeziva) / hrubá plocha
         opláštění    = (desky s prořezem + sponky + práce opláštění) / čistá plocha
       Změna plochy stěny dostane obě sazby, změna plochy otvorů jen
       opláštění (s opačným znaménkem). Příčky stejně, opláštění z obou stran.
       o.upravy = { zdi:{dA,dO}, pricky:{dA,dO}, popis:[…] } z kalkulačky. */
    const U = o.upravy;
    if (U) {
      const cBm = ceny.prace_konstrukce_bm || 0, cOpl = ceny.prace_oplasteni_m2 || 0;
      const suma = f => polozky.filter(f).reduce((a, p) => a + (p.cenaCelkem || 0), 0);
      const drevoZ = suma(p => p.skupina === 'Nosná konstrukce' && /^Obvodové stěny/.test(p.nazev))
                   + suma(p => p.skupina === 'Spojovací materiál' && /^Vruty/.test(p.nazev)) + bmSten * cBm;
      const oplZ = suma(p => p.skupina === 'Opláštění') + suma(p => p.skupina === 'Spojovací materiál' && /^Sponky/.test(p.nazev)) + plochaSProrezem * cOpl;
      const sDrZ = plochaSteny > 0 ? drevoZ / plochaSteny : 0, sOplZ = plochaCista > 0 ? oplZ / plochaCista : 0;
      const aP = P.plochaM2 || 0, aPc = Math.max(0, aP - (P.otvoryM2 || 0)), bmP = (P.dr && P.dr.bm) || 0;
      const drevoP = suma(p => p.skupina === 'Vnitřní příčky' && /^Příčky \d/.test(p.nazev)) + suma(p => /^Příčky — vruty/.test(p.nazev)) + bmP * cBm;
      const oplP = suma(p => /^Příčky — opláštění/.test(p.nazev)) + suma(p => /^Příčky — sponky/.test(p.nazev)) + plochaPricek * cOpl;
      const sDrP = aP > 0 ? drevoP / aP : 0, sOplP = aPc > 0 ? oplP / aPc : 0;
      const r2 = x => Math.round(x * 100) / 100;
      const rad = (nazev, mn, sazba, info) => {
        if (!(Math.abs(mn) > 0.005)) return;
        const c = r2(sazba), q = Math.round(mn * 1000) / 1000;
        polozky.push({ skupina:'Úpravy proti modelu', nazev, mnozstvi:q, jedn:'m²', druh:'uprava', cenaKlic:null, sazbaPevna:c,
                       cenaJedn:c, cenaCelkem:q * c, info });
        celkem += q * c;
      };
      const pz = U.zdi || {}, pp = U.pricky || {}, popis = (U.popis || []).join('; ');
      rad('Obvodové stěny — změna plochy stěn', pz.dA || 0, sDrZ + sOplZ,
          `sazba z modelu: dřevo ${sDrZ.toFixed(0)} + opláštění ${sOplZ.toFixed(0)} Kč/m²` + (popis ? ' · ' + popis : ''));
      rad('Obvodové stěny — změna plochy otvorů', pz.dO || 0, -sOplZ, `otvor víc = opláštění méně (${sOplZ.toFixed(0)} Kč/m² z modelu)`);
      const popisP = (U.popisPricky || []).join('; ');
      rad('Příčky — změna plochy', pp.dA || 0, sDrP + sOplP, `sazba z modelu: dřevo ${sDrP.toFixed(0)} + opláštění z obou stran ${sOplP.toFixed(0)} Kč/m²` + (popisP ? ' · ' + popisP : ''));
      rad('Příčky — změna plochy dveří', pp.dO || 0, -sOplP, `dveře víc = opláštění méně (${sOplP.toFixed(0)} Kč/m² z modelu)`);
    }
    return { polozky, celkem, zModelu:true, nutnyStatik:false, steny:null,
             geometrie:{ obvod, pocetRohu:(m.obrys && m.obrys.body) ? m.obrys.body.length : 0 },
             plochaSteny, plochaCista, plochaStitu:+plochaStitu.toFixed(2), kvhCistaKubatura:kvhCista, kvhRealnaKubatura:kvhRealna, kvhTyce, tyceDleProfilu,
             bmFosenCelkem:+bmFosen.toFixed(1), plochaOplasteniCelkem:+plochaOplasteniCelkem.toFixed(2),
             hmotnost:{ celkemT:+hmotnostCelkemT.toFixed(3), drevoT:+hmotnostDrevaT.toFixed(3), deskyT:+hmotnostDeskyT.toFixed(3), steicoT:0 } };
  }

  /* ══════════════════════════════════════════════════════════════════════
     PODLAHA Z MODELU MiTek PAMIRU (PENTI 5. 10. 2026, plán krok 4)
     Zadání: „Podlahový panel bude zespodu opláštěn DHF deskou 15 mm a pochozí
     vrstva OSB 25 mm (675 × 2500 mm)."
       · trámy podlahy po profilech z modelu + odpad (i pod krytou terasou —
         jsou v modelu),
       · DHF 15 zespodu a OSB 25 nahoře jen na PŮDORYS DOMU (obrys stěn),
         ne pod terasu (rozhodnutí PENTI 5. 10. 2026),
       · OSB se kupuje po celých deskách 675 × 2500 (1,6875 m²) — množství
         je počet desek × plocha desky,
       · sponky a práce stejnými pravidly a sazbami jako u stěn.
     Vrací { polozky, celkem, ... } stejně jako výpočet stěn.
     ════════════════════════════════════════════════════════════════════ */
  function spocitatPodlahuZModelu(m, o, ceny){
    o = o || {};
    const polozky = [];
    const odpad = (+o.odpad || 0)/100, prorez = (+o.prorez || 0)/100;
    const P = m.podlaha || {};
    let m3c = 0, m3r = 0, bm = 0;
    (P.dr && P.dr.drevo || []).forEach(x => {
      const r = x.m3 * (1 + odpad);
      polozky.push({ skupina:'Podlaha — konstrukce', nazev:`Trámy ${x.klic}${x.lepene?' (lepené)':''} — ${x.ks} ks`,
        mnozstvi:r, jedn:'m³', druh:'objem', cenaKlic: x.lepene ? 'lepeneM3' : 'kvhM3',
        info:`z modelu Pamiru: ${x.bm.toFixed(2)} bm / ${x.m3.toFixed(3)} m³ + odpad ${Math.round(odpad*100)} %`, objemCisty:x.m3 });
      m3c += x.m3; m3r += r; bm += x.bm;
    });
    const plocha = (m.obrys && m.obrys.plochaM2) || 0;
    const DESKA_OSB = 2.5 * 0.675;
    const dhf = plocha * (1 + prorez);
    const desekOsb = Math.ceil(plocha * (1 + prorez) / DESKA_OSB - 1e-9);
    const osb = desekOsb * DESKA_OSB;
    const kDhf = o.spodni || 'dhf', kOsb = o.horni || 'osb25';
    polozky.push({ skupina:'Podlaha — opláštění', nazev:'DHF 15 mm zespodu (s prořezem)', mnozstvi:dhf, jedn:'m²', druh:'bm', cenaKlic:kDhf,
      info:`půdorys domu ${plocha.toFixed(2)} m² + prořez ${Math.round(prorez*100)} % (bez kryté terasy)` });
    polozky.push({ skupina:'Podlaha — opláštění', nazev:`OSB 3 P+D 25 mm nahoře — ${desekOsb} desek 675 × 2500`, mnozstvi:osb, jedn:'m²', druh:'bm', cenaKlic:kOsb,
      info:`půdorys ${plocha.toFixed(2)} m² + prořez ${Math.round(prorez*100)} % = ${(plocha*(1+prorez)).toFixed(2)} m² → ${desekOsb} celých desek po 1,6875 m²` });
    /* sponky: obě vrstvy do každého trámu + spáry desek (stejné pravidlo jako stěny) */
    const bmSponek = 2 * bm + plocha / 1.25 + plocha / 0.675;
    polozky.push({ skupina:'Podlaha — spojovací materiál', nazev:'Sponky DHF a OSB', mnozstvi:bmSponek*20, jedn:'ks', druh:'bm', cenaKlic:'sponka',
      info:`${Math.round(bmSponek)} bm linií (2 vrstvy × trámy ${Math.round(bm)} + spáry DHF ${Math.round(plocha/1.25)} + spáry OSB ${Math.round(plocha/0.675)})` });
    const plochaOpl = dhf + osb;
    const hmotDrevo = m3r * DREVO_T_NA_M3;
    const hmotDesky = (dhf * (HMOTNOSTI_DESEK[kDhf] || 0) + osb * (HMOTNOSTI_DESEK[kOsb] || 0)) / 1000;
    polozky.push({ skupina:'Podlaha — práce', nazev:'Výroba a montáž konstrukce', mnozstvi:+bm.toFixed(1), jedn:'bm', druh:'bm', cenaKlic:'prace_konstrukce_bm',
      info:'běžné metry trámů podlahy z modelu' });
    polozky.push({ skupina:'Podlaha — práce', nazev:'Opláštění', mnozstvi:+plochaOpl.toFixed(2), jedn:'m²', druh:'bm', cenaKlic:'prace_oplasteni_m2',
      info:'DHF + OSB včetně prořezu' });
    polozky.push({ skupina:'Podlaha — práce', nazev:'Manipulace ve výrobě', mnozstvi:+(hmotDrevo + hmotDesky).toFixed(3), jedn:'t', druh:'bm', cenaKlic:'prace_manipulace_t',
      info:'dřevo '+hmotDrevo.toFixed(2)+' t + desky '+hmotDesky.toFixed(2)+' t' });
    let celkem = 0;
    polozky.forEach(p => { const c = ceny[p.cenaKlic] || 0; p.cenaJedn = c; p.cenaCelkem = p.mnozstvi * c; celkem += p.cenaCelkem; });
    return { polozky, celkem, plochaM2:plocha, desekOsb, dhfM2:dhf, osbM2:osb, bmTramu:+bm.toFixed(2), m3Cista:m3c, m3Realna:m3r,
             hmotnost:{ celkemT:+(hmotDrevo + hmotDesky).toFixed(3), drevoT:+hmotDrevo.toFixed(3), deskyT:+hmotDesky.toFixed(3) } };
  }

  // veřejné rozhraní enginu

  /* ══════════════════════════════════════════════════════════════════════
     PANELY VIKÝŘE (etapa 4b, 2026.11.212 — PENTI 8. 11. 2026)
     ----------------------------------------------------------------------
     „Panel i s okny by se vytvářel stejně jako stěny dřevostavby."
     Stejná pravidla jako `spocitat` (sloupky po rozteči + na spáry desek,
     práh + dvojitá pásnice, rámování otvorů king/jack/cripple/parapet,
     překlad podle šířky, opláštění s prořezem, sponky, vruty, tři sazby
     práce), jen pro JEDNOTLIVÉ ROVNÉ STĚNY S PROMĚNNOU VÝŠKOU — bok
     pultového vikýře je trojúhelník (výška klesá od čela k nule).

     steny: [{ nazev, delka (m, vodorovně), vyskaZac, vyskaKon (m, lineárně),
               delkaPrahu, delkaPasnice (m, skutečné délky — u boku šikmé),
               rohoveSloupky (ks navíc v plné výšce vyskaZac), otvory:[{typ:'okno',
               sirka, vyska, parapet, pocet}] }]
     o:     { profil:{b,h} (mm), roztec (mm), oplasteni, odpad (%), prorez (%) }
     Vrací stejný tvar jako `spocitat`: polozky (cenaKlic jako u stěn),
     bmFosenCelkem, plochaOplasteniCelkem, hmotnost, a `steny` s polohami
     a výškami sloupků (pro výkres a 3D). */
  function spocitatPanelyVikyre(steny, o, ceny){
    o = o || {}; ceny = ceny || {};
    const b = (o.profil && o.profil.b) || 60, h = (o.profil && o.profil.h) || 160;
    const klic = 'kvh' + b + 'x' + h;
    if(!PRUREZY[klic]) PRUREZY[klic] = (b/1000) * (h/1000);
    const roztec = (+o.roztec || 625) / 1000, odpad = +o.odpad || 0, prorez = +o.prorez || 0;
    const polozky = [], bmProfil = {};
    const drevo = function(nazev, bm, prof, info){
      if(!(bm > 0)) return;
      const pk = prof || klic, cis = bm * (PRUREZY[pk] || 0), real = cis * (1 + odpad/100);
      bmProfil[pk] = (bmProfil[pk] || 0) + bm;
      polozky.push({ skupina:'Panely', nazev, mnozstvi:real, jedn:'m³', druh:'objem', cenaKlic:'kvhM3',
                     info:(info ? info + ' ' : '') + `(čistě ${bm.toFixed(2)} bm / ${cis.toFixed(3)} m³)`, objemCisty:cis });
    };
    let bmSloupky = 0, nSloupku = 0, bmVodor = 0, bmPreklad200 = 0, bmPreklad240 = 0, bmParapet = 0, bmRam = 0;
    let nPrekladu = 0, plochaCista = 0, bmSpary = 0, bmPasy = 0, bmSloupLin = 0, nutnyStatik = false;
    const detail = [];
    (steny || []).forEach(function(st){
      const L = +st.delka || 0; if(!(L > 0.05)) return;
      const h0 = +st.vyskaZac || 0, h1 = (st.vyskaKon != null) ? +st.vyskaKon : h0;
      const vys = function(x){ return h0 + (h1 - h0) * x / L; };
      /* sloupky: rastr od začátku + koncový (jen když tam stěna ještě
         má výšku) + na spáry desek 1,25 m */
      const poz = [];
      for(let x = 0; x < L - 0.001; x += roztec) poz.push(+x.toFixed(3));
      if(h1 > 0.05) poz.push(+L.toFixed(3));
      for(let x = 1.25; x < L - 0.05; x += 1.25) if(!poz.some(p => Math.abs(p - x) < 0.03)) poz.push(+x.toFixed(3));
      poz.sort((a, c) => a - c);
      const sl = poz.map(x => ({ x, h:+vys(x).toFixed(3) })).filter(q => q.h > 0.05);
      const rohove = Math.max(0, +st.rohoveSloupky || 0);
      sl.forEach(q => { bmSloupky += q.h; bmSloupLin += q.h; });
      bmSloupky += rohove * h0; bmSloupLin += rohove * h0;
      nSloupku += sl.length + rohove;
      /* práh + dvojitá pásnice (u boku šikmá) */
      const prah = (st.delkaPrahu != null) ? +st.delkaPrahu : L;
      const pasnice = (st.delkaPasnice != null) ? +st.delkaPasnice : Math.hypot(L, h1 - h0);
      const nPas = (st.pasnic === 1) ? 1 : 2;              // bok vikýře 1 pásnice, jinak dvojitá (2026.11.238)
      bmVodor += prah + nPas * pasnice; bmPasy += prah + pasnice;
      /* plocha stěny (lichoběžník) */
      const plocha = L * (h0 + h1) / 2;
      let plOtv = 0;
      /* otvory — pravidla rámování jako `spocitat` */
      (st.otvory || []).forEach(function(ot){
        const n = Math.max(1, +ot.pocet || 1), w = +ot.sirka || 0, oh = +ot.vyska || 0; if(!(w > 0 && oh > 0)) return;
        const p = vyberPreklad(w), jeOkno = (ot.typ || 'okno') === 'okno', par = jeOkno ? (+ot.parapet || 0) : 0, horni = par + oh;
        const hS = Math.max(h0, h1);                       // stěna v místě otvoru (čelo má výšku konstantní)
        for(let k = 0; k < n; k++){
          const dP = w + 0.4;
          if(p.profil === 'preklad160x200'){ bmPreklad200 += dP; nPrekladu++; }
          else if(p.profil === 'preklad160x240'){ bmPreklad240 += dP; nPrekladu++; }
          if(p.popis.includes('STATIK')) nutnyStatik = true;
          bmRam += 2 * hS;                                  // king
          bmRam += 2 * (w > 2.5 ? 2 : 1) * horni;           // jack
          bmRam += Math.max(0, Math.floor(w / roztec)) * Math.max(0, hS - horni - 0.2);   // cripple nad
          if(jeOkno){ bmParapet += w; bmRam += Math.max(0, Math.floor(w / roztec)) * par; }
          plOtv += w * oh;
        }
      });
      const cista = Math.max(0, plocha - plOtv);
      plochaCista += cista; bmSpary += cista / 1.25;
      detail.push({ nazev:st.nazev || '', delka:+L.toFixed(3), vyskaZac:h0, vyskaKon:h1, sloupky:sl, rohoveSloupky:rohove,
                    plocha:+plocha.toFixed(3), plochaCista:+cista.toFixed(3), otvory:st.otvory || [] });
    });
    drevo(`Sloupky (${nSloupku} ks)`, bmSloupky, null, 'každý ve své výšce, i na spáry desek');
    drevo('Práh + horní pásnice (boky 1 vrstva, čelo 2)', bmVodor);
    if(bmPreklad200 > 0) drevo('Překlady 160×200', bmPreklad200, 'preklad160x200');
    if(bmPreklad240 > 0) drevo('Překlady 160×240', bmPreklad240, 'preklad160x240');
    if(bmParapet > 0) drevo('Parapetní prahy', bmParapet);
    if(bmRam > 0) drevo('Rámování otvorů (king/jack/cripple)', bmRam);
    const plochaProrez = plochaCista * (1 + prorez/100);
    if(plochaProrez > 0) polozky.push({ skupina:'Panely', nazev:'Opláštění vnější (s prořezem)', mnozstvi:plochaProrez, jedn:'m²', druh:'bm', cenaKlic:o.oplasteni || 'osb' });
    const sponek = (bmSpary + bmPasy + bmSloupLin) * 20;
    if(sponek > 0) polozky.push({ skupina:'Panely', nazev:'Sponky opláštění', mnozstvi:Math.round(sponek), jedn:'ks', druh:'bm', cenaKlic:'sponka' });
    const vrutu = nSloupku * 6 + nPrekladu * 4;
    if(vrutu > 0) polozky.push({ skupina:'Panely', nazev:'Vruty 6×140 (sloupky + překlady)', mnozstvi:vrutu, jedn:'ks', druh:'bm', cenaKlic:'vrut' });
    let bmFosen = 0; for(const pk in bmProfil) bmFosen += bmProfil[pk];
    let tDrevo = 0; polozky.forEach(p => { if(p.druh === 'objem') tDrevo += (p.mnozstvi || 0) * DREVO_T_NA_M3; });
    const tDesky = plochaProrez * (HMOTNOSTI_DESEK[o.oplasteni] || 0) / 1000, tCelkem = tDrevo + tDesky;
    if(bmFosen > 0){
      polozky.push({ skupina:'Práce', nazev:'Výroba a montáž panelů', mnozstvi:+bmFosen.toFixed(1), jedn:'bm', druh:'bm', cenaKlic:'prace_konstrukce_bm',
                     info:'běžné metry fošen panelů včetně rámování oken' });
      polozky.push({ skupina:'Práce', nazev:'Opláštění panelů', mnozstvi:+plochaProrez.toFixed(2), jedn:'m²', druh:'bm', cenaKlic:'prace_oplasteni_m2',
                     info:'nařízaná plocha desek včetně připřezu' });
      polozky.push({ skupina:'Práce', nazev:'Manipulace ve výrobě', mnozstvi:+tCelkem.toFixed(3), jedn:'t', druh:'bm', cenaKlic:'prace_manipulace_t',
                     info:'dřevo ' + tDrevo.toFixed(2) + ' t + desky ' + tDesky.toFixed(2) + ' t, vše včetně odpadu' });
    }
    let celkem = 0;
    polozky.forEach(p => { const c = ceny[p.cenaKlic] || 0; p.cenaJedn = c; p.cenaCelkem = p.mnozstvi * c; celkem += p.cenaCelkem; });
    return { polozky, celkem, steny:detail, nutnyStatik, bmFosenCelkem:+bmFosen.toFixed(2), plochaCista:+plochaCista.toFixed(3),
             plochaOplasteniCelkem:+plochaProrez.toFixed(2), pocetSloupku:nSloupku,
             hmotnost:{ celkemT:+tCelkem.toFixed(3), drevoT:+tDrevo.toFixed(3), deskyT:+tDesky.toFixed(3) } };
  }


  /* ══════════════════════════════════════════════════════════════════════
     STĚNY PULTOVÉHO VIKÝŘE A ROZVRH PANELU (etapa 4d, 2026.11.214)
     ----------------------------------------------------------------------
     Jedno místo pro tvar stěn — počítá z něj cena (spocitatPanelyVikyre),
     3D i výrobní list panelu, aby se nerozešly.
     Panel končí POD KROKVEMI PULTU: čelo je vysoké výška čela − výška
     krokve svisle (h/cos β); bok je trojúhelník, jehož horní hrana jde po
     spodní hraně krokví pultu, takže je o tolik kratší.
     v: { sirka, hloubka (vodorovně), vyskaCela, sklonHlavniDeg, sklonPultuDeg,
          hKrokveMm, celoZdene, okna:[{sirka,vyska,parapet,pocet}] } */
  function stenyPultovehoVikyre(v){
    const w = +v.sirka || 0, d = +v.hloubka || 0, hc = +v.vyskaCela || 0;
    const ca = Math.cos((+v.sklonHlavniDeg || 0) * Math.PI/180) || 1;
    const cb = Math.cos((+v.sklonPultuDeg || 0) * Math.PI/180) || 1;
    const t = ((+v.hKrokveMm || 0) / 1000) / cb;                 // krokev pultu svisle
    const hp = Math.max(0.2, hc - t);                            // výška panelu čela
    const db = (hc > 0) ? Math.max(0.2, d * hp / hc) : d;        // délka boku (k průsečíku spodní hrany krokví s hlavní střechou)
    const steny = [];
    if(!v.celoZdene) steny.push({ nazev:'čelo', druh:'celo', delka:w, vyskaZac:hp, vyskaKon:hp, rohoveSloupky:4,
      otvory:(v.okna || []).map(o => ({ typ:'okno', sirka:+o.sirka || 0, vyska:+o.vyska || 0, parapet:+o.parapet || 0, pocet:Math.max(1, +o.pocet || 1),
        od:(o.od != null && o.od !== '') ? +o.od : null, mezera:(o.mezera != null && o.mezera !== '') ? +o.mezera : null })) });
    /* ZDĚNÉ ČELO (2026.11.228): bok začíná až za zdí čela (vnitřní líc) —
       je o tloušťku zdi kratší a vpředu nižší (lichoběžník po spodní hraně
       krokví pultu). `tlCelaM` = tloušťka zdi čela. */
    const tz = (v.celoZdene && +v.tlCelaM > 0) ? Math.min(+v.tlCelaM, db * 0.8) : 0;
    const dbB = db - tz, hpB = hp * (db - tz) / db;
    ['levý bok', 'pravý bok'].forEach(nz => steny.push({ nazev:nz, druh:'bok', delka:dbB, vyskaZac:hpB, vyskaKon:0,
      delkaPrahu:dbB/ca, delkaPasnice:Math.hypot(dbB, hpB), rohoveSloupky:0, otvory:[], odCelaM:tz,
      /* bok nic nenese → JEDNA horní pásnice naplocho (2026.11.238 — PENTI
         17. 11. 2026: „horní pásnice musí být také položena naplocho … 60 mm");
         čelo z panelu nese krokve pultu, má dál dvojitou */
      pasnic:1 }));
    return { steny, vyskaPanelu:hp, delkaBoku:db, krokevSvisle:t, tlCelaM:tz };
  }

  /* ROZMÍSTĚNÍ OKEN V PANELU (2026.11.215 — PENTI 9. 11. 2026: „dodělej
     zadání oken"). Okno může mít zadanou polohu `od` = od začátku panelu
     (levý líc při pohledu zvenku) k levé hraně otvoru; víc kusů v řádku jde
     po sobě s `mezera` (výchozí 4 × šířka fošny = king + jack z obou stran).
     Okna bez polohy se rozmístí rovnoměrně — po celé šířce, nebo když už
     nějaká okna polohu mají, do největší volné mezery. */
  function rozmistiOkna(st, L, b){
    const pevna = [], volna = [];
    (st.otvory || []).forEach(ot => {
      const n = Math.max(1, +ot.pocet || 1), mez = (ot.mezera != null && ot.mezera >= 0) ? +ot.mezera : 4 * b;
      for(let k = 0; k < n; k++){
        const q = { sirka:+ot.sirka || 0, vyska:+ot.vyska || 0, parapet:+ot.parapet || 0, zadane:ot.od != null };
        if(ot.od != null){ q.od = +ot.od + k * (q.sirka + mez); pevna.push(q); } else volna.push(q);
      }
    });
    if(volna.length){
      /* volné intervaly mezi pevnými okny (s místem na ostění) */
      const obs = pevna.map(q => [q.od - 2*b, q.od + q.sirka + 2*b]).sort((a, c) => a[0] - c[0]);
      let a0 = 0, nej = [0, L];
      if(obs.length){ nej = [0, 0]; obs.forEach(o => { if(o[0] - a0 > nej[1] - nej[0]) nej = [a0, o[0]]; a0 = Math.max(a0, o[1]); }); if(L - a0 > nej[1] - nej[0]) nej = [a0, L]; }
      const Ld = nej[1] - nej[0], sum = volna.reduce((s, q) => s + q.sirka, 0), mez = (Ld - sum) / (volna.length + 1);
      let x = nej[0] + mez;
      volna.forEach(q => { q.od = x; x += q.sirka + mez; });
    }
    const vse = pevna.concat(volna).sort((p, q) => p.od - q.od);
    vse.forEach(q => { q.z0 = b + q.parapet; q.z1 = q.z0 + q.vyska; });
    return vse;
  }
  /* Kontrola oken v panelu: v panelu i s ostěním, nepřekrývají se. */
  function kontrolaOkenPanelu(st, o){
    const b = (((o && o.profil && o.profil.b) || 60) / 1000), L = +st.delka || 0, out = [];
    const ok = rozmistiOkna(st, L, b);
    ok.forEach((q, i) => {
      const nz = 'okno ' + Math.round(q.sirka*1000) + '×' + Math.round(q.vyska*1000) + (q.zadane ? ' (od kraje ' + Math.round(q.od*1000) + ' mm)' : '');
      if(q.od < 2*b - 1e-6) out.push(nz + ' začíná moc blízko levého kraje — od kraje musí být aspoň ' + Math.round(2*b*1000) + ' mm na ostění');
      if(q.od + q.sirka > L - 2*b + 1e-6) out.push(nz + ' přesahuje pravý kraj panelu (' + Math.round(L*1000) + ' mm) i s ostěním ' + Math.round(2*b*1000) + ' mm');
      const dal = ok[i + 1];
      if(dal && dal.od < q.od + q.sirka + 4*b - 1e-6) out.push(nz + ' a další okno jsou moc blízko — mezi okny musí být aspoň ' + Math.round(4*b*1000) + ' mm (ostění obou oken)');
    });
    return out;
  }

  /* Rozvrh panelu: prvky jako mnohoúhelníky v rovině stěny (x po délce
     od začátku, z svisle od spodní hrany prahu), stejná pravidla jako
     výpočet: sloupky po rozteči + na spáry desek, práh, dvojitá pásnice
     (u boku šikmá), u oken king + jack + překlad + parapet + cripple.
     Okna se rozmístí rovnoměrně po šířce čela (poloha se nezadává). */
  function rozvrhPaneluVikyre(st, o){
    o = o || {};
    const b = ((o.profil && o.profil.b) || 60) / 1000, roztec = (+o.roztec || 625) / 1000;
    const L = +st.delka || 0, h0 = +st.vyskaZac || 0, h1 = (st.vyskaKon != null) ? +st.vyskaKon : h0;
    const nPas = (st.pasnic === 1) ? 1 : 2;                               // bok vikýře 1 pásnice (2026.11.238)
    const sk = (h1 - h0) / (L || 1), tl = nPas * b * Math.sqrt(1 + sk*sk);  // pásnice (jedna/dvojitá) svisle
    const horni = x => h0 + sk * x;                                        // horní hrana panelu
    const pod = x => horni(x) - tl;                                        // spodní hrana pásnice
    const prvky = [];
    const rect = (druh, x0, x1, z0, z1) => prvky.push({ druh, poly:[[x0,z0],[x1,z0],[x1,z1],[x0,z1]] });
    const sloupek = (druh, x0, x1, z0, zTop) => { const a = zTop ? zTop(x0) : null, c = zTop ? zTop(x1) : null;
      if(zTop){ if(Math.min(a, c) - z0 < 0.05) return; prvky.push({ druh, poly:[[x0,z0],[x1,z0],[x1,c],[x0,a]] }); }
    };
    /* práh a pásnice */
    /* bok do špičky: pásnice dosedne na práh — oba končí tam, kde horní
       hrana panelu klesne na horní líc prahu (nic nepřečnívá dolů) */
    if(sk < 0 && horni(L) - tl < b){
      const xT = Math.min(L, (b - h0) / sk), xB = Math.min(xT, (b + tl - h0) / sk);
      rect('prah', 0, xT, 0, b);
      prvky.push({ druh:'pasnice', poly:[[0, h0 - tl], [xB, b], [xT, b], [0, h0]] });
    } else {
      rect('prah', 0, L, 0, b);
      prvky.push({ druh:'pasnice', poly:[[0, horni(0) - tl], [L, horni(L) - tl], [L, horni(L)], [0, horni(0)]] });
    }
    /* okna — rovnoměrně */
    const okna = rozmistiOkna(st, L, b);
    const vOkne = (x0, x1) => okna.some(q => x1 > q.od - 2*b + 1e-6 && x0 < q.od + q.sirka + 2*b - 1e-6);
    /* rastrové sloupky (+ na spáry desek), mimo okna */
    const poz = [];
    for(let x = 0; x < L - 0.001; x += roztec) poz.push(x);
    if(h1 > 0.05) poz.push(L - b);
    for(let x = 1.25; x < L - 0.05; x += 1.25) if(!poz.some(p => Math.abs(p - x) < 0.03 || Math.abs(p + b/2 - x) < 0.03)) poz.push(x - b/2);
    poz.sort((a, c) => a - c).forEach(x => {
      const x0 = Math.max(0, Math.min(L - b, x)), x1 = x0 + b;
      if(vOkne(x0, x1)) return;
      sloupek('sloupek', x0, x1, b, pod);
    });
    /* okna: king, jack, překlad, parapet, cripple */
    okna.forEach(q => {
      const hPr = 0.2;
      sloupek('king', q.od - 2*b, q.od - b, b, pod); sloupek('king', q.od + q.sirka + b, q.od + q.sirka + 2*b, b, pod);
      rect('jack', q.od - b, q.od, b, q.z1); rect('jack', q.od + q.sirka, q.od + q.sirka + b, b, q.z1);
      rect('preklad', q.od - b, q.od + q.sirka + b, q.z1, Math.min(q.z1 + hPr, pod(q.od)));
      if(q.parapet > 0.05) rect('parapet', q.od, q.od + q.sirka, q.z0 - b, q.z0);
      for(let x = Math.ceil(q.od / roztec) * roztec; x < q.od + q.sirka - b; x += roztec){
        if(pod(x) - (q.z1 + hPr) > 0.05) sloupek('cripple', x, x + b, q.z1 + hPr, pod);
        if(q.parapet > 0.1) rect('cripple', x, x + b, b, q.z0 - b);
      }
    });
    return { prvky, okna, delka:L, vyskaZac:h0, vyskaKon:h1, b, pasnic:nPas };
  }

  return { spocitat, spocitatZModelu, spocitatPodlahuZModelu, spocitatPanelyVikyre, stenyPultovehoVikyre, rozvrhPaneluVikyre, rozmistiOkna, kontrolaOkenPanelu, vyberPreklad, geometrie, TABULKA_PREKLADU };
})();
