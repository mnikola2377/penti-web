/* ==========================================================================
   KROV — VÝKAZ PRVKŮ
   --------------------------------------------------------------------------
   Spočítá, kolik a jakých prvků krov potřebuje. Nekreslí, nezná ceny a nečte
   z obrazovky — díky tomu se dá otestovat a použít stejně v kalkulačce
   i kdekoli jinde.

   ČÍM SE LIŠÍ OD PŮVODNÍHO VÝPOČTU
   Stará kalkulačka počítala krov vždycky jako jeden sedlový obdélník: všechny
   krokve stejně dlouhé, ať byl půdorys jakýkoli. Tenhle modul bere SKUTEČNÝ
   TVAR každé střešní roviny z výpočetního jádra, takže u valby nebo úžlabí
   se krokve správně krátí.

   POZEDNICE se počítá z délky OBVODOVÉ NOSNÉ ZDI, ne z okapové hrany.
   Okap je o přesah delší, ale pozednice leží na zdivu (upřesněno PENTI
   12. 8. 2026).

   SOUSTAVY
     'vrcholova' — vrcholová vaznice na sloupcích, kleštiny
     'stredove'  — dvě středové vaznice, VE VRCHOLU ŽÁDNÁ VAZNICE ANI SLOUPKY
     'obe'       — středové i vrcholová
     'hambalek'  — bez vaznic, krokve rozepřené hambálkem
   Rozdíl mezi 'stredove' a 'obe' je tady skutečný — v původní kalkulačce
   obě volby dělaly totéž a vrcholová vaznice zůstávala i tam, kde nemá být.

     'vesadlo'   — jednoduché věšadlo: vazné trámy po několika metrech,
                   na nich okapové a vrcholová vaznice, krokve leží na
                   vaznicích. Trám i sloupek jsou TAŽENÉ, vzpěry TLAČENÉ.
                   Pozednice tu není — trámy leží přímo na zdech.
   ========================================================================== */
(function(global){
"use strict";

var SOUSTAVY = {
  vrcholova: { nazev:"Vrcholová vaznice", vrchol:true,  stred:false, klestiny:true,  hambalek:false },
  stredove:  { nazev:"Středové vaznice",  vrchol:false, stred:true,  klestiny:true,  hambalek:false },
  obe:       { nazev:"Středové i vrcholová vaznice", vrchol:true, stred:true, klestiny:true, hambalek:false },
  hambalek:  { nazev:"Hambálkový krov",   vrchol:false, stred:false, klestiny:false, hambalek:true  },
  /* Pultová střecha — jedna rovina, dvě pozednice v různé výšce.
     Krokev buď přejde celý rozpon najednou, nebo se podepře vaznicí. */
  pultova_bez: { nazev:"Pultový krov — krokev bez vaznice", pult:true, pultVaznice:false },
  pultova_s:   { nazev:"Pultový krov — krokev s vaznicí",   pult:true, pultVaznice:true },
  /* Jednoduché věšadlo — vazba stojí po několika metrech a nese vaznice.
     Krokve na vazbě neleží přímo, leží na vaznicích. */
  vesadlo:     { nazev:"Jednoduché věšadlo", vesadlo:true, klestiny:false, hambalek:false },
  /* Mansarda — stolice ve zlomu (PENTI 4.–5. 10. 2026, varianta A, obr. 295
     Handbuch der Architektur): svislé sloupky pod vaznicí ve zlomu, dvojitá
     kleština ve výšce zlomu, spodní strmé a horní mírné krokve. */
  mansarda:    { nazev:"Mansardová — stolice ve zlomu", mansarda:true, klestiny:true, hambalek:false }
};

var VYCHOZI = {
  roztecKrokvi: 0.9,       // m
  /* ZDĚNÉ ŠTÍTY — KROKVE PO ŠTÍT (PENTI 22. 9. 2026). Štít se vyzdí po
     horní hranu krokví, takže krokve nad ním být nemohou: pole krokví
     končí u vnitřního líce štítové zdi (+ mezera), pozednice u líce štítu
     a vaznice v kapse 100 mm před vnějším lícem. Vypnuto = jako dřív. */
  krokvePoStit: false,
  vrcholJenNaStitech: false,      // vrcholová vaznice jen na zděných štítech, bez sloupků (2. 10. 2026)
  mezeraKrokveOdStituMm: 50,   // mm — krajní krokev od vnitřního líce štítu
  kapsaVazniceOdLiceMm: 100,   // mm — zdivo, které zůstane před čelem vaznice
  presahOkap: 0.5,         // m — přesah krokve za pozednici
  presahHreben: 0.05,      // m — vzájemné přeplátování ve vrcholu
  roztecSloupku: 3.5,      // m
  /* OCELOVÉ RÁMY POD STŘEDOVÝMI VAZNICEMI (PENTI 23. 9. 2026, Odrůvky):
     místo sloupků nesou vaznice rámy 2×U do krabice, paty na obvodových
     zdech. "sloupky" = jako dřív. */
  podporaStredovych: "sloupky",  // "sloupky" | "jekl" | "ramy"  (jekl = sloupky z jeklu pod DŘEVĚNOU vaznicí, 3. 10. 2026)
  /* Totéž pod VRCHOLOVOU vaznicí (PENTI 25. 9. 2026, tvar A): rám jsou
     dvě šikmé příčle od pat na věnci k vrcholu pod vaznicí. Jen soustava
     „Vrcholová vaznice" — u „obou" zůstává vrcholová na sloupcích. */
  podporaVrcholove: "sloupky",   // "sloupky" | "jekl" | "ramy"
  roztecRamuM: 4,          // m — jmenovitá rozteč rámů (pole = floor(délka/rozteč))
  pocetRamu: 0,            // ruční počet rámů, 0 = z rozteče
  profilRamu: "U200",      // U100…U240 (2× do krabice) nebo HEB100…HEB300 (25. 9. 2026)
  pataRamu: "posuvna",     // "posuvna" (bez rozpěru do zdí) | "pevna"
  kolenoRamuM: 0.75,       // m — koleno rámu dál od osy než vaznice
  pataRamuOdLiceM: 0,      // m — pata od vnějšího líce zdi, 0 = osa zdi
  zPatyRamuM: 0,           // m — pata nad věncem (0 = sedí na věnci)
  vyskaVaznice: 2.7,       // m — spodní hrana vrcholové vaznice nad pozednicí
  vyskaVaznicePult: 0,     // m — mezilehlá vaznice pultového krovu; 0 = do půli rozponu zdí
  vyskaStredVaznice: 0,    // m — 0 = polovina výšky střechy
  vyskaKlestin: 0,         // m — 0 = dopočítá se z polohy vaznic
  maleKlestiny: false,     // malé kleštiny pod hřebenem (bez vrcholové vaznice)
  maleKlestinyOdHrebene: 0.5,  // m — vzdálenost SPODNÍHO líce od hřebene
  vyskaHambalku: 0,        // m — 0 = polovina výšky střechy
  pasky: true,             // pásky u sloupků — dají se vypnout
  pasekDelka: 1.35,        // m — délka pásku, běžně 1,2 až 1,5 m
  pasekNabeh: 0.8,         // m — starý vstup, ponechán kvůli zpětné shodě
  /* Výška nadezdívky u okapu nad hrubou podlahou (±0). 0 = pozednice leží
     rovnou na stropní desce. Modul si dál počítá od pozednice, tohle je
     jen převod na výšky, které se na stavbě měří od podlahy. */
  nadezdivkaM: 0,
  /* Uložení (spodní líc) středové vaznice nad ±0. 0 = neřeší se a platí
     výška nad pozednicí, případně polovina výšky střechy. */
  ulozeniStredoveM: 0,
  /* Spodní hrana kleštin nad ±0. 0 = dopočítá se z polohy vaznic. */
  klestinyNadNulouM: 0,
  maxKusPozedniceM: 4,     // m — nejdelší kus pozednice, který se dá dovézt a osadit
  deleniVaznic: false,     // navrhnout dělení vaznic v nulovém momentu
  maxDelkaKusu: 13,        // m — nejdelší kus vaznice, se kterým se dá manipulovat
  /* Statický model vaznice (PENTI 1. 10. 2026):
       "spojity" — spojitý nosník přes podpory, spoj (je-li třeba) v nulovém
                   momentu hákovým plátem (výchozí, jako dřív);
       "prosty"  — řada prostých nosníků, spoj jednoduchým plátem nad každou
                   vnitřní podporou (sloupek s čepem do plátu + 1 svorník). */
  modelVaznice: "spojity",
  /* Odkud posudky berou vnitřní síly (PENTI 13. 10. 2026, B4):
       "ram"     — příčná vazba jako rám (obálka paty tuhá/volná) — výchozí;
       "postaru" — dosavadní zjednodušené modely (krokev jako prostý
                   nosník…). Zakázky uložené před 13. 10. 2026 dostanou
                   při načtení "postaru", ať se jim nezmění čísla. */
  statikaModel: "ram",
  /* Nárožní krokve v hřebeni (PENTI 1. 10. 2026):
       "k_sobe"    — nárožníky lípnuté k sobě, mitlák se lípne mezi ně (výchozí);
       "k_mitlaku" — mitlák jde celý k prvnímu páru, nárožníky lípnuté k němu.
     V obou případech čelem dosednou na první pár krokví za valbou. */
  lipnutiNarozi: "k_sobe",
  /* Rozteč kotev pozednice. 0 = nechat na soustavě:
     u soustav s vaznicí nesou zatížení vaznice a pozednice se tolik
     nevzpírá, stačí po 2 m; u krokevních (hambálek, pultová bez vaznice)
     jde celý vodorovný tlak do pozednice a kotví se po metru
     (zadání PENTI 16. 8. 2026). */
  roztecKotevPozednice: 0, // m — 0 = automaticky podle soustavy
  osovaVesadel: 4.0,       // m — největší vzdálenost vazeb věšadla od sebe
  pocetVesadel: 0,         // ks — 0 = spočítat z osové vzdálenosti
  odsazeniVesadlaM: 0.15,  // m — krajní vazba od vnitřního líce štítu, OSA trámu (staré zakázky)
  /* Od 23. 9. 2026 se zadává MEZERA líc zdi → líc trámu v mm (tesař myslí
     v mezeře, ne v ose). 50 mm + půl trámu 200 = osa 150 mm jako dřív. */
  mezeraVazbyOdStituMm: 50,
  /* Konce vaznic u zděného štítu (PENTI 23. 9. 2026):
       vrcholUStitu  "kapsa" = uložená na štítě (v kapse 100 mm před lícem),
                     "vazba" = končí lícem věšáku krajní vazby
       okapUStitu    "jakoVrchol" = stejně jako vrcholová, "lic" = po vnitřní líc štítu
       krajniVazby   false = vazby jen uvnitř, vaznice nesou štíty (jen s oběma v kapse) */
  vrcholUStitu: "kapsa", okapUStitu: "jakoVrchol", krajniVazby: true,
  presahTramuMm: 0,        // mm — konec vazného trámu za vnějším lícem zdi
  /* Okapová vaznice věšadla (PENTI 9. 10. 2026):
       "kamp" = leží na koncích vazných trámů v kampu (dosavadní, výchozí)
       "mezi" = leží jako POZEDNICE na věnci mezi vaznými trámy — střecha
                se nezvedá o výšku trámu (hřeben nižší), krokve v polích
                mezi trámy, k trámu tesařský úhelník, do věnce kotvy */
  vesadloOkap: "kamp",
  vesadloTvMm: 0,          // mm — hloubka zapuštění vzpěry do trámu, 0 = navrhne se
  vesadloThMm: 0,          // mm — hloubka zapuštění vzpěry do hlavy věšáku, 0 = navrhne se
  prekrytiPasoviny: 0.5,   // m — o kolik rameno třmenu přesahuje po věšáku nahoru
  profily: {
    krokev:       {b:100, h:180},
    pozednice:    {b:140, h:160},
    vaznice:      {b:160, h:200},
    stredVaznice: {b:160, h:220},
    sloupek:      {b:140, h:140},
    pasek:        {b:120, h:120},
    klestina:     {b:60,  h:160},
    /* Nárožní a úžlabní krokev — výšku dopočítá `profilNarozniku`,
       tady je jen šířka a záložní hodnota. */
    naroznik:     {b:140, h:240},
    hambalek:     {b:80,  h:160},
    /* věšadlo — věšák musí být širší než vzpěra: do hlavy se z obou stran
       zapouštějí vzpěry a mezi zapuštěními musí zbýt krk (22. 9. 2026). */
    tram:         {b:200, h:280},
    vzpera:       {b:140, h:140},
    sloupekVes:   {b:180, h:180}
  }
};

function n(x){ var v=parseFloat(x); return isNaN(v)?0:v; }
function r2(x){ return Math.round((x||0)*100)/100; }
function r3(x){ return Math.round((x||0)*1000)/1000; }

/* Horní hranice obrysu roviny v daném místě u.
   Rovina je popsaná v místní soustavě: u vodorovně podél okapu, v po spádu
   od okapu nahoru. Vrací nejvyšší v, kterého obrys v tom místě dosahuje. */
/* ══════════════════════════════════════════════════════════════════════
   KDE ROVINA ZAČÍNÁ A KDE KONČÍ — HORNÍ A DOLNÍ HRANA V DANÉM MÍSTĚ
   ----------------------------------------------------------------------
   `vysoko` vrací HORNÍ hranu roviny (hřeben nebo nároží), `nizko` DOLNÍ
   (okap nebo ÚŽLABÍ). Krokev leží mezi nimi.

   PROČ TO DRUHÉ. Do 26. 8. 2026 se počítalo jen `vysoko` a předpokládalo
   se, že rovina dole vždycky začíná na okapu, tedy ve v = 0. U roviny,
   která má dole ÚŽLABÍ, to neplatí — v koutě rovina u okapu vůbec není
   a začíná až na úžlabnici.

   Důsledek býval hrubý (nahlásil PENTI 26. 8. 2026 na zakázce 165_26
   RD Bohuslavice): každá krokev vycházela v plné délce, žádné námětné
   krokve neexistovaly a dvě sousední roviny se v koutě u úžlabí
   překrývaly. Na té střeše to bylo 26,6 m² půdorysu pokrytého dvakrát
   a 55 metrů krokví navíc.

       délka krokve = vysoko(u) − nizko(u)

   U roviny bez úžlabí je `nizko` všude nula a nic se nemění.
   ══════════════════════════════════════════════════════════════════════ */
function hranyVU(rings, u){
  var top=null, bot=null;
  (rings||[]).forEach(function(r){
    for(var k=0;k<r.length;k++){
      var A=r[k], B=r[(k+1)%r.length];
      var x1=A[0], x2=B[0];
      if(Math.abs(x2-x1)<1e-9){
        /* Svislá hrana (štít) — v tom místě rovina sahá od jejího spodku
           k vrchu. Bez tohohle by se štítová krokev ztratila. */
        if(Math.abs(u-x1)<1e-9){
          if(top===null || A[1]>top) top=A[1];
          if(top===null || B[1]>top) top=B[1];
          if(bot===null || A[1]<bot) bot=A[1];
          if(bot===null || B[1]<bot) bot=B[1];
        }
        continue;
      }
      if(u >= Math.min(x1,x2)-1e-9 && u <= Math.max(x1,x2)+1e-9){
        var t=(u-x1)/(x2-x1), v=A[1]+t*(B[1]-A[1]);
        if(top===null || v>top) top=v;
        if(bot===null || v<bot) bot=v;
      }
    }
  });
  return { vrch:(top===null?0:top), spodek:(bot===null?0:bot) };
}

/* ══════════════════════════════════════════════════════════════════════
   NÁROŽÍ A ÚŽLABÍ — NAPOJENÍ NA penti-narozi.js (PENTI 1. 10. 2026)
   ----------------------------------------------------------------------
   Geometrii (gradování, srdcová sedla, námětky) počítá penti-narozi.js.
   Tady se pro každý úsek nároží/úžlabí najdou dvě sousední roviny a ze
   stejných čísel jako u běžné krokve se sestaví:
     · rovina HORNÍCH HRAN KROKVÍ: z = N/cos α − (přesah + odsazení poz.)·tg α
       + tg α · (vzdálenost od okapové hrany) — nula = horní plocha pozednice
       (stejně jako penti-vizualizace.js zDoleRov/zNahoreRov);
     · podpory: vnější hrana pozednice (přesah + odsazení od okapu, z = 0)
       a vnější hrana středové vaznice (přesah + x − b/2, z = výška vaznice).
   ══════════════════════════════════════════════════════════════════════ */
/* bod roviny (u podél okapu, v po spádu) → půdorys */
function bodRoviny(p, u, v){
  var B = p.baze, sec = B.sec || 1;
  return [B.a[0] + B.dir[0]*u + B.nrm[0]*(v/sec), B.a[1] + B.dir[1]*u + B.nrm[1]*(v/sec)];
}
function vzdalenostKUsecce(P, A, B){
  var dx=B[0]-A[0], dy=B[1]-A[1], L2=dx*dx+dy*dy;
  var t = L2>0 ? Math.max(0, Math.min(1, ((P[0]-A[0])*dx+(P[1]-A[1])*dy)/L2)) : 0;
  return Math.hypot(P[0]-A[0]-t*dx, P[1]-A[1]-t*dy);
}
/* jak daleko je bod (v půdorysu) od obrysu roviny */
function vzdalenostOdObrysu(p, P){
  var best = Infinity;
  (p.tvarRings || (p.tvar ? [p.tvar] : [])).forEach(function(r){
    for(var k=0;k<r.length;k++){
      var A = bodRoviny(p, r[k][0], r[k][1]), B = bodRoviny(p, r[(k+1)%r.length][0], r[(k+1)%r.length][1]);
      var d = vzdalenostKUsecce(P, A, B); if(d < best) best = d;
    }
  });
  return best;
}
/* dvě roviny, mezi kterými úsek leží (bod v půlce úseku je na obrysu obou) */
function rovinyUseku(roviny, sg){
  var M = [(sg.A[0]+sg.B[0])/2, (sg.A[1]+sg.B[1])/2];
  var kandidati = roviny.map(function(p){ return { p:p, d:vzdalenostOdObrysu(p, M) }; })
    .filter(function(x){ return x.d < 0.08; })
    .sort(function(a,b){ return a.d - b.d; });
  return kandidati.length >= 2 ? [kandidati[0].p, kandidati[1].p] : null;
}

/* Horní hrana roviny v daném místě. Zůstává samostatně — čte ji kresba
   i výpočet výšek a mění se tím míň, než kdyby všichni volali `hranyVU`. */
function vysoko(rings, u){ return hranyVU(rings,u).vrch; }

/* Dolní hrana roviny — okap (nula), nebo úžlabí (víc než nula). */
function nizko(rings, u){ return hranyVU(rings,u).spodek; }

/* Rozsah roviny ve vodorovném směru. */
function rozsahU(rings){
  var min=Infinity, max=-Infinity;
  (rings||[]).forEach(function(r){ r.forEach(function(p){
    if(p[0]<min) min=p[0]; if(p[0]>max) max=p[0]; }); });
  if(!isFinite(min)) return null;
  return {min:min, max:max, sirka:max-min};
}

/* Šířka roviny ve výšce v — kde krokve ještě sahají.
   Používá se pro délku středové vaznice: ta nesmí být delší než rovina
   v místě, kde leží. */
function sirkaVeVysce(rings, v){
  var r=rozsahU(rings); if(!r || r.sirka<=0) return 0;
  var kroku=200, prvni=null, posledni=null;
  for(var i=0;i<=kroku;i++){
    var u=r.min + r.sirka*i/kroku;
    if(vysoko(rings,u) >= v-1e-6){ if(prvni===null) prvni=u; posledni=u; }
  }
  return (prvni===null) ? 0 : (posledni-prvni);
}

/* Délky jednotlivých krokví v jedné rovině.
   Krokve se kladou od kraje roviny po zadané rozteči; délka každé se bere
   podle obrysu — u valby a úžlabí se proto zkracují.

   POZOR: obrys roviny UŽ OBSAHUJE PŘESAH OKAPU. Výpočetní jádro počítá
   střešní rovinu od okapové hrany včetně přesahu, takže se přesah nesmí
   přičítat podruhé — u domu 12×8 se sklonem 35° a přesahem 0,5 m by krokev
   vyšla 6,15 m místo správných 5,54 m, tedy o 11 % delší. */
/* Skutečná rozteč krokví v rovině. Zadaná rozteč je jen přání — krokve se
   po šířce roviny rozpustí rovnoměrně, aby krajní vyšly na okraje, takže
   skutečná rozteč je o kus jiná. Potřebuje ji okapový systém: hák patří
   ke krokvi (upřesněno PENTI 15. 8. 2026). */
function roztecVRovine(rovina, roztec, pole){
  var rings = rovina.tvarRings || (rovina.tvar ? [rovina.tvar] : []);
  var r = poleKrokvi(rings, pole);
  if(!r || r.sirka<=0.05) return 0;
  var poloh = Math.max(2, Math.floor(r.sirka/roztec) + 1);
  return (poloh>1) ? r.sirka/(poloh-1) : r.sirka;
}

/* ══════════════════════════════════════════════════════════════════════
   ŠTÍTOVÉ KONCE ROVINY A POLE PRO KROKVE
   ----------------------------------------------------------------------
   U zděného štítu (vyzděného po horní hranu krokví) krokve nad štítovou
   zdí být nemohou — pole, po kterém se rozmisťují, začíná až za zdí.
   Konec roviny je štítový, když u něj stojí štítová hrana obvodové zdi:
   hrana je kolmá na okap a její vnější líc leží kousek (do 1,5 m —
   přesah u štítu) od kraje obrysu roviny. Konec, kde štít není (nároží,
   úžlabí u tvaru L), zůstává, jak je — krokve tam jdou až na kraj.

   Vrací { vlevo, vpravo }: null, nebo { hrana, odKraje } — `odKraje` je
   vzdálenost VNĚJŠÍHO líce zdi od kraje roviny (= skutečný přesah u
   štítu, změřený z geometrie, ne ze zadání).
   ══════════════════════════════════════════════════════════════════════ */
function stitoveKonceRoviny(rovina, zed, stitoveHrany){
  var out = { vlevo:null, vpravo:null };
  var B = rovina && rovina.baze;
  if(!B || !zed || zed.length<3 || !stitoveHrany || !stitoveHrany.length) return out;
  var rings = rovina.tvarRings || (rovina.tvar ? [rovina.tvar] : []);
  var r = rozsahU(rings);
  if(!r) return out;
  var n = zed.length;
  stitoveHrany.forEach(function(i){
    var a = zed[i], b = zed[(i+1)%n];
    if(!a || !b) return;
    var dx=b[0]-a[0], dy=b[1]-a[1], dl=Math.hypot(dx,dy);
    if(dl<1e-6) return;
    /* štítová zeď musí být kolmá na okap roviny (rovnoběžná s jejím spádem) */
    if(Math.abs((dx*B.dir[0] + dy*B.dir[1])/dl) > 0.05) return;
    var u = (a[0]-B.a[0])*B.dir[0] + (a[1]-B.a[1])*B.dir[1];   // u zdi v souřadnici roviny
    var odL = u - r.min, odP = r.max - u;
    if(odL > -0.02 && odL < 1.5 && (!out.vlevo || odL < out.vlevo.odKraje))
      out.vlevo = { hrana:i, odKraje:r3(Math.max(0, odL)) };
    else if(odP > -0.02 && odP < 1.5 && (!out.vpravo || odP < out.vpravo.odKraje))
      out.vpravo = { hrana:i, odKraje:r3(Math.max(0, odP)) };
  });
  return out;
}

/* Rozsah, po kterém se kladou krokve. Bez `pole` je to celá rovina;
   `pole` = { odKraje: {vlevo, vpravo} } říká, o kolik se má na kterém
   konci ustoupit dovnitř (přesah + zeď + mezera u zděného štítu). */
function poleKrokvi(rings, pole){
  var r = rozsahU(rings);
  if(!r) return null;
  var L = (pole && pole.vlevo) || 0, P = (pole && pole.vpravo) || 0;
  if(L<=0 && P<=0) return r;
  var min = r.min + L, max = r.max - P;
  if(max - min < 0.05) return r;                 // zdi by se potkaly — nesmysl, nech celou rovinu
  return { min:min, max:max, sirka:max-min, sirkaRoviny:r.sirka, odKraje:{ vlevo:r3(L), vpravo:r3(P) } };
}

/* ══════════════════════════════════════════════════════════════════════
   POLOHY KROKVÍ NA ROVINĚ
   ----------------------------------------------------------------------
   Vrací OSY krokví v metrech podél okapové hrany. Do 16. 8. 2026 se
   nikde neuchovávaly — výkaz znal jen délky a půdorys si polohy počítal
   podruhé po svém. Jakmile ale jde krokvemi ručně hýbat (uhnout komínu
   nebo střešnímu oknu), musí být polohy na jednom místě, jinak by kresba
   ukazovala něco jiného, než co se objedná.

   ZADÁVÁ SE OSOVÁ VZDÁLENOST MEZI KROKVEMI, ne posun jednotlivé krokve
   (změněno na žádost PENTI 17. 8. 2026 — tesař měří mezery, ne odchylky).

   `roztece` je mapa index mezery → osová vzdálenost v metrech. Mezera 0
   je mezi první a druhou krokví. Co se nezadá, zůstane prázdné.

   JAK SE TO SKLÁDÁ. Krajní krokve drží hranu střechy, takže součet všech
   mezer musí dát přesně šířku roviny — poslední mezera se nedá zadat
   volně, vždycky něco dopočítává. Pravidlo je proto:

     · zadané mezery platí, jak jsou,
     · zbytek šířky si ROVNOMĚRNĚ rozdělí mezery, které zadané nejsou,
     · počet krokví se nemění (rozhodnuto PENTI 17. 8. 2026).

   Zúžení jedné mezery tedy ostatní o kousek roztáhne. To je v pořádku —
   z nejširšího pole se počítá posudek krokve i hustota sněhových háků,
   takže se roztažení samo promítne do ceny.

   Když zadané mezery nenechají na zbytek dost místa, ořežou se úměrně
   a řekne se to; nikdy se nesmí stát, že by krajní krokev utekla z hrany.

   `posuny` (index krokve → posun) je STARÝ způsob zadání. Zůstává kvůli
   uloženým scénářům: když rozteče zadané nejsou, převede se na ně.
   ══════════════════════════════════════════════════════════════════════ */
function polohyKrokviVRovineRovnomerne(rovina, roztec, posuny, roztece, pole){
  var rings = rovina.tvarRings || (rovina.tvar ? [rovina.tvar] : []);
  /* `pole` (nepovinné) zúží rozsah u zděných štítů — viz poleKrokvi(). */
  var r = poleKrokvi(rings, pole);
  if(!r || r.sirka<=0.05) return null;
  var poloh = Math.max(2, Math.floor(r.sirka/roztec) + 1);
  var krok = (poloh>1) ? r.sirka/(poloh-1) : r.sirka;
  var mezer = poloh - 1;
  var upozorneniPoloh = [];

  /* ── STARÉ POSUNY SE PŘEVEDOU NA MEZERY ────────────────────────────
     Uložený scénář zná jen posuny. Spočítají se z nich polohy po starém
     pravidlu a z poloh mezery — výsledek je pak identický jako dřív. */
  var zadane = {};
  var mamZadane = false;
  if(roztece){
    for(var kl in roztece){
      var v_ = n_(roztece[kl]);
      if(v_ > 0.02){ zadane[+kl] = v_; mamZadane = true; }
    }
  }
  if(!mamZadane && posuny){
    var osyStare = [], jePosun = false;
    for(var i0=0;i0<poloh;i0++){
      var u0 = r.min + krok*i0;
      if(i0>0 && i0<poloh-1){
        var d0 = n_(posuny[i0]);
        if(d0){
          var minU = r.min + krok*(i0-1) + 0.05, maxU = r.min + krok*(i0+1) - 0.05;
          u0 = Math.min(Math.max(u0+d0, minU), maxU);
          jePosun = true;
        }
      }
      osyStare.push(u0);
    }
    if(jePosun){
      for(var m0=0;m0<mezer;m0++) zadane[m0] = osyStare[m0+1] - osyStare[m0];
      mamZadane = true;
    }
  }

  /* ── ROZDĚLENÍ ZBYTKU ──────────────────────────────────────────────── */
  var sirkyMezer = new Array(mezer), soucetZadanych = 0, volnych = 0;
  for(var m=0;m<mezer;m++){
    if(zadane[m] != null){ sirkyMezer[m] = zadane[m]; soucetZadanych += zadane[m]; }
    else { sirkyMezer[m] = null; volnych++; }
  }
  var zbytek = r.sirka - soucetZadanych;
  if(volnych > 0){
    /* Na každou volnou mezeru musí zůstat aspoň 5 cm, jinak by krokve
       splynuly. Když nezůstane, zadané se úměrně zmenší. */
    var minVolna = 0.05 * volnych;
    if(zbytek < minVolna){
      var kolik = soucetZadanych - (r.sirka - minVolna);
      var faktor = (soucetZadanych > 0) ? (soucetZadanych - kolik) / soucetZadanych : 1;
      upozorneniPoloh.push("Zadané osové vzdálenosti na rovině dají dohromady "
        + r2(soucetZadanych) + " m, ale rovina je široká jen " + r2(r.sirka)
        + " m. Zmenšily se v poměru, aby se krajní krokve udržely na hraně "
        + "střechy — zkontroluj je.");
      for(var z=0;z<mezer;z++) if(sirkyMezer[z]!=null) sirkyMezer[z] *= faktor;
      zbytek = minVolna;
    }
    var naVolnou = zbytek / volnych;
    for(var w=0;w<mezer;w++) if(sirkyMezer[w]==null) sirkyMezer[w] = naVolnou;
  } else if(mezer > 0 && Math.abs(zbytek) > 0.001){
    /* Zadané jsou všechny — poslední dorovná, aby kraj seděl. */
    sirkyMezer[mezer-1] += zbytek;
    if(sirkyMezer[mezer-1] < 0.05){
      upozorneniPoloh.push("Poslední osová vzdálenost musí dorovnat šířku "
        + "roviny a vyšla by menší než 5 cm. Uvolni některou z předchozích.");
      sirkyMezer[mezer-1] = 0.05;
    }
  }

  /* ── POLOHY ────────────────────────────────────────────────────────── */
  var osy=[r.min], posunuto=[0];
  for(var s=0;s<mezer;s++) osy.push(osy[s] + sirkyMezer[s]);
  /* Poslední osa se posadí přesně na hranu — drobná odchylka ze sčítání
     desetinných čísel by jinak krajní krokev odsunula. */
  osy[osy.length-1] = r.max;
  /* Posuny proti rovnoměrnému rozdělení — kreslení a hlášení je pořád
     používají a je z nich hned vidět, co je ručně upravené. */
  for(var q=1;q<osy.length;q++) posunuto.push(r3(osy[q] - (r.min + krok*q)));
  posunuto[osy.length-1] = 0;

  /* Skutečná pole mezi sousedními krokvemi — z nich se posuzuje krokev
     a z největšího z nich vychází i to, jak hustě jdou sněhové háky. */
  var pole=[];
  for(var k=1;k<osy.length;k++) pole.push(r3(osy[k]-osy[k-1]));
  return { osy:osy, posuny:posunuto, pole:pole, krok:r3(krok),
           min:r.min, max:r.max, sirka:r.sirka,
           /* celá šířka roviny a o kolik pole krokví ustupuje od jejích
              krajů (zděné štíty); bez zúžení je to totéž a nuly */
           sirkaRoviny: (r.sirkaRoviny != null) ? r.sirkaRoviny : r.sirka,
           odKraje: r.odKraje || { vlevo:0, vpravo:0 },
           rucni: mamZadane, upozorneni: upozorneniPoloh,
           nejdelsiPole: pole.length ? r3(Math.max.apply(null,pole)) : r3(krok) };
}


/* ══════════════════════════════════════════════════════════════════════
   ROZVRH KROKVÍ OD HŘEBENE (PENTI 1. 10. 2026)
   ----------------------------------------------------------------------
   „U valbové střechy na sebe nenavazují protilehlé krokve … Je zvykem,
   že první pár krokví za valbou se dotýká nároží a mitláku v hřebeni —
   je to i z montážních důvodů."

   Dřív se krokve rozdělily na každé rovině zvlášť rovnoměrně po okapu,
   takže protilehlé roviny o sobě nevěděly a páry se trefily jen na
   úplně souměrné střeše. Teď:
     · HLAVNÍ ROVINA (nahoře hřeben): na konci hřebene, kde se sbíhají
       nároží / úžlabí, stojí PRVNÍ PÁR — bokem se dotýká styku (osa je
       o půl šířky krokve za ním). Mezi prvními páry se hřeben rozdělí
       rovnoměrně s roztečí nejvýš podle zadání. Obě protilehlé roviny
       počítají ze stejných bodů hřebene → krokve tvoří páry. Za prvním
       párem pokračují námětky stejnou roztečí. Konec hřebene u štítu
       zůstává jako dřív (krajní krokev u štítu).
     · VALBA (nahoře jen vrchol, kde se sbíhají nároží): MITLÁK v ose
       hřebene, námětky od něj na obě strany roztečí hlavních krokví.
     · Rovina s ručně zadanými mezerami si nechá dřívější rozvrh
       (a ohlásí to) — uložené zakázky se samy nepřestaví.
   Sedlová a pultová střecha (hřeben jen mezi štíty) beze změny.
   ══════════════════════════════════════════════════════════════════════ */
function rucneZadaneRozteceKrokvi(roztece, posuny){
  var k;
  if(roztece) for(k in roztece) if(n_(roztece[k]) > 0.02) return true;
  if(posuny)  for(k in posuny)  if(Math.abs(n_(posuny[k])) > 0.0005) return true;
  return false;
}
/* Body, ze kterých se rozvrh počítá, pro každou rovinu:
     { typ:"hreben", uA, uB, pevnaA, pevnaB, bK }  — hlavní rovina
     { typ:"mitlak", u, krok, bK }                  — valba
   `pevna` = konec hřebene je ve styku nároží / úžlabí (ne u štítu). */
function kotvyRozvrhuKrokvi(roviny, segs, roztec, bK){
  var ven = {}, TOL = 0.05;
  var naObrysu = function(p, P){ return vzdalenostOdObrysu(p, P) < TOL; };
  var jeStyk = function(P){
    return (segs||[]).some(function(sg){
      if(sg.type!=="narozi" && sg.type!=="uzlabi") return false;
      return Math.hypot(sg.A[0]-P[0], sg.A[1]-P[1]) < TOL || Math.hypot(sg.B[0]-P[0], sg.B[1]-P[1]) < TOL;
    });
  };
  var uBodu = function(p, P){ return (P[0]-p.baze.a[0])*p.baze.dir[0] + (P[1]-p.baze.a[1])*p.baze.dir[1]; };
  var vBodu = function(p, P){ return (P[0]-p.baze.a[0])*p.baze.nrm[0] + (P[1]-p.baze.a[1])*p.baze.nrm[1]; };
  (roviny||[]).forEach(function(p){
    if(!p.baze) return;
    var hrebeny = (segs||[]).filter(function(sg){
      if(sg.type!=="hreben") return false;
      var M = [(sg.A[0]+sg.B[0])/2, (sg.A[1]+sg.B[1])/2];
      return naObrysu(p, sg.A) && naObrysu(p, sg.B) && naObrysu(p, M);
    });
    if(hrebeny.length){
      var body = [];
      hrebeny.forEach(function(sg){ body.push(sg.A, sg.B); });
      body.sort(function(P, Q){ return uBodu(p, P) - uBodu(p, Q); });
      var PA = body[0], PB = body[body.length-1];
      var k = { typ:"hreben", uA:uBodu(p, PA), uB:uBodu(p, PB), pevnaA:jeStyk(PA), pevnaB:jeStyk(PB), bK:bK };
      k._hrebeny = hrebeny; k._p = p;
      ven[p.cislo] = k;
      return;
    }
    /* valba: vrchol, kde se na obrysu roviny sbíhají aspoň dvě nároží */
    var konce = [];
    (segs||[]).forEach(function(sg){
      if(sg.type!=="narozi") return;
      var M = [(sg.A[0]+sg.B[0])/2, (sg.A[1]+sg.B[1])/2];
      if(!naObrysu(p, M)) return;
      konce.push(sg.A, sg.B);
    });
    var vrchol = null, vMax = -Infinity;
    konce.forEach(function(P){
      var kolik = konce.filter(function(Q){ return Math.hypot(P[0]-Q[0], P[1]-Q[1]) < TOL; }).length;
      if(kolik >= 2 && vBodu(p, P) > vMax){ vMax = vBodu(p, P); vrchol = P; }
    });
    if(vrchol) ven[p.cislo] = { typ:"mitlak", u:uBodu(p, vrchol), bK:bK };
  });
  /* valba: námětky od mitláku zadanou roztečí (jako námětky hlavních rovin) */
  Object.keys(ven).forEach(function(c){ if(ven[c].typ==="mitlak") ven[c].krok = roztec; });

  /* ── PÁRY PO CELÉM HŘEBENU (PENTI 3. 10. 2026) ───────────────────────
     „Krokve na protilehlých plochách by se měly vždy stýkat v hřebeni."
     U střech T a L je hřeben z jedné strany přerušený křídlem: nahoře
     je jedna souvislá rovina, dole dvě. Dřív si každá rovina rozvrhla
     krokve sama, takže páry neseděly. Teď se kotvy počítají pro CELÝ
     hřeben (řetěz hřebenových úseků v jedné přímce) a každá rovina u něj
     dostane stejné body:
       · konec hřebene u štítu ............ krajní krokev (kraj pole),
       · konec ve styku nároží / úžlabí ... první pár bokem u styku,
       · úžlabí (nároží) vbíhající do hřebene uprostřed ... CELÝ PÁR přesně
         v bodě styku — úžlabníky se o krokev protější roviny opřou
         (schváleno PENTI, volba B).
     Mezi kotvami rovnoměrně, nejvýš zadanou roztečí. */
  var hrebenoveRoviny = Object.keys(ven).filter(function(c){ return ven[c].typ === "hreben"; });
  var useky = [];
  hrebenoveRoviny.forEach(function(c){ (ven[c]._hrebeny||[]).forEach(function(sg){ if(useky.indexOf(sg) < 0) useky.push(sg); }); });
  var smerU = function(sg){ var dx=sg.B[0]-sg.A[0], dy=sg.B[1]-sg.A[1], l=Math.hypot(dx,dy)||1; return [dx/l, dy/l]; };
  var naPrimce = function(sg, P){ var d=smerU(sg); return Math.abs((P[0]-sg.A[0])*d[1] - (P[1]-sg.A[1])*d[0]) < TOL; };
  /* řetězy: úseky v jedné přímce, které na sebe navazují */
  var rodic = useky.map(function(_, i){ return i; });
  var koren = function(i){ while(rodic[i] !== i) i = rodic[i] = rodic[rodic[i]]; return i; };
  for(var i1=0;i1<useky.length;i1++) for(var j1=i1+1;j1<useky.length;j1++){
    var a1=useky[i1], b1=useky[j1], da=smerU(a1), db=smerU(b1);
    if(Math.abs(da[0]*db[1]-da[1]*db[0]) > 0.01 || !naPrimce(a1, b1.A) || !naPrimce(a1, b1.B)) continue;
    var dotyk = [a1.A, a1.B].some(function(P){ return [b1.A, b1.B].some(function(Q){ return Math.hypot(P[0]-Q[0], P[1]-Q[1]) < TOL; }); });
    if(dotyk) rodic[koren(j1)] = koren(i1);
  }
  var retezy = {};
  useky.forEach(function(sg, i){ var r=koren(i); (retezy[r] = retezy[r] || []).push(sg); });
  Object.keys(retezy).forEach(function(r){
    var R = retezy[r], d = smerU(R[0]), O = R[0].A;
    var tB = function(P){ return (P[0]-O[0])*d[0] + (P[1]-O[1])*d[1]; };
    var t0 = Infinity, t1 = -Infinity, E0 = null, E1 = null;
    R.forEach(function(sg){ [sg.A, sg.B].forEach(function(P){ var t=tB(P); if(t<t0){ t0=t; E0=P; } if(t>t1){ t1=t; E1=P; } }); });
    /* úžlabí / nároží, která vbíhají do hřebene UVNITŘ (ne na konci) */
    var uzly = [];
    (segs||[]).forEach(function(sg){
      if(sg.type!=="narozi" && sg.type!=="uzlabi") return;
      [sg.A, sg.B].forEach(function(P){
        if(!naPrimce(R[0], P)) return;
        var t = tB(P);
        if(t > t0 + TOL && t < t1 - TOL && !uzly.some(function(Q){ return Math.hypot(Q[0]-P[0], Q[1]-P[1]) < TOL; })) uzly.push(P);
      });
    });
    if(!uzly.length) return;          // hřeben bez styku uprostřed → páry už teď sedí, nic se nemění
    hrebenoveRoviny.forEach(function(c){
      var k = ven[c];
      if(!(k._hrebeny||[]).some(function(sg){ return R.indexOf(sg) >= 0; })) return;
      var p = k._p;
      var K = [{ P:E0, typ: jeStyk(E0) ? "styk" : "stit" }, { P:E1, typ: jeStyk(E1) ? "styk" : "stit" }]
        .concat(uzly.map(function(P){ return { P:P, typ:"uzel" }; }))
        .map(function(x){ return { u: uBodu(p, x.P), typ: x.typ }; })
        .sort(function(a, b){ return a.u - b.u; });
      k.retez = { kotvy: K };
    });
  });
  Object.keys(ven).forEach(function(c){ delete ven[c]._hrebeny; delete ven[c]._p; });
  return ven;
}
/* Rozvrh krokví podle kotev celého hřebene (páry s protější rovinou).
   Vrací totéž co rozvrhOdHrebene, nebo null (bez řetězu kotev). */
function rozvrhPoHrebeni(r, roztec, kotvy){
  var K = kotvy.retez && kotvy.retez.kotvy;
  if(!K || K.length < 2) return null;
  var bK = kotvy.bK || 0.1, eps = 0.02;
  var uMin = Math.min(kotvy.uA, kotvy.uB), uMax = Math.max(kotvy.uA, kotvy.uB);   // vlastní kus hřebene
  /* poloha kotvy: štít = kraj pole (štít mimo tuto rovinu se nepoužije),
     styk na konci hřebene = osa o půl krokve dovnitř, uzel = přesně v bodě */
  var A = K.map(function(x, i){
    var u = x.u;
    if(x.typ === "stit"){
      if(Math.abs(u - uMin) < 0.05 || u < r.min + 0.05) u = Math.max(r.min, Math.min(u, r.max));
      if(Math.abs(u - uMax) < 0.05 || u > r.max - 0.05) u = Math.min(r.max, Math.max(u, r.min));
      if(Math.abs(x.u - uMin) < 0.06) u = r.min;
      if(Math.abs(x.u - uMax) < 0.06) u = r.max;
    } else if(x.typ === "styk") u = (i === 0) ? u + bK/2 : u - bK/2;
    return { u:u, typ:x.typ, puvodni:x.u };
  });
  var osy = [];
  var pridej = function(u){ if(!osy.some(function(q){ return Math.abs(q - u) < 0.003; })) osy.push(u); };
  for(var i=0;i+1<A.length;i++){
    var a = A[i].u, b = A[i+1].u;
    /* jen úseky, které leží na vlastním kusu hřebene této roviny */
    var prekryv = Math.min(b, uMax + 0.01) - Math.max(a, uMin - 0.01);
    if(!(b - a > 0.02) || prekryv < 0.05) continue;
    var n = Math.max(1, Math.ceil((b - a)/roztec - 1e-9)), krok = (b - a)/n;
    for(var j=0;j<=n;j++) pridej(j === n ? b : a + krok*j);
  }
  /* krokev přesně ve vrcholu úžlabí, kde vlastní kus hřebene končí,
     by měla nulovou délku — tu rovinu nemá (úžlabníky se opřou o
     krokev protější roviny) */
  A.forEach(function(x){
    if(x.typ !== "uzel") return;
    if(Math.abs(x.puvodni - uMin) < 0.02 || Math.abs(x.puvodni - uMax) < 0.02)
      osy = osy.filter(function(q){ return Math.abs(q - x.u) > 0.003; });
  });
  osy = osy.filter(function(u){ return u >= r.min - 0.002 && u <= r.max + 0.002; })
           .map(function(u){ return Math.min(Math.max(u, r.min), r.max); })
           .sort(function(a, b){ return a - b; });
  if(!osy.length) return null;
  var hreben = { od:r3(osy[0]), do:r3(osy[osy.length-1]) };
  /* za prvním / posledním párem pokračují námětky (lípance) zadanou
     roztečí — jen tam, kde vlastní kus hřebene končí stykem */
  if(kotvy.pevnaA) for(var u1 = osy[0] - roztec; u1 > r.min + eps; u1 -= roztec) osy.unshift(u1);
  if(kotvy.pevnaB) for(var u2 = osy[osy.length-1] + roztec; u2 < r.max - eps; u2 += roztec) osy.push(u2);
  var pole = [];
  for(var k=1;k<osy.length;k++) pole.push(r3(osy[k]-osy[k-1]));
  var krokMax = pole.length ? Math.max.apply(null, pole) : roztec;
  return { osy:osy, posuny:osy.map(function(){ return 0; }), pole:pole, krok:r3(krokMax),
           min:r.min, max:r.max, sirka:r.sirka,
           sirkaRoviny: (r.sirkaRoviny != null) ? r.sirkaRoviny : r.sirka,
           odKraje: r.odKraje || { vlevo:0, vpravo:0 },
           rucni:false, upozorneni:[],
           nejdelsiPole: r3(krokMax),
           rozvrh: "od hřebene", hreben: hreben, mitlak: null, paryPoHrebeni: true };
}
function rozvrhOdHrebene(r, roztec, kotvy){
  var osy = [], krok = roztec, hreben = null, mitlak = null, eps = 0.02;
  if(kotvy.typ === "hreben"){
    if(!kotvy.pevnaA && !kotvy.pevnaB) return null;           // jen štíty — beze změny
    var A = kotvy.pevnaA ? kotvy.uA + kotvy.bK/2 : r.min;
    var B = kotvy.pevnaB ? kotvy.uB - kotvy.bK/2 : r.max;
    A = Math.max(A, r.min); B = Math.min(B, r.max);
    if(B - A < 0.05){ osy = [(A + B)/2]; }                     // hřeben kratší než krokev: jeden pár
    else {
      var n = Math.max(1, Math.ceil((B - A)/roztec - 1e-9));
      krok = (B - A)/n;
      for(var i=0;i<=n;i++) osy.push(A + krok*i);
      osy[osy.length-1] = B;
    }
    hreben = { od:r3(osy[0]), do:r3(osy[osy.length-1]) };
    /* Námětky za prvním párem jdou ZADANOU roztečí — úsek mezi prvními
       páry bývá krátký a jeho dorovnaná rozteč by námětky zbytečně zhustila. */
    var krokN = roztec;
    if(kotvy.pevnaA) for(var u1 = osy[0] - krokN; u1 > r.min + eps; u1 -= krokN) osy.unshift(u1);
    if(kotvy.pevnaB) for(var u2 = osy[osy.length-1] + krokN; u2 < r.max - eps; u2 += krokN) osy.push(u2);
  } else if(kotvy.typ === "mitlak"){
    krok = kotvy.krok || roztec;
    mitlak = Math.min(Math.max(kotvy.u, r.min), r.max);
    osy = [mitlak];
    for(var u3 = mitlak - krok; u3 > r.min + eps; u3 -= krok) osy.unshift(u3);
    for(var u4 = mitlak + krok; u4 < r.max - eps; u4 += krok) osy.push(u4);
  } else return null;
  var pole = [];
  for(var k=1;k<osy.length;k++) pole.push(r3(osy[k]-osy[k-1]));
  return { osy:osy, posuny:osy.map(function(){ return 0; }), pole:pole, krok:r3(krok),
           min:r.min, max:r.max, sirka:r.sirka,
           sirkaRoviny: (r.sirkaRoviny != null) ? r.sirkaRoviny : r.sirka,
           odKraje: r.odKraje || { vlevo:0, vpravo:0 },
           rucni:false, upozorneni:[],
           nejdelsiPole: pole.length ? r3(Math.max.apply(null, pole)) : r3(krok),
           rozvrh: kotvy.typ === "mitlak" ? "valba" : "od hřebene",
           hreben: hreben, mitlak: mitlak != null ? r3(mitlak) : null };
}
/* ── PŘESNÉ POLOHY KROKVÍ Z EDITORU (PENTI 3. 10. 2026, etapa 3, var. A) ──
   `rucniOsy` = { osy:[u…], min, max, iHreben:[i0,i1]|null, iMitlak:i|null }
   — polohy VŠECH krokví roviny v metrech podél okapu, jak je uživatel
   rozmístil v půdorysu. Platí přesně (počet krokví = délka seznamu);
   krajní krokve jdou posunout taky (nejkratší námětek u nároží/úžlabí
   se tak dá odsunout od rohu, aby byl dost dlouhý).

   Proč ne mezery (`roztece`): u roviny s rozvrhem od hřebene by první
   zadaná mezera přestavěla celou rovinu — jiný počet krokví, krajní
   v rohu s nulovou délkou, páry s protější rovinou rozbité (zjištěno
   3. 10. 2026).

   `min`/`max` jsou otisk roviny v okamžiku úpravy. Když se rovina mezitím
   změnila (rozměr, sklon, přesah), ruční polohy přestanou platit, rovina
   jde zpátky na automatiku a řekne se to — staré polohy by na jiné
   rovině nedávaly smysl.

   Páry pod hřebenem a mitlák se drží PODLE POŘADÍ krokve (iHreben,
   iMitlak) — kleštiny a hambálky pak jdou na tytéž krokve jako dřív. */
function polohyKrokviRucne(rovina, roztec, posuny, roztece, pole, kotvy, rucniOsy){
  var auto = polohyKrokviVRovine(rovina, roztec, posuny, roztece, pole, kotvy, null);
  if(!auto) return auto;
  if(Math.abs(auto.min - n_(rucniOsy.min)) > 0.01 || Math.abs(auto.max - n_(rucniOsy.max)) > 0.01){
    auto.upozorneni = (auto.upozorneni||[]).concat(["Rovina se od ručního rozmístění krokví změnila — "
      + "krokve jsou zase rozmístěné automaticky. Upravte je v půdorysu znovu."]);
    auto.rucniOsyNeplati = true;
    return auto;
  }
  var osy = [];
  rucniOsy.osy.map(function(u){ return n_(u); }).filter(function(u){ return isFinite(u); })
    .map(function(u){ return Math.min(Math.max(u, auto.min), auto.max); })
    .sort(function(a,b){ return a-b; })
    .forEach(function(u){ if(!osy.length || u - osy[osy.length-1] > 0.03) osy.push(u); });
  if(osy.length < 2) return auto;
  var pole = [];
  for(var k=1;k<osy.length;k++) pole.push(r3(osy[k]-osy[k-1]));
  /* posun proti automatice — podle něj se v obrázku zvýrazní, co je
     ručně posunuté (při stejném počtu krokví) */
  var posunuto = osy.map(function(u, i){
    return (auto.osy.length === osy.length) ? r3(u - auto.osy[i]) : 0; });
  var iH = rucniOsy.iHreben, hreben = auto.hreben;
  if(iH && osy[iH[0]] != null && osy[iH[1]] != null) hreben = { od:r3(osy[iH[0]]), do:r3(osy[iH[1]]) };
  var mitlak = (rucniOsy.iMitlak != null && osy[rucniOsy.iMitlak] != null) ? r3(osy[rucniOsy.iMitlak]) : auto.mitlak;
  return { osy:osy, posuny:posunuto, pole:pole, krok:auto.krok,
           min:auto.min, max:auto.max, sirka:auto.sirka, sirkaRoviny:auto.sirkaRoviny,
           odKraje:auto.odKraje, rucni:true, rucniOsy:true,
           /* smazané krokve (výběr ve vrstvě Krov, 4. 10. 2026): velká mezera
              — latě, kontralatě ani bednění ji nepřenesou */
           upozorneni:(pole.length && Math.max.apply(null, pole) > 1.2)
             ? ["V rovině je mezera mezi krokvemi " + r2(Math.max.apply(null, pole)) + " m — latě, kontralatě ani bednění "
                + "ji nepřenesou. Doplňte krokev, výměnu nebo vazníky (posudek krokví počítá s největší mezerou)."] : [],
           nejdelsiPole: pole.length ? r3(Math.max.apply(null, pole)) : auto.krok,
           rozvrh:"ručně v půdorysu", rozvrhAuto:auto.rozvrh, hreben:hreben, mitlak:mitlak };
}
function polohyKrokviVRovine(rovina, roztec, posuny, roztece, pole, kotvy, rucniOsy){
  if(rucniOsy && rucniOsy.osy && rucniOsy.osy.length)
    return polohyKrokviRucne(rovina, roztec, posuny, roztece, pole, kotvy, rucniOsy);
  var rucne = rucneZadaneRozteceKrokvi(roztece, posuny);
  if(kotvy && !rucne){
    var rings = rovina.tvarRings || (rovina.tvar ? [rovina.tvar] : []);
    var r = poleKrokvi(rings, pole);
    if(r && r.sirka > 0.05){
      /* páry po celém hřebenu (T, L — hřeben přerušený z jedné strany) */
      var spolecne = kotvy.retez ? rozvrhPoHrebeni(r, roztec, kotvy) : null;
      if(spolecne) return spolecne;
      var nove = rozvrhOdHrebene(r, roztec, kotvy);
      if(nove) return nove;
    }
  }
  var pk = polohyKrokviVRovineRovnomerne(rovina, roztec, posuny, roztece, pole);
  if(pk){
    /* Kde jsou páry krokví pod hřebenem (pro kleštiny a hambálky). Bez
       hřebene (valba) žádné — kleštiny se do valby nedávají. */
    pk.hreben = null; pk.mitlak = null; pk.rozvrh = "rovnoměrně";
    if(kotvy && kotvy.typ === "hreben"){
      pk.hreben = (kotvy.pevnaA || kotvy.pevnaB)
        ? { od:r3(Math.max(pk.min, kotvy.uA - 0.01)), do:r3(Math.min(pk.max, kotvy.uB + 0.01)) }
        : { od:pk.min, do:pk.max };
      if(rucne && (kotvy.pevnaA || kotvy.pevnaB))
        pk.upozorneni.push("Rovina má ručně zadané mezery mezi krokvemi — rozvrh od hřebene "
          + "(první pár krokví u styku nároží) se nepoužil. Pro páry krokví ruční mezery vymaž.");
    } else if(!kotvy) pk.hreben = { od:pk.min, do:pk.max };      // starší volání bez kotev
    if(kotvy && kotvy.typ === "mitlak" && rucne)
      pk.upozorneni.push("Valba má ručně zadané mezery mezi krokvemi — mitlák v ose hřebene se nehlídá.");
  }
  return pk;
}

/* ══════════════════════════════════════════════════════════════════════
   VIKÝŘE V KROVU (etapa 3a, 2026.11.206 — schválil PENTI 8. 11. 2026)
   ----------------------------------------------------------------------
   Otvor vikýře přeruší krokve hlavní střechy. Rovina dostane od kalkulačky
   seznam otvorů `rovina.otvoryKrovu` = [{u0,u1,v0,v1,naOkapu,klic}]
   v souřadnicích roviny (u podél okapu, v po spádu od okapní hrany).

   Pravidla (PENTI 8. 11. 2026, varianty 1A + 2A):
   - k OBĚMA BOKŮM otvoru přijde ZESÍLENÁ krokev (o stupeň vyšší profil);
     rozvrh ostatních krokví se nehýbe. Leží-li běžná krokev do 15 cm
     od boku, stane se zesílenou ona (aby nebyly dvě vedle sebe);
   - krokev UVNITŘ otvoru se rozdělí na DOLNÍ kus (okap → spodní výměna)
     a HORNÍ kus (horní výměna → hřeben), ve výkazu jako dva kusy;
   - HORNÍ VÝMĚNA vždy, SPODNÍ jen když vikýř nestojí na okapu a je
     zapnutá (Z.vikyreSpodniVymena); délka = osa–osa zesílených krokví.
   Pozice krokví (pk.osy) zůstávají — statika, háky i číslování se
   nehnou. 3D a výrobní výkresy přijdou v krocích 3c a 3d.
   ══════════════════════════════════════════════════════════════════════ */
var VIKYR_BOK_TOL = 0.15;          // běžná krokev blíž k boku = zesílená
var VIKYR_STENA_KN_M2 = 0.6;       // tíha stěn vikýře na m² (PENTI 8. 11. 2026, krok 3b)

/* Patří krokev v ose u k otvoru vikýře? Vrací null (běžná krokev),
   {nahrazena:true, otvor} nebo {rezana:true, otvor}. */
function vikyrKrokev(rovina, u){
  var ot = rovina && rovina.otvoryKrovu; if(!ot || !ot.length) return null;
  for(var i=0;i<ot.length;i++){
    var o=ot[i];
    if(Math.abs(u-o.u0)<=VIKYR_BOK_TOL || Math.abs(u-o.u1)<=VIKYR_BOK_TOL) return { nahrazena:true, otvor:o };
    if(u>o.u0 && u<o.u1) return { rezana:true, otvor:o };
  }
  return null;
}

/* O jeden stupeň vyšší profil (stejná řada jako penti-vikyre.js). */
var VIKYR_RADA_VYSEK = [140,160,180,200,220,240,260,280,300,320];
function vikyrOStupenVys(p){
  var h=(p && p.h) || 180;
  for(var i=0;i<VIKYR_RADA_VYSEK.length;i++) if(VIKYR_RADA_VYSEK[i]>h) return { b:(p && p.b) || 100, h:VIKYR_RADA_VYSEK[i] };
  return { b:(p && p.b) || 100, h:h };
}

/* Zesílené krokve a výměny jedné roviny. `pk` = rozvrh krokví roviny,
   `pzh` = přídavek za hřebenem. Vrací { zesilene:[m], vymenyHorni:[m],
   vymenyDolni:[m], rezanych:n, detail:[…] } — detail je pro výkres. */
function vikyreVRovine(rovina, pk, pzh, spodniVymena){
  var ven={ zesilene:[], vymenyHorni:[], vymenyDolni:[], rezanych:0, detail:[] };
  var ot = rovina && rovina.otvoryKrovu; if(!ot || !ot.length || !pk) return ven;
  var rings = rovina.tvarRings || (rovina.tvar ? [rovina.tvar] : []);
  var delkaV = function(u){
    var uu=Math.min(Math.max(u, pk.min+0.02), pk.max-0.02), h=hranyVU(rings, uu);
    return { h:h, L:r2(h.vrch-h.spodek+pzh) };
  };
  ot.forEach(function(o){
    var d={ klic:o.klic||null, u0:o.u0, u1:o.u1, v0:o.v0, v1:o.v1, naOkapu:!!o.naOkapu,
            zesilene:[], rezane:[], vymeny:[], otvor:o, doVaznice:!!o.doVaznice, naKrokve:!!o.naKrokve };
    /* zesílená krokev u každého boku: běžná do 15 cm, jinak nová přesně na boku */
    [o.u0, o.u1].forEach(function(uBok){
      var nej=-1;
      pk.osy.forEach(function(u, k){ if(Math.abs(u-uBok)<=VIKYR_BOK_TOL && (nej<0 || Math.abs(u-uBok)<Math.abs(pk.osy[nej]-uBok))) nej=k; });
      var u = nej>=0 ? pk.osy[nej] : uBok;
      var x = delkaV(u);
      if(!(x.L>0.30)) return;
      ven.zesilene.push(x.L);
      d.zesilene.push({ u:r3(u), nahrazuje: nej>=0 ? nej : null, delka:x.L, spodek:x.h.spodek, vrch:x.h.vrch });
    });
    /* rozdělené krokve uvnitř otvoru */
    pk.osy.forEach(function(u, k){
      var kl=vikyrKrokev(rovina, u);
      if(!kl || !kl.rezana || kl.otvor!==o) return;
      var x=delkaV(u);
      d.rezane.push({ u:r3(u), index:k, spodek:x.h.spodek, vrch:x.h.vrch });
      ven.rezanych++;
    });
    /* výměny mezi zesílenými krokvemi (osa–osa) */
    var uL = d.zesilene.length ? d.zesilene[0].u : o.u0;
    var uP = d.zesilene.length>1 ? d.zesilene[1].u : o.u1;
    var sir = r2(Math.abs(uP-uL));
    if(sir>0.1){
      /* pultový vikýř z panelů: krokve pultu leží na vaznici, otvor sahá
         k ní a horní kusy přerušených krokví začínají na vaznici —
         horní výměna odpadá (PENTI 8. 11. 2026, etapa 4a) */
      if(!o.doVaznice){ ven.vymenyHorni.push(sir); d.vymeny.push({ druh:"horni", v:o.v1, uL:uL, uP:uP, delka:sir }); }
      var hS = delkaV((uL+uP)/2).h;
      if(spodniVymena!==false && !o.naOkapu && (o.v0-hS.spodek)>0.30){
        ven.vymenyDolni.push(sir); d.vymeny.push({ druh:"dolni", v:o.v0, uL:uL, uP:uP, delka:sir });
      }
    }
    ven.detail.push(d);
  });
  return ven;
}

function krokveVRovine(rovina, roztec, presahHreben, posuny, roztece, pole, oprava, kotvy, rucniOsy){
  var rings = rovina.tvarRings || (rovina.tvar ? [rovina.tvar] : []);
  var pk = polohyKrokviVRovine(rovina, roztec, posuny, roztece, pole, kotvy, rucniOsy);
  if(!pk) return [];
  var out=[];
  for(var i=0;i<pk.osy.length;i++){
    var u=pk.osy[i];
    /* na samém kraji obrys „utíká" do špičky — posuneme se o pár centimetrů dovnitř */
    var uu=Math.min(Math.max(u, pk.min+0.02), pk.max-0.02);
    /* Krokev leží mezi dolní a horní hranou roviny. Nad úžlabím je dolní
       hrana úžlabnice, ne okap — z toho vyjde krátká námětná krokev. */
    var h=hranyVU(rings, uu);
    var v=h.vrch - h.spodek;
    /* Kratší než 30 cm už není krokev, ale klínek u úžlabnice. Do výkazu
       nepatří — objednal by se metr dřeva, který nikdo neuřízne. */
    if(v<=0.30) continue;
    /* NÁMĚTEK / LÍPANEC (1. 10. 2026): krokev, která končí na nárožníku
       nebo úžlabníku, se měří k jeho BOKU (nejdelší hrana šikmého řezu),
       ne k ose — a bez přídavku na plát u hřebene. `oprava` vrátí novou
       délku, nebo null pro běžnou krokev. */
    var opr = oprava ? oprava(uu, h) : null;
    var plna = (opr != null ? opr : v + presahHreben);
    /* VIKÝŘ (etapa 3a): krokev u boku otvoru je zesílená — počítá se
       zvlášť (vikyreVRovine); krokev v otvoru = dolní + horní kus. */
    var kv = vikyrKrokev(rovina, u);
    if(kv && kv.nahrazena) continue;
    if(kv && kv.rezana){
      var dol = kv.otvor.naOkapu ? 0 : (kv.otvor.v0 - h.spodek);
      /* horní kus prodloužený pod šikmý konec krokve pultu (2026.11.239) */
      var hor = plna - ((kv.otvor.vKusHorni != null ? kv.otvor.vKusHorni : kv.otvor.v1) - h.spodek);
      if(dol > 0.30) out.push(r2(dol));
      if(hor > 0.30) out.push(r2(hor));
      continue;
    }
    out.push(r2(plna));
  }
  return out;
}

/* Pozednice u pultové střechy — dolní pod okapem, horní pod horní hranou.
   Typy hran dá výpočetní jádro (pultEdges), délky se berou z obvodové zdi,
   protože střešní hrany jsou o přesahy delší. */
function pultovePozednice(g, zed){
  var out={dolni:0, horni:0};
  var hrany=g.pultEdges||[];
  if(!hrany.length) return out;
  if(zed && zed.length===hrany.length){
    for(var i=0;i<hrany.length;i++){
      var a=zed[i], b=zed[(i+1)%zed.length];
      var d=Math.hypot(b[0]-a[0], b[1]-a[1]);
      if(hrany[i].type==="okap")  out.dolni+=d;
      if(hrany[i].type==="horni") out.horni+=d;
    }
  } else {
    /* Obrys zdi neznáme — vezmeme střešní hrany a přiznáme, že jsou delší. */
    hrany.forEach(function(e){
      var d=Math.hypot(e.b[0]-e.a[0], e.b[1]-e.a[1]);
      if(e.type==="okap")  out.dolni+=d;
      if(e.type==="horni") out.horni+=d;
    });
  }
  return out;
}

/* Délka obvodové nosné zdi pod okapovými hranami.
   Pozednice leží na zdivu, ne na okapu — okap je o přesah delší. */
/* ══════════════════════════════════════════════════════════════════════
   DÉLKA POZEDNIC
   ----------------------------------------------------------------------
   Pozednice leží na obvodové nosné zdi pod okapem — pod štítem žádná není.
   SMĚREM K OKAPU se tedy o přesah NEprodlužuje: zeď je tam, kde je
   (upřesněno PENTI 12. 8. 2026).

   ZA ŠTÍT SE ALE VYTÁHNOUT MUSÍ, stejně jako vaznice. Nad štítem přečnívá
   střecha o přesah u štítu a ty krokve musí mít na čem ležet — pozednice
   proto pokračuje do prázdna až na konec přesahu (upřesněno PENTI
   14. 8. 2026). Dřív pozednice končila na zdi a vaznice byly vytažené,
   což si odporovalo.

   POZOR NA TVARY L, T A U: ne každý okapový běh končí u štítu. Některé
   dobíhají do nároží nebo úžlabí, kde se prodlužovat nesmí. Proto se
   u každého konce zvlášť kouká, jestli za ním opravdu je štít, a přičte
   se přesah TOHO štítu — ne společná hodnota, protože každý štít může mít
   svůj vlastní.
   ══════════════════════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════════════════
   PODPORY VAZNICE V PŮDORYSU
   Vaznice leží na řadě sloupků. Sloupky se rozmístí rovnoměrně po celé
   délce, krajní na koncích — proto je polí o jedno míň než sloupků.

   Vrací i skutečnou rozteč, která se od zadané liší: zadaných 3,5 m se
   po délce rovnoměrně rozpustí, aby krajní sloupky vyšly přesně na konce
   (zadání PENTI 14. 8. 2026 — definice podpor v půdorysu).
   ══════════════════════════════════════════════════════════════════════ */
/* Ke každé vaznici dopočítá spojitý nosník a polohu spojů.
   Pro POLOHU nulového momentu nezáleží na velikosti zatížení — je
   úměrná — takže se počítá s jednotkovým a žádné zatížení se sem
   nemusí předávat. */
/* Volby spoje pro právě počítaný krov (nastaví spocitej). */
var SPOJ_PRO_DELENI = null;
/* ½ délky spoje vaznice v metrech — o tolik kus přesahuje osu spoje.
   nad = spoj nad podporou (prosté nosníky / styky), jinak v nulovém momentu;
   nouzovy = nouzový spoj mimo nulový moment (vždy hákový plát). */
function pulSpojeM(profil, nad, nouzovy){
  var Sp = global.PentiSpoje, o = SPOJ_PRO_DELENI || {};
  if(!Sp || !Sp.spojVaznice || !profil) return 0;
  var b = profil.b || 160, h = profil.h || 220, t;
  try{
    t = nouzovy ? Sp.hakovyPlat(h)
      : Sp.spojVaznice(!!nad, nad ? (o.nad || "plat") : (o.nulovy || "hakovy"), b, h, o.sloupekB || 140, false, o.sloupekH || 140);
  }catch(e){ t = null; }
  return t && t.delkaMm > 0 ? t.delkaMm / 2000 : 0;
}
function statikaVaznice(podp, profil, maxDelkaKusu, prosty, styky){
  var St = global.PentiStatika, En = global.PentiEngine;
  if(!St || !En || !St.spojityNosnik || !podp) return null;
  /* ── STYKY NAD ZVOLENÝMI PODPORAMI (PENTI 19. 10. 2026, 2026.10.191) ──
     „Levou část počítat jako spojitý nosník a pravou jako prostý."
     `styky` = polohy podpor (m od začátku vaznice, jako ruční sloupky),
     nad kterými je styk (plát). Vaznice se rozpadne na kusy mezi styky:
     kus přes víc polí = spojitý nosník, kus přes jedno pole = prostý.
     Posudek bere největší moment a průhyb ze všech kusů (součinitele
     vztažené k nejdelšímu poli celé vaznice), reakce nad stykem je
     součet reakcí obou kusů. Bez stylů = beze změny. */
  if(!prosty && styky && styky.length && podp.pole && podp.pole.length > 1){
    var sm = statikaSeStyky(podp, profil, maxDelkaKusu, styky);
    if(sm) return sm;
  }
  /* ── PROSTÉ NOSNÍKY (PENTI 1. 10. 2026, volba „modelVaznice") ──────────
     Každé pole se posuzuje samostatně: M = w·L²/8, průhyb 5·q·L⁴/(384·E·I)
     (součinitele 1/8 a 5/384 vztažené k nejdelšímu poli), spoj nad každou
     vnitřní podporou. Reakce do podpory = půl levého + půl pravého pole
     (u spojitého nosníku je o ~10–25 % vyšší). */
  if(prosty && St.deleniNadPodporami){
    var pole = (podp.pole && podp.pole.length) ? podp.pole.slice() : [podp.delka];
    var xs = [0], s = 0;
    pole.forEach(function(L){ s += L; xs.push(r3(s)); });
    var reakceUnit = 0;
    for(var i = 0; i < xs.length; i++){
      var r = ((i > 0 ? pole[i-1] : 0) + (i < pole.length ? pole[i] : 0)) / 2;
      if(r > reakceUnit) reakceUnit = r;
    }
    /* Spoje nad VNITŘNÍMI podporami, polohy od začátku vaznice (2026.10.192).
       Dřív šly polohy od první podpory (`xs`): u vaznice s kusem za štítem
       (kapsa, přesah) se spoje kreslily a počítaly o ten kus vedle sloupků
       a koncová podpora vyšla jako spoj navíc (Bohuslavice: 3 pláty místo 2). */
    var odP = (podp.podepreno && podp.podepreno.od) || 0;
    var vnitrniAbs = xs.slice(1, -1).map(function(x){ return r3(odP + x); });
    var dP = St.deleniNadPodporami({ delka:podp.delka, maxDelka:maxDelkaKusu||13, podpory:vnitrniAbs,
                                     pulPlatuM:pulSpojeM(profil, true) });
    return { model:"prosty",
             nosnik:{ pole:pole, podporyX:xs, Vmax:Math.max.apply(null, pole)/2, nulovyMoment:[] },
             deleni:dP, soucinitelM:1/8, soucinitelW:5/384, nulovyMoment:[],
             reakceUnit:r3(reakceUnit) };
  }
  var p = St.prurez(profil.b||160, profil.h||220);
  var EI = St.material("C24").Em * p.Iy / 1e6;      // kNm² z MPa a mm⁴
  var n = St.spojityNosnik({ pole:podp.pole, w:1, EI:EI, EA:1e6,
                             solver:En.solveFrame2D });
  if(!n) return null;
  var d = St.deleniVaznice({ delka:podp.delka, maxDelka:maxDelkaKusu||13,
                             nulovyMoment:n.nulovyMoment, podpory:n.podporyX,
                             pulPlatuM:pulSpojeM(profil, false), pulNouzovyM:pulSpojeM(profil, false, true) });
  return { nosnik:n, deleni:d,
           soucinitelM:n.soucinitelM, soucinitelW:n.soucinitelW,
           nulovyMoment:n.nulovyMoment };
}

/* Statika vaznice se styky nad zvolenými podporami (viz statikaVaznice).
   Vrací stejný tvar jako spojitý model + model:"styky", styky (indexy
   podpor) a reakceUnit; dělení = kusy mezi styky (plát nad podporou). */
function statikaSeStyky(podp, profil, maxDelkaKusu, styky){
  var St = global.PentiStatika, En = global.PentiEngine;
  var pole = podp.pole.slice();
  /* polohy podpor od začátku vaznice — začátek podepřené části + pole */
  var od = (podp.podepreno && podp.podepreno.od) || 0;
  var abs = [od]; pole.forEach(function(L){ abs.push(r3(abs[abs.length-1] + L)); });
  var idx = [];
  styky.forEach(function(x){
    for(var i = 1; i < abs.length-1; i++) if(Math.abs(abs[i] - (+x)) < 0.06 && idx.indexOf(i) < 0) idx.push(i);
  });
  if(!idx.length) return null;                     // styk neleží nad žádnou vnitřní podporou
  idx.sort(function(a, b){ return a - b; });
  var p = St.prurez(profil.b||160, profil.h||220);
  var EI = St.material("C24").Em * p.Iy / 1e6;
  var hranice = [0].concat(idx, [pole.length]);
  var reakce = abs.map(function(){ return 0; }), Mmax = 0, prohyb = 0, Vmax = 0, nuly = [];
  for(var k = 0; k + 1 < hranice.length; k++){
    var a = hranice[k], b = hranice[k+1], seg = pole.slice(a, b);
    var nk = St.spojityNosnik({ pole:seg, w:1, EI:EI, EA:1e6, solver:En.solveFrame2D });
    if(!nk) return null;
    if(nk.Mmax > Mmax) Mmax = nk.Mmax;
    if(nk.prohybM > prohyb) prohyb = nk.prohybM;
    if(nk.Vmax > Vmax) Vmax = nk.Vmax;
    var x0 = abs[a] - od;
    (nk.nulovyMoment || []).forEach(function(z){ nuly.push(r3(x0 + z)); });
    (nk.reakceX || []).forEach(function(R, j){ reakce[a + j] += R; });
  }
  var Lref = Math.max.apply(null, pole), x = 0;
  var podporyX = [0]; pole.forEach(function(L){ x += L; podporyX.push(r3(x)); });
  var dP = St.deleniNadPodporami({ delka:podp.delka, maxDelka:maxDelkaKusu||13,
                                   podpory:idx.map(function(i){ return abs[i]; }), pulPlatuM:pulSpojeM(profil, true) });
  if(dP){
    dP.model = "styky";
    dP.poznamka = "Styky podle zadání: " + idx.length + "× plát nad podporou, mezi styky spojitý nosník."
      + (dP.prilisDlouhych ? " " + dP.prilisDlouhych + " kus je delší než " + (maxDelkaKusu||13) + " m — přidejte styk." : "");
  }
  return { model:"styky", styky:idx.slice(),
           nosnik:{ pole:pole, podporyX:podporyX, Vmax:Vmax, Mmax:Mmax, prohybM:prohyb,
                    nulovyMoment:nuly, reakceX:reakce.map(r3), styky:idx.slice(), Lref:Lref },
           deleni:dP,
           soucinitelM: Mmax/(Lref*Lref), soucinitelW: prohyb*EI/Math.pow(Lref, 4),
           nulovyMoment:nuly, reakceUnit:r3(Math.max.apply(null, reakce)) };
}

/* Podpory pod jedním během vaznice.

   `neseStena` je nepovinný seznam úseků [{od,do}] v metrech od začátku
   běhu, kde vaznici nese dost vysoká zeď (dohodnutý model PENTI
   15. 8. 2026: stěna, věnec, sloupek i patka jsou totéž — podpora s horní
   hranou v dané výšce nad ±0; když stěna dosáhne, sloupek není potřeba).

   Na neseném úseku SLOUPKY ODPADAJÍ a nevzniká tam ani pole — vaznice je
   po celé jeho délce podepřená. Sloupek zůstává na koncích úseku, protože
   tam podepření začíná a končí.

   BEZ NAKRESLENÝCH STĚN se nic nemění: prázdný seznam dá přesně to, co
   funkce dávala předtím. */
/* `rucne` (PENTI 3. 10. 2026, editor etapa 2): seznam poloh VNITŘNÍCH
   sloupků v metrech od začátku běhu, které uživatel rozmístil ručně
   (tažením v půdorysu). Když je zadaný, sloupky stojí PŘESNĚ tam —
   nic se nedorozděluje a nic nepřibude. Krajní podpory (konce běhu nebo
   štítové zdi) zůstávají pevné. Stěny dál fungují stejně: uvnitř nesené
   stěny sloupek odpadne, na štítové zdi, která nese, taky.
   Bez `rucne` (null) se počítá přesně jako dřív. */
function podporyVaznice(delka, roztecZadana, neseStena, pevnePolohy, stitove, rucne){
  if(!(delka > 0.05)) return null;
  var rozt = roztecZadana || 3.5;

  /* ── ŠTÍTOVÁ ZEĎ ────────────────────────────────────────────────────
     Vaznice sahá až do přesahu za štít, ale sloupek tam nepatří — leží
     na štítové zdi. Kus za štítem je KONZOLA, ne pole; do posudku
     spojitého nosníku nesmí (nalezeno 15. 8. 2026, sloupky vycházely
     mimo budovu).

     Když je štítová zeď nízká, podpora tam pořád je, jen ji musí doplnit
     sloupek — proto se poloha bere jako pevná, ale bez sloupku jen tehdy,
     když zeď opravdu nese. */
  var stit = (stitove||[]).filter(function(s){
    return s && s.u > -0.01 && s.u < delka+0.01;
  });
  var zacatekPodpory = 0, konecPodpory = delka;
  var bezSloupkuNa = [];
  stit.forEach(function(s){
    if(s.u < delka/2){ if(s.u > zacatekPodpory) zacatekPodpory = s.u; }
    else            { if(s.u < konecPodpory)   konecPodpory   = s.u; }
    if(s.nese) bezSloupkuNa.push(s.u);
  });
  var jeKonzola = function(p){
    return p < zacatekPodpory-0.02 || p > konecPodpory+0.02;
  };

  /* ── ROZMÍSTĚNÍ SLOUPKŮ ─────────────────────────────────────────────
     Konce běhu jsou pevné vždycky. K nim se přidají polohy, kde vaznici
     kříží nosná stěna — tam sloupek patří, protože má na čem stát
     (zadání PENTI 15. 8. 2026). Zbylé mezery se dorozdělí rovnoměrně.

     DĚLENÍ MEZERY. Bez pevných poloh se běh dělí jako odjakživa:
     `floor(délka/rozteč)` polí, takže skutečná rozteč může vyjít o kus
     VĚTŠÍ než zadaná. To je zavedená konvence kalkulačky.

     Ta rozteč je zároveň MĚŘÍTKO pro dělení mezer mezi pevnými polohami.
     Kdyby se mezera dělila týmž vzorcem, mohlo by přidání stěny pole
     PRODLOUŽIT — u desetimetrové vaznice vyšlo místo dvou polí po 5,3 m
     pole 3,3 a 7,3 m, tedy horší stav než bez stěny. Proto se každá
     mezera dělí tak, aby žádné pole nepřerostlo referenční rozteč. */
  var podepreno = Math.max(0.05, konecPodpory - zacatekPodpory);
  var poliRef = Math.max(1, Math.floor(podepreno/rozt));
  var refPole = podepreno/poliRef;

  /* Uzly, mezi kterými se dělí — jen PODEPŘENÁ část běhu. Přesah za
     štítem se nedělí, je to konzola. */
  var body = [r3(zacatekPodpory), r3(konecPodpory)];
  (pevnePolohy||[]).forEach(function(p){
    var q = r3(Math.max(0, Math.min(delka, +p)));
    if(q > zacatekPodpory+0.05 && q < konecPodpory-0.05) body.push(q);
  });
  body.sort(function(a,b){ return a-b; });
  var uzly=[];
  body.forEach(function(p){ if(!uzly.length || p-uzly[uzly.length-1] > 0.05) uzly.push(p); });

  var x = [uzly[0]];
  var rucneOk = Array.isArray(rucne);
  if(rucneOk){
    /* RUČNÍ ROZMÍSTĚNÍ: krajní body + zadané vnitřní polohy, seřazené,
       bez dvojic blíž než 5 cm a bez poloh mimo podepřenou část. */
    var vnitrni = rucne.map(function(p){ return r3(+p); }).filter(function(p){
      return isFinite(p) && p > zacatekPodpory+0.05 && p < konecPodpory-0.05;
    }).sort(function(a,b){ return a-b; });
    vnitrni.forEach(function(p){ if(p - x[x.length-1] > 0.05) x.push(p); });
    if(r3(konecPodpory) - x[x.length-1] > 0.05) x.push(r3(konecPodpory));
    else x[x.length-1] = r3(konecPodpory);
  } else
  for(var u=0; u+1<uzly.length; u++){
    var L = uzly[u+1]-uzly[u];
    var poli1 = Math.max(1, Math.ceil(L/refPole - 1e-9));
    for(var k=1;k<=poli1;k++) x.push(r3(uzly[u] + L*k/poli1));
  }
  /* Na štítové zdi, která vaznici unese, sloupek nestojí. */
  var naStitu = function(p){
    return bezSloupkuNa.some(function(u){ return Math.abs(p-u) < 0.03; });
  };
  var sloupky = x.filter(function(p){ return !naStitu(p); });

  var pole = [];
  for(var i=0;i+1<x.length;i++) pole.push(r3(x[i+1]-x[i]));
  var poli = pole.length;
  var roztec = poli ? podepreno/poli : podepreno;
  var vysledek = { pocetSloupku:sloupky.length, poli:poli, roztecSkutecna:r3(roztec),
                   roztecZadana:rozt, polohy:sloupky, pole:pole, delka:r2(delka),
                   /* podepřená část běhu — mezi těmito body leží vnitřní
                      sloupky, které jde v editoru posouvat */
                   podepreno:{ od:r3(zacatekPodpory), do:r3(konecPodpory) } };
  if(rucneOk){
    vysledek.rucne = true;
    /* Ruční pole delší, než by vyšlo při automatickém rozmístění — vaznice
       ho unese možná jen s větším profilem; statika ho posoudí, tady se
       jen řekne, že vzniklo. */
    var nejdelsi = pole.length ? Math.max.apply(null, pole) : 0;
    if(nejdelsi > refPole + 0.005){ vysledek.dlouhePoleM = r2(nejdelsi); vysledek.autoPoleM = r2(refPole); }
  }
  if((pevnePolohy||[]).length) vysledek.naKrizeni = (pevnePolohy||[]).length;
  if(stit.length){
    vysledek.stitovePodpory = stit.length;
    vysledek.nesouStity = bezSloupkuNa.length;
    var kon = r2((zacatekPodpory-0) + (delka-konecPodpory));
    if(kon > 0.01) vysledek.konzolyM = kon;
  }

  var nese = (neseStena||[]).filter(function(u){ return u && u.do-u.od > 0.05; });
  if(!nese.length) return vysledek;

  /* Uvnitř neseného úseku (ne na jeho hranici) sloupek nepotřebujeme. */
  var uvnitr = function(p){
    for(var i=0;i<nese.length;i++)
      if(p > nese[i].od + 0.02 && p < nese[i].do - 0.02) return true;
    return false;
  };
  /* Podpory = konce podepřené části, zbylé sloupky a hranice nesených
     úseků. Konzola za štítem mezi ně nepatří. */
  var podpory = [r3(zacatekPodpory), r3(konecPodpory)];
  x.forEach(function(p){ if(!uvnitr(p)) podpory.push(p); });
  nese.forEach(function(u){
    podpory.push(r3(Math.max(0, Math.min(delka, u.od))));
    podpory.push(r3(Math.max(0, Math.min(delka, u.do))));
  });
  podpory.sort(function(a,b){ return a-b; });
  var cisté=[];
  podpory.forEach(function(p){
    if(!cisté.length || p-cisté[cisté.length-1] > 0.03) cisté.push(p);
  });

  /* Pole vzniká jen tam, kde vaznice volně přemostí mezeru. Uvnitř
     neseného úseku leží na zdi, takže se neposuzuje. */
  var novaPole=[];
  for(var i=0;i+1<cisté.length;i++){
    var stred=(cisté[i]+cisté[i+1])/2;
    if(uvnitr(stred)) continue;
    novaPole.push(r3(cisté[i+1]-cisté[i]));
  }
  /* Sloupek stojí na každé podpoře, kterou nenese zeď. */
  var sloupku=cisté.filter(function(p){ return !uvnitr(p); }).length;
  /* Konce běhu, které leží na nesené zdi, sloupek taky nepotřebují. */
  var naZdi=function(p){
    for(var i=0;i<nese.length;i++)
      if(p >= nese[i].od-0.02 && p <= nese[i].do+0.02) return true;
    return false;
  };
  /* A na štítové zdi, která nese, taky ne. */
  var zbyle = cisté.filter(function(p){ return !naZdi(p) && !naStitu(p); });

  vysledek.pocetSloupku = zbyle.length;
  vysledek.poli = novaPole.length;
  vysledek.polohy = zbyle;
  vysledek.pole = novaPole;
  vysledek.neseStena = nese.map(function(u){ return { od:r3(u.od), do:r3(u.do) }; });
  vysledek.nesenoM = r2(nese.reduce(function(a,u){ return a+(u.do-u.od); },0));
  return vysledek;
}

/* Jednotlivé BĚHY pozednice — jeden na každou neštítovou hranu zdi.
   Výrobní výkres potřebuje délky po kusech, ne jejich součet: pozednice
   se dělí a plátuje po jednotlivých bězích, přes roh se nepokračuje. */
/* ── MEZERY V POZEDNICI POD ZDĚNÝM ČELEM VIKÝŘE (2026.11.228) ──────────
   Pultový vikýř se zděným čelem na obvodové zdi (na okapu): mezi
   zesílenými krokvemi u boků vikýře hlavní pozednice není — zdivo čela
   tam pokračuje nahoru a nese vlastní pozednici čela. Zesílené krokve
   u boků leží na koncích hlavní pozednice (pozednice končí v půlce jejich
   šířky). Vrací { hrana: [[s0, s1]] } — od rohu zdi na začátku hrany. */
function mezeryPozedniceVikyre(zed, stitoveHrany, roviny, P){
  if(!zed || zed.length < 2 || !roviny) return null;
  var stit = {}; (stitoveHrany || []).forEach(function(i){ stit[i] = 1; });
  var bK = ((P && P.krokev && P.krokev.b) || 100) / 1000, ven = {}, neco = false, n = zed.length;
  roviny.forEach(function(p){
    var B = p.baze; if(!B || !p.otvoryKrovu) return;
    p.otvoryKrovu.forEach(function(o){
      if(!o.celoZdene || !o.naOkapu || !(o.u1 - o.u0 > 2 * bK)) return;
      var PA = [B.a[0] + B.dir[0] * (o.u0 + bK / 2), B.a[1] + B.dir[1] * (o.u0 + bK / 2)];
      var PB = [B.a[0] + B.dir[0] * (o.u1 - bK / 2), B.a[1] + B.dir[1] * (o.u1 - bK / 2)];
      /* zeď pod okapem roviny: rovnoběžná hrana nejblíž okapní hraně */
      var nej = -1, nejD = 1e9;
      for(var i = 0; i < n; i++){
        if(stit[i]) continue;
        var a = zed[i], b = zed[(i + 1) % n], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if(L < 1e-6) continue;
        var t = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
        if(Math.abs(Math.abs(t[0] * B.dir[0] + t[1] * B.dir[1]) - 1) > 0.01) continue;
        var dV = Math.abs((PA[0] - a[0]) * t[1] - (PA[1] - a[1]) * t[0]);
        if(dV < nejD){ nejD = dV; nej = i; }
      }
      if(nej < 0 || nejD > 3) return;
      var a2 = zed[nej], b2 = zed[(nej + 1) % n], L2 = Math.hypot(b2[0] - a2[0], b2[1] - a2[1]);
      var t2 = [(b2[0] - a2[0]) / L2, (b2[1] - a2[1]) / L2];
      var sA = (PA[0] - a2[0]) * t2[0] + (PA[1] - a2[1]) * t2[1], sB = (PB[0] - a2[0]) * t2[0] + (PB[1] - a2[1]) * t2[1];
      (ven[nej] = ven[nej] || []).push([r3(Math.min(sA, sB)), r3(Math.max(sA, sB))]);
      neco = true;
    });
  });
  return neco ? ven : null;
}
function behyPozednic(zed, stitoveHrany, stitovePresahy, vychoziPresahStitu, zdeneStity, konce, mezeryHran){
  if(!zed || zed.length<2) return [];
  var n=zed.length;
  var stit={}; (stitoveHrany||[]).forEach(function(i){ stit[i]=1; });
  var presahStitu=function(i){
    var o=stitovePresahy||{};
    return (o[i]!=null) ? n_(o[i]) : (n_(vychoziPresahStitu)||0);
  };
  /* ZDĚNÝ ŠTÍT (PENTI 22. 9. 2026): nad štítem žádné krokve nejsou, takže
     pozednice nemá co nést — končí u VNITŘNÍHO líce štítové zdi. Délka
     zdi se měří po vnějších rozích, proto se tloušťka zdi odečte. */
  var tlZdi = (zdeneStity && zdeneStity.zapnuto) ? (+zdeneStity.tlZdiM || 0) : null;
  var out=[];
  for(var i=0;i<n;i++){
    if(stit[i]) continue;                       // pod štítem pozednice není
    var a=zed[i], b=zed[(i+1)%n];
    var delkaZdi = Math.hypot(b[0]-a[0], b[1]-a[1]);
    /* Konce běhu: sousední hrana před ním a za ním. Je-li štítová,
       pozednice se za ni vytáhne o její přesah — u zděného štítu naopak
       o tloušťku zdi zkrátí. */
    var pP = stit[pred_(i,n)] ? ((tlZdi!=null) ? -tlZdi : presahStitu(pred_(i,n))) : 0;
    var pZ = stit[(i+1)%n]    ? ((tlZdi!=null) ? -tlZdi : presahStitu((i+1)%n))    : 0;
    /* RUČNÍ KONEC (PENTI 11. 10. 2026: „zařezávat pozednice k pomocné
       čáře"). konce[hrana] = { pred, za } — o kolik konec přesahuje roh
       zdi (záporně = zkrácená). Dál než automatický konec (za štít o přesah
       střechy, u rohu s další pozednicí roh) nesmí; kus musí mít aspoň
       0,3 m. Co nejde, se ořízne na mez a řekne se to v `rucne.oriznuto`. */
    var kk = konce && konce[i], rucne = null;
    if(kk){
      rucne = { pred:false, za:false, oriznuto:false };
      var omez = function(x, auto, druhy){
        var hod = Math.min(+x, auto);
        var min = -(delkaZdi + druhy - 0.3);
        if(hod < min) hod = min;
        if(Math.abs(hod - (+x)) > 0.0005) rucne.oriznuto = true;
        return hod;
      };
      if(kk.pred != null && isFinite(+kk.pred)){ pP = omez(kk.pred, pP, (kk.za != null && isFinite(+kk.za)) ? Math.min(+kk.za, pZ) : pZ); rucne.pred = true; }
      if(kk.za != null && isFinite(+kk.za)){ pZ = omez(kk.za, pZ, pP); rucne.za = true; }
    }
    var tH = delkaZdi > 1e-9 ? [(b[0]-a[0])/delkaZdi, (b[1]-a[1])/delkaZdi] : [1,0];
    var beh = { hrana:i, delkaZdi:r2(delkaZdi),
               presahPred:r3(pP), presahZa:r3(pZ),
               delka:r2(delkaZdi + pP + pZ), rucne:rucne,
               /* začátek běhu a směr (půdorys) — pro kresbu mezer (2026.11.228) */
               zacatek:[r3(a[0]-tH[0]*pP), r3(a[1]-tH[1]*pP)], smer:[r3(tH[0]), r3(tH[1])] };
    /* PŘERUŠENÍ POD ZDĚNÝM ČELEM VIKÝŘE (2026.11.228 — PENTI 16. 11. 2026,
       zakázka 277_26: „Přerušit"). Zdivo čela pokračuje z obvodové zdi
       nahoru, hlavní krokve tam na pozednici nedosedají — pozednice tam
       není. mezeryHran[hrana] = [[s0, s1]] od rohu zdi (začátek hrany).
       Běh si nechá celé konce (presahPred/Za), `delkaBehu` = od konce ke
       konci, `delka` = jen dřevo; `casti` = souvislé kusy [{od, do, delka}]
       po běhu od jeho začátku (0 = konec před rohem). */
    var mz = mezeryHran && mezeryHran[i];
    if(mz && mz.length){
      var L0 = delkaZdi + pP + pZ, castiB = [], od0 = 0, mezery = [];
      mz.map(function(m){ return [Math.max(0, Math.min(L0, +m[0] + pP)), Math.max(0, Math.min(L0, +m[1] + pP))]; })
        .filter(function(m){ return m[1] - m[0] > 0.01; })
        .sort(function(a, b){ return a[0] - b[0]; })
        .forEach(function(m){
          if(m[0] - od0 > 0.3) castiB.push({ od:r3(od0), do:r3(m[0]), delka:r2(m[0] - od0) });
          mezery.push({ od:r3(Math.max(od0, m[0])), do:r3(m[1]) });
          od0 = Math.max(od0, m[1]);
        });
      if(L0 - od0 > 0.3) castiB.push({ od:r3(od0), do:r3(L0), delka:r2(L0 - od0) });
      if(mezery.length){
        beh.delkaBehu = r2(L0); beh.mezery = mezery; beh.casti = castiB;
        beh.delka = r2(castiB.reduce(function(a, c){ return a + c.delka; }, 0));
      }
    }
    out.push(beh);
  }
  return out;
}
function pred_(i, n){ return (i-1+n)%n; }

/* ── ROHY POZEDNICE (PENTI 30. 9. 2026, kniha tesařských spojů) ─────────
   Kde se potkají dva běhy pozednice (obě sousední hrany zdi nejsou štítové),
   spojí se ROHOVÝM PLÁTEM: oba kusy se seříznou na polovinu výšky, plát je
   dlouhý jako šířka druhé pozednice a jistí se jedním svorníkem M12.
   Dřevo navíc to nestojí — oba běhy se už teď měří k vnějšímu rohu, takže
   rohový čtverec je v délce každého z nich. Tah rohový plát nepřenese; na
   pozednici to nevadí, leží celou délkou na zdi a je kotvená. */
function rohyPozednic(zed, stitoveHrany, profil){
  if(!zed || zed.length<3 || !global.PentiSpoje) return null;
  var n=zed.length, stit={}, pocet=0;
  (stitoveHrany||[]).forEach(function(i){ stit[i]=1; });
  for(var i=0;i<n;i++) if(!stit[i] && !stit[(i+1)%n]) pocet++;
  if(!pocet) return null;
  var b=(profil&&profil.b)||140, h=(profil&&profil.h)||160;
  var rp=global.PentiSpoje.rohovyPlat(b, h, b);
  return { pocet:pocet, typSpoje:rp.nazev, platMm:rp.platMm, hloubkaMm:rp.hloubkaMm,
           /* místo svorníku kotva do věnce skrz oba pláty (PENTI 30. 9. 2026) */
           kotevNaRoh:rp.kotvy, kotevCelkem:pocet*rp.kotvy,
           profil:{ b:b, h:h } };
}

function delkaPozednic(zed, stitoveHrany, stitovePresahy, vychoziPresahStitu, zdeneStity, konce, mezeryHran){
  var b = behyPozednic(zed, stitoveHrany, stitovePresahy, vychoziPresahStitu, zdeneStity, konce, mezeryHran);
  return r2(b.reduce(function(a,x){ return a + x.delka; }, 0));
}

/* ══════════════════════════════════════════════════════════════════════
   ROZDĚLENÍ POZEDNICE NA KUSY — A CO Z TOHO PLYNE PRO NABÍDKU
   ----------------------------------------------------------------------
   Pozednice se nedodává v jednom kuse: hranol má omezenou délku a na
   stavbě se skládá z několika kusů za sebou. V každém spoji se kusy
   PŘEKRÝVAJÍ o plát — a to překrytí je řezivo navíc, které se musí
   objednat. U domu 16 × 10 m to je 2,40 bm (zadání PENTI 16. 8. 2026).

   Stejné dělení určuje i to, kolik je potřeba kotev do zdiva: každý kus
   se kotví samostatně a musí mít aspoň dvě kotvy, jinak by se mohl
   pootočit.

   PROČ SE TO NEPOČÍTÁ TADY: úplně stejné dělení už kreslí výrobní výkres.
   Kdyby se pravidlo napsalo podruhé, dřív nebo později by se obě čísla
   rozešla a výkres by ukazoval něco jiného než nabídka. Proto se zavolá
   modul výkresů. Když se nenačte, vrátíme null a nabídka počítá jako dřív.
   ══════════════════════════════════════════════════════════════════════ */
function dilyPozednic(behy, profil, maxKusM, roztecKotevM){
  var VV = global.PentiVyrobni;
  if(!VV || !VV.pozedniceBeh || !behy || !behy.length) return null;
  var out = [], rezivo = 0, cisteRez = 0, kotev = 0, spoju = 0, platMm = 0;
  var objednacky = {};
  for(var i=0;i<behy.length;i++){
    var d = null;
    /* běh přerušený pod zděným čelem vikýře (2026.11.228): každá souvislá
       část má vlastní kusy, kotvy a pláty; kusy se posunou na místo v běhu */
    var castiB = behy[i].casti && behy[i].casti.length ? behy[i].casti : [{ od:0, delka:behy[i].delka }];
    try {
      castiB.forEach(function(c){
        var dc = VV.pozedniceBeh({ delkaM: c.delka, profil: profil,
                                   maxKusM: maxKusM || 4,
                                   roztecKotevM: roztecKotevM || 1 });
        if(!dc) throw new Error("beh");
        var kusyC = (dc.kusy || []).map(function(k){ return Object.assign({}, k, { odM: r3(+k.odM + c.od), doM: r3(+k.doM + c.od) }); });
        if(!d) d = { objednaciBm: 0, celkemBm: 0, kotvy: [], spoje: [], platDelkaMm: dc.platDelkaMm, objednacky: [], pocetKusu: 0, kusy: [], _obj: false };
        d.objednaciBm += (dc.objednaciBm != null ? dc.objednaciBm : dc.celkemBm); d.celkemBm += dc.celkemBm;
        d.kotvy = d.kotvy.concat(dc.kotvy || []); d.spoje = d.spoje.concat(dc.spoje || []);
        d.objednacky = d.objednacky.concat(dc.objednacky || []); d.pocetKusu += dc.pocetKusu || 0; d.kusy = d.kusy.concat(kusyC);
      });
    } catch(e){ return null; }        // radši dnešní chování než špatné číslo
    if(!d) return null;
    d.objednaciBm = r2(d.objednaciBm); d.celkemBm = r2(d.celkemBm);
    /* OBJEDNACÍ délka — to, co se koupí z pily v celých metrech. Do
       nabídky jde tohle, ne čistá délka; jinak si sami sobě zkreslujeme
       marži o dřevo, které stejně padne do odpadu (PENTI 20. 8. 2026). */
    rezivo += (d.objednaciBm != null ? d.objednaciBm : d.celkemBm);
    cisteRez += d.celkemBm;
    kotev += d.kotvy.length; spoju += d.spoje.length;
    platMm = d.platDelkaMm;
    (d.objednacky||[]).forEach(function(o){
      objednacky[o.delkaM] = (objednacky[o.delkaM]||0) + o.kusu;
    });
    out.push({ hrana:behy[i].hrana, delka:behy[i].delka,
               delkaBehu:behy[i].delkaBehu || behy[i].delka, mezery:behy[i].mezery || null,
               zacatek:behy[i].zacatek || null, smer:behy[i].smer || null,
               kusu:d.pocetKusu, kusy:d.kusy, spoju:d.spoje.length,
               kotev:d.kotvy.length, rezivoBm:d.objednaciBm,
               cisteBm:d.celkemBm, objednacky:d.objednacky });
  }
  var cista = behy.reduce(function(a,x){ return a + x.delka; }, 0);
  return { behy:out, rezivoBm:r2(rezivo), cistaBm:r2(cista),
           cisteSPlatyBm:r2(cisteRez),
           naviceBm:r2(rezivo - cista), odpadBm:r2(rezivo - cisteRez),
           objednacky: Object.keys(objednacky).map(Number)
             .sort(function(a,c){ return c-a; })
             .map(function(d){ return { delkaM:d, kusu:objednacky[d] }; }),
           kotev:kotev, spoju:spoju,
           platMm:platMm, maxKusM:maxKusM||4, roztecKotevM:roztecKotevM||1 };
}
/* jako n(), ale použitelné i před jeho definicí v souboru */
function n_(x){ var v=parseFloat(x); return isNaN(v)?0:v; }

/* ══════════════════════════════════════════════════════════════════════
   NÁROŽNÍ A ÚŽLABNÍ KROKVE
   ----------------------------------------------------------------------
   Do téhle chvíle ve výkazu vůbec nebyly, přestože jádro jejich délky zná.
   U valby 16 × 10 m to je 34,72 bm chybějícího řeziva (PENTI 14. 8. 2026).

   VÝŠKA SE ŘÍDÍ ZÁŘEZEM, ne únosností. Nárožnice leží v koutě mezi dvěma
   střešními rovinami, které se od její osy na obě strany SVAŽUJÍ. Kdyby
   měla stejnou výšku jako krokev, její horní rohy by vyčnívaly nad rovinu
   střechy a zkrácené krokve by na ni nedosedly.

   O kolik rovina od osy klesne: posuneme-li se o t do strany, klesne
   povrch o t · tg(sklon) · sin(φ), kde φ je půdorysný úhel mezi nárožím
   a okapem (u pravoúhlého rohu 45°). Pro šířku b je tedy potřeba přidat
   (b/2) · tg(sklon) · sin(φ).

   Příklad: krokev 100/180, sklon 35°, pravoúhlý roh, nárožnice šířky 140 →
   180 + 70 · 0,700 · 0,707 = 215 mm → nejbližší vyšší rozměr 220 mm.
   ══════════════════════════════════════════════════════════════════════ */
/* Výšky hranolů v nabídce — jeden seznam pro celou kalkulačku, drží ho
   statický modul, protože podle něj i navrhuje profil. */
/* Latě 40/60 po 320 mm, kontralatě 60/60 po 900 mm a fólie — dohromady
   drobnost, ale je jich po celé střeše stejně. */
var LATOVANI_KN_M2 = 0.06;
/* Rostlé jehličnaté dřevo, objemová tíha pro vlastní váhu prvků. */
var HUSTOTA_DREVA_KN_M3 = 4.5;
/* Reakce spojitého nosníku nad vnitřní podporou proti prostému w·L/2. */
var REAKCE_SPOJITEHO = 1.1;

var VYSKY_HRANOLU = (global.PentiStatika && global.PentiStatika.VYSKY_HRANOLU)
  || [140,160,180,200,220,240,260,280,300,320];

function profilNarozniku(hKrokveMm, bNaroznikuMm, sklonDeg, uhelPudorysDeg){
  var tg = Math.tan((sklonDeg||0)*Math.PI/180);
  var sf = Math.sin((uhelPudorysDeg==null?45:uhelPudorysDeg)*Math.PI/180);
  var pridavek = (bNaroznikuMm/2) * tg * sf;          // o kolik rovina klesne
  var potreba = (hKrokveMm||180) + pridavek;
  var vyska = VYSKY_HRANOLU.filter(function(x){ return x >= potreba-0.5; })[0]
           || VYSKY_HRANOLU[VYSKY_HRANOLU.length-1];
  return { b:bNaroznikuMm, h:vyska,
           potrebaMm: Math.round(potreba), pridavekMm: Math.round(pridavek),
           uhelPudorys: r2(uhelPudorysDeg==null?45:uhelPudorysDeg) };
}

/* Půdorysný úhel mezi nárožím a nejbližší okapovou hranou zdi.
   U pravoúhlého rohu vyjde 45°, u kosého rohu jinak. */
function uhelNarozi(A, B, zed, stitoveHrany){
  var dx=B[0]-A[0], dy=B[1]-A[1], d=Math.hypot(dx,dy);
  if(!(d>1e-6) || !zed || zed.length<2) return 45;
  var ux=dx/d, uy=dy/d;
  var stit={}; (stitoveHrany||[]).forEach(function(i){ stit[i]=1; });
  var nej=90;
  for(var i=0;i<zed.length;i++){
    if(stit[i]) continue;
    var a=zed[i], b=zed[(i+1)%zed.length];
    var ex=b[0]-a[0], ey=b[1]-a[1], e=Math.hypot(ex,ey);
    if(!(e>1e-6)) continue;
    var cos=Math.abs((ux*ex+uy*ey)/e);
    var uhel=Math.acos(Math.min(1,cos))*180/Math.PI;
    if(uhel<nej) nej=uhel;
  }
  /* Krajní hodnoty nedávají smysl — nároží nikdy neleží v ose okapu
     ani přesně kolmo na něj. */
  return Math.max(15, Math.min(75, nej));
}

/* ══════════════════════════════════════════════════════════════════════
   POSUDEK NÁROŽNÍ A ÚŽLABNÍ KROKVE — fáze S4
   ----------------------------------------------------------------------
   Vlastní výpočet je v `penti-statika.js` (`posudekNarozniku`), aby platily
   stejné pevnosti, stejný kmod a stejný řešič jako všude jinde. Tady se
   jenom připraví geometrie, kterou zná modul krovu.

   ROZPĚTÍ. Ve výkazu je nárožnice v celé délce i s přesahem okapu. Nosné
   je ale jen to mezi pozednicí a hřebenem — přesah je převislý konec.
   Nárožnice má po celé délce stejný sklon, takže se dá rozdělit podle
   převýšení: hřeben je nad pozednicí `vyskaStrechy`, okapová hrana je pod
   ní o `přesah · tg(sklon)`.

   PODPORY. Kde nárožnici kříží středová vaznice, je podepřená. U valby se
   vaznice v rohu kříží a nárožnice jde přesně přes to křížení, takže je to
   plnohodnotná podpora. Podíl z rozpětí je poměr výšek nad pozednicí.
   ══════════════════════════════════════════════════════════════════════ */
function geometrieNarozniku(delkaCelkem, vyskaStrechy, presahOkap, sklonRad){
  var rozdil = presahOkap * Math.tan(sklonRad);      // o kolik je okap níž
  var celkem = vyskaStrechy + rozdil;
  if(!(celkem > 0.05) || !(delkaCelkem > 0.3)) return null;
  var podil  = vyskaStrechy / celkem;                // kolik z délky je nosné
  var rozpeti = r2(delkaCelkem * podil);
  /* Půdorysný průmět z Pythagora — sklon nárožnice se nemusí zjišťovat. */
  var pudorys = Math.sqrt(Math.max(0.01, rozpeti*rozpeti - vyskaStrechy*vyskaStrechy));
  return { rozpeti:rozpeti, pudorys:r2(pudorys),
           konzola:r2(delkaCelkem - rozpeti), celkem:r2(delkaCelkem) };
}

/* ══════════════════════════════════════════════════════════════════════
   STATIKA CELÉHO KROVU — fáze S5
   ----------------------------------------------------------------------
   Posudky samotné umí `penti-statika.js` už od fáze S1, ale nikdo je
   nevolal — byly to čisté funkce bez zákazníka. Tady se z tvaru střechy
   a z výkazu připraví všechno, co potřebují.

   VOLNÉ ROZPĚTÍ KROKVE. Krokev neleží jen na pozednici a hřebeni. Kde ji
   podepírá vaznice, tam pole končí. Posuzuje se NEJDELŠÍ pole, ne celá
   krokev — jinak by vycházel nesmysl stejně jako u nárožnice.

   ZATĚŽOVACÍ ŠÍŘKA VAZNICE. Vaznice bere půlku pole nad sebou a půlku pod
   sebou. U středové vaznice to dá vždycky polovinu rozponu bez ohledu na
   to, jak vysoko leží. Vrcholová vaznice bere z obou střech.

   PATRO SLOUPKU. Reakce spojitého nosníku nad vnitřní podporou není
   w·L/2 jako u prostého, ale zhruba 1,1·w·L — sousední pole na ni tlačí.
   ══════════════════════════════════════════════════════════════════════ */

/* Podpory krokve vodorovně od pozednice: 0, každá vaznice, hřeben.
   Vrací délky polí a to nejdelší — po spádu i v půdoryse. */
function poleKrokve(rozponPulM, xVaznic, sklonRad){
  var body = [0];
  (xVaznic||[]).forEach(function(x){
    if(x > 0.2 && x < rozponPulM - 0.2) body.push(x);
  });
  body.push(rozponPulM);
  body.sort(function(a,b){ return a-b; });
  var pole = [], max = 0;
  for(var i=1;i<body.length;i++){
    var d = body[i]-body[i-1];
    pole.push(r2(d));
    if(d > max) max = d;
  }
  var cos = Math.cos(sklonRad) || 1;
  return { podporyX:body.map(r2), pole:pole,
           maxVodorovne:r2(max), maxPoSpadu:r2(max/cos) };
}

/* Zatížení střechy — jedno místo pro celý krov, ať si nárožnice a vazba
   nepočítají každá po svém (sjednoceno PENTI 15. 8. 2026).

   Stálé se skládá ze tří věcí, všechny na m² PLOCHY STŘECHY:
     · krytina — váha z ceníku, kg/m² přepočtené na kN (× 9,81/1000);
       je to totéž číslo, které nabídka používá na přesun hmot
     · latě, kontralatě a fólie — drobnost, ale je jich všude stejně
     · vlastní tíha krokve — objem na běžný metr dělený roztečí        */
function zatizeniKrovu(o){
  var St = global.PentiStatika;
  if(!St) return null;
  var kgKrytina = (o.hmotnostKrytinyKgM2 != null) ? o.hmotnostKrytinyKgM2 : 45;
  var gkKrytina = kgKrytina * 9.81/1000;
  var gkLatovani = LATOVANI_KN_M2;
  var pk = o.profilKrokve || {b:100,h:180};
  var gkKrokev = (pk.b/1000)*(pk.h/1000)*HUSTOTA_DREVA_KN_M3 / (o.roztecKrokvi||0.9);
  /* ── PODHLED (PENTI 21. 9. 2026) ─────────────────────────────────────
     Zateplení mezi krokvemi, parozábrana, rošt a SDK visí na krokvích
     a v rámci PENTI je to běžně kolem 0,5 kN/m² — víc než latě s fólií.
     Do 21. 9. 2026 se nikam nepočítalo. Zadává se na m² PLOCHY STŘECHY
     (jako ostatní stálé), 0 = bez podhledu. Nepředpokládá se, že by
     podhled působil jako ztužující rovina — je to jen zatížení. */
  var gkPodhled = Math.max(0, +o.podhledKNm2 || 0);
  var gk = gkKrytina + gkLatovani + gkKrokev + gkPodhled;
  var sn = St.snihNaStrese(o.snehOblast||2, o.sklonDeg);
  var vi = St.vitr(o.vitrOblast||2, o.teren||"III");
  /* Sání je potřeba do kombinace na nadzvednutí — z něj vyjde kotvení.
     Zjednodušeně: nejhorší zóna na celou střechu (viz penti-statika.js). */
  var sa = St.saniVetru(vi.qp, o.sklonDeg, o.cpeSani);
  var ko = St.kombinace(gk, o.sklonDeg, sn.s, vi.w, sa.w);
  return {
    sklonDeg: r2(o.sklonDeg), kgKrytina: kgKrytina,
    gkKrytina: r3(gkKrytina), gkLatovani: r3(gkLatovani),
    gkKrokev: r3(gkKrokev), gkPodhled: r3(gkPodhled), gk: r3(gk), gkPlan: r3(ko.gkPlan),
    snih: { oblast:o.snehOblast||2, sk:sn.sk, mu:r2(sn.mu), s:r2(sn.s) },
    vitr: { oblast:o.vitrOblast||2, teren:o.teren||"III", qp:r2(vi.qp),
            w:r2(vi.w), cpe:sa.cpe, sani:r2(sa.w),
            /* Zjednodušení musí být vidět v protokolu, ne jen v kódu. */
            zjednodusene:sa.zjednodusene, popisSani:sa.popis },
    /* Všechny kombinace i to, která vede — protokol je má vypsat. */
    kombinace: ko.kombinace.map(function(k){
      return { kod:k.kod, nazev:k.nazev, popis:k.popis, kmod:k.kmod,
               q:r2(k.q), qTah:(k.qTah!=null?r2(k.qTah):null),
               tahova:!!k.tahova, vede:(k===ko.vedouci) };
    }),
    vedouciKombinace: ko.vedouci.kod, kmod: ko.kmod,
    qUls: r2(ko.qUls), qSls: r2(ko.qSls),
    qTahUls: r2(ko.qTahUls), nadzvedava: ko.nadzvedava,
    /* nezaokrouhlené — do dalšího počítání */
    qUlsPresne: ko.qUls, qSlsPresne: ko.qSls, qTahPresne: ko.qTahUls
  };
}

/* ══════════════════════════════════════════════════════════════════════
   SPOJ VAZNIC V ROHU
   ----------------------------------------------------------------------
   PLÁT — vaznice se přeplátují, pod spoj přijde sloupek. Plát ubírá půlku
   výšky a jistí se dvěma svorníky; překryv navíc stojí řezivo, stejně jako
   u pozednice.

   OCEL — vaznice se dotýkají na tupo. Delší běh jde skrz a kratší do něj
   ústí; svislou reakci z toho kratšího přenese skrytý konektor. V rohu pak
   sloupek není, ale průběžná vaznice tím dostane bodové zatížení.

   REAKCE NA KONCI BĚHU spojitého nosníku je zhruba 0,4·w·L — míň než nad
   vnitřní podporou, protože z jedné strany není co přenášet.
   ══════════════════════════════════════════════════════════════════════ */
var REAKCE_KRAJNI = 0.4;

function spojRohuVaznic(o){
  var Sp = global.PentiSpojovak;
  var pocet = o.pocet||0;
  if(!(pocet>0)) return null;
  var profil = o.profil || {b:160,h:220};
  var upoz = [], prvekRohu = null;

  /* Reakce na konci nejkratšího běhu — ta se do rohu opravdu přenáší. */
  var behy = (o.behy||[]).slice().sort(function(a,b){ return a.delka-b.delka; });
  var nejkratsi = behy.length ? behy[0].delka : 0;
  var w = (o.zatizeni && o.zatizeni.wpKNm) || 0;
  var reakce = r2(REAKCE_KRAJNI * w * nejkratsi);

  if(o.detail === "plat"){
    /* ── HÁKOVÝ ROHOVÝ PLÁT ────────────────────────────────────────────
       Zadání PENTI 20. 8. 2026 podle Gernerových Tesařských spojů. Do té
       doby se tu dělal jednoduchý rovný plát na půl výšky — ten podle
       normy nepřenese ŽÁDNOU tahovou sílu a proti rozevření rohu nedrží.

       Rozměry hákového plátu:
         · délka plátu   = šířka dřeva
         · délka háku    = polovina šířky dřeva
         · část s hákem  = 5/8 výšky hranolu
         · slabší část   = 3/8 výšky hranolu
       Takový spoj přenese tlak i tah a ve směru háku drží proti rozevření.

       ZAČEPOVÁNÍ SLOUPKU. Nárožní sloupek se čepuje do STŘEDU rohového
       spoje — čep prochází oběma pláty a sešije je k sobě. Bez něj by se
       spoj musel jistit skobou. */
    var platMm  = Math.round(profil.b);            // délka plátu = šířka
    var hakMm   = Math.round(profil.b/2);          // délka háku
    var vysHakMm  = Math.round(profil.h*5/8);      // část s hákem
    var vysPlatMm = Math.round(profil.h*3/8);      // slabší část
    /* Čep sloupku: třetina jeho tloušťky, hluboký do poloviny výšky
       spodního plátu, uprostřed rohového čtverce. */
    var bSl = (o.profilSloupku && o.profilSloupku.b) || profil.b;
    var cep = Object.assign({ poloha: "střed rohového spoje" }, cepSpoje(bSl, "sloupek"));
    /* Řezivo navíc: každý roh přesahuje o délku plátu. Čep nárožního
       sloupku je od 30. 9. 2026 v řádku sloupků (každý sloupek má čep),
       tady by se počítal dvakrát. */
    var naviceBm = r2(pocet*platMm/1000);
    prvekRohu = prvek("roh_vaznic_plat","Hákový rohový plát vaznic",
      profil, nKusu(pocet, r3(platMm/1000)), "model",
      pocet+"× hákový plát: délka "+platMm+" mm, hák "+hakMm
      +" mm, část s hákem "+vysHakMm+" mm z "+profil.h
      +" mm (slabší část "+vysPlatMm+" mm), 2 svorníky na spoj"
      +" · sloupek začepovaný do středu spoje, čep "+cep.tloustkaMm
      +"×"+cep.delkaMm+" mm", true);
    return { pocet:pocet, detail:"plat", typSpoje:"hákový rohový plát",
             sloupkuVRohu:1, ubranoSloupku:o.ubranoSloupku||0,
             platDelkaMm:platMm, hakDelkaMm:hakMm,
             vyskaSHakemMm:vysHakMm, vyskaPlatuMm:vysPlatMm,
             platHloubkaMm:vysPlatMm,      // co se odebere ze slabší části
             cepSloupku:cep,
             svornikuCelkem: 2*pocet, reziveNaviceBm: naviceBm,
             reakceKN:reakce, prvek:prvekRohu, upozorneni:upoz };
  }

  /* OCEL — vybere se konektor podle reakce a podle toho, co se do profilu
     vaznice vejde.

     POZOR NA UZAVŘENÝ OKRUH. U valby obíhá vaznice dokola, takže KAŽDÝ
     konec každého běhu je roh. Kdyby se všechny spojily na tupo, nezůstane
     nic, o co se opřít — reakce by se přenášely dokola dokola. */
  if(o.pocet >= (o.behy||[]).length && (o.behy||[]).length > 2){
    upoz.push("Vaznice se stýkají ve všech " + o.pocet + " rozích — když se "
      + "všechny spojí na tupo, nemá se konstrukce o co opřít. Aspoň ve dvou "
      + "protilehlých rozích nechte přeplátování se sloupkem.");
  }
  var navrh = (Sp && Sp.navrhniSpojVaznic)
    ? Sp.navrhniSpojVaznic({ reakceKN:reakce, profil:profil }) : null;
  if(!navrh || !navrh.doporuceny){
    upoz.push("Vaznice se v " + pocet + " rozích mají spojit na tupo ocelovým "
      + "prvkem, ale žádný z katalogu nevyhoví — " 
      + ((navrh && navrh.duvod) || "nepodařilo se ho vybrat")
      + ". Buď zvolte přeplátování se sloupkem, nebo to nechte posoudit statikovi.");
  }
  /* Průběžná vaznice dostane v rohu bodové zatížení místo podpory. */
  upoz.push("V " + pocet + " rozích je vaznice spojená na tupo, takže tam "
    + "nestojí sloupek. Průběžná vaznice tím dostane bodové zatížení "
    + reakce + " kN — orientační posudek vaznice s ním nepočítá.");
  return { pocet:pocet, detail:"ocel", sloupkuVRohu:0,
           ubranoSloupku:o.ubranoSloupku||0,
           reakceKN:reakce, navrh:navrh,
           konektor: navrh && navrh.doporuceny,
           prvek:null, upozorneni:upoz };
}

function statikaKrovu(o){
  var St = global.PentiStatika, En = global.PentiEngine;
  if(!St || !En || !(o.rozponPulM > 0.3)) return null;
  var trida = o.trida || "C24";
  var sklonRad = (o.sklonDeg||0)*Math.PI/180;
  var pk = o.profilKrokve || {b:100,h:180};

  var Z = o.zatizeni || zatizeniKrovu(o);
  if(!Z) return null;
  var ko = { qUls:Z.qUlsPresne, qSls:Z.qSlsPresne };
  /* k_mod patří k té kombinaci, která vede. Když vede vítr, je zatížení
     krátkodobé a dřevo unese víc (0,90 místo 0,80) — posudek na to nesmí
     zapomenout, jinak by u větrných oblastí vycházel zbytečně přísně. */
  var kmodVedouci = (Z.kmod != null) ? Z.kmod : 0.8;

  /* ── KROKEV ────────────────────────────────────────────────────────
     Zatížení na běžný metr VODOROVNÉHO průmětu — tak se počítá moment. */
  var pk2 = poleKrokve(o.rozponPulM, o.xVaznic||[], sklonRad);
  var Lh = pk2.maxVodorovne;
  var wh = ko.qUls * (o.roztecKrokvi||0.9);
  var whSls = ko.qSls * (o.roztecKrokvi||0.9);
  var spolecne = { trida:trida, sklonDeg:o.sklonDeg, kmod:kmodVedouci };

  /* KAŽDÝ POSUDEK NESE KÓD PRVKU, kterého se týká.
     Díky tomu jde u políčka s profilem rovnou ukázat, jestli ten profil
     staticky vyhoví, a nemusí se kvůli tomu jezdit dolů do statiky.
     Kód se musí PŘIŘADIT, ne hádat z názvu — název se v UI mění
     (doplněno 22. 8. 2026). */
  var oznac = function(pole, kod){
    (pole||[]).forEach(function(r){ r.prvek = kod; });
    return pole || [];
  };

  /* ── SÍLY Z RÁMU VAZBY (PENTI 13. 10. 2026, B4, PLAN_vazba_ram.md) ──
     `o.ram` = obálka z PentiVazbaRam.silyProPosudky (jalová i plná vazba,
     tuhá i volná pata). Když je, krokev, kleština, sloupek a zatížení
     vaznic se posoudí na síly z rámu; bez něj postaru. */
  var RAM = o.ram || null;
  var radky = oznac(St.posudekKrokve(Object.assign({}, spolecne, {
    profil: pk, delkaM: pk2.maxPoSpadu, vodorovnyPrumet: Lh,
    wh: wh, whSls: whSls },
    RAM ? { MEd: RAM.krokev.M, VEd: RAM.krokev.V, zdrojRam: "obálka paty tuhá/volná, jalová i plná vazba" } : {})), "krokev");
  /* krokev je v rámu i tlačená → ohyb + tlak se vzpěrem v rovině vazby */
  if(RAM && RAM.krokev.Ntlak > 0.1 && St.posudekOhybTlak)
    radky = radky.concat(oznac(St.posudekOhybTlak(Object.assign({}, spolecne, {
      profil: pk, MEd: RAM.krokev.M, NEd: RAM.krokev.Ntlak, vzpernaDelkaM: pk2.maxPoSpadu, nazev: "Krokev" })), "krokev"));
  radky = radky.concat(oznac(St.posudekOsedlani(Object.assign({}, spolecne, {
    profil: pk, vodorovnyPrumet: Lh, wh: wh })), "krokev"));

  /* ── VAZNICE ───────────────────────────────────────────────────────
     Zatěžovací šířka: půlka pole nad vaznicí + půlka pod ní. Součinitele
     momentu a průhybu se berou ze spojitého nosníku (fáze S2) — vaznice
     stojí na řadě sloupků, ne na dvou podporách.                      */
  var vaznice = [], N = 0, pasekPosouzen = false, spojKlestiny = null;
  (o.vaznice||[]).forEach(function(vz){
    if(!(vz.rozpetiM > 0.3)) return;
    var wp = ko.qUls * vz.sirkaM, wpSls = ko.qSls * vz.sirkaM;
    /* zatížení vaznice z rámu jalové vazby (reakce krokve / rozteč) */
    if(RAM && RAM.vazniceW && RAM.vazniceW[vz.kod] > 0){
      wp = RAM.vazniceW[vz.kod];
      wpSls = (ko.qUls > 0) ? wp*ko.qSls/ko.qUls : wpSls;
    }
    var r = St.posudekVaznice(Object.assign({}, spolecne, {
      profil: vz.profil, rozpetiM: vz.rozpetiM, wp: wp, wpSls: wpSls,
      soucinitelM: vz.soucinitelM, soucinitelW: vz.soucinitelW,
      soucinitelV: vz.soucinitelV, dlabMm: vz.dlabMm }));
    r.forEach(function(x){ x.nazev = x.nazev.replace("Vaznice", vz.nazev); });
    oznac(r, vz.profilKod || "vaznice");
    radky = radky.concat(r);
    /* Reakce nad vnitřní podporou spojitého nosníku ≈ 1,1·w·L. */
    /* U věšadla je reakce z přesného spojitého nosníku (2× největší
       posouvající síla na jednotkové zatížení) — na 3 vazbách je to
       1,25·w·L, ne 1,1 (22. 9. 2026). */
    var reakce = (vz.reakceUnit > 0) ? vz.reakceUnit * wp : REAKCE_SPOJITEHO * wp * vz.rozpetiM;
    if(reakce > N) N = reakce;
    /* Pásek pod touhle vaznicí — posuzuje se na to nejzatíženější místo. */
    if(o.nabehPaskuM > 0.05 && o.profilPasku && !pasekPosouzen){
      pasekPosouzen = true;
      radky = radky.concat(oznac(St.posudekPasku(Object.assign({}, spolecne, {
        profil: o.profilPasku, nabehM: o.nabehPaskuM, wp: wp })), "pasek"));
    }
    vaznice.push({ nazev:vz.nazev, sirkaM:r2(vz.sirkaM), wp:r2(wp),
                   rozpetiM:vz.rozpetiM, reakceKN:r2(reakce), kod:vz.kod, profil:vz.profil });
  });

  /* ── SLOUPEK ───────────────────────────────────────────────────────
     Posuzuje se nejdelší sloupek na největší reakci — ten je rozhodující. */
  if(N > 0 && o.vyskaSloupkuM > 0.2){
    /* rám: síla ze sloupku plné vazby (vaznice + krokev plné vazby) */
    var Nsl = (RAM && RAM.sloupek && RAM.sloupek.N > 0) ? RAM.sloupek.N : N;
    radky = radky.concat(oznac(St.posudekSloupku(Object.assign({}, spolecne, {
      profil: o.profilSloupku, vzpernaDelkaM: o.vyskaSloupkuM, N: Nsl })), "sloupek"));
  }

  /* ── OCELOVÝ RÁM POD STŘEDOVÝMI VAZNICEMI (PENTI 23. 9. 2026) ──────
     Každá středová vaznice tlačí na rám svou reakcí (spojitý nosník
     s podporami v rámech). Návrhová reakce je spočítaná výš; charakte-
     ristická pro průhyb se z ní odvodí poměrem q_SLS/q_ULS. Posudek
     dělá modul penti-ram.js, tady se jen sesbírá zatížení. */
  var ramSt = null;
  var Rg = o.ramy, Ram = global.PentiRam;
  if(Rg && Rg.geo && Ram && Ram.posudek){
    var pomerSls = (ko.qUls > 0) ? ko.qSls/ko.qUls : 0.7;
    var jeVrchol = (Rg.typ === "vrchol");
    var Pu;
    if(jeVrchol){
      /* Rám pod vrcholovou vaznicí (25. 9. 2026): jedna síla ve vrcholu. */
      var vzVr = vaznice.filter(function(x){ return x.kod === "vaznice_vrchol"; })[0];
      Pu = [vzVr ? vzVr.reakceKN : 0];
    } else {
      var stredove = vaznice.filter(function(x){ return x.kod === "vaznice_stred"; });
      /* Rám nese obě vaznice — když má výpočet jen jednu (nesouměrná
         střecha), použije se stejná síla na obě strany. */
      Pu = stredove.length ? stredove.map(function(x){ return x.reakceKN; }) : [0];
      if(Pu.length === 1) Pu = [Pu[0], Pu[0]];
    }
    var vazniceRam = Pu.map(function(P){ return { PulsKN:r2(P), PslsKN:r2(P*pomerSls) }; });
    /* Zadání geometrie pro modul — stejné pro posudek i návrh profilu. */
    var zadRam = jeVrchol
      ? Object.assign({}, Rg.zadani || { typ:"vrchol", rozpetiPatM: Rg.rozpetiPatM, zPatyM: Rg.zPatyM, zVrcholM: Rg.zVrcholM,
          xVrcholM: Rg.geo.xVrcholM }, { pata: Rg.pata, vaznice: vazniceRam })
      : { rozpetiPatM: Rg.rozpetiPatM, zPatyM: Rg.zPatyM, zPricleM: Rg.zPricleM,
          xVaznicM: Rg.geo.uzly.slice(2, 2+Rg.geo.indexVaznic.length).map(function(u){ return u[0]; }),
          odsazeniKolenaM: Rg.kolenoSkutecneM || Rg.kolenoM, pata: Rg.pata, vaznice: vazniceRam };
    var rp = Ram.posudek(Object.assign({ profil: Rg.profil }, zadRam));
    oznac(rp.radky, "ram");
    radky = radky.concat(rp.radky);
    ramSt = {
      profil: rp.profil.kod, popis: Rg.profilPopis, pata: rp.pata, pocet: Rg.pocet, osovaM: Rg.osovaM,
      PulsKN: vazniceRam.map(function(x){ return x.PulsKN; }),
      PslsKN: vazniceRam.map(function(x){ return x.PslsKN; }),
      vnitrni: rp.vnitrni, vyuziti: rp.vyuziti, vyhovuje: rp.vyhovuje,
      hmotnostKusKg: Rg.hmotnostKusKg, hmotnostKg: Rg.hmotnostKg,
      typ: jeVrchol ? "vrchol" : "stred", rada: Rg.rada || "U",
      /* návrh ve stejné řadě, jakou uživatel zvolil (2×U nebo HEB) */
      navrh: Ram.navrhProfil ? Ram.navrhProfil(Object.assign({ profil: Rg.profil }, zadRam)) : null,
      upozorneni: rp.upozorneni, radky: rp.radky
    };
    /* ── DÍLENSKÉ DETAILY RÁMU (29. 9. 2026) — pozice, paty, kotvy, styk,
       svary, výpis materiálu. Počítá se z téhož posudku (síly). */
    if(Ram.dilna){
      try{
        ramSt.dilna = Ram.dilna(Object.assign({ profil: Rg.profil, posudekRamu: rp, pocetRamu: Rg.pocet,
                                                vaznice: Rg.vaznice || null, styk: Rg.styk || "sroubovany",
                                                venec: Rg.venec ? Object.assign({ pataOdLiceMm: Math.round(Rg.pataOdLiceM*1000) }, Rg.venec) : null }, zadRam));
      }catch(eD){ ramSt.dilnaChyba = String(eD && eD.message || eD); }
    }
  }

  /* ── VĚŠADLO — VAZBA A SPOJE (PENTI 22. 9. 2026) ───────────────────
     Reakce vaznic na vazbu → rámový model → posudky vzpěry, zapuštění,
     věšáku, třmenu, trámu, kampu, kotvení trámu a věnce na svislé síly.
     Vzorce viz PentiStatika (podle vzoru: statika mlýna Mořice 2016). */
  var vesadloSt = null;
  var Vg = o.vesadlo;
  if(Vg && Vg.tram && St.vesadloRam){
    var vzV = vaznice.filter(function(x){ return x.kod === "vaznice_vrchol"; })[0];
    var vzO = vaznice.filter(function(x){ return x.kod === "vaznice_okap"; })[0];
    var Vvrchol = vzV ? vzV.reakceKN : 0, Vokap = vzO ? vzO.reakceKN : 0;
    var osova = Vg.osova || 4;
    var pT = o.profilTramu || {b:200,h:280}, pV = o.profilVesaku || {b:180,h:180}, pZ = o.profilVzpery || {b:140,h:140};
    /* spojité po trámu: vlastní tíha (5 kN/m³) + podhled zavěšený na trámech, návrhově ×1,35 */
    var gTram = (pT.b/1000)*(pT.h/1000)*5, gPodhled = (o.podhledKNm2 || 0)*osova;
    var wTram = 1.35*(gTram + gPodhled);
    var ram = St.vesadloRam({
      S: Vg.S, tlZdi: Vg.tlZdi, xh: Vg.xh, hTramM: Vg.tram.hM,
      ulozeniOdM: Vg.tram.ulozeniOdM || 0,
      pataX: [Vg.vzpery[0].xOsaTramM, Vg.vzpery[1].xOsaTramM],
      hlavaY: Vg.vesak.hlavaOsaM,
      VvrcholKN: Vvrchol, VokapKN: Vokap, wTramKNm: wTram,
      profily: { tram:pT, vesak:pV, vzpera:pZ }, trida: trida
    });
    if(ram){
      var f = St.navrhovePevnosti(trida, kmodVedouci);
      var beta = Vg.sklonVzpery || 35, gama = 90 - beta;
      var bCelo = Math.min(pZ.b, pT.b), bHlava = Math.min(pZ.b, pV.b);
      var rV = [];
      /* vzpěra — tlak se vzpěrem na celou délku osy */
      var rvz = St.posudekSloupku(Object.assign({}, spolecne, { profil:pZ, vzpernaDelkaM:Vg.delkaVzpery, N:ram.NvzperaKN }));
      rvz.forEach(function(x){ x.nazev = "Vzpěra věšadla — tlak + vzpěr (L = " + Vg.delkaVzpery.toFixed(2) + " m)"; });
      rV = rV.concat(oznac(rvz, "vzpera"));
      /* VÝSTŘEDNOST OD ZAPUŠTĚNÍ (PENTI 11. 10. 2026, plán hlavy věšáku, krok 3)
         Síla jde do zapuštění jen přes čelo, ne přes celý průřez vzpěry —
         působí mimo její osu o e = (h − t)/2 (Holzbau 2, „Ausmittigkeit
         e = h/2 − t_v/2"). Bere se mělčí čelo na kterémkoli konci (větší
         výstřednost). Posudek tlak + ohyb se vzpěrem, EN 1995-1-1 (6.23). */
      (function(){
        var tPata = (Vg.zarazka && Vg.zarazka.druh === "dvojita") ? Vg.zarazka.celniHloubkaMm : Vg.tvMm;
        var tHlava = (Vg.hlava && Vg.hlava.druh === "dvojite") ? Vg.hlava.predniHloubkaMm : Vg.thMm;
        var tMin = Math.min(tPata || 0, tHlava || 0);
        if(!(tMin > 0) || !St.soucinitelVzperu) return;
        var eMm = (pZ.h - tMin)/2, MkNm = ram.NvzperaKN*eMm/1000;
        var vzK = St.soucinitelVzperu(pZ.b, pZ.h, Vg.delkaVzpery, trida);
        var sC = ram.NvzperaKN*1000/(pZ.b*pZ.h), sM = MkNm*1e6/(pZ.b*pZ.h*pZ.h/6);
        rV = rV.concat(oznac([St.radek("Vzpěra věšadla — tlak + ohyb od výstřednosti zapuštění",
          "σ_c/(k_c·f_c,0,d) + σ_m/f_m,d ≤ 1,  e = (h − t)/2   (EN 1995-1-1 6.23)",
          "N = " + ram.NvzperaKN.toFixed(2) + " kN; t = " + tMin + " mm (mělčí čelo) → e = " + eMm.toFixed(1) + " mm, M = "
          + MkNm.toFixed(2) + " kNm; k_c = " + vzK.kc.toFixed(2) + " → " + (sC/(vzK.kc*f.fc0d)).toFixed(2) + " + " + (sM/f.fmd).toFixed(2),
          sC/(vzK.kc*f.fc0d) + sM/f.fmd)], "vzpera"));
      })();
      /* zapuštění v trámu a v hlavě */
      var zapT = St.posudekZapusteni(Object.assign({}, spolecne, { nazev:"Zapuštění vzpěry do trámu", NkN:ram.NvzperaKN,
        uhelDeg:beta, bMm:bCelo,
        /* dvojitá zarážka nese obě čela dohromady; smyk za čelem a strop ¼ h
           se hlídají na hlubším (hřbetním) čele (30. 9. 2026) */
        tvMm:(Vg.tvEfMm || Vg.tvMm), tvSmykMm:Vg.tvMm,
        popisTv:(Vg.zarazka && Vg.zarazka.druh === "dvojita")
          ? ("dvojitá zarážka t₁ + t₂ = " + Vg.zarazka.celniHloubkaMm + " + " + Vg.tvMm) : null,
        lvMm:Vg.tram.predsazeniM*1000, hMm:pT.h }));
      rV = rV.concat(oznac(zapT.radky, "tram"));
      var hlavaNad = (Vg.vzpery[0].zapusteniHlava.odVrchuM || 0)*1000 + Vg.thMm*Math.tan(gama/2*Math.PI/180);
      /* hlava (11. 10. 2026): mez h/6 šířky věšáku v rovině vazby (z obou
         stran), dvojité zapuštění nese obě čela dohromady — jako v trámu */
      var dvojH = Vg.hlava && Vg.hlava.druh === "dvojite";
      var zapH = St.posudekZapusteni(Object.assign({}, spolecne, { nazev:"Zapuštění vzpěry do hlavy věšáku", NkN:ram.NvzperaKN,
        uhelDeg:gama, bMm:bHlava, tvMm:(Vg.thEfMm || Vg.thMm), tvSmykMm:Vg.thMm, lvMm:hlavaNad,
        hMm:pV.h, mezNasobek:6,
        popisTv: dvojH ? ("dvojité zapuštění t₁ + t₂ = " + Vg.hlava.predniHloubkaMm + " + " + Vg.thMm) : null }));
      rV = rV.concat(oznac(zapH.radky, "sloupekVes"));
      /* věšák — tah v krku mezi zapuštěními */
      /* krk: v rovině vazby (h − 2·zapuštění) × tloušťka podél hřebene (b) — 11. 10. 2026 */
      var Akrk = Vg.vesak.krkMm * pV.b, sigKrk = ram.NvesakKN*1000/Akrk;
      rV = rV.concat(oznac([St.radek("Věšák — tah v krku (oslabený průřez)", "σ_t,0,d = N/A_n ≤ f_t,0,d",
        "N = " + ram.NvesakKN.toFixed(2) + " kN (tah); krk " + Vg.vesak.krkMm + " × " + pV.b + " mm → σ = " + sigKrk.toFixed(2)
        + " N/mm²; f_t,0,d = " + f.ft0d.toFixed(2), sigKrk/f.ft0d)], "sloupekVes"));
      /* vrcholová vaznice na hlavě věšáku — otlačení kolmo k vláknům vaznice */
      var pVaz = (vzV && vzV.profil) || {b:160,h:220};
      /* plocha: šířka věšáku v rovině vazby (h, nejvýš šířka vaznice) ×
         tloušťka podél hřebene (b) + 2 × 30 mm (11. 10. 2026) */
      var lUl = Math.min(pV.b, 1e9), Aef = Math.min(pV.h, pVaz.b) * (lUl + 60);
      var sigUl = Vvrchol*1000/Aef;
      rV = rV.concat(oznac([St.radek("Vrcholová vaznice — otlačení na hlavě věšáku", "σ_c,90,d = V/(b·l_ef) ≤ k_c,90·f_c,90,d",
        "V = " + Vvrchol.toFixed(2) + " kN; plocha " + Math.min(pV.h, pVaz.b) + " × (" + lUl + " + 2·30) mm → σ = " + sigUl.toFixed(2)
        + " N/mm²; limit 1,5·" + f.fc90d.toFixed(2) + " = " + (1.5*f.fc90d).toFixed(2), sigUl/(1.5*f.fc90d))], "vaznice"));
      /* třmen */
      var trm = St.posudekTrmenu({ NkN:ram.NvesakKN, kmod:kmodVedouci, bVesakuMm:pV.b, prumerMm:16, plechMm:8, pasovinaMm:60, pocet:2 });
      rV = rV.concat(trm.radky);
      /* vazný trám — tah + ohyb v oslabeném průřezu, smyk u podpory, otlačení na věnci
         (uložení = od konce trámu na líci betonu věnce po vnitřní líc zdi) */
      var ulozTram = (Vg.tram.ulozeniM > 0.05) ? Vg.tram.ulozeniM : Vg.tlZdi;
      var hn = pT.h - Vg.tvMm, An = pT.b*hn, Wn = pT.b*hn*hn/6;
      var Mn = ram.MpatyKNm + ram.NtramKN*(pT.h/2)/1000;
      var sigT = ram.NtramKN*1000/An, sigM = Mn*1e6/Wn;
      var vyuzTram = sigT/f.ft0d + sigM/f.fmd;
      rV = rV.concat(oznac([
        St.radek("Vazný trám — tah + ohyb v oslabeném průřezu (u zapuštění)", "σ_t/f_t,0,d + σ_m/f_m,d ≤ 1   (EN 1995-1-1 6.2.3)",
          "N = " + ram.NtramKN.toFixed(2) + " kN, A_n = " + pT.b + "×" + hn + " mm → σ_t = " + sigT.toFixed(2)
          + "; M = " + ram.MpatyKNm.toFixed(2) + " + N·h/2 = " + Mn.toFixed(2) + " kNm, W_n = " + Math.round(Wn/1000)
          + " cm³ → σ_m = " + sigM.toFixed(2) + " N/mm²; " + (sigT/f.ft0d).toFixed(2) + " + " + (sigM/f.fmd).toFixed(2), vyuzTram),
        /* uprostřed pod věšákem dlab pro spodní čep (9. 10. 2026): bere se
           bezpečně, jako by chyběl celý horní pás trámu do hloubky dlabu */
        (function(){
          var dl = Vg.tram.dlabVesaku; if(!dl) return null;
          var hd = pT.h - dl.hloubkaMm, Ad = pT.b*hd, Wd = pT.b*hd*hd/6;
          var Md = (ram.MstredKNm || 0) + ram.NtramKN*(dl.hloubkaMm/2)/1000;
          var sT = ram.NtramKN*1000/Ad, sM = Md*1e6/Wd;
          return St.radek("Vazný trám — tah + ohyb v místě dlabu věšáku", "σ_t/f_t,0,d + σ_m/f_m,d ≤ 1   (bezpečně: průřez b × (h − dlab))",
            "N = " + ram.NtramKN.toFixed(2) + " kN, A_n = " + pT.b + "×" + hd + " mm → σ_t = " + sT.toFixed(2)
            + "; M = " + (ram.MstredKNm || 0).toFixed(2) + " + N·dlab/2 = " + Md.toFixed(2) + " kNm → σ_m = " + sM.toFixed(2)
            + " N/mm²; " + (sT/f.ft0d).toFixed(2) + " + " + (sM/f.fmd).toFixed(2), sT/f.ft0d + sM/f.fmd);
        })(),
        /* SMYK U PODPORY (PENTI 11. 10. 2026, plán hlavy věšáku, krok 4):
           · posouvající síla z MODELU VAZBY, ne celá reakce podpory —
             okapová vaznice leží přímo nad podporou a pata vzpěry kousek
             od ní, ty síly jdou rovnou do zdi a trám na smyk nenamáhají;
           · účinná šířka b_ef = k_cr·b, k_cr = 0,67 (EN 1995-1-1 6.1.7,
             trhliny ve dřevě). Do ostatních posudků smyku se k_cr doplní
             podle samostatného plánu (PLAN_kcr_smyk.md). */
        (function(){
          var KCR = St.K_CR || 0.67, hn = pT.h - (Vg.kampMm||0), Vs = (ram.VtramKN > 0) ? ram.VtramKN : ram.VaKN;
          var tau = 1.5*Vs*1000/(KCR*pT.b*hn);
          return St.radek("Vazný trám — smyk u podpory (oslabený kampem vaznice)", "τ_d = 1,5·V/(k_cr·b·(h − kamp)) ≤ f_v,d,  k_cr = 0,67   (EN 1995-1-1 6.1.7)",
            "V = " + Vs.toFixed(2) + " kN (posouvající síla v trámu z modelu vazby"
            + ((ram.VaKN - Vs > 0.05) ? ("; reakce podpory " + ram.VaKN.toFixed(2) + " kN — okapová vaznice nad podporou jde rovnou do zdi") : "")
            + "); k_cr·b·(h−kamp) = 0,67×" + pT.b + "×" + hn + " mm → τ = "
            + tau.toFixed(2) + " N/mm²; f_v,d = " + f.fvd.toFixed(2), tau/f.fvd);
        })(),
        St.radek("Vazný trám — otlačení na věnci", "σ_c,90,d = R/(b·l) ≤ f_c,90,d",
          "R = " + ram.VaKN.toFixed(2) + " kN; uložení " + pT.b + " × " + Math.round(ulozTram*1000) + " mm"
          + ((Vg.tram.ulozeniOdM > 0.0005) ? " (od líce betonu věnce po vnitřní líc zdi)" : "") + " → σ = "
          + (ram.VaKN*1000/(pT.b*ulozTram*1000)).toFixed(2) + " N/mm²; f_c,90,d = " + f.fc90d.toFixed(2),
          ram.VaKN*1000/(pT.b*ulozTram*1000)/f.fc90d)
      ].filter(Boolean), "tram"));
      /* kamp okapové vaznice — vodorovná síla odhadem 20 % reakce (vzor Mořice: 17 %) */
      var Vy = 0.2*Vokap, kampMm = Vg.kampMm || 30, pOk = (vzO && vzO.profil) || {b:160,h:220};
      var sigKamp = Vy*1000/(pOk.b*kampMm), tauKamp = Vy*1000/((St.K_CR || 0.67)*pOk.b*8*kampMm);   // k_cr (11. 10. 2026)
      rV = rV.concat(oznac([
        St.radek("Okapová vaznice — otlačení v čele kampu", "σ_c,90,d = V_y/(b·kamp) ≤ f_c,90,d",
          "V_y ≈ 0,2·R = " + Vy.toFixed(2) + " kN (odhad); " + pOk.b + " × " + kampMm + " mm → σ = " + sigKamp.toFixed(2)
          + " N/mm²; f_c,90,d = " + f.fc90d.toFixed(2), sigKamp/f.fc90d),
        St.radek("Okapová vaznice — usmyknutí dřeva za kampem", "τ_d = V_y/(k_cr·b·8·kamp) ≤ f_v,d,  k_cr = 0,67",
          "τ = " + tauKamp.toFixed(2) + " N/mm²; f_v,d = " + f.fvd.toFixed(2), tauKamp/f.fvd)
      ], "pozednice"));
      /* kotvení trámu proti sání */
      var sirkaOkapM = (vzO && vzO.sirkaM) || 0;
      var Nup = Math.max(0, (Z.qTahPresne || 0)) * osova * sirkaOkapM;
      var KOT = St.KOTVA_HUS4H10, NRdK = (o.betonSTrhlinami !== false) ? KOT.NRd_trhliny : KOT.NRd_bez;
      var kotevNaKonec = Math.max(1, Math.ceil(Nup/NRdK - 1e-9));
      var kotveniTramu = { NEdKN: r2(Nup), NRdKN: NRdK, kotevNaKonec: kotevNaKonec, kotva: KOT.nazev,
        radky: [St.radek("Kotvení vazného trámu — tah ze sání", "N_Ed = q_tah,d · osová · b_okap ≤ n · N_Rd",
          "q_tah,d = " + (Z.qTahPresne||0).toFixed(2) + " kN/m²; osová " + osova.toFixed(2) + " m; b = " + sirkaOkapM.toFixed(2)
          + " m → N_Ed = " + Nup.toFixed(2) + " kN na konec trámu; " + kotevNaKonec + "× " + KOT.nazev + " → N_Rd = "
          + (kotevNaKonec*NRdK).toFixed(2) + " kN", Nup/(kotevNaKonec*NRdK))] };
      rV = rV.concat(kotveniTramu.radky);
      /* okapová vaznice na trámu — vrut proti sání (stejný posudek jako krokev–pozednice) */
      var spojVaz = null;
      if(St.posudekSpojeKrokvePozednice && vzO){
        var Sp2 = global.PentiSpojovak, vrutyV = [];
        if(Sp2 && Sp2.VRUTY){
          [8, 10].forEach(function(d){
            var potreba = pOk.h + 6*d, nej = null;
            Sp2.VRUTY.forEach(function(vr){ if(vr.d === d && vr.delka + 1e-9 >= potreba && (!nej || vr.delka < nej.delka)) nej = vr; });
            if(nej) vrutyV.push({ d:d, delkaMm:nej.delka, cena:nej.cena });
          });
        }
        spojVaz = St.posudekSpojeKrokvePozednice({ qTahUls: Z.qTahPresne, roztecKrokvi: osova,
          presahM: o.presahOkapM || 0, prvniPoleM: o.rozponPulM, hKrokveMm: pOk.h, hPozedniceMm: pT.h,
          vruty: vrutyV, kmod: 0.9, maxVrutu: 4 });
        if(spojVaz){
          spojVaz.radky.forEach(function(x){ x.nazev = x.nazev.replace("Kotvení krokve k pozednici", "Okapová vaznice na trámu"); });
          spojVaz.popis = (spojVaz.popis || "").replace("krokve s pozednicí", "okapové vaznice s trámem").replace("styk krokve s pozednicí", "křížení vaznice s trámem");
          /* Když vruty nestačí, spoj se udělá svorníkem M12 skrz vaznici
             a trám. Rozhoduje protlačení podložky do dřeva (EN 1995-1-1
             10.4.3: pod podložkou smí být 3 × f_c,90,d), ne ocel svorníku.
             Velkoplošná podložka M12 ⌀ 44 × 4. Když projde svorník, řádek
             vrutů se nahradí — ať souhrn nehlásí nevyhovění, které je
             ve spojováku vyřešené (22. 9. 2026). */
          if(spojVaz.nevyhovi && spojVaz.NEdKN > 0){
            var fS = St.navrhovePevnosti(trida, 0.9);
            var Apodl = Math.PI/4*(44*44 - 13.5*13.5);
            var FpodlKN = 3*fS.fc90d*Apodl/1000;
            var FocelKN = 0.9*420*84.3/1.25/1000;
            var FjedenKN = Math.min(FpodlKN, FocelKN);
            var nSv = Math.max(1, Math.ceil(spojVaz.NEdKN/FjedenKN - 1e-9));
            var vyuzSv = spojVaz.NEdKN/(nSv*FjedenKN);
            spojVaz.svornik = { prumerMm:12, pocet:nSv, FjedenKN:r2(FjedenKN), FpodlKN:r2(FpodlKN), FocelKN:r2(FocelKN),
                                vyuziti:r3(vyuzSv), vyhovuje: nSv <= 2 && vyuzSv <= 1 };
            var radekSv = St.radek("Okapová vaznice na trámu — svorník M12 proti sání (protlačení podložky)",
              "N_Ed ≤ n · min(3·f_c,90,d·A_podložky; F_t,Rd)   (EN 1995-1-1 10.4.3)",
              "N_Ed = " + spojVaz.NEdKN.toFixed(2) + " kN na křížení ("
              + (spojVaz.zadnyVrut ? "žádný vrut nezajede do trámu dost hluboko"
                 : "vruty nestačí: " + spojVaz.vrutuNaStyk + "× ⌀" + spojVaz.d + " dá " + (+spojVaz.FRdKN || 0).toFixed(2) + " kN")
              + "); podložka ⌀44 → " + FpodlKN.toFixed(2) + " kN, svorník 4.8 → "
              + FocelKN.toFixed(2) + " kN; " + nSv + "× M12 → F_Rd = " + (nSv*FjedenKN).toFixed(2) + " kN", vyuzSv);
            if(spojVaz.svornik.vyhovuje){
              rV = rV.concat([radekSv]);
              spojVaz.popis = nSv + "× svorník M12 s velkoplošnou podložkou na křížení okapové vaznice s trámem (vruty by nestačily: N_Ed "
                + spojVaz.NEdKN.toFixed(2) + " kN).";
            } else {
              rV = rV.concat(spojVaz.radky).concat([radekSv]);
            }
          } else {
            rV = rV.concat(spojVaz.radky);
          }
        }
      }
      /* SVISLÁ REAKCE VAZBY DO ZDIVA — jen informace, ne posudek.
         Věnec leží na zdivu po celé délce, svisle se neohýbá a věšadlo zdi
         nerozpírá (PENTI 22. 9. 2026: „věnec nemůže mít svislý průhyb, leží
         na zdivu"). Do 22. 9. 2026 se tu chybně posuzoval věnec jako prostý
         nosník mezi štíty — vycházel na stovky procent a byl to nesmysl.
         Spočítá se jen roznesení bodové síly přes věnec do zdiva (pod 45°,
         tj. šířka trámu + 2 × výška věnce) — zdivo samo se neposuzuje. */
      var hVenecM = (o.venec && o.venec.vyskaMm > 0) ? o.venec.vyskaMm/1000 : 0.25;
      var sirkaRoznesM = pT.b/1000 + 2*hVenecM;
      var zdivo = {
        reakceKN: r2(ram.VaKN), hVenecMm: Math.round(hVenecM*1000),
        sirkaRoznesM: r2(sirkaRoznesM), tlZdiM: r2(Vg.tlZdi),
        tlakMPa: r3(ram.VaKN*1000/(Vg.tlZdi*1000*sirkaRoznesM*1000))
      };
      radky = radky.concat(rV);
      vesadloSt = {
        ram: ram, VvrcholKN: r2(Vvrchol), VokapKN: r2(Vokap), wTramKNm: r2(wTram), osovaM: osova,
        zapusteniTram: zapT, zapusteniHlava: zapH, trmen: trm, kotveniTramu: kotveniTramu,
        spojVaznice: spojVaz, zdivo: zdivo,
        tvPotrebaMm: zapT.tvPotrebaMm, thPotrebaMm: zapH.tvPotrebaMm,
        lvPotrebaMm: zapT.lvPotrebaMm,
        /* geometrie se má přepočítat s hlubším zapuštěním */
        prepocitat: (zapT.tvPotrebaMm > (Vg.tvEfMm || Vg.tvMm)) || (zapH.tvPotrebaMm > (Vg.thEfMm || Vg.thMm)),
        radky: rV
      };
    }
  }

  /* ── ROZPĚR VAZBY A KLEŠTINY ───────────────────────────────────────
     Kleštiny berou rozpěr (metodika, otázka D). Co nepřevezmou, jde do
     pozednice a odtud kotvami do věnce — proto se to počítá dřív než
     kotvení. */
  var rozper = null;
  if(St.rozperVazby){
    rozper = St.rozperVazby({
      wh: wh, rozponVodorovnyM: 2*(o.rozponPulM||0),
      vyskaHrebeneM: o.vyskaHrebeneM,
      maVrcholovouVaznici: !!o.maVrcholovouVaznici,
      maKlestiny: !!o.maKlestiny, vyskaKlestinyM: o.vyskaKlestinyM
    });
    /* Hambálek je JEDEN kus přiložený z boku krokve — kleštiny jsou dva
       kusy z obou stran. Do 21. 9. 2026 se hambálek posuzoval jako dvojice
       (dvojnásobná plocha, svorníky dvojstřižně), což bylo na nebezpečné
       straně. */
    var jeHambalek = (o.klestinaKod === "hambalek");
    /* oboustranné kleštiny místo hambálku = dva kusy, dvojstřižně (21. 9. 2026) */
    var hambalekJednostranny = jeHambalek && (o.hambalekKusu || 1) === 1;
    /* kleštiny, kde je ručně smazaná jedna strana (2026.11.240): rozhoduje
       jednostranný pár — jeden kus, svorníky jednostřižně */
    var klestinaJednostranna = !jeHambalek && (o.klestinyJednostranne || 0) > 0;
    var jednostrizne = hambalekJednostranny || klestinaJednostranna;
    var kusuTahla = jeHambalek ? (o.hambalekKusu || 1) : (klestinaJednostranna ? 1 : 2);
    /* KLEŠTINA Z RÁMU (B4): síla z obálky rámu — i u vrcholové vaznice,
       kde dnešní výpočet rozpěr nepočítal (kleština tam krokve rozpírá
       a je tlačená). Dosavadní hodnota zůstane pro porovnání. */
    if(RAM && RAM.klestina && !jeHambalek && rozper && o.profilKlestiny){
      rozper.silaVKlestinePostaruKN = rozper.silaVKlestineKN;
      rozper.silaVKlestineKN = r3(Math.abs(RAM.klestina.N));
      rozper.klestinaTlak = RAM.klestina.N < 0;
      rozper.zRamu = true;
      rozper.maTahlo = true;
    }
    if(rozper && rozper.maTahlo && o.profilKlestiny){
      radky = radky.concat(oznac(St.posudekKlestiny(Object.assign({}, spolecne, {
        profil: o.profilKlestiny, silaKN: (rozper.klestinaTlak ? -1 : 1)*rozper.silaVKlestineKN,
        vzpernaDelkaM: (RAM && RAM.klestina) ? RAM.klestina.delka : 0,
        kusu: kusuTahla, prumerSvornikuMm: 12 })), o.klestinaKod || "klestina"));
      /* Spoj kleštiny s krokví — dvojstřižný, dva svorníky M12.
         Prostřední prvek je krokev a rozhoduje její TLOUŠŤKA. */
      /* Svorníky se NAVRHUJÍ, ne předepisují. PENTI používá M12 a M16;
         aplikace zkusí menší a jde nahoru, teprve když nestačí
         (rozhodnuto 18. 8. 2026). */
      if(St.navrhniSvorniky){
        spojKlestiny = St.navrhniSvorniky(rozper.silaVKlestineKN, {
          tloustkaKrajniMm: o.profilKlestiny.b,
          tloustkaProstredniMm: pk.b,
          vyskaKlestinyMm: o.profilKlestiny.h,
          /* jednostranný hambálek: jednostřižně a nejdřív typový spoj PENTI 3 × M12;
             oboustranné kleštiny: dvojstřižně jako kleštiny */
          jednostrizne: jednostrizne,
          typovy: hambalekJednostranny ? (o.typovySpojHambalku || { prumerMm:12, pocet:3 }) : null,
          trida: trida,
          /* Kolik délky je na svorníky k dispozici: kleština končí u
             vnějšího líce krokve, takže se překrývají jen na tolik, kolik
             měří výška krokve vodorovně, tedy h/sin(sklon). */
          delkaProSvornikyMm: (Math.sin(sklonRad) > 0.05)
            ? (pk.h / Math.sin(sklonRad)) : 400,
          sklonDeg: o.sklonDeg, kmod: kmodVedouci });
        if(spojKlestiny && !spojKlestiny.nevyhovi){
          var u2 = spojKlestiny.unosnost;
          radky.push({
            nazev:(jeHambalek ? "Spoj hambálku s krokví — " : (klestinaJednostranna ? "Spoj jednostranné kleštiny s krokví (párů: " + o.klestinyJednostranne + ") — " : "Spoj kleštiny s krokví — ")) + spojKlestiny.popis,
            vzorec:"N_Ed ≤ n_ef · F_v,Rd   (EN 1995-1-1, čl. 8.2.2, rov. " + (jednostrizne ? "8.6" : "8.7") + ")",
            dosazeni:"F_v,Rk = " + u2.FvRk + " kN na střižnou rovinu "
              + "(rozhoduje mód " + u2.rozhodujiciMod + "); " + (jednostrizne ? "jednostřižný" : "dvojstřižný") + " spoj "
              + "→ " + u2.FvRdNaSvornik.toFixed(2) + " kN/svorník návrhově; "
              + (spojKlestiny.typovy ? ("n_ef celkem " + spojKlestiny.nef.toFixed(2))
                 : (spojKlestiny.nadSebou + " nad sebou × n_ef " + spojKlestiny.nef.toFixed(2)))
              + " → " + spojKlestiny.unosnostKN.toFixed(2) + " kN; N_Ed = "
              + rozper.silaVKlestineKN.toFixed(2) + " kN"
              + (spojKlestiny.tuhost ? ("; K_ser = " + spojKlestiny.tuhost.KserKNmm.toFixed(1) + " kN/mm") : ""),
            vyuziti: spojKlestiny.vyuziti,
            vyhovuje: spojKlestiny.vyuziti <= 1 });
        }
        /* Když spoj nevyhoví, `statikaKrovu` nemá kam hlásit — upozornění
           patří volajícímu, ten si ho vytáhne z výsledku. */
      }
    }
  }

  /* ── HAMBÁLEK JAKO NEDOKONALÉ TÁHLO (PENTI 21. 9. 2026) ─────────────
     Deformačně kompatibilní model poloviny vazby: tři modely spoje ×
     rozsah vodorovné tuhosti paty. Výsledná obálka přepíše dosavadní
     „do věnce nejde nic": do kotvení pozednice jde největší H_věnec, na
     hambálek se posoudí i tlak (vzpěr), když se při tuhé patě opře. */
  var hambalekModel = null;
  if(jeHambalek && rozper && rozper.maTahlo && St.hambalekObalka && o.profilKlestiny){
    /* tuhost jednoho spoje: z navrženého spoje (K_u), jinak z nejsilnějšího
       uspořádání, které se do přesahu vejde */
    var KuSpoj = null;
    if(spojKlestiny && spojKlestiny.tuhost) KuSpoj = spojKlestiny.tuhost.KuKNmm;
    else if(spojKlestiny && spojKlestiny.nejsilnejsi && St.tuhostSvorniku)
      KuSpoj = St.tuhostSvorniku({ prumerMm:spojKlestiny.nejsilnejsi.prumerMm,
        pocet:spojKlestiny.nejsilnejsi.celkem, striznychRovin:(hambalekJednostranny ? 1 : 2), trida:trida }).KuKNmm;
    if(KuSpoj == null && St.tuhostSvorniku)
      KuSpoj = St.tuhostSvorniku({ prumerMm:12, pocet:3, striznychRovin:(hambalekJednostranny ? 1 : 2), trida:trida }).KuKNmm;
    /* oboustranné kleštiny = dva průřezy v tahu (šířka pro model ×2) */
    var profilTahla = { b:(o.profilKlestiny.b||100)*kusuTahla, h:o.profilKlestiny.h||160 };
    hambalekModel = St.hambalekObalka({
      rozponM: 2*(o.rozponPulM||0), sklonDeg: o.sklonDeg,
      /* osa hambálku = spodní hrana + půl výšky profilu */
      vyskaHambalkuM: (o.vyskaKlestinyM||0) + (o.profilKlestiny.h||160)/2000,
      wKNm: wh, profilKrokve: pk, profilHambalku: profilTahla,
      KspojKNmm: KuSpoj, vuleMm: 1,
      kwKNmm: (o.kwKNmm != null && o.kwKNmm !== "") ? +o.kwKNmm : null
    });
    if(hambalekModel){
      hambalekModel.KspojKNmm = KuSpoj;
      var nv = hambalekModel.navrh;
      /* Do věnce jde obálka — ne nula. */
      rozper.doVenceKNm = nv.HvenecKN;
      rozper.doVenceBezTahlaKNm = nv.HvenecBezTahlaKN;
      rozper.popis = "Hambálek jako nedokonalé táhlo: podle tuhosti paty jde do věnce 0 až "
        + nv.HvenecKN.toFixed(2) + " kN na vazbu (bez táhla " + nv.HvenecBezTahlaKN.toFixed(2)
        + " kN); v hambálku nejvýš " + nv.NhambalekTahKN.toFixed(2) + " kN tah"
        + (nv.NhambalekTlakKN > 0.01 ? (" a " + nv.NhambalekTlakKN.toFixed(2) + " kN tlak (tuhá pata)") : "") + ".";
      /* Tlak v hambálku při tuhé patě — vzpěr po délce hambálku. */
      if(nv.NhambalekTlakKN > 0.01 && St.posudekSloupku){
        var Lh = (hambalekModel.tabulka[0] && hambalekModel.tabulka[0].LhM) || null;
        var geo = St.ramHambalek({ rozponM: 2*(o.rozponPulM||0), sklonDeg:o.sklonDeg,
          vyskaHambalkuM:(o.vyskaKlestinyM||0) + (o.profilKlestiny.h||160)/2000, wKNm:wh,
          profilKrokve:pk, profilHambalku:profilTahla, KspojKNmm:null, kwKNmm:null });
        var LhM = geo && geo.geometrie ? geo.geometrie.LhM : 2*(o.rozponPulM||0) - 2*(o.vyskaKlestinyM||0)/Math.tan(sklonRad);
        /* u dvou kusů nese každý půlku tlaku; vzpěr se posuzuje na jeden kus */
        var rv = St.posudekSloupku(Object.assign({}, spolecne, {
          profil:o.profilKlestiny, vzpernaDelkaM:LhM, N:nv.NhambalekTlakKN/kusuTahla }));
        rv.forEach(function(x){ x.nazev = "Hambálek — tlak + vzpěr (tuhá pata, L = " + LhM.toFixed(2) + " m"
          + (kusuTahla > 1 ? ", na jeden ze dvou kusů" : "") + ")"; });
        radky = radky.concat(oznac(rv, "hambalek"));
      }
    }
  }

  /* ── VĚNEC JAKO VODOROVNÝ NOSNÍK NA ROZPĚR (PENTI 22. 9. 2026) ─────
     Jen u hambálku (jinde rozpěr do věnce nejde). Křivky H(u) paty pro
     ULS i SLS z modelu hambálku, pak sdružený nosník mezi štíty. */
  var venec = null;
  if(hambalekModel && o.venec && St.venecPosudek && St.krivkaPaty){
    if(o.venec.stropTuhy){
      venec = { stropTuhy:true, HvenecKN: hambalekModel.navrh.HvenecKN,
                popis:"V úrovni pozednice je ztužující strop — rozpěr jde do stropu." };
    } else if(o.venec.krokveX && o.venec.krokveX.length && (o.venec.delkaM > 0.5)){
      var zakl = { rozponM: 2*(o.rozponPulM||0), sklonDeg: o.sklonDeg,
        vyskaHambalkuM: (o.vyskaKlestinyM||0) + (o.profilKlestiny.h||160)/2000,
        profilKrokve: pk, profilHambalku: profilTahla, KspojKNmm: hambalekModel.KspojKNmm, vuleMm: 1 };
      venec = St.venecPosudek({
        beton: o.venec.beton, sirkaMm: o.venec.sirkaMm, vyskaMm: o.venec.vyskaMm, LM: o.venec.delkaM,
        krytiMm: o.venec.krytiMm, vyztuzKs: o.venec.vyztuzKs, vyztuzMm: o.venec.vyztuzMm,
        trminkyMm: o.venec.trminkyMm, trminkyRoztecMm: o.venec.trminkyRoztecMm,
        krokveX: o.venec.krokveX,
        krivkaULS: St.krivkaPaty(Object.assign({}, zakl, { wKNm: wh })),
        krivkaSLS: St.krivkaPaty(Object.assign({}, zakl, { wKNm: whSls }))
      });
      /* řádky věnce jdou mezi posudky — bez kódu prvku (profil krokve je nespraví) */
      if(venec && venec.radky) radky = radky.concat(venec.radky);
    }
  }

  /* RÁM VAZBY (B4): když pozednice patu drží (tuhá pata v obálce), jde do
     ní vodorovná reakce paty — kotvy musí unést větší z obou čísel. */
  if(RAM && rozper && RAM.pataH > (rozper.doVenceKNm || 0)){
    rozper.doVencePostaruKNm = rozper.doVenceKNm || 0;
    rozper.doVenceKNm = r3(RAM.pataH);
    rozper.doVenceZRamu = true;
  }

  /* ── KOTVENÍ POZEDNICE ─────────────────────────────────────────────
     Zatěžovací šířka pozednice je vodorovně půlka prvního pole krokve —
     druhou půlku už nese vaznice. */
  var kotveni = null;
  /* U věšadla pozednice není — trámy se kotví zvlášť (posudek věšadla). */
  if(St.kotveniPozednice && !o.vesadlo){
    var prvniPole = (pk2.pole && pk2.pole.length) ? pk2.pole[0] : Lh;
    kotveni = St.kotveniPozednice({
      qTahUls: Z.qTahPresne,
      zatezovaciSirkaM: prvniPole/2,
      /* Rozpěr, který kleštiny nepobraly, jde kotvami do věnce.
         Na běžný metr pozednice = na vazbu dělený roztečí krokví. */
      vodorovnaSilaKNm: (rozper ? rozper.doVenceKNm : 0)
                        / (o.roztecKrokvi || 0.9),
      vyskaVenceMm: o.vyskaVenceMm,
      odHranyMm: o.odHranyMm,
      betonSTrhlinami: o.betonSTrhlinami
    });
    if(kotveni) radky = radky.concat(kotveni.radky);
  }

  /* ── SPOJ KROKEV–POZEDNICE NA SÁNÍ (PENTI 21. 9. 2026) ─────────────
     Vrut drží krokev proti nadzvednutí; rozpěr přenáší čelo osedlání.
     Kandidáti vrutů se berou ze spojováku (stejné pravidlo jako tam:
     projít krokví a zajet 6·d do pozednice), nejlevnější první — aby
     posudek a objednávka mluvily o témže vrutu. U věšadla pozednice
     není, tam se spoj neposuzuje. */
  var spojKrokve = null;
  if(St.posudekSpojeKrokvePozednice && !o.vesadlo){
    var Sp = global.PentiSpojovak, vruty = [];
    if(Sp && Sp.VRUTY){
      [6, 8].forEach(function(d){
        var potreba = pk.h + 6*d, nej = null;
        Sp.VRUTY.forEach(function(vr){
          if(vr.d === d && vr.delka + 1e-9 >= potreba && (!nej || vr.delka < nej.delka)) nej = vr;
        });
        if(nej) vruty.push({ d:d, delkaMm:nej.delka, cena:nej.cena });
      });
      vruty.sort(function(a, b){ return (a.cena||0) - (b.cena||0); });
    }
    var prvniPoleKrokve = (pk2.pole && pk2.pole.length) ? pk2.pole[0] : Lh;
    spojKrokve = St.posudekSpojeKrokvePozednice({
      qTahUls: Z.qTahPresne, roztecKrokvi: o.roztecKrokvi || 0.9,
      presahM: o.presahOkapM || 0, prvniPoleM: prvniPoleKrokve,
      hKrokveMm: pk.h, hPozedniceMm: (o.profilPozednice && o.profilPozednice.h) || 160,
      vruty: vruty, kmod: 0.9, maxVrutu: 2
    });
    /* Bez kódu prvku — stejně jako kotvení pozednice: vyšší profil krokve
       to nespraví, řeší se počtem vrutů. Odznak u profilu se proto nevěší. */
    if(spojKrokve) radky = radky.concat(spojKrokve.radky);
  }

  return {
    zatizeni: Z,
    rozper: rozper,
    /* síly z rámu vazby, ze kterých posudky vyšly (B4) — null = postaru.
       (Klíč `ram` už patří ocelovým rámům pod vaznicemi.) */
    ramVazby: RAM ? { krokev:RAM.krokev, klestina:RAM.klestina, sloupek:RAM.sloupek, vazniceW:RAM.vazniceW, pataH:RAM.pataH, popis:RAM.popis, pripady:RAM.pripady } : null,
    spojKlestiny: spojKlestiny,
    kotveni: kotveni,
    spojKrokve: spojKrokve,
    hambalekModel: hambalekModel,
    venec: venec,
    vesadlo: vesadloSt,
    ram: ramSt,
    krokev: { pole:pk2.pole, podporyX:pk2.podporyX,
              volnePoSpadu:pk2.maxPoSpadu, volneVodorovne:pk2.maxVodorovne,
              roztec:o.roztecKrokvi||0.9, wh:r2(wh), profil:pk },
    vaznice: vaznice,
    sloupek: { N:r2(N), vyskaM:o.vyskaSloupkuM, profil:o.profilSloupku },
    radky: radky,
    souhrn: St.souhrn(radky)
  };
}

/* `beh` = prvek je souvislý pás, který se skládá z několika kusů za sebou
   (pozednice, vaznice). Řezivo se u něj nakupuje jinak než u samostatných
   kusů: dvacetimetrová pozednice není jeden dvacetimetrový hranol. */
/* ══════════════════════════════════════════════════════════════════════
   PÁSKY U SLOUPKŮ
   ----------------------------------------------------------------------
   Pásek je šikmá vzpěrka ze sloupku do vaznice, začepovaná, pod úhlem 45°.
   Dělá dvě věci: zavětruje krov do stran a zkracuje vzpěrnou délku vaznice,
   takže vaznice může být subtilnější. Bez pásků je posudek vaznice
   optimistický a krov měkký — proto musí být u KAŽDÉHO sloupku, ne jen
   u vrcholových (upřesněno PENTI 14. 8. 2026).

   POČET: na obě strany sloupku, tedy 2 kusy. Když ale sloupek stojí
   v KŘÍŽENÍ VAZNIC (roh u valby nebo úžlabí), jdou pásky do obou směrů
   a svírají pravý úhel — tam jsou 4.

   PROFIL: zpravidla stejný jako sloupek, případně menší čtvercový.

   DÉLKA: běžně 1,2 až 1,5 m. Protože je pásek pod 45°, ukrojí ze sloupku
   i z vaznice náběh = délka děleno odmocninou ze dvou. Když je sloupek
   kratší než ten náběh, pásek se tam nevejde a je potřeba to říct.
   ══════════════════════════════════════════════════════════════════════ */
/* KRAJNÍ PÁSKY U ŠTÍTU (PENTI 4. 10. 2026): „Krajní pásky jen na jednu
   stranu směrem od štítu." Krajní sloupek u štítu stojí kousek před koncem
   vaznice (za ním je jen konzola přes štít) — pásek ven by se neměl o co
   opřít. Spočítá, kolik pásků u štítů odpadne: u každého sloupku strana,
   kde by konec náběhu vyjel za konec vaznice. Jen u běhů, které končí
   na štítu (`stitovePodpory`), a jen u konce, kde je konzola (sloupek není
   přímo na konci — tam je roh, kde se vaznice potkávají, a pásky jdou
   do obou směrů). Stejné pravidlo kreslí 3D (pásek za konec vaznice nedá). */
function paskuKrajnichSloupku(podpory, kod, delkaPasku, bSloupkuMm){
  var nab = delkaPasku > 0 ? delkaPasku/Math.SQRT2 : 0, pul = (bSloupkuMm||140)/2000, n = 0;
  if(!(nab > 0)) return 0;
  (podpory||[]).forEach(function(q){
    if(q.kod !== kod || !(q.stitovePodpory > 0) || !(q.delka > 0)) return;
    (q.polohy||[]).forEach(function(u){
      if(u > 0.05 && u - pul - nab < -1e-6) n++;                 // ven přes začátek
      if(u < q.delka - 0.05 && u + pul + nab > q.delka + 1e-6) n++;   // ven přes konec
    });
  });
  return n;
}
function pasky(kod, nazev, pocetSloupku, pocetKrizeni, delkaPasku, profil, delkaSloupku, upozorneni, profilVaznice, profilSloupku, vynechanoUStitu, kusuZPudorysu){
  if(!(pocetSloupku>0) || !(delkaPasku>0)) return null;
  var nabeh = r2(delkaPasku/Math.SQRT2);
  if(delkaSloupku>0 && nabeh > delkaSloupku){
    upozorneni.push(nazev+": pásek dlouhý "+delkaPasku+" m potřebuje na sloupku "+nabeh
      +" m, ale sloupek má jen "+r2(delkaSloupku)+" m. Zkrať pásek, nebo ho vynech.");
    return null;
  }
  var krizeni = Math.max(0, Math.min(pocetKrizeni||0, pocetSloupku));
  /* Každý sloupek má 2 pásky — i rohový pod přeplátovanými vaznicemi:
     jeden podél každé vaznice dovnitř; ven se nevejde, vaznice v rohu
     končí (PENTI 4. 10. 2026; dřív se v rohu počítaly 4). */
  var kusu = pocetSloupku*2;
  /* Pásky, které by vjely do štítové zdi (u krajních vazeb věšadla), se
     odečtou — spočítá je volající, který zná polohy vazeb a zeď. */
  var vynechano = Math.max(0, Math.min(Math.round(vynechanoUStitu||0), kusu));
  kusu -= vynechano;
  /* počet z půdorysu (L/T, valba s křídlem — viz „ROHY PODLE PŮDORYSU") */
  var zPudorysu = (kusuZPudorysu != null && isFinite(+kusuZPudorysu));
  if(zPudorysu){ kusu = Math.max(0, Math.round(+kusuZPudorysu)); vynechano = 0; }
  if(!(kusu>0)) return null;

  /* ── ZAČEPOVÁNÍ PÁSKU ────────────────────────────────────────────────
     Pásek se čepuje na OBOU koncích — dole do sloupku, nahoře do vaznice
     (zadání PENTI 20. 8. 2026). Do té doby se počítala jen holá délka mezi
     lícem sloupku a lícem vaznice, takže na dlaby nezbylo dřevo.

     Páskový čep: třetina šířky pásku, 5 cm kolmo do sloupku/vaznice, podle
     knihy. Objednací délka = špička–špička (8. 10. 2026; dřív + 2 čepy). */
  /* JEDEN ZDROJ: geometrii čepů umí výrobní modul, výkaz si ji nepočítá
     znovu. Čep do vaznice je jinak hluboký než do sloupku (řídí se tím,
     do čeho jde), takže dvojí výpočet by se rozešel — a taky se rozešel
     o 30 mm na pásku, než se to 21. 8. 2026 sjednotilo. */
  var VV = global.PentiVyrobni;
  var pk = (VV && VV.pasek) ? VV.pasek({
      svetlaDelkaM: delkaPasku, profil: profil,
      profilVaznice: profilVaznice, profilSloupku: profilSloupku }) : null;
  /* Bez výrobního modulu (webová kalkulačka) stejný páskový čep přímo
     z penti-spoje.js. */
  var cep = pk ? pk.cepDoVaznice : cepSpoje((profil&&profil.b)||120, "pasek");
  var cepS = pk ? pk.cepDoSloupku : cep;
  /* Objednací délka = špička–špička (světlá v ose + výška profilu): páskový
     čep podle knihy nepřesahuje špičky pásku (PENTI 8. 10. 2026). */
  var objednaci = pk ? pk.celkemM : r2(delkaPasku + (((profil&&profil.h)||(profil&&profil.b)||120)/1000));

  var pozn = "pod 45°, náběh "+nabeh+" m po sloupku i po vaznici"
    + "; čepovaný na obou koncích — dole do sloupku (čep "+cepS.tloustkaMm
    + "×"+cepS.delkaMm+" mm), nahoře do vaznice (čep "+cep.tloustkaMm
    + "×"+cep.delkaMm+" mm)"
    + " (světlá délka v ose "+r2(delkaPasku)+" m; řezat špička–špička "+objednaci+" m — páskové čepy jsou uvnitř délky)";
  if(krizeni) pozn += "; z toho "+krizeni+" sloupků v rohu vaznic — pásek podél každé vaznice dovnitř";
  if(zPudorysu) pozn += "; počet podle půdorysu krovu (pásek jen tam, kde se vejde do běhu vaznice)";
  if(vynechano) pozn += "; "+vynechano+" "+(vynechano===1?"pásek":(vynechano<5?"pásky":"pásků"))
    +" u štítů vynechán"+(vynechano===1?"":(vynechano<5?"y":"o"))
    +(kod==="pasky_vrchol" && /věšák/.test(nazev)
      ? " — vjel"+(vynechano===1?"":"y")+" by do štítové zdi (krajní věšáky mají dlab jen na straně k sousední vazbě)"
      : " — krajní sloupek u štítu má pásek jen na stranu od štítu");
  var pr = prvek(kod, nazev, profil, nKusu(kusu, objednaci), "model", pozn);
  pr.vynechanoUStitu = vynechano;
  pr.cep = cep;
  pr.cepDoSloupku = cepS;
  pr.svetlaDelkaM = r2(delkaPasku);
  /* Do ČEHO je pásek začepovaný. Výrobní výkres to potřebuje vědět, aby
     kreslil týž kus — hloubka čepu je třetina výšky toho prvku, a ta se
     u okapové a středové vaznice liší (u BSH klidně o 130 mm). */
  pr.profilVaznice = profilVaznice;
  pr.profilSloupku = profilSloupku;
  return pr;
}

/* Kolik sloupků stojí v křížení vaznic.
   Vaznice vede po každé střešní rovině. Tam, kde na sebe dvě roviny
   navazují, se vaznice potkají v rohu — u valby obíhá vaznice dokola,
   u sedlové střechy končí na obou štítech a žádný roh nevznikne.
   Každá štítová hrana jeden roh ubere. */
function krizeniVaznic(pocetRovinSVaznici, stitovychHran){
  return Math.max(0, (pocetRovinSVaznici||0) - (stitovychHran||0));
}

/* Druh a kvalita řeziva po prvcích. Nastavuje je uživatel v kroku krovu;
   modul si je jen odloží k prvku, aby je `penti-rezivo.js` našel a mohl
   sjednotit prvky stejného profilu A druhu (zadání PENTI 21. 8. 2026).
   Když u prvku nic nastavené není, spadne se na globální druh. */
var REZIVO_PRVKU = {};
function nastavRezivoPrvku(mapa){ REZIVO_PRVKU = mapa || {}; }

function prvek(kod, nazev, profil, kusy, zdroj, pozn, beh){
  var p=profil||{b:0,h:0};
  /* BĚŽNÉ METRY SE POČÍTAJÍ Z DÉLEK, NA KTERÉ SE OPRAVDU ŘEŽE.
     Dřív se sčítaly přesné délky a teprve součet se zaokrouhlil, zatímco
     kusovník sčítal jednotlivé kusy už zaokrouhlené na centimetry. Na
     dvaceti páscích po 1,477 m se ta dvě čísla rozešla o 6 cm a nikdo
     nevěděl proč (chyceno testem 22. 8. 2026).

     Správně je sčítat to, co se uřízne: 1,477 m nikdo neřeže, uřízne
     1,48 m. Výkaz a kusovník tak vycházejí ze stejných čísel. */
  var kusyR=kusy.map(r2);
  var bm=kusyR.reduce(function(s,d){ return s+d; },0);
  var rz=REZIVO_PRVKU[kod]||{};
  return {
    druh: rz.druh || null,
    kvalita: rz.kvalita || null,
    kod:kod, nazev:nazev,
    b:p.b, h:p.h, profil:p.b+"/"+p.h,
    kusy:kusyR, ks:kusy.length,
    delkaMin: kusy.length? r2(Math.min.apply(null,kusy)) : 0,
    delkaMax: kusy.length? r2(Math.max.apply(null,kusy)) : 0,
    bm: r2(bm),
    m3: r3((p.b/1000)*(p.h/1000)*bm),
    zdroj: zdroj || "model",
    poznamka: pozn || "",
    beh: !!beh
  };
}

/* ══════════════════════════════════════════════════════════════════════
   KROV MANSARDY — STOLICE VE ZLOMU (PENTI 5. 10. 2026, etapa 3a)
   ----------------------------------------------------------------------
   Varianta A (obr. 295): na každé straně pozednice → spodní strmá krokev
   → VAZNICE VE ZLOMU na svislých sloupcích (stojí na stropě, pásky podél
   vaznice) → horní mírná krokev → hřeben (páry, plát ve vrcholu). Ve výšce
   zlomu DVOJITÁ KLEŠTINA přes obě vaznice u každého páru horních krokví.
   Horní krokev delší než 4,5 m → VRCHOLOVÁ VAZNICE pod hřebenem na
   sloupcích, které stojí na kleštinách (rozhodnuto PENTI 5. 10. 2026).
   Jen sedlová mansarda (jeden hřeben mezi štíty); valba se odmítne.

   Výšky se měří jako u středových vaznic: od horní hrany pozednice,
   horní plocha vaznice na její vnější hraně (tam je svislý paťas zářezu).
   Posudky jako prosté nosníky na vodorovném průmětu (krokve), vaznice
   jako spojitý nosník na sloupcích (statikaVaznice).
   ══════════════════════════════════════════════════════════════════════ */
var MANSARDA_VRCHOL_OD_M = 4.5;      // horní krokev delší → vrcholová vaznice
/* ══════════════════════════════════════════════════════════════════════
   TVAR KROKVÍ MANSARDY V PŘÍČNÉM ŘEZU (etapa 3b-2, 5. 10. 2026)
   ----------------------------------------------------------------------
   JEDINÝ zdroj tvaru obou krokví — z něj se berou délky do výkazu,
   3D model, příčný řez i výrobní výkresy, aby se nemohly rozejít.

   Souřadnice levé strany: d vodorovně od vnějšího líce zdi dovnitř,
   z svisle od horní hrany pozednice. Pravá strana je zrcadlo.

   Detail zlomu (PENTI 5. 10. 2026 „Čelem k boku vaznice“):
     · spodní krokev se nahoře uřízne svisle u vnějšího boku vaznice
       ve zlomu a opře se o něj čelem (úhelník / vrut + kleština);
     · horní krokev leží na vaznici, její spodní konec se seřízne šikmo
       do roviny spodní střechy (krytina ve zlomu lícuje).
   Spodní krokev je na pozednici osedlaná jako u ostatních soustav —
   sedlo kolmo ke krokvi (zadané, jinak třetina výšky), proto celá
   krokev leží o sedlo/cos(sklon) níž, než kdyby se pozednice jen
   dotýkala hranou. */
function mansardaTvary(o){
  var A = o.sklonDolni*Math.PI/180, B = o.sklonHorni*Math.PI/180;
  var tA = Math.tan(A), tB = Math.tan(B), cA = Math.cos(A), cB = Math.cos(B), sA = Math.sin(A);
  var X = o.X, odL = o.odLice || 0, hK = o.hK, sedlo = o.sedlo, bV = o.bV, bP = o.bP;
  var polo = o.Sz/2;
  /* spodní a horní líc spodní krokve, spodní líc horní krokve */
  var uL = function(d){ return (d - odL)*tA - sedlo/cA; };
  var tL = function(d){ return uL(d) + hK/cA; };
  var hZL = tL(X);                       // krytina (horní líce) ve zlomu
  var hZ = hZL - hK/cB;                  // spodní líc horní krokve v ose zlomu = horní plocha vaznice
  var uH = function(d){ return hZ + (d - X)*tB; };
  var dV = X - bV/2;                     // vnější bok vaznice ve zlomu
  var dS = X - (hK/cB)/tA;               // kde rovina spodní střechy protne horní plochu vaznice
  var dSeat = Math.min(odL + bP, odL + sedlo/sA);   // konec sedla na pozednici
  var r4 = function(x){ return Math.round(x*10000)/10000; };
  var bod = function(d, z){ return [r4(d), r4(z)]; };

  /* ── SPODNÍ KROKEV (jedna pro každý přesah) ── */
  var dolni = function(pres){
    var T0 = [-pres, tL(-pres)];
    var pb = (o.pata && o.pata(A*180/Math.PI)) || null;      // zhlaví: body [u, z] od horního rohu
    var zhl = (pb && pb.length >= 2) ? pb.map(function(q){ return [T0[0] + q[0], T0[1] + q[1]]; }) : [[T0[0], uL(-pres)], T0];
    var poly = [zhl[0]];
    if(zhl[0][0] < odL - 1e-6){                 // sedlo na pozednici (krokev přes zeď)
      poly.push([odL, uL(odL)], [odL, 0], [dSeat, uL(dSeat) > 0 ? uL(dSeat) : 0]);
    }
    var horniDV = tL(dV);
    poly.push([dV, uL(dV)]);
    if(horniDV <= hZ + 1e-6) poly.push([dV, horniDV]);
    else poly.push([dV, hZ], [Math.max(dS, -pres), hZ]);   // široká vaznice: vršek nad vaznicí vodorovně ustřižen
    for(var i = zhl.length - 1; i >= 1; i--) poly.push(zhl[i]);
    return poly.map(function(q){ return bod(q[0], q[1]); });
  };
  /* ── HORNÍ KROKEV ── */
  var d0 = Math.max(dS, dV);
  var horni = [];
  if(d0 > dS + 1e-6) horni.push([d0, hZ], [d0, Math.min(tL(d0), uH(d0) + hK/cB)]);   // (jen když je vaznice úzká)
  else horni.push([dS, hZ]);
  horni.push([X, hZ]);
  var spojHreben;
  if(o.vrchol){
    var bVv = o.bVv, zT = uH(polo);
    horni.push([polo - bVv/2, uH(polo - bVv/2)], [polo - bVv/2, zT], [polo, zT], [polo, zT + hK/cB]);
    spojHreben = { typ:"vrchol", popis:"osedlaná na vrcholovou vaznici po osu, svislý řez v ose" };
  } else {
    var e = (hK/cB)/(2*tB);             // špička za osou: spodní líc potká horní líc protilehlé krokve
    horni.push([polo + e, uH(polo + e)], [polo, uH(polo) + hK/cB]);
    spojHreben = { typ:"ostrih", popis:"ostřih v hřebeni — řez ve sklonu protilehlé krokve (" + Math.round(2*B*180/Math.PI*10)/10 + "°)",
                   delkaSpojeM: r3((hK)/Math.sin(2*B)) };
  }
  horni.push([X, hZL]);
  if(d0 <= dS + 1e-6) {} else horni.push([d0, Math.min(tL(d0), uH(d0) + hK/cB)]);
  horni = horni.map(function(q){ return bod(q[0], q[1]); });
  /* odstranit zdvojené body */
  var cisti = function(b){ return b.filter(function(q, i){ var p = b[(i - 1 + b.length) % b.length]; return Math.hypot(q[0]-p[0], q[1]-p[1]) > 1e-5; }); };
  var delkaPoOse = function(poly, a){ var c = Math.cos(a), s2 = Math.sin(a), xs = poly.map(function(q){ return q[0]*c + q[1]*s2; });
    return Math.max.apply(null, xs) - Math.min.apply(null, xs); };
  var D0 = cisti(dolni(o.presahy[0])), D1 = cisti(dolni(o.presahy[1])), H = cisti(horni);
  /* ── DVOJITÁ KLEŠTINA VE ZLOMU ── leží na vaznicích (spodní hrana = horní
     plocha vaznice), konce zaříznuté podle střechy: dole od místa, kde
     rovina spodní střechy protne vaznici (dS), nahoře tam, kde střecha
     dosáhne horní hrany kleštiny. Do 5. 10. 2026 přesahovala 300 mm za osu
     vaznice — to by u strmé spodní střechy trčelo střechou ven. */
  var hKl = o.hKl || 0.16, zKt = hZ + hKl, klLevy;
  if(zKt <= hZL + 1e-9) klLevy = [[dS, hZ], [X - (hZL - zKt)/tA, zKt]];
  else klLevy = [[dS, hZ], [X, hZL], [X + (zKt - hZL)/tB, zKt]];
  /* obrys: levý dolní → pravý dolní → nahoru po pravém konci → zpět po levém konci */
  var zrcK = function(q){ return [o.Sz - q[0], q[1]]; };
  var KL = [klLevy[0], zrcK(klLevy[0])].concat(klLevy.slice(1).map(zrcK), klLevy.slice(1).reverse())
    .map(function(q){ return bod(q[0], q[1]); });
  return {
    sedlo:r3(sedlo), dV:r4(dV), dS:r4(dS), X:X, hZ:r4(hZ), hZL:r4(hZL), polo:r4(polo),
    zHreben:r4(uH(polo)),              // spodní líc horní krokve v ose hřebene
    podDolni:bod(dV, uL(dV)), podHorni:bod(X, hZ),   // body na spodním líci (pro otočení do osy krokve)
    dolni:[D0, D1], horni:H, spojHreben:spojHreben,
    delkaDolniM:[r3(delkaPoOse(D0, A)), r3(delkaPoOse(D1, A))], delkaHorniM:r3(delkaPoOse(H, B)),
    klestina:{ obrys:KL, delkaDoleM:r3(o.Sz - 2*dS), delkaNahoreM:r3(o.Sz - 2*klLevy[klLevy.length - 1][0]), z1:r4(hZ), z2:r4(zKt) },
    vrcholPouzit:!!o.vrchol, vstup:o
  };
}

function spocitejMansardu(g, v, S, P, roviny, roztec, presahHreben){
  var upozorneni = [], prvky = [], St = global.PentiStatika;
  var odmitni = function(t){ return { chybnaSoustava:true, prvky:[], upozorneni:[t], soustava:v.soustava, soustavaNazev:S.nazev, nesmyslnyTvar:false, lomena:true }; };
  var L = g.lomena, A = +L.sklonDolni, B = +L.sklonHorni, X = +L.zlomOdZdi;
  var dolni = roviny.filter(function(p){ return p.lom && p.lom.cast === "dolni"; });
  var horni = roviny.filter(function(p){ return p.lom && p.lom.cast === "horni"; });
  var hrebeny = (g.segs||[]).filter(function(sg){ return sg.type === "hreben"; });
  if(dolni.length !== 2 || horni.length !== 2 || hrebeny.length !== 1 || (g.segs||[]).some(function(sg){ return sg.type==="narozi" || sg.type==="uzlabi"; }))
    return odmitni("Krov mansardy zatím umí jen sedlovou mansardu (dvě strany, jeden hřeben mezi štíty). "
      + "U valbové nebo členité mansardy zadejte krov ručním výkazem.");
  var aR = A*Math.PI/180, bR = B*Math.PI/180, tA = Math.tan(aR), tB = Math.tan(bR);
  /* rozpon mezi vnějšími líci zdí: okap obou spodních rovin je o přesah
     dál než zeď — vzdálenost okapových přímek minus oba přesahy */
  var d0 = dolni[0], d1 = dolni[1];
  var vzdOkapu = Math.abs((d1.baze.a[0]-d0.baze.a[0])*d0.baze.nrm[0] + (d1.baze.a[1]-d0.baze.a[1])*d0.baze.nrm[1]);
  var pres0 = d0.lom.zlomOdOkapu - X, pres1 = d1.lom.zlomOdOkapu - X;
  var Sz = vzdOkapu - pres0 - pres1;                       // rozpon zdí (vnější líce)
  var beh = Sz/2 - X;                                       // vodorovně zlom → hřeben
  if(!(beh > 0.3)) return odmitni("Zlom mansardy je moc blízko hřebene — horní část nemá rozpětí.");
  var odLice = n(v.pozedniceOdLiceM) || 0;                  // pozednice od vnějšího líce zdi
  var bP = (P.pozednice.b||140)/1000, hPoz = (P.pozednice.h||160)/1000;
  var bV = (P.stredVaznice.b||160)/1000, hV = (P.stredVaznice.h||220)/1000;
  var hK = (P.krokev.h||180)/1000;
  /* výšky od horní hrany pozednice (spodní líc spodní krokve tam začíná)
     Oprava 5. 10. 2026 (etapa 3b, 3D ukázalo schod ve zlomu): krytina
     musí ve zlomu lícovat, takže se potkávají HORNÍ líce krokví. Strmá
     krokev je „vysoká“ h/cos70° ≈ 0,53 m svisle, mírná jen h/cos30° ≈ 0,21 m
     — horní krokev proto leží o rozdíl výš, než by vyšlo ze spodních líců.
     Vaznice ve zlomu nese horní krokve (horní plocha = spodní líc horní
     krokve v ose zlomu), spodní krokve se o ni opřou z boku. */
  var xV = X - odLice;                                      // osa vaznice od vnějšího líce pozednice (pod zlomem)
  /* Sedlo spodní krokve na pozednici — stejné pravidlo jako u ostatních
     soustav (zadané, jinak třetina výšky; 15 % až polovina výšky). */
  var sedloZad = n(v.vyskaSedlaMm)/1000;
  var sedlo = sedloZad > 0 ? sedloZad : hK/3;
  sedlo = Math.min(Math.max(sedlo, Math.max(0.02, hK*0.15)), hK*0.5);
  var TV = mansardaTvary({ sklonDolni:A, sklonHorni:B, X:X, odLice:odLice, hK:hK, sedlo:sedlo, bV:bV, bP:bP, hKl:(P.klestina.h||160)/1000,
    Sz:Sz, presahy:[pres0, pres1], vrchol:(beh/Math.cos(bR) > MANSARDA_VRCHOL_OD_M), bVv:(P.vaznice.b||160)/1000,
    pata: function(sk){ var VV = global.PentiVyrobni; if(!VV || !VV.pataKrokve) return null;
      var pk = VV.pataKrokve({ sklonDeg:sk, h:P.krokev.h||180, patkaTyp:v.patkaTyp||"svisly_zkraceny", vyskaCelaMm:v.vyskaCelaMm });
      return pk && pk.body; } });
  var hZlomLic = TV.hZL;                                    // horní líc krokví (krytina) ve zlomu
  var hZlom = TV.hZ;                                        // spodní líc horní krokve v ose zlomu
  var hpV = hZlom;                                          // horní plocha vaznice ve zlomu (pod horní krokví)
  var hHreben = hZlom + beh*tB;                             // spodní líc horní krokve v ose hřebene
  var delkaSl = r2(hPoz + hpV - hV);                        // sloupek od stropu (spodek pozednice) pod vaznici
  if(!(delkaSl > 0.3)) return odmitni("Zlom je tak nízko, že se pod vaznici ve zlomu nevejde sloupek — posuňte zlom dál od zdi.");

  /* ── KROKVE ── osy na spodních rovinách, horní roviny mají stejné (páry
     přes zlom) — stejná šířka roviny, stejné u */
  var krokveRovin = {}, kusySpodni = [], kusyHorni = [], roztecSkut = 0;
  dolni.concat(horni).forEach(function(p){
    var pk = polohyKrokviVRovine(p, roztec, null, null, null, null, (v.osyKrokvi||{})[p.cislo] || null);
    if(!pk) return;
    pk.hreben = p.lom.cast === "horni" ? { od:pk.min, do:pk.max } : null;     // páry u hřebene (kleštiny)
    krokveRovin[p.cislo] = pk;
    if(pk.nejdelsiPole > roztecSkut) roztecSkut = pk.nejdelsiPole;
    var dl = krokveVRovine(p, roztec, p.lom.cast === "horni" ? presahHreben : 0, null, null, null, null, null, (v.osyKrokvi||{})[p.cislo] || null);
    (pk.upozorneni||[]).forEach(function(u){ upozorneni.push("Rovina "+p.cislo+": "+u); });
    /* délka kusu z tvaru krokve (mansardaTvary) — stejná jako na výkresu a ve 3D */
    if(p.lom.cast === "dolni"){ var iS = dolni.indexOf(p); dl = dl.map(function(){ return r2(TV.delkaDolniM[iS < 0 ? 0 : iS]); }); }
    else dl = dl.map(function(){ return r2(TV.delkaHorniM); });
    if(p.lom.cast === "dolni") kusySpodni = kusySpodni.concat(dl); else kusyHorni = kusyHorni.concat(dl);
  });
  if(kusySpodni.length) prvky.push(prvek("krokve", "Krokve spodní (strmé, "+r2(A)+"°)", P.krokev, kusySpodni, "model",
    "osedlaná na pozednici (sedlo " + Math.round(sedlo*1000) + " mm), nahoře svisle uříznutá u boku vaznice ve zlomu a opřená čelem; délka podle výrobního výkresu"));
  var popisHorni = function(){ return "leží na vaznici ve zlomu, spodní konec seříznutý do roviny spodní střechy; " + TV.spojHreben.popis + "; délka podle výrobního výkresu"; };
  if(kusyHorni.length) prvky.push(prvek("krokve_horni", "Krokve horní (mírné, "+r2(B)+"°)", P.krokev, kusyHorni, "model", popisHorni()));
  var delkaHorni = beh/Math.cos(bR);

  /* ── POZEDNICE ── jako u ostatních soustav (z obvodové zdi) */
  var pozBehy = behyPozednic(v.zed, v.stitoveHrany, v.stitovePresahy, v.presahStitu, null, v.koncePozednic);
  var pozBm = delkaPozednic(v.zed, v.stitoveHrany, v.stitovePresahy, v.presahStitu, null, v.koncePozednic);
  /* Dělení na kusy (nejvýš 4 m, přeplátování) a kotvy — stejná funkce jako
     u ostatních soustav (oprava 3b-2, 5. 10. 2026: dřív šla pozednice do
     kusovníku a nářezového plánu jako jedna tyč 25 m). Mansarda je
     vaznicová soustava → kotvy po 2 m, pokud nejsou zadané ručně. */
  var roztecKotevM = n(v.roztecKotevPozednice) || 2;
  var pozedniceDily = pozBm > 0 ? dilyPozednic(pozBehy, P.pozednice, n(v.maxKusPozedniceM) || VYCHOZI.maxKusPozedniceM, roztecKotevM) : null;
  var rohyPoz = rohyPozednic(v.zed, v.stitoveHrany, P.pozednice);
  if(pozBm > 0){
    var pozPozn = "obvodová nosná zeď pod okapem + vytažení za štít";
    var pozKusy = [r2(pozBm)];
    if(pozedniceDily && pozedniceDily.naviceBm > 0.001){
      /* do nabídky objednací délka (celé metry z pily), jako u ostatních soustav */
      pozKusy = [pozedniceDily.rezivoBm]; pozBm = pozedniceDily.rezivoBm;
      pozPozn += "; zeď " + pozedniceDily.cistaBm + " m + " + pozedniceDily.spoju
        + "× přeplátování jednoduchým plátem na ½ výšky (v plátu 2 kotvy, bez svorníků) " + pozedniceDily.platMm
        + " mm = " + pozedniceDily.cisteSPlatyBm + " m dřeva; objednat "
        + (pozedniceDily.objednacky||[]).map(function(o){ return o.kusu + "× " + o.delkaM + " m"; }).join(", ")
        + " = " + pozedniceDily.rezivoBm + " m" + (pozedniceDily.odpadBm > 0.001 ? " (odřez " + pozedniceDily.odpadBm + " m)" : "");
    }
    if(rohyPoz) pozPozn += "; " + rohyPoz.pocet + "× roh: rohový plát " + rohyPoz.platMm + " mm na ½ výšky (" + rohyPoz.hloubkaMm + " mm), 1 kotva do věnce skrz oba pláty";
    prvky.push(prvek("pozednice", "Pozednice", P.pozednice, pozKusy, "model", pozPozn, true));
  }

  /* ── VAZNICE VE ZLOMU + SLOUPKY + PÁSKY ── */
  var roztSl = n(v.roztecSloupkuStred) || n(v.roztecSloupku) || VYCHOZI.roztecSloupku;
  var presahStitu = (v.presahStitu != null) ? n(v.presahStitu) : 0;
  var podporyVaznic = [], kusyVaz = [], pocetSl = 0, poleMax = 0;
  dolni.forEach(function(p){
    var rings = p.tvarRings || [p.tvar];
    var dl = r2(sirkaVeVysce(rings, p.lom.zlomOdOkapu/Math.cos(aR) - 0.01));
    if(!(dl > 0.3)) return;
    /* sloupky na štítových zdech, ne v přesahu (jako u středových vaznic) */
    var stit = [{ u:r3(Math.min(presahStitu, dl/2)), nese:false }, { u:r3(Math.max(dl-presahStitu, dl/2)), nese:false }];   // r3: jinak 11,9999 m dá o pole méně
    var podp = podporyVaznice(dl, roztSl, null, null, stit, (v.sloupkyRucne||{})["stred:"+p.cislo] || null);
    if(!podp) return;
    kusyVaz.push(dl); pocetSl += podp.pocetSloupku;
    (podp.pole||[]).forEach(function(x){ if(x > poleMax) poleMax = x; });
    podporyVaznic.push(Object.assign({ kod:"vaznice_stred", nazev:"Vaznice ve zlomu (rovina "+p.cislo+")", profil:P.stredVaznice, rovina:p.cislo,
      statika: statikaVaznice(podp, P.stredVaznice, n(v.maxDelkaKusu)||13, v.modelVaznice==="prosty") }, podp));
  });
  /* Dělení vaznice (přepínač „dělit vaznice“, prosté nosníky, kus delší než
     nejdelší dodávaný) mansarda zatím neumí — aspoň to řekne nahlas. */
  var maxKusV = n(v.maxDelkaKusu) || 13;
  if(kusyVaz.some(function(d){ return d > maxKusV; }) || ((v.deleniVaznic || v.modelVaznice === "prosty") && kusyVaz.length))
    upozorneni.push("Vaznice ve zlomu (" + Math.max.apply(null, kusyVaz) + " m): dělení vaznice na kusy pro mansardu zatím není — výkaz počítá vaznici jako jeden kus"
      + (kusyVaz.some(function(d){ return d > maxKusV; }) ? ", ale je delší než " + maxKusV + " m. Spoj a plát doplňte ručně." : "."));
  if(kusyVaz.length) prvky.push(prvek("vaznice_stred", "Vaznice ve zlomu", P.stredVaznice, kusyVaz, "model",
    "pod zlomem, "+r2(X)+" m od líce zdi; horní plocha "+r2(hpV)+" m nad pozednicí; nese horní krokve, spodní se o ni opírají z boku", true));
  if(pocetSl > 0) prvky.push(oznacCepSloupku(prvek("sloupky_stred", "Sloupky stolice ve zlomu", P.sloupek,
    sloupkySCepem(nKusu(pocetSl, delkaSl), P.sloupek), "model", "svislé, stojí na stropě pod vaznicí ve zlomu"), P.sloupek));
  var paskyZap = v.pasky !== false;
  var delkaPasku = n(v.pasekDelka) || 1.0;
  var Ppasek = P.pasek || P.sloupek;
  if(paskyZap && pocetSl > 0){
    var pkS = pasky("pasky_stred", "Pásky u sloupků stolice", pocetSl, 0, delkaPasku, Ppasek, delkaSl, upozorneni,
      P.stredVaznice, P.sloupek, 2*podporyVaznic.length, null);       // krajní sloupek u štítu: pásek jen dovnitř
    if(pkS) prvky.push(pkS);
  }

  /* ── DVOJITÁ KLEŠTINA VE ZLOMU ── u každého páru horních krokví 2 kusy */
  var parKrokvi = Math.min.apply(null, horni.map(function(p){ return krokveRovin[p.cislo] ? krokveRovin[p.cislo].osy.length : 0; }));
  /* délka u spodní hrany z tvaru (mansardaTvary) — konce zaříznuté podle spodní střechy */
  var delkaKl = r2(TV.klestina.delkaDoleM);
  if(parKrokvi > 0) prvky.push(prvek("klestiny", "Kleštiny ve zlomu (dvojité)", P.klestina, nKusu(2*parKrokvi, delkaKl), "model",
    "u každého páru horních krokví 2 kusy (z obou stran), leží na obou vaznicích ve zlomu, konce zaříznuté ve sklonu spodní střechy"));

  /* ── VRCHOLOVÁ VAZNICE (horní krokev > 4,5 m) ── sloupky stojí na kleštinách */
  var vrchol = null;
  if(delkaHorni > MANSARDA_VRCHOL_OD_M){
    var hreb = hrebeny[0], dlH = r2(Math.hypot(hreb.B[0]-hreb.A[0], hreb.B[1]-hreb.A[1]));
    var hVv = (P.vaznice.h||200)/1000;
    var slV = r2(hHreben - hVv - (hZlom + (P.klestina.h||160)/1000));   // od horní hrany kleštin pod vaznici (její horní plocha = spodní líc krokví v hřebeni)
    var podpV = podporyVaznice(dlH, roztSl, null, null, [{ u:r3(Math.min(presahStitu, dlH/2)), nese:false }, { u:r3(Math.max(dlH-presahStitu, dlH/2)), nese:false }], (v.sloupkyRucne||{}).vrchol || null);
    if(podpV && slV > 0.2){
      vrchol = { delka:dlH, sloupku:podpV.pocetSloupku, delkaSloupku:slV };
      prvky.push(prvek("vaznice_vrchol", "Vrcholová vaznice", P.vaznice, [dlH], "model",
        "pod hřebenem — horní krokev " + r2(delkaHorni) + " m je delší než " + MANSARDA_VRCHOL_OD_M + " m", true));
      prvky.push(oznacCepSloupku(prvek("sloupky_vrchol", "Sloupky pod vrcholovou vaznicí (na kleštinách)", P.sloupek,
        sloupkySCepem(nKusu(podpV.pocetSloupku, slV), P.sloupek), "model", "stojí na dvojité kleštině ve zlomu"), P.sloupek));
      podporyVaznic.push(Object.assign({ kod:"vaznice_vrchol", nazev:"Vrcholová vaznice", profil:P.vaznice,
        statika: statikaVaznice(podpV, P.vaznice, n(v.maxDelkaKusu)||13, v.modelVaznice==="prosty") }, podpV));
      (podpV.pole||[]).forEach(function(x){ if(x > (vrchol.poleMax||0)) vrchol.poleMax = x; });
    } else upozorneni.push("Horní krokev je " + r2(delkaHorni) + " m — vrcholová vaznice se pod hřeben nevejde (málo místa nad kleštinami). Posuďte krokev zvlášť.");
  }

  /* Vrcholová vaznice nakonec není (nevešla se) nebo je navíc → tvar horní krokve v hřebeni přepočítat */
  if(!!vrchol !== !!TV.vrcholPouzit){
    TV = mansardaTvary(Object.assign({}, TV.vstup, { vrchol:!!vrchol }));
    prvky.forEach(function(q, i){ if(q.kod === "krokve_horni")
      prvky[i] = prvek("krokve_horni", q.nazev, P.krokev, q.kusy.map(function(){ return r2(TV.delkaHorniM); }), "model", popisHorni()); });
  }

  /* ── STATIKA ── */
  var radky = [], vazniceStat = [], zatOpt = { roztecKrokvi:roztecSkut || roztec, profilKrokve:P.krokev,
    snehOblast:n(v.snehOblast)||2, vitrOblast:n(v.vitrOblast)||2, teren:v.teren||"III",
    hmotnostKrytinyKgM2:(v.hmotnostKrytinyKgM2!=null) ? n(v.hmotnostKrytinyKgM2) : 45, podhledKNm2:n(v.podhledKNm2)||0 };
  var ZA = zatizeniKrovu(Object.assign({ sklonDeg:A }, zatOpt)), ZB = zatizeniKrovu(Object.assign({ sklonDeg:B }, zatOpt));
  var trida = v.trida || "C24";
  var kmod = (ZB && ZB.kmod != null) ? ZB.kmod : 0.8;
  var pojmenuj = function(rr, kod, pre){ return rr.map(function(r){ r.prvek = kod; r.nazev = pre + r.nazev.replace(/^Krokev/, ""); return r; }); };
  if(St && ZA && ZB){
    var rk = roztecSkut || roztec;
    radky = radky.concat(pojmenuj(St.posudekKrokve({ profil:P.krokev, delkaM:(xV)/Math.cos(aR), vodorovnyPrumet:xV, wh:ZA.qUlsPresne*rk, whSls:ZA.qSlsPresne*rk, sklonDeg:A, trida:trida, kmod:kmod }), "krokve", "Spodní krokev"));
    var LhH = vrchol ? beh : beh;          // vrcholová vaznice podpírá hřeben — pole horní krokve zůstává zlom → hřeben
    radky = radky.concat(pojmenuj(St.posudekKrokve({ profil:P.krokev, delkaM:LhH/Math.cos(bR), vodorovnyPrumet:LhH, wh:ZB.qUlsPresne*rk, whSls:ZB.qSlsPresne*rk, sklonDeg:B, trida:trida, kmod:kmod }), "krokve_horni", "Horní krokev"));
    /* vaznice ve zlomu: polovina spodního a polovina horního běhu (bez vrcholové vaznice celá horní část visí na zlomu přes páry) */
    var sirkaZ = xV/2 + (vrchol ? beh/2 : beh/2);
    var wp = ZA.qUlsPresne*xV/2 + ZB.qUlsPresne*(vrchol ? beh/2 : beh/2), wpS = ZA.qSlsPresne*xV/2 + ZB.qSlsPresne*beh/2;
    var gV = bV*hV*5;
    var pv = podporyVaznic.filter(function(q){ return q.kod === "vaznice_stred"; })[0];
    if(pv && poleMax > 0){
      var stv = pv.statika || {};
      radky = radky.concat(St.posudekVaznice({ profil:P.stredVaznice, rozpetiM:poleMax, wp:wp + 1.35*gV, wpSls:wpS + gV,
        soucinitelM:stv.soucinitelM, soucinitelW:stv.soucinitelW,
        soucinitelV:(stv.nosnik && stv.nosnik.Vmax && poleMax > 0) ? stv.nosnik.Vmax/poleMax : null,
        dlabMm:(function(){ try{ return cepSpoje((P.sloupek && P.sloupek.b) || 140, "sloupek").dlabHloubkaMm || 0; }catch(e){ return 0; } })(),
        trida:trida, kmod:kmod }).map(function(r){ r.prvek = "vaznice_stred"; r.nazev = r.nazev.replace(/^Vaznice/, "Vaznice ve zlomu"); return r; }));
      vazniceStat.push({ nazev:"Vaznice ve zlomu", sirkaM:r3(sirkaZ), wp:r3(wp + 1.35*gV), rozpetiM:r3(poleMax), reakceKN:r2(REAKCE_SPOJITEHO*(wp + 1.35*gV)*poleMax), kod:"vaznice_stred" });
      radky = radky.concat(St.posudekSloupku({ profil:P.sloupek, N:REAKCE_SPOJITEHO*(wp + 1.35*gV)*poleMax, vzpernaDelkaM:delkaSl, trida:trida, kmod:kmod })
        .map(function(r){ r.prvek = "sloupky_stred"; r.nazev = r.nazev.replace(/^Sloupek/, "Sloupek stolice"); return r; }));
    }
    if(vrchol && vrchol.poleMax){
      var wpV = ZB.qUlsPresne*beh, wpVS = ZB.qSlsPresne*beh, gVv = (P.vaznice.b||160)/1000*(P.vaznice.h||200)/1000*5;
      var pvv = podporyVaznic.filter(function(q){ return q.kod === "vaznice_vrchol"; })[0], svv = (pvv && pvv.statika) || {};
      vazniceStat.push({ nazev:"Vrcholová vaznice", sirkaM:r3(beh), wp:r3(wpV + 1.35*gVv), rozpetiM:r3(vrchol.poleMax), reakceKN:r2(REAKCE_SPOJITEHO*(wpV + 1.35*gVv)*vrchol.poleMax), kod:"vaznice_vrchol" });
      radky = radky.concat(St.posudekVaznice({ profil:P.vaznice, rozpetiM:vrchol.poleMax, wp:wpV + 1.35*gVv, wpSls:wpVS + gVv,
        soucinitelM:svv.soucinitelM, soucinitelW:svv.soucinitelW,
        soucinitelV:(svv.nosnik && svv.nosnik.Vmax && vrchol.poleMax > 0) ? svv.nosnik.Vmax/vrchol.poleMax : null,
        dlabMm:(function(){ try{ return cepSpoje((P.sloupek && P.sloupek.b) || 140, "sloupek").dlabHloubkaMm || 0; }catch(e){ return 0; } })(),
        trida:trida, kmod:kmod }).map(function(r){ r.prvek = "vaznice_vrchol"; r.nazev = r.nazev.replace(/^Vaznice/, "Vrcholová vaznice"); return r; }));
    }
  } else upozorneni.push("Statika mansardy se nespočítala (chybí modul statiky).");
  var nevyhovi = radky.filter(function(r){ return !r.vyhovuje; });
  if(nevyhovi.length) upozorneni.push("Mansarda — nevyhovuje: " + nevyhovi.map(function(r){ return r.nazev + " (" + Math.round(r.vyuziti*100) + " %)"; }).join(", ") + ". Zvětšete profil.");
  if(A > 60) upozorneni.push("Spodní část " + r2(A) + "° — krokve osedlejte na pozednici a kotvěte proti posunu (strmá krokev tlačí do zlomu).");
  upozorneni.push("Krov mansardy: výkaz, cena, posudky, řez, 3D, IFC, výrobní výkresy a nářezový plán jsou hotové. Tiskové listy vizualizace pro mansardu zatím nejsou (etapa 3b).");

  var bm = 0, m3 = 0, ks = 0;
  prvky.forEach(function(q){ bm += q.bm; m3 += q.m3; ks += q.ks; });
  var vsech = kusySpodni.concat(kusyHorni);
  return {
    soustava: "mansarda", soustavaNazev: S.nazev, prvky: prvky, rovin: roviny.length,
    vyskaStrechy: r2(hHreben), sklonHlavni: r2(A), krokvi: vsech.length,
    roztecKrokviZadana: r3(roztec), roztecKrokviSkutecna: r3(roztecSkut || roztec),
    krokveRovin: krokveRovin, krokviPosunuto: 0,
    krokevMin: vsech.length ? r2(Math.min.apply(null, vsech)) : 0, krokevMax: vsech.length ? r2(Math.max.apply(null, vsech)) : 0,
    pozedniceBm: pozBm, pozedniceBehy: pozBehy, pozedniceDily: pozedniceDily, rohyPozednic: rohyPoz, podporyVaznic: podporyVaznic,
    statika: { radky: radky, souhrn: (St && St.souhrn) ? St.souhrn(radky) : null, zatizeni: ZB, zatizeniSpodni: ZA,
               krokev: { roztec: r3(roztecSkut || roztec) }, vaznice: vazniceStat },
    bmCelkem: r2(bm), m3Cista: r3(m3), kusuCelkem: ks, nesmyslnyTvar: false,
    upozorneni: upozorneni,
    /* popis řezu mansardy pro výkres (2D řez a půdorys) */
    mansarda: { sklonDolni:A, sklonHorni:B, zlomOdZdi:X, rozponZdiM:r3(Sz),
                pozedniceNahoreM:r3(n(v.nadezdivkaM) + hPoz),        // horní hrana pozednice nad ±0 (pro 3D)
                presahStituM:r3(presahStitu), behHorniM:r3(beh), odLiceM:r3(odLice),
                presahy:[r3(pres0), r3(pres1)], vyskaZlomuM:r3(hZlom), vyskaZlomuLicM:r3(hZlomLic), sedloM:r3(sedlo), tvary:TV, vyskaHrebeneM:r3(hHreben), hornaPlochaVazniceM:r3(hpV),
                delkaSloupkuM:delkaSl, delkaKlestinyM:delkaKl, delkaHorniKrokveM:r2(delkaHorni), vrchol:vrchol,
                profily:{ krokev:P.krokev, pozednice:P.pozednice, vaznice:P.stredVaznice, vrchol:P.vaznice, sloupek:P.sloupek, klestina:P.klestina } },
    rez: { mansarda:true, profily:P, sklonDeg:r2(A), rozponZdiM:r3(Sz), pozedniceOdLice:r3(odLice),
           vysky:{ pozedniceNahore:r3(n(v.nadezdivkaM) + hPoz) }, osedlani:{ sedlo:r3(sedlo) } }      // 3D stavby: střešní plochy ve stejné výšce jako krokve
  };
}

/* ==========================================================================
   HLAVNÍ VÝPOČET
   geom   — výstup PentiEngine.geometrieStrechy
   vstupy — soustava, rozteče, výšky, profily, obvodová zeď
   ========================================================================== */
function spocitej(geom, vstupy){
  /* Druh a kvalita řeziva po prvcích — musí se nastavit dřív, než se
     začnou skládat prvky (PENTI 21. 8. 2026). */
  nastavRezivoPrvku(vstupy && vstupy.rezivoPrvku);
  var g=geom||{}, v=vstupy||{};
  /* styky vaznice nad zvolenými podporami (2026.10.191): jen při volbě
     „styky podle zadání"; klíč jako u ručních sloupků ("vrchol", "stred:N") */
  var stykyVaznice = function(klic){
    if(v.modelVaznice !== "styky") return null;
    var s0 = (v.stykyVaznic || {})[klic];
    return (Array.isArray(s0) && s0.length) ? s0 : null;
  };
  var S=SOUSTAVY[v.soustava] || SOUSTAVY.vrcholova;
  var P=Object.assign({}, VYCHOZI.profily, v.profily||{});
  /* typ spoje vaznice pro hledání místa spoje (2026.10.200) — statikaVaznice
     z toho spočítá ½ plátu, o kterou kus přesahuje osu spoje */
  SPOJ_PRO_DELENI = { nulovy: v.spojNulovy === "rovny" ? "rovny" : "hakovy",
                      nad: v.spojNadPodporou === "sraz" ? "sraz" : "plat",
                      sloupekB: (P.sloupek && P.sloupek.b) || 140, sloupekH: (P.sloupek && P.sloupek.h) || 140 };
  /* ── OCELOVÉ VAZNICE (PENTI 2. 10. 2026, etapa 2) ─────────────────────
     `v.ocelVaznice` = { vrchol:"IPE"|"U"|"HEB"|"", stred:…, profilVrchol,
     profilStred (prázdné = navrhne se), jekl (prázdné = navrhne se),
     hranolBMm, hranolHMm }. Vaznice je ocelová, na horní pásnici je
     přišroubovaný dřevěný HRANOL a krokve se osedlávají na něj — přesně
     jako na dřevěnou vaznici. Pro geometrii se proto vaznice chová jako
     „podpora" široká jako hranol a vysoká hranol + ocelový profil; výšku
     profilu doplní návrh, jakmile se znají pole a zatížení. Sloupky jsou
     z jeklu, pásky z menšího jeklu. Bez volby se nic nemění. */
  var OCEL = global.PentiOcel;
  var ocelV = v.ocelVaznice || {};
  var hranolB = n(ocelV.hranolBMm) || 120, hranolH = n(ocelV.hranolHMm) || 80;      // mm
  var radaOceli = function(x){ return (x === "IPE" || x === "U" || x === "HEB") ? x : ""; };
  /* jen u soustav, kde ta vaznice opravdu je (věšadlo a pult ne) */
  var ocelVrchol = (S.vrchol && !S.vesadlo && !S.pult) ? radaOceli(ocelV.vrchol) : "";
  var ocelStred = (S.stred && !S.pult) ? radaOceli(ocelV.stred) : "";
  var ocelUpozorneni = [];
  if((ocelVrchol || ocelStred) && !OCEL){
    ocelUpozorneni.push("Chybí modul penti-ocel.js — ocelové vaznice se nedají spočítat, počítá se dřevo.");
    ocelVrchol = ocelStred = "";
  }
  /* ── SLOUPKY Z JEKLU POD DŘEVĚNOU VAZNICÍ (PENTI 3. 10. 2026) ─────────
     „Ocelové sloupky s dřevěnými vaznicemi kombinovat lze." Volba
     podpory „jekl": vaznice zůstává dřevěná (řezivo, posudek dřeva),
     jen sloupky jsou z jeklu a pásky z jeklu 60×60×3. Hlava sloupku je
     U-třmen se svorníky skrz vaznici (posudekHlavyDrevo v penti-ocel.js).
     Ocelová vaznice má jekl vždy — tam se volba nepoužije. */
  var jeklVrchol = !!(S.vrchol && !S.vesadlo && !S.pult && !ocelVrchol && v.podporaVrcholove === "jekl" && OCEL);
  var jeklStred  = !!(S.stred && !S.pult && !ocelStred && v.podporaStredovych === "jekl" && OCEL);
  if(!OCEL && (v.podporaVrcholove === "jekl" || v.podporaStredovych === "jekl"))
    ocelUpozorneni.push("Chybí modul penti-ocel.js — sloupky z jeklu se nedají spočítat, počítají se dřevěné.");
  /* výška se doplní návrhem (zatím 200 mm profilu, aby šlo počítat dál) */
  if(ocelVrchol) P.vaznice = { b:hranolB, h:hranolH + 200, ocel:true };
  if(ocelStred)  P.stredVaznice = { b:hranolB, h:hranolH + 200, ocel:true };
  /* Výsledky oceli: vaznice, sloupky, pásky, paty a hlavy — samostatně,
     mimo dřevěný výkaz (do řeziva a kubatury nepatří). */
  var ocel = (ocelVrchol || ocelStred || jeklVrchol || jeklStred) ? { vaznice:[], sloupky:[], pasky:[], posudky:[], upozorneni:ocelUpozorneni,
                                           hranol:{ b:hranolB, h:hranolH } } : null;
  var roztec = n(v.roztecKrokvi) || VYCHOZI.roztecKrokvi;
  var presahOkap = (v.presahOkap!=null) ? n(v.presahOkap) : VYCHOZI.presahOkap;
  var presahHreben = (v.presahHreben!=null) ? n(v.presahHreben) : VYCHOZI.presahHreben;

  var roviny = (g.planes||[]).filter(function(p){ return (p.sikma||0) > 0.05; });
  if(!roviny.length) return null;

  /* ── PULTOVÁ STŘECHA SE POČÍTÁ JINAK ───────────────────────────────────
     Má jednu rovinu a dvě pozednice v různé výšce — nemá hřeben, kleštiny
     ani vrcholovou vaznici. Původní kalkulačka na to nebrala ohled a
     počítala pultovou střechu jako sedlovou s rozponem vzatým z kratší
     strany půdorysu; výsledek byl nesmysl, který se tvářil jako platný. */
  var jePult = (g.roof === "pultova");
  var lipnuti = (v.lipnutiNarozi === "k_mitlaku") ? "k_mitlaku" : "k_sobe";
  if(jePult && !S.pult){
    return { chybnaSoustava:true, prvky:[], upozorneni:[
      "Pultová střecha potřebuje pultový krov. Vyber „krokev bez vaznice\" nebo „krokev s vaznicí\"."],
      soustava:v.soustava, soustavaNazev:S.nazev, nesmyslnyTvar:false };
  }
  if(!jePult && S.pult){
    return { chybnaSoustava:true, prvky:[], upozorneni:[
      "Pultový krov jde použít jen na pultovou střechu. U této střechy vyber některou z vaznicových soustav."],
      soustava:v.soustava, soustavaNazev:S.nazev, nesmyslnyTvar:false };
  }
  if(jePult && S.vesadlo){
    return { chybnaSoustava:true, prvky:[], upozorneni:[
      "Věšadlo je vazba pro sedlovou střechu — na pultovou se nehodí. Vyber některý z pultových krovů."],
      soustava:v.soustava, soustavaNazev:S.nazev, nesmyslnyTvar:false };
  }
  /* LOMENÁ SEDLOVÁ (od 13. 9. 2026): krokev má ve zlomu koleno a vaznici,
     tenhle modul počítá jen s přímou krokví od pozednice k hřebeni. Kdyby
     se to pustilo dál, vzalo by si „dvě nejdelší roviny" (obě spodní
     mírné) a vyšel by rozpon o polovinu menší, než je dům široký —
     a nikdo by to nepoznal. Radši odmítnout a říct proč. */
  if(g.lomena && g.lomena.typ==="mansard" && S.mansarda)
    return spocitejMansardu(g, v, S, P, roviny, roztec, presahHreben);
  if(S.mansarda && !g.lomena){
    return { chybnaSoustava:true, prvky:[], upozorneni:[
      "Krov „Mansardová — stolice ve zlomu“ jde jen na mansardovou střechu. U této střechy vyberte jinou soustavu."],
      soustava:v.soustava, soustavaNazev:S.nazev, nesmyslnyTvar:false };
  }
  if(g.lomena){
    return { chybnaSoustava:true, prvky:[], upozorneni:[
      (g.lomena.typ==="mansard" ? "Mansardová střecha" : "Lomená sedlová střecha")
      + ": krov s krokví lomenou ve zlomu kalkulačka zatím nespočítá"
      + (g.lomena.typ==="mansard" ? " v této soustavě — vyberte soustavu „Mansardová — stolice ve zlomu“, nebo " : ". ")
      + "Zadejte krov ručním výkazem (přepínač Ruční výkaz v kroku Krov)."],
      soustava:v.soustava, soustavaNazev:S.nazev, nesmyslnyTvar:false, lomena:true };
  }

  /* ── DVĚ STRANY PŘÍČNÉHO ŘEZU ──────────────────────────────────────────
     Střecha nemusí být souměrná. Když má každá rovina jiný sklon nebo jiný
     přesah, posune se hřeben k té strmější a obě strany mají jiný vodorovný
     průmět. Dřív se počítalo se dvěma stejnými polovinami podle nejdelší
     krokve — na střeše 25° a 45° z toho vyšel rozpon o čtyři metry větší,
     než jak je dům široký (upřesněno PENTI 14. 8. 2026).

     Řez se proto skládá ze DVOU STRAN. U sedlové střechy jsou to obě
     spádové roviny, u valby dvě hlavní; berou se dvě nejdelší. */
  var serazene = roviny.slice().sort(function(x,y){
    return (y.delka_spad||0) - (x.delka_spad||0);
  });
  /* Přesah okapu může být na každé rovině jiný. Když se pro rovinu zadá
     vlastní, použije se; jinak platí společný. Bez toho by se v řezu
     kreslil na obou stranách stejný, i když v půdorysu jsou různé. */
  var presahRoviny = function(p){
    var m = v.presahyRovin || {};
    var vl = m[p.cislo];
    return (vl!=null && vl>=0) ? n(vl) : presahOkap;
  };
  var strana = function(p){
    var sk = (p.sklon||0) * Math.PI/180;
    return { rovina:p, sklonDeg:r2(p.sklon||0), sklonRad:sk,
             presah: r3(presahRoviny(p)),
             spad: p.delka_spad||0,                       // délka po spádu
             beh:  r3((p.delka_spad||0)*Math.cos(sk)),     // vodorovný průmět
             vyska:r3((p.delka_spad||0)*Math.sin(sk)) };   // výška nad okapem
  };
  var levá  = strana(serazene[0]);
  /* Když je rovina jediná (pultová střecha, nebo špatně zvolené štíty),
     druhá strana je nulová — rozpon je pak jen ta jedna. Kdyby se místo ní
     vzala kopie první, rozpon by vyšel dvojnásobný. */
  var jenJednaRovina = !serazene[1];
  var pravá = serazene[1] ? strana(serazene[1])
            : { rovina:levá.rovina, sklonDeg:levá.sklonDeg, sklonRad:levá.sklonRad,
                presah:levá.presah, spad:0, beh:0, vyska:0 };
  /* ── HŘEBEN SE POČÍTÁ ZE ZDÍ ────────────────────────────────────────────
     Jádro staví tvar střechy z obrysu VČETNĚ přesahů, takže by hřeben vyšel
     doprostřed obrysu. Skutečnost je jiná: krokve leží na pozednicích a
     přesah je jen jejich prodloužení dolů — hřeben se posouvat nemá.
     Šířka domu (součet obou běhů ke zdi) z jádra vychází správně, špatné
     bylo jen rozdělení mezi levou a pravou stranu. Rozdělí se podle sklonů
     z podmínky, že obě krokve musí dosáhnout stejné výšky:
         xL · tg(sklonL) = (šířka − xL) · tg(sklonP)
     (rozhodnuto PENTI 14. 8. 2026 — model „ze zdí“.) */
  var sirkaDomu = r3(Math.max(0.2,
        (levá.beh - levá.presah) + (jenJednaRovina ? 0 : (pravá.beh - pravá.presah))));
  var zeZdi = function(st, behZdi){
    st.behZdi = r3(Math.max(0.05, behZdi));
    st.vyska  = r3(st.behZdi * Math.tan(st.sklonRad));      // hřeben nad POZEDNICÍ
    st.beh    = r3(st.behZdi + st.presah);                  // vodorovně i s přesahem
    st.spad   = r3(st.beh / Math.cos(st.sklonRad));         // celá krokev i s přesahem
  };
  if(jenJednaRovina){
    /* Pultová střecha má přesah nahoře i dole a řeší si rozpon po svém
       (rozponZdiPult). Rozdělovat tu není co, tak se nic nepřepočítává —
       jen se doplní běh ke zdi. */
    levá.behZdi = r3(Math.max(0.05, levá.beh - levá.presah));
  } else {
    var tgL = Math.tan(levá.sklonRad), tgP = Math.tan(pravá.sklonRad);
    var xL = (tgL > 1e-6 && tgP > 1e-6) ? (sirkaDomu * tgP / (tgL + tgP)) : (sirkaDomu/2);
    zeZdi(levá,  xL);
    zeZdi(pravá, sirkaDomu - xL);
  }

  var strany = [levá, pravá];
  var nesoumerná = !jenJednaRovina
                && (Math.abs(levá.sklonDeg - pravá.sklonDeg) > 0.5
                 || Math.abs(levá.beh - pravá.beh) > 0.02
                 || Math.abs(levá.presah - pravá.presah) > 0.005);

  var maxSpad = Math.max(levá.spad, pravá.spad);
  var sklonHlavni = levá.sklonDeg;
  var a = levá.sklonRad;
  /* Obě strany musí dosáhnout stejné výšky — hřeben je jeden. Když se
     rozejdou o víc než pár centimetrů, něco v zadání nesedí. */
  var vyskaStrechy = r2(Math.max(levá.vyska, pravá.vyska));

  var prvky=[], upozorneni=[], nesmysl=false, vesadloGeo=null, naroznikGeo=null, vesadloPrepocet=null;
  /* Profil zadaný v centimetrech („20/28" místo „200/280") projde
     zadáním, ale výpočet s ním dává nesmysly — 22. 9. 2026 na tom spadl
     posudek spoje. Radši to říct nahlas hned u výkazu. */
  Object.keys(P).forEach(function(k){
    var pr = P[k];
    if(pr && ((n(pr.b) > 0 && n(pr.b) < 40) || (n(pr.h) > 0 && n(pr.h) < 40)))
      upozorneni.push("Profil „" + k + "“ " + pr.b + "/" + pr.h + " mm je podezřele malý — zadáváte v milimetrech? (20/28 cm = 200/280 mm)");
  });
  /* PODPORY VAZNIC V PŮDORYSU — kde stojí sloupky po délce každé vaznice.
     Z toho se počítá spojitý nosník a poloha spoje při dělení. */
  var podporyVaznic = [];
  /* Pásek se dělá zpravidla ze stejného profilu jako sloupek. Vlastní
     profil se použije, jen když se opravdu zadá. */
  var Ppasek = (v.profily && v.profily.pasek) ? P.pasek : P.sloupek;
  /* PÁSKY SE DAJÍ VYPNOUT (zadání PENTI 16. 8. 2026).
     Vypnutý pásek = nulová délka. Funkce pasky() nic nevrátí, prvek se
     nedostane do výkazu ani do výkresu a nikde se nemusí nic dalšího
     hlídat. Statika se tím nemění — posudek vaznice s pomocí pásků
     stejně nepočítá, je tedy na bezpečné straně. Krov ale bez nich není
     zavětrovaný do stran, a to se musí říct nahlas (viz upozornění níže). */
  var paskyZap = (v.pasky !== false);
  var delkaPasku = paskyZap ? (n(v.pasekDelka) || VYCHOZI.pasekDelka) : 0;
  var stitu = (v.stitoveHrany && v.stitoveHrany.length) || 0;

  /* ── KONTROLA, JESTLI JE STŘECHA VŮBEC MOŽNÁ ─────────────────────────────
     Plocha střechy musí odpovídat půdorysu přepočtenému na sklon. Když se to
     rozchází, roviny se překrývají a hřeben vyjde absurdně vysoko — typicky
     po špatné volbě štítů. Krokve by pak vyšly třeba dvacetimetrové a nikdo
     by si toho v nabídce nevšiml.
     Radši to řekneme nahlas, než abychom vydali nesmyslný výkaz. */
  /* Očekávaná plocha se počítá PO ROVINÁCH: každá rovina má svůj sklon,
     takže se její půdorysná část dělí vlastním kosinem. Dřív se použil
     jeden společný sklon a na nesouměrné střeše z toho vyšel planý poplach
     — poměr 1,09 a hláška, že výkaz je nepoužitelný, i když byl v pořádku. */
  if(g.area>0){
    var ocekavana = 0, lzeSpocitat = true;
    roviny.forEach(function(p){
      var cs2 = Math.cos((p.sklon||0)*Math.PI/180);
      if(!(cs2>0.01) || !(p.pudorysna>0)){ lzeSpocitat=false; return; }
      ocekavana += p.pudorysna/cs2;
    });
    if(lzeSpocitat && ocekavana>0){
      var pomer = (g.roofArea||0)/ocekavana;
      if(Math.abs(pomer-1) > 0.02){
        nesmysl = true;
        upozorneni.push("Tvar střechy nedává smysl: plocha "+r2(g.roofArea)+" m² neodpovídá "
          +"součtu rovin přepočtenému na jejich sklony ("+r2(ocekavana)+" m², poměr "
          +pomer.toFixed(2)+"). Nejdelší krokev by vyšla "+r2(maxSpad)+" m a hřeben "
          +vyskaStrechy+" m nad pozednicí. Nejspíš jsou špatně zvolené štíty — "
          +"zkontroluj je, výkaz krovu je zatím nepoužitelný.");
      }
    }
  }

  /* ══════════════════════════════════════════════════════════════════════
     PŘESAH KROKVE ZA HŘEBEN
     ----------------------------------------------------------------------
     Dosud to bylo pevných 50 mm ze zadání, ať už krokev v hřebeni leží na
     vaznici, nebo se přeplátovává. To je špatně (opraveno PENTI 17. 8. 2026):

     · JE VRCHOLOVÁ VAZNICE → krokev končí v její ose a nic se nepřeplátovává.
       Těch 50 mm zůstává jako ŘEZNÁ REZERVA.

     · NENÍ VRCHOLOVÁ VAZNICE → krokve se v hřebeni spojují plátem nebo
       ostřihem. Průnik obou krokví je kosočtverec a jeho druhý vrchol leží
       na SPODNÍM líci až za hřebenem. Aby se dal spoj vůbec vyříznout,
       musí krokev za hřeben přesáhnout právě po tenhle bod:

            e = výška krokve / tg(α₁ + α₂)

       Na strmé střeše (součet přes 90°) vyjde nula — spoj je kolmý a nic
       přesahovat netřeba. Na ploché naopak hodně: při 15° je to 312 mm.
       Právě proto se na plochých střechách bez vrcholové vaznice dosud
       objednávaly krátké krokve.

     Počítá se PO ROVINÁCH, protože na nesouměrné střeše má každá rovina
     jiný protilehlý sklon. Nároží tenhle vzorec nepoužívá — tam je jiný
     spoj a zůstává původní rezerva. */
  /* Věšadlo má vrcholovou vaznici na věšácích — krokve se v hřebeni
     nepřeplátovávají (do 22. 9. 2026 se u věšadla počítal plát). */
  var maVrcholovouVaznici = !!((S.vrchol || S.vesadlo) && r2(g.ridge||0) > 0.05);
  var vyskaKrokveM = (P.krokev.h||180)/1000;
  var presahHrebenuHlaseno = false;
  var presahZaHreben = function(p){
    /* VRCHOLOVÁ VAZNICE A VĚŠADLO (PENTI 7. 10. 2026): krokev končí
       v ose vaznice / věšáku, za hřebenem nic není. Dřív se přičítala
       rezerva 50 mm na zaříznutí — tu ale přidává nářezový plán ke
       každému kusu sám (20 mm), takže se počítala dvakrát a řez ukazoval
       „délku ve spádu" o 50 mm delší než skutečnou krokev. */
    if(maVrcholovouVaznici) return 0;
    /* Pultová střecha bez vaznice — nepřeplátovává se, platí rezerva. */
    if(jenJednaRovina) return presahHreben;
    /* Protilehlý sklon: u jedné ze dvou hlavních rovin je to ta druhá,
       u ostatních (valba) se bere vlastní sklon jako u souměrné střechy. */
    var vlastni = (p.sklon||0);
    var proti = vlastni;
    if(p === levá.rovina)  proti = pravá.sklonDeg;
    if(p === pravá.rovina) proti = levá.sklonDeg;
    var soucet = (vlastni + proti) * Math.PI/180;
    var tgS = Math.tan(soucet), sinS = Math.sin(soucet);
    /* Skoro vodorovná nebo skoro svislá střecha — pásy se protínají
       v nekonečnu a vzorec nedává smysl. Zůstane rezerva a řekne se to. */
    if(!(sinS > 0.05)){
      if(!presahHrebenuHlaseno){
        presahHrebenuHlaseno = true;
        upozorneni.push("Ve sklonu "+r2(vlastni)+"° se krokve v hřebeni "
          +"protínají příliš plošeji, než aby se dal plát spočítat. Přesah "
          +"za hřeben zůstal na "+r2(presahHreben)+" m — ověř ho ručně, "
          +"nebo doplň vrcholovou vaznici.");
      }
      return presahHreben;
    }
    /* Nad 90° je tangenta záporná: spoj je kolmý, přesah není potřeba. */
    return (tgS > 0.05) ? r3(vyskaKrokveM / tgS) : 0;
  };

  /* --- KROKVE — z obrysu každé roviny zvlášť --- */
  var vsechnyKrokve=[], roztecSkutecna=0, krokveRovin={}, krokviPosunuto=0, argsKrokviRovin=[];
  var posunyKrokvi = v.posunyKrokvi || {};
  /* Osové vzdálenosti mezi krokvemi, po rovinách (PENTI 17. 8. 2026).
     Nahradily zadávání posunů jednotlivých krokví; posuny se čtou dál,
     aby uložené scénáře nepřišly o nastavení. */
  var rozteceKrokvi = v.rozteceKrokvi || {};
  var osyKrokvi = v.osyKrokvi || {};          // přesné polohy z editoru půdorysu
  var presahyZaHrebenem = {};

  /* ══ ZDĚNÉ ŠTÍTY — KROKVE PO ŠTÍT (PENTI 22. 9. 2026) ══════════════════
     Zakázka 198_25: štíty zděné 440 mm, vyzděné po horní hranu krokví.
     Krokve nad štítem být nemohou — pole krokví na každé rovině začíná až
     za štítovou zdí: od kraje střechy se odečte přesah u štítu, tloušťka
     zdi (z obrysu, stejná jako u věnce) a mezera krajní krokve od líce.
     Tím ubude krokví (a s nimi kleštin, spojováku i háků) — délky krokví
     se nemění. Pozednice pak končí u líce štítu a vaznice v kapse
     (viz dál). Vypnuto = všechno jako dřív. */
  var tlZdiM = ((v.venec && n(v.venec.tloustkaZdiMm)) || 450)/1000;
  var presahStituHrany = function(i){
    var o = v.stitovePresahy || {};
    return (o[i]!=null) ? n(o[i]) : (n(v.presahStitu)||0);
  };
  var zdeneStity = null;
  if(v.krokvePoStit && !jePult && (v.stitoveHrany||[]).length){
    var mezeraM = ((v.mezeraKrokveOdStituMm!=null && v.mezeraKrokveOdStituMm!=="")
                     ? n(v.mezeraKrokveOdStituMm) : VYCHOZI.mezeraKrokveOdStituMm)/1000;
    var kapsaM = VYCHOZI.kapsaVazniceOdLiceMm/1000;
    zdeneStity = { zapnuto:true, tlZdiM:r3(tlZdiM), mezeraM:r3(mezeraM), kapsaOdLiceM:kapsaM,
                   /* po štítových hranách: přesah ze zadání a o kolik od kraje
                      střechy ustoupí vaznice (přesah + kapsa) — pro hřeben a půdorys */
                   hrany:{},
                   /* po rovinách: která hrana je na kterém konci a o kolik od
                      kraje roviny začíná pole krokví / končí vaznice */
                   roviny:{} };
    (v.stitoveHrany||[]).forEach(function(i){
      var p = presahStituHrany(i);
      zdeneStity.hrany[i] = { presah:r3(p), vaznice:r3(p + kapsaM) };
      if(p > 0.25 + 1e-9)
        upozorneni.push("Zděný štít (hrana " + i + "): přesah u štítu " + r2(p) + " m je bez krokví — "
          + "nese ho jen laťování. Nad 0,25 m potřebuje námětky nebo konzoly, které ve výkazu nejsou.");
    });
  }
  /* ══ OBLAST VAZNÍKŮ U ŠTÍTU (PENTI 5. 10. 2026, krok 4 plánu výběru) ══
     Část střechy u štítu se místo krovu udělá z vazníků (navrhují se
     v MiTek Pamir). Zadání: `v.oblastiVazniku = [{ hrana, delkaM }]` —
     štítová hrana obvodové zdi a vzdálenost od jejího VNĚJŠÍHO líce
     k ose krajního (zesíleného) vazníku. Co se změní:
       · krokve začínají až o rozteč za krajním vazníkem (u něj by byly
         zdvojené) — ubudou krokve, kleštiny, spojovák,
       · vrcholová i středové vaznice končí na krajním vazníku; ten je
         jejich podporou, sloupek tam nestojí (vazník musí reakci unést —
         kalkulačka ji vypíše pro Pamir),
       · pozednice zůstává celá (vazníky na ní leží).
     Verze 1 jen pro střechu s jedním přímým hřebenem mezi štíty a pro
     vrcholovou / středové vaznice na sloupcích; jinde se oblast odmítne
     s vysvětlením a krov se spočítá celý jako dřív. */
  var oblastiVaz = null;
  (function(){
    var zad = (v.oblastiVazniku || []).filter(function(o){
      return o && (v.stitoveHrany||[]).indexOf(+o.hrana) >= 0 && n(o.delkaM) > 0.3; });
    if(!zad.length) return;
    var hrebenu = (g.segs||[]).filter(function(sg){ return sg.type === "hreben"; }).length;
    var duvod = null;
    if(jePult || S.pult) duvod = "pultová střecha";
    else if(S.vesadlo) duvod = "věšadlo";
    else if(S.hambalek) duvod = "hambálkový krov";
    else if(hrebenu !== 1) duvod = "střecha nemá jeden přímý hřeben mezi štíty (L, T, valba)";
    else if((S.stred && v.podporaStredovych === "ramy") || (S.vrchol && v.podporaVrcholove === "ramy"))
      duvod = "vaznice na ocelových rámech";
    oblastiVaz = { hrany:{}, roviny:{}, odmitnuto:duvod };
    if(duvod){
      upozorneni.push("Oblast vazníků: zatím jde jen u sedlové střechy s vrcholovou nebo středovými vaznicemi "
        + "na sloupcích — tady je " + duvod + ". Krov se počítá celý, vazníky se neceňují.");
      return;
    }
    zad.forEach(function(o){ oblastiVaz.hrany[+o.hrana] = { hrana:+o.hrana, delkaM:r3(n(o.delkaM)) }; });
  })();
  var jeOblastVaz = !!(oblastiVaz && !oblastiVaz.odmitnuto);

  /* Pole krokví na rovině: u zděného štítu zúžené o {vlevo, vpravo}.
     Měří se od skutečné polohy zdi v geometrii (vnější líc + zeď + mezera).
     Oblast vazníků zúží pole taky — bere se větší z obou. */
  var poleKrokviRoviny = function(p){
    var pole = null;
    if(zdeneStity){
      var k = stitoveKonceRoviny(p, v.zed, v.stitoveHrany);
      pole = { vlevo:  k.vlevo  ? r3(k.vlevo.odKraje  + tlZdiM + mezeraM) : 0,
               vpravo: k.vpravo ? r3(k.vpravo.odKraje + tlZdiM + mezeraM) : 0 };
      zdeneStity.roviny[p.cislo] = {
        vlevo: k.vlevo ? k.vlevo.hrana : null, vpravo: k.vpravo ? k.vpravo.hrana : null,
        krokveOd: pole.vlevo, krokveDo: pole.vpravo,
        vazniceOd: k.vlevo  ? r3(k.vlevo.odKraje  + kapsaM) : 0,
        vazniceDo: k.vpravo ? r3(k.vpravo.odKraje + kapsaM) : 0 };
    }
    if(jeOblastVaz){
      /* který konec roviny leží u štítu s oblastí vazníků */
      var kO = stitoveKonceRoviny(p, v.zed, Object.keys(oblastiVaz.hrany).map(Number));
      var zaz = null;
      ["vlevo", "vpravo"].forEach(function(st){
        var kk = kO[st]; if(!kk) return;
        var ob = oblastiVaz.hrany[kk.hrana];
        /* osa krajního vazníku od kraje roviny; první krokev o rozteč dál */
        var vaz = r3(kk.odKraje + ob.delkaM), kr = r3(vaz + roztec);
        if(!pole) pole = { vlevo:0, vpravo:0 };
        if(kr > pole[st]) pole[st] = kr;
        (zaz = zaz || {})[st] = { hrana:kk.hrana, odKrajeM:r3(kk.odKraje), vaznikM:vaz, krokveM:kr };
      });
      if(zaz) oblastiVaz.roviny[p.cislo] = zaz;
    }
    return pole;
  };

  /* Rozvrh krokví od hřebene (1. 10. 2026): body na hřebeni a ve vrcholu
     valby, ze kterých se páry krokví počítají — viz kotvyRozvrhuKrokvi(). */
  var kotvyKrokvi = jePult ? {} : kotvyRozvrhuKrokvi(roviny, g.segs, roztec, ((P.krokev && P.krokev.b) || 100)/1000);

  /* ── ROZMÍSTĚNÍ VAZEB VĚŠADLA — JEDNO MÍSTO (9. 10. 2026) ───────────────
     Potřebuje ho blok věšadla (vazby, vaznice, pásky) i rozvrh krokví
     u pozednice mezi trámy (krokve se rozmisťují dřív než vazby). Vstupy
     jsou jen ze zadání, takže se dá spočítat předem; obě místa volají
     tuhle funkci, aby se nemohla rozejít. */
  var vesadloRozmisteni = function(){
    var Ves = global.PentiVesadlo;
    if(!S.vesadlo || !Ves) return null;
    var delkaBudovy = r2(g.ridge||0);
    var tlZdiVes = ((v.venec && n(v.venec.tloustkaZdiMm)) || 450)/1000;
    var presahStituVes = n(v.presahStitu) || 0;
    var bTramM = ((P.tram && P.tram.b) || 200)/1000;
    var odsazeniOsa = (v.mezeraVazbyOdStituMm != null && v.mezeraVazbyOdStituMm !== "")
      ? r3(n(v.mezeraVazbyOdStituMm)/1000 + bTramM/2)
      : ((v.odsazeniVesadlaM != null && v.odsazeniVesadlaM !== "") ? n(v.odsazeniVesadlaM) : VYCHOZI.odsazeniVesadlaM);
    var krajniVazby = !(zdeneStity && v.krajniVazby === false);
    var kapsaVesM = zdeneStity ? zdeneStity.kapsaOdLiceM : 0;
    return Ves.rozmisteni({
      delkaM: delkaBudovy, presahStituM: presahStituVes, tlZdiM: tlZdiVes,
      odsazeniM: odsazeniOsa,
      pocet: n(v.pocetVesadel) || 0,
      osovaM: n(v.osovaVesadel) || VYCHOZI.osovaVesadel,
      bezKrajnich: !krajniVazby,
      podporaStituM: r3(presahStituVes + (kapsaVesM + tlZdiVes)/2)
    });
  };
  /* KROKVE V POLÍCH MEZI VAZNÝMI TRÁMY (PENTI 9. 10. 2026, varianta A).
     U pozednice mezi trámy je horní líc trámu výš než sedlo krokve —
     krokev nad trámem by do něj vjela přes 40 % výšky. Proto žádná krokev
     neleží nad trámem: v každém poli mezi osami trámů se krokve rozdělí
     rovnoměrně s roztečí nejvýš zadanou, osa trámu leží uprostřed mezery
     (mezera přes trám = rozteč pole). Krajní krokve zůstávají na krajích
     roviny. Vrací nové osy, nebo null (když se nic měnit nemusí). */
  var rozmistiMeziTramy = function(min, max, osyTramu, roztecK, bTramuM, bKrokveM){
    var d = bTramuM/2 + bKrokveM/2 + 0.01;               // pás kolem osy trámu, kam krokev nesmí
    var c = osyTramu.filter(function(u){ return u > min - d && u < max + d; }).sort(function(a,b){ return a-b; });
    if(!c.length) return null;
    var osy = [];
    var pridej = function(u){ if(u >= min - 1e-6 && u <= max + 1e-6 && (!osy.length || u - osy[osy.length-1] > 0.03)) osy.push(r3(u)); };
    /* krajní pole od kraje k první ose trámu (krajní krokev drží kraj) */
    var Lz = c[0] - min;
    if(Lz > d + 0.02){
      var kz = Math.max(0, Math.ceil(Lz/roztecK - 0.5)), sz = Lz/(kz + 0.5);
      for(var j=0;j<=kz;j++) pridej(min + j*sz);
    }
    /* vnitřní pole: osa trámu uprostřed mezery */
    for(var i=0;i+1<c.length;i++){
      var Lp = c[i+1] - c[i], m = Math.max(1, Math.ceil(Lp/roztecK)), sp = Lp/m;
      for(var k=0;k<m;k++) pridej(c[i] + sp/2 + k*sp);
    }
    /* krajní pole od poslední osy ke kraji */
    var Lk = max - c[c.length-1];
    if(Lk > d + 0.02){
      var kk = Math.max(0, Math.ceil(Lk/roztecK - 0.5)), sk = Lk/(kk + 0.5);
      for(var j2=kk;j2>=0;j2--) pridej(max - j2*sk);
    }
    return osy.length >= 2 ? osy : null;
  };
  var vesMeziRozm = (S.vesadlo && v.vesadloOkap === "mezi") ? vesadloRozmisteni() : null;
  /* otvory vikýřů na rovinách (etapa 3a) — kalkulačka je předá v `v.vikyreKrov` */
  var VK = v.vikyreKrov || null;
  roviny.forEach(function(p){ p.otvoryKrovu = (VK && VK.otvory && VK.otvory[p.cislo]) || null; });
  var vikZes=[], vikVymH=[], vikVymD=[], vikRez=0;
  roviny.forEach(function(p){
    var posuny = posunyKrokvi[p.cislo] || null;
    var rozt = rozteceKrokvi[p.cislo] || null;
    var pzh = presahZaHreben(p);
    presahyZaHrebenem[p.cislo] = pzh;
    var poleP = poleKrokviRoviny(p);
    var kotvyP = kotvyKrokvi[p.cislo] || null;
    /* zapamatovat pro přepočet námětků a lípanců (nároží, 1. 10. 2026) */
    var osyP = osyKrokvi[p.cislo] || null;
    var meziTramy = false;
    if(vesMeziRozm && !osyP){
      var pkA = polohyKrokviVRovine(p, roztec, posuny, rozt, poleP, kotvyP, null);
      var osyMT = pkA ? rozmistiMeziTramy(pkA.min, pkA.max, vesMeziRozm.polohy, roztec,
                          ((P.tram && P.tram.b) || 200)/1000, ((P.krokev && P.krokev.b) || 100)/1000) : null;
      if(osyMT){ osyP = { min: pkA.min, max: pkA.max, osy: osyMT }; meziTramy = true; }
    }
    argsKrokviRovin.push([p, roztec, pzh, posuny, rozt, poleP, kotvyP, osyP]);
    vsechnyKrokve = vsechnyKrokve.concat(krokveVRovine(p, roztec, pzh, posuny, rozt, poleP, null, kotvyP, osyP));
    var pk = polohyKrokviVRovine(p, roztec, posuny, rozt, poleP, kotvyP, osyP);
    if(pk && meziTramy){
      /* rozvrh není ruční — je to pravidlo pozednice mezi trámy */
      pk.rucni = false; pk.rucniOsy = false; pk.meziTramy = true;
      pk.rozvrh = "v polích mezi vaznými trámy (žádná krokev nad trámem)";
    }
    if(pk && p.otvoryKrovu){
      /* zesílené krokve a výměny u vikýřů této roviny (etapa 3a) */
      var vr = vikyreVRovine(p, pk, pzh, VK.spodniVymena);
      pk.vikyre = vr.detail;
      vikZes = vikZes.concat(vr.zesilene); vikVymH = vikVymH.concat(vr.vymenyHorni);
      vikVymD = vikVymD.concat(vr.vymenyDolni); vikRez += vr.rezanych;
    }
    if(pk){
      krokveRovin[p.cislo] = pk;
      krokviPosunuto += pk.posuny.filter(function(x){ return Math.abs(x)>0.001; }).length;
      (pk.upozorneni||[]).forEach(function(u){ upozorneni.push("Rovina "+p.cislo+": "+u); });
    }
    /* Pro háky rozhoduje NEJVĚTŠÍ skutečná rozteč — u ní je mezi krokvemi
       nejvíc místa, takže podle ní se pozná, jestli hák vyjde na každou
       krokev, nebo bude muset i mezi ně. Ručně posunutá krokev pole
       zvětší, takže se to musí brát ze skutečných polí, ne z ideální
       rozteče (PENTI 16. 8. 2026). */
    var rk = pk ? pk.nejdelsiPole : roztecVRovine(p, roztec, poleP);
    if(rk > roztecSkutecna) roztecSkutecna = rk;
  });
  /* ── ZESÍLENÁ KROKEV BEZ PROTIKUSU KONČÍ NA VAZNICI (2026.11.234 —
     PENTI 16. 11. 2026: „Hlavní krokev vedle vikýře, která nemá protikus
     na opačné ploše, by se mohla zařezat na vaznici a nepokračovat až do
     hřebene.") Nová krokev u boku vikýře (mimo rozteč) nemá na protější
     rovině krokev ve stejné ose, se kterou by se v hřebeni spojila. Končí
     proto svislým řezem na vnitřním líci vaznice, sedlo leží na vaznici
     celou šířkou. Protikus = krokev (i zesílená) protější rovnoběžné
     roviny do 50 mm od osy. */
  (function(){
    var svet = function(p, u){ return [p.baze.a[0] + p.baze.dir[0]*u, p.baze.a[1] + p.baze.dir[1]*u]; };
    var osyRoviny = function(q){
      var pkq = krokveRovin[q.cislo]; if(!pkq) return [];
      var u = (pkq.osy || []).slice();
      (pkq.vikyre || []).forEach(function(dq){ dq.zesilene.forEach(function(zq){ if(zq.nahrazuje == null) u.push(zq.u); }); });
      return u;
    };
    var zmena = false, naVaz = false;
    roviny.forEach(function(p){
      var pk = krokveRovin[p.cislo]; if(!pk || !pk.vikyre || !p.baze) return;
      pk.vikyre.forEach(function(d){
        var o = d.otvor || {}; if(!(o.vVazniceVnitrni > 0)) return;
        d.zesilene.forEach(function(z){
          if(z.nahrazuje != null || !(z.vrch > o.vVazniceVnitrni + 0.3)) return;
          var Pz = svet(p, z.u), dir = p.baze.dir;
          var protikus = roviny.some(function(q){
            if(q === p || !q.baze) return false;
            if(Math.abs(Math.abs(q.baze.dir[0]*dir[0] + q.baze.dir[1]*dir[1]) - 1) > 0.01) return false;
            return osyRoviny(q).some(function(u){ var W = svet(q, u); return Math.abs((W[0]-Pz[0])*dir[0] + (W[1]-Pz[1])*dir[1]) < 0.05; });
          });
          if(protikus) return;
          z.vrchPuvodni = z.vrch; z.vrch = r3(o.vVazniceVnitrni); z.delka = r2(z.vrch - z.spodek);
          z.konciNaVaznici = true; zmena = true; naVaz = true;
        });
      });
    });
    /* ── ŠTÍTKY A RUČNÍ ÚPRAVY KROKVÍ U VIKÝŘŮ (2026.11.234 — PENTI 16. 11.
       2026: „unikátní štítek a po rozkliknutí by se daly editovat … třeba
       zařezat k pomocné čáře") Každý kus dostane štítek: V1-Z1/Z2 zesílené
       u boků (Z1 na začátku roviny), V1-H1… horní kusy přerušených krokví,
       V1-D1… dolní kusy (u vikýře nad okapem). `v.upravyKrokvi[štítek]` =
       { horniM, dolniM } — posun konce po spádu (+ prodloužit, − zkrátit).
       Upravují se zesílené (oba konce) a horní kusy (dolní konec). */
    var upr = v.upravyKrokvi || {};
    roviny.forEach(function(p){
      var pk = krokveRovin[p.cislo]; if(!pk || !pk.vikyre) return;
      pk.vikyre.forEach(function(d){
        var c = String(d.klic || "0_0").split("_"), oz = "V" + ((+c[0]||0) + 1) + ((+c[1]||0) > 0 ? "." + ((+c[1]||0) + 1) : "");
        d.oznaceni = oz;
        d.zesilene.slice().sort(function(a, b){ return a.u - b.u; }).forEach(function(z, j){
          z.stitek = oz + "-Z" + (j + 1);
          var u = upr[z.stitek]; if(!u) return;
          var h = +u.horniM || 0, dl = +u.dolniM || 0;
          if(h || dl){
            if(z.vrchPuvodni == null) z.vrchPuvodni = z.vrch;
            z.spodekPuvodni = z.spodek;
            z.vrch = r3(z.vrch + h); z.spodek = r3(Math.max(0, z.spodek - dl));
            z.delka = r2(z.delka + h + (z.spodekPuvodni - z.spodek));
            z.upraveno = true; zmena = true;
          }
        });
        d.rezane.slice().sort(function(a, b){ return a.u - b.u; }).forEach(function(r, j){
          r.stitekH = oz + "-H" + (j + 1);
          if(!d.naOkapu) r.stitekD = oz + "-D" + (j + 1);
          var u = upr[r.stitekH];
          if(u && +u.dolniM){ r.posunHorniKusDoleM = r3(+u.dolniM); r.upraveno = true; }
        });
      });
    });
    if(zmena){
      vikZes = [];
      roviny.forEach(function(p){ var pk = krokveRovin[p.cislo]; ((pk && pk.vikyre) || []).forEach(function(d){ d.zesilene.forEach(function(z){ if(z.delka > 0.3) vikZes.push(z.delka); }); }); });
      if(naVaz) upozorneni.push("Zesílené krokve u boků vikýřů, které nemají na protější ploše protikus, končí na vaznici (svislý řez na jejím vnitřním líci).");
    }
  })();
  if(vsechnyKrokve.length) prvky.push(prvek("krokve","Krokve",P.krokev,vsechnyKrokve,"model",
    (roviny.length>1 ? ("délky z tvaru "+roviny.length+" střešních rovin") : "")
    + (vikRez ? ((roviny.length>1 ? "; " : "") + vikRez + " krokví přerušeno vikýřem (dolní + horní kus)") : "")));
  /* VIKÝŘE V KROVU (etapa 3a) — zesílené krokve u boků otvoru a výměny */
  if(vikZes.length || vikVymH.length){
    var Pzes = (VK && VK.profilZesilene) || vikyrOStupenVys(P.krokev);
    if(vikZes.length) prvky.push(prvek("vikyr_krokev_zesilena","Zesílená krokev u vikýře",Pzes,vikZes,"model",
      "u boků otvoru vikýře, o stupeň vyšší profil než krokev; bez protikusu na protější ploše končí na vaznici"));
    if(vikVymH.length) prvky.push(prvek("vikyr_vymena_horni","Výměna nad vikýřem",Pzes,vikVymH,"model",
      "mezi zesílenými krokvemi (osa–osa)"));
    if(vikVymD.length) prvky.push(prvek("vikyr_vymena_dolni","Výměna pod vikýřem",Pzes,vikVymD,"model",
      "mezi zesílenými krokvemi (osa–osa)"));
  }
  /* KONSTRUKCE VIKÝŘE V CENĚ KROVU (oprava 2026.11.207, PENTI 8. 11. 2026)
     Práh, sloupky, překlad a krokvičky vikýře spočítá penti-vikyre.js;
     sem je předá kalkulačka (`VK.rezivo`), aby šly do dodávky řeziva,
     práce i spojováku krovu jako ostatní prvky. Do 2026.11.206 se jen
     ukazovaly v Doplňcích a do nabídky se jako dřevo nedostaly vůbec.
     Krokvičky mají profil krokve hlavní střechy (kalkulačka je počítá
     s orientačním profilem, aby se krov a vikýř nevolaly dokola). */
  ((VK && VK.rezivo) || []).forEach(function(e){
    if(!e || !(e.delka>0) || !(e.kusu>0)) return;
    var prof = (e.kod === "vikyr_krokvicky" || e.kod === "vikyr_krokve_pultu") ? P.krokev
             : (e.kod === "vikyr_pozednice_cela") ? (e.profilZadany ? e.profil : (P.pozednice || e.profil))   // zděné čelo vikýře (4b); vlastní profil 2026.11.228
             : e.profil;
    var kusy = []; for(var iE=0;iE<e.kusu;iE++) kusy.push(e.delka);
    prvky.push(prvek(e.kod, e.nazev + " (vikýř)", prof, kusy, "model", e.poznamka || "konstrukce vikýře"));
  });

  /* ── ROZTEČ, NA KTEROU SE KROKEV POSUZUJE ─────────────────────────────
     Krokev nese pruh střechy široký jako rozteč k sousedkám, takže se musí
     posuzovat na NEJŠIRŠÍ SKUTEČNÉ POLE — ne na rozteč ze zadání.

     Do 17. 8. 2026 se bralo zadané číslo a skutečná rozteč se použila jen
     tehdy, když se krokví hýbalo ručně. Jenže i bez zásahu je skutečná
     rozteč o kousek větší: krokve se rozpouštějí rovnoměrně, takže z
     zadaných 0,90 m vyjde na domě 16 m 0,92 m. Posudek byl tedy asi o 2 %
     na nebezpečné straně. Bylo to vedeno jako známá vada, aby se nehnuly
     staré nabídky — s protokolem pro statika už to neobstojí (rozhodl
     PENTI 17. 8. 2026). */
  var roztecProPosudek = Math.max(roztec, roztecSkutecna);
  if(roztecSkutecna > roztec + 0.005){
    upozorneni.push("Krokve se rozpouštějí rovnoměrně, takže nejširší pole "
      + "mezi nimi je " + r2(roztecSkutecna) + " m místo zadaných " + roztec
      + " m" + (krokviPosunuto ? " (" + krokviPosunuto + "× ručně upravená "
      + "osová vzdálenost)" : "") + ". Krokev se posuzuje na tohle pole a "
      + "podle něj se rozmisťují i sněhové háky.");
  }

  /* --- NÁROŽNÍ A ÚŽLABNÍ KROKVE ---
     Každé nároží a úžlabí je samostatný kus. Délky jsou ve sklonu a berou
     se z tvaru střechy; výška profilu se řídí zářezem zkrácených krokví. */
  var narozniky = [];
  (g.segs||[]).forEach(function(sg, iSeg){
    if(sg.type!=="narozi" && sg.type!=="uzlabi") return;
    var d = sg.delka || 0;
    if(!(d>0.2)) return;
    narozniky.push({ typ:sg.type, delka:r2(d + presahHreben),
                     uhel: uhelNarozi(sg.A, sg.B, v.zed, v.stitoveHrany),
                     iSeg: iSeg });                    // kvůli okapní patě (délka úžlabníku)
  });
  if(narozniky.length){
    /* Pro zářez je rozhodující sklon ROVINY — ta se od osy nárožníku
       svažuje na obě strany. */
    var uhelPrum = narozniky.reduce(function(a2,x){ return a2+x.uhel; },0)/narozniky.length;
    var navrhProf = profilNarozniku(P.krokev.h, (P.naroznik&&P.naroznik.b)||140,
                                    levá.sklonDeg, uhelPrum);
    /* Ručně zadaný profil má přednost, ale když nestačí na zářez, řekne se to. */
    var zadanyProf = (v.profily && v.profily.naroznik) ? P.naroznik : null;
    var pouzityProf = zadanyProf ? zadanyProf : { b:navrhProf.b, h:navrhProf.h };
    /* POSUDEK — počítá se pro NEJDELŠÍ kus, ten je rozhodující. */
    var nejdelsi = narozniky.reduce(function(a2,x){ return x.delka>a2.delka?x:a2; }, narozniky[0]);
    var Stat = global.PentiStatika, Eng = global.PentiEngine;
    var geoN = geometrieNarozniku(nejdelsi.delka, vyskaStrechy,
                                  levá.presah, levá.sklonRad);
    /* Kde nárožnici kříží středová vaznice — jako podíl rozpětí. Bez zadané
       výšky leží vaznice v polovině, takže podpora vyjde uprostřed. */
    var podporyN = [];
    if(S.stred && vyskaStrechy > 0.05){
      var hSV = n(v.vyskaStredVaznice) || r2(vyskaStrechy/2);
      /* Od 3. 10. 2026 se výška středové vaznice zadává v rozhraní jen
         jako ULOŽENÍ NAD ±0 (spodní líc). Dřív to tady chybělo — nárožník
         by počítal s vaznicí v půlce, i když ji uživatel zadal jinak.
         Přepočet stejný jako u polohy vaznice níž:
             výška = uložení − nadezdívka − výška pozednice + výška vaznice */
      var ulozN = n(v.ulozeniStredoveM);
      if(ulozN > 0.05){
        var hZUloz = ulozN - (n(v.nadezdivkaM)||0) - (P.pozednice.h||160)/1000 + (P.stredVaznice.h||220)/1000;
        if(hZUloz > 0.05 && hZUloz < vyskaStrechy) hSV = hZUloz;
      }
      podporyN.push(hSV/vyskaStrechy);
    }
    /* Zatížení je TOTÉŽ, jaké nese zbytek krovu — dřív si nárožnice
       počítala vlastní 0,75 a 1,0 kN/m² bez ohledu na krytinu a oblast
       (sjednoceno PENTI 15. 8. 2026). */
    var zatN = zatizeniKrovu({
      sklonDeg: levá.sklonDeg, roztecKrokvi: roztecProPosudek, profilKrokve: P.krokev,
      snehOblast: n(v.snehOblast) || 2, vitrOblast: n(v.vitrOblast) || 2,
      teren: v.teren || "III",
      hmotnostKrytinyKgM2: (v.hmotnostKrytinyKgM2 != null)
        ? n(v.hmotnostKrytinyKgM2) : 45
    });
    var vstupPos = (geoN && zatN) ? {
      profil: pouzityProf, trida: v.tridaDreva || "C24",
      rozpetiM: geoN.rozpeti, pudorysnaDelkaM: geoN.pudorys,
      podporyPodil: podporyN,
      qUls: zatN.qUlsPresne, qSls: zatN.qSlsPresne,
      minVyskaMm: navrhProf.potrebaMm,
      solver: Eng && Eng.solveFrame2D
    } : null;
    var posudek = (Stat && vstupPos) ? Stat.posudekNarozniku(vstupPos) : null;
    var doporuceny = (posudek && !posudek.vyhovuje)
      ? Stat.navrhniNaroznik(vstupPos) : null;

    naroznikGeo = { profil:pouzityProf, navrh:navrhProf, kusy:narozniky,
                    posudek:posudek, doporuceny:doporuceny,
                    geometrie:geoN, zatizeni:zatN,
                    nejdelsiM:nejdelsi.delka,
                    narozi:narozniky.filter(function(x){ return x.typ==="narozi"; }).length,
                    uzlabi:narozniky.filter(function(x){ return x.typ==="uzlabi"; }).length };
    naroznikGeo.poznamka = naroznikGeo.narozi+"× nároží, "+naroznikGeo.uzlabi+"× úžlabí · výška "
      +pouzityProf.h+" mm ze zářezu (potřeba "+navrhProf.potrebaMm+" mm)";
    prvky.push(prvek("naroznik","Nárožní a úžlabní krokve", pouzityProf,
      narozniky.map(function(x){ return x.delka; }), "model", naroznikGeo.poznamka));
    if(pouzityProf.h < navrhProf.potrebaMm - 0.5 && !v.narozniMimoDodavku)
      upozorneni.push("Nárožní krokev "+pouzityProf.b+"/"+pouzityProf.h+" mm je na zářez "
        +"zkrácených krokví nízká — rovina se od její osy svažuje, takže je potřeba "
        +"aspoň "+navrhProf.potrebaMm+" mm (navrhuji "+navrhProf.b+"/"+navrhProf.h+" mm).");
    if(posudek && !posudek.vyhovuje && !v.narozniMimoDodavku){
      /* Když ani nejvyšší hranol nestačí, není řešením ještě větší hranol,
         ale podepřít nárožnici sloupkem. Tesař to tak dělá běžně. */
      var rada = doporuceny
        ? " Nejmenší profil, který projde, je "+doporuceny.b+"/"+doporuceny.h+" mm."
        : (posudek.poli>1
            ? " Ani nejvyšší hranol v nabídce nestačí — patří to statikovi."
            : " Ani nejvyšší hranol v nabídce nestačí. Obvyklé řešení není větší "
              +"hranol, ale podepřít nárožnici uprostřed sloupkem, nebo přidat "
              +"středovou vaznici — ta se v rohu kříží a nárožnici podepře sama.");
      upozorneni.push("Nárožní krokev "+pouzityProf.b+"/"+pouzityProf.h+" mm nevyhoví. "
        +"Kus je "+geoN.celkem+" m dlouhý, z toho nosných "+posudek.rozpetiM+" m mezi "
        +"pozednicí a hřebenem a "+geoN.konzola+" m přesah. Podepřená je "
        +(posudek.poli>1 ? "na "+posudek.podporyM.length+" místech" : "jen na koncích")
        +", rozhoduje "+posudek.rozhoduje+" s využitím "
        +Math.round(posudek.vyuziti*100)+" %."+rada);
    }
  }

  /* --- POZEDNICE ---
     U pultové střechy jsou dvě: dolní pod okapem a horní pod horní hranou,
     obě na obvodové zdi. U ostatních jedna souvislá pod okapovými hranami. */
  var pozBm = 0, pozedniceBehy = [], rohyVaznic = null, pozedniceDily = null, rohyPoz = null;
  var pozedniceBehyVes = null;      // věšadlo: ruční konce pozednice / okapové vaznice (11. 10. 2026)
  var vrcholRucneVes = null;        // věšadlo: ruční konce vrcholové vaznice (11. 10. 2026)
  /* Rozteč kotev: buď zadaná ručně, nebo podle soustavy (viz VYCHOZI). */
  var jeVaznicova = !!(S.vrchol || S.stred || S.pultVaznice || S.vesadlo);
  var roztecKotev = n(v.roztecKotevPozednice) || (jeVaznicova ? 2 : 1);
  if(jePult){
    var d=pultovePozednice(g, v.zed);
    pozBm = r2(d.dolni + d.horni);
    if(d.dolni>0) prvky.push(prvek("pozednice_dolni","Pozednice dolní (u okapu)",P.pozednice,
      [r2(d.dolni)],"model","na nižší obvodové zdi",true));
    if(d.horni>0) prvky.push(prvek("pozednice_horni","Pozednice horní",P.pozednice,
      [r2(d.horni)],"model","na vyšší obvodové zdi",true));
    if(!d.dolni && !d.horni) upozorneni.push("Pozednice se nepodařilo odvodit z tvaru pultové střechy.");
  } else if(S.vesadlo){
    /* Věšadlo pozednici nemá. Vazné trámy leží přímo na obvodových zdech
       a okapové vaznice leží na jejich koncích. Kdyby se pozednice počítala,
       byla by v nabídce navíc. */
    pozBm = 0;
  } else {
  /* ruční konce pozednic z půdorysu (11. 10. 2026) */
  /* zděná čela vikýřů přerušují pozednici (2026.11.228) */
  var mezeryPoz = mezeryPozedniceVikyre(v.zed, v.stitoveHrany, roviny, P);
  pozedniceBehy = behyPozednic(v.zed, v.stitoveHrany, v.stitovePresahy, v.presahStitu, zdeneStity, v.koncePozednic, mezeryPoz);
  pozBm = delkaPozednic(v.zed, v.stitoveHrany, v.stitovePresahy, v.presahStitu, zdeneStity, v.koncePozednic, mezeryPoz);
  pozedniceBehy.forEach(function(b){
    if(b.rucne && b.rucne.oriznuto)
      upozorneni.push("Pozednice na zdi " + (b.hrana+1) + ": ruční konec by vyšel za konec střechy nebo by kus byl kratší než 0,3 m — upraven na mez.");
    /* krokev musí mít vždy dvě podpory (PENTI 4. 10. 2026) — zkrácená
       pozednice pod krajními krokvemi chybí, ať se to nepřehlédne */
    if(b.rucne && (b.rucne.pred || b.rucne.za))
      upozorneni.push("Pozednice na zdi " + (b.hrana+1) + " je ručně zaříznutá — krokve za jejím koncem na ní neleží; zkontrolujte, že mají jinou podporu.");
  });
  rohyPoz = rohyPozednic(v.zed, v.stitoveHrany, P.pozednice);
  if(pozBm>0){
    /* Objednací délka = čistá délka + překrytí ve spojích. */
    pozedniceDily = dilyPozednic(pozedniceBehy, P.pozednice,
                                 n(v.maxKusPozedniceM) || VYCHOZI.maxKusPozedniceM,
                                 roztecKotev);
    var pozPozn = zdeneStity ? "obvodová nosná zeď pod okapem, končí u vnitřního líce zděného štítu"
                             : "obvodová nosná zeď pod okapem + vytažení za štít";
    if(pozedniceDily && pozedniceDily.naviceBm > 0.001){
      /* Do nabídky jde OBJEDNACÍ délka — kusy po celých metrech, jak
         chodí z pily. Poznámka rozepíše, co je zeď, co pláty a co odpad,
         ať je vidět, za co se platí (PENTI 20. 8. 2026). */
      pozBm = pozedniceDily.rezivoBm;
      pozPozn += "; zeď " + pozedniceDily.cistaBm + " m + "
        + pozedniceDily.spoju + "× přeplátování jednoduchým plátem na ½ výšky (v plátu 2 kotvy, bez svorníků) " + pozedniceDily.platMm
        + " mm = " + pozedniceDily.cisteSPlatyBm + " m dřeva"
        + "; objednat " + (pozedniceDily.objednacky||[])
            .map(function(o){ return o.kusu + "× " + o.delkaM + " m"; }).join(", ")
        + " = " + pozedniceDily.rezivoBm + " m"
        + (pozedniceDily.odpadBm > 0.001
            ? " (odřez " + pozedniceDily.odpadBm + " m)" : "");
    }
    if(rohyPoz) pozPozn += "; " + rohyPoz.pocet + "× roh: rohový plát " + rohyPoz.platMm
      + " mm na ½ výšky (" + rohyPoz.hloubkaMm + " mm), 1 kotva do věnce skrz oba pláty";
    prvky.push(prvek("pozednice","Pozednice",P.pozednice,[pozBm],"model",
      pozPozn,true));
  } else if(g.okap>0){
    /* Když obrys zdi neznáme, spadneme na okap a řekneme to nahlas. */
    prvky.push(prvek("pozednice","Pozednice",P.pozednice,[r2(g.okap)],"odhad",
      "spočteno z okapu — obvodová zeď nebyla zadaná, skutečná délka bude kratší",true));
    upozorneni.push("Pozednice je spočítaná z okapové hrany, protože obrys obvodové zdi nebyl předán. Skutečná délka je o přesah kratší.");
  }
  }

  /* ── OSEDLÁNÍ KROKVE ─────────────────────────────────────────────────────
     Krokev se osedlá na pozednici i na vaznice. Zářez (sedlo) je třetina
     výšky profilu krokve, nad ním zbývá NADSEDLOVÍ dvě třetiny — obojí
     měřeno KOLMO k rovině krokve (pravidlo PENTI 12. 8. 2026).

     Z toho plyne důležitá věc: horní plochy všech podpor leží na přímce
     rovnoběžné s krokví, která začíná na horní hraně pozednice. Poloha
     vaznic tedy není volná — vyplývá z geometrie. Délky sloupků se proto
     dopočítají, místo aby se zadávaly. */
  /* Vodorovný rozpon = součet průmětů OBOU stran, ne dvojnásobek jedné. */
  var rozponVodorovny = r2(levá.beh + pravá.beh);
  /* Vodorovný průmět KAŽDÉ strany bez přesahu okapu — od zdi k hřebeni.
     Přesah okapu se zadává VODOROVNĚ (obrys střechy je o něj odsazený
     v půdorysu), takže se prostě odečte — nenásobí se kosinem. */
  var behZdiL = levá.behZdi;
  var behZdiP = jenJednaRovina ? 0 : pravá.behZdi;
  var rozponZdiVodorovny = r2(behZdiL + behZdiP);   // šířka domu mezi pozednicemi

  /* Sedlová střecha s jedinou spádovou rovinou je příznak špatně zvolených
     štítů — krokev pak přejde celý dům. Plocha přitom sedí, takže to hlídač
     tvaru nepozná; je potřeba to říct zvlášť. */
  if(!S.pult && jenJednaRovina){
    upozorneni.push("Střecha má jedinou spádovou rovinu, přestože nejde o pultový krov. "
      +"Krokev by přešla celý dům ("+r2(levá.spad)+" m po spádu). Nejspíš jsou štítem "
      +"označené hrany, které jimi být nemají — zkontroluj je.");
  }
  if(!S.pult && nesoumerná){
    upozorneni.push("Střecha není souměrná: levá strana " + levá.sklonDeg + "° / "
      + r2(levá.beh) + " m, pravá " + pravá.sklonDeg + "° / " + r2(pravá.beh)
      + " m. Řez i délky se počítají pro každou stranu zvlášť.");
    if(Math.abs(levá.vyska - pravá.vyska) > 0.05)
      upozorneni.push("Strany nedosahují stejné výšky (" + r2(levá.vyska) + " a "
        + r2(pravá.vyska) + " m nad pozednicí) — hřeben by nevyšel na jednom místě. "
        + "Zkontrolujte sklony a přesahy.");
  }
  var hKrokve = (P.krokev.h||180)/1000;
  /* HLOUBKA SEDLA (zářezu do krokve).
     Zvyklost je třetina výšky krokve, ale dá se zadat vlastní — mělčí sedlo
     nechá krokev silnější, hlubší dá lepší dosednutí na vaznici
     (zadání PENTI 14. 8. 2026). Nadsedloví je zbytek výšky.
     Nesmí se přehnat: příliš hluboký zářez krokev oslabí, příliš mělký
     nedosedne. Hlídá se to níž. */
  var sedloZadano = n(v.vyskaSedlaMm)/1000;
  var sedlo = r3(sedloZadano > 0 ? sedloZadano : hKrokve/3);
  var sedloAuto = !(sedloZadano > 0);
  /* Bezpečné meze: aspoň 20 mm, nejvýš polovina výšky krokve. */
  var sedloMin = Math.max(0.02, hKrokve*0.15), sedloMax = hKrokve*0.5;
  if(sedlo < sedloMin){
    upozorneni.push("Sedlo "+Math.round(sedlo*1000)+" mm je na krokev "
      +Math.round(hKrokve*1000)+" mm mělké — krokev na vaznici pořádně nedosedne. "
      +"Doporučená hloubka je "+Math.round(hKrokve/3*1000)+" mm (třetina výšky).");
    sedlo = r3(sedloMin);
  } else if(sedlo > sedloMax){
    upozorneni.push("Sedlo "+Math.round(sedlo*1000)+" mm je víc než polovina výšky "
      +"krokve — takový zářez ji nepřípustně oslabí. Zmenšeno na "
      +Math.round(sedloMax*1000)+" mm; doporučená hloubka je "
      +Math.round(hKrokve/3*1000)+" mm.");
    sedlo = r3(sedloMax);
  }
  var nadsedlovi = r3(hKrokve - sedlo);          // kolmá zbývající výška
  var hPozednice = (P.pozednice.h||160)/1000;
  /* ── VĚŠADLO: OKAPOVÁ VAZNICE MÍSTO POZEDNICE (22. 9. 2026) ──────────
     U věšadla není pozednice. Krokve dosedají na OKAPOVOU VAZNICI, která
     leží na koncích vazných trámů — tedy o výšku trámu výš než by ležela
     pozednice. Profil `pozednice` se u věšadla zadává jako „okapová
     vaznice", takže všechno, co níž pracuje s pozednicí (osedlání, zhlaví
     krokve, výrobní výkres), platí beze změny — jen je to celé zvednuté.

     Modul měří přímku sedel od VNĚJŠÍHO LÍCE ZDI (x = 0). Vaznice je ale
     od líce odsazená (`pozedniceOdLiceM`) a její horní vnější hrana musí
     na té přímce ležet. Proto se počáteční výška přímky sníží o odsazení
     × tg(sklon): `hPozednice` je tu POMOCNÁ hodnota pro přímku, ne výška
     profilu. Skutečné výšky (trám, vaznice) jsou v `rez.vysky`. */
  /* ── PŘÍMKA SEDEL ZAČÍNÁ NA VNĚJŠÍ HRANĚ POZEDNICE (22. 9. 2026) ─────
     Pozednice bývá od líce zdi zatažená dovnitř (`pozedniceOdLiceM`, u 198_26
     100 mm). Horní plochy všech podpor leží na přímce rovnoběžné s krokví,
     která začíná na HORNÍ VNĚJŠÍ HRANĚ POZEDNICE — tedy v x = odsazení, ne
     v x = 0 na líci zdi. Do 22. 9. 2026 modul počítal od líce, takže při
     odsazení 100 mm a 35° byl hřeben o 70 mm výš, vaznice a sloupky o 70 mm
     výš a kleštiny i hambálek o 2 × 100 mm delší než ve skutečnosti —
     zatímco výrobní výkres krokve a štít pro zedníky počítaly správně od
     hrany pozednice, takže si výstupy odporovaly. */
  var odLice = n(v.pozedniceOdLiceM) || 0;
  var vesadloZvednuti = 0;
  if(S.vesadlo){
    var hTramuVes = (P.tram.h||280)/1000;
    /* Vaznice sedí v kampu (zářezu) trámu, tedy o kamp níž než líc trámu.
       `hPozednice` je pak horní plocha OKAPOVÉ VAZNICE nad věncem. */
    var kampVes = ((global.PentiVesadlo && global.PentiVesadlo.VYCHOZI.kampVazniceMm) || 30)/1000;
    /* Pozednice MEZI trámy (9. 10. 2026) leží na věnci jako u ostatních
       soustav — střecha se nezvedá, hřeben vyjde o (výška trámu − kamp) níž. */
    vesadloZvednuti = (v.vesadloOkap === "mezi") ? 0 : r3(hTramuVes - kampVes);
    hPozednice = r3(vesadloZvednuti + hPozednice);
  }
  /* Výška hřebene (přímky sedel) nad horní plochou pozednice — fyzická.
     `vyskaStrechy` zůstává „od líce zdi" pro statiku (na bezpečné straně). */
  var vyskaHrebeneNadPoz = r3(vyskaStrechy - odLice*Math.tan(levá.sklonRad));
  /* ── NADEZDÍVKA A ±0 ──────────────────────────────────────────────────
     Modul krovu si odjakživa počítá od horní hrany nadezdívky — jeho
     lokální nula je rovina, na které pozednice leží. Kalkulačka ale měří
     výšky od HRUBÉ PODLAHY (±0) a mezi ní a pozednicí je nadezdívka
     u okapu (zadání PENTI 16. 8. 2026).

     `nadezdivka` je výška té zdi nad ±0. Do teď ji modul vůbec nedostával,
     takže řez ani výkaz nemohly kreslit nic pod pozednicí a výšky se
     nedaly kótovat od podlahy. Sama o sobě NIC nepřepočítává — všechny
     dosavadní vzorce běží dál od pozednice. Slouží k převodu mezi oběma
     soustavami a k tomu, aby šlo zadat uložení vaznic absolutně nad ±0.

     Výchozí 0 = pozednice leží rovnou na stropní desce, tedy přesně to,
     co aplikace počítala dosud. */
  var nadezdivka = n(v.nadezdivkaM) || 0;
  /* Výška libovolné roviny krovu nad ±0. `y` je výška nad pozednicí
     (v soustavě modulu), výsledek je nad hrubou podlahou. */
  var nadNulou = function(y){ return r3(nadezdivka + (y||0)); };
  var tg = Math.tan(a), cs = Math.cos(a);
  /* Horní plocha podpory ve vodorovné vzdálenosti x od pozednice — na každé
     straně má krokev svůj sklon, takže i svou přímku. */
  var vyskaPodporyStrany = function(st, x){ return hPozednice + (x - odLice)*Math.tan(st.sklonRad); };
  var vyskaPodpory = function(x){ return vyskaPodporyStrany(levá, x); };

  /* ── HORNÍ PLOCHA VAZNICE SE ODMĚŘUJE NA VNĚJŠÍ HRANĚ ─────────────────
     Sedlo je vodorovné, takže leží v jedné výšce. Ta vyjde z hloubky
     zářezu — a ta se odměřuje tam, kde je SVISLÝ PAŤAS, tedy na vnější
     hraně vaznice (blíž k okapu). Kdyby se měřila v ose, byl by zářez na
     vnější hraně ve skutečnosti hlubší než zadaný, protože krokev tam
     stoupá.

     Do 20. 8. 2026 se tu měřilo v OSE, zatímco výrobní výkres krokve
     měřil na vnější hraně. Rozdíl (půl šířky × tg sklonu) dělal 46 mm
     při 30° až 80 mm při 45° a projevil se tím, že KÓTY KLEŠTIN neseděly
     na nakreslené hrany úřezu — o 107 mm (nahlásil PENTI ze snímku).
     Vaznice tím klesne, takže sloupky pod ní jsou o tenhle kousek kratší. */
  var bVrcholove = (P.vaznice.b||160)/1000;
  var bStredove  = (P.stredVaznice.b||160)/1000;
  /* Osa vaznice je `xOsa` od pozednice; vnější hrana o půl šířky blíž. */
  var vyskaVaznice = function(xOsa, sirka){
    return vyskaPodpory(xOsa - sirka/2);
  };

  /* ── PROHLOUBENÝ ZÁŘEZ POSADÍ VRCHOLOVOU VAZNICI VÝŠ ──────────────────
     Na vrcholové vaznici musí sedlo doběhnout přesně k ose (tam se krokev
     potká s protilehlou), a proto se zářez v případě potřeby prohlubuje —
     hloubka = půl šířky vaznice × sin(sklon).
     OPRAVA 11. 10. 2026: krokev leží pořád stejně (určuje ji pozednice),
     zářez se do ní řeže ZESPODU. Hlubší zářez proto znamená dosedací
     plochu VÝŠ, tedy i vaznici výš — přesně tak to kreslí výrobní výkres
     krokve (zSedloPodpory). Do 11. 10. 2026 se tu vaznice o stejný kus
     SNIŽOVALA, takže u strmé střechy se širokou vrcholovou vaznicí visela
     o dvojnásobek níž, krokev na ní dosedala jen kouskem a sloupky pod ní
     vycházely kratší (chyceno při kreslení sedel ve 3D). Běžných střech
     (zářez stačí, nic se neprohlubuje) se to netýká. */
  var hloubkaZarezuVrchol = function(){
    var sinR = Math.sin(levá.sklonRad);
    var potreba = (bVrcholove/2) * sinR;
    var mez = hKrokve * 0.5;               // hlouběji než na polovinu ne
    return Math.min(Math.max(sedlo, potreba), mez);
  };
  /* O kolik SVISLE se zvedne sedlo oproti zadané hloubce zářezu. */
  var zdvihSedlaVrchol = function(){
    return (hloubkaZarezuVrchol() - sedlo) / Math.cos(levá.sklonRad);
  };
  /* Horní plocha VRCHOLOVÉ vaznice — vnější hrana i prohloubení zářezu. */
  var vyskaVrcholoveVaznice = function(xOsa){
    return vyskaVaznice(xOsa, bVrcholove) + zdvihSedlaVrchol();
  };

  /* ══════════════════════════════════════════════════════════════════════
     KŘÍDLA L / T — KAŽDÁ ROVINA MÁ SVŮJ HŘEBEN (PENTI 2. 10. 2026, var. 1a+2a)
     ----------------------------------------------------------------------
     Hlavní řez (levá/pravá) se bere ze dvou nejdelších rovin. U střechy L/T
     s užším křídlem má ale křídlo hřeben NÍŽ — a vaznice, sloupky
     i kleštiny křídla se dřív počítaly z hlavního řezu: vrcholová vaznice
     visela nad hřebenem křídla, středová ležela skoro pod ním a kleštiny
     vycházely na pár centimetrů.

     Teď se ke každé rovině zjistí výška JEJÍHO hřebene (stejná míra jako
     `vyskaStrechy`: běh od líce zdi × tg sklonu). Když se od hlavního řezu
     liší o víc než 5 cm, je rovina KŘÍDLO a její vaznice a kleštiny se
     počítají z vlastní výšky. Jinak platí hlavní řez — obdélníkové střechy
     tím vyjdou na milimetr stejně jako dřív.

     Ručně zadané výšky (středové vaznice, kleštin, hambálku) platí jen pro
     hlavní část; křídlo si vaznice dá do půlky svého rozponu (varianta 1a).
     Soustava zůstává stejná jako v hlavní části (varianta 2a). */
  /* ÚSEKY ROVINY. Jedna rovina může patřit oběma částem: u L bývá vnější
     strana souvislá — v široké části jde její horní hrana nárožím až
     k vrcholu, v křídle ji uzavírá nízký hřeben křídla. Proto se rovina
     rozdělí podél okapu (souřadnice u) na úseky, každý s výškou svého
     hřebene:
       · rovina s hřebenem křídla: úsek křídla = rozsah hřebene, rozšířený
         na obě strany, dokud horní hrana roviny nevystoupí nad hřeben
         křídla (na straně hlavní části nastoupá nárožím, na konci křídla
         klesá do valby); zbytek roviny je hlavní část;
       · rovina bez hřebene (valba): celá patří tam, kam sahá její vrchol. */
  var usekyRovin = {};          // číslo roviny → [{od, do, H, kridlo}]
  roviny.forEach(function(p){
    var rings = p.tvarRings || (p.tvar ? [p.tvar] : []);
    var rz = rozsahU(rings);
    var sk = (p.sklon||0)*Math.PI/180, tgR = Math.tan(sk), csR = Math.cos(sk);
    var celek = function(H){
      return [{ od: rz ? rz.min : 0, do: rz ? rz.max : 0, H: H, kridlo: H !== vyskaStrechy, celaRovina: true }];
    };
    if(jenJednaRovina || !rz || !(tgR > 0.01)){ usekyRovin[p.cislo] = celek(vyskaStrechy); return; }
    var presahR = presahRoviny(p);
    /* výška horní hrany roviny v místě u — stejná míra jako vyskaStrechy */
    var Htop = function(u){ return (hranyVU(rings, u).vrch*csR - presahR)*tgR; };
    var lisiSe = function(H){ return Math.abs(H - vyskaStrechy) >= 0.05; };
    var k = kotvyKrokvi[p.cislo];
    if(!k || k.typ !== "hreben"){
      /* valba: kam sahá vrchol roviny */
      var hMax = 0, kroku0 = 200;
      for(var i0=0;i0<=kroku0;i0++){ var h0 = Htop(rz.min + rz.sirka*i0/kroku0); if(h0 > hMax) hMax = h0; }
      usekyRovin[p.cislo] = celek(lisiSe(hMax) ? r3(hMax) : vyskaStrechy);
      return;
    }
    var uA = Math.min(k.uA, k.uB), uB = Math.max(k.uA, k.uB);
    var Hh = Htop((uA + uB)/2);
    if(!lisiSe(Hh)){ usekyRovin[p.cislo] = celek(vyskaStrechy); return; }
    Hh = r3(Hh);
    /* rozšíření úseku křídla od hřebene ven */
    var krok = Math.max(0.01, rz.sirka/400), mez = Hh + 0.02;
    var wOd = uA, wDo = uB;
    while(wOd - krok >= rz.min - 1e-9 && Htop(wOd - krok) <= mez) wOd -= krok;
    while(wDo + krok <= rz.max + 1e-9 && Htop(wDo + krok) <= mez) wDo += krok;
    if(wOd - krok < rz.min) wOd = rz.min;
    if(wDo + krok > rz.max) wDo = rz.max;
    var u = [];
    if(wOd > rz.min + 0.05) u.push({ od: rz.min, do: wOd, H: vyskaStrechy, kridlo: false });
    u.push({ od: wOd, do: wDo, H: Hh, kridlo: true });
    if(wDo < rz.max - 0.05) u.push({ od: wDo, do: rz.max, H: vyskaStrechy, kridlo: false });
    if(u.length === 1) u[0].celaRovina = true;
    usekyRovin[p.cislo] = u;
  });
  /* úsek roviny v místě u (u kleštin a vrcholové vaznice) */
  var usekVU = function(p, uu){
    var us = (p && usekyRovin[p.cislo]) || null;
    if(!us) return { H: vyskaStrechy, kridlo: false };
    for(var i=0;i<us.length;i++) if(uu >= us[i].od - 1e-6 && uu <= us[i].do + 1e-6) return us[i];
    return us[0];
  };
  var maKridla = roviny.some(function(p){ return (usekyRovin[p.cislo]||[]).some(function(x){ return x.kridlo; }); });
  /* ── VAZNICE KŘÍDLA DOBÍHÁ DO VAZNICE HLAVNÍ ČÁSTI (D6d, PENTI 14. 10. 2026)
     Středová vaznice nižšího křídla leží ve STEJNÉ VÝŠCE jako vaznice
     hlavní části. Obě se pak potkají přesně pod úžlabní krokví a spojí se
     rohem (jako u valby), pod rohem stojí sloupek a úžlabní krokev tam má
     sedlo. Rovina, která patří zčásti hlavní části a zčásti křídlu, má
     jednu rovnou vaznici přes celou délku (dřív dvě v různé výšce).
     Vypnuto (`vazniceKridlaDoHlavni` false) = dosavadní pravidlo: křídlo
     má vaznici v půlce své výšky a končí v úžlabí. Tak se počítají
     zakázky uložené dřív (zmrazené).
     Když je některé křídlo tak nízké, že by vaznice ve výšce hlavní části
     byla těsně pod jeho hřebenem, zůstane celá střecha postaru a řekne se to. */
  var hpCilKridla = (function(){
    if(!(v.vazniceKridlaDoHlavni && maKridla)) return null;
    var zad = n(v.vyskaStredVaznice); if(zad > 0) return zad;            // zadaná výška hlavní části
    var uloz = n(v.ulozeniStredoveM);
    if(uloz > 0.05){                                                       // zadané uložení nad ±0
      var hz = uloz - (n(v.nadezdivkaM)||0) - hPozednice + (P.stredVaznice.h||220)/1000;
      if(hz > 0.05) return hz;
    }
    var cil = null;
    roviny.forEach(function(p){
      if(!(usekyRovin[p.cislo]||[{kridlo:false}]).some(function(x){ return !x.kridlo; })) return;
      var tg = Math.tan((p.sklon||0)*Math.PI/180); if(!(tg > 1e-6)) return;
      var hp0 = vyskaStrechy/2 - (bStredove/2 + odLice)*tg;   // výchozí výška vaznice hlavní části (půlí rozpon)
      if(cil == null || hp0 < cil) cil = hp0;
    });
    return cil;
  })();
  var kridlaVHlavni = false;
  /* Křídlo, které je na vaznici ve výšce hlavní části moc nízké (vaznice by
     byla do 0,35 m pod jeho hřebenem), středovou vaznici NEDOSTANE — jeho
     krokve nese pozednice (a vrcholová vaznice, je-li). Ostatní části
     zůstanou v jedné výšce (2026.10.181, porovnání se SEMA na STP_00010:
     malé křídlo tam středovou vaznici také nemá). Dřív se kvůli jednomu
     nízkému křídlu vrátila na staré pravidlo celá střecha. */
  var nizkyUsek = function(x){ return !!(x && x.kridlo && hpCilKridla != null && !(hpCilKridla < x.H - 0.35)); };
  if(hpCilKridla != null){
    var nizkaKridla = [];
    roviny.forEach(function(p){
      (usekyRovin[p.cislo]||[]).forEach(function(x){
        if(nizkyUsek(x) && nizkaKridla.indexOf(p.cislo) < 0) nizkaKridla.push(p.cislo);
      });
    });
    kridlaVHlavni = true;
    if(nizkaKridla.length) upozorneni.push("Křídlo (rovina " + nizkaKridla.join(", ") + ") je na středovou vaznici ve výšce "
      + "hlavní části moc nízké — středovou vaznici nemá, jeho krokve nese pozednice"
      + (S && S.vrchol ? " a vrcholová vaznice" : "") + ". Zkontrolujte rozpětí krokví v posudku.");
  }
  if(maKridla){
    var vyskyKridel = [];
    roviny.forEach(function(p){
      (usekyRovin[p.cislo]||[]).forEach(function(x){
        if(x.kridlo && vyskyKridel.indexOf(r2(x.H)) < 0) vyskyKridel.push(r2(x.H));
      });
    });
    upozorneni.push("Střecha má křídlo s jinou výškou hřebene (" + vyskyKridel.join(", ") + " m proti "
      + r2(vyskaStrechy) + " m nad pozednicí). "
      + (kridlaVHlavni
          ? "Středové vaznice křídla leží ve výšce vaznic hlavní části a potkají se s nimi rohem pod úžlabní krokví; "
            + "vrcholová vaznice a sloupky pod ní se počítají z výšky křídla; "
          : "Vaznice, sloupky a kleštiny křídla se počítají z jeho vlastní výšky; ")
      + "statika a řez vazbou ukazují hlavní část — křídlo "
      + "má kratší krokve, takže je to na bezpečné straně.");
  }
  /* Horní plocha VRCHOLOVÉ vaznice nad pozednicí pro rovinu KŘÍDLA —
     stejný vzorec jako vyskaVrcholoveVaznice, jen z hřebene křídla. */
  var yVrcholoveKridla = function(p, H){
    var sk = (p.sklon||0)*Math.PI/180, tgR = Math.tan(sk);
    var behZdiR = H/tgR;
    var potreba = Math.min(Math.max(sedlo, (bVrcholove/2)*Math.sin(sk)), hKrokve*0.5);
    return hPozednice + (behZdiR - bVrcholove/2 - odLice)*tgR + (potreba - sedlo)/Math.cos(sk);   // zdvih, oprava 11. 10. 2026
  };

  /* --- MEZILEHLÁ VAZNICE U PULTOVÉHO KROVU ---
     Podepře krokev uprostřed rozponu, aby nemusela být tak vysoká. */
  if(S.pult && S.pultVaznice){
    var sirkaPult = r2(roviny[0].sirka_okap||0);
    /* ROZPON MEZI ZDMI — bez přesahů. Vaznice musí stát nad budovou.
       Vaznice má rozpůlit rozpon krokve, proto je výchozí poloha uprostřed
       mezi zdmi a výška z ní vyplývá. Dřív se sem bralo `vyskaVaznice`,
       což je ale výška VRCHOLOVÉ vaznice s výchozími 2,7 m — na plochém
       pultu to vyšlo až za vyšší zeď a sloupky by stály mimo dům. */
    var rozponZdiPult = r2(maxSpad*Math.cos(a) - 2*(n(v.presahOkapVodorovny)||0));
    /* Hlavní veličina je POLOHA, výška se z ní dopočítá. Kdyby se to vzalo
       obráceně, zaokrouhlení výšky na centimetry by u plochých sklonů
       polohu znatelně posunulo — u 10° dělá centimetr výšky skoro 6 cm
       polohy. */
    var xProstredek = r2(rozponZdiPult/2);
    var zadanaVyska = n(v.vyskaVaznicePult);
    var hPult, xPult;
    /* Výška nad dolní pozednicí se měří od její vnější hrany (odsazení od líce). */
    if(zadanaVyska > 0){
      hPult = zadanaVyska;
      xPult = (tg>0.001) ? r2(hPult/tg + odLice) : 0;
    } else {
      xPult = xProstredek;
      hPult = r2((xPult - odLice)*tg);
    }
    var okraj = 0.5;
    if(rozponZdiPult>2*okraj && (xPult < okraj || xPult > rozponZdiPult-okraj)){
      upozorneni.push("Mezilehlá vaznice ve výšce "+hPult+" m by stála "+xPult
        +" m od nižší zdi, což je mimo rozpon "+rozponZdiPult+" m (nebo těsně u zdi). "
        +"Použila se výchozí poloha uprostřed: "+xProstredek+" m od nižší zdi, výška "
        +r2((xProstredek - odLice)*tg)+" m.");
      xPult = xProstredek;
      hPult = r2((xPult - odLice)*tg);
    }
    if(sirkaPult>0.3){
      prvky.push(prvek("vaznice_pult","Mezilehlá vaznice",P.vaznice,[sirkaPult],"model",
        "ve výšce "+hPult+" m nad dolní pozednicí, "+xPult+" m od nižší zdi",true));
      var roztecSlP = n(v.roztecSloupku) || VYCHOZI.roztecSloupku;
      var delkaSlP = r2(hPozednice + hPult - (P.vaznice.h||200)/1000);
      if(delkaSlP > 0.1){
        var pocetSlP = Math.max(2, Math.floor(sirkaPult/roztecSlP)+1);
        prvky.push(oznacCepSloupku(prvek("sloupky_pult","Sloupky pod mezilehlou vaznicí",P.sloupek,
          sloupkySCepem(nKusu(pocetSlP, delkaSlP), P.sloupek),"model","délka vyplývá z osedlání krokve"), P.sloupek));
        /* Pultová střecha má jednu rovinu, vaznice je rovná — bez křížení. */
        var pkP = pasky("pasky_pult","Pásky u sloupků mezilehlé vaznice",
          pocetSlP, 0, delkaPasku, Ppasek, delkaSlP, upozorneni,
          P.vaznice, P.sloupek);
        if(pkP) prvky.push(pkP);
      } else {
        upozorneni.push("Mezilehlá vaznice je tak nízko, že se pod ni sloupek nevejde.");
      }
    }
  }

  /* ── JEDNODUCHÉ VĚŠADLO (přepsáno 22. 9. 2026) ─────────────────────────
     Vazby stojí po několika metrech od sebe. Každá je: vazný trám přes celý
     rozpon na věnci obou zdí, uprostřed věšák (visí na trámu přes třmen)
     a z jeho hlavy dvě vzpěry zapuštěné do trámu nad zdmi. Na koncích
     trámů leží okapové vaznice, na věšácích vrcholová vaznice; na obou
     vaznicích jsou osedlané všechny krokve (plné i jalové vazby).

     Body vazby a spojů počítá modul PentiVesadlo — z týchž čísel kreslí
     řez, výrobní výkresy i DXF a počítá statika. Tady se z nich jen skládá
     výkaz a podpory vaznic.

     Dřív (do 22. 9. 2026) se vazby rozmisťovaly po délce hřebene VČETNĚ
     přesahů za štít, vzpěry mířily na úplný konec trámu (tam zapuštění
     vyříznout nejde) a krokve se počítaly jako u krokvové soustavy
     s přeplátováním v hřebeni — přestože ležely na vaznicích. */
  if(S.vesadlo){
    var delkaBudovy = r2(g.ridge||0);
    var rozponZdi   = rozponZdiVodorovny;   // vazný trám leží mezi vnějšími líci zdí
    var Ves = global.PentiVesadlo;
    var tlZdiVes = ((v.venec && n(v.venec.tloustkaZdiMm)) || 450)/1000;
    var presahStituVes = n(v.presahStitu) || 0;

    if(!Ves){
      upozorneni.push("Chybí modul penti-vesadlo.js — věšadlo se nedá spočítat.");
    } else if(delkaBudovy<0.5 || rozponZdi<1){
      upozorneni.push("Věšadlo se nepodařilo odvodit — z tvaru střechy nevyšel rozumný rozpon nebo délka hřebene.");
    } else {
      if(nesoumerná)
        upozorneni.push("Věšadlo se počítá pro souměrnou střechu — vazba se skládá podle levé strany ("
          + levá.sklonDeg + "°).");
      /* ── KONCE VAZNIC U ŠTÍTU A KRAJNÍ VAZBY (PENTI 23. 9. 2026) ──────
         Volby platí jen u zděných štítů (krokve po štít) — bez nich není
         v modelu žádná štítová zeď a vaznice jdou přes celý přesah. */
      var vrcholUStitu = (zdeneStity && v.vrcholUStitu === "vazba") ? "vazba" : "kapsa";
      var okapUStitu = (zdeneStity && v.okapUStitu === "lic") ? "lic" : "jakoVrchol";
      var krajniVazby = !(zdeneStity && v.krajniVazby === false);
      if(!krajniVazby && (vrcholUStitu === "vazba" || okapUStitu === "lic")){
        upozorneni.push("Věšadlo: bez krajních vazeb musí obě vaznice ležet na štítě (v kapse) — jinak by u štítu nic neneslo. "
          + "Konce vaznic se počítají jako uložené na štítě.");
        vrcholUStitu = "kapsa"; okapUStitu = "jakoVrchol";
      }
      /* Mezera líc zdi → líc trámu (mm) má přednost; staré zakázky znají
         jen osu (`odsazeniVesadlaM`). */
      var bTramM = ((P.tram && P.tram.b) || 200)/1000;
      var odsazeniOsa = (v.mezeraVazbyOdStituMm != null && v.mezeraVazbyOdStituMm !== "")
        ? r3(n(v.mezeraVazbyOdStituMm)/1000 + bTramM/2)
        : ((v.odsazeniVesadlaM != null && v.odsazeniVesadlaM !== "") ? n(v.odsazeniVesadlaM) : VYCHOZI.odsazeniVesadlaM);
      /* Rozmístění vazeb po délce: krajní kousek za štítovou zdí, zbytek
         rovnoměrně. Počet buď zadaný, nebo z osové vzdálenosti. Bez krajních
         vazeb nese štít — podpora ve středu uložení (mezi koncem vaznice
         v kapse a vnitřním lícem zdi). */
      var kapsaVesM = zdeneStity ? zdeneStity.kapsaOdLiceM : 0;
      /* stejné rozmístění, jaké znal rozvrh krokví (jedna funkce, 9. 10. 2026) */
      var rozm = vesadloRozmisteni();
      /* Geometrie vazby v příčném řezu. Výška vrcholové vaznice vyplývá
         z osedlání krokve — stejně jako u sloupků pod vrcholovou vaznicí. */
      var vrcholTop = vyskaVrcholoveVaznice(levá.behZdi);
      var krokevSpodekVes = function(x){
        /* spodní hrana krokve ve vzdálenosti x od líce (levá strana) */
        return hPozednice + (x - odLice)*Math.tan(levá.sklonRad) - sedlo/Math.cos(levá.sklonRad);
      };
      /* poznámka k délce trámu: kam sahá konec */
      var popisKonceTramu = function(vb){
        var t = vb.tram;
        return ((t.ulozeniOdM > 0.0005) ? ("od líce k líci betonu věnce (" + Math.round(t.ulozeniOdM*1000) + " mm za lícem zdi)") : "od líce k líci zdi")
          + (t.presahM > 0.001 ? (" + přesah " + Math.round(t.presahM*1000) + " mm") : "");
      };
      var spoctiVazbu = function(tvMm, thMm, tvPotrebaMm, thPotrebaMm){
        return Ves.vazba({
          S: rozponZdi, xh: levá.behZdi, tlZdi: tlZdiVes,
          profily: { tram:P.tram, vesak:P.sloupekVes, vzpera:P.vzpera,
                     vazniceOkap:P.pozednice, vaznice:P.vaznice },
          odLice: n(v.pozedniceOdLiceM) || 0,
          /* konec trámu na vnějším líci betonu věnce — věncovka + XPS před
             ním nenesou (PENTI 22. 9. 2026); bez skladby věnce = líc zdi */
          tramOdLiceM: (v.venec && n(v.venec.betonOdLiceMm) > 0) ? n(v.venec.betonOdLiceMm)/1000 : 0,
          vrcholTopM: vrcholTop,
          tvMm: tvMm || 0, thMm: thMm || 0,
          /* kolik čela chce statika — když víc než ⅙ h, dvojitá zarážka (30. 9. 2026) */
          tvPotrebaMm: tvPotrebaMm || 0,
          /* kolik čela chce statika v hlavě — nad h/6 dvojité zapuštění (11. 10. 2026) */
          thPotrebaMm: thPotrebaMm || 0,
          presahTramuMm: n(v.presahTramuMm) || 0,
          /* SKLON VZPĚR (PENTI 11. 10. 2026): automaticky / jako krokve /
             zadaný sklon / zadané předsazení paty — modul věšadla posune
             patu dál od zdi, rámový model pak spočítá ohyb trámu pod ní */
          sklonVzperyDeg: (v.vesadloSklonVzper === "krokve") ? levá.sklonDeg
            : ((v.vesadloSklonVzper === "sklon" && n(v.vesadloSklonVzperDeg) > 0) ? n(v.vesadloSklonVzperDeg) : 0),
          predsazeniMm: (v.vesadloSklonVzper === "predsazeni" && n(v.vesadloPredsazeniMm) > 0) ? n(v.vesadloPredsazeniMm) : 0,
          prekrytiTrmenuM: (v.prekrytiPasoviny!=null) ? n(v.prekrytiPasoviny) : VYCHOZI.prekrytiPasoviny,
          /* U pozednice mezi trámy (9. 10. 2026) leží krokve v polích MEZI
             vazbami, ne v rovině vazby — vzpěra se s krokví nepotká, musí jen
             zůstat pod střešní rovinou (horní líc krokví). */
          krokevSpodek: (v.vesadloOkap === "mezi")
            ? function(x){ return krokevSpodekVes(x) + ((P.krokev && P.krokev.h) || 180)/1000/Math.cos(levá.sklonRad); }
            : krokevSpodekVes,
          okapMezi: v.vesadloOkap === "mezi",
          /* přímka, pod kterou musí zůstat konec vazného trámu — jinak se
             seřízne podél krokve (PENTI 9. 10. 2026): u pozednice mezi
             trámy horní líc krokví (střešní rovina), u kampu spodní líc
             krokve (krokev leží v rovině vazby přímo nad trámem) */
          rovinaNadTramem: (v.vesadloOkap === "mezi")
            ? function(x){ return krokevSpodekVes(x) + ((P.krokev && P.krokev.h) || 180)/1000/Math.cos(levá.sklonRad); }
            : krokevSpodekVes
        });
      };
      var vazbaVes = spoctiVazbu(n(v.vesadloTvMm) || 0, n(v.vesadloThMm) || 0);
      (vazbaVes.upozorneni||[]).forEach(function(u){ upozorneni.push("Věšadlo: " + u); });
      (vazbaVes.chyby||[]).forEach(function(u){ upozorneni.push("Věšadlo — CHYBA: " + u); });

      if(!rozm){
        upozorneni.push("Vazby věšadla se nevešly mezi štítové zdi — zkontrolujte délku budovy a odsazení krajní vazby.");
      } else if(!vazbaVes.chyby || !vazbaVes.chyby.length){
        var pocetVazeb = rozm.pocet;
        /* ── KDE KONČÍ VAZNICE (od kraje střechy, na obou koncích stejně) ──
           kapsa  … 100 mm před vnějším lícem štítu (přesah + kapsa)
           vazba  … lícem prvku krajní vazby (osa − ½ věšáku / trámu)
           lic    … vnitřní líc štítové zdi (přesah + tloušťka zdi)
           Bez zděných štítů jdou vaznice přes celý přesah (jako dřív). */
        var pulVesakuM = ((P.sloupekVes && P.sloupekVes.b) || 180)/2000;
        var konecVaznice = function(rezim, pulPrvku){
          /* bez zděných štítů jde vaznice přes celý přesah — štítovou zdí
             tedy prochází (kapsa pro zedníka ano), ve výkrese vaznice se
             nic nevynechává (jako dřív) */
          if(!zdeneStity) return { odKraje:0, popis:"", rezim:"presah", stitOdM:0, kapsa:true };
          if(rezim === "vazba") return { odKraje: r3(rozm.polohy[0] - pulPrvku), rezim:"vazba", kapsa:false, stitOdM:0,
                                         popis:"; končí na krajní vazbě (lícem prvku)" };
          if(rezim === "lic")   return { odKraje: r3(presahStituVes + tlZdiVes), rezim:"lic", kapsa:false, stitOdM:0,
                                         popis:"; končí u vnitřního líce štítu" };
          return { odKraje: r3(presahStituVes + zdeneStity.kapsaOdLiceM), rezim:"kapsa", kapsa:true,
                   stitOdM: r3(tlZdiVes - zdeneStity.kapsaOdLiceM), popis:"; končí v kapsách zděných štítů" };
        };
        var konecVrchol = konecVaznice(vrcholUStitu, pulVesakuM);
        var konecOkap   = konecVaznice(okapUStitu === "lic" ? "lic" : vrcholUStitu, bTramM/2);
        var delkaVrcholVes = r2(delkaBudovy - 2*konecVrchol.odKraje);
        var delkaOkapVes   = r2(delkaBudovy - 2*konecOkap.odKraje);
        /* ── RUČNÍ KONCE POZEDNICE U VĚŠADLA (PENTI 11. 10. 2026: „chci délkově
           zkrátit pozednici k nejbližší kolmé modré čáře, zařezání ale
           nefunguje") ─────────────────────────────────────────────────────
           „Zaříznout k čáře" ukládá Z.krov.koncePozednic[hrana] = { pred, za }
           (o kolik konec přesahuje roh zdi, záporně = zkrácený) — věšadlo to
           dosud ignorovalo, konec určovala jen volba „konec u štítu". Teď:
           každá okapová strana (hrana zdi) má vlastní začátek a konec.
             · strana „leva" = první okapová hrana zdi (rovina 1), „prava" druhá
             · směr po délce budovy bere první okapová hrana; protější hrana
               jde obráceně, takže její „pred" je konec „do"
             · převod: od kraje střechy = přesah štítu − přesah za roh zdi
             · mez: nejdál k vnějšímu líci štítu (u zděného štítu) / ke kraji
               střechy, kus aspoň 0,3 m — co nejde, se ořízne a řekne se to */
        var zedV = v.zed || [], nZ = zedV.length, stitV = {};
        (v.stitoveHrany||[]).forEach(function(i){ stitV[i] = 1; });
        var okapHrany = [];
        for(var iZ=0; iZ<nZ; iZ++) if(!stitV[iZ]) okapHrany.push(iZ);
        var smer = function(i){ var a = zedV[i], b = zedV[(i+1)%nZ]; var dx = b[0]-a[0], dy = b[1]-a[1], d = Math.hypot(dx,dy)||1; return [dx/d, dy/d]; };
        var autoPresah = r3(presahStituVes - konecOkap.odKraje);     // přesah za roh zdi u automatického konce
        var maxPresah = zdeneStity ? 0 : presahStituVes;
        var stranyOkap = {}, okapPozBehy = [], okapRucneOriz = false;
        if(okapHrany.length === 2 && nZ >= 4){
          var d0 = smer(okapHrany[0]);
          okapHrany.forEach(function(hr, iS){
            var kk = v.koncePozednic && v.koncePozednic[hr];
            var pP = autoPresah, pZ = autoPresah, ruc = null;
            if(kk){
              ruc = { pred:false, za:false, oriznuto:false };
              var omez = function(x){ var h = Math.max(Math.min(+x, maxPresah), -(delkaBudovy)); if(Math.abs(h - (+x)) > 0.0005) ruc.oriznuto = true; return h; };
              if(kk.pred != null && isFinite(+kk.pred)){ pP = omez(kk.pred); ruc.pred = true; }
              if(kk.za != null && isFinite(+kk.za)){ pZ = omez(kk.za); ruc.za = true; }
            }
            var souhlas = (smer(hr)[0]*d0[0] + smer(hr)[1]*d0[1]) > 0;
            var od = r3(presahStituVes - (souhlas ? pP : pZ)), doK = r3(presahStituVes - (souhlas ? pZ : pP));
            /* kus aspoň 0,3 m */
            if(delkaBudovy - od - doK < 0.3){ var o2 = (delkaBudovy - 0.3)/2; od = Math.min(od, o2); doK = Math.min(doK, o2); if(ruc) ruc.oriznuto = true; }
            if(ruc && ruc.oriznuto) okapRucneOriz = true;
            stranyOkap[iS ? "prava" : "leva"] = { hrana:hr, odKrajeM:od, doKrajeM:doK, delkaM:r2(delkaBudovy - od - doK), rucne:ruc };
            var a = zedV[hr], b = zedV[(hr+1)%nZ];
            okapPozBehy.push({ hrana:hr, delkaZdi:r2(Math.hypot(b[0]-a[0], b[1]-a[1])),
                               presahPred:r3(presahStituVes - (souhlas ? od : doK)), presahZa:r3(presahStituVes - (souhlas ? doK : od)),
                               delka:r2(delkaBudovy - od - doK), rucne:ruc });
          });
        }
        var maRucneOkap = Object.keys(stranyOkap).some(function(k){ return stranyOkap[k].rucne; });
        if(okapRucneOriz) upozorneni.push("Věšadlo: ruční konec pozednice / okapové vaznice by vyšel za líc štítu (kraj střechy) nebo by kus byl kratší než 0,3 m — upraven na mez.");
        /* půdorys a editor kreslí ruční konce (ne pozedniceBehy — z těch by
           vznikl výrobní výkres obyčejné pozednice) */
        if(maRucneOkap) pozedniceBehyVes = okapPozBehy;
        /* ── RUČNÍ KONCE VRCHOLOVÉ VAZNICE U VĚŠADLA (PENTI 11. 10. 2026:
           „mrkni se na funkčnost zařezání délky vaznic k pomocné čáře,
           nefunguje to") ───────────────────────────────────────────────
           „Zaříznout k čáře" ukládá konceVaznic.vrchol = { odA, odB } (o kolik
           se vaznice na konci A / B hřebene zkrátí navíc). U věšadla se to
           dosud nepoužilo — délku dávala jen volba „konec u štítu". Teď se
           přičte ke konci u štítu; konec A hřebene = začátek po délce budovy,
           když hřeben jde stejným směrem jako první okapová hrana. */
        var kVrV = v.konceVaznic && v.konceVaznic.vrchol;
        var konecVrcholDo = konecVrchol;                 // konec „do" (u symetrie stejný)
        var konecVrcholAuto = konecVrchol;               // bez ručních konců — pro půdorys (ten přičte ruční sám)
        if(kVrV){
          var segH = (g.segs||[]).filter(function(sg){ return sg.type === "hreben"; });
          var dA = isFinite(+kVrV.odA) ? +kVrV.odA : 0, dB = isFinite(+kVrV.odB) ? +kVrV.odB : 0;
          if(segH.length === 1 && okapHrany.length === 2){
            var dH = [segH[0].B[0]-segH[0].A[0], segH[0].B[1]-segH[0].A[1]], d0V = smer(okapHrany[0]);
            var souhlasH = (dH[0]*d0V[0] + dH[1]*d0V[1]) >= 0;
            var pOd = souhlasH ? dA : dB, pDo = souhlasH ? dB : dA;
            var novaD = r2(delkaBudovy - konecVrchol.odKraje - pOd - konecVrchol.odKraje - pDo);
            if(novaD > 0.5){
              /* kus ve zdi štítu (bez dlabů pásků) se zkrátí o zaříznutí
                 (13. 10. 2026); výkres ho dělá na obou koncích stejně →
                 bere se delší zbytek (méně zaříznutý konec) */
              var veZdiPo = r3(Math.max(0, (konecVrchol.stitOdM||0) - Math.max(0, Math.min(pOd, pDo))));
              konecVrchol = Object.assign({}, konecVrchol, { odKraje: r3(konecVrchol.odKraje + pOd), stitOdM: veZdiPo,
                popis: konecVrchol.popis + "; ručně zaříznutá" });
              konecVrcholDo = Object.assign({}, konecVrcholDo, { odKraje: r3(konecVrcholDo.odKraje + pDo) });
              delkaVrcholVes = novaD;
              vrcholRucneVes = { odA: r3(dA), odB: r3(dB) };
              /* vaznice musí ležet na krajních vazbách — jinak visí */
              var pulVes = ((P.sloupekVes && P.sloupekVes.b) || 180)/2000;
              if(rozm.polohy.length && (konecVrchol.odKraje > rozm.polohy[0] - pulVes + 0.001
                 || konecVrcholDo.odKraje > delkaBudovy - rozm.polohy[rozm.polohy.length-1] - pulVes + 0.001))
                upozorneni.push("Vrcholová vaznice je zaříznutá za krajní vazbou — na konci nemá podporu (věšák). Zaříznutí posuňte za vazbu.");
              else upozorneni.push("Vrcholová vaznice je ručně zaříznutá — krokve za jejím koncem na ní neleží; zkontrolujte, že mají jinou podporu.");
            } else upozorneni.push("Vrcholová vaznice: ruční konce by ji zkrátily pod 0,5 m — nepoužily se.");
          } else upozorneni.push("Ruční konce vrcholové vaznice jdou zatím jen u jednoho přímého hřebene — nepoužily se.");
        }
        /* Okapové vaznice — na koncích trámů. */
        if(v.vesadloOkap === "mezi"){
          /* POZEDNICE MEZI TRÁMY (PENTI 9. 10. 2026): leží na věnci, kusy
             od konce u štítu k boku prvního trámu, mezi boky trámů a od
             posledního trámu ke konci — na každé straně. K trámu tesařský
             úhelník, do věnce kotvy (spojovák). */
          var kusyPoz = [], odP = konecOkap.odKraje, doP = delkaBudovy - konecOkap.odKraje;
          /* kusy mezi trámy pro jednu stranu (od / do = od kraje střechy);
             ruční konce (11. 10. 2026) — každá strana zvlášť */
          var kusyStrany = function(odS, doS){
            var hranyT = [odS], out = [];
            rozm.polohy.slice().sort(function(a,b){ return a-b; }).forEach(function(u){
              hranyT.push(u - bTramM/2, u + bTramM/2); });
            hranyT.push(doS);
            for(var iP=0; iP+1<hranyT.length; iP+=2){
              var dP = r3(Math.min(doS, hranyT[iP+1]) - Math.max(odS, hranyT[iP]));
              if(dP > 0.05) out.push(dP);
            }
            return out;
          };
          if(maRucneOkap && stranyOkap.leva && stranyOkap.prava){
            ["leva","prava"].forEach(function(st){ var q = stranyOkap[st];
              kusyPoz = kusyPoz.concat(kusyStrany(q.odKrajeM, delkaBudovy - q.doKrajeM)); });
          } else {
            kusyStrany(odP, doP).forEach(function(dP){ kusyPoz.push(dP, dP); });   // levá i pravá strana
          }
          vazbaVes.pozedniceMezi = { kusu: kusyPoz.length, polohyTramu: rozm.polohy.slice(), bTramuM: bTramM, odM: r3(odP), doM: r3(doP) };
          prvky.push(prvek("vaznice_okap","Pozednice mezi vaznými trámy",P.pozednice,
            kusyPoz,"model",
            "leží na věnci mezi vaznými trámy (střecha o " + Math.round(((P.tram.h||280) - 30)) + " mm níž než s vaznicí v kampu); "
            + "k trámu tesařský úhelník, do věnce kotvy; krokve na ní osedlané, v polích mezi trámy" + konecOkap.popis,true));
        } else
        prvky.push(prvek("vaznice_okap","Okapové vaznice",P.pozednice,
          (maRucneOkap && stranyOkap.leva && stranyOkap.prava) ? [stranyOkap.leva.delkaM, stranyOkap.prava.delkaM] : [delkaOkapVes, delkaOkapVes],"model",
          "leží na koncích vazných trámů nad zdmi (kamp " + vazbaVes.kampMm + " mm); krokve na nich osedlané" + konecOkap.popis,true));
        prvky.push(prvek("vaznice_vrchol","Vrcholová vaznice",P.vaznice,
          [delkaVrcholVes],"model","leží na hlavách věšáků (čep)" + konecVrchol.popis
          + (rozm.bezKrajnich ? "; bez krajních vazeb — u štítů nese zeď" : ""),true));
        prvky.push(prvek("vazny_tram","Vazné trámy",P.tram,
          nKusu(pocetVazeb, vazbaVes.tram.delkaM),"model",
          popisKonceTramu(vazbaVes) + "; TAŽENÝ, zapuštění vzpěr " + vazbaVes.tvMm + " mm"));
        /* Věšák se objednává o čep delší — čep jde do vrcholové vaznice. */
        /* horní čep věšáku — společné pravidlo PentiSpoje.cepVesaku (11. 10. 2026) */
        var cepVes = global.PentiSpoje.cepVesaku((P.sloupekVes&&P.sloupekVes.h)||180, (P.vaznice&&P.vaznice.b)||160).delkaMm;
        prvky.push(prvek("sloupek_ves","Věšáky",P.sloupekVes,
          /* délka = tělo + horní čep do vaznice + spodní čep do trámu (9. 10. 2026) */
          nKusu(pocetVazeb, r3(vazbaVes.vesak.delkaM + cepVes/1000 + ((vazbaVes.vesak.cepDole && vazbaVes.vesak.cepDole.delkaMm) || 0)/1000)),"model",
          "visí na trámu přes třmen (mezera " + vazbaVes.vesak.mezeraMm + " mm), nahoře čep "
          + cepVes + " mm do vrcholové vaznice; TAŽENÝ"));
        prvky.push(prvek("vzpery_ves","Vzpěry věšadla",P.vzpera,
          nKusu(2*pocetVazeb, vazbaVes.delkaVzperyM),"model",
          "z hlavy věšáku do trámu nad zdí, sklon " + vazbaVes.sklonVzperyDeg + "°; TLAČENÉ"));

        /* Pásky u věšáků pod vrcholovou vaznicí — v podélné rovině.

           PÁSEK, KTERÝ BY VJEL DO ŠTÍTOVÉ ZDI, SE NEDĚLÁ (PENTI 22. 9. 2026).
           Krajní vazba stojí jen odsazení (150 mm) od vnitřního líce štítu.
           Pásek směrem ke štítu by po vaznici uběhl náběh (≈ 0,95 m) —
           rovnou do zdiva. Do 22. 9. 2026 se počítal (8 kusů u 198_25,
           osadit šlo 6); vizualizace ho nekreslila, výkaz ho měl.
           Zeď je tam vždy (přesah štítu + tloušťka zdi od kraje střechy),
           i bez zaškrtnutých zděných štítů. */
        var nabehVes = delkaPasku > 0 ? delkaPasku/Math.SQRT2 : 0;
        var pulVesaku = pulVesakuM;
        /* Pásek potřebuje vaznici, pod kterou se opře: konec náběhu nesmí
           být ve zdi ANI za koncem vaznice (vaznice končící na krajní
           vazbě, 23. 9. 2026). */
        var licStituOd = Math.max(presahStituVes + tlZdiVes, konecVrchol.odKraje);
        var licStituDo = delkaBudovy - licStituOd;
        var paskuUStitu = 0;
        if(nabehVes > 0) rozm.polohy.forEach(function(u){
          if(u - pulVesaku - nabehVes < licStituOd - 1e-6) paskuUStitu++;
          if(u + pulVesaku + nabehVes > licStituDo + 1e-6) paskuUStitu++;
        });
        var pkVes = pasky("pasky_vrchol","Pásky u věšáků",
          pocetVazeb, 0, delkaPasku, Ppasek, vazbaVes.vesak.delkaM, upozorneni,
          P.vaznice, P.sloupekVes, paskuUStitu);
        if(pkVes) prvky.push(pkVes);

        /* Podpory obou vaznic = vazby (+ konzoly k štítu a přes přesah).
           Ze stejného seznamu čte statika (spojitý nosník) i půdorys. */
        /* `konecDo` (13. 10. 2026) = konec na druhém konci, když se liší
           (ručně zaříznutá okapová vaznice); jinak symetricky `konec` */
        var podpVes = function(kod, nazev, profil, konec, delka, konecDo){
          konecDo = konecDo || konec;
          /* polohy vazeb se měří od začátku VAZNICE — u zděného štítu je
             o kapsu a přesah dál než kraj střechy. Bez krajních vazeb jsou
             krajní pole od uložení ve štítu k první vazbě (statika je počítá
             jako pole, ne konzoly). */
          var podp = { pocetSloupku: pocetVazeb, poli: rozm.pole.length,
                       roztecSkutecna: rozm.osovaM, roztecZadana: n(v.osovaVesadel) || VYCHOZI.osovaVesadel,
                       polohy: rozm.polohy.map(function(u){ return r3(u - konec.odKraje); }),
                       pole: rozm.pole.slice(), delka: delka,
                       konzolyM: rozm.bezKrajnich ? 0 : r2((rozm.konzolaM - konec.odKraje) + (rozm.konzolaM - konecDo.odKraje)),
                       vesadlo: true,
                       /* konec u štítu: kapsa / vazba / lic / presah; `stitOdM` = kus od
                          konce zapuštěný ve zdi (bez dlabů pásků) */
                       konecUStitu: konec.rezim, stitOdM: konec.stitOdM, kapsa: konec.kapsa,
                       podporaStitu: !!rozm.bezKrajnich };
          return Object.assign({ kod:kod, nazev:nazev, profil:profil,
            statika: statikaVaznice(podp, profil, n(v.maxDelkaKusu)||13, v.modelVaznice==="prosty") }, podp);
        };
        /* pozednice mezi trámy leží celou délkou na věnci — není to nosník
           mezi trámy, statika vaznice se neposuzuje (9. 10. 2026) */
        /* OKAPOVÁ VAZNICE S RUČNÍMI KONCI (PENTI 13. 10. 2026: „zkrátil jsem
           uložení … ve výrobních výkresech je ale stále původní délka"):
           výkaz bral ruční konce (stranyOkap) od 11. 10., ale podpora — ze
           které je výrobní výkres i statika — měla dál automatickou délku.
           Teď podpora z ručních konců: obě strany stejně → jedna podpora
           (2 kusy) jako dřív; každá jinak → dvě podpory (levá / pravá).
           Kus ve zdi štítu (bez dlabů) se zkrátí o kolik se konec zkrátil. */
        var konecZeStrany = function(odKraje){
          return Object.assign({}, konecOkap, { odKraje: odKraje,
            stitOdM: r3(Math.max(0, (konecOkap.stitOdM||0) - Math.max(0, odKraje - konecOkap.odKraje))) });
        };
        var podporaOkapStrany = function(st, nazev){
          var kOd = konecZeStrany(st.odKrajeM), kDo = konecZeStrany(st.doKrajeM);
          var pv = podpVes("vaznice_okap", nazev, P.pozednice, kOd, st.delkaM, kDo);
          pv.stitOdM = r3(Math.max(kOd.stitOdM, kDo.stitOdM));   // výkres dělá kus ve zdi na obou koncích stejně → ten delší
          pv.rucneKonce = true;
          return pv;
        };
        if(v.vesadloOkap !== "mezi"){
          var sL = maRucneOkap && stranyOkap.leva, sP = maRucneOkap && stranyOkap.prava;
          if(sL && sP && Math.abs(sL.odKrajeM - sP.odKrajeM) < 0.0005 && Math.abs(sL.doKrajeM - sP.doKrajeM) < 0.0005)
            podporyVaznic.push(podporaOkapStrany(sL, "Okapová vaznice"));
          else if(sL && sP){
            podporyVaznic.push(podporaOkapStrany(sL, "Okapová vaznice — levá strana"));
            podporyVaznic.push(podporaOkapStrany(sP, "Okapová vaznice — pravá strana"));
          }
          else podporyVaznic.push(podpVes("vaznice_okap","Okapová vaznice",P.pozednice, konecOkap, delkaOkapVes));
        }
        podporyVaznic.push(podpVes("vaznice_vrchol","Vrcholová vaznice",P.vaznice, konecVrchol, delkaVrcholVes));
        /* Pro půdorys, štít pro zedníky a vizualizaci: kde vaznice končí
           (od VNĚJŠÍHO líce štítu dovnitř) a jestli mají kapsu. */
        if(zdeneStity) zdeneStity.vesadlo = {
          vrcholOdLiceM: r3(konecVrcholAuto.odKraje - presahStituVes), okapOdLiceM: r3(konecOkap.odKraje - presahStituVes),
          vrcholKapsa: konecVrchol.kapsa, okapKapsa: konecOkap.kapsa,
          vrcholUStitu: konecVrchol.rezim, okapUStitu: konecOkap.rezim, krajniVazby: !rozm.bezKrajnich
        };

        /* Třmen = ocel na běžný metr (účtuje se zvlášť, ne z kubatury). */
        var trm = vazbaVes.vesak.trmen;
        vesadloGeo = Object.assign({}, vazbaVes, {
          rozponZdi: rozponZdi, pocetVazeb: pocetVazeb,
          osova: rozm.osovaM, zadanaOsova: n(v.osovaVesadel) || VYCHOZI.osovaVesadel,
          rozmisteni: rozm, delkaBudovy: delkaBudovy,
          /* konce vaznic (od kraje střechy) — kreslí z toho půdorys, podélný
             řez a vizualizace; `kapsa` říká, jestli jde vaznice do zdi */
          konceVaznic: { vrchol: { odKrajeM: konecVrchol.odKraje, doKrajeM: konecVrcholDo.odKraje, rucne: !!kVrV && konecVrchol !== konecVrcholAuto, delkaM: delkaVrcholVes, rezim: konecVrchol.rezim, kapsa: konecVrchol.kapsa },
                         okap:   { odKrajeM: konecOkap.odKraje,   delkaM: delkaOkapVes,   rezim: konecOkap.rezim,   kapsa: konecOkap.kapsa,
                                   /* ruční konce po stranách (11. 10. 2026) — 3D a půdorys */
                                   strany: maRucneOkap ? stranyOkap : null },
                         krajniVazby: !rozm.bezKrajnich, mezeraVazbyOdStituMm: Math.round((odsazeniOsa - bTramM/2)*1000) },
          vzepeti: r2(vazbaVes.vesak.yNahoreM - vazbaVes.tram.hM),
          sklonVzpery: vazbaVes.sklonVzperyDeg, delkaVzpery: vazbaVes.delkaVzperyM,
          cepVesakuMm: cepVes,
          pasovina: { kusu: pocetVazeb, delkaKusu: trm.delkaM, bm: r2(pocetVazeb*trm.delkaM),
                      popis: "třmen z pásoviny 60×8 kolem trámu, 2× M" + trm.svornikuMm + " ve věšáku" }
        });
        /* NÁVRH HLOUBKY ZAPUŠTĚNÍ. Geometrie začíná s pětinou výšky trámu;
           když statika spočítá, že otlačení čela potřebuje víc, spočítá se
           vazba znovu s hlubším zapuštěním (jen tam, kde tesař hloubku
           nezadal ručně) a statika se přepočítá. */
        vesadloPrepocet = function(tvPotreba, thPotreba){
          /* Zarážka v trámu: ručně zadaná hloubka platí; jinak se modulu
             věšadla předá POTŘEBA statiky a ten sám zvolí čelní ⅙ h nebo
             dvojitou zarážku (kniha spojů PENTI, 30. 9. 2026). */
          var rucneTv = n(v.vesadloTvMm) > 0;
          var chceTv = !rucneTv && (tvPotreba || 0) > (vazbaVes.tvEfMm || vazbaVes.tvMm);
          /* Hlava věšáku stejně (11. 10. 2026): ručně zadaná hloubka platí,
             jinak modul dostane potřebu statiky a sám zvolí čelní / dvojité
             zapuštění v mezi h/6. */
          /* Ručně zadaná hloubka = zadní čelo; když statika chce víc, modul
             přidá přední čelo (dvojité zapuštění) — PENTI 11. 10. 2026. */
          var rucneTh = n(v.vesadloThMm) > 0;
          var chceTh = (thPotreba || 0) > (vazbaVes.thEfMm || vazbaVes.thMm);
          if(!chceTv && !chceTh) return false;
          var nova = spoctiVazbu(rucneTv ? n(v.vesadloTvMm) : 0, rucneTh ? n(v.vesadloThMm) : 0,
                                 chceTv ? tvPotreba : 0,
                                 Math.max(thPotreba || 0, vazbaVes.thEfMm || vazbaVes.thMm || 0));
          var tvN = nova ? (nova.zarazka && nova.zarazka.druh === "dvojita"
                     ? ("dvojitá zarážka " + nova.zarazka.celniHloubkaMm + " + " + nova.tvMm) : nova.tvMm) : "?";
          if(!nova || (nova.chyby && nova.chyby.length)){
            (nova && nova.chyby || []).forEach(function(u){ upozorneni.push("Věšadlo — CHYBA při návrhu zapuštění: " + u); });
            return false;
          }
          vazbaVes = nova;
          Object.assign(vesadloGeo, nova, {
            sklonVzpery: nova.sklonVzperyDeg, delkaVzpery: nova.delkaVzperyM,
            vzepeti: r2(nova.vesak.yNahoreM - nova.tram.hM)
          });
          for(var i=0;i<prvky.length;i++){
            if(prvky[i].kod === "vzpery_ves")
              prvky[i] = prvek("vzpery_ves","Vzpěry věšadla",P.vzpera, nKusu(2*pocetVazeb, nova.delkaVzperyM),"model",
                "z hlavy věšáku do trámu nad zdí, sklon " + nova.sklonVzperyDeg + "°; TLAČENÉ");
            if(prvky[i].kod === "vazny_tram")
              prvky[i] = prvek("vazny_tram","Vazné trámy",P.tram, nKusu(pocetVazeb, nova.tram.delkaM),"model",
                popisKonceTramu(nova) + "; TAŽENÝ, " + (nova.zarazka ? nova.zarazka.nazev : "zapuštění vzpěr") + " "
                + (nova.zarazka && nova.zarazka.druh === "dvojita" ? (nova.zarazka.celniHloubkaMm + " + ") : "")
                + nova.tvMm + " mm (navrženo statikou)");
          }
          var thN = (nova.hlava && nova.hlava.druh === "dvojite")
            ? ("dvojité zapuštění " + nova.hlava.predniHloubkaMm + " + " + nova.thMm) : nova.thMm;
          upozorneni.push("Věšadlo: zapuštění vzpěr navrženo statikou na " + tvN + " mm v trámu a " + thN + " mm v hlavě věšáku.");
          return true;
        };
        if(n(v.pocetVesadel) > 0 && rozm.osovaM > (n(v.osovaVesadel) || VYCHOZI.osovaVesadel) + 0.05)
          upozorneni.push("Vazby věšadla jsou po " + rozm.osovaM + " m — víc než zadaná osová vzdálenost "
            + (n(v.osovaVesadel) || VYCHOZI.osovaVesadel) + " m. Rozhoduje zadaný počet " + pocetVazeb + " ks.");
      }
    }
  }

  /* Ocelové rámy — pod středovými (23. 9. 2026) nebo pod vrcholovou
     vaznicí (25. 9. 2026). Deklaruje se tady, před oběma větvemi. */
  var ramyGeo = null;
  /* ── VĚNEC POD PATOU RÁMU (PENTI 29. 9. 2026) ─────────────────────────
     „Detail kotvení neodpovídá skladbě věnce. Patní plech má otvory mimo
     beton." Pata rámu stojí UPROSTŘED BETONU věnce (věncovky a XPS jsou
     jen ztracené bednění), pozednice se v místě rámu přeruší (varianta A).
     Tady se jen sesbírá, kde beton je; tvar plechu a kotvy řeší penti-ram.js. */
  var venecPodRamem = function(){
    var VN = v.venec || {};
    var tlM = ((n(VN.tloustkaZdiMm)) || 450)/1000;
    var betOdMm = n(VN.betonOdLiceMm) || 0;
    var betMm = n(VN.sirkaMm) || Math.round(tlM*1000 - betOdMm);
    return { tlZdiM: r3(tlM), betonOdLiceMm: betOdMm, betonMm: betMm,
             pataStredM: r3((betOdMm + betMm/2)/1000),
             /* rám pod vrcholovou vaznicí: co nejvíc dovnitř (ať jde rovnoběžně
                s krokvemi), ale kotvy nejméně 100 mm od vnitřní hrany betonu
                a nikdy blíž k líci než střed betonu */
             pataVrcholM: r3(Math.max(betOdMm + betMm/2, betOdMm + betMm - 100)/1000),
             vencovkaVenMm: n(VN.vencovkaVenMm) || 0, izolaceMm: n(VN.izolaceMm) || 0, vyskaMm: n(VN.vyskaMm) || 250,
             pozedniceOdLiceMm: Math.round((n(v.pozedniceOdLiceM) || 0)*1000),
             pozedniceBMm: (P.pozednice && P.pozednice.b) || 140, pozedniceHMm: (P.pozednice && P.pozednice.h) || 160 };
  };
  /* ══ OCELOVÁ VAZNICE — NÁVRH A POSUDEK (2. 10. 2026) ════════════════════
     Zatížení stejné jako u dřeva (zatizeniKrovu), zatěžovací šířka stejná
     jako ve statice krovu: vrcholová bere zbytek pole od středových vaznic
     z obou stran, středová polovinu běhu své strany. Pole = nejdelší pole
     mezi sloupky, součinitele spojitého nosníku z `statikaVaznice`.
     Vrací profil, posudek a síly do sloupku (tlak + tah od sání). */
  var zatizeniOcel = null;
  var zatizeniProOcel = function(){
    if(!zatizeniOcel) zatizeniOcel = zatizeniKrovu({
      sklonDeg: levá.sklonDeg, roztecKrokvi: roztecProPosudek, profilKrokve: P.krokev,
      snehOblast: n(v.snehOblast) || 2, vitrOblast: n(v.vitrOblast) || 2, teren: v.teren || "III",
      hmotnostKrytinyKgM2: (v.hmotnostKrytinyKgM2 != null) ? n(v.hmotnostKrytinyKgM2) : 45,
      podhledKNm2: n(v.podhledKNm2) || 0 });
    return zatizeniOcel;
  };
  var sirkaVrcholove = function(){
    var s = 0;
    (jenJednaRovina ? [levá] : [levá, pravá]).forEach(function(st){
      var xs = 0;
      if(S.stred) xs = (vyskaStrechy/2)/Math.tan(st.sklonRad);          // středová v půlce rozponu
      s += (st.behZdi - xs)/2;
    });
    return s;
  };
  var navrhOcelVaznice = function(kod, rada, rucne, polePodpor, sirkaM, nazev){
    var Zk = zatizeniProOcel(); if(!Zk || !OCEL) return null;
    var stat = statikaVaznice(polePodpor, P.vaznice, n(v.maxDelkaKusu)||13, v.modelVaznice === "prosty");
    var prosty = !!(stat && stat.model === "prosty");
    var pole = (polePodpor.pole && polePodpor.pole.length) ? Math.max.apply(null, polePodpor.pole) : polePodpor.delka;
    var cV = prosty ? 0.5 : ((stat && stat.nosnik && stat.nosnik.Vmax && pole > 0) ? stat.nosnik.Vmax/pole : 0.625);
    var vstup = { rada:rada, rozpetiM:pole, wUls:Zk.qUlsPresne*sirkaM, wSls:Zk.qSlsPresne*sirkaM,
                  wSaniUls:Math.max(0, Zk.qTahPresne||0)*sirkaM, wStaleUp:0,
                  soucinitelM: prosty ? 1/8 : (stat && stat.soucinitelM), soucinitelW: prosty ? 5/384 : (stat && stat.soucinitelW),
                  soucinitelV: cV, model: prosty ? "prosty" : "spojity", roztecKrokviM: roztec };
    var profil = (rucne && OCEL.rada(rucne) === rada) ? rucne : null, navrzen = false;
    if(!profil){
      var nv = OCEL.navrhVaznice(vstup);
      profil = nv.profil; navrzen = true;
      if(!profil){
        profil = OCEL.profilyRady(rada).slice(-1)[0];
        ocelUpozorneni.push(nazev + ": ani největší profil řady nevyhoví — ocel musí navrhnout statik.");
      }
    }
    var pos = OCEL.posudekVaznice(Object.assign({}, vstup, { profil:profil }));
    /* síla do sloupku: reakce spojitého nosníku ≈ 1,1·w·L (prostý ½ + ½ pole),
       stejně jako u dřevěných sloupků; tah od sání stejným součinitelem */
    var reakceUnit = (stat && (stat.model === "prosty" || stat.model === "styky")) ? stat.reakceUnit : REAKCE_SPOJITEHO*pole;
    var wU = vstup.wUls + 1.35*pos.vlastniTihaKNm;
    var wUp = Math.max(0, vstup.wSaniUls - pos.vlastniTihaKNm);
    pos.radky.forEach(function(r){ r.nazev = nazev + " — " + r.nazev.replace(/^[^—]+— /, ""); r.prvek = "ocel_" + kod; });
    return { kod:kod, rada:rada, profil:profil, navrzen:navrzen, prurez:pos.profil, posudek:pos,
             poleM:r3(pole), sirkaM:r3(sirkaM), NEdKN:r2(reakceUnit*wU), NupKN:r2(reakceUnit*wUp),
             hM:pos.profil.h/1000,
             /* pro statický protokol: zatížení na vaznici a statický model */
             wUls:r3(vstup.wUls), wSls:r3(vstup.wSls), wSaniUls:r3(vstup.wSaniUls),
             model:vstup.model, soucinitelM:vstup.soucinitelM, soucinitelW:vstup.soucinitelW, soucinitelV:vstup.soucinitelV,
             reakceUnit:r3(reakceUnit), qUls:r3(Zk.qUlsPresne), qSls:r3(Zk.qSlsPresne), qTah:r3(Zk.qTahPresne||0) };
  };
  /* Síly do sloupku z jeklu pod DŘEVĚNOU vaznicí (3. 10. 2026) — stejně
     jako u ocelové vaznice (navrhOcelVaznice): zatížení krovu × zatěžovací
     šířka, reakce spojitého nosníku ≈ 1,1·w·L (prostý: z modelu), plus
     vlastní tíha dřevěné vaznice (5 kN/m³). Tah od sání zmenšený o tíhu. */
  var reakceDrevVaznice = function(kod, profil, sirkaM, nazev){
    var Zk = zatizeniProOcel(); if(!Zk) return null;
    var podp = podporyVaznic.filter(function(q){ return q.kod === kod; });
    var pole = [].concat.apply([], podp.map(function(q){ return q.pole || []; }));
    var L = pole.length ? Math.max.apply(null, pole) : 0;
    if(!(L > 0)) return null;
    var stat = podp[0] && podp[0].statika;
    var reakceUnit = (stat && (stat.model === "prosty" || stat.model === "styky")) ? stat.reakceUnit : REAKCE_SPOJITEHO*L;
    var g = (profil.b||160)/1000*(profil.h||200)/1000*5;     // kN/m
    var wU = Zk.qUlsPresne*sirkaM + 1.35*g;
    var wUp = Math.max(0, Math.max(0, Zk.qTahPresne||0)*sirkaM - g);
    return { kod:kod, nazev:nazev, drevo:{ b:profil.b||160, h:profil.h||200 }, profil:null,
             poleM:r3(L), sirkaM:r3(sirkaM), reakceUnit:r3(reakceUnit),
             NEdKN:r2(reakceUnit*wU), NupKN:r2(reakceUnit*wUp) };
  };
  /* Jekl, pata a hlava pro sloupky pod ocelovou vaznicí. `vyskaM` = světlá
     výška od stropu ke spodku vaznice; jekl je o oba plechy kratší. */
  var navrhOcelSloupku = function(vaz, vyskaM, nazev){
    if(!vaz || !OCEL || !(vyskaM > 0.2)) return null;
    var rucne = (ocelV.jekl && OCEL.jekl(ocelV.jekl)) ? ocelV.jekl : null;
    var j = rucne || (OCEL.navrhSloupku({ NEd:vaz.NEdKN, vyskaM:vyskaM, minRozmerMm:80 }).jekl || "200x8");
    var sl = OCEL.posudekSloupku({ jekl:j, NEd:vaz.NEdKN, vyskaM:vyskaM });
    var pata = OCEL.posudekPaty({ jekl:j, NEd:sl.NEd, NupEd:vaz.NupKN, VEd:0 });
    /* dřevěná vaznice → U-třmen se svorníky; ocelová → hlava do pásnice */
    var hlava = vaz.drevo
      ? OCEL.posudekHlavyDrevo({ jekl:j, bMm:vaz.drevo.b, hMm:vaz.drevo.h, NEd:vaz.NEdKN, NupEd:vaz.NupKN })
      : OCEL.posudekHlavy({ jekl:j, profil:vaz.profil, NEd:vaz.NEdKN, NupEd:vaz.NupKN });
    /* název posudku vždy začíná tím, KTERÝCH sloupků se týká */
    var tag = function(rr, kod){ (rr||[]).forEach(function(r){ r.prvek = kod;
      r.nazev = /^Sloupek /.test(r.nazev) ? r.nazev.replace(/^Sloupek /, nazev + " — ") : nazev + " — " + r.nazev; }); return rr || []; };
    tag(sl.radky, "ocel_sloupek"); tag(pata.radky, "ocel_pata"); tag(hlava.radky, "ocel_hlava");
    var delkaJeklu = r3(vyskaM - pata.plech.t/1000 - hlava.plech.t/1000);
    (pata.upozorneni||[]).concat(hlava.upozorneni||[]).forEach(function(u){ if(ocelUpozorneni.indexOf(u) < 0) ocelUpozorneni.push(u); });
    return { jekl:j, navrzen:!rucne, posudek:sl, pata:pata, hlava:hlava, delkaJekluM:delkaJeklu, svetlaVyskaM:r3(vyskaM),
             /* síly z vaznice do sloupku — pro statický protokol (3. 10. 2026) */
             NEdVaznice:vaz.NEdKN, NupVaznice:vaz.NupKN, poleVazniceM:vaz.poleM, sirkaVazniceM:vaz.sirkaM };
  };

  /* Řádek ocelového výkazu: délky kusů, běžné metry a hmotnost. */
  var ocelPolozka = function(kod, nazev, popis, kusy, kgM, navrh){
    var kusyR = (kusy||[]).filter(function(d){ return d > 0.01; }).map(r3);
    var bm = r2(kusyR.reduce(function(a,d){ return a + d; }, 0));
    return { kod:kod, nazev:nazev, profil:popis, ks:kusyR.length, kusy:kusyR,
             delkaMin:kusyR.length ? Math.min.apply(null, kusyR) : 0, delkaMax:kusyR.length ? Math.max.apply(null, kusyR) : 0,
             bm:bm, kgM:r2(kgM), kg:Math.round(bm*kgM*10)/10, navrh:navrh || null };
  };
  /* Sloupky z jeklu pod ocelovou vaznicí + ocelové pásky (jekl 60×60×3,
     stejný počet a délka jako dřevěné pásky — ztužují řadu sloupků podél
     vaznice). `svetle` = světlé výšky sloupků od stropu ke spodku vaznice. */
  var ocelSloupky = function(kodSl, kodPas, nazev, svetle, vaz, krizeni){
    var vyskyOk = (svetle||[]).filter(function(h){ return h > 0.2; });
    if(!vyskyOk.length){ ocelUpozorneni.push(nazev + ": vaznice leží tak nízko, že se pod ni sloupek nevejde."); return; }
    var sl = navrhOcelSloupku(vaz, Math.max.apply(null, vyskyOk), nazev);
    if(!sl) return;
    var tPlechu = sl.pata.plech.t/1000 + sl.hlava.plech.t/1000;
    var jk = OCEL.jekl(sl.jekl);
    var pol = ocelPolozka(kodSl, nazev, jk.popis, vyskyOk.map(function(h){ return h - tPlechu; }), jk.kg, sl);
    pol.poznamka = "patní plech " + sl.pata.plech.strana + "×" + sl.pata.plech.strana + "×" + sl.pata.plech.t
      + " + " + sl.pata.kotvy.n + "× " + sl.pata.kotvy.nazev + "; hlavový plech " + sl.hlava.plech.sirka + "×"
      + sl.hlava.plech.delka + "×" + sl.hlava.plech.t
      + (sl.hlava.srouby.typ === "drevo"
          ? " s bočnicemi P" + sl.hlava.trmen.t + " (U-třmen) + " + sl.hlava.srouby.n + "× svorník M" + sl.hlava.srouby.d + " skrz dřevěnou vaznici"
          : " + " + sl.hlava.srouby.n + "× M" + sl.hlava.srouby.d + " 8.8")
      + (sl.hlava.vyztuhy ? "; výztuhy stojiny vaznice nad sloupky" : "");
    ocel.sloupky.push(pol);
    ocel.posudky = ocel.posudky.concat(sl.posudek.radky, sl.pata.radky, sl.hlava.radky);
    /* plechy do hmotnosti zvlášť (pata + hlava na každý sloupek) */
    var kgPlechy = vyskyOk.length * (sl.pata.plech.strana*sl.pata.plech.strana*sl.pata.plech.t
                   + sl.hlava.plech.sirka*sl.hlava.plech.delka*sl.hlava.plech.t) * 7.85e-6;
    ocel.plechy = (ocel.plechy || 0) + Math.round(kgPlechy*10)/10;
    if(paskyZap){
      /* krajní sloupky u štítu jen pásek dovnitř — stejně jako u dřeva (PENTI 4. 10. 2026) */
      var pk = pasky(kodPas, "Pásky", vyskyOk.length, krizeni||0, delkaPasku, Ppasek, Math.min.apply(null, vyskyOk), upozorneni, P.vaznice, P.sloupek,
        paskuKrajnichSloupku(podporyVaznic, kodSl === "sloupky_vrchol" ? "vaznice_vrchol" : (kodSl === "sloupky_pult" ? "vaznice_pult" : "vaznice_stred"), delkaPasku, P.sloupek && P.sloupek.b));
      if(pk){
        var jp = OCEL.jekl("60x3");
        var pp = ocelPolozka(kodPas, "Pásky z jeklu (" + nazev.toLowerCase() + ")", jp.popis, nKusu(pk.ks, delkaPasku), jp.kg, null);
        pp.poznamka = "pod 45°, náběh " + r2(delkaPasku/Math.SQRT2) + " m po sloupku i po vaznici; přivařené k jeklu, k vaznici přes plech "
          + (vaz.drevo ? "s vruty do dřeva" : "se šroubem");
        ocel.pasky.push(pp);
      }
    }
  };

  /* Do poznámky dřevěné vaznice napíše, že nad sloupky z jeklu má U-třmen
     a svorníky — tesař musí vyvrtat otvory (3. 10. 2026). */
  var oznacTrmenVaznice = function(kod){
    var pr = prvky.filter(function(q){ return q.kod === kod; })[0];
    var sl = ocel && ocel.sloupky.filter(function(q){ return q.kod === kod.replace("vaznice", "sloupky"); })[0];
    if(!pr || !sl || !sl.navrh || !sl.navrh.hlava || !sl.navrh.hlava.trmen) return;
    var hl = sl.navrh.hlava;
    pr.poznamka = (pr.poznamka ? pr.poznamka + "; " : "") + "nad sloupky z jeklu U-třmen, " + hl.srouby.n + "× svorník M"
      + hl.srouby.d + " skrz vaznici " + hl.trmen.vyskaSvornikuMm + " mm nad spodkem";
  };

  /* --- VRCHOLOVÁ VAZNICE + její sloupky --- */
  var hreben = r2(g.ridge||0);
  /* Vodorovně OD POZEDNICE ke hřebeni. Musí to být `behZdi`, ne `beh` —
     `beh` je od okapní hrany, tedy včetně přesahu.

     Dřív se sem dosazoval `beh` a vrcholová vaznice tím vyskočila o
     `přesah × tg(sklon)` výš, u domu 16 × 10 se sklonem 35° o 350 mm.
     V té výšce už krokev osedlat nejde — vaznice by koukala nad rovinu
     střechy a krokve by se k ní musely přiložit z boku. To je americký
     způsob; u nás se krokev osedlává na vaznici stejně jako na pozednici,
     stejně hlubokým sedlem (opraveno PENTI 15. 8. 2026).

     Řez to celou dobu kreslil správně — chyboval jen výkaz, takže si
     kresba a výkaz odporovaly o celý přesah okapu. Přesně jako dřív
     u pozednice a u středových vaznic. */
  var poloRozpon = r2(levá.behZdi);
  /* Zděné štíty: vrcholová (i okapová u věšadla) končí v kapse 100 mm před
     vnějším lícem každého štítu — z délky hřebene se odečte přesah + kapsa
     za každou štítovou hranu. Půdorys zkrátí čáru hřebene o totéž. */
  var zkraceniHrebene = 0;
  if(zdeneStity){
    Object.keys(zdeneStity.hrany).forEach(function(i){ zkraceniHrebene += zdeneStity.hrany[i].vaznice; });
    zkraceniHrebene = r3(zkraceniHrebene);
    if(hreben - zkraceniHrebene > 0.5) hreben = r2(hreben - zkraceniHrebene); else zkraceniHrebene = 0;
    zdeneStity.zkraceniHrebeneM = zkraceniHrebene;
  }
  /* Oblast vazníků: vrcholová vaznice končí v ose krajního vazníku. Konec
     hřebene E (směr ven d) — vzdálenost ke štítové zdi + délka oblasti.
     U zděného štítu na témže konci se odečte jen to, co je navíc. */
  var hrebenVaz = null;
  if(jeOblastVaz){
    var sgH = (g.segs||[]).filter(function(sg){ return sg.type === "hreben"; })[0];
    if(sgH){
      var dxH = sgH.B[0]-sgH.A[0], dyH = sgH.B[1]-sgH.A[1], dlH = Math.hypot(dxH, dyH) || 1, dH = [dxH/dlH, dyH/dlH];
      var zkrKonce = function(E, d){
        var nej = null;
        Object.keys(oblastiVaz.hrany).forEach(function(i){
          var a = v.zed && v.zed[+i], b = v.zed && v.zed[(+i+1) % v.zed.length]; if(!a || !b) return;
          var ex=b[0]-a[0], ey=b[1]-a[1], el=Math.hypot(ex,ey); if(el<1e-6) return;
          if(Math.abs((ex*d[0]+ey*d[1])/el) > 0.05) return;                 // zeď kolmo na hřeben
          var t=((E[0]-a[0])*ex + (E[1]-a[1])*ey)/(el*el); if(t<-0.05 || t>1.05) return;
          var vzd=(a[0]+ex*t-E[0])*d[0] + (a[1]+ey*t-E[1])*d[1];           // zeď je proti směru ven → záporné
          if(vzd < -1.5 || vzd > 0.05) return;
          var zdene = (zdeneStity && zdeneStity.hrany[i]) ? zdeneStity.hrany[i].vaznice : 0;
          nej = { hrana:+i, celkemM:r3(-vzd + oblastiVaz.hrany[i].delkaM), zdeneM:zdene };
        });
        return nej;
      };
      var kA = zkrKonce(sgH.A, [-dH[0], -dH[1]]), kB = zkrKonce(sgH.B, dH);
      var navic = (kA ? kA.celkemM - kA.zdeneM : 0) + (kB ? kB.celkemM - kB.zdeneM : 0);
      if((kA || kB) && hreben - navic > 0.5){
        hreben = r2(hreben - navic);
        hrebenVaz = { A:sgH.A, B:sgH.B, odA: kA ? kA.celkemM : 0, odB: kB ? kB.celkemM : 0,
                      vaznikA:!!kA, vaznikB:!!kB };
        oblastiVaz.hreben = hrebenVaz;
      }
    }
  }
  /* RUČNÍ KONCE VRCHOLOVÉ VAZNICE (PENTI 11. 10. 2026: „zařezávat vaznice
     k pomocné čáře"). konceVaznic.vrchol = { odA, odB } — o kolik se
     vaznice na konci A / B úseku hřebene zkrátí NAVÍC proti automatice
     (záporně = prodlouží, nejdál po konec hřebene; to hlídá půdorys).
     Jen u jednoho přímého hřebene; vaznice musí mít aspoň 0,5 m. */
  /* u věšadla se ruční konce použily už ve větvi věšadla (vrcholRucneVes) */
  var vrcholRucne = (S.vesadlo && vrcholRucneVes) ? vrcholRucneVes : null;
  (function(){
    var kVr = v.konceVaznic && v.konceVaznic.vrchol; if(!kVr || S.vesadlo) return;
    var segVr = (g.segs||[]).filter(function(sg){ return sg.type === "hreben"; });
    if(segVr.length !== 1){ upozorneni.push("Ruční konce vrcholové vaznice jdou zatím jen u jednoho přímého hřebene — nepoužily se."); return; }
    var dA = isFinite(+kVr.odA) ? +kVr.odA : 0, dB = isFinite(+kVr.odB) ? +kVr.odB : 0;
    if(hreben - dA - dB > 0.5){
      hreben = r2(hreben - dA - dB);
      vrcholRucne = { odA:r3(dA), odB:r3(dB) };
      upozorneni.push("Vrcholová vaznice je ručně zaříznutá — krokve za jejím koncem na ní neleží; zkontrolujte, že mají jinou podporu.");
    } else upozorneni.push("Vrcholová vaznice: ruční konce by ji zkrátily pod 0,5 m — nepoužily se.");
  })();
  /* ── VRCHOLOVÁ VAZNICE PO ÚSECÍCH HŘEBENE (křídla L/T, 2. 10. 2026) ──
     Každý úsek hřebene leží ve výšce svého křídla. Úseky se seskupí podle
     výšky: hlavní část (výška z hlavního řezu) a každé nižší křídlo zvlášť.
     Každá skupina má vlastní délku vaznice, vlastní sloupky a vlastní
     výšku. Střecha bez křídla zůstane jedna vaznice jako dřív. */
  /* Které konce hřebene končí v kapse zděného štítu. Vrací podpory pro
     podporyVaznice: [{u:0, nese:true}, {u:délka, nese:true}] — u = 0 je
     začátek prvního úseku hřebene (sg.A), stejně jako v půdorysu. Hřeben
     z více úseků se bere jen když jsou štíty na obou koncích. */
  var konceVrcholoveNaStitu = function(){
    if(!v.zed || !(v.stitoveHrany||[]).length) return [];
    var seg = (g.segs||[]).filter(function(sg){ return sg.type === "hreben"; });
    if(!seg.length) return [];
    /* ── NEZDĚNÝ ŠTÍT (oprava PENTI 2. 10. 2026) ───────────────────────
       Hřeben i vaznice sahají až do přesahu za štít, ale krajní sloupek
       patří NA ŠTÍTOVOU ZEĎ — tam, kde ji osa vaznice protíná (stejně jako
       u středových vaznic). Dřív stál na konci přesahu, 0,3 m mimo budovu.
       Zeď tu vaznici nenese (nese:false) → sloupek zůstane, jen na zdi;
       kus za zdí je konzola. Jen u jednoduchého hřebene (jeden úsek). */
    if(!(zdeneStity && zdeneStity.zapnuto)){
      if(seg.length !== 1) return [];
      var A0 = seg[0].A, B0 = seg[0].B, dx = B0[0]-A0[0], dy = B0[1]-A0[1], dl = Math.hypot(dx, dy);
      if(dl < 0.05) return [];
      var ux = dx/dl, uy = dy/dl, ven = [];
      (v.stitoveHrany||[]).forEach(function(i){
        if(hrebenVaz && oblastiVaz.hrany[i]) return;           // u oblasti vazníků nese krajní vazník
        var a = v.zed[i], b = v.zed[(i+1) % v.zed.length]; if(!a || !b) return;
        /* vzdálenost konců hrany od osy hřebene (se znaménkem) */
        var wa = (a[0]-A0[0])*(-uy) + (a[1]-A0[1])*ux, wb = (b[0]-A0[0])*(-uy) + (b[1]-A0[1])*ux;
        if(wa === wb || (wa > 0 && wb > 0) || (wa < 0 && wb < 0)) return;
        var t = wa/(wa-wb), X = [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t];
        var u = (X[0]-A0[0])*ux + (X[1]-A0[1])*uy - (hrebenVaz ? hrebenVaz.odA : 0)
              - (vrcholRucne ? vrcholRucne.odA : 0);                   // od začátku zkrácené vaznice (i ručně, 11. 10. 2026)
        if(u < -0.5 || u > hreben+0.5) return;
        ven.push({ u:Math.max(0, Math.min(hreben, u)), nese:false });
      });
      ven.sort(function(p, q){ return p.u - q.u; });
      return ven;
    }
    /* konce řetězu = body, které patří jen jednomu úseku */
    var body = [];
    seg.forEach(function(sg){ [sg.A, sg.B].forEach(function(P){
      var b = body.filter(function(x){ return Math.hypot(x.P[0]-P[0], x.P[1]-P[1]) < 0.02; })[0];
      if(b) b.n++; else body.push({ P:P, n:1 });
    }); });
    var konce = body.filter(function(b){ return b.n === 1; }).map(function(b){ return b.P; });
    if(konce.length !== 2) return [];
    var d0 = [seg[0].B[0]-seg[0].A[0], seg[0].B[1]-seg[0].A[1]], dl0 = Math.hypot(d0[0], d0[1]) || 1;
    var naStitu = function(E){
      return (v.stitoveHrany||[]).some(function(i){
        var a = v.zed[i], b = v.zed[(i+1) % v.zed.length]; if(!a || !b) return false;
        var ex = b[0]-a[0], ey = b[1]-a[1], el = Math.hypot(ex, ey); if(el < 1e-6) return false;
        if(seg.length === 1 && Math.abs((ex*d0[0] + ey*d0[1])/(el*dl0)) > 0.05) return false;   // zeď kolmo na hřeben
        var t = ((E[0]-a[0])*ex + (E[1]-a[1])*ey)/(el*el);
        if(t < -0.05 || t > 1.05) return false;
        return Math.hypot(a[0]+ex*t-E[0], a[1]+ey*t-E[1]) < 1.5;
      });
    };
    var out = [];
    if(seg.length === 1){
      /* ručně zkrácený konec už do kapsy štítu nesahá — štít ho nenese */
      if(naStitu(seg[0].A) && !(vrcholRucne && vrcholRucne.odA > 0.05)) out.push({ u:0, nese:true });
      if(naStitu(seg[0].B) && !(vrcholRucne && vrcholRucne.odB > 0.05)) out.push({ u:hreben, nese:true });
    } else if(naStitu(konce[0]) && naStitu(konce[1])){
      out.push({ u:0, nese:true }, { u:hreben, nese:true });
    }
    return out;
  };
  var skupinyVrcholu = null;
  /* ── KAŽDÝ PŘÍMÝ HŘEBEN = SAMOSTATNÁ VAZNICE (PENTI 3. 10. 2026) ──────
     U T, L a U se stejně vysokými hřebeny se dřív délky všech hřebenů
     sečetly do jedné vaznice (u T 26 m „přes roh") a sloupky se rozmístily
     po součtu — výkres je pak kreslil podél každého hřebene a vyšly daleko
     za střechou. Teď se úseky hřebene seskupí po PŘÍMÝCH ŘETĚZECH (úseky
     v jedné přímce, které na sebe navazují) a každý řetěz má svou délku,
     sloupky, posudek a kusy (schváleno PENTI, varianta A). Křídla v jiné
     výšce zůstávají zvlášť jako dřív. */
  var hrebenUseky = (g.segs||[]).filter(function(sg){ return sg.type==="hreben" && Math.hypot(sg.B[0]-sg.A[0], sg.B[1]-sg.A[1]) >= 0.05; });
  var smerUs = function(sg){ var dx=sg.B[0]-sg.A[0], dy=sg.B[1]-sg.A[1], l=Math.hypot(dx,dy)||1; return [dx/l, dy/l]; };
  var retezUseku = hrebenUseky.map(function(_, i){ return i; });
  (function(){
    var koren = function(i){ while(retezUseku[i] !== i) i = retezUseku[i] = retezUseku[retezUseku[i]]; return i; };
    var naPr = function(sg, P){ var d=smerUs(sg); return Math.abs((P[0]-sg.A[0])*d[1] - (P[1]-sg.A[1])*d[0]) < 0.05; };
    for(var i=0;i<hrebenUseky.length;i++) for(var j=i+1;j<hrebenUseky.length;j++){
      var a=hrebenUseky[i], b=hrebenUseky[j], da=smerUs(a), db=smerUs(b);
      if(Math.abs(da[0]*db[1]-da[1]*db[0]) > 0.01 || !naPr(a, b.A) || !naPr(a, b.B)) continue;
      var dotyk = [a.A, a.B].some(function(P){ return [b.A, b.B].some(function(Q){ return Math.hypot(P[0]-Q[0], P[1]-Q[1]) < 0.05; }); });
      if(dotyk) retezUseku[koren(j)] = koren(i);
    }
    for(var k=0;k<retezUseku.length;k++) retezUseku[k] = koren(k);
  })();
  var viceRetezu = retezUseku.some(function(r){ return r !== retezUseku[0]; });
  if((maKridla || viceRetezu) && S.vrchol && !S.vesadlo && hreben > 0.05){
    var skV = {};
    hrebenUseky.forEach(function(sg, iUs){
      var Ls = Math.hypot(sg.B[0]-sg.A[0], sg.B[1]-sg.A[1]);
      var dv = rovinyUseku(roviny, sg), pR = dv ? dv[0] : null;
      var us = { H:vyskaStrechy, kridlo:false };
      if(pR && pR.baze){
        var Ms = [(sg.A[0]+sg.B[0])/2, (sg.A[1]+sg.B[1])/2];
        us = usekVU(pR, (Ms[0]-pR.baze.a[0])*pR.baze.dir[0] + (Ms[1]-pR.baze.a[1])*pR.baze.dir[1]);
      }
      var kl = us.kridlo ? ("k" + Math.round(us.H*100)) : "hlavni";
      /* každý přímý řetěz zvlášť; jediný řetěz výšky si nechá dřívější klíč */
      var klR = kl + (viceRetezu ? "-r" + retezUseku[iUs] : "");
      if(!skV[klR]) skV[klR] = { klic:"vrchol-" + klR, kridlo:!!us.kridlo, H:us.H, p:pR, delka:0, useky:[] };
      skV[klR].delka += Ls; skV[klR].useky.push({ A:sg.A, B:sg.B });
    });
    var arrV = Object.keys(skV).map(function(k){ return skV[k]; });
    /* začátek a směr každé skupiny (konec řetězu), od kterého se měří
       polohy sloupků — kvůli půdorysu a 3D */
    arrV.forEach(function(x){
      var d = smerUs(x.useky[0]), O = x.useky[0].A, tB = function(P){ return (P[0]-O[0])*d[0] + (P[1]-O[1])*d[1]; };
      var S0 = null, t0 = Infinity;
      x.useky.forEach(function(u){ [u.A, u.B].forEach(function(P){ var tt = tB(P); if(tt < t0){ t0 = tt; S0 = P; } }); });
      x.zacatek = [r3(S0[0]), r3(S0[1])]; x.smer = [r3(d[0]*1e6)/1e6, r3(d[1]*1e6)/1e6];
      x.delkaHruba = x.delka;                                          // před kapsami zděných štítů
    });
    if(arrV.some(function(x){ return x.kridlo; }) || arrV.length > 1){
      /* zděné štíty: zkrácení (přesah + kapsa) se odečte od skupiny, jejíž
         konec u toho štítu leží; co se nepřiřadí, od hlavní / nejdelší */
      if(zkraceniHrebene > 0){
        var zbyvaZ = zkraceniHrebene;
        Object.keys((zdeneStity && zdeneStity.hrany) || {}).forEach(function(i){
          var a = v.zed && v.zed[+i], b = v.zed && v.zed[(+i+1) % v.zed.length], kolik = zdeneStity.hrany[i].vaznice || 0;
          if(!a || !b || !(kolik > 0)) return;
          var nej = null, nd = 1.5;
          arrV.forEach(function(x){ x.useky.forEach(function(u){ [u.A, u.B].forEach(function(P){
            var ex=b[0]-a[0], ey=b[1]-a[1], L2=ex*ex+ey*ey||1, tt=Math.max(0, Math.min(1, ((P[0]-a[0])*ex+(P[1]-a[1])*ey)/L2));
            var dd = Math.hypot(a[0]+ex*tt-P[0], a[1]+ey*tt-P[1]); if(dd < nd){ nd = dd; nej = x; }
          }); }); });
          if(nej && nej.delka - kolik > 0.5){
            nej.delka -= kolik; zbyvaZ -= kolik;
            /* kapsa na začátku řetězu posune počátek měření sloupků */
            var Sx = nej.zacatek, Ex = [Sx[0]+nej.smer[0]*nej.delkaHruba, Sx[1]+nej.smer[1]*nej.delkaHruba];
            var dS = Math.hypot(Sx[0]-(a[0]+b[0])/2, Sx[1]-(a[1]+b[1])/2), dE = Math.hypot(Ex[0]-(a[0]+b[0])/2, Ex[1]-(a[1]+b[1])/2);
            if(dS < dE) nej.zkrStart = (nej.zkrStart||0) + kolik;
          }
        });
        if(zbyvaZ > 0.001){
          var cilV = (skV.hlavni && skV.hlavni.delka - zbyvaZ > 0.5) ? skV.hlavni
                   : arrV.slice().sort(function(a,b){ return b.delka - a.delka; })[0];
          cilV.delka -= zbyvaZ;
        }
      }
      arrV.forEach(function(x){
        x.delka = r2(x.delka);
        x.yVrch = x.kridlo ? r3(yVrcholoveKridla(x.p, x.H)) : r3(vyskaVrcholoveVaznice(poloRozpon));
      });
      arrV.sort(function(a,b){ return (a.kridlo?1:0) - (b.kridlo?1:0); });   // hlavní napřed
      skupinyVrcholu = arrV.filter(function(x){ return x.delka > 0.05; });
      if(v.podporaVrcholove === "ramy")
        upozorneni.push("Ocelové rámy pod vrcholovou vaznicí jdou jen u střechy s jedním přímým hřebenem (bez křídel) — použily se sloupky.");
    }
  }
  if(S.vrchol && !S.vesadlo && hreben>0.05){
    /* U ocelové vaznice je dřevěným prvkem jen HRANOL na horní pásnici
       (stejné délky jako vaznice) — ocel jde do `ocel`, ne do řeziva. */
    prvky.push(prvek("vaznice_vrchol", ocelVrchol ? "Vrcholová vaznice — dřevěný hranol na ocelové vaznici" : "Vrcholová vaznice",
      ocelVrchol ? { b:hranolB, h:hranolH } : P.vaznice,
      skupinyVrcholu ? skupinyVrcholu.map(function(x){ return x.delka; }) : [hreben],"model",
      (zdeneStity ? "končí v kapsách zděných štítů" : "")
      + (skupinyVrcholu ? ((zdeneStity ? "; " : "") + "po úsecích hřebene: " + skupinyVrcholu.map(function(x){
          return (x.kridlo ? "křídlo " : (skupinyVrcholu.filter(function(q){ return !q.kridlo; }).length > 1 ? "hřeben " : "hlavní část ")) + x.delka + " m"; }).join(", ")) : ""),true));

    var roztecSl = n(v.roztecSloupku) || VYCHOZI.roztecSloupku;
    /* Sloupek stojí na stropě a nese vaznici zespodu — jeho délka je dána
       polohou vaznice, ne zadáním. */
    var delkaSlV = r2(vyskaVrcholoveVaznice(poloRozpon) - (P.vaznice.h||200)/1000);
    /* ── OCELOVÉ RÁMY POD VRCHOLOVOU VAZNICÍ (PENTI 25. 9. 2026, tvar A) ──
       Místo sloupků nese vaznici řada rámů: dvě šikmé příčle od pat na
       věnci k vrcholu pod vaznicí. Rozmístění jako u rámů pod středovými
       — jen vnitřní, krajní pole nesou štítové zdi. Geometrii a posudek
       dělá penti-ram.js (typ "vrchol"). */
    var chceRamyV = (v.podporaVrcholove === "ramy") && !S.stred && !skupinyVrcholu && !ocelVrchol;
    if(ocelVrchol && v.podporaVrcholove === "ramy")
      ocelUpozorneni.push("Ocelová vrcholová vaznice stojí na sloupcích z jeklu — ocelové rámy se s ní nekombinují.");
    if(chceRamyV && !global.PentiRam){
      upozorneni.push("Modul ocelového rámu (penti-ram.js) chybí — pod vrcholovou vaznicí se použily sloupky.");
      chceRamyV = false;
    }
    if(chceRamyV && !(delkaSlV > 0.1)){
      upozorneni.push("Vrcholová vaznice je moc nízko na ocelový rám — použily se sloupky.");
      chceRamyV = false;
    }
    var podpV = null, pocetSl = 2;
    if(chceRamyV){
      var RamV = global.PentiRam;
      var roztRV = n(v.roztecRamuM) || 4;
      var poliRV = n(v.pocetRamu) > 0 ? Math.round(n(v.pocetRamu)) + 1
                                      : Math.max(2, Math.floor(hreben/roztRV + 1e-9));
      var pocetRV = poliRV - 1, osovaRV = r3(hreben/poliRV);
      var polohyRV = [], poleRV = [];
      for(var iRV=1; iRV<=pocetRV; iRV++) polohyRV.push(r3(osovaRV*iRV));
      for(var jRV=0; jRV<poliRV; jRV++) poleRV.push(osovaRV);
      if(!(zdeneStity && zdeneStity.zapnuto)){
        upozorneni.push("Krajní pole vrcholové vaznice u ocelových rámů musí nést štítové zdi — "
          +"zapni zděné štíty, jinak konce vaznice nemají podporu.");
      }
      podpV = { pocetSloupku:0, poli:poliRV, roztecSkutecna:osovaRV, roztecZadana:roztRV,
                polohy:[], pole:poleRV, delka:r2(hreben), ramy:polohyRV,
                podpora:"ramy", stitovePodpory:2, nesouStity:2 };
      pocetSl = 0;
      podporyVaznic.push(Object.assign({ kod:"vaznice_vrchol",
        nazev:"Vrcholová vaznice", profil:P.vaznice,
        statika: statikaVaznice(podpV, P.vaznice, n(v.maxDelkaKusu)||13, v.modelVaznice==="prosty") }, podpV));
      /* Příčný řez: x od vnějšího líce levé zdi. Pata sedí na zdi 100 mm
         od VNITŘNÍHO líce (u osy zdi by příčel narazila do pozednice
         a vylezla nad krokev); jde přepsat. Horní plocha rámu ve vrcholu
         = spodní líc vaznice = délka sloupku. */
      var VNR = venecPodRamem();
      var tlZdiRV = VNR.tlZdiM;
      var pataOdV = n(v.pataRamuOdLiceM) || VNR.pataVrcholM;        // na betonu, 100 mm od vnitřní hrany
      var SramV = rozponZdiVodorovny;
      var prRV = RamV.prurez(v.profilRamu || "U200");
      /* BOTKA (varianta B): když se šikmý prut vodorovně seříznutý nevejde
         do šířky betonu (stopa h/sin α), stojí na svislém krátkém kusu. */
      var sklBot = Math.min(levá.sklonDeg, (pravá ? pravá.sklonDeg : levá.sklonDeg))*Math.PI/180;
      var stopaBot = prRV.h/Math.max(0.2, Math.sin(sklBot));
      /* plech = beton − 2×10 mm, prut na něm potřebuje po 10 mm na koutový svar */
      /* výška botky: co nejnižší (ať rám nevyleze nad krokve), ale tak, aby
         vnitřní roh pokosu v koleni zůstal aspoň 20 mm nad patním plechem:
         tl. plechu 20 + 20 + h/2 · tg((90° − α)/2), nejméně 100 mm */
      var hBot = 0.04 + (prRV.h/2000)*Math.tan((Math.PI/2 - sklBot)/2);
      var botkaRV = (stopaBot + 40 > VNR.betonMm) ? r3(Math.max(0.10, Math.ceil(hBot*100 - 1e-9)/100)) : 0;
      /* svislá botka stojí uprostřed betonu (jinak by vyjela z plechu) */
      if(botkaRV > 0 && !n(v.pataRamuOdLiceM)) pataOdV = VNR.pataStredM;
      /* zVrcholM = spodní líc vaznice; osa příčle jde ve sklonu střechy
         a zbytek do vaznice dorovná stolička (29. 9. 2026) */
      var zadRV = { typ:"vrchol",
        rozpetiPatM: r3(SramV - 2*pataOdV), zPatyM: n(v.zPatyRamuM) || 0,
        zVrcholM: delkaSlV, xVrcholM: r3(poloRozpon - SramV/2), hProfilM: prRV.h/1000, botkaM: botkaRV,
        krokev: { hVazniceM: (P.vaznice.h||200)/1000, bVazniceM: (P.vaznice.b||160)/1000,
                  sklonLDeg: levá.sklonDeg, sklonPDeg: (pravá ? pravá.sklonDeg : levá.sklonDeg), rezervaM: 0.02 } };
      var geoRV = RamV.geometrie(zadRV);
      (geoRV.upozorneni||[]).forEach(function(u){ upozorneni.push(u); });
      ramyGeo = {
        typ: "vrchol", nese: "vrcholovou vaznici",
        pocet: pocetRV, polohy: polohyRV, osovaM: osovaRV, poli: poliRV, roztecZadana: roztRV,
        profil: prRV.kod, rada: prRV.rada, profilPopis: prRV.popis,
        pata: (v.pataRamu === "pevna") ? "pevna" : "posuvna",
        pataOdLiceM: r3(pataOdV), kolenoM: null, kolenoSkutecneM: null, kolenoOmezenoM: null,
        zPatyM: n(v.zPatyRamuM) || 0,
        rozpetiPatM: geoRV.rozpetiM, zPricleM: geoRV.zVrcholM, zVrcholM: geoRV.zVrcholM,
        zVazniceM: delkaSlV, podstavecM: geoRV.podstavecM, zadani: zadRV,
        venec: VNR, botkaM: botkaRV, styk: v.stykRamu || "sroubovany",
        xVaznicOdLiceM: [ r3(poloRozpon) ],
        /* pro dílenský výkres a kotevní plán (29. 9. 2026) */
        vaznice: { bMm: P.vaznice.b||160, hMm: P.vaznice.h||200 },
        delkaVazniceM: r2(hreben), rozponM: r3(SramV), tlZdiM: r3(tlZdiRV),
        geo: geoRV, kgm: prRV.kgm,
        delkaKusM: geoRV.delkaM,
        hmotnostKusKg: Math.round(geoRV.delkaM * prRV.kgm*10)/10,
        hmotnostKg: Math.round(geoRV.delkaM * prRV.kgm * pocetRV*10)/10
      };
    } else if(skupinyVrcholu){
      /* Křídla a přímé hřebeny: každá skupina úseků má své podpory a své
         sloupky. Kde konec jedné vaznice leží na jiné vaznici ve stejné
         výšce (styk hřebenů u T, L, U), stojí sloupek jen JEDEN: delší /
         průběžná vaznice ho má v tom místě pevně, kratší na ní jen leží. */
      pocetSl = 0;
      var naRetezu = function(y, P){                                   // poloha P na řetězu y (m od začátku) nebo null
        var t = (P[0]-y.zacatek[0])*y.smer[0] + (P[1]-y.zacatek[1])*y.smer[1];
        var w = Math.abs((P[0]-y.zacatek[0])*y.smer[1] - (P[1]-y.zacatek[1])*y.smer[0]);
        return (w < 0.05 && t > -0.05 && t < y.delkaHruba + 0.05) ? t : null;
      };
      var konceSk = function(y){ return [y.zacatek, [y.zacatek[0]+y.smer[0]*y.delkaHruba, y.zacatek[1]+y.smer[1]*y.delkaHruba]]; };
      skupinyVrcholu.forEach(function(x, ix){
        var pevne = [], nesene = [], zs = x.zkrStart || 0;
        skupinyVrcholu.forEach(function(y, iy){
          if(iy === ix || Math.abs((y.yVrch||0) - (x.yVrch||0)) > 0.05) return;
          /* konec jiné vaznice leží uvnitř této → pevný sloupek */
          konceSk(y).forEach(function(P){
            var t = naRetezu(x, P);
            if(t != null && t > 0.05 && t < x.delkaHruba - 0.05) pevne.push(r3(t - zs));
          });
          /* konec této vaznice leží na jiné → tady sloupek nebude */
          konceSk(x).forEach(function(P, kraj){
            var t = naRetezu(y, P); if(t == null) return;
            var uvnitr = t > 0.05 && t < y.delkaHruba - 0.05;
            var spolecnyKonec = !uvnitr && (y.delkaHruba > x.delkaHruba + 1e-6 || (Math.abs(y.delkaHruba - x.delkaHruba) < 1e-6 && iy < ix));
            if(uvnitr || spolecnyKonec) nesene.push({ u: kraj === 0 ? 0 : x.delka, nese:true });
          });
        });
        /* konce u štítu: nezděný štít → krajní sloupek NA ZDI (kus za zdí
           je konzola, jako u jednoduchého hřebene); zděný → konec nese štít */
        if(v.zed && (v.stitoveHrany||[]).length){
          (v.stitoveHrany||[]).forEach(function(i){
            var a = v.zed[i], b = v.zed[(i+1) % v.zed.length]; if(!a || !b) return;
            var nS = [-x.smer[1], x.smer[0]];
            var wa = (a[0]-x.zacatek[0])*nS[0] + (a[1]-x.zacatek[1])*nS[1], wb = (b[0]-x.zacatek[0])*nS[0] + (b[1]-x.zacatek[1])*nS[1];
            if(wa === wb || (wa > 0 && wb > 0) || (wa < 0 && wb < 0)) return;
            var tt = wa/(wa-wb), X = [a[0]+(b[0]-a[0])*tt, a[1]+(b[1]-a[1])*tt];
            var u = (X[0]-x.zacatek[0])*x.smer[0] + (X[1]-x.zacatek[1])*x.smer[1];
            if(u < -0.5 || u > x.delkaHruba + 0.5) return;
            if(Math.min(Math.abs(u), Math.abs(x.delkaHruba - u)) > 1.5) return;   // zeď jen u konce řetězu
            var zdene = !!(zdeneStity && zdeneStity.zapnuto);
            var uu = zdene ? (u < x.delkaHruba/2 ? 0 : x.delka) : Math.max(0, Math.min(x.delka, u - zs));
            nesene.push({ u: r3(uu), nese: zdene });
          });
        }
        var pd = podporyVaznice(x.delka, roztecSl, null, pevne, nesene);
        x.pocetSloupku = pd ? pd.pocetSloupku : 2;
        x.delkaSloupku = r2(x.yVrch - (P.vaznice.h||200)/1000);
        pocetSl += x.pocetSloupku;
        if(pd) podporyVaznic.push(Object.assign({ kod:"vaznice_vrchol",
          nazev:"Vrcholová vaznice" + (x.kridlo ? " (křídlo)" : ""), profil:P.vaznice,
          statika: statikaVaznice(pd, P.vaznice, n(v.maxDelkaKusu)||13, v.modelVaznice==="prosty") },
          pd, { klic:x.klic, useky:x.useky, kridlo:x.kridlo, zacatek:x.zacatek, smer:x.smer }));
      });
    } else {
      /* ── VRCHOLOVÁ VAZNICE NA ZDĚNÝCH ŠTÍTECH (PENTI 2. 10. 2026, var. A) ──
         U zděných štítů končí vaznice v kapse ve zdi — ten konec nese štít,
         sloupek tam nepatří (dřív tam stál a vlastně by stál ve zdi).
         Volba „jen na štítech" k tomu vynechá i sloupky mezi štíty:
         vaznice je pak jedno pole přes celou délku a posudek jí podle
         toho navrhne profil. */
      var stityV = konceVrcholoveNaStitu();
      /* konce na krajním vazníku — podpora bez sloupku */
      if(hrebenVaz){
        if(hrebenVaz.vaznikA) stityV = stityV.filter(function(x){ return x.u > 0.05; }).concat([{ u:0, nese:true, vaznik:true }]);
        if(hrebenVaz.vaznikB) stityV = stityV.filter(function(x){ return x.u < hreben-0.05; }).concat([{ u:hreben, nese:true, vaznik:true }]);
        stityV.sort(function(a, b){ return a.u - b.u; });
      }
      var roztV = roztecSl;
      if(v.vrcholJenNaStitech){
        if(stityV.length === 2 && stityV.every(function(x){ return x.nese; })){
          roztV = hreben + 1;                                    // jedno pole, žádný sloupek uvnitř
          upozorneni.push("Vrcholová vaznice leží jen na štítech — jedno pole " + r2(hreben)
            + " m bez sloupků. Profil vaznice podle posudku; u větších délek počítejte s lepeným dřevem (BSH).");
        } else {
          upozorneni.push("Vrcholová vaznice „jen na štítech“ jde jen tam, kde má štítovou zeď na obou koncích "
            + "(zapnuté zděné štíty a oba konce hřebene u štítu) — počítá se se sloupky.");
        }
      }
      var rucneV = (v.sloupkyRucne && v.sloupkyRucne.vrchol) || null;   // ruční polohy z editoru
      podpV = podporyVaznice(hreben, roztV, null, null, stityV, rucneV);
      if(podpV && podpV.dlouhePoleM)
        upozorneni.push("Vrcholová vaznice: ručně rozmístěné sloupky dávají pole " + podpV.dlouhePoleM
          + " m — delší než při automatickém rozmístění (" + podpV.autoPoleM + " m). Vaznice se posuzuje na to pole.");
      pocetSl = podpV ? podpV.pocetSloupku : 2;
      if(podpV) podporyVaznic.push(Object.assign({ kod:"vaznice_vrchol",
        nazev:"Vrcholová vaznice", profil:P.vaznice,
        statika: statikaVaznice(podpV, P.vaznice, n(v.maxDelkaKusu)||13, v.modelVaznice==="prosty", stykyVaznice("vrchol")) }, podpV,
        /* oblast vazníků: který konec leží na krajním vazníku a o kolik je
           začátek od konce hřebene (A) — pro reakci a 3D */
        hrebenVaz ? (function(){
          /* začátek vaznice měřený ve směru roviny 1 (3D kreslí podél ní);
             hřeben jdoucí proti ní má polohy sloupků od druhého konce */
          var p1 = roviny.filter(function(p){ return p.cislo === 1; })[0] || roviny[0];
          var pr = function(P){ return (p1 && p1.baze) ? (P[0]-p1.baze.a[0])*p1.baze.dir[0] + (P[1]-p1.baze.a[1])*p1.baze.dir[1] : 0; };
          var souhl = pr(hrebenVaz.A) <= pr(hrebenVaz.B);
          return { vaznikOd:hrebenVaz.vaznikA, vaznikDo:hrebenVaz.vaznikB, odHrebeneA:hrebenVaz.odA,
                   odKrajeM: souhl ? hrebenVaz.odA : hrebenVaz.odB, obracene: !souhl };
        })() : {}));
    }
    /* ── OCELOVÁ VRCHOLOVÁ VAZNICE: návrh profilu a skutečná výška ── */
    var ocelVaz = null;
    if(ocelVrchol){
      var podpVsech = podporyVaznic.filter(function(q){ return q.kod === "vaznice_vrchol"; });
      var poleVsech = [].concat.apply([], podpVsech.map(function(q){ return q.pole || []; }));
      var podpOcel = { pole: poleVsech.length ? poleVsech : [hreben], delka: hreben };
      ocelVaz = navrhOcelVaznice("vaznice_vrchol", ocelVrchol, ocelV.profilVrchol, podpOcel, sirkaVrcholove(), "Vrcholová vaznice");
      if(ocelVaz){
        P.vaznice.h = hranolH + ocelVaz.prurez.h;                // hranol + profil — od toho se odvíjí sloupky i kleštiny
        delkaSlV = r2(vyskaVrcholoveVaznice(poloRozpon) - P.vaznice.h/1000);
        if(skupinyVrcholu) skupinyVrcholu.forEach(function(x){ x.delkaSloupku = r2(x.yVrch - P.vaznice.h/1000); });
        var kusyV = skupinyVrcholu ? skupinyVrcholu.map(function(x){ return x.delka; }) : [hreben];
        ocel.vaznice.push(ocelPolozka("vaznice_vrchol", "Vrcholová vaznice", ocelVaz.prurez.popis, kusyV, ocelVaz.prurez.kg, ocelVaz));
        ocel.posudky = ocel.posudky.concat(ocelVaz.posudek.radky);
        (ocelVaz.posudek.upozorneni||[]).forEach(function(u){ ocelUpozorneni.push(u); });
        var prV = prvky.filter(function(q){ return q.kod === "vaznice_vrchol"; })[0];
        if(prV) prV.poznamka = (prV.poznamka ? prV.poznamka + "; " : "") + "hranol " + hranolB + "/" + hranolH
          + " mm přišroubovaný na horní pásnici " + ocelVaz.prurez.popis + " (krokve se osedlají na hranol)";
      }
    }
    if(chceRamyV){
      /* sloupky ani pásky se pod vrcholovou vaznicí nevykazují */
    } else if(ocelVaz){
      /* sloupky z jeklu, pásky z menšího jeklu (ocel, ne řezivo) */
      var svetleV = skupinyVrcholu
        ? [].concat.apply([], skupinyVrcholu.map(function(x){ return nKusu(x.pocetSloupku, x.delkaSloupku); }))
        : nKusu(pocetSl, delkaSlV);
      ocelSloupky("sloupky_vrchol", "pasky_vrchol", "Sloupky pod vrcholovou vaznicí", svetleV, ocelVaz, 0);
    } else if(jeklVrchol && pocetSl > 0){
      /* dřevěná vrcholová vaznice na sloupcích z jeklu (3. 10. 2026) */
      var vazDV = reakceDrevVaznice("vaznice_vrchol", P.vaznice, sirkaVrcholove(), "Vrcholová vaznice");
      var svetleDV = skupinyVrcholu
        ? [].concat.apply([], skupinyVrcholu.map(function(x){ return nKusu(x.pocetSloupku, x.delkaSloupku); }))
        : nKusu(pocetSl, delkaSlV);
      if(vazDV) ocelSloupky("sloupky_vrchol", "pasky_vrchol", "Sloupky pod vrcholovou vaznicí", svetleDV, vazDV, 0);
      oznacTrmenVaznice("vaznice_vrchol");
    } else if(skupinyVrcholu){
      var kusySlV = [];
      skupinyVrcholu.forEach(function(x){
        if(x.delkaSloupku > 0.1) kusySlV = kusySlV.concat(nKusu(x.pocetSloupku, x.delkaSloupku));
      });
      if(kusySlV.length){
        prvky.push(oznacCepSloupku(prvek("sloupky_vrchol","Sloupky pod vrcholovou vaznicí",P.sloupek,
          sloupkySCepem(kusySlV, P.sloupek),"model","délka vyplývá z osedlání krokve — v každém křídle jiná"), P.sloupek));
        var pkVK = pasky("pasky_vrchol","Pásky u vrcholových sloupků",
          kusySlV.length, 0, delkaPasku, Ppasek, Math.min.apply(null, kusySlV), upozorneni,
          P.vaznice, P.sloupek, paskuKrajnichSloupku(podporyVaznic, "vaznice_vrchol", delkaPasku, P.sloupek && P.sloupek.b));
        if(pkVK) prvky.push(pkVK);
      } else {
        upozorneni.push("Vrcholová vaznice vychází níž než její vlastní výška — sloupky se nepočítají.");
      }
    } else if(pocetSl === 0){
      /* vaznice leží jen na štítech — sloupky ani pásky nejsou */
    } else if(delkaSlV > 0.1){
      /* délka sloupků pod vrcholovou vaznicí — pro panel editoru */
      if(!skupinyVrcholu) podporyVaznic.forEach(function(q){ if(q.kod==="vaznice_vrchol") q.delkaSloupkuM = delkaSlV; });
      prvky.push(oznacCepSloupku(prvek("sloupky_vrchol","Sloupky pod vrcholovou vaznicí",P.sloupek,
        sloupkySCepem(nKusu(pocetSl, delkaSlV), P.sloupek),"model","délka vyplývá z osedlání krokve"), P.sloupek));
      /* Pásky leží v podélné rovině, rovnoběžně s hřebenem — v příčném řezu
         je proto vidět nejsou. Kreslí se v půdorysu.
         Vrcholová vaznice je jeden rovný pás, takže se nikde nekříží. */
      var pkV = pasky("pasky_vrchol","Pásky u vrcholových sloupků",
        pocetSl, 0, delkaPasku, Ppasek, delkaSlV, upozorneni,
        P.vaznice, P.sloupek, paskuKrajnichSloupku(podporyVaznic, "vaznice_vrchol", delkaPasku, P.sloupek && P.sloupek.b));
      if(pkV) prvky.push(pkV);
    } else {
      upozorneni.push("Vrcholová vaznice vychází níž než její vlastní výška — sloupky se nepočítají.");
    }
  }

  /* --- STŘEDOVÉ VAZNICE ---
     Vaznice má rozpůlit rozpon krokve, aby krokev nemusela být tak vysoká.
     Na NESOUMĚRNÉ střeše to znamená na každé rovině JINOU VÝŠKU: mírnější
     rovina má krokev delší a její polovina leží níž. Kdyby se obě daly do
     stejné výšky, ani jednu krokev by nerozpůlily (upřesněno PENTI
     14. 8. 2026).

     Prázdné zadání = půlka krokve na každé rovině zvlášť. Když se výška
     zadá, platí pro všechny roviny — pak si polohu určuje uživatel. */
  var stredoveGeo = null;
  if(S.stred){
    var zadanaVyskaSV = n(v.vyskaStredVaznice);
    /* Bez zadané výšky leží vaznice v POLOVINĚ ROZPONU od pozednice
       k hřebeni — na obou rovinách tedy ve stejné výšce. Přesah okapu se
       do toho nepočítá: je to převislý konec krokve, ne rozpon. Kdyby se
       půlila celá krokev i s přesahem, každá vaznice by na nesouměrné
       střeše ležela jinak vysoko a kleštiny by nemohly být vodorovné. */
    var vyskaProRovinu = function(p){
      return zadanaVyskaSV > 0 ? zadanaVyskaSV : r2(vyskaStrechy/2);
    };
    var hStred = zadanaVyskaSV || r2(vyskaStrechy/2);      // pro popisy a hlídače
    /* hlídač platí i pro výšku zadanou jako uložení nad ±0 (3. 10. 2026) */
    if(!zadanaVyskaSV && n(v.ulozeniStredoveM) > 0.05)
      hStred = r2(n(v.ulozeniStredoveM) - nadezdivka - hPozednice + (P.stredVaznice.h||220)/1000);
    if(hStred >= vyskaStrechy - 0.05){
      upozorneni.push("Středová vaznice je zadaná ve výšce "+hStred+" m, což je až u vrcholu ("
        +vyskaStrechy+" m). Zkontroluj výšku.");
    }
    /* ── RUČNÍ POLOHA VAZNICE ──────────────────────────────────────────
       `v.polohyVaznic` je mapa číslo roviny → vodorovný odstup vaznice
       od pozednice v metrech. Uživatel ji zadá tažením v půdorysu
       (zadání PENTI 16. 8. 2026: „posouvání krokví, vaznic").

       Přepisuje se tady, na JEDINÉM místě, ze kterého všechno ostatní
       vychází. Tím se samo přepočítá i délka vaznice, délka a počet
       sloupků, nesení stěnami, pásky, posudek i polohy patek — kdyby se
       ruční poloha dosadila až v kresbě, výkaz by o ní nevěděl a nabídka
       by lhala. */
    var rucniPolohy = v.polohyVaznic || {};
    /* Ke každé rovině se spočítá vlastní výška, vodorovná poloha a délka.
       Rovina rozdělená na hlavní část a křídlo (viz `usekyRovin`) dostane
       pro každý úsek SAMOSTATNÝ BĚH vaznice ve své výšce. Běhy hlavní části
       jdou v seznamu napřed (řez a štít berou první dva), běhy křídel za nimi. */
    /* Konec běhu na krajním vazníku (oblast vazníků): podpora, která
       vaznici nese — sloupek tam nestojí (stejně jako u nesoucí štítové
       zdi). Přidá se k podporám ze stránky; bez oblasti beze změny. */
    /* Začátek běhu měřený ve směru roviny 1 — 3D kreslí vaznice podél ní.
       Rovina s opačným směrem okapu začíná u druhého konce. */
    var souhlasneSRovinou1 = function(sv){
      var p1 = roviny.filter(function(p){ return p.cislo === 1; })[0] || roviny[0];
      var pS = roviny.filter(function(p){ return p.cislo === sv.cislo; })[0];
      if(!p1 || !pS || !p1.baze || !pS.baze) return true;
      return (p1.baze.dir[0]*pS.baze.dir[0] + p1.baze.dir[1]*pS.baze.dir[1]) >= 0;
    };
    var odKrajeVRovine1 = function(sv){ return souhlasneSRovinou1(sv) ? sv.stitOdM : sv.stitDoM; };
    var podporyNaVazniku = function(sv, st){
      if(!sv || (!sv.vaznikOd && !sv.vaznikDo)) return st;
      var out = (st || []).slice();
      if(sv.vaznikOd) out.push({ u:0, nese:true, vaznik:true });
      if(sv.vaznikDo) out.push({ u:sv.delka, nese:true, vaznik:true });
      return out.sort(function(a, b){ return a.u - b.u; });
    };
    var svPodleRovin = [], svKridel = [], presneBehy = [];
    roviny.forEach(function(p){
      var rings=p.tvarRings || (p.tvar?[p.tvar]:[]);
      var sk=(p.sklon||0)*Math.PI/180;
      if(!(Math.sin(sk)>0.01)) return;
      var tgR = Math.tan(sk);
      if(!(tgR > 1e-6)) return;
      var presahR = presahRoviny(p);
      var useky = usekyRovin[p.cislo] || [{ od:0, do:0, H:vyskaStrechy, kridlo:false, celaRovina:true }];
      var rzR = rozsahU(rings);
      /* D6d: vaznice křídla ve výšce hlavní části → rovina má JEDEN běh
         přes celou délku (hlavní část i křídlo leží ve stejné výšce).
         Rovina, která celá patří křídlu, zůstane označená jako křídlo. */
      /* úseky nízkého křídla — tam se vaznice neklade (viz `nizkyUsek`) */
      var nizkeUseky = kridlaVHlavni ? useky.filter(nizkyUsek) : [];
      if(kridlaVHlavni && rzR){
        if(nizkeUseky.length === useky.length) return;           // celá rovina je nízké křídlo
        var celaKridlo = useky.every(function(x){ return x.kridlo; });
        useky = [{ od:rzR.min, do:rzR.max, H:vyskaStrechy, kridlo:celaKridlo, celaRovina:true, doHlavni:true }];
      }
      var prvniHlavni = true;
      useky.forEach(function(us, iUs){
      var hp, xOdZdi, rucne = false;
      /* Ruční POLOHA je zadaná k rovině — platí pro její hlavní úsek
         (nebo pro rovinu, která celá patří jednomu křídlu). */
      var hlavniUsek = us.celaRovina || (!us.kridlo && prvniHlavni);
      if(!us.kridlo) prvniHlavni = false;
      var zadanoX = hlavniUsek ? n(rucniPolohy[p.cislo]) : 0;
      /* Křídlo L/T: vlastní výška hřebene; ručně zadaná VÝŠKA platí jen
         pro hlavní část (varianta 1a). */
      var kridlo = !!us.kridlo;
      var vyskaStrechyR = us.H;
      var vyskaZadanaR = kridlo ? 0 : zadanaVyskaSV;
      if(us.doHlavni && kridlo) vyskaZadanaR = hpCilKridla;  // D6d: rovina křídla ve výšce vaznice hlavní části
      /* ── ULOŽENÍ ZADANÉ NAD ±0 ────────────────────────────────────
         Uživatel může místo polohy zadat rovnou VÝŠKU ULOŽENÍ vaznice
         nad hrubou podlahou — tak se to na stavbě odměřuje. Poloha
         z toho vyplyne, sklon ani hřeben se nemění (rozhodnuto PENTI
         16. 8. 2026, varianta a).

         Uložení = spodní líc vaznice. Přepočet zpátky do soustavy
         modulu (výška nad pozednicí):
             vyska = uložení − nadezdívka − výška pozednice + výška vaznice */
      var zadanoUloz = n(v.ulozeniStredoveM);
      if(!(zadanoX > 0.05) && zadanoUloz > 0.05 && !kridlo){
        var hV = (P.stredVaznice.h||220)/1000;
        var hpZUloz = zadanoUloz - nadezdivka - hPozednice + hV;
        /* Zadaná výška je výška HORNÍ PLOCHY, ta se měří na vnější hraně —
           osa vaznice je proto o půl šířky dál (20. 8. 2026). */
        if(hpZUloz > 0.05){ zadanoX = hpZUloz / tgR + bStredove/2 + odLice; }
      }
      if(zadanoX > 0.05){
        /* Vede odstup, výška z něj vyplývá. */
        xOdZdi = zadanoX; rucne = true;
      } else if(vyskaZadanaR > 0){
        /* ZADANÁ VÝŠKA je výška HORNÍ PLOCHY. Ta se odměřuje na vnější
           hraně, takže osa vaznice leží o půl šířky dál — jinak by vaznice
           vyšla o (půl šířky × tg) níž, než uživatel zadal (20. 8. 2026). */
        xOdZdi = vyskaZadanaR/tgR + bStredove/2 + odLice;
      } else {
        /* Bez zadání vaznice PŮLÍ rozpon — vede tedy poloha a výška z ní
           plyne. To se nemění. U křídla z jeho vlastního hřebene. */
        xOdZdi = (vyskaStrechyR/2)/tgR;                 // vodorovně od POZEDNICE
      }
      /* Výška HORNÍ PLOCHY se odměřuje na vnější hraně, ne v ose. Když
         vaznice půlí rozpon, leží její horní plocha o (půl šířky × tg
         sklonu) níž než osa — a sloupek pod ní je o tolik kratší. */
      hp = (xOdZdi - bStredove/2 - odLice)*tgR;
      /* Šířka roviny se hledá podle vzdálenosti od OKAPU, protože tvar
         roviny z jádra začíná na okapové hraně. */
      var vNaSpadu = (xOdZdi + presahR)/Math.cos(sk);
      var d, uOd = null, uDo = null;
      if(us.doHlavni){
        /* D6d: vaznice leží jen tam, kde je rovina v její výšce opravdu
           pod ní — horní hrana výš a spodní hrana (okap NEBO úžlabí) níž.
           Bez té druhé podmínky by vaznice hlavní části běžela pod úžlabím
           dál do křídla. Bere se nejdelší souvislý kus; konce se pak
           v rozích srovnají přesně na průsečík s druhou vaznicí. */
        var kr2 = 400, zac = null, best = null;
        for(var iq=0; iq<=kr2+1; iq++){
          var uq = rzR.min + rzR.sirka*Math.min(iq, kr2)/kr2;
          var uvnitr = iq <= kr2 && vysoko(rings, uq) >= vNaSpadu - 1e-6 && nizko(rings, uq) <= vNaSpadu + 1e-6
                       && !nizkeUseky.some(function(x){ return uq > x.od + 1e-6 && uq < x.do - 1e-6; });   // ne v nízkém křídle
          if(uvnitr && zac === null) zac = uq;
          if(!uvnitr && zac !== null){
            var kon = rzR.min + rzR.sirka*(iq-1)/kr2;
            if(!best || kon - zac > best[1] - best[0]) best = [zac, kon];
            zac = null;
          }
        }
        uOd = best ? best[0] : null; uDo = best ? best[1] : null;
        d = best ? r2(best[1] - best[0]) : 0;
      } else if(us.celaRovina){
        d = r2(sirkaVeVysce(rings, vNaSpadu));          // celá rovina — beze změny
      } else {
        /* jen v rozsahu úseku: kde rovina v té výšce ještě je */
        var kroku = 200, prvni = null, posledni = null;
        for(var iu=0; iu<=kroku; iu++){
          var uu = us.od + (us.do - us.od)*iu/kroku;
          if(vysoko(rings, uu) >= vNaSpadu - 1e-6){ if(prvni === null) prvni = uu; posledni = uu; }
        }
        d = (prvni === null) ? 0 : r2(posledni - prvni);
        uOd = prvni; uDo = posledni;
      }
      /* Zděný štít: vaznice končí v kapse 100 mm před vnějším lícem, ne
         na kraji přesahu. `stitOdM/stitDoM` říkají půdorysu, o kolik má
         čáru vaznice na kterém konci zkrátit — stejně jako výkaz.
         U rozděleného úseku jen na tom konci, který je i koncem roviny. */
      var zS = (zdeneStity && zdeneStity.roviny[p.cislo]) || null;
      var stitOd = zS ? zS.vazniceOd : 0, stitDo = zS ? zS.vazniceDo : 0;
      if(!us.celaRovina && rzR){
        if(us.od > rzR.min + 0.05) stitOd = 0;
        if(us.do < rzR.max - 0.05) stitDo = 0;
      }
      /* Oblast vazníků: vaznice končí v ose krajního vazníku (bere se
         větší zkrácení, kdyby byl u téhož štítu i zděný štít). */
      var zOV = jeOblastVaz ? oblastiVaz.roviny[p.cislo] : null, vazOd = false, vazDo = false;
      if(zOV && us.celaRovina){
        if(zOV.vlevo && zOV.vlevo.vaznikM > stitOd){ stitOd = zOV.vlevo.vaznikM; vazOd = true; }
        if(zOV.vpravo && zOV.vpravo.vaznikM > stitDo){ stitDo = zOV.vpravo.vaznikM; vazDo = true; }
      }
      /* RUČNÍ KONCE (PENTI 11. 10. 2026: „zařezávat vaznice k pomocné
         čáře"). konceVaznic["stred:<klíč úseku>"] = { od, do } — o kolik se
         vaznice na tom konci zkrátí od kraje střechy (≥ 0). Nahradí
         automatické zkrácení (kapsa, krajní vazník); vaznice musí mít aspoň
         0,3 m, jinak se ruční konce nepoužijí a řekne se to. */
      var klicKonce = "stred:" + (hlavniUsek ? String(p.cislo) : (p.cislo + "-" + iUs));
      var kvR = v.konceVaznic && v.konceVaznic[klicKonce], rucneKonce = null;
      if(kvR){
        var odR = (kvR.od != null && isFinite(+kvR.od)) ? Math.max(0, +kvR.od) : stitOd;
        var doR = (kvR["do"] != null && isFinite(+kvR["do"])) ? Math.max(0, +kvR["do"]) : stitDo;
        if(d - odR - doR > 0.3){
          rucneKonce = { od: kvR.od != null, "do": kvR["do"] != null };
          if(rucneKonce.od){ stitOd = odR; vazOd = false; }
          if(rucneKonce["do"]){ stitDo = doR; vazDo = false; }
          upozorneni.push("Středová vaznice (rovina " + p.cislo + ") je ručně zaříznutá — krokve za jejím koncem na ní neleží; zkontrolujte, že mají jinou podporu.");
        } else upozorneni.push("Středová vaznice (rovina " + p.cislo + "): ruční konce by ji zkrátily pod 0,3 m — nepoužily se.");
      }
      if(stitOd + stitDo > 0 && d - stitOd - stitDo > 0.3) d = r2(d - stitOd - stitDo);
      else { stitOd = 0; stitDo = 0; vazOd = false; vazDo = false; }
      if(d<=0.3) return;
      var zaznam = { cislo:p.cislo, sklonDeg:r2(p.sklon||0), vyska:r2(hp), delka:d,
                          stitOdM:r3(stitOd), stitDoM:r3(stitDo),   // zkrácení do kapsy zděného štítu
                          x:r2(xOdZdi),                         // od pozednice vodorovně
                          presah:r3(presahR),
                          behZdi:r2(vyskaStrechyR/tgR),         // pozednice → hřeben (křídlo: jeho hřeben)
                          spad:r2((vyskaStrechyR/tgR + presahR)/Math.cos(sk)),
                          rucne: rucne,
                          /* ruční konce z půdorysu (11. 10. 2026) — klíč a které konce */
                          klicKonce: klicKonce, rucneKonce: rucneKonce,
                          puli: rucne ? false : (vyskaZadanaR>0 ? false : true) };
      /* konec na krajním vazníku (oblast vazníků) — podpora bez sloupku */
      if(vazOd) zaznam.vaznikOd = true;
      if(vazDo) zaznam.vaznikDo = true;
      /* Jen u střech s křídlem — obdélníkové střechy zůstanou beze změny. */
      if(maKridla){
        zaznam.kridlo = kridlo;
        zaznam.klic = hlavniUsek ? String(p.cislo) : (p.cislo + "-" + iUs);
        zaznam.hlavniUsek = hlavniUsek;
        if(uOd !== null) zaznam.usek = { od:r3(uOd), do:r3(uDo) };   // u podél okapu roviny
      }
      /* D6d: konce se ještě srovnají do rohů (níž, za smyčkou) */
      if(us.doHlavni && uOd !== null && p.baze)
        presneBehy.push({ z:zaznam, p:p, od:uOd, "do":uDo, odsun:zaznam.x + zaznam.presah, stitOd:stitOd, stitDo:stitDo });   // odsun jako kresba (zaokrouhlené x)
      (kridlo ? svKridel : svPodleRovin).push(zaznam);
      });
    });
    /* ── D6d: ROHY VAZNIC VE STEJNÉ VÝŠCE ──────────────────────────────
       Konec běhu se přesune PŘESNĚ na průsečík os s vaznicí sousední
       roviny (stejná výška), když je do 0,6 m — bere se nejbližší. Tak se
       vaznice křídla potká s vaznicí hlavní části pod úžlabní krokví
       a u valby pod nárožní krokví. Délka do výkazu i čára v půdorysu se
       pak berou z týchž čísel (`usek` + `usekPresny`), takže kresba, 3D
       a výkaz souhlasí. Na srovnaném konci se nic nezkracuje do štítu. */
    if(presneBehy.length){
      var osaBod = function(b, u){
        var B = b.p.baze;
        return [B.a[0] + B.dir[0]*u + B.nrm[0]*b.odsun, B.a[1] + B.dir[1]*u + B.nrm[1]*b.odsun];
      };
      /* parametr u na ose `a`, kde ji protne osa `b` (null = rovnoběžné) */
      var prusecikOs = function(a, b){
        var da = a.p.baze.dir, db = b.p.baze.dir;
        var kriz = da[0]*db[1] - da[1]*db[0];
        if(Math.abs(kriz) < 1e-6) return null;
        var Pa = osaBod(a, 0), Pb = osaBod(b, 0);
        var wx = Pb[0]-Pa[0], wy = Pb[1]-Pa[1];
        return { ua: (wx*db[1] - wy*db[0]) / kriz, ub: (wx*da[1] - wy*da[0]) / kriz };
      };
      var nove = presneBehy.map(function(a){ return { od:a.od, "do":a["do"], rohOd:false, rohDo:false }; });
      presneBehy.forEach(function(a, ia){
        var rk = a.z.rucneKonce || {};
        ["od", "do"].forEach(function(konec){
          if(rk[konec]) return;                                   // ručně zaříznutý konec platí
          var nej = null;
          presneBehy.forEach(function(b){
            if(a === b || a.p.cislo === b.p.cislo) return;
            if(Math.abs(a.z.vyska - b.z.vyska) > 0.01) return;      // jen vaznice ve stejné výšce
            var X = prusecikOs(a, b); if(!X) return;
            var da = Math.abs(X.ua - a[konec]);
            /* průsečík musí být u konce `a` a zároveň u některého konce `b` */
            var db = Math.min(Math.abs(X.ub - b.od), Math.abs(X.ub - b["do"]));
            if(da > 0.6 || db > 0.6) return;
            if(!nej || da < nej.d) nej = { d:da, u:X.ua };
          });
          if(nej){ nove[ia][konec] = nej.u; nove[ia][konec === "od" ? "rohOd" : "rohDo"] = true; }
        });
      });
      presneBehy.forEach(function(a, ia){
        var N = nove[ia], z = a.z;
        var sOd = N.rohOd ? 0 : a.stitOd, sDo = N.rohDo ? 0 : a.stitDo;
        var dl = r2(N["do"] - N.od - sOd - sDo);
        if(!(dl > 0.3)) return;
        z.delka = dl;
        z.stitOdM = r3(sOd); z.stitDoM = r3(sDo);
        if(N.rohOd) delete z.vaznikOd;
        if(N.rohDo) delete z.vaznikDo;
        z.usek = { od:Math.round(N.od*1e4)/1e4, "do":Math.round(N["do"]*1e4)/1e4 };   // na desetiny mm, ať se rohy přesně potkají
        z.usekPresny = true;                                     // kresba bere konce přesně odsud
      });
    }
    svKridel.forEach(function(x){ svPodleRovin.push(x); });
    if(maKridla && !kridlaVHlavni && (zadanaVyskaSV > 0 || n(v.ulozeniStredoveM) > 0.05))
      upozorneni.push("Zadaná výška středové vaznice platí jen pro hlavní část střechy — "
        + "v nižším křídle leží středová vaznice v půlce jeho vlastního rozponu.");
    var delkySV = svPodleRovin.map(function(x){ return x.delka; });
    if(delkySV.length){
      var vysky = svPodleRovin.map(function(x){ return x.vyska; });
      var stejne = vysky.every(function(x){ return Math.abs(x-vysky[0])<0.01; });
      prvky.push(prvek("vaznice_stred", ocelStred ? "Středové vaznice — dřevěný hranol na ocelové vaznici" : "Středové vaznice",
        ocelStred ? { b:hranolB, h:hranolH } : P.stredVaznice, delkySV,"model",
        stejne ? ("ve výšce "+vysky[0]+" m nad pozednicí")
               : ("na každé rovině jinak: " + svPodleRovin.map(function(x){
                   return x.sklonDeg+"° ve výšce "+x.vyska+" m"; }).join(", ")
                  + " — každá půlí rozpon od pozednice k hřebeni"),
        true));
      stredoveGeo = { rovin:svPodleRovin, stejneVysky:stejne,
                      vyska: vysky[0], puli: zadanaVyskaSV>0 ? false : true };
      var roztecSlS = n(v.roztecSloupkuStred) || n(v.roztecSloupku) || VYCHOZI.roztecSloupku;
      /* Sloupek nese vaznici zespodu: délka = výška horní plochy vaznice
         nad stropem minus výška jejího profilu. Na nesouměrné střeše je
         každá vaznice jinde vysoko, takže i sloupky pod nimi jsou jiné. */
      /* ── OCELOVÉ STŘEDOVÉ VAZNICE: jeden profil pro všechny běhy ──
         Navrhuje se na nejdelší pole ze všech běhů a na zatěžovací šířku
         poloviny běhu krokve (jako ve statice krovu). */
      var ocelSt = null;
      if(ocelStred){
        var poleSt = [], delkaSt = 0;
        svPodleRovin.forEach(function(sv){
          var plati = sv.hlavniUsek !== false;
          var pd = podporyVaznice(sv.delka, roztecSlS,
            (plati && v.neseStena && v.neseStena[sv.cislo]) || null,
            (plati && v.krizeniSten && v.krizeniSten[sv.cislo]) || null,
            podporyNaVazniku(sv, (plati && v.stitovePodpory && v.stitovePodpory[sv.cislo]) || null),
            (plati && v.sloupkyRucne && v.sloupkyRucne["stred:"+sv.cislo]) || null);
          if(pd && pd.pole) poleSt = poleSt.concat(pd.pole);
          if(sv.delka > delkaSt) delkaSt = sv.delka;
        });
        ocelSt = navrhOcelVaznice("vaznice_stred", ocelStred, ocelV.profilStred,
          { pole: poleSt.length ? poleSt : [roztecSlS], delka: delkaSt },
          Math.max(levá.behZdi, jenJednaRovina ? 0 : pravá.behZdi)/2, "Středové vaznice");
        if(ocelSt){
          P.stredVaznice.h = hranolH + ocelSt.prurez.h;
          ocel.vaznice.push(ocelPolozka("vaznice_stred", "Středové vaznice", ocelSt.prurez.popis, delkySV, ocelSt.prurez.kg, ocelSt));
          ocel.posudky = ocel.posudky.concat(ocelSt.posudek.radky);
          (ocelSt.posudek.upozorneni||[]).forEach(function(u){ if(ocelUpozorneni.indexOf(u) < 0) ocelUpozorneni.push(u); });
          var prS = prvky.filter(function(q){ return q.kod === "vaznice_stred"; })[0];
          if(prS) prS.poznamka = (prS.poznamka ? prS.poznamka + "; " : "") + "hranol " + hranolB + "/" + hranolH
            + " mm přišroubovaný na horní pásnici " + ocelSt.prurez.popis;
        }
      }
      var hVaznice = (P.stredVaznice.h||220)/1000;
      /* Hlídka „vejde se vůbec nějaký sloupek" musí koukat na NEJVYŠŠÍ
         vaznici. Dřív se ptala jen té první; jakmile se ruční polohou
         dala jedna vaznice hodně nízko, zmizely by sloupky i pod těmi
         ostatními (chyceno při zavádění ručních poloh 16. 8. 2026). */
      var delkaSlS = r2(hPozednice + Math.max.apply(null, vysky) - hVaznice);
      var sloupkySV=[];
      /* ── OCELOVÉ RÁMY MÍSTO SLOUPKŮ (PENTI 23. 9. 2026, Odrůvky) ─────
         Volba `podporaStredovych = "ramy"`: středové vaznice nenesou
         sloupky, ale ocelové rámy 2×U (krabice), které stojí patami na
         obvodových zdech a příčlí podepírají OBĚ vaznice najednou. Rámy
         se rozmístí po délce jako vazby věšadla — jen vnitřní, krajní
         pole nesou štítové zdi. Sloupky, pásky ani patky se nevykazují;
         vaznice zůstává spojitý nosník s podporami v rámech. Geometrii
         a posudek rámu dělá modul penti-ram.js, tady se jen rozhodne,
         kde rámy stojí a jak jsou velké. */
      var chceRamy = (v.podporaStredovych === "ramy") && !ocelSt;
      if(ocelSt && v.podporaStredovych === "ramy")
        ocelUpozorneni.push("Ocelové středové vaznice stojí na sloupcích z jeklu — ocelové rámy se s nimi nekombinují.");
      if(chceRamy && !global.PentiRam){
        upozorneni.push("Modul ocelového rámu (penti-ram.js) chybí — použily se sloupky.");
        chceRamy = false;
      }
      if(chceRamy && !(svPodleRovin.length === 2
                       && Math.abs(svPodleRovin[0].delka - svPodleRovin[1].delka) < 0.3)){
        upozorneni.push("Ocelové rámy jdou jen u sedlové střechy se dvěma středovými "
          +"vaznicemi stejné délky — použily se sloupky.");
        chceRamy = false;
      }
      if(delkaSlS > 0.1 && chceRamy){
        var Ram = global.PentiRam;
        var svL = svPodleRovin[0], svP = svPodleRovin[1];
        var delkaBeh = Math.min(svL.delka, svP.delka);
        var roztR = n(v.roztecRamuM) || 4;
        /* Počet polí stejnou konvencí jako sloupky: floor(délka/rozteč),
           nejmíň 2 pole (= aspoň jeden rám). Ruční počet rámů má přednost. */
        var poliR = n(v.pocetRamu) > 0 ? Math.round(n(v.pocetRamu)) + 1
                                       : Math.max(2, Math.floor(delkaBeh/roztR + 1e-9));
        var pocetR = poliR - 1;
        var osovaR = r3(delkaBeh/poliR);
        var polohyR = [], poleRam = [];
        for(var iR2=1; iR2<=pocetR; iR2++) polohyR.push(r3(osovaR*iR2));
        for(var iR3=0; iR3<poliR; iR3++) poleRam.push(osovaR);
        if(!(zdeneStity && zdeneStity.zapnuto)){
          upozorneni.push("Krajní pole vaznic u ocelových rámů musí nést štítové zdi — "
            +"zapni zděné štíty, jinak konce vaznic nemají podporu.");
        }
        svPodleRovin.forEach(function(sv){
          var podpR = { pocetSloupku:0, poli:poliR, roztecSkutecna:osovaR, roztecZadana:roztR,
                        polohy:[], pole:poleRam, delka:r2(sv.delka), ramy:polohyR,
                        podpora:"ramy", stitovePodpory:2, nesouStity:2 };
          podporyVaznic.push(Object.assign({ kod:"vaznice_stred",
            nazev:"Středová vaznice (rovina "+sv.cislo+")",
            profil:P.stredVaznice, rovina:sv.cislo,
            statika: statikaVaznice(podpR, P.stredVaznice, n(v.maxDelkaKusu)||13, v.modelVaznice==="prosty")
          }, podpR));
        });
        /* Geometrie rámu v příčném řezu: x od vnějšího líce levé zdi
           (stejně jako řez), pata v ose zdi (nebo zadaně od líce),
           horní plocha příčle = spodní líc vaznice = délka sloupku. */
        var VNS = venecPodRamem();
        var tlZdiRam = VNS.tlZdiM;
        var pataOd = n(v.pataRamuOdLiceM) || VNS.pataStredM;          // střed betonu věnce
        var Sram = rozponZdiVodorovny;
        var kolenoR = (v.kolenoRamuM != null && v.kolenoRamuM !== "") ? n(v.kolenoRamuM) : 0.75;
        var prRam = Ram.prurez(v.profilRamu || "U200");
        var geoRam = Ram.geometrie({
          rozpetiPatM: r3(Sram - 2*pataOd), zPatyM: n(v.zPatyRamuM) || 0,
          zPricleM: delkaSlS, xVaznicM: [ r3(svL.x - Sram/2), r3((Sram - svP.x) - Sram/2) ],
          odsazeniKolenaM: kolenoR, hProfilM: prRam.h/1000,
          /* rám nesmí vyčnívat nad spodní líc krokví (PENTI 23. 9. 2026) */
          krokev: { hVazniceM: (P.stredVaznice.h||220)/1000, bVazniceM: (P.stredVaznice.b||160)/1000,
                    sklonLDeg: svL.sklonDeg, sklonPDeg: svP.sklonDeg, rezervaM: 0.02 } });
        (geoRam.upozorneni||[]).forEach(function(u){ upozorneni.push(u); });
        ramyGeo = {
          pocet: pocetR, polohy: polohyR, osovaM: osovaR, poli: poliR, roztecZadana: roztR,
          typ: "stred", nese: "středové vaznice",
          profil: prRam.kod, rada: prRam.rada, profilPopis: prRam.popis,
          pata: (v.pataRamu === "pevna") ? "pevna" : "posuvna",
          pataOdLiceM: r3(pataOd), kolenoM: kolenoR, kolenoSkutecneM: geoRam.odsazeniKolenaM,
          kolenoOmezenoM: geoRam.kolenoOmezenoM, zPatyM: n(v.zPatyRamuM) || 0,
          rozpetiPatM: geoRam.rozpetiM, zPricleM: delkaSlS,
          xVaznicOdLiceM: [ r3(svL.x), r3(Sram - svP.x) ],
          vaznice: { bMm: P.stredVaznice.b||160, hMm: P.stredVaznice.h||220 }, venec: VNS, botkaM: 0, styk: v.stykRamu || "sroubovany",
          delkaVazniceM: r2(delkaBeh), rozponM: r3(Sram), tlZdiM: r3(tlZdiRam),
          geo: geoRam, kgm: prRam.kgm,
          delkaKusM: geoRam.delkaM,
          hmotnostKusKg: Math.round(geoRam.delkaM * prRam.kgm*10)/10,
          hmotnostKg: Math.round(geoRam.delkaM * prRam.kgm * pocetR*10)/10
        };
      } else if(delkaSlS > 0.1){
        svPodleRovin.forEach(function(sv){
          var dl = r2(hPozednice + sv.vyska - hVaznice);
          if(dl <= 0.1) return;
          /* Nesené úseky přicházejí zvenčí — geometrii stěn zná ten, kdo
             kreslí půdorys, ne modul krovu. */
          /* Stěny pod vaznicí počítá stránka k rovině — u roviny rozdělené
             na hlavní část a křídlo platí jen pro hlavní běh. */
          var stenyPlati = sv.hlavniUsek !== false;
          var neseTu = (stenyPlati && v.neseStena && v.neseStena[sv.cislo]) || null;
          var krizeniTu = (stenyPlati && v.krizeniSten && v.krizeniSten[sv.cislo]) || null;
          var stitTu = podporyNaVazniku(sv, (stenyPlati && v.stitovePodpory && v.stitovePodpory[sv.cislo]) || null);
          /* ruční polohy sloupků (editor) — jen hlavní běh roviny */
          var rucneTu = (stenyPlati && v.sloupkyRucne && v.sloupkyRucne["stred:"+sv.cislo]) || null;
          var podpS = podporyVaznice(sv.delka, roztecSlS, neseTu, krizeniTu, stitTu, rucneTu);
          if(podpS && podpS.dlouhePoleM)
            upozorneni.push("Středová vaznice (rovina " + sv.cislo + "): ručně rozmístěné sloupky dávají pole "
              + podpS.dlouhePoleM + " m — delší než při automatickém rozmístění (" + podpS.autoPoleM + " m). Vaznice se posuzuje na to pole.");
          var poc = podpS ? podpS.pocetSloupku : 2;
          /* ── SLOUPEK NA NÍZKÉ ZDI SE ZKRÁTÍ ──────────────────────────
             Druhá půlka dohodnutého modelu (PENTI 15. 8. 2026): stěna,
             která na vaznici nedosáhne, ji sice neunese, ale sloupek na ní
             stojí — takže se o její výšku zkrátí. Bez toho by se řezalo
             dřevo, které se stejně zazdí.

             `podporyPodVaznici` popisuje VŠECHNY zdi pod během, i nízké;
             výška je nad ±0, stejně jako se počítá `dl`. */
          var podZdi = (stenyPlati && v.podporyPodVaznici && v.podporyPodVaznici[sv.cislo]) || [];
          var vyskaPod = function(u){
            for(var k=0;k<podZdi.length;k++)
              if(u >= podZdi[k].od-0.02 && u <= podZdi[k].do+0.02)
                return +podZdi[k].vyskaHorniM || 0;
            return 0;
          };
          var polohySl = (podpS && podpS.polohy) ? podpS.polohy : null;
          var delkyTu = [];      // délka každého sloupku — pro panel editoru (stejná čísla jako výkaz)
          for(var i=0;i<poc;i++){
            var pod = polohySl ? vyskaPod(polohySl[i]) : 0;
            var dlTen = r2(dl - Math.max(0, pod));
            /* Zbyde-li kousek, sloupek nemá smysl — vaznice de facto leží
               na zdi. Bezpečnější je počítat s krátkým sloupkem než
               s žádným, tak se jen ořízne na rozumné minimum. */
            sloupkySV.push(dlTen > 0.1 ? dlTen : dl);
            delkyTu.push(dlTen > 0.1 ? dlTen : dl);
          }
          if(podpS) podporyVaznic.push(Object.assign({ kod:"vaznice_stred",
            nazev:"Středová vaznice (rovina "+sv.cislo+(sv.hlavniUsek === false ? ", křídlo" : "")+")",
            profil:P.stredVaznice, rovina:sv.cislo,
            statika: statikaVaznice(podpS, P.stredVaznice, n(v.maxDelkaKusu)||13, v.modelVaznice==="prosty",
                                    stenyPlati ? stykyVaznice("stred:"+sv.cislo) : null)
          }, podpS, sv.klic ? { klic:sv.klic, usek:sv.usek, hlavniUsek:sv.hlavniUsek } : {},
             { delkySloupku: delkyTu },
             /* oblast vazníků: začátek běhu od kraje roviny (pro 3D) a který
                konec leží na krajním vazníku (reakce pro Pamir) */
             (sv.vaznikOd || sv.vaznikDo) ? { odKrajeM:odKrajeVRovine1(sv), obracene:!souhlasneSRovinou1(sv), vaznikOd:!!sv.vaznikOd, vaznikDo:!!sv.vaznikDo } : {}));
        });
        /* ── ROHY, KDE SE VAZNICE STÝKAJÍ ──────────────────────────────
           Každý běh vaznice má sloupek na obou koncích, takže tam, kde se
           dva běhy stýkají v rohu, stály dosud DVA sloupky na jednom místě
           (nalezeno PENTI 15. 8. 2026).

           Podle zvoleného detailu (rozhodnuto PENTI 15. 8. 2026):
             PLÁT — vaznice se v rohu přeplátují a pod spoj přijde JEDEN
               sloupek. Rozteč se do rohu trefí sama: `podporyVaznice`
               staví krajní sloupky přesně na konce běhu.
             OCEL — vaznice se dotýkají na tupo, svislou reakci přenese
               skrytý konektor do druhé vaznice a v rohu sloupek NENÍ. */
        var krizeni = krizeniVaznic(delkySV.length, stitu);
        /* ROHY PODLE PŮDORYSU (4. 10. 2026): u L/T a valeb s křídlem jiné
           výšky se běhy vaznic nepotkávají v čistém rohu a vzorec
           „roviny − štíty" rohy přepočítal (valba do L: 9 místo 8). Kalkulačka
           proto nejdřív spočítá půdorys krovu, sloupky v rozích sloučí podle
           stejných pravidel, jaká kreslí půdorys a 3D, a pošle sem počet rohů
           i pásků. Výkaz, půdorys, 3D a IFC tak mají stejná čísla. */
        var RZP = v.rohyZPudorysu || null;
        if(RZP && RZP.rohu != null && isFinite(+RZP.rohu)) krizeni = Math.max(0, Math.round(+RZP.rohu));
        var detailRohu = (v.rohVaznic === "ocel") ? "ocel" : "plat";
        var sloupkuVRohu = (detailRohu === "ocel") ? 0 : 1;
        var uberSloupku = Math.min(sloupkySV.length, krizeni * (2 - sloupkuVRohu));
        for(var iR=0; iR<uberSloupku; iR++) sloupkySV.pop();

        /* Ocelové středové vaznice: sloupky z jeklu a ocelové pásky; roh
           (detail styku vaznic) se kreslí ve výkresu pro zámečníky. */
        if(ocelSt){
          ocelSloupky("sloupky_stred", "pasky_stred", "Sloupky pod středovými vaznicemi", sloupkySV, ocelSt, krizeni);
        } else {
        /* Dřevěné středové vaznice na sloupcích z jeklu (3. 10. 2026):
           sloupky a pásky jsou ocel, ROH VAZNIC (plát/ocelový konektor)
           zůstává dřevěný detail — počítá se níž stejně jako dřív. */
        var vazDS = jeklStred ? reakceDrevVaznice("vaznice_stred", P.stredVaznice,
          Math.max(levá.behZdi, jenJednaRovina ? 0 : pravá.behZdi)/2, "Středové vaznice") : null;
        if(vazDS){
          ocelSloupky("sloupky_stred", "pasky_stred", "Sloupky pod středovými vaznicemi", sloupkySV, vazDS, krizeni);
          oznacTrmenVaznice("vaznice_stred");
        } else
        prvky.push(oznacCepSloupku(prvek("sloupky_stred","Sloupky pod středovými vaznicemi",P.sloupek,
          sloupkySCepem(sloupkySV, P.sloupek),"model", krizeni
            ? ("délka vyplývá z osedlání krokve · v " + krizeni + " rozích "
               + (sloupkuVRohu ? "stojí jeden sloupek pod přeplátováním"
                               : "sloupek není, vaznice se spojují na tupo"))
            : "délka vyplývá z osedlání krokve"), P.sloupek));

        if(krizeni > 0){
          rohyVaznic = spojRohuVaznic({
            pocet: krizeni, detail: detailRohu, sloupkuVRohu: sloupkuVRohu,
            ubranoSloupku: uberSloupku, profil: P.stredVaznice,
            /* Čep nárožního sloupku se odvozuje z jeho profilu. */
            profilSloupku: P.sloupek,
            delkaSloupku: delkaSlS, behy: svPodleRovin,
            rozteč: roztecSlS, podpory: podporyVaznic,
            /* Zatížení na běžný metr vaznice se počítá tady, protože
               souhrnná statika krovu běží až za výkazem. Středová vaznice
               nese pruh o šířce poloviny rozponu své střechy. */
            zatizeni: (function(){
              var Zk = zatizeniKrovu({
                sklonDeg: levá.sklonDeg, roztecKrokvi: roztecProPosudek,
                profilKrokve: P.krokev,
                snehOblast: n(v.snehOblast) || 2,
                vitrOblast: n(v.vitrOblast) || 2,
                teren: v.teren || "III",
                hmotnostKrytinyKgM2: (v.hmotnostKrytinyKgM2 != null)
                  ? n(v.hmotnostKrytinyKgM2) : 45
              });
              if(!Zk) return null;
              return { wpKNm: Zk.qUlsPresne * (levá.behZdi/2),
                       sirkaM: r2(levá.behZdi/2), qUls: Zk.qUls };
            })()
          });
          if(rohyVaznic && rohyVaznic.upozorneni)
            rohyVaznic.upozorneni.forEach(function(u){ upozorneni.push(u); });
          if(rohyVaznic && rohyVaznic.prvek) prvky.push(rohyVaznic.prvek);
        }

        /* Pásky u středových sloupků dřív chyběly úplně. U valby vaznice
           obíhá dokola; v rohu jdou 2 pásky (podél každé vaznice dovnitř). */
        /* pásky: u půdorysu s křídlem počet z půdorysu (stejné pravidlo jako
           3D — pásek podél každé vaznice, na které sloupek stojí, jen když
           se vejde do běhu); jinak 2 na sloupek minus krajní u štítu */
        var pkS = vazDS ? null : pasky("pasky_stred","Pásky u středových sloupků",   // u jeklu jsou pásky ocelové (výš)
          sloupkySV.length, krizeni, delkaPasku, Ppasek, delkaSlS, upozorneni,
          P.stredVaznice, P.sloupek, paskuKrajnichSloupku(podporyVaznic, "vaznice_stred", delkaPasku, P.sloupek && P.sloupek.b),
          (RZP && RZP.pasku != null) ? RZP.pasku : null);
        if(pkS) prvky.push(pkS);
        }   // konec dřevěné větve (ocelové vaznice mají sloupky z jeklu výš)
      } else {
        upozorneni.push("Středová vaznice je tak nízko, že se pod ni sloupek nevejde.");
      }
    }
  }

  /* ══════════════════════════════════════════════════════════════════════
     KLEŠTINY
     ----------------------------------------------------------------------
     Výška se NEZADÁVÁ, vyplývá z konstrukce — stejně jako u osedlání
     a délky sloupků (upřesněno PENTI 14. 8. 2026):

       • je-li VRCHOLOVÁ VAZNICE, kleština se opře HORNÍM lícem o její
         spodní hranu — visí pod ní,
       • jinak u STŘEDOVÝCH VAZNIC dosedne SPODNÍM lícem na jejich horní
         hranu — leží na nich.

     MALÉ KLEŠTINY POD HŘEBENEM se u středových vaznic dělají navíc.
     Vrcholová vaznice tam není, takže se nemají o co opřít — jejich poloha
     se proto zadává vzdáleností spodního líce od hřebene.
     ══════════════════════════════════════════════════════════════════════ */
  var klestinyGeo=null, klestinyVrcholGeo=null, klestinyMaleGeo=null, hambalekGeo=null;
  var vyskyKridlaRad = {};      // kód řady → funkce výšky v křídle (jen uvnitř modulu)
  var hKlestiny = (P.klestina.h||160)/1000;
  /* Kleštiny (a hambálky) jsou jen na PÁRECH pod hřebenem — kolmo
     k hřebeni, nikdy do valby ani přes nárožníky (PENTI 1. 10. 2026).
     Dřív se počítala kleština na každou krokev včetně valby a námětků. */
  var krokviVParech = 0;
  Object.keys(krokveRovin).forEach(function(c){
    var kr = krokveRovin[c]; if(!kr || !kr.hreben) return;
    krokviVParech += kr.osy.filter(function(u){ return u >= kr.hreben.od - 0.005 && u <= kr.hreben.do + 0.005; }).length;
  });
  if(!Object.keys(krokveRovin).length) krokviVParech = vsechnyKrokve.length;
  var paruKrokvi = krokviVParech/2;
  /* ── KLEŠTINY PO PÁRECH (PENTI 2. 10. 2026) ────────────────────────────
     Délka kleštiny se dřív brala z jednoho řezu domu. U křídla L/T, které
     je užší a nižší, pak trčela do nároží; ve sběžišti se navíc dávala i na
     lípance, které do výšky kleštin nedosáhnou. Teď se pro KAŽDÝ PÁR spočítá:
       · kde krokev v dané výšce končí (konec kleštiny, lícem s krokví):
         od líce zdi xL = odsazení + (y − nadsedloví/cos α)/tg α;
       · půlka kleštiny = vodorovně od hřebene k tomu konci;
       · kleština je jen tam, kde OBĚ krokve páru dosáhnou dolů až ke konci
         kleštiny (lípanec nad úžlabím ne) a kde je hřeben nad kleštinou.
     Sedlová střecha vyjde přesně jako dřív (obě půlky = délka z řezu). */
  /* `vyska` platí pro hlavní část. U střechy s nižším křídlem (2. 10. 2026)
     dá `vyskaKridla(p, usek)` výšku řady v křídle (nebo null = v křídle
     tahle řada není). Pár má jednu výšku — u dvou různých rozhoduje nižší. */
  /* ── KLEŠTINA PRODLOUŽENÁ K VNĚJŠÍ HRANĚ KROKVÍ PULTU (2026.11.234 —
     PENTI 16. 11. 2026: „možnost prodloužit kleštiny až na vnější hranu
     krokve vikýře"). U přerušené krokve pod pultovým vikýřem s volbou
     `klestinyKCelu` kleština nekončí na (chybějící) hlavní krokvi, ale jde
     dál k čelu a končí zaříznutá v rovině horního líce krokví pultu:
     spodní hrana tam, kde horní líc pultu protne spodek kleštiny, horní
     hrana tam, kde protne její vršek (nejdál k čelu = líc čela).
     Výšky jsou nad horním lícem pozednice jako u kleštin; horní líc hlavní
     krokve T(x) = nadsedloví/cos + (x − odLice)·tg, x vodorovně od líce zdi.
     Vrací { vDol, vDolNahore, sklonDeg } (půdorysně od okapu) nebo null. */
  var klestinaKCelu = function(x, y, hKl){
    var p = roviny.filter(function(q){ return q.cislo === x.cislo; })[0];
    var ot = p && p.otvoryKrovu; if(!ot) return null;
    var o = ot.filter(function(q){ return q.klestinyKCelu && q.typ === "pultovy" && x.u > q.u0 + 0.005 && x.u < q.u1 - 0.005; })[0];
    if(!o || !(o.sklonPultu > 0.5) || !(o.vyskaCela > 0)) return null;
    var tb = Math.tan(o.sklonPultu*Math.PI/180);
    var xF = ((o.vCelo != null ? o.vCelo : o.v0) * x.cs) - x.presah;             // líc čela od líce zdi
    var Pf = nadsedlovi/x.cs + (xF - odLice)*x.tg + o.vyskaCela;                // horní líc pultu nad čelem
    var xBot = Math.max(xF, xF + (y - Pf)/tb), xTop = Math.max(xF, xF + (y + hKl - Pf)/tb);
    var xL = odLice + (y - nadsedlovi/x.cs)/x.tg;
    /* KLEŠTINA POD KROKVEMI PULTU (2026.11.236 — kleštiny pod vaznicemi):
       když celá kleština leží níž než spodek krokví pultu nad čelem, krokví
       pultu se nedotkne a u čela by prošla zdí / pozednicí čela. Pak končí
       svisle na VNITŘNÍM líci zdi čela (u lehkého čela v jeho líci). */
    var hPult = (P.krokev.h||180)/1000/Math.cos(o.sklonPultu*Math.PI/180);
    if(y + hKl <= Pf - hPult + 0.005){
      var xZ = xF + (o.celoZdene ? Math.max(0.1, +o.zedCelaTl || 0.3) : 0);
      if(!(xZ < xL - 0.05)) return null;
      return { vDol:r3(x.presah + xZ), vDolNahore:r3(x.presah + xZ), sklonDeg:Math.round(o.sklonPultu*10)/10, uZdi:true };
    }
    if(!(xBot < xL - 0.05)) return null;                                        // nic by se neprodloužilo
    return { vDol:r3(x.presah + xBot), vDolNahore:r3(x.presah + xTop), sklonDeg:Math.round(o.sklonPultu*10)/10 };
  };
  /* SMAZANÉ KLEŠTINY (2026.11.240 — PENTI 17. 11. 2026: „vybrat kleštiny nejen
     jako pár, ale i samostatně … smazat — třeba při kolizi se štítem nebo
     komínem; svorníky by pak nebyly dvojstřižný spoj, ale jednostřižný").
     v.klestinySmazane = { "<kód řady>|<rovina>:<u>|<strana a/b>": true }.
     Pár = dvě krokve proti sobě; klíč podle krokve s nižším číslem roviny
     (u na cm). Strana a = ve směru `dir` té roviny (+), b = proti (−). */
  var smazaneKl = v.klestinySmazane || {};
  var klicParuKl = function(kod, q){
    var x = q[0].cislo <= q[1].cislo ? q[0] : q[1];
    return (kod || "klestiny") + "|" + x.cislo + ":" + (Math.round(x.u*100)/100).toFixed(2);
  };
  var klestinyPoParech = function(vyska, vyskaKridla, kod, naPar){
    if(!Object.keys(krokveRovin).length) return null;
    var pary = [], konce = [];
    roviny.forEach(function(p){
      var kr = krokveRovin[p.cislo]; if(!kr || !kr.hreben) return;
      var sk = (p.sklon||0)*Math.PI/180, tg = Math.tan(sk), cs = Math.cos(sk);
      if(tg < 0.01) return;
      var presah = presahRoviny(p);
      var rings = p.tvarRings || (p.tvar ? [p.tvar] : []);
      kr.osy.forEach(function(u){
        if(u < kr.hreben.od - 0.005 || u > kr.hreben.do + 0.005) return;
        var uu = Math.min(Math.max(u, kr.min + 0.02), kr.max - 0.02);
        var y = vyska;
        if(maKridla){
          var us = usekVU(p, uu);
          if(us.kridlo){ y = vyskaKridla ? vyskaKridla(p, us) : null; if(y == null) return; }
        }
        var hr = hranyVU(rings, uu);
        var P = bodRoviny(p, uu, hr.vrch);
        /* Krokve páru se potkají ve stejném bodě hřebene. Páruje se podle
           VZDÁLENOSTI (do 3 cm), ne zaokrouhlením souřadnic — bod ležící
           přesně na hranici zaokrouhlení by jinak pár rozdělil (2. 10. 2026). */
        var q = { P:P, cislo:p.cislo, u:r3(u), y:y, hr:hr, cs:cs, tg:tg, presah:presah };
        var nalez = null;
        for(var i=0;i<pary.length && !nalez;i++){
          var Q = pary[i][0].P;
          if(Math.abs(Q[0]-P[0]) < 0.03 && Math.abs(Q[1]-P[1]) < 0.03) nalez = pary[i];
        }
        if(nalez) nalez.push(q); else pary.push([q]);
      });
    });
    var delky = [];
    pary.forEach(function(q){
      if(q.length !== 2) return;                                // jen celé páry
      var y = Math.min(q[0].y, q[1].y);
      var pul = [], ok = true;
      q.forEach(function(x){
        var xL = odLice + (y - nadsedlovi/x.cs)/x.tg;          // od líce zdi
        var vHor = x.hr.vrch*x.cs, vDol = x.presah + xL;        // půdorysně od okapu
        if(vHor - vDol < 0.10) ok = false;                      // hřeben pod kleštinou
        if(x.hr.spodek*x.cs > vDol - 0.02) ok = false;          // krokev (lípanec) nedosáhne
        var ext = klestinaKCelu(x, y, hKlestiny);               // k čelu pultového vikýře (2026.11.234)
        if(ext) vDol = ext.vDol;
        pul.push({ cislo:x.cislo, u:x.u, vDol:r3(vDol), vHor:r3(vHor), pul:vHor - vDol, kCelu:ext });
      });
      if(!ok) return;
      /* strany, které zůstaly (u dvojic kleštin; hambálek se nemaže) */
      var klP = klicParuKl(kod, q), strany = ["a", "b"];
      if(naPar === 2) strany = strany.filter(function(st){ return !smazaneKl[klP + "|" + st]; });
      delky.push({ d:r2(pul[0].pul + pul[1].pul), strany:strany, klic:klP });
      pul.forEach(function(x){
        var k = { cislo:x.cislo, u:x.u, vDol:x.vDol, vHor:x.vHor, klicParu:klP, strany:strany.slice() };
        if(x.kCelu){ k.vDolNahore = x.kCelu.vDolNahore; k.sklonKonceDeg = x.kCelu.sklonDeg; if(x.kCelu.uZdi) k.konecUZdi = true; }
        if(maKridla) k.y = r3(y);                               // výška páru (křídlo jinak)
        konce.push(k);
      });
    });
    return { delky:delky, konce:konce };
  };
  /* kusy do výkazu: `naPar` kusů na každý pár (kleštiny 2, hambálek 1–2) */
  var kusyKlestin = function(geo, naPar, zalozniPocet, vyskaKridla){
    var kp = klestinyPoParech(geo.vyska, vyskaKridla, geo.kod, naPar);
    if(!kp){ return nKusu(zalozniPocet, geo.delka); }
    geo.konce = kp.konce;
    var out = [], jedno = 0, bez = 0, smaz = 0;
    kp.delky.forEach(function(d){
      var n = (naPar === 2) ? d.strany.length : naPar;          // smazané strany se nepočítají (2026.11.240)
      for(var i=0;i<n;i++) out.push(d.d);
      if(naPar === 2){ smaz += 2 - n; if(n === 1) jedno++; if(n === 0) bez++; }
    });
    geo.paru = kp.delky.length - bez;
    geo.jednostranne = jedno; geo.bezKlestin = bez; geo.smazanoKusu = smaz;
    return out;
  };
  /* ── VÝŠKY ŘAD V KŘÍDLE (2. 10. 2026) ─────────────────────────────────
     Stejná pravidla jako v hlavní části, jen z hřebene křídla `us.H`:
       · na středových vaznicích — horní plocha středové vaznice křídla,
       · pod vrcholovou vaznicí — spodní líc její vaznice minus kleština,
       · bez vaznic — polovina výšky křídla. Zadané výšky platí jen pro
         hlavní část (varianta 1a). */
  var hrebenKridlaNadPoz = function(p, us){
    return us.H - odLice*Math.tan((p.sklon||0)*Math.PI/180);
  };
  var stredovaKridla = function(p, us){
    if(kridlaVHlavni) return nizkyUsek(us) ? null : r2(hpCilKridla);   // D6d: ve výšce hlavní části; nízké křídlo vaznici nemá
    var tgR = Math.tan((p.sklon||0)*Math.PI/180);
    return r2(((us.H/2)/tgR - bStredove/2 - odLice)*tgR);
  };
  var podVrcholovouKridla = function(p, us, hVaz, hKl){
    return r3(yVrcholoveKridla(p, us.H) - hPozednice - hVaz - hKl);
  };
  /* Vodorovný prvek v dané výšce → délka, nebo null když nevyjde. */
  var vodorovnyPrvek = function(vyska, vyskaProfilu, nazev){
    /* Konce se měří od POZEDNIC, ne od okapů — mezi pozednicemi je šířka
       domu. Dřív se odečítalo od rozponu včetně přesahů a každá kleština
       vycházela delší přesně o oba přesahy. */
    var geo = delkaVodorovneho(rozponZdiVodorovny, levá.sklonRad, pravá.sklonRad,
                               vyska, vyskaProfilu, nadsedlovi, odLice);
    geo.vyska = r3(vyska);          // na milimetry, viz delkaVodorovneho
    if(geo.delka > 0.2) return geo;
    upozorneni.push(nazev+" ve výšce "+r2(vyska)+" m nad pozednicí vychází kratší "
      +"než 20 cm — v té výšce už se krokve téměř dotýkají.");
    return null;
  };

  if(S.klestiny){
    var hVaznice = (P.vaznice.h||200)/1000;
    var maVrcholovou = (S.vrchol || S.vesadlo) && r2(g.ridge||0) > 0.05;
    /* Výška horní plochy vrcholové vaznice nad pozednicí. Měří se ZE ZDI,
       tedy `behZdi` — stejně jako poloha samotné vaznice. Dřív tu stálo
       `beh` včetně přesahu okapu, takže kleštiny visely o přesah × tg(sklon)
       výš než vaznice, pod kterou mají viset (opraveno PENTI 15. 8. 2026). */
    /* Horní plocha vrcholové vaznice nad HORNÍM lícem pozednice, měřená
       na vnější hraně — stejně jako všude jinde (20. 8. 2026). */
    var yVrcholovaVrch = (levá.behZdi - bVrcholove/2 - odLice)*Math.tan(levá.sklonRad)
                       + zdvihSedlaVrchol();               // oprava znaménka 11. 10. 2026

    /* ŘADY KLEŠTIN. U soustavy „obě" jsou DVĚ (potvrzeno PENTI 14. 8. 2026):
       spodní leží na středových vaznicích, horní visí pod vrcholovou. */
    var rady = [];
    /* Spodní hranu kleštin jde zadat i absolutně nad ±0 — tak se to na
       stavbě odměřuje (PENTI 16. 8. 2026). Převod do soustavy modulu:
           výška nad pozednicí = zadané − nadezdívka − výška pozednice */
    var klestinyNadNulou = n(v.klestinyNadNulouM);
    var vyskaKlestinZadana = n(v.vyskaKlestin);
    if(!(vyskaKlestinZadana > 0) && klestinyNadNulou > 0){
      var prevod = r2(klestinyNadNulou - nadezdivka - hPozednice);
      if(prevod > 0.05) vyskaKlestinZadana = prevod;
      else upozorneni.push("Kleštiny zadané " + klestinyNadNulou + " m nad ±0 "
        + "by ležely pod pozednicí — použila se automatická výška.");
    }
    if(vyskaKlestinZadana > 0){
      /* KLEŠTINA NESMÍ PROJET VRCHOLOVOU VAZNICÍ.
         Kleština visí pod vaznicí a smí se jí dotýkat jen hranou — horní
         líc kleštiny na spodním líci vaznice. Automatická výška to tak
         počítá, ale ručně zadaná se dosud nekontrolovala vůbec: při
         zadání o 40 cm výš prošla kleština vaznicí skrz a nikdo nic
         neřekl (nalezeno 19. 8. 2026).
         Nejvýš přípustná spodní hrana = spodní líc vaznice − výška kleštiny. */
      if(maVrcholovou){
        var stropKlestin = r3(yVrcholovaVrch - hVaznice - hKlestiny);  // na mm, viz výše
        if(vyskaKlestinZadana > stropKlestin + 0.001){
          upozorneni.push("Kleštiny zadané ve výšce "
            + r2(vyskaKlestinZadana) + " m nad pozednicí by prošly vrcholovou "
            + "vaznicí (zajely by do ní o "
            + Math.round((vyskaKlestinZadana - stropKlestin)*1000) + " mm). "
            + "Kleština pod ní visí a smí se jí dotýkat jen hranou, proto "
            + "byla posazena na " + stropKlestin + " m — těsně pod vaznici.");
          vyskaKlestinZadana = stropKlestin;
        }
      }
      if(maKridla) upozorneni.push("Zadaná výška kleštin platí jen pro hlavní část střechy — "
        + "v nižším křídle se kleštiny položí podle jeho vaznic.");
      rady.push({ kod:"klestiny", nazev:"Kleštiny",
                  kridlo: function(p, us){
                    if(S.stred) return stredovaKridla(p, us);
                    if(maVrcholovou) return podVrcholovouKridla(p, us, hVaznice, hKlestiny);
                    return r2(hrebenKridlaNadPoz(p, us)/2);
                  },
                  vyska:vyskaKlestinZadana, odkud:
                    (klestinyNadNulou > 0 && !(n(v.vyskaKlestin) > 0))
                      ? ("zadaná výška " + klestinyNadNulou + " m nad ±0")
                      : "zadaná výška" });
    } else {
      if(S.stred && stredoveGeo && stredoveGeo.rovin.length){
        /* Výška řady v hlavní části se bere jen z běhů hlavní části —
           běhy nižšího křídla mají svou řadu (viz `kridlo`). */
        var behyHlavni = stredoveGeo.rovin.filter(function(x){ return !x.kridlo; });
        if(!behyHlavni.length) behyHlavni = stredoveGeo.rovin;
        var hlavniStejne = behyHlavni.every(function(x){ return Math.abs(x.vyska - behyHlavni[0].vyska) < 0.01; });
        /* Spodní líc na horní hraně středových vaznic. Když jsou na každé
           rovině jinak vysoko, rozhoduje ta NIŽŠÍ — na vyšší by kleština
           nedosedla. */
        /* POD STŘEDOVÝMI VAZNICEMI (2026.11.236 — volba `klestinyPodStredovou`):
           horní líc kleštin na spodním líci vaznic; kleštiny pak sevřou
           sloupky a krokve pod vaznicí (projekt statiky 277_26). */
        var podV = !!v.klestinyPodStredovou, hSV = (P.stredVaznice && P.stredVaznice.h || 220)/1000;
        var vyNa = Math.min.apply(null, behyHlavni.map(function(x){ return x.vyska; }));
        rady.push({ kod:"klestiny", nazev:"Kleštiny",
          kridlo: podV ? function(p, us){ var y0 = stredovaKridla(p, us); return y0 == null ? null : r3(y0 - hSV - hKlestiny); } : stredovaKridla,
          vyska: podV ? r3(vyNa - hSV - hKlestiny) : r2(vyNa),
          odkud: podV ? "horní líc na spodní hraně středových vaznic (pod vaznicemi)" : "spodní líc na horní hraně středových vaznic" });
        if(!hlavniStejne)
          upozorneni.push("Středové vaznice nejsou na obou rovinách stejně vysoko — "
            +"kleštiny se položily na tu nižší.");
      }
      if(maVrcholovou){
        /* Horní líc na spodní hraně vrcholové vaznice — kleština pod ní visí. */
        rady.push({ kod: rady.length ? "klestiny_vrchol" : "klestiny",
          nazev: rady.length ? "Kleštiny u vrcholové vaznice" : "Kleštiny",
          kridlo: function(p, us){ return podVrcholovouKridla(p, us, hVaznice, hKlestiny); },
          /* Na MILIMETRY, ne na centimetry: podle tohohle čísla se kreslí
             i kótuje úřez kleštiny, takže zaokrouhlení na 1 cm dělalo
             kótu o 10 mm vedle nakreslené hrany (20. 8. 2026). */
          vyska: r3(yVrcholovaVrch - hVaznice - hKlestiny),
          odkud:"horní líc na spodní hraně vrcholové vaznice" });
      }
      if(!rady.length){
        rady.push({ kod:"klestiny", nazev:"Kleštiny",
                    kridlo: function(p, us){ return r2(hrebenKridlaNadPoz(p, us)/2); },
                    vyska:r2(vyskaHrebeneNadPoz/2), odkud:"polovina výšky střechy" });
      }
    }

    rady.forEach(function(rada){
      var geo = vodorovnyPrvek(rada.vyska, hKlestiny, rada.nazev);
      if(!geo) return;
      geo.odkud = rada.odkud;
      geo.kod = rada.kod;
      if(rada.kod === "klestiny_vrchol") klestinyVrcholGeo = geo;
      else                               klestinyGeo = geo;
      vyskyKridlaRad[rada.kod] = rada.kridlo || null;            // výška řady v křídle
      var kusyR = kusyKlestin(geo, 2, paruKrokvi*2, rada.kridlo);
      prvky.push(prvek(rada.kod, rada.nazev, P.klestina, kusyR, "model",
        "2 ks na pár krokví, spodní hrana "+geo.vyska+" m nad pozednicí ("
        +rada.odkud+"), konce zaříznuté lícem s krokví"
        + (geo.smazanoKusu ? "; ručně smazáno " + geo.smazanoKusu + " ks" + (geo.jednostranne ? " (" + geo.jednostranne + " párů jen z jedné strany — svorníky jednostřižně)" : "") : "")));
      var prK = prvky[prvky.length - 1];
      if(prK && prK.kod === rada.kod && geo.konce){ prK.paru = geo.paru; prK.jednostranne = geo.jednostranne || 0; }   // pro svorníky (2026.11.240)
      if(geo.bezKlestin) upozorneni.push(rada.nazev + ": ručně smazané obě kleštiny páru (počet párů krokví: " + geo.bezKlestin + ") — "
        + "pár nemá táhlo, rozpěr musí přenést vaznice nebo věnec. Ověří statik.");
    });

    /* --- MALÉ KLEŠTINY POD HŘEBENEM (volitelné) ---
       Mají smysl jen tam, kde vrcholová vaznice není — jinak už u hřebene
       jedna řada visí pod ní. */
    if(v.maleKlestiny && !maVrcholovou){
      var odstup = (v.maleKlestinyOdHrebene!=null)
                 ? n(v.maleKlestinyOdHrebene) : VYCHOZI.maleKlestinyOdHrebene;
      var hMale = r2(vyskaHrebeneNadPoz - odstup);
      if(hMale <= (klestinyGeo ? klestinyGeo.vyska : 0) + 0.05){
        upozorneni.push("Malé kleštiny pod hřebenem by vyšly ve výšce "+hMale
          +" m, tedy prakticky na úrovni hlavních kleštin. Zvětši odstup od hřebene, "
          +"nebo je vynech.");
      } else {
        klestinyMaleGeo = vodorovnyPrvek(hMale, hKlestiny, "Malé kleštiny");
        if(klestinyMaleGeo) klestinyMaleGeo.kod = "klestiny_male";              // klíč smazaných (2026.11.240)
        if(klestinyMaleGeo){
          klestinyMaleGeo.odstupOdHrebene = r2(odstup);
          var maleKridlo = function(p, us){
            var hM = r2(hrebenKridlaNadPoz(p, us) - odstup);
            var pod = vyskyKridlaRad.klestiny ? vyskyKridlaRad.klestiny(p, us) : 0;
            return (hM > (pod||0) + 0.05) ? hM : null;
          };
          vyskyKridlaRad.klestiny_male = maleKridlo;
          prvky.push(prvek("klestiny_male","Kleštiny malé (pod hřebenem)",P.klestina,
            kusyKlestin(klestinyMaleGeo, 2, paruKrokvi*2, maleKridlo),"model",
            "2 ks na pár krokví, spodní líc "+r2(odstup)+" m pod hřebenem"));
        }
      }
    } else if(v.maleKlestiny && maVrcholovou){
      upozorneni.push("Malé kleštiny pod hřebenem se nepřidávají — vrcholová vaznice "
        +"tam už je a kleštiny visí pod ní.");
    }
  }

  /* --- HAMBÁLKY ---
     PROVEDENÍ (PENTI 21. 9. 2026): „jeden" = jednostranný hambálek
     přiložený z boku krokve (jeden kus, svorníky jednostřižně), „dva" =
     oboustranné kleštiny (dva kusy z obou stran krokve, dvojstřižně).
     Kód prvku zůstává `hambalky`, ať řez, výkresy i tisk fungují stejně;
     liší se počet kusů a způsob posouzení spoje. */
  if(S.hambalek){
    var hHam = n(v.vyskaHambalku) || r2(vyskaHrebeneNadPoz/2);
    var hamKusu = (v.hambalekProvedeni === "dva") ? 2 : 1;
    hambalekGeo = delkaVodorovneho(rozponZdiVodorovny, levá.sklonRad, pravá.sklonRad,
                                   hHam, (P.hambalek.h||160)/1000, nadsedlovi, odLice);
    hambalekGeo.vyska = hHam;
    hambalekGeo.kusu = hamKusu;
    if(hambalekGeo.delka > 0.2){
      var paruH = Math.round(paruKrokvi);
      prvky.push(prvek("hambalky", hamKusu === 2 ? "Hambálky — kleštiny z obou stran" : "Hambálky", P.hambalek,
        kusyKlestin(hambalekGeo, hamKusu, paruH*hamKusu, (vyskyKridlaRad.hambalky = function(p, us){ return r2(hrebenKridlaNadPoz(p, us)/2); })),"model",
        (hamKusu === 2 ? "2 ks na pár krokví (z obou stran krokve), " : "1 ks na pár krokví (z boku krokve), ")
        + "spodní hrana "+hHam+" m nad pozednicí, konce zaříznuté lícem s krokví"));
    } else {
      upozorneni.push("Hambálek ve výšce "+hHam+" m vychází kratší než 20 cm — zkontroluj výšku.");
      hambalekGeo=null;
    }
  }

  /* --- PODKLAD PRO ŘEZ A PŮDORYS ---
     Kreslení bere polohy PRÁVĚ ODSUD, ne z vlastních vzorců. Díky tomu nemůže
     nastat to, co v původní kalkulačce: že se ve výkazu počítá jeden prvek
     a v řezu se kreslí jiný, nebo v jiné výšce. Co tu není, se nekreslí. */
  var maKod = function(kod){ return prvky.some(function(p){ return p.kod===kod; }); };
  var vyskaPrvku = function(kod, zaloha){
    var p=prvky.filter(function(x){ return x.kod===kod; })[0];
    return p ? zaloha : null;
  };

  /* ── MÍSTNÍ ŘEZY KŘÍDEL (2. 10. 2026) ─────────────────────────────────
     Pro výrobní výkres „Krokev křídla": ke každému nižšímu křídlu jeho
     sklon, běh, poloha středové vaznice a polohy kleštin na krokvi —
     z týchž čísel jako výkaz. */
  var rezyKridel = [];
  if(maKridla){
    var videne = {};
    roviny.forEach(function(p){
      var k = kotvyKrokvi[p.cislo]; if(!k || k.typ !== "hreben") return;
      var us = usekVU(p, (k.uA + k.uB)/2); if(!us.kridlo) return;
      var sk = (p.sklon||0)*Math.PI/180, tgR = Math.tan(sk);
      var klicK = r2(us.H) + "/" + r2(p.sklon||0) + "/" + r3(presahRoviny(p));
      if(videne[klicK]) return; videne[klicK] = true;
      var behZdiK = us.H/tgR;
      var svK = (stredoveGeo && maKod("vaznice_stred")) ? stredoveGeo.rovin.filter(function(x){ return x.cislo === p.cislo && x.kridlo; })[0] : null;
      var rady = [];
      [["klestiny", klestinyGeo, "Kleštiny", hKlestiny], ["klestiny_vrchol", klestinyVrcholGeo, "Kleštiny u vrcholové vaznice", hKlestiny],
       ["klestiny_male", klestinyMaleGeo, "Malé kleštiny", hKlestiny], ["hambalky", hambalekGeo, "Hambálek", (P.hambalek.h||160)/1000]]
        .forEach(function(x){
          if(!x[1] || !maKod(x[0]) || !vyskyKridlaRad[x[0]]) return;
          var y = vyskyKridlaRad[x[0]](p, us); if(y == null) return;
          var dv = delkaVodorovneho(2*behZdiK, sk, sk, y, x[3], nadsedlovi, odLice);
          if(!(dv.delka > 0.2)) return;
          rady.push({ kod:x[0], nazev:x[2], vyska:r3(y), xDole:dv.xDole, xNahore:dv.xNahore,
                      hProfiluMm: Math.round(x[3]*1000) });
        });
      rezyKridel.push({ klic:"kridlo-" + (rezyKridel.length + 1), rovina:p.cislo, H:us.H,
        sklonDeg:r2(p.sklon||0), presah:r3(presahRoviny(p)), behZdi:r3(behZdiK),
        stredovaX: svK ? svK.x : null, vrcholova: maKod("vaznice_vrchol"), klestiny: rady });
    });
  }

  var rez = {
    rezyKridel: rezyKridel.length ? rezyKridel : null,
    pult: !!S.pult,
    /* věšadlo — polohy pro řez; kreslí se z týchž čísel jako výkaz */
    vesadlo: vesadloGeo,
    naroznik: naroznikGeo,
    podporyVaznic: podporyVaznic,
    /* U pultové je rozpon celá šířka střechy včetně přesahů; poloha zdí
       se pozná z přesahu, který se předává jen kvůli kreslení. */
    rozponM: S.pult ? r2(maxSpad*Math.cos(a)) : rozponVodorovny,
    presahVodorovny: n(v.presahOkapVodorovny) || 0,
    /* výška hřebene nad horní plochou pozednice — fyzická, od hrany pozednice */
    vyskaM: vyskaHrebeneNadPoz,
    sklonDeg: r2(sklonHlavni),
    presahOkap: presahOkap,
    /* Přeplátování ve vrcholu — výrobní výkres krokve ho potřebuje.
       Bez vrcholové vaznice se dopočítá z geometrie plátu, jinak je to
       zadaná řezná rezerva (PENTI 17. 8. 2026). Kdyby si ho výkres bral
       ze zadání, rozešel by se s výkazem. */
    presahHreben: r3(presahZaHreben(levá.rovina)),
    presahHrebenZadany: r3(presahHreben),
    /* tvar zhlaví u okapu — pro popis v kusovníku (PENTI 7. 10. 2026) */
    patka: { typ: v.patkaTyp || "svisly_zkraceny", vyskaCelaMm: n(v.vyskaCelaMm) || 120 },
    presahHrebenZGeometrie: !maVrcholovouVaznici && !jenJednaRovina,
    presahyZaHrebenem: presahyZaHrebenem,
    /* pásek: profil, který opravdu jde do výkazu (bez vlastního = profil
       sloupku) — 3D, IFC a výkresy ho berou odsud (PENTI 4. 10. 2026) */
    profily: Object.assign({}, P, { pasek: Ppasek }),
    /* osedlání — zářez třetina, nadsedloví dvě třetiny výšky krokve (kolmo) */
    osedlani: { sedlo: sedlo, nadsedlovi: nadsedlovi, hKrokve: hKrokve,
                hPozednice: hPozednice, auto: sedloAuto,
                doporucenoMm: Math.round(hKrokve/3*1000) },
    /* ── VODOROVNÉ UMÍSTĚNÍ POZEDNICE ──────────────────────────────────
       Odsazení vnějšího líce pozednice od vnějšího líce nadezdívky.
       0 = zarovnaná s lícem, kladné = zatažená dovnitř (PENTI 16. 8. 2026).

       MNOŽSTVÍ TO NEMĚNÍ. Krokev pořád běží od okapní hrany k hřebeni,
       takže její délka je stejná; posune se jen místo, kde na pozednici
       dosedne — a to je věc výrobního výkresu a řezu, ne výkazu. */
    pozedniceOdLice: r3(n(v.pozedniceOdLiceM) || 0),
    /* ── VÝŠKY NAD HRUBOU PODLAHOU (±0) ────────────────────────────────
       Všechno ostatní v `rez` je měřené od pozednice — tohle je jediné
       místo, kde se to převádí na výšky, které se na stavbě odměřují od
       podlahy. Uložení = spodní líc prvku, tedy to, na co dosedá.
       `null` znamená, že prvek v téhle soustavě není. */
    vysky: {
      nadezdivka: r3(nadezdivka),
      pozedniceDole: r3(nadezdivka),                  // uložení pozednice
      pozedniceNahore: nadNulou(hPozednice),
      /* HŘEBEN = HORNÍ HRANA KROKVÍ V OSE (PENTI 23. 9. 2026: „sjednoť to").
         Do té doby tu byla výška SEDLOVÉ roviny v ose (pozednice + běh·tg),
         zatímco štít pro zedníky a řez vazbou kótují horní hranu krokví —
         o nadsedloví/cos výš (198_25: 2710 proti 2842 mm). Jedna míra
         všude; sedlová rovina zůstává k dispozici jako `hrebenSedlovaRovina`. */
      hreben: nadNulou(hPozednice + vyskaHrebeneNadPoz + nadsedlovi/Math.cos(levá.sklonRad)),
      hrebenSedlovaRovina: nadNulou(hPozednice + vyskaHrebeneNadPoz),
      stredoveUlozeni: (stredoveGeo && stredoveGeo.rovin.length)
        ? stredoveGeo.rovin.map(function(sv){
            var u = { cislo:sv.cislo,
                     ulozeni: nadNulou(hPozednice + sv.vyska
                                       - (P.stredVaznice.h||220)/1000),
                     hornPlocha: nadNulou(hPozednice + sv.vyska) };
            if(sv.klic){ u.klic = sv.klic; u.kridlo = !!sv.kridlo; }   // střecha s křídlem
            return u; })
        : [],
      vrcholUlozeni: maKod("vaznice_vrchol")
        ? nadNulou(vyskaVrcholoveVaznice(poloRozpon) - (P.vaznice.h||200)/1000) : null,
      klestinyDole: (klestinyGeo && klestinyGeo.vyska != null)
        ? nadNulou(hPozednice + klestinyGeo.vyska) : null,
      klestinyVrcholDole: (klestinyVrcholGeo && klestinyVrcholGeo.vyska != null)
        ? nadNulou(hPozednice + klestinyVrcholGeo.vyska) : null,
      hambalekDole: (hambalekGeo && hambalekGeo.vyska != null)
        ? nadNulou(hPozednice + hambalekGeo.vyska) : null,
      /* Věšadlo: trám leží na věnci, okapová vaznice na trámu. Tohle jsou
         SKUTEČNÉ výšky — `pozedniceNahore` je u věšadla jen pomocná
         přímka sedel (viz poznámka u `hPozednice`). */
      tramNahore: vesadloGeo ? nadNulou(vesadloGeo.tram.hM) : null,
      vazniceOkapNahore: vesadloGeo ? nadNulou(vesadloGeo.vazniceOkap.yNahoreM) : null,
      vesakDole: vesadloGeo ? nadNulou(vesadloGeo.vesak.yDoleM) : null
    },
    /* délka krokve po spádu — obrys roviny už přesah okapu obsahuje.
       Přesah za hřeben se bere ten skutečný, ne zadaný. */
    delkaSpadu: r2(maxSpad + presahZaHreben(levá.rovina)),
    vrcholovaVaznice: maKod("vaznice_vrchol")
      /* Na milimetry — čte se z toho i poloha kleštin. */
      ? { vyskaHorniPlochy: r3(vyskaVrcholoveVaznice(poloRozpon)) } : null,
    /* Střecha s nižším křídlem: vrcholová vaznice po úsecích hřebene, každá
       skupina ve své výšce (půdorys a 3D podle toho kreslí). */
    vrcholoveUseky: (skupinyVrcholu && maKod("vaznice_vrchol")) ? skupinyVrcholu.map(function(x){
      return { klic:x.klic, kridlo:x.kridlo, delka:x.delka, useky:x.useky,
               vyskaHorniPlochy: x.yVrch,
               hornPlocha: nadNulou(x.yVrch),
               ulozeni: nadNulou(x.yVrch - (P.vaznice.h||200)/1000) };
    }) : null,
    /* pultová: mezilehlá vaznice a horní pozednice */
    /* Výška i poloha jdou z výpočtu — výkres si je nedopočítává sám. */
    pultVaznice: maKod("vaznice_pult")
      ? { vyska: hPult, x: xPult, rozponZdi: rozponZdiPult, sloupky: maKod("sloupky_pult") } : null,
    /* Nesouměrná střecha: obě strany se svým sklonem, během a výškou. */
    /* `cislo` (3. 10. 2026, editor řezu): která střešní rovina je levá
       a pravá strana řezu — editor podle něj zapíše přesah té roviny. */
    strany: { leva:{ sklonDeg:levá.sklonDeg, beh:r2(levá.beh), spad:r2(levá.spad),
                     vyska:r2(levá.vyska), behZdi:r2(behZdiL), presah:r2(levá.presah),
                     cislo:(levá.rovina ? levá.rovina.cislo : null) },
              prava:{ sklonDeg:pravá.sklonDeg, beh:r2(pravá.beh), spad:r2(pravá.spad),
                      vyska:r2(pravá.vyska), behZdi:r2(behZdiP), presah:r2(pravá.presah),
                      cislo:(jenJednaRovina ? null : (pravá.rovina ? pravá.rovina.cislo : null)) },
              nesoumerná: nesoumerná,
              ruznePresahy: Math.abs(levá.presah - pravá.presah) > 0.005 },
    /* Rozpon MEZI ZDMI — bez přesahů. Řez má ukazovat dům, ne střechu
       i s okapy; dřív se zdi kreslily o přesah dál, než ve skutečnosti
       stojí. Hřeben je pak `behZdi` od levé zdi. */
    rozponZdiM: r2(behZdiL + behZdiP),
    stredoveVaznice: (maKod("vaznice_stred") && stredoveGeo) ? stredoveGeo : null,
    klestiny: (maKod("klestiny") && klestinyGeo) ? klestinyGeo : null,
    klestinyVrchol: (maKod("klestiny_vrchol") && klestinyVrcholGeo) ? klestinyVrcholGeo : null,
    klestinyMale: (maKod("klestiny_male") && klestinyMaleGeo) ? klestinyMaleGeo : null,
    hambalek: (maKod("hambalky") && hambalekGeo) ? hambalekGeo : null,
    sloupkyVrchol: maKod("sloupky_vrchol") || !!(ocel && ocel.sloupky.some(function(q){ return q.kod === "sloupky_vrchol"; })),
    sloupkyStred: maKod("sloupky_stred") || !!(ocel && ocel.sloupky.some(function(q){ return q.kod === "sloupky_stred"; })),
    /* Ocelové rámy pod středovými vaznicemi — geometrie pro řez, půdorys,
       statiku a nabídku (23. 9. 2026). */
    ramy: ramyGeo,
    pasky: (maKod("pasky_vrchol") || maKod("pasky_stred") || maKod("pasky_pult") || !!(ocel && ocel.pasky.length))
      ? { delka: delkaPasku, nabeh: r2(delkaPasku/Math.SQRT2),
          krizeni: krizeniVaznic((maKod("vaznice_stred") ? (prvky.filter(function(x){return x.kod==="vaznice_stred";})[0]||{ks:0}).ks : 0), stitu) }
      : null
  };

  /* --- STATIKA CELÉ SOUSTAVY (fáze S5) ---
     Posuzuje se ta strana střechy, která je horší — u nesouměrné střechy
     má delší běh, takže i delší krokev. */
  var statikaGeo = null;
  var spoctiStatiku = function(){
    var horsi = (!jenJednaRovina && pravá.behZdi > levá.behZdi) ? pravá : levá;
    if(!(horsi.behZdi > 0.3)) return;
    /* Kde tu stranu podepírají středové vaznice — vodorovně od pozednice. */
    var xV = [];
    if(stredoveGeo && stredoveGeo.rovin){
      stredoveGeo.rovin.forEach(function(sv){
        if(sv.cislo === horsi.rovina.cislo && sv.x > 0) xV.push(sv.x);
      });
      /* Nesouměrná střecha může mít vaznici jen na druhé rovině — pak se
         vezme aspoň ta, jinak by krokev vyšla bez podpory. */
      if(!xV.length && stredoveGeo.rovin[0] && stredoveGeo.rovin[0].x > 0)
        xV.push(stredoveGeo.rovin[0].x);
    }
    /* Zatěžovací šířky vaznic — půlka pole nad a půlka pod vaznicí. */
    var poleR = function(st){
      var xs = [];
      if(stredoveGeo && stredoveGeo.rovin) stredoveGeo.rovin.forEach(function(sv){
        if(sv.cislo === st.rovina.cislo && sv.x > 0) xs.push(sv.x);
      });
      return { R:st.behZdi, posledni: xs.length ? Math.max.apply(null,xs) : 0 };
    };
    var strany = jenJednaRovina ? [levá] : [levá, pravá];
    var vazniceIn = [];
    /* hloubka dlabu čepu podpory ve vaznici (11. 10. 2026, smyk vaznice):
       okapová vaznice věšadla leží na trámech a rám je ocel — bez dlabu;
       vrcholová u věšadla nese čep věšáku, jinak čep dřevěného sloupku */
    var dlabVaznice = function(pv){
      try{
        if(pv.kod === "vaznice_okap" || pv.podpora === "ramy") return 0;
        var c = (pv.vesadlo && pv.kod === "vaznice_vrchol")
          ? global.PentiSpoje.cepVesaku((P.sloupekVes && P.sloupekVes.h) || 180, (P.vaznice && P.vaznice.b) || 160)
          : cepSpoje((P.sloupek && P.sloupek.b) || 140, "sloupek");
        return (c && c.dlabHloubkaMm) || 0;
      }catch(e){ return 0; }
    };
    podporyVaznic.forEach(function(pv){
      /* ocelové vaznice se posuzují modulem penti-ocel (viz `ocel.posudky`) */
      if((ocelVrchol && pv.kod === "vaznice_vrchol") || (ocelStred && pv.kod === "vaznice_stred")) return;
      var sirka = 0;
      if(pv.kod === "vaznice_vrchol"){
        /* Hřeben bere zbytek pole z každé střechy, která na něj dosedá. */
        strany.forEach(function(st){ var q=poleR(st); sirka += (q.R - q.posledni)/2; });
      } else if(pv.kod === "vaznice_okap"){
        /* Okapová vaznice věšadla: dolní reakce krokve jako prostého
           nosníku s převislým koncem — půl pole + přesah + a²/(2L). */
        var Lk = levá.behZdi, ak = levá.presah;
        sirka = Lk/2 + ak + (Lk > 0.05 ? ak*ak/(2*Lk) : 0);
      } else {
        var st = null;
        strany.forEach(function(x){ if(x.rovina.cislo === pv.rovina) st = x; });
        if(!st) st = levá;
        sirka = st.behZdi/2;
      }
      /* ROZHODUJE NEJDELŠÍ VOLNÉ POLE, ne jmenovitá rozteč sloupků.
         Bez nakreslených stěn jsou všechna pole stejná, takže to vyjde
         nastejno. Jakmile ale kus vaznice nese zeď, volná pole se změní —
         a posudek by jinak dál počítal s původním rozpětím a hlásil
         nevyhovění, které už neplatí (doplněno 15. 8. 2026 při napojení
         stěn na krov). */
      var nejdelsiPole = (pv.pole && pv.pole.length)
        ? Math.max.apply(null, pv.pole) : pv.roztecSkutecna;
      if(sirka > 0.05) vazniceIn.push({
        nazev: pv.nazev, profil: pv.profil, sirkaM: sirka,
        /* Ke kterému POLI PROFILU tahle vaznice patří. Bez toho by se
           posudek nedal přiřadit k políčku v tabulce profilů a odznak
           „vyhoví / nevyhoví" by se musel hádat z názvu (22. 8. 2026). */
        profilKod: (pv.kod === "vaznice_vrchol") ? "vaznice"
                 : (pv.kod === "vaznice_okap") ? "pozednice" : "stredVaznice",
        rozpetiM: nejdelsiPole,
        soucinitelM: pv.statika && pv.statika.soucinitelM,
        soucinitelW: pv.statika && pv.statika.soucinitelW,
        /* reakce na vazbu na jednotkové zatížení (jen věšadlo) */
        /* Prosté nosníky (1. 10. 2026): reakce = ½ levého + ½ pravého pole,
           platí pro sloupky, rámy i vazby. */
        reakceUnit: (pv.statika && (pv.statika.model === "prosty" || pv.statika.model === "styky")) ? pv.statika.reakceUnit
          : ((pv.vesadlo || pv.podpora === "ramy") && pv.statika && pv.statika.nosnik) ? 2*pv.statika.nosnik.Vmax : 0,
        /* SMYK VAZNICE (11. 10. 2026, PLAN_kcr_smyk.md): V = c_V·w·L — největší
           posouvající síla z téhož spojitého nosníku (stejně jako u ocelové
           vaznice); prostý nosník 0,5. Nad dřevěným sloupkem / věšákem je ve
           vaznici dlab čepu — oslabí průřez u podpory. */
        soucinitelV: (pv.statika && pv.statika.model === "prosty") ? 0.5
          : ((pv.statika && pv.statika.nosnik && pv.statika.nosnik.Vmax && nejdelsiPole > 0) ? pv.statika.nosnik.Vmax/nejdelsiPole : 0.625),
        dlabMm: dlabVaznice(pv),
        kod: pv.kod });
    });
    /* Nejdelší sloupek — ten je na vzpěr rozhodující. */
    var hSl = 0;
    prvky.forEach(function(x){
      /* Vzpěrná délka = SVĚTLÁ výška sloupku. Čep ve vaznici (od 30. 9.
         2026 v objednací délce) se na vzpěr nepočítá — ten úsek drží
         vaznice. */
      var hx = (x.svetlaDelkaMax != null) ? x.svetlaDelkaMax : x.delkaMax;
      if(/^sloupky/.test(x.kod) && hx > hSl) hSl = hx;
    });
    var vstupStatiky = {
      sklonDeg: horsi.sklonDeg, rozponPulM: horsi.behZdi, xVaznic: xV,
      roztecKrokvi: roztecProPosudek, profilKrokve: P.krokev,
      /* Pro posudek spoje krokve s pozednicí (21. 9. 2026). */
      presahOkapM: (horsi.presah != null) ? horsi.presah : presahOkap,
      profilPozednice: P.pozednice, vesadlo: vesadloGeo,
      /* ocelové rámy pod středovými vaznicemi (23. 9. 2026) */
      ramy: ramyGeo,
      profilTramu: P.tram, profilVesaku: P.sloupekVes, profilVzpery: P.vzpera,
      vaznice: vazniceIn, profilSloupku: P.sloupek, vyskaSloupkuM: hSl,
      snehOblast: n(v.snehOblast) || 2,
      vitrOblast: n(v.vitrOblast) || 2,
      teren: v.teren || "III",
      /* Pro rozpěr vazby a posudek kleštin. */
      vyskaHrebeneM: vyskaStrechy,
      maVrcholovouVaznici: !!((S.vrchol || S.vesadlo) && r2(g.ridge||0) > 0.05),
      /* Táhlem je kleština i hambálek — obojí spojuje protilehlé krokve
         a přenáší rozpěr. Hambálek se do 18. 8. 2026 nepočítal a rozpěr
         u hambálkového krovu tak vycházel celý do věnce, přestože ho
         hambálek zachytí. */
      maKlestiny: !!(klestinyGeo || hambalekGeo),
      hambalekKusu: hambalekGeo ? (hambalekGeo.kusu || 1) : 0,
      klestinyJednostranne: klestinyGeo ? (klestinyGeo.jednostranne || 0) : 0,   // ručně smazaná jedna strana (2026.11.240)
      vyskaKlestinyM: klestinyGeo ? klestinyGeo.vyska
                    : (hambalekGeo ? hambalekGeo.vyska : 0),
      profilKlestiny: klestinyGeo ? P.klestina : P.hambalek,
      klestinaKod: klestinyGeo ? "klestina" : "hambalek",
      /* Pásky — posuzují se jen když jsou zapnuté a mají náběh. */
      nabehPaskuM: (v.pasky !== false) ? (n(v.pasekDelka) || 0) : 0,
      profilPasku: P.pasek || P.sloupek,
      hmotnostKrytinyKgM2: (v.hmotnostKrytinyKgM2 != null)
        ? n(v.hmotnostKrytinyKgM2) : 45,
      podhledKNm2: n(v.podhledKNm2) || 0,
      /* ruční vodorovná tuhost paty pro model hambálku (kN/mm), prázdné = jen rozsah */
      kwKNmm: (v.kwKNmm != null && v.kwKNmm !== "" && n(v.kwKNmm) >= 0) ? n(v.kwKNmm) : null,
      /* věnec jako nosník: délka mezi štíty a polohy krokví podél něj (22. 9. 2026) */
      venec: (function(){
        if(!v.venec) return null;
        var kr = krokveRovin[horsi.rovina.cislo] || krokveRovin[Object.keys(krokveRovin)[0]];
        if(!kr || !kr.osy) return Object.assign({}, v.venec, { krokveX: [], delkaM: v.venec.delkaM || 0 });
        var pStit = n(v.presahStitu) || 0, tl = (n(v.venec.tloustkaZdiMm) || 450)/1000;
        /* celá šířka roviny (u zděných štítů je pole krokví užší než rovina) */
        var delkaAuto = r3(((kr.sirkaRoviny != null) ? kr.sirkaRoviny : kr.sirka) - 2*pStit - 2*tl);
        var delka = (v.venec.delkaM > 0) ? v.venec.delkaM : delkaAuto;
        var od = pStit + tl;
        var xs = kr.osy.map(function(x){ return r3(x - od); }).filter(function(x){ return x > 0.02 && x < delka - 0.02; });
        return Object.assign({}, v.venec, { krokveX: xs, delkaM: delka, delkaAutoM: delkaAuto, odM: r3(od) });
      })(),
      trida: v.tridaDreva || "C24"
    };
    statikaGeo = statikaKrovu(vstupStatiky);
    /* B4 (13. 10. 2026): POSUDKY Z RÁMU VAZBY. První průchod (postaru) dá
       zatížení a reakce vaznic; z nich se sestaví rám vazby a posudky se
       spočítají znovu na jeho síly. Bez modulu PentiVazbaRam (např. web)
       nebo s volbou „postaru" zůstává první průchod. */
    var VRm = global.PentiVazbaRam;
    if(statikaGeo && v.statikaModel !== "postaru" && VRm && VRm.silyProPosudky && rez && !rez.mansarda){
      try{
        var reakV = {};
        (statikaGeo.vaznice||[]).forEach(function(x){ reakV[x.kod] = Math.max(reakV[x.kod]||0, x.reakceKN||0); });
        var silyR = VRm.silyProPosudky({ rez:rez, zatizeni:statikaGeo.zatizeni, roztec:roztecProPosudek || 0.9,
          reakceVaznic:reakV, qUls:statikaGeo.zatizeni.qUls, wTramKNm:statikaGeo.vesadlo ? statikaGeo.vesadlo.wTramKNm : null,
          roztecSloupkuM:n(v.roztecSloupku) || null });
        if(silyR) statikaGeo = statikaKrovu(Object.assign({}, vstupStatiky, { ram:silyR }));
      }catch(eR){ upozorneni.push("Statika z rámu vazby se nepodařila (" + (eR && eR.message) + ") — posudky postaru."); }
    }
  };
  spoctiStatiku();
  /* Ocelové vaznice, sloupky, paty a hlavy — posudky z penti-ocel.js se
     přidají k ostatním, aby je viděl souhrn i protokol (2. 10. 2026). */
  var pridejOcelDoStatiky = function(){
    if(!statikaGeo || !ocel || !ocel.posudky.length) return;
    statikaGeo.radky = (statikaGeo.radky || []).filter(function(r){ return !/^ocel_/.test(r.prvek||""); }).concat(ocel.posudky);
    var St2 = global.PentiStatika;
    if(St2 && St2.souhrn) statikaGeo.souhrn = St2.souhrn(statikaGeo.radky);
  };
  pridejOcelDoStatiky();
  /* Věšadlo: když statika chce hlubší zapuštění, přepočítat vazbu i statiku
     ještě jednou (jednou stačí — hloubka mění síly jen nepatrně). */
  if(statikaGeo && statikaGeo.vesadlo && statikaGeo.vesadlo.prepocitat && vesadloPrepocet){
    if(vesadloPrepocet(statikaGeo.vesadlo.tvPotrebaMm, statikaGeo.vesadlo.thPotrebaMm)){ spoctiStatiku(); pridejOcelDoStatiky(); }
  }
  /* ══ STATIKA VIKÝŘŮ (krok 3b, 2026.11.208 — PENTI 8. 11. 2026) ═══════
     Posudek výměn a zesílených krokví u otvorů vikýřů a návrh jejich
     profilu. Zatížení z téže kombinace jako krokve (q na m² vodorovného
     průmětu), stěny vikýře 0,6 kN/m² (PENTI 8. 11. 2026), γ_G = 1,35.
       · HORNÍ VÝMĚNA: konce horních kusů přerušených krokví + polovina
         střechy vikýře (krokvičky)
       · SPODNÍ VÝMĚNA: konce dolních kusů + čelní stěna + druhá polovina
         střechy vikýře (přes překlad)
       · ZESÍLENÁ KROKEV: plný pruh jako běžná krokev + reakce výměn + bok
         vikýře (průměrná výška = polovina čela) — každé pole mezi
         podporami jako prostý nosník (na bezpečné straně)
     Profil: nejmenší výška z řady, která vyhoví, ale NIKDY menší než
     „o stupeň vyšší než krokev" (PENTI 8. 11. 2026). */
  var statikaVikyru = function(){
    var St = global.PentiStatika;
    if(!St || !St.posudekNosnikuVikyre || !statikaGeo || !statikaGeo.zatizeni) return null;
    var maVik = roviny.some(function(p){ var pk=krokveRovin[p.cislo]; return pk && pk.vikyre && pk.vikyre.length; });
    if(!maVik) return null;
    var ZZ = statikaGeo.zatizeni, qU = ZZ.qUlsPresne, qS = ZZ.qSlsPresne;
    var kmodV = (ZZ.kmod != null) ? ZZ.kmod : 0.8, tridaV = v.tridaDreva || "C24";
    var gW = VIKYR_STENA_KN_M2, rK = roztecProPosudek || 0.9;
    var ulohy = [];          // [{typ:"zes"|"vym", nazev, L, cos, uls, sls}]
    roviny.forEach(function(p){
      var pk = krokveRovin[p.cislo]; if(!pk || !pk.vikyre || !pk.vikyre.length) return;
      var cs = Math.cos((p.sklon||0)*Math.PI/180) || 1;
      var rings = p.tvarRings || (p.tvar ? [p.tvar] : []);
      var xV = []; if(stredoveGeo && stredoveGeo.rovin) stredoveGeo.rovin.forEach(function(sv){ if(sv.cislo===p.cislo && sv.x>0) xV.push(sv.x); });
      pk.vikyre.forEach(function(d){
        var o = d.otvor || {}, pres = +o.presahH || 0;
        var xz = function(vv){ return vv*cs - pres; };                 // vodorovně od pozednice
        var podpory = function(u){
          var h = hranyVU(rings, Math.min(Math.max(u, pk.min+0.02), pk.max-0.02));
          var xh = xz(h.vrch), body = [0].concat(xV.filter(function(x){ return x>0.2 && x<xh-0.2; })).concat([xh]);
          return body.sort(function(a,b){ return a-b; });
        };
        var nad = function(B, x){ for(var i=0;i<B.length;i++) if(B[i]>x+1e-6) return B[i]; return B[B.length-1]; };
        var pod = function(B, x){ for(var i=B.length-1;i>=0;i--) if(B[i]<x-1e-6) return B[i]; return 0; };
        var oznac = "Vikýř " + (o.klic ? "V" + (parseInt(o.klic,10)+1) : "") + " (rovina " + p.cislo + ")";
        var hl = +o.hloubkaH || 0, hc = +o.vyskaCela || 0;
        var vymH = null, vymD = null;
        d.vymeny.forEach(function(m){
          var L = m.delka, bU = [], bS = [];
          d.rezane.forEach(function(rz){
            var B = podpory(rz.u), x;
            if(m.druh === "horni"){ x = xz(d.v1); var Lh = Math.max(0, nad(B, x) - x); }
            else { x = xz(d.v0); var Lh = Math.max(0, x - pod(B, x)); }
            bU.push({ x: rz.u - m.uL, F: qU*rK*Lh/2 }); bS.push({ x: rz.u - m.uL, F: qS*rK*Lh/2 });
          });
          var sU = [{ a:0, b:L, q: qU*hl/2 }], sS = [{ a:0, b:L, q: qS*hl/2 }];
          if(m.druh === "dolni"){ sU.push({ a:0, b:L, q: 1.35*gW*hc }); sS.push({ a:0, b:L, q: gW*hc }); }
          var ul = { typ:"vym", nazev: oznac + " — výměna " + (m.druh==="horni"?"horní":"spodní"), L:L, cos:1,
                     uls:{ bodove:bU, spojite:sU }, sls:{ bodove:bS, spojite:sS },
                     popis: d.rezane.length + "× konec krokve + střecha vikýře" + (m.druh==="dolni" ? " + čelo" : "") };
          ulohy.push(ul);
          var RU = St.prostyNosnikObecny(Object.assign({ L:L, EI:1 }, ul.uls)), RS = St.prostyNosnikObecny(Object.assign({ L:L, EI:1 }, ul.sls));
          var reak = { x: xz(m.druh==="horni" ? d.v1 : d.v0), U:[RU?RU.RA:0, RU?RU.RB:0], S:[RS?RS.RA:0, RS?RS.RB:0] };
          if(m.druh === "horni") vymH = reak; else vymD = reak;
        });
        d.zesilene.forEach(function(z, iz){
          var B = podpory(z.u), x0 = xz(d.v0), x1 = xz(d.v1);
          for(var i=1;i<B.length;i++){
            var a = B[i-1], b = B[i], L = b - a;
            if(!(L > 0.3)) continue;
            var bU = [], bS = [];
            [vymH, vymD].forEach(function(R){ if(R && R.x>a && R.x<b){ bU.push({ x:R.x-a, F:R.U[iz] }); bS.push({ x:R.x-a, F:R.S[iz] }); } });
            var sa = Math.max(a, Math.min(x0, x1)), sb = Math.min(b, Math.max(x0, x1));
            var sU = [{ a:0, b:L, q: qU*rK }], sS = [{ a:0, b:L, q: qS*rK }];
            if(sb > sa){ sU.push({ a:sa-a, b:sb-a, q: 1.35*gW*hc/2 }); sS.push({ a:sa-a, b:sb-a, q: gW*hc/2 }); }
            if(!bU.length && !(sb > sa)) continue;          // pole bez vikýře = běžná krokev
            ulohy.push({ typ:"zes", nazev: oznac + " — zesílená krokev " + (iz===0?"levá":"pravá"), L:L, cos:cs,
                         uls:{ bodove:bU, spojite:sU }, sls:{ bodove:bS, spojite:sS },
                         popis: "pruh střechy + reakce výměn + bok vikýře" });
          }
        });
      });
    });
    var maPult = roviny.some(function(p){ var pk=krokveRovin[p.cislo]; return pk && (pk.vikyre||[]).some(function(dd){ return dd.otvor && (dd.otvor.doVaznice || dd.otvor.naKrokve); }); });
    if(!ulohy.length && !maPult) return null;
    var minProfil = vikyrOStupenVys(P.krokev), bV = (P.krokev && P.krokev.b) || 100;
    var radkyPro = function(ul, prof){
      return St.posudekNosnikuVikyre({ nazev:ul.nazev, profil:prof, trida:tridaV, kmod:kmodV, L:ul.L,
        cosSklonu:ul.cos, uls:ul.uls, sls:ul.sls, popisZatizeni:ul.popis });
    };
    var navrhni = function(typ){
      var u = ulohy.filter(function(x){ return x.typ===typ; }); if(!u.length) return null;
      var vysky = VIKYR_RADA_VYSEK.filter(function(h){ return h >= minProfil.h; });
      for(var i=0;i<vysky.length;i++){
        var prof = { b:bV, h:vysky[i] };
        var ok = u.every(function(ul){ return radkyPro(ul, prof).every(function(r){ return r.vyuziti <= 1; }); });
        if(ok) return { profil:prof, vyhovi:true, ulohy:u };
      }
      return { profil:{ b:bV, h:vysky[vysky.length-1] || minProfil.h }, vyhovi:false, ulohy:u };
    };
    /* KROKVE PULTU (etapa 4c): prostý nosník od pozednice čela k vaznici
       (vodorovně hloubka vikýře), pruh = rozteč krokví; přesah před čelo
       se zanedbá (na bezpečné straně). VAZNICE: zatížení od krokví pultu
       (q·d/2 na m) proti tomu, co na ni v tom místě nesly krokve hlavní
       střechy (q·půl pole pod vaznicí) — rozdíl se ukáže jako řádek. */
    var ulohyKP = [], radkyVaz = [];
    roviny.forEach(function(p){
      var pk = krokveRovin[p.cislo]; if(!pk || !pk.vikyre) return;
      var rings = p.tvarRings || (p.tvar ? [p.tvar] : []), cs = Math.cos((p.sklon||0)*Math.PI/180) || 1;
      var xV = []; if(stredoveGeo && stredoveGeo.rovin) stredoveGeo.rovin.forEach(function(sv){ if(sv.cislo===p.cislo && sv.x>0) xV.push(sv.x); });
      pk.vikyre.forEach(function(dd){
        var o = dd.otvor || {}; if(!(o.doVaznice || o.naKrokve) || !(o.hloubkaH > 0.3)) return;
        var b = +o.sklonPultu || 0, cb = Math.cos(b*Math.PI/180) || 1;
        ulohyKP.push({ nazev:"Vikýř V"+(parseInt(o.klic,10)+1)+" (rovina "+p.cislo+") — krokev pultu", L:o.hloubkaH, sklon:b, cb:cb });
        /* uložení na hlavní krokve (6a): horní konec leží na krokvích nad
           otvorem, polovina pultu jde do horní výměny (posudek výměny výš) —
           vaznice se nepřitěžuje */
        if(o.naKrokve) return;
        /* vaznice: kterou nese (vodorovně od pozednice) a pole pod ní */
        var x0 = dd.v1*cs - (+o.presahH||0);
        var h = hranyVU(rings, Math.min(Math.max((dd.u0+dd.u1)/2, pk.min+0.02), pk.max-0.02)), xH = h.vrch*cs - (+o.presahH||0);
        var B = [0].concat(xV.filter(function(x){ return x>0.2 && x<xH-0.2; })).concat([xH]).sort(function(a,c){ return a-c; });
        var iV = 0; B.forEach(function(x, k){ if(Math.abs(x - x0) < Math.abs(B[iV] - x0)) iV = k; });
        var pod = iV > 0 ? (B[iV] - B[iV-1]) / 2 : 0;
        var qPult = qU * o.hloubkaH / 2, qHlavni = qU * pod;
        radkyVaz.push({ nazev:"Vikýř V"+(parseInt(o.klic,10)+1)+" (rovina "+p.cislo+") — vaznice pod krokvemi pultu",
          vzorec:"q_pult = q·d/2  vs.  q_hlavní = q·½ pole pod vaznicí",
          dosazeni:"krokve pultu "+r2(qPult)+" kN/m (d = "+r2(o.hloubkaH)+" m) proti "+r2(qHlavni)+" kN/m od krokví hlavní střechy, které vikýř nahradil"
            +(qPult > qHlavni + 0.01 ? " → vaznice v šířce vikýře "+r2(o.u1-o.u0)+" m přitížená o "+r2(qPult-qHlavni)+" kN/m" : " → vaznice se nepřitíží"),
          vyuziti: qHlavni > 0 ? Math.min(2, qPult / qHlavni) * 0.5 : 0.5, vyhovuje:true, prvek:"vikyr_vaznice", info:true,
          pritizeni: Math.max(0, qPult - qHlavni) });
      });
    });
    var nKP = null;
    if(ulohyKP.length){
      var vyskyK = VIKYR_RADA_VYSEK.filter(function(hh){ return hh >= ((P.krokev && P.krokev.h) || 180); });
      var radkyKP = function(prof){ return [].concat.apply([], ulohyKP.map(function(u){
        return St.posudekKrokve({ profil:prof, delkaM:u.L/u.cb, vodorovnyPrumet:u.L, wh:qU*rK, whSls:qS*rK, sklonDeg:u.sklon, trida:tridaV, kmod:kmodV })
          .map(function(r){ r.nazev = u.nazev + " — " + r.nazev.replace(/^Krokev — /, ""); r.prvek = "vikyr_krokve_pultu"; return r; }); })); };
      for(var iK=0;iK<vyskyK.length && !nKP;iK++){
        var prK = { b:(P.krokev && P.krokev.b) || 100, h:vyskyK[iK] };
        if(radkyKP(prK).every(function(r){ return r.vyuziti <= 1; })) nKP = { profil:prK, vyhovi:true };
      }
      if(!nKP){ nKP = { profil:{ b:(P.krokev && P.krokev.b) || 100, h:vyskyK[vyskyK.length-1] }, vyhovi:false };
        upozorneni.push("Krokev pultu vikýře nevyhoví ani s profilem "+nKP.profil.b+"/"+nKP.profil.h+" — podepřete ji nebo navrhněte BSH."); }
      nKP.radky = radkyKP(nKP.profil);
    }
    radkyVaz.forEach(function(r){ if(r.pritizeni > 0.01) upozorneni.push(r.nazev + ": přitížená o " + r2(r.pritizeni) + " kN/m — zkontrolujte vaznici v místě vikýře (sloupek pod vaznici u vikýře)."); });
    var nZ = navrhni("zes"), nV = navrhni("vym"), radky = [];
    if(nKP) radky = radky.concat(nKP.radky);
    /* vaznice: informace do popisu statiky (statikaGeo.vikyre.vaznice) a
       upozornění — ne jako řádek posudku (není to posudek, jen srovnání) */
    [[nZ, "vikyr_krokev_zesilena"], [nV, "vikyr_vymena"]].forEach(function(x){
      var N = x[0]; if(!N) return;
      N.ulohy.forEach(function(ul){
        radkyPro(ul, N.profil).forEach(function(r){
          r.prvek = (x[1] === "vikyr_vymena") ? (/horní/.test(ul.nazev) ? "vikyr_vymena_horni" : "vikyr_vymena_dolni") : x[1];
          radky.push(r);
        });
      });
      if(!N.vyhovi) upozorneni.push((x[1]==="vikyr_vymena" ? "Výměna u vikýře" : "Zesílená krokev u vikýře")
        + " nevyhoví ani s profilem " + N.profil.b + "/" + N.profil.h + " — zdvojte krokev / výměnu nebo navrhněte BSH.");
    });
    /* profily do výkazu */
    prvky.forEach(function(pr, i){
      var N = (pr.kod === "vikyr_krokev_zesilena") ? nZ : (/^vikyr_vymena_/.test(pr.kod) ? nV : (pr.kod === "vikyr_krokve_pultu" ? nKP : null));
      if(!N || (pr.b === N.profil.b && pr.h === N.profil.h)) return;
      prvky[i] = prvek(pr.kod, pr.nazev, N.profil, pr.kusy, pr.zdroj, pr.poznamka
        + "; profil podle statiky (krok 3b)");
    });
    statikaGeo.radky = (statikaGeo.radky || []).filter(function(r){ return !/^vikyr_/.test(r.prvek||""); }).concat(radky);
    if(St.souhrn) statikaGeo.souhrn = St.souhrn(statikaGeo.radky);
    var vysl = { krokvePultu: nKP ? { profil:nKP.profil, vyhovi:nKP.vyhovi } : null,
                 vaznice: radkyVaz.map(function(r){ return { nazev:r.nazev, text:r.dosazeni, pritizeni:r2(r.pritizeni) }; }),
                 zesilena: nZ ? { profil:nZ.profil, vyhovi:nZ.vyhovi } : null,
                 vymena:   nV ? { profil:nV.profil, vyhovi:nV.vyhovi } : null,
                 stenaKNm2: gW, radku: radky.length };
    statikaGeo.vikyre = vysl;
    return vysl;
  };
  statikaVikyru();
  if(statikaGeo && statikaGeo.vesadlo){
    var vsSt = statikaGeo.vesadlo;
    if(vsSt.spojVaznice && vsSt.spojVaznice.nevyhovi && vsSt.spojVaznice.svornik && vsSt.spojVaznice.svornik.vyhovuje)
      upozorneni.push("Okapová vaznice na trámu: vruty proti sání nestačí (N_Ed " + vsSt.spojVaznice.NEdKN
        + " kN) — v každém křížení " + vsSt.spojVaznice.svornik.pocet + "× svorník M12 skrz vaznici a trám (je ve spojováku).");
    else if(vsSt.spojVaznice && vsSt.spojVaznice.nevyhovi)
      upozorneni.push("Okapová vaznice na trámu: proti sání nestačí vruty ani dva svorníky M12 (N_Ed " + vsSt.spojVaznice.NEdKN
        + " kN) — spoj musí navrhnout statik.");
  }
  /* Spoj kleštiny, na který nestačí ani čtyři dvojice M16 — nutné říct. */
  if(statikaGeo && statikaGeo.spojKlestiny && statikaGeo.spojKlestiny.nevyhovi)
    upozorneni.push(statikaGeo.spojKlestiny.popis);
  /* Spoj krokve s pozednicí, který neudrží ani dva vruty — taky. */
  if(statikaGeo && statikaGeo.spojKrokve && statikaGeo.spojKrokve.nevyhovi)
    upozorneni.push(statikaGeo.spojKrokve.popis);
  if(statikaGeo && statikaGeo.souhrn && !statikaGeo.souhrn.vyhovuje){
    upozorneni.push("Statika krovu nevyhoví — rozhoduje "
      + statikaGeo.souhrn.rozhoduje.toLowerCase() + " s využitím "
      + Math.round(statikaGeo.souhrn.maxVyuziti*100) + " %. "
      + "Je to orientační posudek pro nabídku, ne náhrada statika.");
  }

  /* ══════════════════════════════════════════════════════════════════════
     ROZTEČ KOTEV PODLE POSUDKU
     ----------------------------------------------------------------------
     Pozednice se počítá dřív než statika, takže se nejdřív rozkotví podle
     montážního pravidla a teprve tady se to opraví podle nadzvednutí.
     Stejný postup jako u dělení vaznic o kus níž.

     Ručně zadaná rozteč má přednost — kdo ji vyplnil, ví proč.
     ══════════════════════════════════════════════════════════════════════ */
  var kotveniPoz = statikaGeo && statikaGeo.kotveni;
  if(kotveniPoz && !(n(v.roztecKotevPozednice) > 0)
     && pozedniceBehy.length && global.PentiVyrobni
     && Math.abs(kotveniPoz.roztecM - roztecKotev) > 0.02){
    var puvodniKotev = roztecKotev;
    roztecKotev = kotveniPoz.roztecM;
    /* Přepočítat kusy a kotvy se skutečnou roztečí. */
    var novy = dilyPozednic(pozedniceBehy, P.pozednice,
                            n(v.maxKusPozedniceM) || 4, roztecKotev);
    if(novy){
      pozedniceDily = novy;
      pozBm = novy.rezivoBm;
      /* Ve výkazu je pozednice jedna položka — přepsat i ji. */
      prvky.forEach(function(p){
        if(p.kod === "pozednice" && novy.rezivoBm > 0) {
          p.kusy = novy.kusy ? novy.kusy.map(r2) : p.kusy;
          p.bm = r2(novy.rezivoBm);
          p.m3 = r3((P.pozednice.b/1000)*(P.pozednice.h/1000)*novy.rezivoBm);
        }
      });
    }
    if(statikaGeo.zatizeni && statikaGeo.zatizeni.vitr
       && statikaGeo.zatizeni.vitr.zjednodusene)
      upozorneni.push("Sání větru se počítá zjednodušeně: nejnepříznivější "
        + "zóna (roh u okapu, c_pe = " + statikaGeo.zatizeni.vitr.cpe
        + ") se použije na celou střechu. Je to na bezpečné straně — "
        + "uprostřed střechy je sání menší, takže kotev vychází víc, než "
        + "je nutné. Zpřesní se, až budou k dispozici součinitele po zónách.");
    upozorneni.push("Kotvy pozednice: z posudku na nadzvednutí vychází rozteč "
      + r2(roztecKotev) + " m místo montážních " + r2(puvodniKotev) + " m"
      + (kotveniPoz.nadzvedava
          ? " — vítr střechu nadzvedává silou " + r2(kotveniPoz.tahKNm)
            + " kN na běžný metr pozednice."
          : " — střecha se sama udrží tíhou, platí montážní maximum.")
      + " Rozhoduje " + kotveniPoz.rozhoduje + ".");
    (kotveniPoz.chyby||[]).forEach(function(c){ upozorneni.push(c); });
  } else if(kotveniPoz){
    (kotveniPoz.chyby||[]).forEach(function(c){ upozorneni.push(c); });
  }

  /* ══════════════════════════════════════════════════════════════════════
     DĚLENÍ VAZNIC V NULOVÉM MOMENTU
     ----------------------------------------------------------------------
     Vaznice se přes několik polí chová jako spojitý nosník. Když se s ní
     nedá manipulovat v jednom kuse, musí se rozdělit — a nejlepší místo
     pro spoj je NULOVÝ MOMENT: tam vaznice není namáhaná ohybem a stačí
     jednoduché přeplátování. Nad podporou nebo uprostřed pole by spoj
     musel být tuhý a drahý.

     Ten výpočet už v aplikaci je (spojitý nosník + hledání nulového
     momentu), jen se dosud nikde neprojevil. Tady se zapne na přání
     (zadání PENTI 16. 8. 2026) a promítne do výkazu: každý spoj přidá
     do OBJEDNACÍ DÉLKY jeden plát, protože se kusy musí přeložit.

     Vypnuto (výchozí) = vaznice se bere v jednom kuse, cena beze změny.
     ══════════════════════════════════════════════════════════════════════ */
  /* ══════════════════════════════════════════════════════════════════════
     NÁROŽÍ A ÚŽLABÍ — SEDLA, GRADOVÁNÍ, NÁMĚTKY (PENTI 1. 10. 2026)
     Každý úsek nároží/úžlabí se spočítá v penti-narozi.js: úhly, sklon,
     gradování (nároží) / vyžlabení (úžlabí), posun při různém sklonu,
     srdcová sedla na pozednici a středové vaznici. Krokve, které končí
     na nárožníku (námětky) nebo úžlabníku (lípance), dostanou délku
     k boku prvku a šikmý řez. Bez modulu zůstane všechno jako dřív.
     ══════════════════════════════════════════════════════════════════════ */
  var narozniGeo = null;
  var NZ = global.PentiNarozi;
  if(NZ && naroznikGeo && roviny.length >= 2){
    var profN = naroznikGeo.profil;
    var rovinaZ = function(p){                      // rovina horních hran krokví
      var tg = Math.tan((p.sklon||0)*Math.PI/180), cs = Math.cos((p.sklon||0)*Math.PI/180);
      return NZ.rovina(p.baze.a, p.baze.dir, p.baze.nrm, p.sklon,
                       nadsedlovi/cs - (presahRoviny(p) + odLice)*tg);
    };
    /* Běh středové vaznice v rovině u daného úseku nároží. Rovina rozdělená
       na hlavní část a křídlo má běhy dva — vezme se ten, v jehož rozsahu
       (podél okapu) úsek leží. */
    var svRoviny = function(p, sg){
      var behy = (stredoveGeo && stredoveGeo.rovin || []).filter(function(x){ return x.cislo === p.cislo; });
      if(behy.length > 1 && sg){
        var M = [(sg.A[0]+sg.B[0])/2, (sg.A[1]+sg.B[1])/2];
        var uM = (M[0]-p.baze.a[0])*p.baze.dir[0] + (M[1]-p.baze.a[1])*p.baze.dir[1];
        var us = usekVU(p, uM);
        var shoda = behy.filter(function(x){ return !!x.kridlo === !!us.kridlo; })[0];
        if(shoda) return shoda;
      }
      return behy[0] || null;
    };
    var bSV = ((P.stredVaznice && P.stredVaznice.b) || 160)/1000;
    var prvkyN = [];
    (g.segs||[]).forEach(function(sg, iSeg){
      if(sg.type!=="narozi" && sg.type!=="uzlabi") return;
      var dvojice = rovinyUseku(roviny, sg);
      if(!dvojice) return;
      var R0 = rovinaZ(dvojice[0]), R1 = rovinaZ(dvojice[1]);
      /* dolní konec A = nižší */
      var A = sg.A, B = sg.B;
      if(NZ.zRoviny(R0, A) > NZ.zRoviny(R0, B)){ A = sg.B; B = sg.A; }
      var podp = [{ nazev:"pozednice", kod:"pozednice", hrany: dvojice.map(function(p){
        var s = presahRoviny(p) + odLice;
        return { bod:[p.baze.a[0]+p.baze.nrm[0]*s, p.baze.a[1]+p.baze.nrm[1]*s], smer:p.baze.dir, z:0 };
      }) }];
      var sv0 = svRoviny(dvojice[0], sg), sv1 = svRoviny(dvojice[1], sg);
      /* Úžlabí mezi hlavní částí a nižším křídlem: vaznice obou rovin leží
         v jiné výšce a netvoří roh — sedlo středové vaznice se tu nedělá. */
      if(sv0 && sv1 && Math.abs(sv0.vyska - sv1.vyska) > 0.05) sv0 = sv1 = null;
      if(sv0 && sv1) podp.push({ nazev:"středová vaznice", kod:"vaznice_stred", hrany: [[dvojice[0], sv0], [dvojice[1], sv1]].map(function(x){
        var p = x[0], s = presahRoviny(p) + x[1].x - bSV/2;
        return { bod:[p.baze.a[0]+p.baze.nrm[0]*s, p.baze.a[1]+p.baze.nrm[1]*s], smer:p.baze.dir, z:x[1].vyska };
      }) });
      /* okapní pata přebírá tvar zhlaví krokví (PENTI 3. 10. 2026) */
      var pataN = { typ: v.patkaTyp || "svisly_zkraceny", vyskaCelaM: (n(v.vyskaCelaMm) || 120)/1000 };
      var vys = NZ.prvek({ typ: sg.type, roviny:[R0, R1], A:A, B:B, profil:profN, posun:true, podpory:podp, pata:pataN });
      /* sedla jen tam, kde roh podpor opravdu leží na prvku */
      vys.sedla = vys.sedla.filter(function(s){ return s.ursenkelM > -0.05 && s.ursenkelM < vys.delkaPudorysM + 0.05 && Math.abs(s.bocneM) < 0.5; });
      vys.chyby = [].concat.apply([], vys.sedla.map(function(s){ return s.chyby; })).concat((vys.pata && vys.pata.chyby) || []);
      vys.iSeg = iSeg;
      vys.cislo = prvkyN.length + 1;
      vys.rovinyCisla = [dvojice[0].cislo, dvojice[1].cislo];
      vys._roviny = [R0, R1]; vys._planes = dvojice;
      vys.A = A; vys.B = B;
      prvkyN.push(vys);
    });

    /* ── OKAPNÍ PATA: úžlabník je delší (boky jdou až k čelu okapu) ──── */
    var prodlouzeno = false;
    prvkyN.forEach(function(P2){
      var pr = P2.pata && P2.pata.prodlouzeniM;
      if(!(pr > 0.0005)) return;
      var kus = narozniky.filter(function(x){ return x.iSeg === P2.iSeg; })[0];
      if(!kus) return;
      kus.prodlouzeniPatyM = r3(pr);
      kus.delka = r2(kus.delka + pr);
      prodlouzeno = true;
    });
    if(prodlouzeno){
      naroznikGeo.nejdelsiM = narozniky.reduce(function(a2,x){ return Math.max(a2, x.delka); }, 0);
      for(var iN=0;iN<prvky.length;iN++) if(prvky[iN].kod==="naroznik"){
        prvky[iN] = prvek("naroznik","Nárožní a úžlabní krokve", naroznikGeo.profil,
          narozniky.map(function(x){ return x.delka; }), "model",
          naroznikGeo.poznamka + "; úžlabník delší o okapní patu (boky až k čelu okapu)");
      }
    }

    /* ── NÁMĚTKY A LÍPANCE: přepočet délek krokví ─────────────────────── */
    var namety = [];
    var naUseku = function(P2, typ){
      for(var i=0;i<prvkyN.length;i++){
        if(prvkyN[i].typ !== typ) continue;
        if(vzdalenostKUsecce(P2, prvkyN[i].A, prvkyN[i].B) < 0.12) return prvkyN[i];
      }
      return null;
    };
    if(prvkyN.length){
      vsechnyKrokve = [];
      argsKrokviRovin.forEach(function(a){
        var p = a[0];
        var pkR = krokveRovin[p.cislo] || {};
        var oprava = function(u, h){
          /* Páry krokví pod hřebenem (vč. prvního páru, který se bokem dotýká
             styku nároží) nejsou námětky — končí v hřebeni celé. */
          /* (Dole u úžlabí se lípanec řeže dál — páru se týká jen horní konec.) */
          var vParu = !!(pkR.hreben && u >= pkR.hreben.od - 0.005 && u <= pkR.hreben.do + 0.005);
          /* Mitlák u volby „nárožníky lípnuté k mitláku" jde celý až k prvnímu
             páru; u „k sobě" se lípne mezi nárožníky (námětek k boku). */
          var mitlakCely = (pkR.mitlak != null && Math.abs(u - pkR.mitlak) < 0.03 && lipnuti === "k_mitlaku");
          var sec = p.baze.sec || 1;
          var Pvrch = bodRoviny(p, u, h.vrch), Pspod = bodRoviny(p, u, h.spodek);
          var naroz = (vParu || mitlakCely) ? null : naUseku(Pvrch, "narozi");
          var uzl = (h.spodek > 0.02) ? naUseku(Pspod, "uzlabi") : null;
          if(!naroz && !uzl) return null;
          var cast = function(prv, bod){
            var i = (prv._planes[0] === p) ? 0 : (prv._planes[1] === p ? 1 : -1);
            if(i < 0) return null;
            return NZ.namet({ prvek:prv, rovina:i, bod:bod, profil:P.krokev });
          };
          var v = h.vrch - h.spodek, L = null, nm = null, lp = null;
          if(naroz) nm = cast(naroz, Pspod);
          if(uzl) lp = cast(uzl, Pvrch);
          if(nm && lp) L = nm.delkaMaxM + lp.delkaMaxM - v;
          else if(nm) L = nm.delkaMaxM;
          else if(lp) L = lp.delkaMaxM + a[2];          // u hřebene zůstává přídavek
          if(L == null || !(L > 0.3)) return null;
          namety.push({ rovina:p.cislo, u:r3(u), druh: nm && lp ? "dvojity" : (nm ? "namet" : "lipanec"),
                        delkaM:r2(L), stareM:r2(v + a[2]),
                        rezNahore: nm ? { uhelHorniDeg:nm.uhelHorniDeg, uklonPilyDeg:nm.uklonPilyDeg, prvek:naroz.cislo } : null,
                        rezDole: lp ? { uhelHorniDeg:lp.uhelHorniDeg, uklonPilyDeg:lp.uklonPilyDeg, prvek:uzl.cislo } : null });
          return L;
        };
        vsechnyKrokve = vsechnyKrokve.concat(krokveVRovine(a[0], a[1], a[2], a[3], a[4], a[5], oprava, a[6], a[7]));
      });
      /* řádek Krokve ve výkazu s opravenými délkami */
      for(var iK=0;iK<prvky.length;iK++){
        if(prvky[iK].kod !== "krokve") continue;
        var nN = namety.filter(function(x){ return x.druh !== "lipanec"; }).length;
        var nL = namety.filter(function(x){ return x.druh !== "namet"; }).length;
        prvky[iK] = prvek("krokve","Krokve",P.krokev,vsechnyKrokve,"model",
          (roviny.length>1 ? ("délky z tvaru "+roviny.length+" střešních rovin") : "")
          + (namety.length ? ("; z toho " + (nN ? nN+" námětků (k boku nárožníku, šikmý řez)" : "")
             + (nN && nL ? " a " : "") + (nL ? nL+" lípanců (k boku úžlabníku)" : "")) : ""));
        break;
      }
    }
    narozniGeo = { lipnuti: lipnuti, prvky: prvkyN.map(function(x){
                     var o = {}; Object.keys(x).forEach(function(k){ if(k[0] !== "_" && k !== "roviny") o[k] = x[k]; }); return o; }),
                   namety: namety,
                   pocetNametku: namety.filter(function(x){ return x.druh !== "lipanec"; }).length,
                   pocetLipancu: namety.filter(function(x){ return x.druh !== "namet"; }).length };
    if(typeof rez === "object" && rez) rez.narozi = narozniGeo;   // pro půdorys, 3D a výkresy
    /* Řádek „Nárožní a úžlabní krokve" ve výkazu: doplní se, jak se prvky
       opracují — gradování (nárožník) / vyžlabení (úžlabník) a kolik sedel.
       Délky ani kusy se nemění, jde jen o informaci pro dílnu. */
    for(var iN=0;iN<prvky.length;iN++){
      if(prvky[iN].kod !== "naroznik") continue;
      var popisN = [];
      var nar = prvkyN.filter(function(x){ return x.typ === "narozi"; });
      var uzl = prvkyN.filter(function(x){ return x.typ === "uzlabi"; });
      var maxGr = function(arr){ return Math.round(Math.max.apply(null, arr.map(function(x){
        return Math.max(x.gradovani[0].kolmoMm, x.gradovani[1].kolmoMm); }))); };
      if(nar.length) popisN.push("nárožníky gradované (až " + maxGr(nar) + " mm)");
      if(uzl.length) popisN.push("úžlabníky vyžlabené (až " + maxGr(uzl) + " mm)");
      var nSedel = prvkyN.reduce(function(s, x){ return s + x.sedla.length; }, 0);
      if(nSedel) popisN.push(nSedel + " srdcových sedel na pozednici a vaznicích");
      if(popisN.length) prvky[iN].poznamka = (prvky[iN].poznamka ? prvky[iN].poznamka + " · " : "") + popisN.join(", ");
      break;
    }
    var chybyN = [].concat.apply([], prvkyN.map(function(x){ return x.chyby; }));
    if(chybyN.length && !v.narozniMimoDodavku) upozorneni.push(chybyN[0] + (chybyN.length > 1 ? " (a " + (chybyN.length-1) + "× podobně)" : ""));
  }

  /* VAZNICE „V KUSE" (PENTI 11. 10. 2026: „V nastavení mám, že má být
     vaznice v kuse, na vrcholové vaznici je ale přesto hákový plát").
     Výpočet dělení (statikaVaznice) běží vždy s uloženou nejdelší délkou
     kusu — a ta v zakázce zůstává, i když je políčko při volbě „v kuse"
     schované. Výkaz dělení bral jen při zapnutém dělení, ale výkres
     vaznice, 3D, půdorys a osazení kreslily plát z výpočtu. Teď: při
     „v kuse" se dělení zahodí všude — jeden kus. Nad 13 m (běžně nejdelší
     dodávaný hranol) upozornění. Uložená délka kusu v zakázce zůstává
     pro případ, že se dělení zase zapne. */
  if(!v.deleniVaznic && v.modelVaznice !== "prosty" && v.modelVaznice !== "styky"){
    var dlouheVKuse = [];
    podporyVaznic.forEach(function(pv){
      var st = pv.statika; if(!st || !st.deleni) return;
      var dl = +pv.delka || st.deleni.delka || 0;
      st.deleni = { deli:false, kusy:[{ od:0, "do":dl, delka:r2(dl) }], spoje:[], nouzovych:0,
                    delka:dl, vKuse:true, poznamka:"Vaznice v kuse (nastavení „spojitý nosník — vaznice v kuse“)." };
      if(dl > 13.0005) dlouheVKuse.push(pv.nazev + " " + r2(dl) + " m");
    });
    if(dlouheVKuse.length)
      upozorneni.push("Vaznice v kuse delší než 13 m (" + dlouheVKuse.join(", ") + "): takový hranol se běžně nedodává. "
        + "Ověřte dodávku, nebo v Zadání → Krov zvolte „dělit v nulovém momentu“.");
  }
  var deleniVaznicSouhrn = null;
  /* PROSTÉ NOSNÍKY (1. 10. 2026): vaznice se dělí nad KAŽDOU vnitřní
     podporou vždy (tak je to spočítané), bez ohledu na zaškrtávátko
     „dělit v nulovém momentu" — to platí jen pro spojitý nosník. */
  var prostyNosnik = (v.modelVaznice === "prosty");
  /* styky podle zadání (2026.10.191): spoj nad podporou jako u prostých
     nosníků — jednoduchý plát; vaznice bez styku zůstane v kuse */
  var stykyModel = (v.modelVaznice === "styky");
  var nadPodporou = prostyNosnik || stykyModel;
  if(stykyModel){
    podporyVaznic.forEach(function(pv){
      var st = pv.statika; if(!st || !st.deleni || st.model === "styky") return;
      var dl = +pv.delka || st.deleni.delka || 0;
      st.deleni = { deli:false, kusy:[{ od:0, "do":dl, delka:r2(dl) }], spoje:[], nouzovych:0,
                    delka:dl, vKuse:true, poznamka:"Vaznice bez styku — v kuse, spojitý nosník." };
    });
  }
  /* TYP SPOJE VAZNICE (PENTI 20. 10. 2026, 2026.10.193): v nulovém
     momentu hákový (výchozí) nebo rovný plát, nad podporou plát na ½
     výšky (výchozí) nebo tupý sraz na sedle. Tvary v penti-spoje.js. */
  var typSpojeN = (v.spojNulovy === "rovny") ? "rovny" : "hakovy";
  var typSpojeP = (v.spojNadPodporou === "sraz") ? "sraz" : "plat";
  var svornikuCelkem = 0, kramliCelkem = 0, sedelCelkem = 0, nazvySpoju = {}, sedloRozmer = null;
  if(v.deleniVaznic || nadPodporou){
    var spojuCelkem = 0, naviceCelkem = 0, nouzovychCelkem = 0, popisSpoju = [];
    /* Podpory jsou uložené v pořadí, v jakém se vaznice počítaly, takže
       i-tý běh v `podporyVaznic` odpovídá i-tému kusu ve výkazu. */
    var poKodu = {};
    podporyVaznic.forEach(function(pv){
      (poKodu[pv.kod] = poKodu[pv.kod] || []).push(pv);
    });
    Object.keys(poKodu).forEach(function(kod){
      var behy = poKodu[kod];
      var iP = -1;
      for(var j=0;j<prvky.length;j++){ if(prvky[j].kod===kod){ iP=j; break; } }
      if(iP < 0) return;
      var p = prvky[iP];
      /* POZOR: hotový prvek má `profil` jako text ("160/200") a rozměry
         zvlášť v `b` a `h`. Do prvek() se ale posílá objekt {b,h} — kdyby
         se předal ten text, ztratil by se průřez a spadla by kubatura
         (chyceno při měření ceny 16. 8. 2026). */
      var profilPrvku = { b:p.b, h:p.h };
      /* Šikmý hákový plát 3 × výška (penti-spoje.js, 30. 9. 2026) — stejná
         délka jako na výrobním výkresu vaznice. Do .120 tu bylo 2 × šířka,
         zatímco výkres kreslil 2,5 × výška. */
      var platM = global.PentiSpoje.hakovyPlat(p.h||220).delkaMm/1000;
      /* Prostý nosník: jednoduchý plát nad podporou (2 × šířka, min. 300,
         aspoň šířka sloupku + 100) — penti-spoje.js platNadPodporou. */
      var platNad = function(pv){
        return global.PentiSpoje.platNadPodporou(p.b, p.h,
          (P.sloupek && P.sloupek.b) || 140, pv.podpora === "ramy").delkaMm/1000;
      };
      if(nadPodporou && behy[0]) platM = platNad(behy[0]);
      /* tvar spoje podle volby; nouzový spoj (mimo nulový moment) zůstává hákový */
      var spojTvar = function(pv, sp){
        if(sp.nouzovy) return global.PentiSpoje.hakovyPlat(p.h||220);
        return global.PentiSpoje.spojVaznice(!!sp.nadPodporou, sp.nadPodporou ? typSpojeP : typSpojeN, p.b, p.h,
          (P.sloupek && P.sloupek.b) || 140, pv.podpora === "ramy", (P.sloupek && P.sloupek.h) || 140);
      };
      var kusy = p.kusy.slice(), pridano = 0, spojuTady = 0, platTady = 0, nazevTady = {};
      /* KUSY PRO OBJEDNÁVKU (PENTI 2. 11. 2026, 2026.10.200): „Vaznice je
         rozdělená v nulovém momentu, ve výpisu řeziva je ale v jednom kuse."
         Dělená vaznice jde do výkazu jako JEDNOTLIVÉ KUSY s řeznou délkou
         (délka mezi osami + ½ spoje na každém konci, který končí ve spoji)
         — stejně jako „kusy pro dílnu" na výrobním výkresu. Součet = délka
         + přídavek na spoje jako dřív; řezivo je pak skládá do tyčí podle
         skutečných kusů, ne naslepo. kusyDeleni[i] = kusy i-tého běhu. */
      var kusyDeleni = {};
      behy.forEach(function(pv, i){
        var d = pv.statika && pv.statika.deleni;
        if(!d || !d.deli || !d.spoje || !d.spoje.length) return;
        var pridej = 0;
        d.typNulovy = typSpojeN; d.typNadPodporou = typSpojeP;     // pro výkres a 3D
        var Lb = +d.delka || +pv.delka || 0, hran = [0], puly = [0];
        d.spoje.slice().sort(function(a, b){ return a.x - b.x; }).forEach(function(sp){
          var t = spojTvar(pv, sp); hran.push(+sp.x); puly.push(t.delkaMm/2000);
        });
        hran.push(Lb); puly.push(0);
        var ksB = [];
        for(var k = 0; k + 1 < hran.length; k++) ksB.push(r2(hran[k+1] - hran[k] + puly[k] + puly[k+1]));
        kusyDeleni[i] = ksB;
        d.spoje.forEach(function(sp){
          var t = spojTvar(pv, sp);
          pridej += t.delkaMm/1000;
          svornikuCelkem += (t.svorniky || 0); kramliCelkem += (t.kramle || 0);
          if(t.sedlo){ sedelCelkem++; sedloRozmer = t.sedlo; }
          nazevTady[t.nazev] = 1; nazvySpoju[t.nazev] = 1;
        });
        platTady += pridej;
        spojuTady += d.spoje.length;
        nouzovychCelkem += (d.nouzovych || 0);
        /* Když by pořadí z nějakého důvodu nesedělo, rozpustíme přídavek
           rovnoměrně — radši mírně nepřesné rozdělení než chybějící řezivo. */
        if(i < kusy.length) kusy[i] = r2(kusy[i] + pridej);
        else pridano += pridej;
        d.spoje.forEach(function(sp){
          popisSpoju.push(pv.nazev + ": spoj v " + sp.x + " m"
            + (sp.nadPodporou ? " (nad podporou)" : "")
            + (sp.nouzovy ? " (mimo nulový moment — musí být tuhý)" : ""));
        });
      });
      if(pridano > 0 && kusy.length) kusy[0] = r2(kusy[0] + pridano);
      if(!spojuTady) return;
      spojuCelkem += spojuTady;
      naviceCelkem += platTady;
      /* běh, který se do výkazu vešel (pořadí sedí), nahradí jeho kusy;
         jinak zůstane původní součtová délka (pojistka výše) */
      var poKusech = pridano === 0 && Object.keys(kusyDeleni).length > 0;
      if(poKusech){
        var nove = [];
        kusy.forEach(function(d0, i){ nove = nove.concat(kusyDeleni[i] || [d0]); });
        kusy = nove;
      }
      var nazevT = Object.keys(nazevTady).join(" / ");
      prvky[iP] = prvek(kod, p.nazev, profilPrvku, kusy, p.zdroj,
        (p.poznamka ? p.poznamka + "; " : "")
        + spojuTady + "× dělená " + (nadPodporou ? "nad podporou (" + (stykyModel ? "styky podle zadání" : "prosté nosníky") + ")" : "v nulovém momentu")
        + ", " + nazevT + (platTady > 0.001 ? " — přídavek " + Math.round(platTady*1000) + " mm započtený v délce" : " — bez přídavku délky")
        + (poKusech ? "; kusy podle spojů (řezné délky)" : ""),
        !poKusech);                                   // po kusech = samostatné kusy, ne souvislý pás
    });
    if(spojuCelkem > 0){
      deleniVaznicSouhrn = { spoju:spojuCelkem, naviceBm:r2(naviceCelkem),
                             nouzovych:nouzovychCelkem, mista:popisSpoju,
                             maxDelkaKusu: n(v.maxDelkaKusu) || 13,
                             /* pro spojovák: kolik svorníků na spoj a jak se spoj jmenuje */
                             model: prostyNosnik ? "prosty" : (stykyModel ? "styky" : "spojity"),
                             svornikuNaSpoj: (spojuCelkem > 0 && svornikuCelkem > 0 && svornikuCelkem % spojuCelkem === 0)
                               ? svornikuCelkem/spojuCelkem : (nadPodporou ? 1 : 2),
                             nazevSpoje: Object.keys(nazvySpoju).join(" / ") || (nadPodporou ? "jednoduchý plát nad podporou" : "šikmý hákový plát"),
                             /* 2026.10.193: přesné počty podle typu spoje */
                             svornikuCelkem: svornikuCelkem, kramli: kramliCelkem, sedel: sedelCelkem,
                             typNulovy: typSpojeN, typNadPodporou: typSpojeP };
      /* sedla pod tupým srazem — krátké trámky průřezu sloupku */
      if(sedelCelkem > 0 && sedloRozmer){
        prvky.push(prvek("sedla_vaznice", "Sedla pod srazem vaznice", { b:sedloRozmer.bMm, h:sedloRozmer.hMm },
          nKusu(sedelCelkem, sedloRozmer.delkaMm/1000), "model",
          "krátký trámek na hlavě sloupku, oba konce vaznice na něm leží v plné výšce; sloupek čepem do sedla"));
        upozorneni.push("Tupý sraz vaznice na sedle (" + sedelCelkem + "×): sloupky pod srazem jsou kratší o výšku sedla "
          + sedloRozmer.hMm + " mm — délku těchto sloupků ve výkazu a na výkrese upravte.");
      }
      /* pole delší než nejdelší dodávaný kus — u prostých nosníků se nedá
         dělit jinde než nad podporou */
      var dlouhych = 0;
      podporyVaznic.forEach(function(pv){ var d = pv.statika && pv.statika.deleni; if(d && d.prilisDlouhych) dlouhych += d.prilisDlouhych; });
      if(nadPodporou && dlouhych > 0)
        upozorneni.push((stykyModel ? "Vaznice se styky: " : "Vaznice jako prosté nosníky: ") + dlouhych + (stykyModel ? " kus mezi styky je delší než " : " pole je delší než ")
          + (n(v.maxDelkaKusu) || 13) + " m — kus se nedá dodat v jednom. Zhustěte podpory.");
      if(nouzovychCelkem > 0)
        upozorneni.push(nouzovychCelkem + " spoj(e) vaznice se nevešly do "
          + "nulového momentu a leží na hranici délky kusu. Tam už je vaznice "
          + "ohybem namáhaná — spoj musí být tuhý, ne jen přeplátovaný.");
    }
  }

  /* Vypnuté pásky hlásíme jen tehdy, když ve výkazu vůbec nějaké sloupky
     jsou — u hambálkového krovu by upozornění nedávalo smysl. */
  if(!paskyZap && prvky.some(function(p){ return /^sloupky/.test(p.kod); })){
    upozorneni.push("Pásky u sloupků jsou vypnuté. Krov tím není zavětrovaný "
      + "do stran a sloupky nemají nic, co by je drželo ve svislé poloze — "
      + "tuhost musí zajistit něco jiného (zavětrování v rovině střechy, "
      + "štítové stěny, kleštiny). Posudek vaznice se nemění, ten s pásky "
      + "nepočítá ani tak.");
  }

  /* ── OBLAST VAZNÍKŮ: PLOCHA A REAKCE VAZNIC NA KRAJNÍ VAZNÍK ────────────
     Plocha = šikmá plocha střechy od kraje u štítu po osu krajního
     vazníku (na každé rovině zvlášť; z ní se vazníky ceňují za m²).
     Reakce = co vaznice předá krajnímu vazníku: zatížení krovu × zatěžovací
     šířka vaznice × půl krajního pole (jako prostý nosník — na bezpečné
     straně proti spojitému, kde je u krajní podpory ~0,4·w·L). Vazník
     s tou silou navrhne MiTek Pamir. */
  var oblastVazVystup = null;
  if(oblastiVaz){
    oblastVazVystup = { odmitnuto:oblastiVaz.odmitnuto, oblasti:[], plochaSikmaM2:0, plochaPudorysM2:0, reakce:[] };
    if(jeOblastVaz){
      Object.keys(oblastiVaz.hrany).forEach(function(i){
        var ob = oblastiVaz.hrany[i], sik = 0, pud = 0, rovZ = [];
        roviny.forEach(function(p){
          var z = oblastiVaz.roviny[p.cislo]; if(!z) return;
          var rings = p.tvarRings || (p.tvar ? [p.tvar] : []), r = rozsahU(rings); if(!r) return;
          ["vlevo", "vpravo"].forEach(function(st){
            var zz = z[st]; if(!zz || zz.hrana !== +i) return;
            var u0 = st === "vlevo" ? r.min : r.max - zz.vaznikM, u1 = st === "vlevo" ? r.min + zz.vaznikM : r.max;
            /* šikmá plocha = integrál výšky roviny po spádu přes pás u0…u1 */
            var kroku = 100, s = 0;
            for(var k=0;k<kroku;k++){ var hv = hranyVU(rings, u0 + (u1-u0)*(k+0.5)/kroku); s += Math.max(0, hv.vrch - hv.spodek); }
            s *= (u1-u0)/kroku;
            var cs = Math.cos((p.sklon||0)*Math.PI/180);
            sik += s; pud += s*cs;
            rovZ.push({ rovina:p.cislo, strana:st, sirkaM:r3(u1-u0), plochaM2:r2(s) });
          });
        });
        oblastVazVystup.oblasti.push({ hrana:+i, delkaM:ob.delkaM, plochaSikmaM2:r2(sik), plochaPudorysM2:r2(pud), roviny:rovZ });
        oblastVazVystup.plochaSikmaM2 += sik; oblastVazVystup.plochaPudorysM2 += pud;
      });
      oblastVazVystup.plochaSikmaM2 = r2(oblastVazVystup.plochaSikmaM2);
      oblastVazVystup.plochaPudorysM2 = r2(oblastVazVystup.plochaPudorysM2);
      /* reakce vaznic */
      var Zr = zatizeniProOcel();
      podporyVaznic.forEach(function(pv){
        if(!pv.vaznikOd && !pv.vaznikDo) return;
        var pole = pv.pole || []; if(!pole.length || !Zr) return;
        var vrch = pv.kod === "vaznice_vrchol";
        var sirka = vrch ? sirkaVrcholove() : Math.max(levá.behZdi, jenJednaRovina ? 0 : pravá.behZdi)/2;
        var prof = (vrch ? P.vaznice : P.stredVaznice) || {};
        var gV = (prof.b||160)/1000*(prof.h||200)/1000*5;            // vlastní tíha vaznice, kN/m
        [["vaznikOd", pole[0]], ["vaznikDo", pole[pole.length-1]]].forEach(function(x){
          if(!pv[x[0]]) return;
          var L1 = x[1];
          oblastVazVystup.reakce.push({ kod:pv.kod, nazev:pv.nazev, konec:x[0] === "vaznikOd" ? "zacatek" : "konec",
            poleM:r3(L1), sirkaM:r3(sirka),
            RdKN:r2((Zr.qUlsPresne*sirka + 1.35*gV)*L1/2),         // návrhová (ULS)
            RkKN:r2((Zr.qSlsPresne*sirka + gV)*L1/2),               // charakteristická
            sanikKN:r2(Math.max(0, (Zr.qTahPresne||0)*sirka - gV)*L1/2) });   // nadzvednutí od sání
        });
      });
      if(oblastVazVystup.reakce.length)
        upozorneni.push("Oblast vazníků: krajní vazník nese konce vaznic — reakce "
          + oblastVazVystup.reakce.map(function(r){ return r.nazev + " " + r.RdKN + " kN"; }).join(", ")
          + " (návrhové). Krajní vazník musí MiTek Pamir navrhnout na tyto síly.");
    }
  }

  /* ── NÁROŽÍ A ÚŽLABÍ MIMO DODÁVKU (2026.10.182, PENTI 15. 10. 2026) ─────
     Ocelová nároží a úžlabí na ocelové konstrukci jiného dodavatele
     (zakázka STP_00010). Geometrie zůstane — půdorys, 3D a délky námětků
     a lípanců ji potřebují — ale nárožní a úžlabní krokve vypadnou
     z výkazu i z ceny a jejich posudek se nedělá. Námětky a lípance
     (běžné krokve) zůstávají v dodávce. */
  if(v.narozniMimoDodavku && naroznikGeo){
    naroznikGeo.mimoDodavku = true;
    prvky = prvky.filter(function(p){ return p.kod !== "naroznik"; });
    upozorneni.push("Nároží a úžlabí jsou ocelová a mimo dodávku (" + naroznikGeo.narozi + "× nároží, "
      + naroznikGeo.uzlabi + "× úžlabí) — nese je ocelová konstrukce jiného dodavatele. Ve výkazu ani v ceně nejsou "
      + "a jejich posudek se nedělá; námětky a lípance k nim zůstávají v dodávce.");
  }

  /* --- SOUHRN --- */
  var bm=0, m3=0, ks=0;
  prvky.forEach(function(p){ bm+=p.bm; m3+=p.m3; ks+=p.ks; });

  return {
    soustava: v.soustava || "vrcholova",
    soustavaNazev: S.nazev,
    prvky: prvky,
    rovin: roviny.length,
    vyskaStrechy: vyskaStrechy,
    sklonHlavni: r2(sklonHlavni),
    krokvi: vsechnyKrokve.length,
    /* Zadaná rozteč je přání, tohle je ta, která opravdu vyjde. */
    roztecKrokviZadana: r3(roztec),
    roztecKrokviSkutecna: r3(roztecSkutecna),
    /* Osy krokví po rovinách — z nich kreslí půdorys a podle nich se
       krokvemi ručně hýbe. Dřív si je kresba počítala podruhé po svém. */
    krokveRovin: krokveRovin,
    krokviPosunuto: krokviPosunuto,
    krokevMin: vsechnyKrokve.length? r2(Math.min.apply(null,vsechnyKrokve)):0,
    krokevMax: vsechnyKrokve.length? r2(Math.max.apply(null,vsechnyKrokve)):0,
    pozedniceBm: pozBm,
    /* Délky jednotlivých běhů — pro výrobní výkres pozednice. */
    pozedniceBehy: pozedniceBehy,
    pozedniceBehyVes: pozedniceBehyVes,
    /* zděné štíty — krokve po štít (null = vypnuto); půdorys z toho bere
       zkrácení pozednic, vaznic a hřebene, ať kreslí totéž, co je ve výkazu */
    zdeneStity: zdeneStity,
    /* oblast vazníků u štítu (null = žádná): plochy pro cenu, reakce
       vaznic na krajní vazník, zkrácení hřebene pro půdorys a 3D */
    /* ruční konce vrcholové vaznice z půdorysu (11. 10. 2026) — kresba je přičte */
    vrcholRucneKonce: vrcholRucne,
    oblastiVazniku: oblastVazVystup ? Object.assign(oblastVazVystup,
      { hrany: oblastiVaz.hrany, roviny: oblastiVaz.roviny, hreben: oblastiVaz.hreben || null }) : null,
    /* Rozdělení pozednice na kusy: kolik plátů, kolik kotev a kde.
       Spojovací materiál si odsud bere skutečný počet kotev, aby se
       nabídka nerozešla s výkresem. Když modul výkresů chybí, je null. */
    pozedniceDily: pozedniceDily,
    /* Rozteč kotev, se kterou se počítalo. Hlásí se i tehdy, když se
       rozdělení na kusy spočítat nepodařilo — spojovací materiál pak
       aspoň neztratí pravidlo „u soustav s vaznicí po dvou metrech". */
    roztecKotevPozednice: roztecKotev,
    /* Souhrn dělení vaznic — null, když je dělení vypnuté nebo se nic dělit
       nemusí. Obsahuje počet spojů, řezivo navíc a polohy spojů. */
    deleniVaznic: deleniVaznicSouhrn,
    /* věšadlo — souhrn pro nabídku (pásovina se účtuje na bm, ne z kubatury) */
    vesadlo: vesadloGeo,
    naroznik: naroznikGeo,
    /* nároží a úžlabí: sedla, gradování, námětky (penti-narozi.js, 1. 10. 2026) */
    narozi: narozniGeo,
    podporyVaznic: podporyVaznic,
    /* Posudky celé soustavy — fáze S5. */
    statika: statikaGeo,
    /* Detail rohu, kde se stýkají vaznice dvou kolmých rovin. */
    rohyVaznic: rohyVaznic,
    rohyPozednic: rohyPoz,
    bmCelkem: r2(bm),
    m3Cista: r3(m3),
    kusuCelkem: ks,
    /* true = tvaru střechy se nedá věřit, výkaz se nesmí použít do nabídky */
    nesmyslnyTvar: nesmysl,
    upozorneni: upozorneni.concat(ocelUpozorneni.filter(function(u){ return upozorneni.indexOf(u) < 0; })),
    /* Ocelové vaznice, sloupky z jeklu a pásky (2. 10. 2026) — mimo dřevěný
       výkaz; null = všechno dřevěné. kg = profily + plechy pat a hlav. */
    ocel: ocel ? (function(){
      var vse = ocel.vaznice.concat(ocel.sloupky, ocel.pasky);
      ocel.kgProfily = Math.round(vse.reduce(function(a,q){ return a + q.kg; }, 0)*10)/10;
      ocel.kgPlechy = Math.round((ocel.plechy || 0)*10)/10;
      ocel.kg = Math.round((ocel.kgProfily + ocel.kgPlechy)*10)/10;
      ocel.vyhovuje = ocel.posudky.every(function(r){ return r.vyhovuje; });
      return ocel;
    })() : null,
    /* polohy pro řez a půdorys — odvozené z téhož výkazu */
    rez: rez
  };
}

/* Pomůcka: n kusů stejné délky */
/* ── ČEPY PODLE penti-spoje.js (30. 9. 2026) ───────────────────────────
   Rozměry čepů říká jen modul spojů (kniha tesařských spojů PENTI):
   sloupek a věšák 60 mm, pásek 50 mm, dlab stejný. Když modul chybí,
   výpočet se zastaví s jasnou hláškou — tiše dosadit jiné číslo by
   znamenalo, že výkaz a výkres zase ukazují každý něco jiného. */
function cepSpoje(bMm, druh){
  if(!global.PentiSpoje)
    throw new Error("Chybí modul penti-spoje.js (rozměry tesařských spojů) — krov nejde spočítat.");
  return global.PentiSpoje.cep(bMm, druh);
}
/* Objednací délky sloupků = světlá výška pod vaznicí + čep do vaznice.
   Do .120 výkaz čep vynechával, přestože výrobní výkres sloupku ho
   přičítal — do nabídky tak šlo o čep míň dřeva, než se uřízlo. */
function sloupkySCepem(kusy, profilSloupku){
  var c = cepSpoje((profilSloupku&&profilSloupku.b)||140, "sloupek").delkaMm/1000;
  return kusy.map(function(d){ return r3(d + c); });
}
function oznacCepSloupku(pr, profilSloupku){
  var c = cepSpoje((profilSloupku&&profilSloupku.b)||140, "sloupek");
  pr.cepDoVaznice = c;
  pr.svetlaDelkaMax = r2(pr.delkaMax - c.delkaMm/1000);
  pr.poznamka = (pr.poznamka ? pr.poznamka + " · " : "")
    + "délka včetně čepu " + c.tloustkaMm + "×" + c.delkaMm + " mm do vaznice";
  return pr;
}

function nKusu(pocet, delka){
  var out=[]; for(var i=0;i<pocet;i++) out.push(delka); return out;
}

/* Délka kleštiny nebo hambálku.
   Prvek se přišroubuje na bok krokví a jeho konce se ZAŘÍZNOU LÍC S VENKOVNÍ
   HRANOU KROKVÍ (pravidlo PENTI). Konec je tedy šikmý řez rovnoběžný
   s krokví — dole je prvek delší než nahoře, a řeže se na tu delší míru.

   `vyska` = výška SPODNÍ hrany prvku nad horní hranou pozednice. */
function delkaVodorovneho(rozponMeziZdmi, sklonL, sklonP, vyska, vyskaProfilu, nadsedloviM, odLiceM){
  /* Vodorovná poloha venkovní hrany krokve v dané výšce — pro jednu stranu,
     měřeno od líce zdi. Venkovní hrana nad pozednicí: y = (x − odsazení)·tg
     + nadsedloví/cos — přímka začíná na vnější hraně pozednice, která je od
     líce zdi zatažená o `odLiceM` (22. 9. 2026; dřív se odsazení
     zanedbávalo a prvek vycházel o 2 × odsazení delší). */
  var odL = +odLiceM || 0;
  var xVeVysce = function(sklonRad, y){
    var tg=Math.tan(sklonRad), cs=Math.cos(sklonRad);
    if(tg<0.01) return null;
    return odL + (y - nadsedloviM/cs)/tg;
  };
  var xL = xVeVysce(sklonL, vyska);
  var xP = xVeVysce(sklonP==null ? sklonL : sklonP, vyska);
  if(xL===null || xP===null) return { delka:0, xDole:0, xDoleP:0, xNahore:0 };
  /* Na nesouměrné střeše je každý konec jinak daleko od své pozednice —
     prvek proto NENÍ na obou stranách stejně zaříznutý. */
  var delka = rozponMeziZdmi - xL - xP;
  var xNahoreL = xVeVysce(sklonL, vyska + vyskaProfilu);
  /* DÉLKA se zaokrouhluje na centimetry — tak se řeže a tak jde do výkazu.
     POLOHY konců ale na MILIMETRY: podle nich se kreslí i kótuje úřez
     kleštiny na výkrese krokve, a centimetrové zaokrouhlení posouvalo kótu
     až o 17 mm od nakreslené hrany (nahlásil PENTI 20. 8. 2026). */
  return { delka: r2(Math.max(0, delka)),
           xDole: r3(xL), xDoleP: r3(xP),
           xNahore: r3(xNahoreL===null ? xL : xNahoreL) };
}

/* ══════════════════════════════════════════════════════════════════════
   PROFIL versus PRVEK — dva různé názvy pro totéž
   ----------------------------------------------------------------------
   V zadání se profily jmenují po prvcích v jednotném čísle (`stredVaznice`,
   `sloupek`), ve výkazu mají řádky vlastní kódy v množném čísle a rozdělené
   podle polohy (`vaznice_stred`, `sloupky_pult`). Jeden profil tedy může
   obsloužit několik řádků výkazu — profil `sloupek` je ve třech.

   Kdo má něco přiřadit prvku podle profilu — třeba druh řeziva navržený
   automatikou — musí ty názvy přeložit. Bez překladu se přiřazení tiše
   ztratí: 23. 8. 2026 se takhle BSH navržené automatikou naceňovalo jako
   pilařské řezivo, protože klíč `stredVaznice` se s kódem `vaznice_stred`
   nikdy nepotkal. Rozdíl 18 816 Kč na jedné valbové střeše.
   ══════════════════════════════════════════════════════════════════════ */
var PRVKY_PROFILU = {
  krokev:       ["krokve"],
  pozednice:    ["pozednice","pozednice_dolni","pozednice_horni"],
  vaznice:      ["vaznice_okap","vaznice_pult","vaznice_vrchol"],
  stredVaznice: ["vaznice_stred","roh_vaznic_plat"],
  sloupek:      ["sloupky_stred","sloupky_pult","sloupky_vrchol"],
  pasek:        ["pasky_stred","pasky_pult","pasky_vrchol"],
  klestina:     ["klestiny","klestiny_male","klestiny_vrchol"],
  naroznik:     ["naroznik"],
  hambalek:     ["hambalky"],
  tram:         ["vazny_tram"],
  vzpera:       ["vzpery_ves"],
  sloupekVes:   ["sloupek_ves"]
};

/* Které řádky výkazu patří k profilu. Neznámý profil vrátí prázdno —
   nikdy sám sebe, aby se z překlepu nestal tichý nesmysl. */
function prvkyProfilu(profilKod){
  return (PRVKY_PROFILU[profilKod] || []).slice();
}

var API={ spocitej:spocitej, SOUSTAVY:SOUSTAVY, VYCHOZI:VYCHOZI,
  prvkyProfilu:prvkyProfilu, PRVKY_PROFILU:PRVKY_PROFILU,
  polohyKrokviVRovine:polohyKrokviVRovine,
          /* `prvek` se zpřístupňuje, aby ruční výkaz v kalkulačce vytvářel
             řádky přesně stejného tvaru jako spočítaný. Kdyby si ho
             kalkulačka skládala po svém, časem by se rozešly. */
          prvek:prvek, nKusu:nKusu,
          vysoko:vysoko, nizko:nizko, hranyVU:hranyVU,
          rozsahU:rozsahU, sirkaVeVysce:sirkaVeVysce,
          stitoveKonceRoviny:stitoveKonceRoviny, poleKrokvi:poleKrokvi,
          krokveVRovine:krokveVRovine, delkaPozednic:delkaPozednic,
          vikyrKrokev:vikyrKrokev, vikyreVRovine:vikyreVRovine };
if(typeof module!=="undefined" && module.exports) module.exports=API;
global.PentiKrov=API;
})(typeof window!=="undefined"?window:globalThis);
