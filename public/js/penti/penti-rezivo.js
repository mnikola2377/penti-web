/* ==========================================================================
   ŘEZIVO — CO SE OPRAVDU KOUPÍ
   --------------------------------------------------------------------------
   Výkaz krovu říká, jak dlouhé kusy jsou v konstrukci potřeba. Nakoupí se
   ale něco jiného — a rozdíl mezi tím se platí. Tenhle modul spočítá, kolik
   řeziva se objedná, kolik z toho zůstane jako odpad a kolik to bude stát.

   PILAŘSKÉ ŘEZIVO se prodává v celých metrech. Každý kus se proto zaokrouhlí
   nahoru: krokev 5,54 m se koupí jako šestimetrová.

   KVH A DUO/TRIO se prodávají v tyčích 6,5 a 13 m (KVH tl. 40 mm jen 5 m),
   BSH na míru po 10 cm (viz DRUHY). Nemá smysl
   kupovat tyč na každý kus — z třináctimetrové vyjdou dvě krokve po 5,5 m
   a ještě zbyde. Kusy se proto skládají do tyčí tak, aby zbývalo co nejmíň,
   a účtuje se CELÁ TYČ včetně odřezku, protože se celá koupí.

   POSTUP SKLÁDÁNÍ: kusy se seřadí od nejdelšího a každý se dá do první tyče,
   kde se ještě vejde. Na konci se každá tyč zkrátí na nejmenší skladovou
   délku, která její obsah unese — místo třináctimetrové se objedná pětimetrová,
   když víc není potřeba.

   NA KAŽDÝ ŘEZ SE POČÍTÁ 5 MM prořezu, jinak by poslední kus na tyči nevyšel.
   ========================================================================== */
