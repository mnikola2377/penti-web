/* ==========================================================================
   KROV — KOTEVNÍ A SPOJOVACÍ PROSTŘEDKY
   --------------------------------------------------------------------------
   Z výkazu krovu spočítá, kolik vrutů, kotev a svorníků je potřeba.
   V původní kalkulačce se to neřešilo vůbec — spojovák byl paušál
   1 200 Kč za kubík dřeva, takže se s ním nedalo pracovat ani ho objednat.

   VRUTY: používají se tesařské vruty Hilti S-WWP-Z s TALÍŘOVOU HLAVOU.
   Hlava má vestavěnou podložku, takže nepotřebuje samostatnou, a spoj se
   nemusí šroubovat do kříže — na jeden styk stačí jeden vrut (potvrzeno
   PENTI 12. 8. 2026).

   DÉLKA VRUTU se navrhne podle profilů: vrut musí projít horním prvkem
   a zajet do spodního aspoň na šestinásobek svého průměru. Vybere se
   nejbližší delší z vyráběných délek.

   CENY jsou snímek ze skladu PENTI k 12. 8. 2026. Kde cena chybí, se
   v nabídce ukáže „doplnit" — nic se nevymýšlí.

   POZOR: počty vycházejí z BĚŽNÉ PRAXE, ne ze statického posudku spojů.
   U atypických zatížení rozhoduje statik.
   ========================================================================== */
