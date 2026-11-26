/* ==========================================================================
   OKAPOVÝ SYSTÉM — VÝPOČET MNOŽSTVÍ
   --------------------------------------------------------------------------
   Z tvaru střechy a zadaných svodů spočítá, kolik čeho je potřeba.
   Nic nekreslí, nečte z obrazovky a nezná ceny — díky tomu se dá spolehlivě
   otestovat a používá se stejně v profi kalkulačce i v poptávkovém formuláři.

   JAK SE POČÍTAJÍ POČTY U ŽLABU
   Obvod střechy se skládá z okapových a štítových hran. Žlab je jen na
   okapových. Když se obchází dokola, na každém rohu se pozná, o co jde:
     • okap → okap, zatáčí ven  = VNĚJŠÍ ROH žlabu
     • okap → okap, zatáčí dovnitř = VNITŘNÍ KOUT žlabu
     • okap → štít nebo štít → okap = ČELO (tady žlab končí)
   Souvislý úsek okapu mezi dvěma čely je jeden „běh" žlabu — a v každém
   běhu je o jednu spojku míň, než kolik je kusů žlabu.

   HÁKY: rozteč háků je dána roztečí vazníků nebo krokví, ale nejdál 1 m.
   Když jsou vazníky po 1,2 m, hák se kotví i mezi ně (potvrzeno PENTI
   12. 8. 2026), jinak by žlab neunesl sníh.

   SVODY: každý svod má vlastní kotlík, dvě kolena a délku = výška po žlab
   plus 1 m (výtok nad terénem a napojení). Objímka přibližně po 2 m,
   ke každé trn a hmoždinka.
   ========================================================================== */
