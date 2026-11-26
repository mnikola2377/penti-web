
/* ==========================================================================
   KALKULÁTOR VAZNÍKŮ — NAPOJENÍ NA VÝPOČETNÍ JÁDRO PENTI
   --------------------------------------------------------------------------
   Do 28. 8. 2026 tady běžel vlastní zjednodušený vzorec, který ČETL JEN
   ČTYŘI POLE. Tvar střechy, sněhovou i větrnou oblast zákazník vyplnil
   a výpočet je zahodil — valbová a sedlová střecha stejných rozměrů daly
   stejnou cenu.

   Teď se počítá stejnou geometrií jako v profi rozpočtu (`penti-engine.js`)
   a veřejnými sazbami (`penti-sazby-web.js`). Cena vychází jako ROZPĚTÍ.
   ========================================================================== */
document.addEventListener('DOMContentLoaded', function () {

  var wizard = document.getElementById('calc-wizard');
  if (!wizard) return;

  /* Chybějící jádro se nesmí přejít mlčky — z nespočítané ceny by se
     stala nula a zákazník by viděl „0 Kč". Radši ať je vidět, že se to
     nepovedlo. */
  function jadroChybi() {
    return !window.PentiEngine || !window.PentiVaznikWeb || !window.PENTI_SAZBY_WEB;
  }

  /* ══════════════════════════════════════════════════════════════════
     TVARY PŮDORYSU
     ------------------------------------------------------------------
     Výpočetní jádro zná šest tvarů odjakživa (používá je profi rozpočet),
     na webu se ale dal zadat jen obdélník. Pole se podle tvaru překreslí;
     názvy rozměrů jsou schválně lidské („dolní rameno – délka"), ne
     písmena z technického listu.

     U L, T, U a lichoběžníku se navíc ptáme na KONCE RAMEN. Jestli je
     konec ramene štít, nebo valba, jádro samo neurčí — a je v tom velký
     rozdíl v ploše i ceně. Domýšlet to za zákazníka by byl přesně ten
     tichý omyl, který se pak řeší u reklamace.

     Indexy hran u konců ramen jsou převzaté ze staré kalkulačky vazníků,
     kde se osvědčily. */
  var TVARY = [
    { kod: 'obdelnik',    nazev: 'Obdélník',
      pole: [['A', 'Délka domu – venkovní rozměr zdiva (m)', 12], ['B', 'Šířka domu – venkovní rozměr zdiva (m)', 8]] },
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
  var tvarPudorysu = 'obdelnik';
  var konceStitu = {};

  function tvarInfo(kod) {
    for (var i = 0; i < TVARY.length; i++) if (TVARY[i].kod === (kod || tvarPudorysu)) return TVARY[i];
    return TVARY[0];
  }

  /* Přepínač tvarů. */
  function vykresliTvary() {
    var box = document.getElementById('w-tvary');
    if (!box) return;
    box.innerHTML = TVARY.map(function (t) {
      var aktivni = t.kod === tvarPudorysu;
      return '<button type="button" data-tvar="' + t.kod + '" '
        + 'style="padding:9px 16px;border:1px solid ' + (aktivni ? 'var(--gold)' : 'var(--ink-20)')
        + ';background:' + (aktivni ? 'var(--gold)' : 'transparent')
        + ';color:' + (aktivni ? 'var(--ink)' : 'var(--ink)')
        + ';font-family:Purista,serif;font-weight:600;font-size:.75rem;letter-spacing:.1em;'
        + 'text-transform:uppercase;cursor:pointer">' + t.nazev + '</button>';
    }).join('');
    box.querySelectorAll('[data-tvar]').forEach(function (b) {
      b.addEventListener('click', function () {
        tvarPudorysu = b.getAttribute('data-tvar');
        vykresliTvary(); vykresliRozmery(); vykresliKonce(); spocitej();
      });
    });
  }

  /* Rozměrová pole podle tvaru. Hodnoty se drží, když se pole jmenuje
     stejně — přepnutí tvaru tak nesmaže, co už zákazník napsal. */
  var ulozeneRozmery = {};
  function vykresliRozmery() {
    var box = document.getElementById('w-rozmery');
    if (!box) return;
    box.innerHTML = tvarInfo().pole.map(function (p) {
      var hodnota = (ulozeneRozmery[p[0]] != null) ? ulozeneRozmery[p[0]] : p[2];
      return '<div class="wizard-field-group">'
        + '<label class="wizard-label">' + p[1] + '</label>'
        + '<input class="wizard-input" type="number" min="1" max="80" step="0.1" '
        + 'id="w-dim-' + p[0] + '" value="' + hodnota + '"></div>';
    }).join('');
    box.querySelectorAll('input').forEach(function (i) {
      var klic = i.id.replace('w-dim-', '');
      i.addEventListener('input', function () {
        ulozeneRozmery[klic] = i.value;
        vykresliSchema(klic);
      });
      i.addEventListener('focus', function () { vykresliSchema(klic); });
      i.addEventListener('blur', function () { vykresliSchema(null); });
    });
    vykresliSchema(null);
  }

  /* Obrázek půdorysu s okótovanými stranami. Kreslí ho stejný modul jako
     výslednou střechu a rozměry bere z právě vyplněných polí, takže
     schéma nemůže ukazovat jiný tvar, než se počítá. */
  function vykresliSchema(zvyraznit) {
    var box = document.getElementById('w-schema');
    if (!box || !window.PentiKresbaWeb) return;
    var dims = {};
    tvarInfo().pole.forEach(function (p) { dims[p[0]] = cislo('w-dim-' + p[0], p[2]); });
    var obr = window.PentiKresbaWeb.schema(tvarPudorysu, dims,
                { sirka: 300, vyska: 220, zvyraznit: zvyraznit });
    box.innerHTML = obr
      || '<div style="color:var(--muted);font-size:.8rem">Schéma se nepodařilo vykreslit.</div>';
  }

  /* Konce ramen — štít, nebo valba. */
  function vykresliKonce() {
    var box = document.getElementById('w-konce');
    var obal = document.getElementById('w-konce-box');
    var konce = tvarInfo().konce;
    if (!box || !obal) return;
    if (!konce) { obal.style.display = 'none'; box.innerHTML = ''; return; }
    obal.style.display = 'block';
    box.innerHTML = konce.map(function (k, i) {
      if (konceStitu[k] == null) konceStitu[k] = true;   // sedlová = štít
      return '<label style="cursor:pointer;font-size:.9rem">'
        + '<input type="checkbox" data-konec="' + k + '" '
        + (konceStitu[k] ? 'checked' : '')
        + ' style="accent-color:var(--gold);margin-right:8px"> '
        + 'Konec ' + (i + 1) + ' je štít <span style="color:var(--muted)">'
        + '(bez zaškrtnutí valba)</span></label>';
    }).join('');
    box.querySelectorAll('input').forEach(function (i) {
      i.addEventListener('change', function () {
        konceStitu[+i.getAttribute('data-konec')] = i.checked;
        spocitej();
      });
    });
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
  var tvarStrechy = function () {
    var r = document.querySelector('input[name="tvar"]:checked');
    return r ? r.value : 'sedlova';
  };
  /* Pevná mezera (nezalomitelná) uvnitř částky i před „Kč" — jinak by
     se na úzké obrazovce „150 000 Kč" rozpadlo na dva řádky uprostřed. */
  var kc = function (x) {
    return x.toLocaleString('cs-CZ').replace(/\s/g, '\u00A0') + '\u00A0Kč';
  };

  var posledniOdhad = null;

  function sesbirej() {
    var dims = {};
    tvarInfo().pole.forEach(function (p) { dims[p[0]] = cislo('w-dim-' + p[0], p[2]); });
    var konce = {};
    (tvarInfo().konce || []).forEach(function (k) { konce[k] = !!konceStitu[k]; });
    return {
      roof: tvarStrechy(),
      fp: tvarPudorysu,
      dims: dims,
      konceStitu: (tvarInfo().konce ? konce : null),
      slope: cislo('w-sklon', 30),
      roztec: cislo('w-roztech', 1),
      presah: cislo('w-presah', 0.6),
      presahStit: cislo('w-stit', 0.6),
      km: cislo('w-km', 70),
      snehovaOblast: vyber('w-sneh'),
      vetrnaOblast: vyber('w-vitr'),
      vyuzitiPodkrovi: vyber('w-vyuziti')
    };
  }

  function spocitej() {
    var z = sesbirej();
    var cil = { cena: document.getElementById('res-cena'),
                vazniku: document.getElementById('res-vaznik'),
                plocha: document.getElementById('res-plocha'),
                rozmer: document.getElementById('res-vaznik-rozmer'),
                pozn: document.getElementById('res-pozn') };

    /* Mansardovou střechu jádro neumí. Nesmíme jí podstrčit cenu sedlové —
       to by byl přesně ten tichý omyl, kvůli kterému by pak seděl
       rozpočtář nad reklamací. */
    if (z.roof === 'mansard') {
      cil.cena.textContent = 'spočítáme ručně';
      cil.cena.classList.add('jako-text');
      cil.pozn.textContent = 'Mansardová střecha má dvojitý sklon a orientační vzorec na ni nesedí. '
        + 'Vyplňte kontakt níže a spočítáme ji přesně.';
      cil.vazniku.textContent = '–';
      cil.plocha.textContent = '–';
      cil.rozmer.textContent = '–';
      ulozDoFormulare(z, null, null);
      return;
    }

    if (jadroChybi()) {
      cil.cena.textContent = 'výpočet se nenačetl';
      cil.cena.classList.add('jako-text');
      cil.pozn.textContent = 'Zkuste stránku načíst znovu, nebo nám zavolejte — rádi to spočítáme za vás.';
      return;
    }

    try {
      var geo = window.PentiEngine.geometrieStrechy({
        fp: z.fp,
        dims: z.dims,
        roof: z.roof,
        slope: z.slope,
        oOkap: z.presah,
        oStit: z.presahStit,
        planeSlopes: {}, endState: z.konceStitu || {}, pultDir: 'dolu'
      });
      var o = window.PentiVaznikWeb.odhad(geo, {
        fp: z.fp, roof: z.roof, slope: z.slope, oOkap: z.presah, km: z.km
      });

      /* Počet vazníků: po roztečích plus jeden na konec. Rozteč se hlídá
         i tady, ne jen v rozhraní — kdyby si ji někdo nastavil jinudy,
         nesmí to projít.

         Dává to ale smysl jen u pravoúhlého půdorysu. U L, T a U závisí
         počet na tom, jak se ramena vyztuží, a to určí projektant.
         Vymyslet číslo by bylo horší než ho neukázat. */
      var jednoduchy = (z.fp === 'obdelnik' || z.fp === 'ctverec');
      var delkaObjektu = Math.max(z.dims.A || 0, z.dims.B || 0);
      cil.vazniku.textContent = jednoduchy
        ? (Math.ceil(delkaObjektu / platnaRoztec(z)) + 1)
        : 'z projektu';
      cil.plocha.textContent = o.plochaSikma.toLocaleString('cs-CZ') + ' m²';
      cil.rozmer.textContent = o.delkaVazniku.toFixed(1).replace('.', ',') + ' × '
                             + o.vyskaVazniku.toFixed(1).replace('.', ',') + ' m';
      /* Rozpětí se smí zalomit jen v pomlčce — uvnitř částky je pevná
         mezera, aby se nikdy nezlomilo uprostřed čísla. */
      cil.cena.textContent = kc(o.od) + ' – ' + kc(o.do);
      cil.cena.classList.remove('jako-text');
      cil.pozn.textContent = 'Zahrnuje výrobu, montáž i dopravu na ' + z.km + ' km.'
        + (o.nadrozmerny ? ' Vazník přesahuje 3,2 m — počítáme s doprovodem nadrozměrného nákladu.' : '')
        + ' Jde o orientační nezávazné nacenění. Částku musí PENTI potvrdit v cenové nabídce.';
      posledniOdhad = o;

      var vym = nakresli(geo, z);
      ulozDoFormulare(z, o, vym);
    } catch (e) {
      cil.cena.textContent = 'nepodařilo se spočítat';
      cil.cena.classList.add('jako-text');
      cil.pozn.textContent = 'Zkuste prosím zkontrolovat zadané rozměry, nebo nám zavolejte.';
      if (window.console) console.error('PENTI kalkulátor vazníků:', e);
    }
  }

  /* ── KRESBA STŘECHY ────────────────────────────────────────────────
     Vykreslí půdorys, jednotlivé roviny s jejich plochou a délky hran.
     Vrací výměry, aby se poslaly i v poptávce. */
  function nakresli(geo, z) {
    var plocha = document.getElementById('res-kresba');
    var tabulka = document.getElementById('res-hrany');
    if (!plocha || !window.PentiKresbaWeb) return null;

    var zed = null;
    try { zed = window.PentiEngine.buildPoly(z.fp, z.dims).poly; }
    catch (e) { zed = null; }

    var obrazek = window.PentiKresbaWeb.svg(geo, { zed: zed, sirka: 520, vyska: 340 });
    /* Prázdné místo by vypadalo, že tam nic není. Když se nedá kreslit,
       musí to být napsané. */
    plocha.innerHTML = obrazek
      || '<div style="color:var(--muted);font-size:.85rem">Náhled se nepodařilo vykreslit — '
       + 'výměry níže platí.</div>';

    var v = window.PentiKresbaWeb.vymery(geo);
    if (tabulka && v) {
      var radky = [
        ['Okap', v.okap], ['Hřeben', v.hreben], ['Nároží', v.narozi],
        ['Úžlabí', v.uzlabi], ['Štít', v.stit]
      ].filter(function (r) { return r[1] > 0; });
      var h = '';
      radky.forEach(function (r) {
        h += '<div style="display:flex;justify-content:space-between;gap:16px;'
          + 'padding:7px 0;border-bottom:1px solid var(--border-l)">'
          + '<span style="color:var(--muted)">' + r[0] + '</span>'
          + '<span style="font-family:Purista,serif;font-weight:600;color:var(--cream)">'
          + r[1].toFixed(1).replace('.', ',') + ' m</span></div>';
      });
      h += '<div style="display:flex;justify-content:space-between;gap:16px;padding:9px 0">'
        + '<span style="color:var(--muted)">Střešních rovin</span>'
        + '<span style="font-family:Purista,serif;font-weight:600;color:var(--cream)">'
        + v.rovin + '</span></div>';
      tabulka.innerHTML = h;
    }
    return v;
  }

  /* Do skrytých polí formuláře se uloží CELÉ zadání i výsledek. Rozpočtář
     tak dostane rozměry strojově a nemusí je přepisovat z e-mailu. */
  function ulozDoFormulare(z, o, vymery) {
    var fs = document.getElementById('f-strecha');
    var fo = document.getElementById('f-odhad');
    /* Kontakt se do popisu přidává taky — rozpočtář tak z jednoho vloženého
       textu dostane jméno, obec i rozměry a nemusí je slepovat ze dvou míst. */
    var kontakt = {};
    ['jmeno', 'email', 'telefon', 'lokalita'].forEach(function (n) {
      var e = document.querySelector('[name="' + n + '"]');
      if (e && e.value) kontakt[n] = e.value;
    });
    if (fs) fs.value = JSON.stringify({ kalkulacka: 'vazniky', verze: 1,
                                        zadani: z, kontakt: kontakt,
                                        vymery: vymery || null });
    if (fo) fo.value = o ? (o.od + '–' + o.do + ' Kč · plocha ' + o.plochaSikma + ' m²')
                         : 'nespočítáno (mansardová střecha)';
  }

  /* ── ROZTEČ VAZNÍKŮ A SNĚHOVÁ OBLAST ────────────────────────────────
     Běžná rozteč je 0,8 až 1,2 m, standardní 1 m. Nad 1 m ji ale nelze
     použít ve vyšší než druhé sněhové oblasti — vazník by na tíhu sněhu
     nevyšel.

     Sněhová oblast se vybírá až v dalším kroku než rozteč, takže se
     zadání může rozejít. V tu chvíli se rozteč vrátí na 1 m A NAPÍŠE SE
     PROČ. Přepsat ji mlčky by znamenalo, že zákazník dostane jiný počet
     vazníků, než si vybral, a nedozví se to. */
  var MAX_ROZTEC_HORY = 1;          // m, ve 3. a 4. sněhové oblasti

  /* Rozteč, se kterou se opravdu počítá. Ve 3. a 4. sněhové oblasti se
     shora omezí, jinde platí, co si zákazník vybral. */
  function platnaRoztec(z) {
    var oblast = parseInt(z.snehovaOblast, 10) || 1;
    return (oblast > 2) ? Math.min(z.roztec, MAX_ROZTEC_HORY) : z.roztec;
  }

  function hlidejRoztec() {
    var sel = document.getElementById('w-roztech');
    var pozn = document.getElementById('roztec-pozn');
    if (!sel || !pozn) return;
    var oblast = parseInt(vyber('w-sneh'), 10) || 1;
    var omezeno = oblast > 2;

    Array.prototype.forEach.call(sel.options, function (o) {
      o.disabled = omezeno && parseFloat(o.value) > MAX_ROZTEC_HORY;
    });

    if (omezeno && parseFloat(sel.value) > MAX_ROZTEC_HORY) {
      var puvodni = sel.value.replace('.', ',');
      sel.value = String(MAX_ROZTEC_HORY);
      pozn.textContent = 'Rozteč ' + puvodni + ' m nelze v ' + oblast
        + '. sněhové oblasti použít — vrátili jsme ji na 1 m.';
      pozn.style.display = 'block';
    } else if (omezeno) {
      pozn.textContent = 'V ' + oblast + '. sněhové oblasti je nejvyšší možná rozteč 1 m.';
      pozn.style.display = 'block';
    } else {
      pozn.style.display = 'none';
    }
  }

  /* Počítá se při každém posunu v průvodci, ne až na konci. Původní kód
     se spoléhal na to, že se stihne spustit až po přepnutí panelu, a řešil
     to čekáním 200 ms — takové časování se dřív nebo později rozejde.
     Přepočet je levný, tak ať běží pokaždé. */
  wizard.querySelectorAll('[data-wizard-next]').forEach(function (b) {
    b.addEventListener('click', spocitej);
  });

  /* ══════════════════════════════════════════════════════════════════
     ODESLÁNÍ POPTÁVKY
     ------------------------------------------------------------------
     Původně to bylo obyčejné odeslání formuláře, které Netlify zpracuje
     na serveru. To má dvě vady, na které PENTI narazil 28. 8. 2026
     („z kalkulačky poptávka přímo odeslat nejde"):

       1. FUNGUJE TO JEN NA NASAZENÉM WEBU. Když se stránka otevře
          z disku nebo z náhledu, prohlížeč odeslání zahodí a NEDĚJE SE
          NIC — tlačítko vypadá rozbitě.
       2. KDYŽ ODESLÁNÍ SELŽE, zákazník to nepozná.

     Proto se odesílá na pozadí a výsledek se napíše rovnou pod tlačítko.
     Když se to nepovede, nabídne se hotový e-mail se vším vyplněným —
     poptávka se nesmí ztratit jen proto, že vypadla síť. */
  var formular = document.querySelector('form[name="poptavka-vazniky"]');

  function stav(text, barva) {
    var e = document.getElementById('res-stav');
    if (!e) return;
    e.innerHTML = text;
    e.style.color = barva || 'var(--muted)';
    e.style.display = 'block';
  }

  /* Záložní e-mail s předvyplněným tělem. */
  function zalozniOdkaz() {
    var z = sesbirej();
    var telo = 'Dobrý den,\n\nmám zájem o cenovou nabídku na vazníky.\n\n'
      + 'Tvar půdorysu: ' + tvarInfo().nazev + '\n'
      + tvarInfo().pole.map(function (p) {
          return p[1] + ': ' + z.dims[p[0]] + ' m'; }).join('\n') + '\n'
      + 'Tvar střechy: ' + z.roof + '\n'
      + 'Sklon: ' + z.slope + '°\n'
      + 'Rozteč vazníků: ' + z.roztec + ' m\n'
      + 'Rozměry jsou vnější líc zdiva, bez přesahů.\n'
      + 'Přesah u okapu: ' + z.presah + ' m\n'
      + 'Přesah u štítu: ' + z.presahStit + ' m\n'
      + 'Vzdálenost stavby: ' + z.km + ' km\n'
      + 'Sněhová oblast: ' + z.snehovaOblast + ', větrná: ' + z.vetrnaOblast + '\n\n'
      + 'Odhad z kalkulačky: ' + (document.getElementById('f-odhad').value || '—') + '\n';
    return 'mailto:poptavky@penti.cz?subject='
      + encodeURIComponent('Poptávka vazníků z kalkulačky')
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
    var z = sesbirej();
    var jmeno = ((formular.querySelector('[name="jmeno"]') || {}).value || '').trim();
    var email = ((formular.querySelector('[name="email"]') || {}).value || '').trim();
    var telefon = ((formular.querySelector('[name="telefon"]') || {}).value || '').trim();
    var obec = ((formular.querySelector('[name="lokalita"]') || {}).value || '').trim();
    var tvar = z.roof === 'mansard' ? 'mansardova' : z.roof;
    var povolene = { sedlova: 1, valbova: 1, pultova: 1, mansardova: 1, jina: 1 };
    if (!povolene[tvar]) tvar = 'jina';
    var pud = z.fp || 'jiny';
    var now = isoCas(new Date());
    var mapa = { '1': 'I', '2': 'II', '3': 'III', '4': 'IV', '5': 'V', '6': 'VI', '7': 'VII', '8': 'VIII' };
    var maCenu = posledniOdhad && isFinite(posledniOdhad.od) && isFinite(posledniOdhad.do);
    return {
      schema_version: 'penti.inquiry.v1',
      inquiry_id: crypto.randomUUID(),
      draft_id: crypto.randomUUID(),
      created_at: now,
      locale: 'cs-CZ',
      channel: 'web',
      quality_score: 60,
      utm: null,
      intent: {
        category: 'strecha',
        job: 'novostavba',
        services: ['konstrukce'],
        structure: 'vaznik',
        keep_existing_structure: null,
        timber: null,
        truss_spacing_mm: Math.round((z.roztec || 1) * 1000),
        knee_wall: null
      },
      site: {
        address: { line: obec, municipality: obec, postal_code: null, parcel: null, country: 'CZ' },
        ruian_building_code: null,
        snow_region: mapa[String(z.snehovaOblast)] || null,
        wind_region: mapa[String(z.vetrnaOblast)] || null,
        snow_load_kpa: null,
        distance_to_plant_km: null
      },
      roof: {
        shape: tvar,
        plan_shape: pud,
        width_m: z.dims.B || z.dims.A || null,
        length_m: z.dims.A || null,
        pitch_deg: z.slope || null,
        pitch_upper_deg: null,
        break_from_wall_m: null,
        dimensions_basis: 'outer_masonry',
        eave_overhang_m: z.presah,
        gable_overhang_m: z.presahStit,
        dormers_count: null,
        attic_use: z.vyuzitiPodkrovi === 'obytne' ? 'obytne' : (z.vyuzitiPodkrovi === 'uloziste' ? 'puda' : 'nevyapene'),
        insulation_interest: null,
        covering: null,
        gutters: null,
        sheathing: null,
        roof_windows_count: null,
        snow_guards: false,
        safety_points: false
      },
      estimate: {
        kind: 'orientacni_vykaz',
        area_m2: posledniOdhad ? posledniOdhad.plochaSikma : null,
        ridge_m: null, eave_m: null, verge_m: null, hip_m: null, span_m: null, developed_width_m: null,
        currency: 'CZK',
        range_from_czk: maCenu ? Math.round(posledniOdhad.od) : null,
        range_to_czk: maCenu ? Math.round(posledniOdhad.do) : null,
        non_binding: maCenu,
        manual_quote: true,
        disclaimer: maCenu
          ? 'Nejde o závaznou nabídku. Jde o orientační nezávazné nacenění. Částku musí PENTI potvrdit v cenové nabídce.'
          : 'Nejde o závaznou nabídku. Cenu doplní rozpočtář.'
      },
      wanted_start_month: null,
      note: (document.getElementById('f-odhad') || {}).value || null,
      contact: { name: jmeno, email: email, phone: telefon, role: 'stavebnik', gdpr_consent_at: now },
      attachments: []
    };
  }

  if (formular) formular.addEventListener('submit', function (e) {
    e.preventDefault();
    spocitej();                     // ať skrytá pole nesou i kontakt

    /* Bez kontaktu nemá poptávka smysl — nemáme kam odpovědět. */
    var email = (formular.querySelector('[name="email"]') || {}).value || '';
    var tel = (formular.querySelector('[name="telefon"]') || {}).value || '';
    if (!email.trim() && !tel.trim()) {
      stav('Nechte nám prosím e-mail nebo telefon — bez toho vám nemáme '
         + 'kam poslat cenu.', 'var(--gold)');
      return;
    }
    var gdpr = document.getElementById('w-gdpr');
    if (!gdpr || !gdpr.checked) {
      stav('Potvrďte souhlas se zpracováním údajů.', 'var(--gold)');
      return;
    }
    var jmenoPole = (formular.querySelector('[name="jmeno"]') || {}).value || '';
    if (jmenoPole.trim().length < 2) {
      stav('Doplňte jméno.', 'var(--gold)');
      return;
    }
    var obecPole = (formular.querySelector('[name="lokalita"]') || {}).value || '';
    if (!obecPole.trim()) {
      stav('Doplňte obec stavby.', 'var(--gold)');
      return;
    }

    stav('Odesíláme…');
    fetch('/api/poptavka', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(sestavBalicek(formular))
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (!res.ok || !res.d.ok) throw new Error((res.d.errors || []).join(' ') || 'server');
        stav('<strong style="color:var(--cream)">Poptávka odeslána.</strong> '
           + 'Ozveme se s nabídkou. Částka z kalkulačky není závazná.', 'var(--muted)');
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
  /* Když se zákazník vrátí a něco změní, přepočítá se to hned. */
  wizard.addEventListener('change', function () {
    hlidejRoztec();
    if (document.getElementById('calc-result').classList.contains('show')) spocitej();
  });
  vykresliTvary();
  vykresliRozmery();
  vykresliKonce();
  hlidejRoztec();
});
