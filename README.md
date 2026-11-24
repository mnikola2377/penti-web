# PENTI PREFAB — nový web

První verze webu penti.cz. Světlý vzhled podle [grafického manuálu](https://manual-penti.netlify.app), texty česky, statické stránky a vedená poptávka střechy.

## Co umí

- Úvod se čtyřmi službami a fotografiemi z firemních alb. Obec a rozměr u realizací jsou pole k doplnění, nejsou vymyšlené.
- Na stránce O nás je časová osa od firmy Oskara Funtíčka po dnešek. U předválečných snímků rok neuvádíme.
- Konfigurátor střechy na `/poptavka/strecha`. Sedm kroků, podmíněné otázky, průběžný výkaz plochy, uložení rozpracované poptávky v prohlížeči a výstup `penti.inquiry.v1`.
- Odeslání na `/api/poptavka`. Funkce balíček zkontroluje a zapíše ho do Supabase. Když chybí `SUPABASE_URL` nebo `SUPABASE_SERVICE_ROLE_KEY`, poptávku neodmítne: vrátí, že je v pořádku, ale neuložená. JSON si stáhnete na obrazovce.
- Ostatní stránky mapy webu, aby šla proklikat navigace. Katalog domů, recenze, realizace a obchodní podmínky jsou označené jako podklady, které teprve dodáte.

Ceny na webu nejsou. Výkaz plochy a délek je orientační a u obdélníkové sedlové, valbové, pultové a mansardové střechy odpovídá geometrii z koncepce na testovaciweb.netlify.app. Atypický tvar jde k ručnímu nacenění.

## Požadavky

Node.js 22 a npm.

## Spuštění

```bash
npm install
npm run dev
```

Web běží na http://localhost:4321. Funkce Netlify v `npm run dev` neběží. Pro funkce i proměnné prostředí použijte `npx netlify dev`, až bude projekt v Netlify propojený.

## Testy a kontrola

```bash
npm test
npm run check
npm run build
npm run preview
```

Ukázkový balíček je v `examples/penti.inquiry.v1.example.json`. Jméno, e-mail a adresa v něm jsou smyšlené, plocha 183,3 m² je spočítaná.

## Nasazení na Netlify

1. V Netlify dejte New site from Git a vyberte tento repozitář. Build je v `netlify.toml`: příkaz `npm run build`, složka `dist`, Node 22.
2. V Environment variables doplňte `SUPABASE_URL` a `SUPABASE_SERVICE_ROLE_KEY`. Klíč service role nepatří do prohlížeče ani do gitu.
3. V Supabase spusťte `supabase/migrations/20261114120000_inquiries.sql`. Vzniknou tabulky `inquiries`, `inquiry_events`, `attachments`, `contact_messages` a neveřejný bucket `inquiry-attachments`.
4. Až bude doména připravená, nasměrujte `penti.cz` na tento web. Do té doby slouží náhledová adresa Netlify.

Bez proměnných se web sestaví a konfigurátor JSON vytvoří. Do databáze se nic nezapíše.

## Co musí dodat firma

- Propojení webu v Netlify a obě proměnné Supabase.
- Fotografie realizací (dřevo nebo hotová střecha, bez SPZ a bez log cizích výrobců), k nim obec, typ práce a rozměr.
- Katalog typových domů a to, co dodávka domu opravdu zahrnuje. Bez toho konfigurátor domu nespouštíme.
- PDF obchodních podmínek a certifikátů, pokud mají být přímo tady. Teď odkazujeme na stávající `https://penti.cz/o-penti`.
- Potvrzení, za jak dlouho držíte odezvu na poptávku. Na tlačítko termín neslibujeme.
- Sjednocení adresy: stávající web uvádí sídlo Osvoboditelů 609, koncepce e-shopu 609/71.
- Klíč k Mapy.com, pokud má adresa sama navrhovat obec, sněhovou oblast a vzdálenost od výrobny.

## Vzhled a písmo

Barvy a písmo jsou z manuálu: papír `#F6F1E7`, jehličí `#46704A`, zlatá `#BF935B`, text `#1B251E`. Barlow a Barlow Condensed jsou ve `public/fonts` (SIL Open Font License, soubor `OFL.txt`). Purista je jen v souborech loga ve `public/brand`. Logo a znak jsou stažené z veřejného manuálu.