(function(global){
"use strict";

/* Výchozí hodnoty. Dají se přepsat vstupem — tady jsou proto, aby modul
   fungoval i samostatně v testu. */
var VYCHOZI = {
  maxRoztecHaku: 1.0,     // m — dál od sebe háky nesmí být
  delkaKusuZlabu: 6.0,    // m — z jak dlouhých kusů se žlab skládá (kvůli spojkám)
  vyskaSvoduNad: 1.0,     // m — přídavek k výšce svodu (výtok + napojení)
  roztecObjimek: 2.0,     // m
  kolenNaSvod: 2          // ks
};

function n(x){ var v=parseFloat(x); return isNaN(v)?0:v; }
function r2(x){ return Math.round((x||0)*100)/100; }

/* ==========================================================================
   ROHY, KOUTY, ČELA A BĚHY ŽLABU
   --------------------------------------------------------------------------
   `body`  = vrcholy obrysu střechy v pořadí dokola (pole [x,y])
   `stity` = čísla HRAN, které jsou štítové; hrana j vede z bodu j do j+1
   Obrys musí být proti směru hodinových ručiček — tak ho engine vrací.
   ========================================================================== */
function obrysOkapu(body, stity){
  var b = Array.isArray(body) ? body : [];
  var jeStit = {};
  (stity||[]).forEach(function(i){ jeStit[i]=true; });
  var poc = b.length;

  var out = { rohy:0, kouty:0, cela:0, behy:[], uzavreny:false };

  /* Míň než tři hrany = jednoduchý tvar (např. pultová střecha):
     jeden běh žlabu se dvěma konci. */
  if(poc < 3) return { rohy:0, kouty:0, cela:2, behy:[], uzavreny:false };

  /* Nejdřív rohy, kouty a čela — vrchol po vrcholu. */
  for(var i=0;i<poc;i++){
    var predchozi = (i-1+poc)%poc;
    var okapPred = !jeStit[predchozi];
    var okapPo   = !jeStit[i];

    if(okapPred && okapPo){
      /* Zatáčí žlab ven, nebo dovnitř? Rozhodne směr otáčení. */
      var a=b[predchozi], c=b[i], d=b[(i+1)%poc];
      var smer = (c[0]-a[0])*(d[1]-c[1]) - (c[1]-a[1])*(d[0]-c[0]);
      if(smer >  0.001) out.rohy++;
      else if(smer < -0.001) out.kouty++;
      /* Skoro rovný přechod = žádný roh, jen pokračování žlabu. */
    } else if(okapPred !== okapPo){
      out.cela++;
    }
  }

  /* Teď délky souvislých běhů žlabu — kvůli spojkám. */
  var delkaHrany = function(j){
    var p=b[j], q=b[(j+1)%poc];
    return Math.sqrt(Math.pow(q[0]-p[0],2) + Math.pow(q[1]-p[1],2));
  };
  var okapoveHrany = [];
  for(var j=0;j<poc;j++) if(!jeStit[j]) okapoveHrany.push(j);

  if(okapoveHrany.length === poc){
    /* Celý obvod je okap (valbová střecha) — jeden uzavřený běh bez čel. */
    var celkem=0;
    for(var k=0;k<poc;k++) celkem += delkaHrany(k);
    out.behy=[celkem];
    out.cela=0;
    out.uzavreny=true;
  } else {
    /* Začneme za štítem, ať běh nerozpůlíme uprostřed. */
    var start=0;
    while(start<poc && !jeStit[start]) start++;
    var aktualni=0;
    for(var m=1;m<=poc;m++){
      var idx=(start+m)%poc;
      if(jeStit[idx]){
        if(aktualni>0){ out.behy.push(aktualni); aktualni=0; }
      } else {
        aktualni += delkaHrany(idx);
      }
    }
    if(aktualni>0) out.behy.push(aktualni);
  }
  return out;
}

/* ==========================================================================
   HLAVNÍ VÝPOČET
   geom   — z výpočetního jádra: { okap, eave, gable }
   vstupy — { roztecKrokvi, svody:[{vyska}] nebo {pocetSvodu, vyskaSvodu},
              delkaKusuZlabu, maxRoztecHaku }
   ========================================================================== */
function spocitej(geom, vstupy){
  var g = geom || {}, v = vstupy || {};
  var N = Object.assign({}, VYCHOZI, {
    maxRoztecHaku:  v.maxRoztecHaku  != null ? n(v.maxRoztecHaku)  : VYCHOZI.maxRoztecHaku,
    delkaKusuZlabu: v.delkaKusuZlabu != null ? n(v.delkaKusuZlabu) : VYCHOZI.delkaKusuZlabu
  });

  var okapBm = n(g.okap);
  /* Ruční výkaz výměr nemá obrys — rohy, kouty, čela a běhy přijdou
     hotové z tabulky (`g.obrysOkapu`, modul penti-rucni-vykaz.js, 6. 9. 2026). */
  var o = g.obrysOkapu ? g.obrysOkapu : obrysOkapu(g.eave, g.gable);

  /* --- HÁKY ---
     KOLIK HÁKŮ, TOLIK KROKVÍ. Hák se šroubuje ke krokvi, takže jich je
     na každém běhu žlabu přesně tolik, kolik je pod ním krokví — a ty
     počítá krov jako `ceil(šířka / rozteč)`. Stejné pravidlo se proto
     používá i tady, aby obojí dávalo totéž číslo (PENTI 24. 8. 2026).

     KAŽDÝ BĚH ZVLÁŠŤ. Do 24. 8. 2026 se dělila CELKOVÁ délka okapu
     a zaokrouhlovalo se jednou přes celou střechu. Na Blišicích to dělalo
     ceil(26,67 / 1,0) = 27 háků místo 2 × ceil(13,334 / 1,0) = 28 —
     tedy o hák míň, než je krokví. Nahlásil PENTI.

     Rozteč nesmí přesáhnout povolené maximum, i kdyby krokve byly řidší. */
  var roztecKonstrukce = n(v.roztecKrokvi) || N.maxRoztecHaku;
  var roztecHaku = Math.min(roztecKonstrukce, N.maxRoztecHaku);
  if(roztecHaku <= 0) roztecHaku = N.maxRoztecHaku;
  var behyProHaky = o.behy.length ? o.behy : (okapBm>0 ? [okapBm] : []);
  var haky = behyProHaky.reduce(function(s, delka){
    return s + Math.ceil(delka / roztecHaku);
  }, 0);

  /* --- SPOJKY ---
     V otevřeném běhu je o jednu spojku míň než kusů žlabu (konce jsou čela).
     U žlabu vedeného dokola (valbová střecha) se spojí i poslední kus
     s prvním, takže spojek je přesně tolik, kolik je kusů. */
  var behy = o.behy.length ? o.behy : (okapBm>0 ? [okapBm] : []);
  var spojky = behy.reduce(function(s, delka){
    var kusu = Math.ceil(delka / N.delkaKusuZlabu);
    return s + (o.uzavreny ? kusu : Math.max(0, kusu - 1));
  }, 0);

  /* --- SVODY ---
     Buď seznam svodů s vlastní výškou, nebo počet a jedna společná výška. */
  var svody = [];
  if(Array.isArray(v.svody)) {
    svody = v.svody.map(function(s){ return n(s && s.vyska!=null ? s.vyska : s); });
  } else if(v.pocetSvodu) {
    for(var i=0;i<Math.round(n(v.pocetSvodu));i++) svody.push(n(v.vyskaSvodu));
  }

  var svodBm=0, objimky=0;
  svody.forEach(function(vyska){
    var delka = n(vyska) + N.vyskaSvoduNad;
    svodBm += delka;
    objimky += Math.max(1, Math.ceil(delka / N.roztecObjimek));
  });
  var kotliky = svody.length;

  return {
    /* žlab a jeho díly */
    okap_bm:        r2(okapBm),
    haky_zlab_ks:   haky,
    cela_zlab_ks:   o.cela,
    rohy_zlab_ks:   o.rohy,
    kouty_zlab_ks:  o.kouty,
    spojky_zlab_ks: spojky,
    /* svody */
    kotlik_ks:     kotliky,
    svod_bm:       r2(svodBm),
    koleno72_ks:   kotliky * N.kolenNaSvod,
    objimka_ks:    objimky,
    trn_ks:        objimky,
    hmozdinka_ks:  objimky,
    /* podklad pro kontrolu na obrazovce */
    rozpad: {
      roztecHaku: roztecHaku,
      behuZlabu: behy.length,
      delkyBehu: behy.map(r2),
      delkaKusuZlabu: N.delkaKusuZlabu,
      svodyDelky: svody.map(function(x){ return r2(n(x)+N.vyskaSvoduNad); })
    }
  };
}

/* Kolik svodů dává smysl, když je uživatel nezadá.
   Pravidlo z praxe: jeden svod zhruba na 12 m okapu, nejméně jeden na
   každý souvislý běh žlabu. */
function navrhniPocetSvodu(geom){
  var g=geom||{};
  var o=obrysOkapu(g.eave, g.gable);
  var behy = o.behy.length ? o.behy : (n(g.okap)>0 ? [n(g.okap)] : []);
  return behy.reduce(function(s,d){ return s + Math.max(1, Math.round(d/12)); }, 0);
}

var API={ spocitej:spocitej, obrysOkapu:obrysOkapu, navrhniPocetSvodu:navrhniPocetSvodu, VYCHOZI:VYCHOZI };
if(typeof module!=="undefined" && module.exports) module.exports=API;
global.PentiOkapy=API;
})(typeof window!=="undefined"?window:globalThis);
