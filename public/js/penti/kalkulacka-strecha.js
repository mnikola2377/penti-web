
/* ==========================================================================
   KALKULÁTOR KOMPLETNÍ STŘECHY
   --------------------------------------------------------------------------
   CO TATO STRÁNKA DĚLÁ
   Zákazník zadá tvar, sklon, krytinu, skladbu a okapy — a dostane VÝKAZ
   SPOTŘEBY: kolik tašek, krajovek, hřebenáčů, latí, fólie, žlabů a svodů.

   PROČ TU NENÍ CENA
   Rozhodnutí PENTI z 28. 8. 2026: cenu ukazuje jen kalkulačka vazníků.
   U kompletní střechy jich vstupuje do hry příliš mnoho (dostupnost stavby,
   co už zákazník má, termín) a orientační číslo by dělalo víc škody než
   užitku. Množství je přitom údaj, který zákazník jinde nedostane.

   ODKUD SE BEROU ČÍSLA
   Ze stejných modulů jako profi rozpočet — `penti-engine.js` (geometrie,
   kladečák, laťování), `penti-okapy.js`, poskládané v `penti-strecha-web.js`.
   Tady se nic nepočítá znovu; kdyby ano, rozešlo by se to s nabídkou.
   ========================================================================== */
document.addEventListener('DOMContentLoaded', function () {

  var wizard = document.getElementById('calc-wizard');
  if (!wizard) return;

  /* Chybějící modul se nesmí přejít mlčky. Prázdný výkaz vypadá jako
     „nic nepotřebujete" — a to je horší než viditelná chyba. */
  function jadroChybi() {
    return !window.PentiEngine || !window.PentiStrechaWeb
        || !window.PENTI_KATALOG_WEB;
  }

  /* ══════════════════════════════════════════════════════════════════
     TVARY PŮDORYSU — stejné jako v kalkulačce vazníků
     ------------------------------------------------------------------
     Názvy rozměrů jsou schválně lidské („dolní rameno – délka"), ne
     písmena z technického listu. U L, T, U a lichoběžníku se ptáme na
     KONCE RAMEN: jestli je konec štít, nebo valba, jádro samo neurčí
     a je v tom velký rozdíl v ploše. */
  var TVARY = [
    { kod: 'obdelnik',    nazev: 'Obdélník',
      pole: [['A', 'Délka domu – venkovní rozměr zdiva (m)', 12], ['B', 'Šířka domu – venkovní rozměr zdiva (m)', 9]] },
    { kod: 'ctverec',     nazev: 'Čtverec',
      pole: [['A', 'Strana domu – venkovní rozměr zdiva (m)', 10]] },
    { kod: 'L',           nazev: 'Tvar L',
      pole: [['L1', 'Dolní rameno – délka, venkovní zdivo (m)', 13], ['W1', 'Dolní rameno – šířka, venkovní zdivo (m)', 8],
             ['L2', 'Boční rameno – délka, venkovní zdivo (m)', 11], ['W2', 'Boční rameno – šířka, venkovní zdivo (m)', 6]],
      konce: [1, 4] },
    { kod: 'T',           nazev: 'Tvar T',
      pole: [['A', 'Hlavní část – délka, venkovní zdivo (m)', 14], ['TW', 'Hlavní část – šířka, venkovní zdivo (m)', 7],
             ['SW', 'Noha – šířka, venkovní zdivo (m)', 6], ['SL', 'Noha – délka, venkovní zdivo (m)', 6]],
      konce: [0, 3, 5] },
    { kod: 'U',           nazev: 'Tvar U',
      pole: [['UA', 'Základna – šířka, venkovní zdivo (m)', 14], ['UD', 'Základna – hloubka, venkovní zdivo (m)', 6],
             ['WW', 'Křídlo – šířka, venkovní zdivo (m)', 5], ['WL', 'Křídlo – délka navíc, venkovní zdivo (m)', 6]],
      konce: [2, 6] },
    { kod: 'lichobeznik', nazev: 'Lichoběžník',
      pole: [['A', 'Dolní šířka, venkovní zdivo (m)', 12], ['C', 'Horní šířka, venkovní zdivo (m)', 8], ['B', 'Hloubka, venkovní zdivo (m)', 7]],
      konce: [1, 3] }
  ];
  /* JEN TŘI. Jádro jiný tvar střechy neumí a neznámý by tiše počítalo
     jako sedlovou — výkaz by vyšel celý, jen pro jinou střechu.
     Do 30. 8. 2026 tu byla „polovalba" a „stanová", které jádro nezná.

     STANOVÁ SE NEZADÁVÁ: vznikne sama ze čtvercového půdorysu s valbou
     a stejnými sklony a přesahy. Z jiného půdorysu vzniknout nemůže,
     takže volba by jen mátla. Když si ji zákazník takhle zadá, napíše
     se mu to (viz `poznamkaKeStrese`). */
  var STRECHY = [
    { kod: 'sedlova', nazev: 'Sedlová' },
    { kod: 'valbova', nazev: 'Valbová' },
    { kod: 'pultova', nazev: 'Pultová' }
  ];
  var tvarPudorysu = 'obdelnik';
  var tvarStrechy  = 'sedlova';
  var konceStitu   = {};
  var ulozeneRozmery = {};

  function tvarInfo(kod) {
    for (var i = 0; i < TVARY.length; i++) if (TVARY[i].kod === (kod || tvarPudorysu)) return TVARY[i];
    return TVARY[0];
  }

  var cislo = function (id, vychozi) {
    var e = document.getElementById(id);
    var x = e ? parseFloat(String(e.value).replace(',', '.')) : NaN;
    return isFinite(x) && x > 0 ? x : vychozi;
  };
  var vyber = function (id) {
    var e = document.getElementById(id);
    return e ? e.value : '';
  };
  var cis = function (x, des) {
    return Number(x).toFixed(des == null ? 1 : des).replace('.', ',');
  };

  /* Přepínače tvaru — kreslí se z pole, ne ručně v HTML, aby nešly
     rozejít se seznamem, se kterým se počítá. */
  function tlacitka(boxId, seznam, aktivni, klik) {
    var box = document.getElementById(boxId);
    if (!box) return;
    box.innerHTML = seznam.map(function (t) {
      var je = t.kod === aktivni;
      return '<button type="button" data-kod="' + t.kod + '" '
        + 'style="padding:9px 16px;border:1px solid ' + (je ? 'var(--gold)' : 'var(--ink-20)')
        + ';background:' + (je ? 'var(--gold)' : 'transparent') + ';color:var(--ink);'
        + 'font-family:Purista,serif;font-weight:600;font-size:.75rem;letter-spacing:.1em;'
        + 'text-transform:uppercase;cursor:pointer">' + t.nazev + '</button>';
    }).join('');
    box.querySelectorAll('[data-kod]').forEach(function (b) {
      b.addEventListener('click', function () { klik(b.getAttribute('data-kod')); });
    });
  }

  function vykresliTvary() {
    tlacitka('w-strechy', STRECHY, tvarStrechy, function (k) {
      tvarStrechy = k; vykresliTvary(); vykresliKonce(); vykresliKrov(); spocitej();
    });
    tlacitka('w-tvary', TVARY, tvarPudorysu, function (k) {
      tvarPudorysu = k; vykresliTvary(); vykresliRozmery(); vykresliKonce(); spocitej();
    });
    poznamkaKeStrese();
  }

  /* Stanová střecha není volba, je to výsledek: čtvercový půdorys +
     valba + stejné sklony. Když si ji zákazník takhle zadá, řekneme mu,
     co mu vyjde — ať neváhá, jestli ji vůbec umíme. */
  function poznamkaKeStrese() {
    var box = document.getElementById('strecha-pozn');
    if (!box) return;
    var stanova = (tvarPudorysu === 'ctverec' && tvarStrechy === 'valbova');
    box.textContent = stanova
      ? 'Čtvercový půdorys s valbou a stejnými sklony dává stanovou střechu — '
        + 'všechny čtyři roviny se sbíhají do jednoho vrcholu.'
      : '';
    box.style.display = stanova ? 'block' : 'none';
  }

  /* Rozměrová pole podle tvaru. Hodnoty se drží podle názvu pole —
     přepnutí tvaru tak nesmaže, co už zákazník napsal. */
  function vykresliRozmery() {
    var box = document.getElementById('w-rozmery');
    if (!box) return;
    box.innerHTML = tvarInfo().pole.map(function (p) {
      var hodnota = (ulozeneRozmery[p[0]] != null) ? ulozeneRozmery[p[0]] : p[2];
      return '<div class="wizard-field-group">'
        + '<label class="wizard-label" for="w-dim-' + p[0] + '">' + p[1] + '</label>'
        + '<input class="wizard-input" type="number" min="1" max="80" step="0.1" '
        + 'id="w-dim-' + p[0] + '" value="' + hodnota + '"></div>';
    }).join('');
    box.querySelectorAll('input').forEach(function (i) {
      var klic = i.id.replace('w-dim-', '');
      i.addEventListener('input', function () {
        ulozeneRozmery[klic] = i.value; vykresliSchema(klic);
      });
      i.addEventListener('focus', function () { vykresliSchema(klic); });
      i.addEventListener('blur',  function () { vykresliSchema(null); });
    });
    vykresliSchema(null);
  }

  /* Okótované schéma půdorysu. Kreslí ho stejný modul jako výslednou
     střechu a rozměry bere z právě vyplněných polí — schéma tak nemůže
     ukazovat jiný tvar, než se počítá. */
  function vykresliSchema(zvyraznit) {
    var box = document.getElementById('w-schema');
    if (!box || !window.PentiKresbaWeb) return;
    var dims = {};
    tvarInfo().pole.forEach(function (p) { dims[p[0]] = cislo('w-dim-' + p[0], p[2]); });
    box.innerHTML = window.PentiKresbaWeb.schema(tvarPudorysu, dims,
        { sirka: 280, vyska: 210, zvyraznit: zvyraznit })
      || '<div style="color:var(--muted);font-size:.8rem">Schéma se nepodařilo vykreslit.</div>';
  }

  /* Konce ramen — štít, nebo valba. U valbové a stanové střechy se
     neptáme: tam žádný štít není. */
  function vykresliKonce() {
    var box = document.getElementById('w-konce');
    var obal = document.getElementById('w-konce-box');
    var konce = tvarInfo().konce;
    if (!box || !obal) return;
    var maSmysl = konce && tvarStrechy !== 'valbova';
    if (!maSmysl) { obal.style.display = 'none'; box.innerHTML = ''; return; }
    obal.style.display = 'block';
    box.innerHTML = konce.map(function (k, i) {
      if (konceStitu[k] == null) konceStitu[k] = true;
      return '<label style="cursor:pointer;font-size:.9rem">'
        + '<input type="checkbox" data-konec="' + k + '" ' + (konceStitu[k] ? 'checked' : '')
        + ' style="accent-color:var(--gold);margin-right:8px"> '
        + 'Konec ' + (i + 1) + ' je štít <span style="color:var(--muted)">'
        + '(bez zaškrtnutí valba)</span></label>';
    }).join('');
    box.querySelectorAll('input').forEach(function (i) {
      i.addEventListener('change', function () {
        konceStitu[+i.getAttribute('data-konec')] = i.checked; spocitej();
      });
    });
  }

  /* ══════════════════════════════════════════════════════════════════
     KATALOG KRYTIN A OKAPŮ
     ------------------------------------------------------------------
     Data jsou ve `penti-katalog-web.js`, který se generuje z interního
     ceníku — jsou v něm JEN NÁZVY. Výrobce → model → povrch → barva se
     řetězí: změna výše přenastaví vše níž, aby nemohla vzniknout
     kombinace, která neexistuje. */
  function katalog() { return window.PENTI_KATALOG_WEB || { krytiny: [], okapy: { materialy: [] } }; }

  function naplnSelect(id, polozky, hodnota) {
    var s = document.getElementById(id);
    if (!s) return;
    s.innerHTML = polozky.map(function (p) {
      return '<option value="' + p.kod + '">' + p.nazev + '</option>';
    }).join('');
    if (hodnota) s.value = hodnota;
    if (!s.value && polozky.length) s.value = polozky[0].kod;
  }

  /* Model podle kódu — hledá se v celém katalogu, tašky i plech. */
  function modelInfo(kod) {
    var k = katalog().krytiny;
    for (var i = 0; i < k.length; i++) if (k[i].kod === kod) return k[i];
    return null;
  }
  function tvarInfoKrytiny(kod) {
    var t = katalog().tvary || [];
    for (var i = 0; i < t.length; i++) if (t[i].kod === kod) return t[i];
    return t[0] || null;
  }

  var tvarKrytiny = null;      // doplní se z katalogu při prvním vykreslení

  /* Tvar → materiál → model. Změna výše přenastaví vše níž, aby nemohla
     vzniknout kombinace, která neexistuje (třeba plochá plechová). */
  function vykresliKrytinu(uroven) {
    var tvary = katalog().tvary || [];
    if (!tvary.length) return;
    if (!tvarKrytiny || !tvarInfoKrytiny(tvarKrytiny)) tvarKrytiny = tvary[0].kod;

    if (uroven === 'vse' || uroven === 'tvar') {
      tlacitka('w-tvary-krytin', tvary, tvarKrytiny, function (k) {
        tvarKrytiny = k;
        vykresliKrytinu('tvar');
        if (document.getElementById('calc-result').classList.contains('show')) spocitej();
      });
      var popis = document.getElementById('w-tvar-popis');
      if (popis) popis.textContent = tvarInfoKrytiny(tvarKrytiny).popis || '';
      naplnSelect('w-material', tvarInfoKrytiny(tvarKrytiny).materialy);
    }

    if (uroven !== 'model' && uroven !== 'povrch') {
      var mat = vyber('w-material');
      naplnSelect('w-model', katalog().krytiny.filter(function (m) {
        return m.tvar === tvarKrytiny && m.material === mat;
      }));
    }

    var m = modelInfo(vyber('w-model'));
    var povrchy = m ? m.povrchy : [];
    if (uroven !== 'povrch') naplnSelect('w-povrch', povrchy);
    var p = null;
    for (var i = 0; i < povrchy.length; i++) if (povrchy[i].kod === vyber('w-povrch')) p = povrchy[i];
    naplnSelect('w-barva', (p && p.barvy) || []);
  }

  function vykresliOkapy(uroven) {
    var mat = katalog().okapy.materialy || [];
    if (uroven === 'vse') naplnSelect('w-okapmat', mat);
    var m = null;
    for (var i = 0; i < mat.length; i++) if (mat[i].kod === vyber('w-okapmat')) m = mat[i];
    var barvy = (m && m.barvy) || [];
    /* Barvy okapů nemají kód, jen název a odstín — klíčem je název. */
    if (uroven !== 'barva') {
      naplnSelect('w-okapbarva', barvy.map(function (b) { return { kod: b.nazev, nazev: b.nazev }; }));
    }
    /* Velikost žlabu (RŠ) — z katalogu podle materiálu; výchozí 330/333. */
    if (uroven !== 'barva' && uroven !== 'rs') {
      var vel = (m && m.velikosti) || [];
      var predtim = vyber('w-okaprs');
      naplnSelect('w-okaprs', vel.map(function (v) {
        return { kod: String(v.rs), nazev: 'RŠ ' + v.rs + ' mm' + (v.prumer ? ' (žlab ⌀' + v.prumer + ')' : '') };
      }));
      var el = document.getElementById('w-okaprs');
      if (el) {
        var kody = vel.map(function (v) { return String(v.rs); });
        el.value = kody.indexOf(predtim) >= 0 ? predtim : (kody[0] || '');
      }
    }
    var vzor = document.getElementById('w-okapvzorek');
    var vybrana = null;
    for (var j = 0; j < barvy.length; j++) if (barvy[j].nazev === vyber('w-okapbarva')) vybrana = barvy[j];
    if (vzor) {
      vzor.innerHTML = vybrana && vybrana.hex
        ? '<span style="display:inline-block;width:22px;height:22px;vertical-align:middle;'
          + 'border:1px solid var(--ink-20);background:' + vybrana.hex + '"></span>'
          + '<span style="margin-left:10px;font-size:.85rem;color:var(--muted)">'
          + vybrana.nazev + '</span>'
        : '';
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     SNĚHOVÁ OBLAST
     ------------------------------------------------------------------
     clima-maps.info vrací s_k v kPa, ČSN mluví o oblastech I–VIII.
     Zákazník opíše, co viděl na mapě, a nepřevádí. Když napíše kPa,
     přepneme výběr — a NAPÍŠEME, na co jsme ho přepnuli. Změnit to
     mlčky by znamenalo, že počítáme s něčím jiným, než co má na
     obrazovce. */
  function hlidejSnih() {
    var pole = document.getElementById('w-sk');
    var sel = document.getElementById('w-snih');
    var pozn = document.getElementById('snih-pozn');
    if (!pole || !sel || !pozn || !window.PentiStrechaWeb) return;
    if (!pole.value.trim()) { pozn.style.display = 'none'; return; }
    var oblast = window.PentiStrechaWeb.oblastZeSk(String(pole.value).replace(',', '.'));
    if (!oblast) {
      pozn.textContent = 'Hodnotě „' + pole.value + '" nerozumím — zadejte s_k v kPa, '
        + 'třeba 1,2. Zatím počítáme s vybranou oblastí.';
      pozn.style.display = 'block';
      return;
    }
    sel.value = String(oblast);
    pozn.textContent = 's_k ' + String(pole.value).replace('.', ',') + ' kPa odpovídá '
      + oblast + '. sněhové oblasti — přepnuli jsme na ni.';
    pozn.style.display = 'block';
  }

  /* ══════════════════════════════════════════════════════════════════
     VÝPOČET
     ══════════════════════════════════════════════════════════════════ */
  function sesbirej() {
    var dims = {};
    tvarInfo().pole.forEach(function (p) { dims[p[0]] = cislo('w-dim-' + p[0], p[2]); });
    var konce = {};
    (tvarInfo().konce || []).forEach(function (k) { konce[k] = !!konceStitu[k]; });
    var m = modelInfo(vyber('w-model'));
    return {
      fp: tvarPudorysu, roof: tvarStrechy, dims: dims,
      konceStitu: (tvarInfo().konce ? konce : null),
      slope: cislo('w-sklon', 35),
      oOkap: cislo('w-okap', 0.5),
      oStit: cislo('w-stit', 0.3),
      snehovaOblast: parseInt(vyber('w-snih'), 10) || 2,
      model: vyber('w-model'),
      modelNazev: m ? m.nazev : '',
      tvarKrytiny: tvarKrytiny,
      material: vyber('w-material'),
      povrch: vyber('w-povrch'),
      barva: vyber('w-barva'),
      zaklop: vyber('w-zaklop'),
      okapMaterial: vyber('w-okapmat'),
      okapBarva: vyber('w-okapbarva'),
      okapRs: parseInt(vyber('w-okaprs'), 10) || ((katalog().okapy || {}).vychoziRs || 330),
      nosna: vyber('w-nosna'),
      vyuziti: vyber('w-vyuziti'),
      rozsah: vyber('w-rozsah'),
      /* Krov — má smysl, jen když si ho zákazník vybral jako nosnou
         konstrukci. Jinak se pole ani nezobrazují. */
      soustava: vyber('w-soustava'),
      roztecKrokvi: cislo('w-roztec-krokvi', 0.9),
      druhReziva: vyber('w-rezivo'),
      nadezdivka: cislo('w-nadezdivka', 0) || 0,
      vitrOblast: parseInt(vyber('w-vitr'), 10) || 2,
      tridaDreva: vyber('w-trida'),
      /* Stropní nosníky se zatím jen poptávají — viz komentář u pole. */
      stropniNosniky: !!(document.getElementById('w-strop') || {}).checked,
      stropRoztec: cislo('w-strop-roztec', 1),
      stropUlozeni: vyber('w-strop-ulozeni'),
      /* Skupiny, které zákazník opravdu poptává. Doplní se až
         ve výkazu — před prvním výpočtem žádné neznáme. */
      skupiny: null
    };
  }

  /* ══════════════════════════════════════════════════════════════════
     KROV
     ------------------------------------------------------------------
     Pole se zobrazí, jen když si zákazník vybral klasický krov. Nabídka
     soustav se řídí tvarem střechy — modul kombinaci „pultová střecha ×
     nepultová soustava" odmítne a vrátí prázdný výkaz, takže ji nemá
     smysl nabízet.

     Profily se NEZADÁVAJÍ. Navrhne je statika, stejným modulem jako
     v profi rozpočtu. Kdyby se použily výchozí, na velkém domě by dřevo
     chybělo a výkaz by přitom vypadal hotově. */
  function chceKrov() { return vyber('w-nosna') === 'krov'; }

  /* ══════════════════════════════════════════════════════════════════
     POVINNÉ BEDNĚNÍ
     ------------------------------------------------------------------
     Vazníky nad vytápěným prostorem nesou i strop, takže střecha musí
     být celoplošně bedněná prkny (PENTI 30. 8. 2026). Není to volba,
     tak se ani nenabízí jako volba: pole se přepne na prkna, zamkne
     a NAPÍŠE SE PROČ. Zamknout bez vysvětlení by vypadalo jako porucha.

     Pravidlo samo je ve sdíleném modulu, aby ho výpočet držel i tehdy,
     když poptávka přijde jinudy než přes tenhle formulář. */
  function hlidejBedneni() {
    var sel = document.getElementById('w-zaklop');
    var pozn = document.getElementById('zaklop-pozn');
    if (!sel || !pozn || !window.PentiStrechaWeb) return;
    var pov = window.PentiStrechaWeb.bedneniPovinne({
      nosna: vyber('w-nosna'), vyuziti: vyber('w-vyuziti')
    });
    if (pov.povinne) {
      sel.value = pov.typ;
      sel.disabled = true;
      pozn.textContent = pov.duvod;
      pozn.style.display = 'block';
    } else {
      sel.disabled = false;
      pozn.style.display = 'none';
    }
  }

  function vykresliKrov() {
    var box = document.getElementById('w-krov-box');
    if (!box) return;
    box.style.display = chceKrov() ? 'block' : 'none';
    if (!chceKrov() || !window.PentiKrovWeb) return;

    var sel = document.getElementById('w-soustava');
    var puvodni = sel ? sel.value : '';
    var moznosti = window.PentiKrovWeb.soustavyProStrechu(tvarStrechy);
    /* „Poraďte" je první volba — většina lidí soustavu nezná a je lepší
       jim ji vybrat a napsat proč, než je nutit hádat. */
    naplnSelect('w-soustava',
      [{ kod: 'poradte', nazev: 'Nevím — poraďte mi' }].concat(moznosti));
    /* Předchozí volbu držíme, pokud k novému tvaru střechy sedí. */
    if (puvodni && moznosti.some(function (m) { return m.kod === puvodni; })) {
      sel.value = puvodni;
    }
  }

  /* Výkaz krovu jako další skupina vedle Krytiny, Laťování a Okapů. */
  function krovDoVykazu(geo, z, s) {
    if (!chceKrov()) return null;
    if (!window.PentiKrovWeb) {
      s.potize.push('Výpočet krovu se nenačetl — dřevo ve výkazu chybí.');
      return null;
    }
    var k;
    try {
      k = window.PentiKrovWeb.vykaz(geo, {
        soustava: z.soustava, roztecKrokvi: z.roztecKrokvi,
        druhReziva: z.druhReziva, nadezdivkaM: z.nadezdivka,
        snehOblast: z.snehovaOblast, vitrOblast: z.vitrOblast,
        tridaDreva: z.tridaDreva,
        stitoveHrany: (z.roof === 'valbova') ? [] : [1, 3]
      });
    } catch (e) {
      /* Krov se nespočítal — nesmí to zmizet. Seznam bez dřeva vypadá
         jako hotový výkaz, jen o něco kratší. */
      s.potize.push('Krov se nepodařilo spočítat: '
        + String(e.message || e).replace('PENTI: ', ''));
      return null;
    }
    /* Krov jde na začátek — staví se odspoda. */
    s.polozky = k.polozky.concat(s.polozky);
    s.skupiny = ['Krov'].concat(s.skupiny);
    k.potize.forEach(function (u) { s.potize.push(u); });
    return k;
  }

  /* Shrnutí krovu pod výkazem — soustava, kubatura, posudek. */
  function vykresliShrnutiKrovu(k) {
    var box = document.getElementById('res-krov');
    if (!box) return;
    if (!k) { box.style.display = 'none'; box.innerHTML = ''; return; }
    var st = k.statika;
    box.style.display = 'block';
    box.innerHTML =
        '<div class="t-label c-gold" style="margin:28px 0 12px">Krov</div>'
      + radekShrnuti('Soustava', k.soustavaNazev)
      + (k.doporuceni ? '<div style="font-size:.82rem;color:var(--gold);padding:4px 0 10px">'
          + 'Vybrali jsme ji za vás: ' + k.doporuceni.proc + '</div>' : '')
      + radekShrnuti('Krokví', k.krokvi + ' ks po ' + cis(k.roztecKrokviSkutecna, 2) + ' m')
      + radekShrnuti('Výška střechy', cis(k.vyskaStrechy) + ' m')
      + radekShrnuti('Řezivo celkem', cis(k.m3, 2) + '\u00A0m³ · ' + k.kusu + '\u00A0kusů')
      + (st ? radekShrnuti('Statický posudek',
            (st.vyhovuje ? 'vyhoví' : 'NEVYHOVÍ') + ' · využití '
            + Math.round(st.maxVyuziti * 100) + ' %'
            + (st.rozhoduje ? ' (' + st.rozhoduje + ')' : '')) : '')
      /* Tohle tam MUSÍ být. Vytisknutý posudek z webu nikdo nesmí
         předložit na stavebním úřadě. */
      + '<div class="info-box" style="margin-top:16px;border-color:'
        + (st && !st.vyhovuje ? 'var(--gold)' : 'var(--border-l)') + '"><p>'
      + (st && !st.vyhovuje
          ? '<strong>Pozor:</strong> s běžnými profily to nevychází — '
            + 'navrhli jsme nejsilnější dostupné a i tak je konstrukce přetížená. '
            + 'Ozvěte se nám, řešení existuje (lepené nosníky, jiná soustava). '
          : '')
      + k.statikaPoznamka + '</p></div>';
  }

  function radekShrnuti(popis, hodnota) {
    return '<div style="display:flex;justify-content:space-between;gap:16px;'
      + 'padding:8px 0;border-bottom:1px solid var(--border-l)">'
      + '<span style="color:rgba(247,245,241,.72)">' + popis + '</span>'
      + '<span style="font-family:Purista,serif;font-weight:600;color:var(--cream);'
      + 'text-align:right">' + hodnota + '</span></div>';
  }

  function spocitej() {
    var z = sesbirej();
    var nadpis = document.getElementById('res-nadpis');
    var pod = document.getElementById('res-podnadpis');
    var vykaz = document.getElementById('res-vykaz');
    var potize = document.getElementById('res-potize');
    if (!vykaz) return;

    if (jadroChybi()) {
      chyba('Výpočet se nenačetl', 'Zkuste stránku načíst znovu, nebo nám zavolejte — '
        + 'rádi to spočítáme za vás.');
      return;
    }

    try {
      var geo = window.PentiEngine.geometrieStrechy({
        fp: z.fp, dims: z.dims, roof: z.roof, slope: z.slope,
        oOkap: z.oOkap, oStit: z.oStit,
        planeSlopes: {}, endState: z.konceStitu || {}, pultDir: 'dolu'
      });
      var s = window.PentiStrechaWeb.spotreba(geo, {
        model: z.model, snehovaOblast: z.snehovaOblast, zaklop: z.zaklop
      });

      nadpis.textContent = (z.modelNazev || 'Krytina') + ' · ' + cis(s.plochaStrechy) + ' m²';
      pod.textContent = tvarInfo().nazev + ' · ' + strechaNazev(z.roof)
        + ' · sklon ' + cis(z.slope, 0) + '° · ' + z.snehovaOblast + '. sněhová oblast'
        + (z.rozsah === 'jen_material' ? ' · poptáváte jen materiál' : '');

      /* Krov se přidá jako další skupina výkazu — před krytinu, protože
         se staví odspoda. */
      var krov = krovDoVykazu(geo, z, s);
      vykresliShrnutiKrovu(krov);

      vykaz.innerHTML = tabulkaVykazu(s);

      /* Co se nepovedlo, musí být VIDĚT. Seznam bez tašek vypadá jako
         hotový výkaz, jen o něco kratší. */
      if (s.potize.length) {
        potize.innerHTML = '<div class="info-box" style="border-color:var(--gold)">'
          + '<p><strong>Něco se nepodařilo spočítat:</strong><br>'
          + s.potize.join('<br>') + '<br>Doplníme to ručně z projektu.</p></div>';
        potize.style.display = 'block';
      } else {
        potize.style.display = 'none';
      }

      var vym = nakresli(geo, z);
      ulozDoFormulare(z, s, vym);
    } catch (e) {
      chyba('Nepodařilo se spočítat',
        (e && e.message ? e.message.replace('PENTI: ', '') + ' ' : '')
        + 'Zkuste prosím zkontrolovat zadané rozměry, nebo nám zavolejte.');
      if (window.console) console.error('PENTI kalkulátor střechy:', e);
    }
  }

  function chyba(nadpisText, textPozn) {
    document.getElementById('res-nadpis').textContent = nadpisText;
    document.getElementById('res-podnadpis').textContent = textPozn;
    document.getElementById('res-vykaz').innerHTML = '';
    document.getElementById('res-kresba').innerHTML = '';
    document.getElementById('res-hrany').innerHTML = '';
    document.getElementById('res-potize').style.display = 'none';
  }

  function strechaNazev(kod) {
    for (var i = 0; i < STRECHY.length; i++) if (STRECHY[i].kod === kod) return STRECHY[i].nazev.toLowerCase();
    return kod;
  }

  /* ══════════════════════════════════════════════════════════════════
     CO Z VÝKAZU ZÁKAZNÍK POPTÁVÁ
     ------------------------------------------------------------------
     Ne každý chce všechno. Někdo shání jen krytinu, okapy si pořídí
     jinde. U každé skupiny je proto zaškrtávátko.

     Rozhodnutí drží tenhle objekt, ne značky na obrazovce — tabulka se
     překresluje při každé změně zadání a zaškrtnutí by se ztratilo.
     Skupina, o které ještě nic nevíme, se bere jako poptávaná: ubírat
     má zákazník vědomě, ne omylem. */
  var poptavaneSkupiny = {};

  function poptavaSe(sk) {
    return poptavaneSkupiny[sk] !== false;
  }

  /* Výkaz po skupinách. Množství vpravo, aby se daly porovnat řádky
     pod sebou. */
  function tabulkaVykazu(s) {
    var h = '';
    s.skupiny.forEach(function (sk) {
      var chce = poptavaSe(sk);
      h += '<label style="display:flex;align-items:center;gap:10px;'
        + 'margin:24px 0 10px;cursor:pointer">'
        + '<input type="checkbox" data-skupina="' + sk + '" ' + (chce ? 'checked' : '')
        + ' style="accent-color:var(--gold);width:16px;height:16px">'
        + '<span class="t-label" style="color:' + (chce ? 'var(--gold)' : 'var(--muted)') + '">'
        + sk + '</span>'
        + (chce ? '' : '<span style="font-size:.75rem;color:var(--muted)">nepoptávám</span>')
        + '</label>';
      /* Odškrtnutá skupina nezmizí — jen zešedne. Kdyby zmizela, nebylo
         by poznat, že se něco odečetlo, a zákazník by si myslel, že to
         kalkulačka nespočítala. */
      s.polozky.filter(function (p) { return p.skupina === sk; }).forEach(function (p) {
        /* Podpoložka („z toho…") se neobjednává — je součástí položky nad
           sebou. Odsadí se a ztlumí, ať ji nikdo nesečte s ostatními. */
        h += '<div style="display:flex;justify-content:space-between;gap:16px;'
          + 'padding:' + (p.podpolozka ? '4px 0 4px 22px' : '8px 0') + ';'
          + 'border-bottom:1px solid var(--border-l);'
          + (p.podpolozka ? 'font-size:.85rem;' : '')
          + 'opacity:' + (chce ? (p.podpolozka ? '.6' : '1') : '.35') + '">'
          + '<span style="color:rgba(247,245,241,.72)">' + p.nazev + '</span>'
          + '<span style="font-family:Purista,serif;'
          + (p.podpolozka ? 'font-weight:400;' : 'font-weight:600;') + 'color:var(--cream);'
          + 'white-space:nowrap">'
          + (p.jednotka === 'ks' ? p.mnozstvi : cis(p.mnozstvi))
          /* Pevná mezera mezi počtem a jednotkou — „276 ks" se nesmí
             na úzké obrazovce zlomit na dva řádky. */
          + '\u00A0' + p.jednotka + '</span></div>';
      });
    });
    return h;
  }

  /* Kliknutí na zaškrtávátko. Poslouchá se na celém výkazu, ne na
     jednotlivých políčkách — ta se při každém přepočtu vyrábějí znovu
     a připnuté obsluhy by zmizely s nimi. */
  var boxVykazu = document.getElementById('res-vykaz');
  if (boxVykazu) boxVykazu.addEventListener('change', function (e) {
    var sk = e.target && e.target.getAttribute && e.target.getAttribute('data-skupina');
    if (!sk) return;
    poptavaneSkupiny[sk] = e.target.checked;
    spocitej();
  });

  /* ── KRESBA STŘECHY ────────────────────────────────────────────────
     Půdorys, jednotlivé roviny s plochou a délky hran. Vrací výměry,
     aby se poslaly i v poptávce. */
  function nakresli(geo, z) {
    var plocha = document.getElementById('res-kresba');
    var tabulka = document.getElementById('res-hrany');
    if (!plocha || !window.PentiKresbaWeb) return null;

    var zed = null;
    try { zed = window.PentiEngine.buildPoly(z.fp, z.dims).poly; } catch (e) { zed = null; }

    plocha.innerHTML = window.PentiKresbaWeb.svg(geo, { zed: zed, sirka: 520, vyska: 340 })
      || '<div style="color:var(--muted);font-size:.85rem">Náhled se nepodařilo vykreslit — '
       + 'výkaz níže platí.</div>';

    var v = window.PentiKresbaWeb.vymery(geo);
    if (tabulka && v) {
      var radky = [['Okap', v.okap], ['Hřeben', v.hreben], ['Nároží', v.narozi],
                   ['Úžlabí', v.uzlabi], ['Štít', v.stit]]
                  .filter(function (r) { return r[1] > 0; });
      var h = '';
      radky.forEach(function (r) {
        h += '<div style="display:flex;justify-content:space-between;gap:16px;'
          + 'padding:7px 0;border-bottom:1px solid var(--border-l)">'
          + '<span style="color:var(--muted)">' + r[0] + '</span>'
          + '<span style="font-family:Purista,serif;font-weight:600;color:var(--cream)">'
          + cis(r[1]) + ' m</span></div>';
      });
      h += '<div style="display:flex;justify-content:space-between;gap:16px;padding:9px 0">'
        + '<span style="color:var(--muted)">Střešních rovin</span>'
        + '<span style="font-family:Purista,serif;font-weight:600;color:var(--cream)">'
        + v.rovin + '</span></div>';
      tabulka.innerHTML = h;
    }
    return v;
  }

  /* Do skrytých polí se uloží CELÉ zadání i výkaz. Rozpočtář tak dostane
     rozměry strojově a nemusí je přepisovat z e-mailu — a po napojení na
     SkladPRO se poptávka v profi verzi jen otevře a zedituje. */
  function ulozDoFormulare(z, s, vymery) {
    var fs = document.getElementById('f-strecha');
    var fv = document.getElementById('f-vykaz');
    var kontakt = {};
    ['jmeno', 'email', 'telefon', 'lokalita'].forEach(function (n) {
      var e = document.querySelector('[name="' + n + '"]');
      if (e && e.value) kontakt[n] = e.value;
    });
    /* Poptávané skupiny se doplní až tady — před prvním výpočtem se
       neví, jaké skupiny výkaz vůbec má. */
    var zadani = JSON.parse(JSON.stringify(z));
    zadani.skupiny = s ? s.skupiny.filter(poptavaSe) : null;
    zadani.skupinyVynechane = s ? s.skupiny.filter(function (x) { return !poptavaSe(x); }) : null;

    if (fs) fs.value = JSON.stringify({ kalkulacka: 'strecha', verze: 1,
                                        zadani: zadani, kontakt: kontakt,
                                        vymery: vymery || null });

    /* Výkaz jde i jako čitelný text — do e-mailu, který přijde obchodu.
       Posílá se JEN to, co zákazník poptává. Co si odškrtl, se ale
       nezamlčí: vypíše se pod čarou. Kdyby zmizelo beze stopy, obchod
       by nepoznal rozdíl mezi „nechci" a „kalkulačka to neuměla". */
    if (!fv) return;
    if (!s) { fv.value = 'nespočítáno'; return; }
    var chci = s.polozky.filter(function (p) { return poptavaSe(p.skupina); });
    var text = chci.map(function (p) {
      return p.skupina + ' · ' + p.nazev + ': ' + p.mnozstvi + ' ' + p.jednotka;
    }).join('\n');
    text = (z.rozsah === 'jen_material'
              ? 'POPTÁVKA: JEN MATERIÁL, BEZ MONTÁŽE\n\n'
              : 'POPTÁVKA: MATERIÁL I MONTÁŽ\n\n') + text;
    if (zadani.skupinyVynechane && zadani.skupinyVynechane.length) {
      text += '\n\nZákazník NEPOPTÁVÁ: ' + zadani.skupinyVynechane.join(', ')
            + ' (spočítáno bylo, ale odškrtl si to).';
    }
    fv.value = text;
  }

  /* ══════════════════════════════════════════════════════════════════
     ODESLÁNÍ POPTÁVKY
     ------------------------------------------------------------------
     Odesílá se na pozadí a výsledek se napíše rovnou pod tlačítko.
     Obyčejné odeslání formuláře funguje jen na nasazeném webu — jinde
     se nestane nic a tlačítko vypadá rozbitě. Když odeslání selže,
     nabídne se hotový e-mail se vším vyplněným: poptávka se nesmí
     ztratit jen proto, že vypadla síť.
     ══════════════════════════════════════════════════════════════════ */
  var formular = document.querySelector('form[name="poptavka-strecha"]');

  function stav(text, barva) {
    var e = document.getElementById('res-stav');
    if (!e) return;
    e.innerHTML = text;
    e.style.color = barva || 'var(--muted)';
    e.style.display = 'block';
  }

  function zalozniOdkaz() {
    var z = sesbirej();
    var telo = 'Dobrý den,\n\nmám zájem o cenovou nabídku na kompletní střechu.\n\n'
      + 'Tvar půdorysu: ' + tvarInfo().nazev + '\n'
      + tvarInfo().pole.map(function (p) { return p[1] + ': ' + z.dims[p[0]] + ' m'; }).join('\n') + '\n'
      + 'Tvar střechy: ' + strechaNazev(z.roof) + '\n'
      + 'Sklon: ' + z.slope + '°\n'
      + 'Rozměry jsou vnější líc zdiva, bez přesahů.\n'
      + 'Přesah okap/štít: ' + z.oOkap + ' / ' + z.oStit + ' m\n'
      + 'Sněhová oblast: ' + z.snehovaOblast + '\n'
      + 'Krytina: ' + z.modelNazev + ', povrch ' + z.povrch + ', barva ' + z.barva + '\n'
      + 'Okapy: ' + z.okapMaterial + ', ' + z.okapBarva + ', žlab RŠ ' + z.okapRs + ' mm\n'
      + 'Nosná konstrukce: ' + z.nosna + '\n'
      + 'Rozsah: ' + (z.rozsah === 'jen_material' ? 'jen materiál' : 'materiál i montáž') + '\n\n'
      + 'VÝKAZ SPOTŘEBY\n' + (document.getElementById('f-vykaz').value || '—') + '\n';
    return 'mailto:poptavky@penti.cz?subject='
      + encodeURIComponent('Poptávka kompletní střechy z kalkulačky')
      + '&body=' + encodeURIComponent(telo);
  }


  function isoCas(d) {
    var pad = function (n) { return String(n).padStart(2, '0'); };
    var off = -d.getTimezoneOffset();
    var sign = off >= 0 ? '+' : '-';
    var abs = Math.abs(off);
    var local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
    return local + sign + pad(Math.floor(abs / 60)) + ':' + pad(abs % 60);
  }
  function sestavBalicek(formular) {
    var raw = (document.getElementById('f-strecha') || {}).value || '{}';
    var parsed = {};
    try { parsed = JSON.parse(raw); } catch (e) { parsed = {}; }
    var z = parsed.zadani || {};
    var jmeno = ((formular.querySelector('[name="jmeno"]') || {}).value || '').trim();
    var email = ((formular.querySelector('[name="email"]') || {}).value || '').trim();
    var telefon = ((formular.querySelector('[name="telefon"]') || {}).value || '').trim();
    var obec = ((formular.querySelector('[name="lokalita"]') || {}).value || '').trim();
    var tvar = z.roof === 'lomena' ? 'mansardova' : (z.roof || 'jina');
    var povolene = { sedlova:1, valbova:1, pultova:1, mansardova:1, jina:1 };
    if (!povolene[tvar]) tvar = 'jina';
    var pud = z.fp || 'jiny';
    var pudorysy = { obdelnik:1, ctverec:1, L:1, T:1, U:1, lichobeznik:1, jiny:1, vlastni:1 };
    if (!pudorysy[pud]) pud = 'jiny';
    var dims = z.dims || {};
    var sirka = dims.B || dims.A || dims.W1 || null;
    var delka = dims.A || dims.L1 || null;
    if (pud === 'obdelnik') { delka = dims.A || null; sirka = dims.B || null; }
    var nosna = z.nosna === 'vazniky' ? 'vaznik' : (z.nosna === 'krov' ? 'krov' : (z.nosna === 'mam' ? 'hotova' : null));
    var sluzby = z.rozsah === 'jen_material' ? ['material'] : ['konstrukce', 'pokryvacstvi', 'klempirstvi'];
    var now = isoCas(new Date());
    var snih = z.snehovaOblast != null ? String(z.snehovaOblast) : null;
    var mapa = { '1':'I','2':'II','3':'III','4':'IV','5':'V','6':'VI','7':'VII','8':'VIII' };
    return {
      schema_version: 'penti.inquiry.v1',
      inquiry_id: crypto.randomUUID(),
      draft_id: crypto.randomUUID(),
      created_at: now,
      locale: 'cs-CZ',
      channel: 'web',
      quality_score: obec && (email || telefon) ? 70 : 40,
      utm: null,
      intent: {
        category: 'strecha',
        job: 'novostavba',
        services: sluzby,
        structure: nosna,
        keep_existing_structure: null,
        timber: z.rezivo || null,
        truss_spacing_mm: z.roztecKrokvi ? Math.round(z.roztecKrokvi * 1000) : null,
        knee_wall: z.nadezdivka ? z.nadezdivka > 0 : null
      },
      site: {
        address: { line: obec || 'neuvedeno', municipality: obec || 'neuvedeno', postal_code: null, parcel: null, country: 'CZ' },
        ruian_building_code: null,
        snow_region: mapa[snih] || null,
        wind_region: z.vitr ? mapa[String(z.vitr)] || null : null,
        snow_load_kpa: (z.sk != null && isFinite(z.sk)) ? Number(z.sk) : null,
        distance_to_plant_km: null
      },
      roof: {
        shape: tvar,
        plan_shape: pud,
        dimensions_basis: 'outer_masonry',
        width_m: sirka,
        length_m: delka,
        pitch_deg: z.slope || null,
        pitch_upper_deg: null,
        break_from_wall_m: null,
        eave_overhang_m: z.oOkap != null ? z.oOkap : null,
        gable_overhang_m: z.oStit != null ? z.oStit : null,
        dormers_count: null,
        attic_use: z.vyuziti === 'obytne' ? 'obytne' : (z.vyuziti === 'uloziste' ? 'puda' : 'nevyapene'),
        insulation_interest: null,
        covering: z.model ? { material: String(z.model), finish: z.povrch || null, color: z.barva || null } : null,
        gutters: z.okapMaterial ? { material: String(z.okapMaterial), color: z.okapBarva || null } : null,
        sheathing: z.zaklop === 'zadne' ? 'latovani' : (z.zaklop ? 'plne_bedneni' : null),
        roof_windows_count: null,
        snow_guards: false,
        safety_points: false
      },
      estimate: {
        kind: 'orientacni_vykaz',
        area_m2: parsed.vymery && parsed.vymery.plochaSikma ? parsed.vymery.plochaSikma : null,
        ridge_m: null, eave_m: null, verge_m: null, hip_m: null, span_m: null, developed_width_m: null,
        currency: 'CZK',
        range_from_czk: null,
        range_to_czk: null,
        manual_quote: true,
        disclaimer: 'Nejde o závaznou nabídku. Výkaz spotřeby je orientační, cenu dodá rozpočtář.'
      },
      wanted_start_month: null,
      note: (document.getElementById('f-vykaz') || {}).value || null,
      contact: { name: jmeno, email: email, phone: telefon, role: 'stavebnik', gdpr_consent_at: now },
      attachments: [],
      calculation: parsed
    };
  }

  if (formular) formular.addEventListener('submit', function (e) {
    e.preventDefault();
    spocitej();                     // ať skrytá pole nesou i kontakt

    var email = (formular.querySelector('[name="email"]') || {}).value || '';
    var tel = (formular.querySelector('[name="telefon"]') || {}).value || '';
    if (!email.trim() && !tel.trim()) {
      stav('Nechte nám prosím e-mail nebo telefon — bez toho vám nemáme '
         + 'kam poslat cenu.', 'var(--gold)');
      return;
    }
    var obecPole = (formular.querySelector('[name="lokalita"]') || {}).value || '';
    if (!obecPole.trim()) {
      stav('Doplňte obec stavby.', 'var(--gold)');
      return;
    }
    var jmenoPole = (formular.querySelector('[name="jmeno"]') || {}).value || '';
    if (jmenoPole.trim().length < 2) {
      stav('Doplňte jméno.', 'var(--gold)');
      return;
    }

    stav('Odesíláme…');
    /* Od 2. 9. 2026 se posílá i projektová dokumentace, proto FormData
       bez ručně nastavené hlavičky — prohlížeč sám doplní multipart
       s hranicí souborů. Netlify Forms tenhle formát přijímá. */
    var gdpr = document.getElementById('w-gdpr');
    if (!gdpr || !gdpr.checked) {
      stav('Potvrďte souhlas se zpracováním údajů.', 'var(--gold)');
      return;
    }
    var balicek = sestavBalicek(formular);
    fetch('/api/poptavka', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(balicek)
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (!res.ok || !res.d.ok) throw new Error((res.d.errors || []).join(' ') || 'server');
        var ulozeno = res.d.stored ? ' Uložili jsme ji.' : ' Úložiště ještě není připojené, ale balíček je v pořádku.';
        stav('<strong>Poptávka odeslána.</strong>' + ulozeno + ' Ozveme se s nabídkou.', 'var(--ink)');
        var b = document.getElementById('res-odeslat');
        if (b) { b.disabled = true; b.textContent = 'Odesláno'; }
      })
      .catch(function (err) {
        if (window.console) console.error('PENTI poptávka:', err);
        stav('Odeslání se nepovedlo. Napište nám prosím přímo — '
           + '<a href="' + zalozniOdkaz() + '" style="color:var(--gold);'
           + 'text-decoration:underline">otevřít e-mail s vyplněnými údaji</a> '
           + 'nebo zavolejte na +420 735 987 377.', 'var(--gold)');
      });
  });

  /* Přepočet při každém posunu v průvodci — je levný, ať běží pokaždé.
     Čekat na časovač by se dřív nebo později rozešlo. */
  wizard.querySelectorAll('[data-wizard-next]').forEach(function (b) {
    b.addEventListener('click', spocitej);
  });

  /* Řetězení výběrů: co se změní nahoře, přenastaví vše pod tím. */
  ['w-material', 'w-model', 'w-povrch'].forEach(function (id) {
    var e = document.getElementById(id);
    if (e) e.addEventListener('change', function () {
      vykresliKrytinu(id === 'w-material' ? 'material' : (id === 'w-model' ? 'model' : 'povrch'));
    });
  });
  ['w-okapmat', 'w-okapbarva', 'w-okaprs'].forEach(function (id) {
    var e = document.getElementById(id);
    if (e) e.addEventListener('change', function () {
      vykresliOkapy(id === 'w-okapmat' ? 'material' : (id === 'w-okaprs' ? 'rs' : 'barva'));
    });
  });
  ['w-nosna', 'w-vyuziti'].forEach(function (id) {
    var e = document.getElementById(id);
    if (e) e.addEventListener('change', function () {
      vykresliKrov();
      hlidejBedneni();
      if (document.getElementById('calc-result').classList.contains('show')) spocitej();
    });
  });

  var strop = document.getElementById('w-strop');
  if (strop) strop.addEventListener('change', function () {
    var pole = document.getElementById('w-strop-pole');
    if (pole) pole.style.display = strop.checked ? 'block' : 'none';
    if (document.getElementById('calc-result').classList.contains('show')) spocitej();
  });

  var poleSk = document.getElementById('w-sk');
  if (poleSk) poleSk.addEventListener('input', hlidejSnih);

  wizard.addEventListener('change', function () {
    if (document.getElementById('calc-result').classList.contains('show')) spocitej();
  });

  /* ══════════════════════════════════════════════════════════════════
     PŘEDVOLBA Z ODKAZU
     ------------------------------------------------------------------
     Stránka Materiál sem posílá zákazníka odkazem `?poptavka=material`.
     Je to jedna a tatáž kalkulačka — jen se rovnou přepne na „jen
     materiál". Kdybychom místo toho udělali druhou kopii stránky,
     dřív nebo později by se obě rozešly a nikdo by si toho nevšiml. */
  function predvolbaZOdkazu() {
    /* Stránka Krov sem posílá odkazem `?vypocet=krov`. Je to tatáž
       kalkulačka — přepne se na klasický krov a skupiny střechy se
       odškrtnou, aby zákazník dostal jen dřevo. Odškrtnutí jde vzít
       zpátky, takže o nic nepřijde. */
    if (/(\?|&)vypocet=krov(&|$)/.test(location.search)) {
      var n = document.getElementById('w-nosna');
      if (n) n.value = 'krov';
      ['Krytina', 'Laťování', 'Skladba', 'Okapy'].forEach(function (sk) {
        poptavaneSkupiny[sk] = false;
      });
      var perexK = document.querySelector('.subhero-inner .t-lead');
      if (perexK) perexK.textContent = 'Zadejte tvar střechy a soustavu — spočítáme '
        + 'spotřebu řeziva po profilech. Rozměry hranolů navrhneme podle statiky. '
        + 'Krytinu si můžete přidat ve výkazu.';
    }

    var jenMaterial = /(\?|&)poptavka=material(&|$)/.test(location.search);
    if (!jenMaterial) return;
    var sel = document.getElementById('w-rozsah');
    if (sel) sel.value = 'jen_material';
    /* Ať je hned vidět, že kalkulačka ví, proč sem člověk přišel. */
    var perex = document.querySelector('.subhero-inner .t-lead');
    if (perex) perex.textContent = 'Zadejte tvar, krytinu a okapy — spočítáme, '
      + 'kolik čeho bude potřeba. Poptáváte jen materiál, montáž ne; '
      + 've čtvrtém kroku se to dá přepnout.';
  }
  predvolbaZOdkazu();

  vykresliTvary();
  vykresliRozmery();
  vykresliKonce();
  vykresliKrytinu('vse');
  vykresliOkapy('vse');
  vykresliKrov();
  hlidejBedneni();
});