(function(global){
"use strict";

var PROREZ = 0.005;                    // m — šířka řezu pilou

/* Druhy řeziva a jak se objednávají. */
var DRUHY = {
  /* ── DRUHY ŘEZIVA: JEN TECHNICKÉ VLASTNOSTI ──────────────────────────
     Sazby odsud odešly 28. 8. 2026 do `penti-cenik-rezivo.js`. Byly to
     údaje od dodavatele, které nesmí na veřejný web — zdroj stránky je
     tam vidět komukoli. Tenhle soubor teď na web smí, protože kalkulačka
     krovu potřebuje vědět, v jakých tyčích se co dodává; ceník zůstává
     jen v profi rozpočtu.

     `zpusob` říká, jak se objednává: v celých metrech, v tyčích daných
     délek, nebo na míru. `hustota` je pro přesun hmot. */
  pilarske: { nazev:"Pilařské řezivo", zpusob:"celeMetry",
              hustota:750, maxDelka:10,
              pozn:"prodává se v celých metrech, nejdéle 10 m; hustota nevysušeného dřeva" },
  /* DÉLKY TYČÍ (PENTI 2. 11. 2026, 2026.10.199): KVH i DUO/TRIO se teď
     dodávají jen v 6,5 a 13 m (dřív 5, 8 a 13 m). KVH tloušťky 40 mm
     (40/60, 40/80 …) jen v 5 m — `delkyTenke`; tloušťka = menší rozměr
     profilu. DUO/TRIO se ve 40 mm nevyrábí. Délky pro konkrétní profil
     vrací delkyProfilu(). */
  kvh:      { nazev:"KVH",     zpusob:"tyce", delky:[6.5,13], hustota:450,
              delkyTenke:{ doTloustkyMm:40, delky:[5] },
              maxProfil:{b:140,h:280},
              pozn:"sušený hoblovaný hranol, dodává se v tyčích 6,5 a 13 m (tloušťka 40 mm jen 5 m)" },
  duo:      { nazev:"DUO/TRIO", zpusob:"tyce", delky:[6.5,13], hustota:450,
              maxProfil:{b:140,h:280},
              pozn:"lepený profil ze dvou nebo tří lamel, tvarově stálejší než KVH; tyče 6,5 a 13 m" },
  /* BSH se NESKLÁDÁ DO TYČÍ — dodává se na míru po 10 cm podle požadavku
     (ověřeno u dodavatelů 21. 8. 2026). Skládání by u něj bylo nesmysl:
     objedná se přesně tolik, kolik je potřeba. */
  bsh:      { nazev:"BSH (lepený lamelový)", zpusob:"naMiru", krokDelkyM:0.1,
              hustota:450, maxDelka:16,
              pozn:"na míru po 10 cm, nejdéle 16 m; profil roste po 40 mm "
                 + "až do výšky 1000 mm" }
};

/* Skladové délky tyčí pro druh a profil b × h (mm). Tenké profily
   (menší rozměr do `delkyTenke.doTloustkyMm`) mají vlastní seznam. */
function delkyProfilu(D, b, h){
  if(!D) return null;
  var T = D.delkyTenke;
  if(T && b > 0 && h > 0 && Math.min(b, h) <= T.doTloustkyMm + 1e-9) return T.delky.slice();
  return D.delky ? D.delky.slice() : null;
}


/* ── KVALITA VZHLEDU ──────────────────────────────────────────────────
   Si (pohledová) a NSi (nepohledová) jsou PEVNOSTNĚ ROVNOCENNÉ — liší se
   jen vzhledem, takže se přepnutím kvality nemění žádný statický posudek.
   NSi smí být zamodralé, se suky a trhlinami; Si je bez vad a případné
   smolníky a vypadlé suky jsou vyspravené (zadání PENTI 21. 8. 2026).

   PŘIRÁŽKA ZA POHLEDOVOU KVALITU je zatím ODHAD — je potřeba ji potvrdit
   z ceníku dodavatele. Dá se přepsat v sazbách. */
var KVALITY = {
  nsi: { nazev:"nepohledová (NSi)", prirazka:0 },
  si:  { nazev:"pohledová (Si)",    prirazka:0.20 }
};

/* ══════════════════════════════════════════════════════════════════════
   JAKÉ VÝŠKY PROFILU SE V TOM DRUHU DAJÍ POŘÍDIT
   ----------------------------------------------------------------------
   Návrh profilu zkouší postupně vyšší hranoly, dokud jeden neprojde.
   Které to smí být, ale závisí na druhu řeziva — a to se do 23. 8. 2026
   neřešilo: nabízela se jedna řada 140–320 mm pro všechno.

   · PILAŘSKÉ — po 20 mm do 320 mm. Nad to se běžný hranol neseže.
   · KVH a DUO/TRIO — totéž, ale nejvýš 280 mm; víc se v nich nevyrábí
     (viz `maxProfil`). Dřív se u nich navrhlo i 320 mm, které by pak
     dodavatel neměl — a modul cen na to jen upozornil, aniž by tomu
     návrh zabránil.
   · BSH — lepený lamelový nosník roste PO 40 mm a dá se pořídit až do
     výšky 1000 mm (Michal, 23. 8. 2026). Profil 160/1000 je normální
     zboží. Proto se u BSH nesmí nic zastropit na 320 mm.

   POZOR NA PEVNOST: kalkulačka posuzuje všechno na třídu zadanou v poli
   „třída dřeva" (výchozí C24). BSH bývá GL24h, tedy pevnější — návrh
   v BSH proto vychází NA STRANU BEZPEČNOU, ne přesně. Až se doplní
   pevnostní třídy lepeného dřeva, půjde profily zmenšit.
   ══════════════════════════════════════════════════════════════════════ */
var VYSKY_ZAKLAD = [140,160,180,200,220,240,260,280,300,320];

function vyskyProfilu(druhKod){
  var D = DRUHY[druhKod];
  if(druhKod === "bsh"){
    /* Po 40 mm od 160 do 1000. */
    var out = [];
    for(var h = 160; h <= 1000; h += 40) out.push(h);
    return out;
  }
  if(D && D.maxProfil && D.maxProfil.h)
    return VYSKY_ZAKLAD.filter(function(h){ return h <= D.maxProfil.h; });
  return VYSKY_ZAKLAD.slice();
}

var VYCHOZI_DRUH = "pilarske";
var VYCHOZI_KVALITA = "nsi";

/* Cena za m3 pro dvojici druh + kvalita.
   `sazby.odber` ('kus' | 'balik') vybírá z ceníku druhu; ruční sazba
   `sazby.cenaM3` má přednost před obojím. */
function cenaZaM3(D, kvalita, sazby){
  var zOdberu = null;
  if(D && D.cenyOdber){
    var od = (sazby && sazby.odber === "balik") ? "balik" : "kus";
    if(D.cenyOdber[od] != null) zOdberu = D.cenyOdber[od];
  }
  /* SPADLÝ CENÍK NESMÍ VRÁTIT NULU. Kdyby chybějící `penti-cenik-rezivo.js`
     znamenal nulovou sazbu, nabídka by tiše vyšla bez řeziva. */
  var zaklad = (sazby && sazby.cenaM3 != null) ? sazby.cenaM3
             : (zOdberu != null ? zOdberu : D.cenaM3);
  if (zaklad == null) {
    throw new Error("PENTI: ceny řeziva jsou v modulu penti-cenik-rezivo.js, "
      + "který není načtený. Doplňte <script src=\"penti-cenik-rezivo.js\">.");
  }
  var K = KVALITY[kvalita] || KVALITY[VYCHOZI_KVALITA];
  /* Konkrétní cena pro dvojici přebije přirážku, když ji někdo vyplní. */
  var primo = sazby && sazby.ceny && sazby.ceny[kvalita];
  if(primo != null) return primo;
  return Math.round(zaklad * (1 + (K.prirazka||0)));
}

function r2(x){ return Math.round((x||0)*100)/100; }
function r3(x){ return Math.round((x||0)*1000)/1000; }

/* ==========================================================================
   SKLÁDÁNÍ KUSŮ DO TYČÍ
   Vrací seznam tyčí; každá ví, jak je dlouhá a co je na ní.
   ========================================================================== */
function slozDoTyci(kusy, delky){
  var k = (kusy||[]).slice().sort(function(a,b){ return b-a; });   // od nejdelšího
  var nejdelsiTyc = Math.max.apply(null, delky);
  var tyce = [];

  k.forEach(function(d){
    if(d > nejdelsiTyc + 1e-9){
      /* Kus je delší než nejdelší tyč — musí se nastavovat nebo objednat
         na míru. Založíme mu vlastní tyč o jeho délce a označíme to. */
      tyce.push({ kapacita:d, obsazeno:d, kusy:[d], naMiru:true });
      return;
    }
    var vlozeno=false;
    for(var i=0;i<tyce.length;i++){
      var t=tyce[i];
      if(t.naMiru) continue;
      var potreba = d + (t.kusy.length ? PROREZ : 0);
      if(t.obsazeno + potreba <= t.kapacita + 1e-9){
        t.obsazeno = r3(t.obsazeno + potreba);
        t.kusy.push(d);
        vlozeno=true; break;
      }
    }
    if(!vlozeno) tyce.push({ kapacita:nejdelsiTyc, obsazeno:d, kusy:[d], naMiru:false });
  });

  /* Zkrácení: každá tyč se objedná v nejmenší skladové délce, která stačí. */
  var serazene = delky.slice().sort(function(a,b){ return a-b; });
  tyce.forEach(function(t){
    if(t.naMiru) return;
    for(var i=0;i<serazene.length;i++){
      if(serazene[i] + 1e-9 >= t.obsazeno){ t.kapacita = serazene[i]; break; }
    }
  });
  return tyce;
}

/* Souvislý pás (pozednice, vaznice) se skládá z několika kusů za sebou.
   Nakoupí se co nejvíc nejdelších tyčí a zbytek se dokryje nejmenší tyčí,
   která na něj stačí — dvacetimetrová pozednice není jeden hranol. */
function rozdelBeh(delka, delky){
  var serazene=delky.slice().sort(function(a,b){ return a-b; });
  var nej=serazene[serazene.length-1];
  var out=[], zbytek=delka;
  while(zbytek > nej + 1e-9){ out.push(nej); zbytek=r3(zbytek-nej); }
  if(zbytek > 1e-9){
    var vybrana=nej;
    for(var i=0;i<serazene.length;i++){ if(serazene[i]+1e-9 >= zbytek){ vybrana=serazene[i]; break; } }
    out.push(vybrana);
  }
  return out;
}

/* ==========================================================================
   HLAVNÍ VÝPOČET
   prvky — z výkazu krovu: [{kod, nazev, b, h, kusy:[délky], ...}]
   druh  — klíč z DRUHY
   sazby — { cenaM3, hustota } pro přepis výchozích hodnot
   ========================================================================== */
function spocitej(prvky, druh, sazby){
  var seznam = (prvky||[]).filter(function(p){ return p && p.kusy && p.kusy.length; });
  if(!seznam.length) return null;

  /* ── SKUPINY: DRUH + KVALITA + PROFIL ──────────────────────────────────
     Do 21. 8. 2026 platil jeden druh řeziva na celý krov. PENTI ale chce
     volit druh a kvalitu U KAŽDÉHO PRVKU zvlášť — vaznice můžou být KVH
     nepohledové, přiznaný sloupek BSH pohledový.

     Sjednocuje se proto podle TROJICE druh + kvalita + profil. Z hranolu
     100×180 nenařežeš 160×200 a z nepohledového nevyrobíš pohledový, takže
     každá kombinace se objednává zvlášť. Prvek, který svůj druh nemá,
     spadne na ten globální — díky tomu se nic staršího nerozbije. */
  var vychoziDruh = druh || VYCHOZI_DRUH;
  var skupiny = {};
  seznam.forEach(function(p){
    var dr = p.druh || vychoziDruh;
    var kv = p.kvalita || VYCHOZI_KVALITA;
    if(!DRUHY[dr]) dr = vychoziDruh;
    if(!KVALITY[kv]) kv = VYCHOZI_KVALITA;
    var sk = dr+"|"+kv;
    if(!skupiny[sk]) skupiny[sk] = { druh:dr, kvalita:kv, prvky:[] };
    skupiny[sk].prvky.push(p);
  });

  var profily=[], nakupM3=0, cistaM3=0, upozorneni=[], cenaCelkem=0;
  var skupinyOut=[], hmotnostCelkem=0;

  Object.keys(skupiny).sort().forEach(function(skKlic){
  var sk = skupiny[skKlic];
  /* RUČNĚ PŘEPSANÁ SAZBA PLATÍ JEN PRO HLAVNÍ DRUH.
     Kdyby se pustila do všech skupin, přebila by katalogovou cenu i tam,
     kde uživatel vybral něco jiného — KVH by se ocenilo jako pilařské
     (chyceno při ověřování balíčku 21. 8. 2026). */
  /* Ruční sazba platí jen pro hlavní druh (jinak by přebila katalog
     u druhu, který si uživatel vybral zvlášť). ODBĚR ale platí pro
     celou zakázku — objednává se najednou, ne po skupinách. */
  var sazbySk = (sk.druh === vychoziDruh) ? (sazby||{}) : {};
  if(sazby && sazby.odber) sazbySk = Object.assign({}, sazbySk, { odber: sazby.odber });
  var D = Object.assign({}, DRUHY[sk.druh], sazbySk);
  var cenaM3 = cenaZaM3(DRUHY[sk.druh], sk.kvalita, sazbySk);
  var oznaceni = DRUHY[sk.druh].nazev + " " + (sk.kvalita==="si" ? "Si" : "NSi");
  var dleProfilu = {};
  sk.prvky.forEach(function(p){
    var klic = p.b+"×"+p.h;
    if(!dleProfilu[klic]) dleProfilu[klic] = { b:p.b, h:p.h, profil:klic, kusy:[], behy:[], prvky:[] };
    /* Souvislé pásy se drží zvlášť — nakupují se jinak než samostatné kusy. */
    if(p.beh) dleProfilu[klic].behy = dleProfilu[klic].behy.concat(p.kusy);
    else      dleProfilu[klic].kusy = dleProfilu[klic].kusy.concat(p.kusy);
    dleProfilu[klic].prvky.push(p.nazev);
  });
  var profilySk=[], nakupSk=0, cistaSk=0;

  Object.keys(dleProfilu).forEach(function(klic){
    var g = dleProfilu[klic];
    var prurez = (g.b/1000)*(g.h/1000);
    var cista = g.kusy.concat(g.behy).reduce(function(s,d){ return s+d; },0);
    var nakupBm, tyce=null, popis;

    if(D.zpusob === "celeMetry"){
      /* Pilařské: samostatné kusy nahoru na celý metr; souvislý pás se řeže
         z metrových délek, takže se zaokrouhlí jen jeho konec. */
      nakupBm = g.kusy.reduce(function(s,d){ return s+Math.ceil(d-1e-9); },0)
              + g.behy.reduce(function(s,d){ return s+Math.ceil(d-1e-9); },0);
      popis = "kusy zaokrouhlené nahoru na celý metr";
    } else if(D.zpusob === "naMiru"){
      /* BSH: každý kus se objedná na svou délku, zaokrouhlenou nahoru na
         krok, ve kterém dodavatel dodává (po 10 cm). Nic se neskládá a
         nic se neřeže — proto ani žádný prořez. */
      var krok = D.krokDelkyM || 0.1;
      var naM = function(d){ return Math.ceil((d - 1e-9)/krok)*krok; };
      nakupBm = g.kusy.concat(g.behy).reduce(function(s,d){ return s+naM(d); },0);
      var poD = {};
      g.kusy.concat(g.behy).forEach(function(d){
        var k = r2(naM(d)); poD[k]=(poD[k]||0)+1; });
      popis = "na míru po " + Math.round(krok*100) + " cm: "
        + Object.keys(poD).map(Number).sort(function(x,y){ return y-x; })
            .map(function(d){ return poD[d]+"× "+r2(d)+" m"; }).join(", ");
    } else {
      var DL = delkyProfilu(D, g.b, g.h);                       // délky tyčí pro tenhle profil
      var vsechny = g.kusy.slice();
      g.behy.forEach(function(d){ vsechny = vsechny.concat(rozdelBeh(d, DL)); });
      /* Kusy z rozděleného pásu už mají skladovou délku — dají se na vlastní
         tyče, ostatní se skládají. */
      tyce = slozDoTyci(vsechny, DL);
      nakupBm = tyce.reduce(function(s,t){ return s+t.kapacita; },0);
      var naMiru = tyce.filter(function(t){ return t.naMiru; }).length;
      if(naMiru) upozorneni.push(klic+": "+naMiru+" kusů je delších než "
        +String(Math.max.apply(null,DL)).replace(".", ",")+" m — je potřeba je objednat na míru nebo nastavit.");
      /* souhrn tyčí po délkách */
      var poDelce={};
      tyce.forEach(function(t){ var d=t.naMiru? ("na míru "+r2(t.kapacita)) : r2(t.kapacita);
        poDelce[d]=(poDelce[d]||0)+1; });
      popis = Object.keys(poDelce).map(function(d){
        return poDelce[d]+"× "+(String(d).indexOf("míru")>=0 ? d+" m" : d+" m"); }).join(", ");
    }

    var pn = r3(prurez*nakupBm), pc = r3(prurez*cista);
    nakupM3 += pn; cistaM3 += pc;
    nakupSk += pn; cistaSk += pc;
    /* ── DELŠÍ KUS, NEŽ SE V TOM DRUHU VYRÁBÍ ──────────────────────────
       Každý druh má svůj strop délky: pilařské 10 m (řeže se z kmene),
       BSH 16 m (limit lisu a dopravy). Delší kus se nedá objednat v kuse
       a musí se nastavit NAD PODPOROU, kde má spoj oporu.

       Do 23. 8. 2026 se to hlídalo jen u pilařského řeziva — u BSH mohla
       projít třeba dvacetimetrová vaznice a nikdo by si toho nevšiml, než
       by ji objednal. Souvislých pásů se to netýká, ty se skládají za sebe. */
    if(D.maxDelka > 0){
      var dlouhe = g.kusy.filter(function(d){ return d > D.maxDelka + 1e-9; });
      if(dlouhe.length){
        var nejdelsi = r2(Math.max.apply(null, dlouhe));
        upozorneni.push(oznaceni+" "+klic+": "+dlouhe.length+" kusů je delších než "
          + D.maxDelka + " m (nejdelší " + nejdelsi + " m) — v tomhle druhu se "
          + "tak dlouhý kus nedodává. Je potřeba ho naplátovat (nastavit) "
          + "nad podporou — u krokve nad vaznicí, kde má spoj oporu"
          + (sk.druh === "pilarske" ? ", nebo zvolit KVH či BSH." : ".")
          + (D.maxDelka >= 13 ? " Kus nad 13 m navíc potřebuje zvláštní kamion." : ""));
      }
    }

    /* Profil, který se v daném druhu nevyrábí, se musí ohlásit — jinak se
       objedná něco, co dodavatel nemá (21. 8. 2026). */
    if(D.maxProfil && (g.b > D.maxProfil.b || g.h > D.maxProfil.h)){
      upozorneni.push(oznaceni+" "+klic+" mm: takový profil se v tomhle druhu "
        +"běžně nevyrábí (nejvýš "+D.maxProfil.b+"/"+D.maxProfil.h+" mm) — "
        +"zvol BSH, nebo profil zmenši.");
    }
    profilySk.push({
      profil: klic, b:g.b, h:g.h,
      druh: sk.druh, kvalita: sk.kvalita, oznaceni: oznaceni,
      prvky: g.prvky,
      kusu: g.kusy.length + g.behy.length,
      cistaBm: r2(cista), nakupBm: r2(nakupBm),
      cistaM3: pc, nakupM3: pn,
      odpadProcent: pc>0 ? r2(((pn/pc)-1)*100) : 0,
      tyce: tyce ? tyce.map(function(t){ return { delka:r2(t.kapacita), kusy:t.kusy.map(r2),
        vyuzito:r2(t.obsazeno), naMiru:!!t.naMiru }; }) : null,
      popis: popis
    });
  });

  /* Konec jedné skupiny druh + kvalita. */
  profilySk.sort(function(a,b){ return b.nakupM3-a.nakupM3; });
  var cenaSk = Math.round(r3(nakupSk) * cenaM3 * 100)/100;
  cenaCelkem += cenaSk;
  hmotnostCelkem += r3(nakupSk) * (D.hustota||450) / 1000;
  skupinyOut.push({
    druh: sk.druh, druhNazev: DRUHY[sk.druh].nazev,
    kvalita: sk.kvalita, kvalitaNazev: KVALITY[sk.kvalita].nazev,
    oznaceni: oznaceni, zpusob: D.zpusob, delkyTyci: D.delky || null,
    cenaM3: cenaM3,
    prvky: sk.prvky.map(function(x){ return x.nazev; }),
    profily: profilySk,
    cistaM3: r3(cistaSk), nakupM3: r3(nakupSk),
    odpadM3: r3(nakupSk - cistaSk),
    odpadProcent: cistaSk>0 ? r2(((nakupSk/cistaSk)-1)*100) : 0,
    cena: cenaSk
  });
  profily = profily.concat(profilySk);
  });

  profily.sort(function(a,b){ return b.nakupM3-a.nakupM3; });
  skupinyOut.sort(function(a,b){ return b.nakupM3-a.nakupM3; });

  /* Kolik tyčí které délky objednat — přes všechny profily dohromady
     to nedává smysl (různé průřezy), takže po profilech. */
  var objednavka = profily.filter(function(p){ return p.tyce; }).map(function(p){
    var poDelce={};
    p.tyce.forEach(function(t){ var k=t.naMiru?("na míru "+t.delka):t.delka;
      poDelce[k]=(poDelce[k]||0)+1; });
    return { profil:p.profil, delky:Object.keys(poDelce).map(function(k){
      return { delka:k, ks:poDelce[k] }; }) };
  });

  nakupM3=r3(nakupM3); cistaM3=r3(cistaM3);
  /* Cena i hmotnost se sčítají PO SKUPINÁCH — každá má svou cenu za m3. */
  var cena = Math.round(cenaCelkem*100)/100;
  var hmotnostT = r3(hmotnostCelkem);
  var Dhlavni = DRUHY[vychoziDruh];

  return {
    druh: vychoziDruh,
    druhNazev: Dhlavni.nazev,
    zpusob: Dhlavni.zpusob,
    delkyTyci: Dhlavni.delky || null,
    /* Cena hlavního druhu VČETNĚ ručně přepsané sazby — jinak by se
       ztratilo, že si někdo cenu upravil (chyceno testem 21. 8. 2026). */
    cenaM3: cenaZaM3(Dhlavni, VYCHOZI_KVALITA, sazby),
    hustota: (sazby && sazby.hustota != null) ? sazby.hustota : Dhlavni.hustota,
    /* Rozpad podle druhu a kvality — tohle je to nové. */
    skupiny: skupinyOut,
    viceDruhu: skupinyOut.length > 1,
    profily: profily,
    objednavka: objednavka,
    cistaM3: cistaM3,
    nakupM3: nakupM3,
    odpadM3: r3(nakupM3-cistaM3),
    odpadProcent: cistaM3>0 ? r2(((nakupM3/cistaM3)-1)*100) : 0,
    cenaReziva: cena,
    hmotnostT: hmotnostT,
    upozorneni: upozorneni
  };
}

/* ══════════════════════════════════════════════════════════════════════
   NÁŘEZOVÝ PLÁN
   ----------------------------------------------------------------------
   Zadání PENTI 21. 8. 2026, krok 3. Skládá KUSY SE ZNAČKAMI, ne holá
   čísla — jinak se po složení nedá říct, co na které tyči je.

   ŘEŽE SE U NÁS VE FIRMĚ, ne na pile. Plán je tedy VÝROBNÍ PODKLAD pro
   naši dílnu, ne závazná objednávka. Když se přepočítáme, přeřízne se to
   jinak — nechybí kus na stavbě. Dodavateli jde jen soupis tyčí.

   REZERVA NA ZAŘÍZNUTÍ. Ke každému kusu se přidává pár milimetrů, aby
   měl tesař co srovnat. Rezerva se přiznává, ať je vidět, že tam je.

   ZBYTKY SE NABÍZEJÍ K POUŽITÍ. Když z třináctimetrové tyče zbude 2,3 m,
   není to nutně odpad — může z toho být pásek nebo kleštinka. Delší
   konce se proto vypisují jako použitelné, ne jako odřez.

   DVĚ VARIANTY. Nejmíň prořezu (i třináctimetrové tyče) proti variantě
   jen do 9 m — nad 9 m se objednává zvláštní kamion a doprava je dražší.
   Ukazují se obě, protože nejmenší prořez nemusí být nejlevnější.
   ══════════════════════════════════════════════════════════════════════ */

/* Zbytek delší než tohle stojí za to schovat na kratší prvky. */
var ZBYTEK_POUZITELNY_M = 1.0;

/* Skládání kusů SE ZNAČKAMI do tyčí — jinak stejné jako `slozDoTyci`:
   nejdelší napřed, do první tyče, kde se ještě vejde. Krátké kusy tak
   automaticky padnou do zbytků po dlouhých. */
function slozKusySeZnackou(kusy, delky, rezervaM){
  var rez = rezervaM || 0;
  var k = (kusy||[]).slice().sort(function(a,b){ return b.delkaM - a.delkaM; });
  var nejdelsiTyc = Math.max.apply(null, delky);
  var tyce = [];

  k.forEach(function(ks){
    var potrebaCista = ks.delkaM + rez;
    if(potrebaCista > nejdelsiTyc + 1e-9){
      tyce.push({ kapacita:r3(potrebaCista), obsazeno:r3(potrebaCista),
                  kusy:[ks], naMiru:true });
      return;
    }
    var vlozeno=false;
    for(var i=0;i<tyce.length;i++){
      var t=tyce[i];
      if(t.naMiru) continue;
      var potreba = potrebaCista + (t.kusy.length ? PROREZ : 0);
      if(t.obsazeno + potreba <= t.kapacita + 1e-9){
        t.obsazeno = r3(t.obsazeno + potreba);
        t.kusy.push(ks);
        vlozeno=true; break;
      }
    }
    if(!vlozeno) tyce.push({ kapacita:nejdelsiTyc, obsazeno:r3(potrebaCista),
                             kusy:[ks], naMiru:false });
  });

  /* Každá tyč se objedná v nejmenší skladové délce, která na ni stačí. */
  var serazene = delky.slice().sort(function(a,b){ return a-b; });
  tyce.forEach(function(t){
    if(t.naMiru) return;
    for(var i=0;i<serazene.length;i++){
      if(serazene[i] + 1e-9 >= t.obsazeno){ t.kapacita = serazene[i]; break; }
    }
  });
  return tyce;
}

/* Nářezový plán pro jednu sadu kusů (jeden druh + kvalita + profil). */
function planProSkupinu(kusy, D, rezervaM, maxDelkaM){
  var k0 = (kusy||[])[0] || {};
  var vse = delkyProfilu(D, k0.b, k0.h) || [];                    // skupina = jeden profil
  var delky = vse.filter(function(d){
    return !(maxDelkaM > 0) || d <= maxDelkaM + 1e-9; });
  if(!delky.length) delky = [Math.min.apply(null, vse.length ? vse : [5])];

  if(D.zpusob === "naMiru"){
    /* BSH: každý kus na svou délku, zaokrouhlenou na krok dodavatele. */
    var krok = D.krokDelkyM || 0.1;
    var tyce = kusy.map(function(ks){
      var d = Math.ceil((ks.delkaM + rezervaM - 1e-9)/krok)*krok;
      return { kapacita:r3(d), obsazeno:r3(ks.delkaM + rezervaM),
               kusy:[ks], naMiru:true, naMiruBSH:true };
    });
    return { tyce:tyce, delkyTyci:null, zpusob:"naMiru" };
  }
  if(D.zpusob === "celeMetry"){
    /* Pilařské: každý kus se koupí jako celý metr. */
    var tyce2 = kusy.map(function(ks){
      var d = Math.ceil(ks.delkaM + rezervaM - 1e-9);
      return { kapacita:d, obsazeno:r3(ks.delkaM + rezervaM),
               kusy:[ks], naMiru:false, celyMetr:true };
    });
    return { tyce:tyce2, delkyTyci:null, zpusob:"celeMetry" };
  }
  /* NEJMÍŇ PROŘEZU DOOPRAVDY (8. 10. 2026): skládání „do nejdelší tyče
     a pak zkrátit" občas nechalo víc odřezu, než kdyby se rovnou skládalo
     do kratších tyčí (varianta do 9 m pak vycházela s menším odpadem než
     „nejmíň prořezu"). Zkusí se proto horní mez = každá skladová délka,
     do které se vejde i nejdelší kus, a vezme se plán s nejmenším počtem
     objednaných metrů (při shodě ten s menším počtem tyčí). */
  var nejdelsiKus = Math.max.apply(null, kusy.map(function(ks){ return ks.delkaM + (rezervaM||0); }));
  var meze = delky.filter(function(d){ return d + 1e-9 >= nejdelsiKus; });
  if(!meze.length) meze = [Math.max.apply(null, delky)];        // nejdelší kus se nevejde nikam → beze změny
  var nejlepsi = null, nejlepsiM = Infinity;
  meze.forEach(function(mez){
    var t = slozKusySeZnackou(kusy, delky.filter(function(d){ return d <= mez + 1e-9; }), rezervaM);
    var m = t.reduce(function(a, x){ return a + x.kapacita; }, 0);
    if(m < nejlepsiM - 1e-9 || (Math.abs(m - nejlepsiM) <= 1e-9 && t.length < nejlepsi.length)){ nejlepsi = t; nejlepsiM = m; }
  });
  return { tyce: nejlepsi, delkyTyci: delky, zpusob:"tyce" };
}

/* Hlavní vstup: kusovník + volby → plán. */
function narezovyPlan(polozky, o){
  o = o || {};
  var rezervaM = (o.rezervaMm != null ? o.rezervaMm : 20) / 1000;
  var maxDelkaM = o.maxDelkaM || 0;
  var vychoziDruh = o.druh || VYCHOZI_DRUH;
  var sazby = o.sazby || {};

  var skupiny = {};
  (polozky||[]).forEach(function(p){
    if(!(p.delkaM > 0)) return;
    var dr = DRUHY[p.druh] ? p.druh : vychoziDruh;
    var kv = KVALITY[p.kvalita] ? p.kvalita : VYCHOZI_KVALITA;
    var klic = dr+"|"+kv+"|"+p.b+"×"+p.h;
    if(!skupiny[klic]) skupiny[klic] = { druh:dr, kvalita:kv, b:p.b, h:p.h,
                                         profil:p.b+"×"+p.h, kusy:[] };
    skupiny[klic].kusy.push(p);
  });

  var out=[], objednavka={}, upozorneni=[], naMiruKusu=0;
  var celkem={ cistaM3:0, nakupM3:0, cena:0,
    zbytkuM:0, odpadM:0, rezervaM:0, tyci:0, kusu:0 };

  Object.keys(skupiny).sort().forEach(function(klic){
    var g = skupiny[klic];
    var D = DRUHY[g.druh];
    var sazbySk = (g.druh === vychoziDruh) ? sazby : {};
    var cenaM3 = cenaZaM3(D, g.kvalita, sazbySk);
    var plan = planProSkupinu(g.kusy, D, rezervaM, maxDelkaM);
    var prurez = (g.b/1000)*(g.h/1000);
    var oznaceni = D.nazev + " " + (g.kvalita==="si" ? "Si" : "NSi") + " " + g.profil;

    var nakupBm=0, cistaBm=0, zbytky=[], odpadBm=0;
    plan.tyce.forEach(function(t, i){
      t.cislo = i+1;
      nakupBm += t.kapacita;
      var cista = t.kusy.reduce(function(a,x){ return a+x.delkaM; },0);
      cistaBm += cista;
      /* Zbytek = co z tyče zůstane po všech kusech, rezervách i řezech. */
      t.zbytekM = r3(Math.max(0, t.kapacita - t.obsazeno));
      t.pouzitelny = t.zbytekM >= ZBYTEK_POUZITELNY_M;
      if(t.pouzitelny) zbytky.push({ tyc:t.cislo, delkaM:t.zbytekM, profil:g.profil });
      else odpadBm += t.zbytekM;
      /* Kus, který se do žádné skladové tyče nevejde, se musí objednat na
         míru (nebo nastavit). Při omezení délky kvůli dopravě se to stane
         i u kusů, které by se do třináctimetrové vešly — a to je potřeba
         říct, protože je to obchodní důsledek té volby (21. 8. 2026). */
      if(t.naMiru && !t.naMiruBSH) naMiruKusu++;
      var d = (t.naMiru && !t.celyMetr) ? ("na míru " + r2(t.kapacita)) : r2(t.kapacita);
      objednavka[oznaceni] = objednavka[oznaceni] || {};
      objednavka[oznaceni][d] = (objednavka[oznaceni][d]||0) + 1;
    });

    var nakupM3 = r3(prurez*nakupBm), cistaM3 = r3(prurez*cistaBm);
    celkem.cistaM3 += cistaM3; celkem.nakupM3 += nakupM3;
    celkem.cena += nakupM3 * cenaM3;
    celkem.tyci += plan.tyce.length; celkem.kusu += g.kusy.length;
    celkem.odpadM += odpadBm;
    celkem.rezervaM += g.kusy.length * rezervaM;
    zbytky.forEach(function(z){ celkem.zbytkuM += z.delkaM; });

    out.push({ druh:g.druh, kvalita:g.kvalita, profil:g.profil,
      oznaceni:oznaceni, zpusob:plan.zpusob, delkyTyci:plan.delkyTyci,
      cenaM3:cenaM3, kusu:g.kusy.length, tyci:plan.tyce.length,
      tyce:plan.tyce.map(function(t){
        return { cislo:t.cislo, delkaM:r2(t.kapacita), vyuzitoM:r2(t.obsazeno),
                 zbytekM:t.zbytekM, pouzitelny:!!t.pouzitelny,
                 naMiru:!!t.naMiru, celyMetr:!!t.celyMetr,
                 kusy:t.kusy.map(function(x){
                   return { znacka:x.znacka, typ:x.typ, delkaMm:x.delkaMm }; }) };
      }),
      zbytky:zbytky,
      cistaBm:r2(cistaBm), nakupBm:r2(nakupBm),
      cistaM3:cistaM3, nakupM3:nakupM3,
      cena: Math.round(nakupM3*cenaM3*100)/100,
      odpadProcent: cistaM3>0 ? r2(((nakupM3/cistaM3)-1)*100) : 0 });
  });

  out.sort(function(a,b){ return b.nakupM3-a.nakupM3; });
  if(naMiruKusu > 0)
    upozorneni.push(naMiruKusu + " kusů se nevejde do žádné skladové tyče"
      + (maxDelkaM ? (" při omezení na " + maxDelkaM + " m") : "")
      + " — musí se objednat na míru, nebo nastavit.");
  return {
    skupiny: out,
    upozorneni: upozorneni,
    naMiruKusu: naMiruKusu,
    objednavka: Object.keys(objednavka).map(function(k){
      return { oznaceni:k, delky:Object.keys(objednavka[k]).map(function(d){
        return { delka:d, ks:objednavka[k][d] }; }) }; }),
    rezervaMm: Math.round(rezervaM*1000),
    maxDelkaM: maxDelkaM || null,
    kusu: celkem.kusu, tyci: celkem.tyci,
    cistaM3: r3(celkem.cistaM3), nakupM3: r3(celkem.nakupM3),
    cena: Math.round(celkem.cena*100)/100,
    odpadM3: r3(celkem.nakupM3-celkem.cistaM3),
    odpadProcent: celkem.cistaM3>0
      ? r2(((celkem.nakupM3/celkem.cistaM3)-1)*100) : 0,
    zbytkuM: r2(celkem.zbytkuM), odrezM: r2(celkem.odpadM),
    rezervaCelkemM: r2(celkem.rezervaM)
  };
}

/* Dvě varianty vedle sebe: bez omezení délky proti „jen do 9 m". */
function narezVarianty(polozky, o){
  o = o || {};
  var a = narezovyPlan(polozky, o);
  var b = narezovyPlan(polozky, Object.assign({}, o, { maxDelkaM: o.mezDopravyM || 9 }));
  return {
    nejmeneProrezu: a,
    doMezeDopravy: b,
    mezM: o.mezDopravyM || 9,
    rozdilCena: Math.round((b.cena - a.cena)*100)/100,
    rozdilOdpadProcent: r2(b.odpadProcent - a.odpadProcent),
    /* Kolik tyčí přesahuje mez — právě ty potřebují dražší dopravu. */
    dlouhychTyci: a.skupiny.reduce(function(s,g){
      return s + g.tyce.filter(function(t){ return t.delkaM > (o.mezDopravyM||9)+1e-9; }).length; },0)
  };
}

/* Seznam druhů pro výběr v rozhraní. */
function seznamDruhu(){
  return Object.keys(DRUHY).map(function(k){
    return { kod:k, nazev:DRUHY[k].nazev, cenaM3:DRUHY[k].cenaM3,
             cenyOdber:DRUHY[k].cenyOdber||null,
             hustota:DRUHY[k].hustota, maxDelka:DRUHY[k].maxDelka||null,
             delky:DRUHY[k].delky||null, zpusob:DRUHY[k].zpusob,
             pozn:DRUHY[k].pozn||"" };
  });
}

/* ==========================================================================
   ROZPIS DÉLEK PRO OBJEDNÁVKU
   Tesař potřebuje před objednávkou vidět, kolik kterých délek je — jinak se
   nedá rozhodnout, jestli řezat na míru na pile, nebo brát standardní tyče
   KVH a dořezávat (zadání PENTI 14. 8. 2026).

   Vrací dvě varianty téhož a k nim čísla, podle kterých se dá vybrat:
     · NA MÍRU — pila uřeže přesně; platí se celé metry, zbytek je prořez
     · Z TYČÍ — standardní délky, kusy se skládají za sebe; zbytky jsou odřezky
   ========================================================================== */
function rozpisDelek(kusy, druhKod, profil){
  var k = (kusy||[]).filter(function(x){ return x>0; });
  if(!k.length) return null;
  var druh = DRUHY[druhKod] || DRUHY[VYCHOZI_DRUH];

  /* Skupiny stejných délek — na centimetr, jak se objednává. */
  var mapa = {};
  k.forEach(function(d){ var kl=d.toFixed(2); mapa[kl]=(mapa[kl]||0)+1; });
  var skupiny = Object.keys(mapa).map(Number).sort(function(a,b){ return b-a; })
    .map(function(d){ return { delka:d, ks:mapa[d.toFixed(2)], bm:r2(d*mapa[d.toFixed(2)]) }; });
  var bmCista = r2(k.reduce(function(a,b){ return a+b; },0));

  /* NA MÍRU — pila účtuje celé metry z každého kusu. */
  var naMiru = skupiny.map(function(g){
    var objednat = Math.ceil(g.delka - 1e-9);
    return { delka:g.delka, ks:g.ks, objednatDelka:objednat,
             bmObjednat:r2(objednat*g.ks), prorez:r2((objednat-g.delka)*g.ks) };
  });
  var naMiruBm = r2(naMiru.reduce(function(a,x){ return a+x.bmObjednat; },0));

  /* Z TYČÍ — jen u druhů, které se prodávají v tyčích. */
  var zTyci = null;
  var DLr = delkyProfilu(druh, profil && profil.b, profil && profil.h);   // profil nepovinný (b, h v mm)
  if(druh.zpusob === "tyce" && DLr && DLr.length){
    /* `slozDoTyci` vrací tyče s polem `kapacita` (objednaná délka), ne
       `delka` — na to jsem se napálil při prvním pokusu. */
    var tyce = slozDoTyci(k, DLr);
    var poDelce = {}, naMiru = 0;
    tyce.forEach(function(t){
      if(t.naMiru){ naMiru++; return; }            // kus delší než nejdelší tyč
      poDelce[t.kapacita] = (poDelce[t.kapacita]||0)+1;
    });
    var bmTyci = tyce.reduce(function(a,t){ return a+t.kapacita; },0);
    zTyci = {
      tyce: Object.keys(poDelce).map(Number).sort(function(a,b){ return b-a; })
              .map(function(d){ return { delka:d, ks:poDelce[d], bm:r2(d*poDelce[d]) }; }),
      naMiruKusu: naMiru,
      kusuCelkem: tyce.length, bmCelkem: r2(bmTyci),
      prorez: r2(bmTyci - bmCista),
      prorezProcent: Math.round((bmTyci - bmCista)/bmCista*1000)/10
    };
  }

  return {
    druh: druh.nazev, zpusob: druh.zpusob,
    skupiny: skupiny, ruznychDelek: skupiny.length, kusuCelkem: k.length,
    bmCista: bmCista,
    nejkratsi: r2(Math.min.apply(null,k)), nejdelsi: r2(Math.max.apply(null,k)),
    naMiru: { radky:naMiru, bmCelkem:naMiruBm,
              prorez:r2(naMiruBm-bmCista),
              prorezProcent:Math.round((naMiruBm-bmCista)/bmCista*1000)/10 },
    zTyci: zTyci,
    maxDelka: druh.maxDelka || null,
    prilis: druh.maxDelka ? skupiny.filter(function(g){ return g.delka > druh.maxDelka; }) : []
  };
}

var API={ spocitej:spocitej, slozDoTyci:slozDoTyci, seznamDruhu:seznamDruhu,
          vyskyProfilu:vyskyProfilu, VYSKY_ZAKLAD:VYSKY_ZAKLAD,
          rozpisDelek:rozpisDelek, delkyProfilu:delkyProfilu,
          narezovyPlan:narezovyPlan, narezVarianty:narezVarianty,
          KVALITY:KVALITY, ZBYTEK_POUZITELNY_M:ZBYTEK_POUZITELNY_M,
          DRUHY:DRUHY, VYCHOZI_DRUH:VYCHOZI_DRUH, PROREZ:PROREZ };
if(typeof module!=="undefined" && module.exports) module.exports=API;
global.PentiRezivo=API;
})(typeof window!=="undefined"?window:globalThis);