(function(global){
"use strict";

/* Tesařské vruty — délky, které PENTI vede skladem, i s cenou.
   Sortiment S-WWP-Z jde od 60 do 580 mm v průměrech 6, 8 a 10 mm;
   tady jsou jen ty, na které máme cenu. */
var VRUTY = [
  { d:6, delka:100, cena:2.91,  kod:"S-WWP-S-6x100-Z" },
  { d:6, delka:120, cena:3.19,  kod:"INV-1774682842115-4" },
  { d:6, delka:140, cena:3.51,  kod:"INV-1774682842115-3" },
  { d:6, delka:160, cena:5.20,  kod:"IMP-1775217253253-2-sakd" },
  { d:6, delka:180, cena:7.22,  kod:"IMP-1775217253254-3-mxf0" },
  { d:8, delka:200, cena:9.98,  kod:"S-WWP-S-8x200/100-Z" },
  { d:8, delka:240, cena:15.05, kod:"IMP-1775217253254-5-s96e" },
  { d:8, delka:260, cena:16.88, kod:"IMP-1775217253254-4-ym7z" },
  { d:8, delka:280, cena:16.54, kod:"VRUT-DO" },          // SkladPRO 17. 11. 2026 (balení, 16,54 Kč/ks)
  { d:8, delka:320, cena:19.67, kod:"8x320" },
  { d:8, delka:360, cena:20.00, kod:"BERNER-8x360" },
  /* DELŠÍ VRUTY (PENTI 4. 10. 2026: „Delší vruty") — pro pojistku čepu
     sloupku u vysokých vaznic (320–360 mm, valby). Skladem zatím nejsou,
     cenu a kód doplní PENTI; do té doby řádek v nabídce „doplnit". */
  { d:8, delka:400, cena:null,  kod:null },
  { d:8, delka:440, cena:null,  kod:null }
];

/* Šrouby do betonu na kotvení pozednice — Hilti HUS4-H ⌀10. */
var KOTVY = [
  { delka:90,  cena:32.57, kod:"41693132_2293555" },
  { delka:130, cena:45.32, kod:"HUS4-H-10x130" },
  { delka:180, cena:64.17, kod:"HUS4-H-10x180" },
  { delka:240, cena:87.30, kod:"HUS4-H-10x240" },
  { delka:305, cena:108.00, kod:"HUS4-H-10x305" }
];

/* Závitová tyč M12 na spoj kleštin s krokví. Ve skladu je jako
   „Závitová tyč 4,8 M12 × 1 m" (kód GAAFA12100B), prodává se po metrech
   a řeže se na kusy. Ceny tyče, podložky a matice zadal PENTI 24. 9. 2026
   (tyč 90 Kč/m, podložka 2,50 Kč, matice 3 Kč) — ve skladu cenu nemají,
   podložky a matice tam zatím nejsou vůbec, proto jsou opsané tady.

   POZOR NA ZBYTEK: z metrové tyče vyjdou jen CELÉ kusy. Když je svorník
   dlouhý 260 mm, vyjdou tři a 22 cm se vyhodí — nedá se to sečíst na metry
   a vydělit. K tyči patří na každý konec velkoplošná podložka a matice. */
var ZAVITOVA_TYC = { prumer:12, delkaTyce:1.0, cena:90, kod:"GAAFA12100B",
                     nazev:"Závitová tyč 4,8 M12 × 1 m" };          // 90 Kč za metrovou tyč
var PODLOZKA = { cena:2.5, kod:null, nazev:"Podložka velkoplošná M12" };  // 2,50 Kč/ks
var MATICE   = { cena:3,   kod:null, nazev:"Matice M12" };                // 3 Kč/ks

/* Ceny kování pozednice mezi trámy u věšadla (PENTI 10. 10. 2026: „Úhelník
   40 Kč, vrut 0,35 Kč"). Ve skladu karty zatím nejsou — proto konstanta. */
var CENA_UHELNIK_105 = 40;      // Kč/ks — tesařský úhelník s prolisem 105×105×90
var CENA_VRUT_KOVANI = 0.35;    // Kč/ks — vrut do kování 5×40

var VYCHOZI = {
  roztecKotev: 1.0,        // m — nejdál po metru; přesnou rozteč dá statický posudek
  hloubkaDoBetonu: 75,     // mm — kotevní hloubka HUS4-H
  vrutuNaStyk: 1,          // tesařský vrut s talířovou hlavou stačí jeden
  /* U POZEDNICE může statika chtít víc — posudek na sání větru
     (21. 9. 2026) navrhne 1 nebo 2 vruty na styk; sem přijde ten počet.
     0 = vzít z posudku ve výkazu, jinak ruční zadání. */
  vrutuNaStykPozednice: 0,
  tyciNaKlestinu: 2,       // tyč prochází oběma kleštinami a krokví mezi nimi
  pridavekNaMatice: 40,    // mm — na podložky a matice na obou koncích
  /* Přepis cen pro jednu zakázku; null = vzít výchozí cenu z konstant výše. */
  cenaTyce: null,          // Kč za metrovou tyč
  cenaPodlozky: null,      // Kč/ks
  cenaMatice: null,        // Kč/ks
  /* cenaUhelniku (234 Kč) zrušeno 4. 10. 2026 — úhelník na sloupky se nepoužívá */
  vrutuNaSloupek: 1,       // pojistka čepu sloupek–vaznice: vrut seshora přes vaznici (PENTI 4. 10. 2026)
  /* ── DVA ÚDAJE, KTERÉ SE Z RUČNÍHO VÝKAZU NEDAJÍ ODVODIT ───────────
     Z nakreslené střechy je kalkulačka zná z řezu. Z tabulky opsané
     z projektu ne, tak je jde zadat. 0 = spočítat jako dosud. */
  podporKrokve: 0,         // přes kolik pozednic a vaznic krokev přechází
  pozedniceKusu: 0,        // z kolika kusů je pozednice složená
  /* Paušál za spojovací materiál: Kč za kubík dřeva v krovu.
     Používá se, jen když si ho člověk vybere (PENTI 6. 9. 2026). */
  pausalKcM3: 1100
};

function r2(x){ return Math.round((x||0)*100)/100; }

/* Vybere vrut: musí projít horním prvkem a zajet do spodního na 6× průměr.
   Zkouší nejdřív šestku, pak osmičku. */
function navrhniVrut(hHorniMm, hSpodniMm){
  var kandidati=[];
  [6,8].forEach(function(d){
    var potreba = hHorniMm + 6*d;                 // průnik do spodního prvku
    var nej=null;
    VRUTY.forEach(function(v){
      if(v.d!==d) return;
      if(v.delka + 1e-9 >= potreba && (!nej || v.delka<nej.delka)) nej=v;
    });
    if(nej) kandidati.push({ vrut:nej, potreba:potreba });
  });
  if(!kandidati.length){
    /* Nic ze skladu nestačí — řekneme, co by bylo potřeba. */
    var potreba8 = hHorniMm + 48;
    return { vrut:null, potrebaMm:Math.ceil(potreba8/20)*20,
             pozn:"potřeba vrut aspoň "+Math.ceil(potreba8/20)*20+" mm — skladem není" };
  }
  /* Z vyhovujících vezmeme nejlevnější. */
  /* vrut bez ceny (zatím neobjednaný) až za vruty s cenou */
  var cenaK = function(k){ return k.vrut.cena == null ? Infinity : k.vrut.cena; };
  kandidati.sort(function(a,b){ return cenaK(a)-cenaK(b); });
  return { vrut:kandidati[0].vrut, potrebaMm:Math.round(kandidati[0].potreba) };
}

/* Vybere kotvu do betonu podle výšky pozednice. */
var HLOUBKA_KOTVY_MIN = 55;   // mm — nejkratší kotevní hloubka HUS4-H 10 (h_nom 75/55/45 podle Hilti; 45 jen pro lehké)
function navrhniKotvu(hPozedniceMm, hloubka){
  var potreba = hPozedniceMm + (hloubka||VYCHOZI.hloubkaDoBetonu);
  var nej=null;
  KOTVY.forEach(function(k){ if(k.delka+1e-9>=potreba && (!nej||k.delka<nej.delka)) nej=k; });
  if(nej) return { kotva:nej, potrebaMm:Math.round(potreba) };
  /* VYSOKÁ POZEDNICE (2026.11.241 — PENTI 17. 11. 2026, pozednice čela 200/240):
     když plná hloubka nevyjde, vezme se nejdelší kotva skladem, pokud zajede
     do betonu aspoň HLOUBKA_KOTVY_MIN — kratší kotvení, nižší únosnost. */
  var max=null; KOTVY.forEach(function(k){ if(!max || k.delka>max.delka) max=k; });
  var hl = max ? max.delka - hPozedniceMm : 0;
  if(max && hl + 1e-9 >= HLOUBKA_KOTVY_MIN)
    return { kotva:max, potrebaMm:Math.round(potreba), kratsi:true, hloubkaMm:Math.round(hl),
             pozn:"kotva "+max.delka+" mm zajede do betonu jen "+Math.round(hl)+" mm (místo "+(hloubka||VYCHOZI.hloubkaDoBetonu)+") — nižší únosnost, ověří statik" };
  return { kotva:null, potrebaMm:Math.round(potreba),
           pozn:"potřeba kotva aspoň "+Math.round(potreba)+" mm — skladem není" };
}

function radek(nazev, ks, cena, kod, pozn){
  return { nazev:nazev, ks:ks,
           cenaKs:(cena==null?null:r2(cena)),
           cena:(cena==null?0:r2(ks*cena)),
           kod:kod||null,
           stav:(cena==null?"chybi_cena":"ok"),
           poznamka:pozn||"" };
}

/* ==========================================================================
   HLAVNÍ VÝPOČET
   vykaz — výsledek PentiKrov.spocitej
   ========================================================================== */
function spocitej(vykaz, vstupy){
  if(!vykaz || !vykaz.prvky || !vykaz.prvky.length) return null;
  var v = Object.assign({}, VYCHOZI, vstupy||{});
  /* Profily prvků: normálně je dá řez krovem. U výkazu opsaného z projektu
     řez není, ale rozměry jsou napsané u každého řádku — kalkulačka je
     z nich poskládá a pošle sem jako `profilyPrvku`. */
  var P = vykaz.profilyPrvku || (vykaz.rez && vykaz.rez.profily) || {};
  var najdi = function(kod){ return vykaz.prvky.filter(function(p){ return p.kod===kod; })[0]; };

  var radky=[], upozorneni=[];
  var hKrokve = (P.krokev && P.krokev.h) || 180;
  var hPozednice = (P.pozednice && P.pozednice.h) || 160;
  /* U věšadla pozednice není — vazné trámy leží přímo na zdech a krokve
     dosedají na okapovou a vrcholovou vaznici. Kotví se tedy trámy, ne
     pozednice, a popisy musí mluvit o tom, co tam doopravdy je. */
  var jeVesadlo = !!najdi("vazny_tram");
  var hVaznice = (P.vaznice && P.vaznice.h) || 200;

  /* --- KOTVENÍ POZEDNICE DO VĚNCE --- */
  var pozBm = 0;
  ["pozednice","pozednice_dolni","pozednice_horni"].forEach(function(k){
    var p=najdi(k); if(p) pozBm += p.bm;
  });
  if(jeVesadlo){
    /* Vazný trám se ke zdi kotví na obou koncích. Do zdiva jde jen svislá
       reakce, kotva drží hlavně proti vztlaku větru. */
    var tramy = najdi("vazny_tram");
    var stVes = (vykaz.statika && vykaz.statika.vesadlo) || null;
    var VG = (vykaz.rez && vykaz.rez.vesadlo) || null;
    if(tramy){
      var hTramu = (P.tram && P.tram.h) || 280;
      var nkT = navrhniKotvu(hTramu, v.hloubkaDoBetonu);
      /* Počet kotev na konec trámu podle posudku na sání (22. 9. 2026). */
      var naKonec = (stVes && stVes.kotveniTramu && stVes.kotveniTramu.kotevNaKonec) || 1;
      radky.push(radek(
        nkT.kotva ? ("Kotva vazného trámu Hilti HUS4-H ⌀10×"+nkT.kotva.delka) : "Kotva vazného trámu ⌀10",
        tramy.ks*2*naKonec, nkT.kotva?nkT.kotva.cena:null, nkT.kotva?nkT.kotva.kod:null,
        (2*naKonec)+" ks na vazbu ("+naKonec+" na každém konci trámu nad zdí); " + (nkT.kotva
          ? ("prochází trámem "+hTramu+" mm a "+(nkT.kratsi ? nkT.hloubkaMm+" mm (zkrácené kotvení)" : (v.hloubkaDoBetonu||75)+" mm")+" do betonu")
          : nkT.pozn)));
      if(!nkT.kotva || nkT.kratsi) upozorneni.push(nkT.pozn);   // i zkrácené kotvení (2026.11.241)
    }
    /* ── SPOJE VĚŠADLA (22. 9. 2026) ─────────────────────────────────────
       Pásovina třmenu se účtuje zvlášť v nabídce na bm; tady jsou svorníky,
       vruty a matice. M16 ve skladu není — řádek bez ceny, ať se nezapomene. */
    if(tramy && VG && VG.vesak){
      var vazeb = tramy.ks, bVes = (P.sloupekVes && P.sloupekVes.b) || VG.vesak.bMm || 180;
      var dTrmen = bVes + 2*8 + (v.pridavekNaMatice||40);
      radky.push(radek("Svorník M16 × "+dTrmen+" — třmen věšáku", vazeb*2, null, null,
        "2 ks na vazbu skrz věšák a obě ramena třmenu (pásovina 60×8); ve skladu není, doplnit"));
      /* Svorník hlavy jde VODOROVNĚ v rovině vazby skrz obě vzpěry a věšák
         (PENTI 9. 10. 2026) — délka z geometrie, zaokrouhlená na 10 mm nahoru.
         Dřív b věšáku + 40 (rovnoběžně s hřebenem jen skrz věšák). */
      var SHv = VG.vesak.svornikHlavy;
      var dHlava = SHv ? Math.ceil((SHv.delkaMm + (v.pridavekNaMatice||40))/10)*10 : (bVes + (v.pridavekNaMatice||40));
      radky.push(radek("Svorník M16 × "+dHlava+" — pojistka hlavy věšáku, skrz obě vzpěry", vazeb, null, null,
        "1 ks na vazbu, vodorovně v rovině vazby skrz levou vzpěru, věšák a pravou vzpěru; ve skladu není, doplnit"));
      radky.push(radek("Podložka velkoplošná M16", vazeb*3*2, null, null, "2 ks na svorník"));
      radky.push(radek("Matice M16", vazeb*3*2, null, null, "2 ks na svorník"));
      /* pata vzpěry: pojistka proti vysunutí ze zapuštění — 2 vruty skrz vzpěru do trámu */
      var hVz = (P.vzpera && P.vzpera.h) || 140;
      var nvZ = navrhniVrut(hVz, hTramu);
      radky.push(radek(
        nvZ.vrut ? ("Tesařský vrut S-WWP "+nvZ.vrut.d+"×"+nvZ.vrut.delka+" — pata vzpěry do trámu")
                 : "Tesařský vrut — pata vzpěry do trámu",
        vazeb*2*2, nvZ.vrut?nvZ.vrut.cena:null, nvZ.vrut?nvZ.vrut.kod:null,
        "2 ks na patu, 2 vzpěry na vazbu; pojistka zapuštění proti vysunutí"));
      /* okapová vaznice na trámu — vruty podle posudku, když nestačí, svorník M12 */
      var okap = najdi("vaznice_okap");
      if(okap && VG && VG.vazniceOkap && VG.vazniceOkap.mezi){
        /* POZEDNICE MEZI TRÁMY (PENTI 9. 10. 2026: „úhelník, kotvy a vruty").
           Každý kus pozednice leží na věnci a kotví se samostatně (aspoň 2
           kotvy, krátký kus u štítu 1), u každého trámu ho drží tesařský
           úhelník — z obou stran trámu, na obou okapech. */
        var roztecKP = (v.roztecKotev > 0 ? v.roztecKotev : 1);
        var kotevP = 0;
        (okap.kusy || []).forEach(function(L){
          kotevP += (L < 0.5) ? 1 : Math.max(2, Math.ceil(L / roztecKP));
        });
        var nkP = navrhniKotvu(hPozednice, v.hloubkaDoBetonu);
        radky.push(radek(
          nkP.kotva ? ("Kotva pozednice Hilti HUS4-H ⌀10×"+nkP.kotva.delka) : "Kotva pozednice ⌀10",
          kotevP, nkP.kotva?nkP.kotva.cena:null, nkP.kotva?nkP.kotva.kod:null,
          (okap.kusy||[]).length + " kusů pozednice mezi trámy, každý zvlášť (aspoň 2 kotvy, kus pod 0,5 m 1), nejdál po " + roztecKP + " m"
          + (nkP.kotva ? ("; prochází pozednicí "+hPozednice+" mm a "+(nkP.kratsi ? nkP.hloubkaMm+" mm (zkrácené kotvení)" : (v.hloubkaDoBetonu||75)+" mm")+" do betonu") : "")));
        if(!nkP.kotva || nkP.kratsi) upozorneni.push(nkP.pozn);   // i zkrácené kotvení (2026.11.241)
        var uhelniku = vazeb * 2 * 2;
        radky.push(radek("Úhelník tesařský s prolisem 105×105×90 — pozednice k vaznému trámu", uhelniku, CENA_UHELNIK_105, null,
          "2 ks u každého trámu na každém okapu (z obou stran trámu); cena PENTI " + CENA_UHELNIK_105 + " Kč/ks, skladová karta zatím není"));
        radky.push(radek("Vrut do kování 5×40 — úhelník pozednice/trám", uhelniku * 10, CENA_VRUT_KOVANI, null,
          "10 ks na úhelník (5 do pozednice, 5 do trámu); cena PENTI " + String(CENA_VRUT_KOVANI).replace(".", ",") + " Kč/ks, skladová karta zatím není"));
      } else if(okap){
        var krizeni = vazeb*2, hOk = (P.pozednice && P.pozednice.h) || 220;
        var spV = stVes && stVes.spojVaznice;
        if(spV && spV.nevyhovi){
          var naKrizeni = (spV.svornik && spV.svornik.pocet) || 1;
          var svorniku = krizeni*naKrizeni;
          var dl = hOk + hTramu - (VG.kampMm||30) + (v.pridavekNaMatice||40);
          var kusuZ = Math.floor(ZAVITOVA_TYC.delkaTyce*1000 / dl);
          var tyciV = kusuZ >= 1 ? Math.ceil(svorniku / kusuZ) : svorniku;
          radky.push(radek(ZAVITOVA_TYC.nazev+" — okapová vaznice k trámu",
            tyciV, (v.cenaTyce!=null ? v.cenaTyce : ZAVITOVA_TYC.cena), ZAVITOVA_TYC.kod,
            svorniku+" svorníků M12 po "+dl+" mm ("+naKrizeni+" na křížení; vruty na sání nestačí — "+spV.NEdKN+" kN na křížení)"));
          radky.push(radek(PODLOZKA.nazev, svorniku*2, (v.cenaPodlozky!=null ? v.cenaPodlozky : PODLOZKA.cena), PODLOZKA.kod, "2 ks na svorník"));
          radky.push(radek(MATICE.nazev, svorniku*2, (v.cenaMatice!=null ? v.cenaMatice : MATICE.cena), MATICE.kod, "2 ks na svorník"));
        } else {
          var nvO = navrhniVrut(hOk, hTramu), ksO = (spV && spV.vrutuNaStyk) || 2;
          radky.push(radek(
            nvO.vrut ? ("Tesařský vrut S-WWP "+nvO.vrut.d+"×"+nvO.vrut.delka+" — okapová vaznice k trámu")
                     : "Tesařský vrut — okapová vaznice k trámu",
            krizeni*ksO, nvO.vrut?nvO.vrut.cena:null, nvO.vrut?nvO.vrut.kod:null,
            ksO+" ks na křížení vaznice s trámem, "+krizeni+" křížení; vaznice sedí v kampu "+(VG.kampMm||30)+" mm"));
        }
      }
    }
  } else if(pozBm>0){
    /* KOLIK KOTEV.

       Dřív se braly hrubě: celková délka pozednice dělená roztečí. To ale
       neodpovídá tomu, jak se kotví ve skutečnosti — pozednice se skládá
       z kusů a KAŽDÝ KUS se kotví samostatně, aspoň dvěma kotvami (s jednou
       by se mohl pootočit) a krajní kotvy se odsazují od konce, aby dřevo
       nepraskalo. U domu 16 × 10 m to dělalo rozdíl 34 proti 46 kusům.

       Skutečné rozmístění spočítal modul krovu (a kreslí ho výrobní výkres),
       takže si ho tady jen převezmeme. Když ho nemáme — třeba když se modul
       výkresů nenačte — spadneme na starý odhad z délky. */
    var dily = vykaz.pozedniceDily;
    var roztec = (dily && dily.roztecKotevM > 0) ? dily.roztecKotevM
               : (vykaz.roztecKotevPozednice > 0 ? vykaz.roztecKotevPozednice
               : (v.roztecKotev > 0 ? v.roztecKotev : 1));
    var ks, jakPozn;
    if(dily && dily.kotev > 0){
      ks = dily.kotev;
      jakPozn = dily.behy.length + "× běh po " + dily.maxKusM + " m kusech, "
        + "každý kus zvlášť, nejdál po " + roztec + " m"
        + (dily.spoju ? "; v každém plátu 2 kotvy skrz oba kusy (místo svorníků)" : "");
    } else if(v.pozedniceKusu > 0){
      /* Ruční výkaz: víme, z kolika kusů je pozednice složená (počet kusů
         v řádku tabulky). Každý kus se kotví samostatně a aspoň dvěma
         kotvami — s jednou by se mohl pootočit. */
      var naKus = Math.max(2, Math.ceil((pozBm/v.pozedniceKusu)/roztec));
      ks = naKus * v.pozedniceKusu;
      jakPozn = v.pozedniceKusu + " kusů pozednice, každý zvlášť aspoň 2 kotvami, "
        + "nejdál po " + roztec + " m";
    } else {
      ks = Math.ceil(pozBm/roztec);
      jakPozn = "1 ks / " + roztec + " m pozednice";
    }
    /* Rohy pozednice: 1 kotva skrz oba rohové pláty (místo svorníku). */
    if(vykaz.rohyPozednic && vykaz.rohyPozednic.kotevCelkem > 0){
      ks += vykaz.rohyPozednic.kotevCelkem;
      jakPozn += "; + " + vykaz.rohyPozednic.kotevCelkem + " v rozích (skrz oba rohové pláty)";
    }
    var nk = navrhniKotvu(hPozednice, v.hloubkaDoBetonu);
    radky.push(radek(
      nk.kotva ? ("Kotva pozednice Hilti HUS4-H ⌀10×"+nk.kotva.delka) : "Kotva pozednice ⌀10",
      ks, nk.kotva?nk.kotva.cena:null, nk.kotva?nk.kotva.kod:null,
      jakPozn + "; " + (nk.kotva
        ? ("prochází pozednicí "+hPozednice+" mm a "+(nk.kratsi ? nk.hloubkaMm+" mm (zkrácené kotvení)" : (v.hloubkaDoBetonu||75)+" mm")+" do betonu")
        : nk.pozn)));
    if(!nk.kotva || nk.kratsi) upozorneni.push(nk.pozn);   // i zkrácené kotvení (2026.11.241)
  }

  /* --- KROKEV DO PODPOR ---
     Každá krokev se přišroubuje ke každé podpoře, přes kterou přechází:
     k pozednicím a ke každé vaznici. */
  var krokve = najdi("krokve");
  if(krokve){
    var podpor = 0, popisPodpor = [];
    if(vykaz.rez && vykaz.rez.pult){
      podpor = 2; popisPodpor.push("dolní a horní pozednice");
      if(najdi("vaznice_pult")){ podpor+=1; popisPodpor.push("mezilehlá vaznice"); }
    } else if(jeVesadlo){
      /* Krokev leží na okapové a na vrcholové vaznici — pozednice tu není
         (u varianty „mezi trámy" je okapovou podporou pozednice, 9. 10. 2026). */
      var vgK = (vykaz.rez && vykaz.rez.vesadlo) || null;
      podpor = 2; popisPodpor.push((vgK && vgK.vazniceOkap && vgK.vazniceOkap.mezi) ? "pozednice" : "okapová vaznice"); popisPodpor.push("vrcholová vaznice");
    } else {
      podpor = 1; popisPodpor.push("pozednice");
      if(najdi("vaznice_stred")){ podpor+=1; popisPodpor.push("středová vaznice"); }
      if(najdi("vaznice_vrchol")){ podpor+=1; popisPodpor.push("vrcholová vaznice"); }
    }
    /* Ruční zadání má přednost — z tabulky se nedá poznat, kolikrát krokev
       něco podpírá, když projekt vaznice nevypsal jako samostatné řádky. */
    if(v.podporKrokve > 0){ podpor = v.podporKrokve; popisPodpor = ["zadáno ručně"]; }
    /* Vrut musí zajet do toho, na čem krokev leží — u věšadla do vaznice. */
    var nv = navrhniVrut(hKrokve, jeVesadlo ? hVaznice : hPozednice);
    /* ── VRUTY NAVÍC U POZEDNICE PODLE POSUDKU NA SÁNÍ (21. 9. 2026) ──
       Statika krovu posoudí vytažení vrutu při sání větru a navrhne
       1 nebo 2 vruty na styk s pozednicí (a případně silnější vrut).
       Ruční zadání má přednost, jinak se bere z výkazu. Vaznic se to
       netýká — tam vrut zůstává jeden. */
    var posudek = vykaz.statika && vykaz.statika.spojKrokve;
    var naPozednici = (v.vrutuNaStykPozednice > 0) ? v.vrutuNaStykPozednice
                    : ((posudek && posudek.vrutuNaStyk) || (v.vrutuNaStyk||1));
    var pozednicNaKrokev = jeVesadlo ? 0 : ((vykaz.rez && vykaz.rez.pult) ? 2 : 1);
    if(v.podporKrokve > 0 && pozednicNaKrokev > podpor) pozednicNaKrokev = podpor;
    var navic = Math.max(0, naPozednici - (v.vrutuNaStyk||1)) * krokve.ks * pozednicNaKrokev;
    /* Když posudek chtěl silnější vrut, než je nejlevnější, vezme se ten. */
    if(posudek && posudek.d && nv.vrut && posudek.d > nv.vrut.d && !(v.vrutuNaStykPozednice > 0)){
      var silnejsi = null;
      VRUTY.forEach(function(x){ if(x.d===posudek.d && x.delka===posudek.delkaMm) silnejsi = x; });
      if(silnejsi) nv = { vrut:silnejsi, potrebaMm:nv.potrebaMm };
    }
    var ksV = krokve.ks * podpor * (v.vrutuNaStyk||1) + navic;
    radky.push(radek(
      nv.vrut ? ("Tesařský vrut S-WWP "+nv.vrut.d+"×"+nv.vrut.delka+" — krokev do podpory")
              : "Tesařský vrut — krokev do podpory",
      ksV, nv.vrut?nv.vrut.cena:null, nv.vrut?nv.vrut.kod:null,
      krokve.ks+" krokví × "+podpor+" podpor ("+popisPodpor.join(", ")+")"
      + (navic > 0 ? ("; u pozednice " + naPozednici + " ks na styk podle posudku na sání (+" + navic + " ks)") : "")
      + "; " + (nv.vrut ? ("projde krokví "+hKrokve+" mm a zajede "+(6*nv.vrut.d)+" mm do podpory")
                 : nv.pozn)));
    if(!nv.vrut) upozorneni.push(nv.pozn);
  }

  /* --- KLEŠTINY KE KROKVÍM ---
     Závitová tyč M12 prochází oběma kleštinami a krokví mezi nimi.
     Kupuje se po metrových tyčích a řeže se, takže se počítá potřebná
     délka a z ní počet tyčí. */
  var kl = najdi("klestiny");
  if(kl){
    var bKlestina = (P.klestina && P.klestina.b) || 60;
    var bKrokve   = (P.krokev && P.krokev.b) || 100;
    /* dvě kleštiny z obou stran + krokev mezi nimi + podložky a matice */
    var delkaKusu = 2*bKlestina + bKrokve + (v.pridavekNaMatice||40);
    /* JEDNOSTRANNÉ PÁRY (2026.11.240 — ručně smazaná jedna kleština): svorník
       jen přes jednu kleštinu a krokev, kratší. Bez údaje o párech postaru:
       kleštiny jsou 2 ks na pár krokví, spoj je dvojice kleštin ke krokvi. */
    var paru = (kl.paru != null) ? kl.paru : Math.round(kl.ks/2), jedno = Math.min(paru, kl.jednostranne || 0);
    var delkaKusu1 = bKlestina + bKrokve + (v.pridavekNaMatice||40);
    var styku = (paru - jedno) * 2, styku1 = jedno * 2;          // každá krokev v páru má svůj spoj
    var kusu  = styku * (v.tyciNaKlestinu||2), kusu1 = styku1 * (v.tyciNaKlestinu||2);
    /* Z metrové tyče vyjdou jen CELÉ kusy — zbytek se vyhodí. */
    var kusuZTyce = Math.floor(ZAVITOVA_TYC.delkaTyce*1000 / delkaKusu);
    var kusuZTyce1 = Math.floor(ZAVITOVA_TYC.delkaTyce*1000 / delkaKusu1);
    var tyci, zbytekMm=0;
    if(kusuZTyce < 1){
      tyci = kusu;   // kus je delší než tyč — na každý svorník jedna tyč a nastavovat
      upozorneni.push("Svorník má být "+delkaKusu+" mm, ale tyč je jen "
        +(ZAVITOVA_TYC.delkaTyce*1000)+" mm — je potřeba delší tyč.");
    } else {
      tyci = Math.ceil(kusu / kusuZTyce);
      zbytekMm = Math.round(ZAVITOVA_TYC.delkaTyce*1000 - kusuZTyce*delkaKusu);
    }
    if(kusu1 > 0) tyci += (kusuZTyce1 < 1) ? kusu1 : Math.ceil(kusu1 / kusuZTyce1);

    radky.push(radek(ZAVITOVA_TYC.nazev+" — svorník kleštin",
      tyci, (v.cenaTyce!=null ? v.cenaTyce : ZAVITOVA_TYC.cena), ZAVITOVA_TYC.kod,
      kusu+" svorníků po "+delkaKusu+" mm (2× kleština "+bKlestina+" + krokev "+bKrokve
      +" + "+(v.pridavekNaMatice||40)+" na podložky a matice); z jedné tyče "+kusuZTyce
      +" kusů, zbývá "+zbytekMm+" mm odpadu"
      + (kusu1 > 0 ? "; jednostranné páry (" + jedno + "): " + kusu1 + " svorníků po " + delkaKusu1 + " mm (kleština + krokev, jednostřižně)" : "")));
    kusu += kusu1;                                              // podložky a matice pro všechny
    /* Na každý svorník dvě velkoplošné podložky a dvě matice. */
    radky.push(radek(PODLOZKA.nazev, kusu*2,
      (v.cenaPodlozky!=null ? v.cenaPodlozky : PODLOZKA.cena), PODLOZKA.kod,
      "2 ks na svorník"));
    radky.push(radek(MATICE.nazev, kusu*2,
      (v.cenaMatice!=null ? v.cenaMatice : MATICE.cena), MATICE.kod,
      "2 ks na svorník"));
    if((v.cenaTyce!=null ? v.cenaTyce : ZAVITOVA_TYC.cena)==null)
      upozorneni.push("Závitová tyč M12 má ve skladu cenu 0 — doplnit, jinak se spoj kleštin nezapočítá.");
    if((v.cenaPodlozky!=null ? v.cenaPodlozky : PODLOZKA.cena)==null
       || (v.cenaMatice!=null ? v.cenaMatice : MATICE.cena)==null)
      upozorneni.push("Podložky a matice M12 ve skladu nejsou — doplnit ceny.");
  }

  /* ── NASTAVENÍ VAZNIC A POZEDNIC (30. 9. 2026) ─────────────────────
     Vaznice: šikmý hákový plát, pozednice: jednoduchý plát (penti-spoje.js,
     PENTI 30. 9. 2026) — vždy 2 svorníky M12 na spoj, kolmo k ploše plátu
     skrz oba kusy.
     Svorník = výška prvku + 40 mm na podložky a matice, řeže se ze
     závitové tyče. Do .120 se svorníky nastavení nepočítaly vůbec. */
  function svornikyNastaveni(popis, spoju, hMm, naSpojZadano, nazevSpoje){
    if(!(spoju > 0)) return;
    var naSpoj = naSpojZadano || (global.PentiSpoje ? global.PentiSpoje.hakovyPlat(hMm).svorniky : 2);
    var ks = spoju * naSpoj;
    var dl = hMm + (v.pridavekNaMatice||40);
    var kusuZ = Math.floor(ZAVITOVA_TYC.delkaTyce*1000 / dl);
    var tyci = kusuZ >= 1 ? Math.ceil(ks / kusuZ) : ks;
    radky.push(radek(ZAVITOVA_TYC.nazev+" — "+popis,
      tyci, (v.cenaTyce!=null ? v.cenaTyce : ZAVITOVA_TYC.cena), ZAVITOVA_TYC.kod,
      spoju+"× "+(nazevSpoje||"šikmý hákový plát")+", "+naSpoj+" "+(naSpoj===1?"svorník":"svorníky")
      +" na spoj = "+ks+" svorníků M12 po "+dl+" mm"));
    radky.push(radek(PODLOZKA.nazev, ks*2, (v.cenaPodlozky!=null ? v.cenaPodlozky : PODLOZKA.cena), PODLOZKA.kod, "2 ks na svorník"));
    radky.push(radek(MATICE.nazev, ks*2, (v.cenaMatice!=null ? v.cenaMatice : MATICE.cena), MATICE.kod, "2 ks na svorník"));
  }
  if(vykaz.deleniVaznic && vykaz.deleniVaznic.spoju > 0){
    var hDel = (P.stredVaznice && P.stredVaznice.h) || hVaznice;
    /* Prosté nosníky (1. 10. 2026): plát nad podporou drží 1 svislý
       svorník; hákový plát v nulovém momentu 2 svorníky. */
    var dvz = vykaz.deleniVaznic;
    /* 2026.10.193: přesný počet svorníků podle typu spoje (rovný plát 2,
       plát nad podporou 1, sraz na sedle 2); starší výkaz bez něj jako dřív */
    if(dvz.svornikuCelkem != null && dvz.svornikuCelkem !== dvz.spoju*(dvz.svornikuNaSpoj||2)){
      if(dvz.svornikuCelkem > 0)
        svornikyNastaveni("svorníky nastavení vaznic", dvz.svornikuCelkem, hDel, 1, dvz.nazevSpoje + " (" + dvz.spoju + " spojů)");
    } else
      svornikyNastaveni("svorníky nastavení vaznic", dvz.spoju, hDel, dvz.svornikuNaSpoj || 2, dvz.nazevSpoje);
    /* tupý sraz na sedle: 2 kramle přes sraz — karta ve skladu zatím není (cena chybí) */
    if(dvz.kramli > 0)
      radky.push(radek("Tesařská skoba (kramle) — sraz vaznice na sedle", dvz.kramli, null, null,
        dvz.sedel + "× sraz, 2 kramle na sraz (z obou boků)"));
  }
  /* Pozednice (spoj i roh) svorníky nemá — v plátu ji drží kotvy do
     věnce (PENTI 30. 9. 2026), ty jsou v řádku kotev pozednice. */

  /* ── SPOJ VAZNIC V ROHU ────────────────────────────────────────────
     (30. 9. 2026 vytaženo z bloku kleštin — dřív se svorníky rohu
     počítaly jen tehdy, když krov měl kleštiny.)
     Plát se jistí dvěma svorníky, spoj na tupo skrytým konektorem.
     Ceny konektorů zatím nejsou — doplní se z ceníku dodavatele. */
  var rohy = vykaz.rohyVaznic;
  if(rohy && rohy.pocet > 0){
    if(rohy.detail === "plat"){
      /* Od 30. 9. 2026 ze závitové tyče jako ostatní svorníky — dřív
         řádek neměl cenu a v nabídce svítil jako „chybí cena". */
      var hRoh = (P.stredVaznice && P.stredVaznice.h) || hVaznice;
      svornikyNastaveni("svorníky hákového rohového plátu vaznic", rohy.pocet, hRoh,
        rohy.svornikuCelkem / rohy.pocet, "hákový rohový plát vaznic (plát "+rohy.platDelkaMm+" mm)");
    } else if(rohy.konektor){
      radky.push(radek("Skrytý konektor "+rohy.konektor.rada+" "+rohy.konektor.kod,
        rohy.pocet, rohy.konektor.cena, rohy.konektor.kod,
        "spoj vaznic na tupo; R_d "+rohy.konektor.RdKN+" kN na reakci "
        +rohy.reakceKN+" kN (využití "+Math.round(rohy.konektor.vyuziti*100)+" %)"));
    }
  }

  /* --- HAMBÁLKY KE KROKVÍM ---
     Od 21. 9. 2026 podle statiky: hambálek je táhlo a spoj s krokví nese
     rozpěr, takže jde o SVORNÍKY (typově 3 × M12 s velkoplošnými
     podložkami), ne o tesařský vrut. Vrut zůstává jen jako záloha, když
     statika spoj nenavrhla (ruční výkaz bez řezu). */
  var ham = najdi("hambalky");
  if(ham){
    var spojH = vykaz.statika && vykaz.statika.spojKlestiny;
    var jeSvornik = spojH && !spojH.nevyhovi && spojH.celkem > 0;
    if(jeSvornik){
      var bHam = (P.hambalek && P.hambalek.b) || 100;
      /* oboustranné kleštiny: tyč prochází oběma kusy a krokví mezi nimi */
      var kusuH2 = (vykaz.rez && vykaz.rez.hambalek && vykaz.rez.hambalek.kusu) || 1;
      var delkaKusuH = kusuH2*bHam + bKrokveH() + (v.pridavekNaMatice||40);
      /* svorník prochází oběma kleštinami najednou — spojů je (kusy ÷ kusů
         na pár) × 2 konce, ne kusy × 2 */
      var kusuH = Math.round(ham.ks / kusuH2) * 2 * spojH.celkem;
      var kusuZTyceH = Math.floor(ZAVITOVA_TYC.delkaTyce*1000 / delkaKusuH);
      var tyciH = kusuZTyceH >= 1 ? Math.ceil(kusuH / kusuZTyceH) : kusuH;
      var poznH = kusuH+" svorníků M"+spojH.prumerMm+" po "+delkaKusuH+" mm ("+spojH.celkem+" na spoj podle statiky"
        +(spojH.typovy ? ", typový spoj PENTI" : "")+"; "
        +(kusuH2 === 2 ? ("2× kleština "+bHam) : ("hambálek "+bHam))+" + krokev "+bKrokveH()
        +" + "+(v.pridavekNaMatice||40)+" na podložky a matice)";
      if(spojH.prumerMm === 12){
        radky.push(radek(ZAVITOVA_TYC.nazev+" — svorník hambálku",
          tyciH, (v.cenaTyce!=null ? v.cenaTyce : ZAVITOVA_TYC.cena), ZAVITOVA_TYC.kod,
          poznH+"; z jedné tyče "+kusuZTyceH+" kusů"));
      } else {
        /* Sklad vede jen tyč M12 — silnější svorník se musí doplnit. */
        radky.push(radek("Svorník M"+spojH.prumerMm+" × "+delkaKusuH+" — hambálek", kusuH, null, null,
          poznH+"; ve skladu není, doplnit"));
      }
      radky.push(radek(PODLOZKA.nazev, kusuH*2,
        (v.cenaPodlozky!=null ? v.cenaPodlozky : PODLOZKA.cena), PODLOZKA.kod, "2 ks na svorník"));
      radky.push(radek(MATICE.nazev, kusuH*2,
        (v.cenaMatice!=null ? v.cenaMatice : MATICE.cena), MATICE.kod, "2 ks na svorník"));
      if((v.cenaTyce!=null ? v.cenaTyce : ZAVITOVA_TYC.cena)==null)
        upozorneni.push("Závitová tyč M12 má ve skladu cenu 0 — doplnit, jinak se spoj hambálku nezapočítá.");
    } else {
      var nvH = navrhniVrut((P.hambalek && P.hambalek.h)||160, hKrokve);
      radky.push(radek(
        nvH.vrut ? ("Tesařský vrut S-WWP "+nvH.vrut.d+"×"+nvH.vrut.delka+" — hambálek ke krokvi")
                 : "Tesařský vrut — hambálek ke krokvi",
        ham.ks*2*(v.vrutuNaStyk||1), nvH.vrut?nvH.vrut.cena:null, nvH.vrut?nvH.vrut.kod:null,
        "2 konce na hambálek, "+ham.ks+" hambálků"
        + (spojH && spojH.nevyhovi ? "; POZOR: statika spoj hambálku nenavrhla — " + spojH.popis : "")));
    }
  }
  function bKrokveH(){ return (P.krokev && P.krokev.b) || 100; }

  /* --- SLOUPKY A PÁSKY --- */
  var sloupku = 0;
  ["sloupky_vrchol","sloupky_stred","sloupky_pult"].forEach(function(k){
    var p=najdi(k); if(p) sloupku += p.ks;
  });
  /* SPOJ SLOUPEK–VAZNICE = ČEP (PENTI 4. 10. 2026, volba A).
     Dřív se tu na každý sloupek počítaly 2 úhelníky „tesařský 180×180"
     a 16 vrutů Rapi-Tec. PENTI: „To není kotevní úhelník, ale úhelník
     na rýsování tesařských spojů, v reálu na tyto spoje úhelníky
     nepoužíváme. Sloupek–vaznice je buď čepovaný spoj, nebo vlepená
     závitová tyč na lepidlo XEPOX." Čep je ve délce sloupku (výkaz
     krovu, penti-spoje.js) — spojovací materiál žádný, řádek se nepřidává.
     Vlepená tyč + XEPOX přibude jako volba, až budou známé rozměry
     a ceny.

     POJISTKA ČEPU (PENTI 4. 10. 2026): „Sloupky do vaznic kotvíme vruty
     seshora přes vaznici, je to pojistka čepu." Vrut jde svisle z horní
     plochy vaznice skrz vaznici do čela sloupku — délka = výška vaznice
     + zápustka 6 × d (navrhniVrut). Počet na sloupek: `vrutuNaSloupek`
     (výchozí 1). Jen dřevěné sloupky (ocelové jsou ve výkazu oceli). */
  var naSloupek = v.vrutuNaSloupek > 0 ? v.vrutuNaSloupek : 1;
  var hVazniceSl = { sloupky_stred: (P.stredVaznice && P.stredVaznice.h) || hVaznice,
                     sloupky_vrchol: hVaznice, sloupky_pult: hVaznice };
  var vrutySl = {};                                    // stejný vrut → jeden řádek
  ["sloupky_stred","sloupky_vrchol","sloupky_pult"].forEach(function(k){
    var p=najdi(k); if(!p || !(p.ks>0)) return;
    var nvS = navrhniVrut(hVazniceSl[k], (P.sloupek && P.sloupek.h) || 140);
    var klic = nvS.vrut ? nvS.vrut.kod : "x";
    if(!vrutySl[klic]) vrutySl[klic] = { nv:nvS, ks:0, sloupku:0, hV:hVazniceSl[k] };
    vrutySl[klic].ks += p.ks * naSloupek; vrutySl[klic].sloupku += p.ks;
  });
  Object.keys(vrutySl).forEach(function(klic){
    var q = vrutySl[klic], nvS = q.nv;
    radky.push(radek(
      nvS.vrut ? ("Tesařský vrut S-WWP "+nvS.vrut.d+"×"+nvS.vrut.delka+" — pojistka čepu sloupku")
               : "Tesařský vrut — pojistka čepu sloupku",
      q.ks, nvS.vrut?nvS.vrut.cena:null, nvS.vrut?nvS.vrut.kod:null,
      naSloupek+" ks na sloupek seshora přes vaznice "+q.hV+" mm do čela sloupku, "+q.sloupku+" sloupků"));
    if(!nvS.vrut) upozorneni.push(nvS.pozn);
  });
  var pasky = najdi("pasky_vrchol");
  if(pasky){
    var nvP = navrhniVrut((P.pasek && P.pasek.h)||120, 140);
    radky.push(radek(
      nvP.vrut ? ("Tesařský vrut S-WWP "+nvP.vrut.d+"×"+nvP.vrut.delka+" — pásek")
               : "Tesařský vrut — pásek",
      pasky.ks*2, nvP.vrut?nvP.vrut.cena:null, nvP.vrut?nvP.vrut.kod:null,
      "2 konce na pásek, "+pasky.ks+" pásků"));
  }

  /* ── OCELOVÉ RÁMY (29. 9. 2026): chemické kotvy, šrouby styku, svorníky
     vaznice, PTFE — z dílenského výkresu rámu. Ceny zatím nejsou (ve
     skladu nejsou) → „chybí cena", dokud je PENTI nedoplní. */
  var dilRam = vykaz && vykaz.statika && vykaz.statika.ram && vykaz.statika.ram.dilna;
  if(dilRam && dilRam.spojovaci){
    dilRam.spojovaci.forEach(function(sp){
      var cenaSp = (v.cenyRamu && v.cenyRamu[sp.nazev] != null) ? v.cenyRamu[sp.nazev] : null;
      radky.push(radek(sp.nazev + " — ocelový rám", sp.ks, cenaSp, null, sp.pozn));
    });
  }

  /* ── VIKÝŘE (krok 3d, 2026.11.210 — PENTI 8. 11. 2026): KOVOVÉ BOTKY ──
     Výměna do zesílené krokve 2 botky, každý kus přerušené krokve 1 botka
     do výměny. Počty stejně jako výkaz krovu (kus kratší než 30 cm není).
     Cena ve skladu zatím není → „chybí cena", doplní PENTI. */
  var KRv = vykaz && vykaz.krokveRovin;
  if(KRv){
    var bVym = 0, bKr = 0;
    Object.keys(KRv).forEach(function(c){
      (KRv[c].vikyre || []).forEach(function(d){
        bVym += 2 * d.vymeny.length;
        var maDol = d.vymeny.some(function(m){ return m.druh === "dolni"; });
        d.rezane.forEach(function(r){
          if(maDol && !d.naOkapu && (d.v0 - r.spodek) > 0.30) bKr++;
          if((r.vrch - d.v1) > 0.30 && !d.doVaznice) bKr++;     // na vaznici botka není (4a)
        });
      });
    });
    var pVym = najdi("vikyr_vymena_horni") || najdi("vikyr_vymena_dolni"),   /* bez horní (krokve pultu na vaznici, 4a) */ hK = (P.krokev && P.krokev.h) || hKrokve, bK = (P.krokev && P.krokev.b) || 100;
    if(bVym) radky.push(radek("Trámová botka " + (pVym ? pVym.b + "×" + pVym.h : "") + " — výměna vikýře do zesílené krokve", bVym, null, null,
      "2 ks na výměnu; vruty / kotevní hřebíky podle výrobce botky; ve skladu není, doplnit cenu"));
    if(bKr) radky.push(radek("Trámová botka " + bK + "×" + hK + " — přerušená krokev do výměny", bKr, null, null,
      "1 ks na každý kus krokve u otvoru vikýře; vruty / kotevní hřebíky podle výrobce botky; ve skladu není, doplnit cenu"));
    /* KROKVE PULTU LÍPNUTÉ SESHORA NA HLAVNÍ KROKVE (2026.11.233) — 2 vruty
       na krokev pultu; typ a cenu doplní PENTI */
    var vrutyKP = 0;
    Object.keys(KRv).forEach(function(c){
      (KRv[c].vikyre || []).forEach(function(d){
        var o = d.otvor || {};
        if(o.prilozene && o.osyPultu) vrutyKP += 2 * o.osyPultu.length;
      });
    });
    /* DÉLKA VRUTU (2026.11.241): vruty jdou šikmým koncem krokve pultu, kde
       nad hlavní krokví zbývají asi 2/3 její výšky, a zajedou do hlavní
       krokve na 6× průměr — stejné pravidlo jako ostatní tesařské vruty. */
    var pKP = najdi("vikyr_krokve_pultu"), hKP = (pKP && pKP.h) || hK;
    var tKP = Math.round(hKP * 2 / 3), nvKP = navrhniVrut(tKP, hK);
    if(vrutyKP) radky.push(radek(
      nvKP.vrut ? ("Tesařský vrut "+nvKP.vrut.d+"×"+nvKP.vrut.delka+" — krokev pultu vikýře lípnutá seshora na hlavní krokev")
                : "Vrut do dřeva — krokev pultu vikýře lípnutá seshora na hlavní krokev",
      vrutyKP, nvKP.vrut ? nvKP.vrut.cena : null, nvKP.vrut ? nvKP.vrut.kod : null,
      "2 ks na krokev pultu, přes šikmý konec (asi " + tKP + " mm dřeva krokve pultu " + (pKP ? pKP.b + "/" + pKP.h : "") + ") a " + (nvKP.vrut ? 6*nvKP.vrut.d : 48) + " mm do hlavní krokve"
      + (nvKP.vrut ? "" : "; " + nvKP.pozn)));
  }

  /* ── POZEDNICE NA ZDĚNÉM ČELE VIKÝŘE (etapa 4b, PENTI 8. 11. 2026) ──
     Stejná kotva jako u hlavní pozednice, aspoň 2 na kus, nejdál po
     rozteči kotev. */
  /* Každý vikýř může mít jiný profil pozednice čela (2026.11.228) → kotva
     podle výšky KAŽDÉHO profilu; stejné kotvy se sečtou do jednoho řádku
     (oprava 2026.11.241 — dřív jen podle prvního profilu, u 240 mm bez kotvy). */
  var pozVikVse = vykaz.prvky.filter(function(p){ return p.kod === "vikyr_pozednice_cela"; });
  if(pozVikVse.length){
    var roztecKV = (v.roztecKotev > 0 ? v.roztecKotev : 1), skupKV = {}, poradiKV = [];
    pozVikVse.forEach(function(pozVik){
      var kotevV = 0;
      (pozVik.kusy || []).forEach(function(L){ kotevV += Math.max(2, Math.ceil(L / roztecKV)); });
      var hV = pozVik.h || hPozednice, nkV = navrhniKotvu(hV, v.hloubkaDoBetonu);
      var kl = (nkV.kotva ? nkV.kotva.kod : "x") + "|" + (nkV.kratsi ? nkV.hloubkaMm : "");
      if(!skupKV[kl]){ skupKV[kl] = { nk:nkV, ks:0, kusu:0, profily:[] }; poradiKV.push(kl); }
      skupKV[kl].ks += kotevV; skupKV[kl].kusu += (pozVik.kusy || []).length;
      skupKV[kl].profily.push((pozVik.b || "?") + "/" + hV);
    });
    poradiKV.forEach(function(kl){
      var q = skupKV[kl], nkV = q.nk;
      radky.push(radek(
        nkV.kotva ? ("Kotva pozednice Hilti HUS4-H ⌀10×"+nkV.kotva.delka+" — zděné čelo vikýře") : "Kotva pozednice ⌀10 — zděné čelo vikýře",
        q.ks, nkV.kotva?nkV.kotva.cena:null, nkV.kotva?nkV.kotva.kod:null,
        "pozednice čela " + q.profily.join(", ") + " (kusů: " + q.kusu + "), aspoň 2 kotvy na kus, nejdál po " + roztecKV + " m"
        + (nkV.kotva && !nkV.kratsi ? "; prochází pozednicí a " + (v.hloubkaDoBetonu||75) + " mm do betonu" : "")
        + (nkV.pozn ? "; " + nkV.pozn : "")));
      if(nkV.pozn) upozorneni.push("Pozednice čela vikýře: " + nkV.pozn);
    });
  }

  var celkem=0, bezCeny=0;
  radky.forEach(function(r){ celkem+=r.cena; if(r.stav==="chybi_cena") bezCeny++; });

  return {
    radky: radky,
    celkem: r2(celkem),
    bezCeny: bezCeny,
    upozorneni: upozorneni,
    poznamka: "Počty vycházejí z běžné praxe, ne ze statického posudku spojů."
  };
}


/* ==========================================================================
   PAUŠÁL ZA SPOJOVACÍ MATERIÁL
   --------------------------------------------------------------------------
   Když se rozpis kusů dělat nechce (nebo výkaz z projektu neříká, co je
   který prvek zač), dá se spojovák ocenit jedním číslem za kubík dřeva.
   Výchozí sazbu potvrdilo PENTI 6. 9. 2026 a je zapsaná ve `VYCHOZI`
   výš (`pausalKcM3`); tady se schválně neopakuje, aby se nemohla
   rozejít s tou, podle které se počítá. Jde ji přepsat u zakázky.

   Počítá se z ČISTÉ kubatury krovu, ne z nakoupené — spoje jsou na dřevě,
   které na střeše zůstane, ne na prořezu.
   ========================================================================== */
function pausalem(m3, sazba){
  var s = (sazba==null ? VYCHOZI.pausalKcM3 : sazba);
  var kub = r2(m3||0);
  var cena = (s==null ? null : r2(kub*s));
  return {
    pausal: true,
    sazbaKcM3: s,
    radky: [ radek("Kotevní a spojovací prostředky — paušál", kub, s, null,
                   kub+" m³ čisté kubatury krovu × "+(s==null?"—":s)+" Kč/m³") ],
    celkem: (cena==null ? 0 : cena),
    bezCeny: (s==null ? 1 : 0),
    upozorneni: (s==null ? ["Sazba paušálu není vyplněná — spojovák se nezapočítá."] : []),
    poznamka: "Paušál za kubík dřeva — bez rozpisu kusů, nedá se z něj objednávat."
  };
}


/* ==========================================================================
   SPOJ VAZNIC V ROHU — skryté ocelové konektory Rothoblaas
   --------------------------------------------------------------------------
   Kde se stýkají vaznice dvou kolmých rovin (roh valby, úžlabí), jsou dvě
   možnosti (upřesněno PENTI 15. 8. 2026):

     PLÁT + SLOUPEK — vaznice se v rohu přeplátují a pod spoj přijde sloupek.
     Častější, tesařsky obvyklé, žádná ocel navíc.

     NA TUPO + OCELOVÝ PRVEK — vaznice se dotýkají na tupo a vloží se skrytý
     konektor, který přenese svislou reakci z jedné vaznice do druhé. V rohu
     pak není sloupek.

   KATALOG je z Rothoblaas „Spojovací prostředky pro dřevo" (vyd. 2024),
   kapitoly LOCK T MIDI (str. 28) a ALUMIDI (str. 78).

   `hjMm` a `bjMm` jsou nejmenší rozměry VEDLEJŠÍHO nosníku, do kterého se
   konektor frézuje — vaznice musí být aspoň taková. `RvkKN` je
   charakteristická únosnost ve smyku pro GL24h; návrhová se z ní počítá
   jako R_v,k · kmod / γ_M.

   CENY ZATÍM CHYBÍ — doplní se z ceníku dodavatele.
   ========================================================================== */
var SPOJE_VAZNIC = [
  /* LOCK T MIDI — skrytý závěsný spojovací prvek dřevo-dřevo, hliník
     EN AW-6005A, upevnění vruty LBS Ø7×80. */
  { kod:"LOCKT50135",  rada:"LOCK T MIDI", bMm:50,  hMm:135, bjMm:74,  hjMm:135, RvkKN:16.2, cena:null },
  { kod:"LOCKT50175",  rada:"LOCK T MIDI", bMm:50,  hMm:175, bjMm:74,  hjMm:175, RvkKN:21.6, cena:null },
  { kod:"LOCKT75175",  rada:"LOCK T MIDI", bMm:75,  hMm:175, bjMm:99,  hjMm:175, RvkKN:32.4, cena:null },
  { kod:"LOCKT75215",  rada:"LOCK T MIDI", bMm:75,  hMm:215, bjMm:99,  hjMm:215, RvkKN:48.3, cena:null },
  { kod:"LOCKT100215", rada:"LOCK T MIDI", bMm:100, hMm:215, bjMm:124, hjMm:215, RvkKN:64.5, cena:null },
  { kod:"LOCKT75240",  rada:"LOCK T MIDI", bMm:75,  hMm:240, bjMm:99,  hjMm:240, RvkKN:56.4, cena:null },
  { kod:"LOCKT100240", rada:"LOCK T MIDI", bMm:100, hMm:240, bjMm:124, hjMm:240, RvkKN:75.2, cena:null },
  { kod:"LOCKT125240", rada:"LOCK T MIDI", bMm:125, hMm:240, bjMm:149, hjMm:240, RvkKN:94.0, cena:null },
  { kod:"LOCKT75265",  rada:"LOCK T MIDI", bMm:75,  hMm:265, bjMm:99,  hjMm:265, RvkKN:64.5, cena:null },
  { kod:"LOCKT100265", rada:"LOCK T MIDI", bMm:100, hMm:265, bjMm:124, hjMm:265, RvkKN:85.9, cena:null },
  { kod:"LOCKT125265", rada:"LOCK T MIDI", bMm:125, hMm:265, bjMm:149, hjMm:265, RvkKN:107.4, cena:null },
  { kod:"LOCKT75290",  rada:"LOCK T MIDI", bMm:75,  hMm:290, bjMm:99,  hjMm:290, RvkKN:72.5, cena:null },
  { kod:"LOCKT100290", rada:"LOCK T MIDI", bMm:100, hMm:290, bjMm:124, hjMm:290, RvkKN:96.7, cena:null },
  { kod:"LOCKT125290", rada:"LOCK T MIDI", bMm:125, hMm:290, bjMm:149, hjMm:290, RvkKN:120.8, cena:null },
  /* ALUMIDI — skrytá hliníková deska, upevnění vruty LBS Ø5×60.
     Únosnosti platí pro variantu s vruty (ne s hřebíky LBA). */
  { kod:"ALUMIDI80",  rada:"ALUMIDI", hMm:80,  bjMm:120, hjMm:120, RvkKN:12.4, cena:null },
  { kod:"ALUMIDI120", rada:"ALUMIDI", hMm:120, bjMm:120, hjMm:160, RvkKN:24.6, cena:null },
  { kod:"ALUMIDI160", rada:"ALUMIDI", hMm:160, bjMm:120, hjMm:200, RvkKN:36.6, cena:null },
  { kod:"ALUMIDI200", rada:"ALUMIDI", hMm:200, bjMm:120, hjMm:240, RvkKN:54.8, cena:null },
  { kod:"ALUMIDI240", rada:"ALUMIDI", hMm:240, bjMm:120, hjMm:280, RvkKN:70.5, cena:null },
  { kod:"ALUMIDI280N",rada:"ALUMIDI", hMm:280, bjMm:140, hjMm:320, RvkKN:87.0, cena:null },
  { kod:"ALUMIDI320N",rada:"ALUMIDI", hMm:320, bjMm:140, hjMm:360, RvkKN:105.1, cena:null },
  { kod:"ALUMIDI360N",rada:"ALUMIDI", hMm:360, bjMm:160, hjMm:400, RvkKN:124.7, cena:null },
  { kod:"ALUMIDI400N",rada:"ALUMIDI", hMm:400, bjMm:160, hjMm:440, RvkKN:139.2, cena:null },
  { kod:"ALUMIDI440N",rada:"ALUMIDI", hMm:440, bjMm:160, hjMm:480, RvkKN:151.0, cena:null }
];

/* Návrhová únosnost konektoru: R_d = R_v,k · kmod / γ_M.
   Stejné kmod 0,8 a γ_M 1,3 jako u zbytku krovu. */
function unosnostSpoje(RvkKN, kmod, gammaM){
  return RvkKN * ((kmod==null?0.8:kmod) / (gammaM==null?1.3:gammaM));
}

/* Vybere nejmenší konektor, který na danou reakci stačí A vejde se do
   profilu vaznice. Vrací i všechny vyhovující, aby šlo porovnat řady. */
function navrhniSpojVaznic(o){
  var profil = o.profil || {b:160,h:220};
  var potreba = +o.reakceKN || 0;
  var vyhovujici = SPOJE_VAZNIC.filter(function(x){
    /* Konektor se frézuje do vaznice, takže se do ní musí vejít. */
    if(profil.b < x.bjMm - 0.5) return false;
    if(profil.h < x.hjMm - 0.5) return false;
    return unosnostSpoje(x.RvkKN, o.kmod, o.gammaM) >= potreba - 1e-9;
  }).map(function(x){
    return Object.assign({}, x, {
      RdKN: Math.round(unosnostSpoje(x.RvkKN, o.kmod, o.gammaM)*10)/10,
      vyuziti: Math.round(potreba/unosnostSpoje(x.RvkKN, o.kmod, o.gammaM)*100)/100
    });
  });
  /* Nejmenší z každé řady — ať je z čeho vybírat, ne jen jedna možnost. */
  var poRadach = {};
  vyhovujici.forEach(function(x){
    if(!poRadach[x.rada] || x.RdKN < poRadach[x.rada].RdKN) poRadach[x.rada] = x;
  });
  var nabidka = Object.keys(poRadach).map(function(k){ return poRadach[k]; })
    .sort(function(a,b){ return a.RdKN - b.RdKN; });
  return {
    reakceKN: Math.round(potreba*10)/10,
    profil: profil,
    nabidka: nabidka,
    doporuceny: nabidka[0] || null,
    vsechny: vyhovujici,
    /* Když nic nevyhoví, je to buď moc velká reakce, nebo moc malý profil. */
    duvod: nabidka.length ? "" : (SPOJE_VAZNIC.some(function(x){
        return profil.b >= x.bjMm-0.5 && profil.h >= x.hjMm-0.5; })
      ? "reakce " + (Math.round(potreba*10)/10) + " kN je nad únosnost všech "
        + "konektorů, které se do profilu " + profil.b + "/" + profil.h + " vejdou"
      : "do profilu " + profil.b + "/" + profil.h + " mm se žádný konektor "
        + "z katalogu nevejde — vaznice je na skrytý spoj nízká")
  };
}

var API={ spocitej:spocitej, pausalem:pausalem, navrhniVrut:navrhniVrut, navrhniKotvu:navrhniKotvu,
          navrhniSpojVaznic:navrhniSpojVaznic, unosnostSpoje:unosnostSpoje,
          VRUTY:VRUTY, KOTVY:KOTVY, VYCHOZI:VYCHOZI, SPOJE_VAZNIC:SPOJE_VAZNIC,
          ZAVITOVA_TYC:ZAVITOVA_TYC, PODLOZKA:PODLOZKA, MATICE:MATICE };
if(typeof module!=="undefined" && module.exports) module.exports=API;
global.PentiSpojovak=API;
})(typeof window!=="undefined"?window:globalThis);
