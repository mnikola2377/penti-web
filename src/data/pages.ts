export interface PageSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
  links?: { href: string; label: string }[];
}

export interface SitePage {
  path: string;
  title: string;
  description: string;
  eyebrow: string;
  heading: string;
  lead: string;
  notice?: string;
  sections: PageSection[];
  cta?: { href: string; label: string };
  serviceName?: string;
}

export const pages: SitePage[] = [
  {
    path: "strechy",
    title: "Střechy",
    description: "Krovy, vazníky, pokrývačství a klempířství od PENTI PREFAB z Ivanovic na Hané. Jedna poptávka na celou střechu.",
    eyebrow: "Střechy",
    heading: "Konstrukce, krytina i oplechování",
    lead: "Od roku 1992 vyrábíme dřevěné střešní konstrukce. Nově k nim přidáváme pokrývačské a klempířské práce, takže střechu můžete poptat najednou.",
    sections: [
      {
        heading: "Co si můžete vybrat",
        bullets: [
          "Příhradové vazníky pro novostavby i haly, s rozpětím do 30 m bez vnitřní podpory.",
          "Klasické krovy tam, kde má zůstat vidět dřevo nebo vzniknout podkroví.",
          "Pokrývačské práce: latění nebo bednění, pojistná hydroizolace a pokládka krytiny.",
          "Klempířské práce: okapy, svody, lemování a úžlabí.",
          "Kompletní střecha od návrhu po předání.",
        ],
      },
    ],
    cta: { href: "/poptavka/strecha", label: "Spočítat střechu" },
  },
  {
    path: "strechy/vazniky",
    title: "Příhradové vazníky",
    description: "Výroba a montáž příhradových vazníků ze sušeného hoblovaného řeziva. Rozpětí do 30 m bez vnitřní podpory. PENTI PREFAB, Ivanovice na Hané.",
    eyebrow: "Konstrukce",
    heading: "Příhradové vazníky",
    lead: "Vazník je příhradová konstrukce z dřevěných prutů spojených styčníkovými deskami s prolisovanými trny. Navrhujeme ho a montujeme od rodinných domů po haly.",
    serviceName: "Výroba a montáž příhradových vazníků",
    sections: [
      {
        heading: "Kde se hodí",
        bullets: [
          "Zastřešení rodinných domů.",
          "Výrobní haly, sklady, zemědělské stavby a nástavby.",
          "Rozpětí do 30 m bez vnitřní podpory.",
          "Také stěnové konstrukce, když to statika dovolí.",
        ],
      },
      {
        heading: "Z čeho je vyrábíme",
        paragraphs: [
          "Používáme certifikované sušené a hoblované vazníkové řezivo, běžně pevnostní třídy C24. Běžné průřezy mají tloušťku 45–80 mm a šířku 70–240 mm. Díky sušení není nutné dřevo chemicky ošetřovat.",
        ],
      },
      {
        heading: "Co potřebujeme do výpočtu",
        paragraphs: [
          "Sněhovou a větrnou oblast, zatížení krytinou a podhledem a další břemena, která na střeše budou: nádrž, solární panely, vrata, světla nebo vzduchotechnika. Po předběžném návrhu připravíme cenovou nabídku. Po odsouhlasení a zaměření vznikne dílenská dokumentace, montážní dokumentace a statický výpočet.",
        ],
      },
    ],
    cta: { href: "/poptavka/strecha", label: "Poptat vazníky" },
  },
  {
    path: "strechy/krovy",
    title: "Klasické krovy",
    description: "Návrh, výroba a montáž klasických krovů, pergol a altánů. Sušené řezivo a lepené dřevo, statické posouzení. PENTI PREFAB.",
    eyebrow: "Konstrukce",
    heading: "Klasické krovy",
    lead: "Krov volíme tam, kde vazník nestačí: chcete vidět dřevo v interiéru, potřebujete velké podkroví, nadkrokevní izolaci, repliku nebo opravu starší konstrukce.",
    serviceName: "Návrh a montáž klasických krovů",
    sections: [
      {
        heading: "Co umíme dodat",
        bullets: [
          "Krovy rodinných domů a nástaveb.",
          "Pohledové konstrukce z lepeného lamelového dřeva.",
          "Repliky a opravy starších krovů.",
          "Pergoly, altány a prostorové tesařské konstrukce.",
        ],
      },
      {
        heading: "Jak postupujeme",
        bullets: [
          "Posoudíme zadání a navrhneme řešení podle vaší představy.",
          "Konstrukci staticky spočítáme a stavbu zaměříme.",
          "Připravíme model včetně tesařských spojů.",
          "Používáme především sušené hoblované řezivo a lepené lamelové dřevo.",
          "Tesaři konstrukci přikotví a smontují.",
        ],
      },
    ],
    cta: { href: "/poptavka/strecha", label: "Poptat krov" },
  },
  {
    path: "strechy/pokryvacstvi",
    title: "Pokrývačství",
    description: "Pokrývačské práce PENTI PREFAB: latění nebo bednění, pojistná hydroizolace a pokládka krytiny na námi dodané i cizí konstrukce.",
    eyebrow: "Pokrývačství",
    heading: "Pokrývačské práce",
    lead: "Krytinu pokládáme na konstrukce, které sami vyrobíme, i na střechy, kde konstrukce už stojí. Konkrétní skladbu a cenu určíme až z podkladů.",
    notice: "Fotografie pokrývačských realizací zatím nemáme v novém webu. Doplní je firma.",
    serviceName: "Pokrývačské práce",
    sections: [
      {
        heading: "Co práce zahrnuje",
        bullets: [
          "Latění nebo plné bednění podle typu krytiny a sklonu.",
          "Pojistnou hydroizolaci.",
          "Pokládku skládané nebo velkoformátové krytiny.",
          "Hřeben, nároží a prostupy v rozsahu, který si domluvíme.",
          "Přípravu pro klempířské prvky.",
        ],
      },
      {
        heading: "Co od vás potřebujeme",
        paragraphs: [
          "Adresu stavby, tvar a sklon střechy a představu o krytině. U rekonstrukce i fotografie. Výrobce krytiny vybereme v nabídce podle skladby, na těchto stránkách značky nejmenujeme.",
        ],
      },
    ],
    cta: { href: "/poptavka/strecha", label: "Poptat pokrývačství" },
  },
  {
    path: "strechy/klempirstvi",
    title: "Klempířství",
    description: "Klempířské práce PENTI PREFAB: okapy, svody, lemování, úžlabí a oplechování prostupů. Součást střechy na klíč i samostatná zakázka.",
    eyebrow: "Klempířství",
    heading: "Klempířské práce",
    lead: "Oplechování navazuje na krov a na krytinu. Můžete ho poptat samostatně, nebo jako součást kompletní střechy.",
    notice: "Ukázky klempířských detailů doplníme z vlastních staveb. Do té doby berte stránku jako popis rozsahu prací, ne jako galerii.",
    serviceName: "Klempířské práce",
    sections: [
      {
        heading: "Co práce zahrnuje",
        bullets: [
          "Okapové žlaby a svody.",
          "Lemování komínů, zdí a prostupů.",
          "Úžlabí a závětrné lišty.",
          "Oplechování atik a prostupů, když jsou součástí zadání.",
        ],
      },
      {
        heading: "Materiál",
        paragraphs: [
          "V poptávce vyberete materiál a barvu oplechování. Přesný výrobní rozpis vznikne po zaměření. Cenu na webu neuvádíme.",
        ],
      },
    ],
    cta: { href: "/poptavka/strecha", label: "Poptat klempířství" },
  },
  {
    path: "strechy/kompletni-strecha",
    title: "Kompletní střecha",
    description: "Střecha na klíč od PENTI PREFAB: konstrukce, pokrývačství i klempířství v jedné poptávce. Výroba v Ivanovicích na Hané.",
    eyebrow: "Na klíč",
    heading: "Kompletní střecha",
    lead: "Jeden partner navrhne konstrukci, vyrobí ji v Ivanovicích na Hané, přiveze ji a střechu dokončí krytinou a oplechováním.",
    serviceName: "Kompletní střecha na klíč",
    sections: [
      {
        heading: "Jak zakázka probíhá",
        bullets: [
          "Pošlete projekt, nebo náčrt a fotografie.",
          "Připravíme předběžný rozpočet.",
          "Sejdeme se a stavbu zaměříme.",
          "Po odsouhlasení a záloze vyrobíme konstrukci.",
          "Dokončíme krytinu a klempířské práce a stavbu předáme.",
        ],
      },
    ],
    cta: { href: "/poptavka/strecha", label: "Spočítat střechu" },
  },
  {
    path: "drevostavby",
    title: "Dřevostavby",
    description: "Sloupkové dřevostavby, panely a hrubá stavba od PENTI PREFAB. Typový katalog domů teprve připravujeme.",
    eyebrow: "Dřevostavby",
    heading: "Panely, hrubá stavba a domy",
    lead: "Navrhujeme a vyrábíme sloupkové panely a moduly: stěny, stropy i střechu. Katalog typových domů ještě není zveřejněný.",
    sections: [
      {
        heading: "Co už dodáváme",
        bullets: [
          "Obvodové stěny, stropy, štíty a vikýře vyrobené v hale.",
          "Hrubou stavbu se střechou na připravené základové desce.",
          "Jen dílčí konstrukce, když zbytek zajišťujete sami.",
          "Skladby difuzně otevřených i uzavřených stěn.",
        ],
      },
      {
        heading: "Co teprve chystáme",
        paragraphs: [
          "Typové domy s jasnými mezemi úprav a s orientačním rozsahem ceny spustíme až po schválení katalogu. Do té doby nechte vzkaz na stránce poptávky domu, nebo nám pošlete vlastní projekt.",
        ],
      },
    ],
    cta: { href: "/drevostavby/panely-hruba-stavba", label: "Panely a hrubá stavba" },
  },
  {
    path: "drevostavby/typove-domy",
    title: "Typové dřevostavby",
    description: "Katalog typových dřevostaveb PENTI se připravuje. Zatím umíme panely a hrubou stavbu podle vašeho projektu.",
    eyebrow: "Katalog",
    heading: "Typové domy připravujeme",
    lead: "Veřejný katalog typů, půdorysů a cenových rozsahů zatím nemáme. Až ho obchod schválí, půjde dům vybrat a upravit v jasných mezích.",
    notice: "Na této stránce záměrně nejsou vymyšlené typy domů ani ceny.",
    sections: [
      {
        heading: "Než katalog vyjde",
        bullets: [
          "Pošlete vlastní projekt panelů a střechy.",
          "Nebo nechte kontakt na stránce poptávky domu. Až katalog otevřeme, ozveme se.",
          "Hrubou stavbu se střechou běžného domu na hotové desce umíme smontovat do týdne. Tak to uvádíme i na stávajícím webu.",
        ],
      },
    ],
    cta: { href: "/poptavka/dum", label: "Chci vědět o katalogu" },
  },
  {
    path: "drevostavby/typove-domy/pripravujeme",
    title: "Typ domu",
    description: "Karta typového domu PENTI. Konkrétní typ, půdorys a cena budou doplněny po schválení katalogu.",
    eyebrow: "Typový dům",
    heading: "Karta domu čeká na podklady",
    lead: "Takto bude vypadat stránka jednoho typu: půdorys, zastavěná plocha, možné sklony střechy a rozsah dodávky. Údaje doplníme z katalogu.",
    notice: "Ukázková adresa /drevostavby/typove-domy/pripravujeme. Není to nabízený dům.",
    sections: [
      {
        heading: "Co na kartě bude",
        bullets: ["Půdorys a užitná plocha.", "Zastavěná plocha a počet podlaží.", "Povolené tvary a sklony střechy.", "Úroveň dodávky, kterou obchod opravdu nabízí."],
      },
    ],
    cta: { href: "/kontakt", label: "Napsat nám" },
  },
  {
    path: "drevostavby/panely-hruba-stavba",
    title: "Panely a hrubá stavba",
    description: "Sloupkové dřevostavební panely a hrubá stavba z výroby PENTI PREFAB. CNC opracování ve vytápěné hale, montáž na stavbě.",
    eyebrow: "Dřevostavby",
    heading: "Panely a hrubá stavba",
    lead: "Panely vyrábíme ve vytápěné hale a na stavbě je rychle smontujeme. Dodáme díl, nebo komplet stěn, stropu a střechy.",
    serviceName: "Výroba dřevostavebních panelů a hrubé stavby",
    sections: [
      {
        heading: "K čemu se hodí",
        bullets: [
          "Chcete hrubou stavbu a dokončovací práce si zařídíte sami.",
          "Potřebujete strop, obvodové stěny, nebo stěny s vazníky zakryté fólií.",
          "Chcete stěnové panely, strop a kompletní střechu včetně krytiny a klempíře.",
        ],
      },
      {
        heading: "Materiál",
        paragraphs: [
          "Panely vyrábíme z certifikovaného sušeného a hoblovaného řeziva a z KVH, tloušťky 45–80 mm a šířky 100–300 mm. Podle statiky doplňujeme lepené dřevo BSH a LVL. U izolací nad 300 mm používáme I-nosníky, u stropů nosníky s kovovou diagonálou. Stěny z vnější strany oplášťujeme statickou deskou, stropy převážně OSB nebo sádrovláknitou deskou. Panely procházejí certifikací Technického a zkušebního ústavu stavebního.",
        ],
      },
    ],
    cta: { href: "/kontakt", label: "Poptat panely" },
  },
  {
    path: "drevostavby/na-miru",
    title: "Dřevostavba na míru",
    description: "Dřevostavba podle vašeho projektu. PENTI vyrobí panely a střechu, katalog typů zatím nezveřejňujeme.",
    eyebrow: "Na míru",
    heading: "Dům podle vašeho projektu",
    lead: "Když typový dům nestačí, pracujeme podle dokumentace, kterou máte. Sbíráme program domu, pozemek a termín. Cenu bez podkladů neslibujeme.",
    sections: [
      {
        heading: "Co si připravit",
        bullets: ["Studii nebo projekt.", "Situaci pozemku a informaci o příjezdu jeřábu.", "Zda už máte územní rozhodnutí nebo stavební povolení.", "Představu o střeše a o tom, co máme dodat my a co zajistíte sami."],
      },
    ],
    cta: { href: "/poptavka/dum", label: "Nechat vzkaz k domu" },
  },
  {
    path: "realizace",
    title: "Realizace",
    description: "Realizace střech a konstrukcí PENTI PREFAB. Konkrétní zakázky s místem a rozměrem doplníme, až budou fotografie a souhlas.",
    eyebrow: "Realizace",
    heading: "Naše práce, až budeme mít podklady",
    lead: "Každá zakázka dostane vlastní stránku: obec, typ konstrukce a co přesně jsme udělali. Teď tu karty jen ukazují strukturu.",
    notice: "Nejsou tu vymyšlené stavby, metry ani ceny. Fotografie a údaje dodá firma.",
    sections: [
      {
        heading: "Jak bude karta vypadat",
        paragraphs: [
          "Například: „Ve Vlasaticích jsme postavili celé 2. podlaží ze dřeva: strop, krov i štíty.“ Takový text chce manuál značky. Stejnou větu použijeme, až k ní budeme mít fotografii a ověřené číslo.",
        ],
      },
    ],
    cta: { href: "/realizace/doplnime", label: "Otevřít ukázkovou kartu" },
  },
  {
    path: "realizace/doplnime",
    title: "Ukázka karty realizace",
    description: "Vzor stránky jedné realizace PENTI. Místo, rozsah a fotografie budou doplněny.",
    eyebrow: "Realizace · obec",
    heading: "Sem přijde název zakázky",
    lead: "Adresa stránky bude ve tvaru obec a typ konstrukce, aby šla najít i podle místa. Tahle adresa je jen vzor.",
    notice: "Ukázková karta. Není to dokončená stavba.",
    sections: [
      {
        heading: "Co na stránce bude",
        bullets: ["Obec a rok.", "Typ konstrukce: vazník, krov, panely, krytina nebo klempíř.", "Rozpětí nebo plocha, až je změříme.", "Fotografie dřeva nebo hotové střechy, bez cizích log a bez SPZ."],
      },
    ],
    cta: { href: "/poptavka/strecha", label: "Spočítat podobnou střechu" },
  },
  {
    path: "recenze",
    title: "Recenze",
    description: "Hodnocení zákazníků PENTI PREFAB zveřejníme jen s odkazem na zdroj. Vymyšlené citace na web nedáváme.",
    eyebrow: "Recenze",
    heading: "Recenze doplníme se zdrojem",
    lead: "Až budeme mít hodnocení, u každého bude odkaz, kde vzniklo. Bez zdroje ho nezveřejníme.",
    notice: "Na této stránce záměrně není žádná citace.",
    sections: [
      {
        heading: "Jak je pošlete",
        paragraphs: ["Stačí odkaz na hodnocení a souhlas se zveřejněním jména. Text sem přepíšeme beze změny významu."],
      },
    ],
    cta: { href: "/kontakt", label: "Napsat nám" },
  },
  {
    path: "material",
    title: "Materiál",
    description: "Řezivo a desky, se kterými PENTI PREFAB staví. Samostatný e-shop a výdejní doba se teprve doplňují.",
    eyebrow: "Materiál",
    heading: "Řezivo z naší výroby",
    lead: "Konstrukce vyrábíme z materiálu, který sami zpracováváme. Veřejný ceník a otevírací dobu výdeje na tomto webu zatím nemáme.",
    notice: "Ceny neuvádíme. E-shop řeziva běží jako samostatný projekt a po sjednocení vzhledu ho sem napojíme.",
    sections: [
      {
        heading: "S čím pracujeme",
        bullets: [
          "Sušené hoblované řezivo pro vazníky, běžně C24.",
          "KVH a lepené lamelové dřevo BSH.",
          "LVL tam, kde to vyžaduje statika.",
          "OSB a sádrovláknité desky na opláštění panelů.",
          "Latě a prkna pro střešní skladbu.",
        ],
      },
    ],
    cta: { href: "/kontakt", label: "Poptat materiál" },
  },
  {
    path: "poradna",
    title: "Poradna",
    description: "Krátké texty PENTI PREFAB: kdy vazník a kdy krov a co poslat k poptávce střechy.",
    eyebrow: "Poradna",
    heading: "Než pošlete poptávku",
    lead: "Dva krátké texty k rozhodnutí, které na stavbách potkáváme nejčastěji. Další články doplníme.",
    sections: [
      {
        heading: "Články",
        links: [
          { href: "/poradna/vaznik-nebo-krov", label: "Vazník, nebo krov?" },
          { href: "/poradna/co-pripravit-k-poptavce", label: "Co poslat k poptávce střechy" },
        ],
      },
    ],
    cta: { href: "/poradna/vaznik-nebo-krov", label: "Vazník, nebo krov" },
  },
  {
    path: "poradna/vaznik-nebo-krov",
    title: "Vazník, nebo krov",
    description: "Kdy se hodí příhradový vazník a kdy klasický krov. Praktické srovnání od PENTI PREFAB bez slibu konkrétní ceny.",
    eyebrow: "Poradna",
    heading: "Vazník, nebo krov?",
    lead: "Obojí je dřevěná nosná konstrukce střechy. Liší se tím, co pod střechou chcete dělat a jaké rozpětí překlenujete.",
    sections: [
      {
        heading: "Vazník",
        paragraphs: [
          "Příhradový vazník se hodí, když má střecha překlenout prostor bez sloupů uprostřed, a to až do 30 m. Pruty jsou ze sušeného hoblovaného řeziva a spoje tvoří styčníkové desky. Podkroví v příhradovině obvykle nebývá obytné v celé výšce, pokud s tím návrh od začátku nepočítá.",
        ],
      },
      {
        heading: "Krov",
        paragraphs: [
          "Klasický krov volíme, když má být dřevo vidět, když potřebujete velké podkroví, nadkrokevní izolaci, nebo opravujete starší střechu. Každou takovou konstrukci staticky posoudíme.",
        ],
      },
      {
        heading: "Co z toho plyne pro poptávku",
        paragraphs: ["Nemusíte se rozhodnout sami. V konfigurátoru uveďte, jestli podkroví má být obytné, a my navrhneme konstrukci. Když už konstrukce stojí, zaškrtněte jen krytinu nebo klempíře."],
      },
    ],
    cta: { href: "/poptavka/strecha", label: "Spočítat střechu" },
  },
  {
    path: "poradna/co-pripravit-k-poptavce",
    title: "Co poslat k poptávce",
    description: "Jaké podklady potřebuje PENTI PREFAB k nabídce střechy: adresa, rozměry nebo výkres, fotografie a termín.",
    eyebrow: "Poradna",
    heading: "Co poslat k poptávce střechy",
    lead: "Čím přesnější podklady, tím dřív vznikne nabídka. Bez adresy a bez rozměru nebo výkresu se ozveme s prosbou o doplnění.",
    sections: [
      {
        heading: "Minimum",
        bullets: [
          "Adresa stavby, obec a PSČ.",
          "Novostavba, nebo rekonstrukce.",
          "Co poptáváte: konstrukci, krytinu, klempíře, nebo všechno.",
          "Šířka, délka a sklon, nebo výkres.",
          "U rekonstrukce fotografie střechy.",
          "Jméno, telefon a e-mail.",
        ],
      },
      {
        heading: "Co zatím neslibujeme",
        paragraphs: ["Na webu neukazujeme cenu. Konfigurátor spočítá orientační plochu a délky. Závazná nabídka vznikne až po posouzení podkladů."],
      },
    ],
    cta: { href: "/poptavka/strecha", label: "Otevřít konfigurátor" },
  },
  {
    path: "o-nas",
    title: "O nás",
    description: "PENTI PREFAB s. r. o. navrhuje a dodává dřevěné střešní konstrukce z Ivanovic na Hané od roku 1992.",
    eyebrow: "O nás",
    heading: "Dřevěné konstrukce od roku 1992",
    lead: "Sídlíme v Ivanovicích na Hané. Navrhujeme a dodáváme dřevěné střešní konstrukce a k nim nově i pokrývačské a klempířské práce.",
    sections: [
      {
        heading: "Jak pracujeme",
        paragraphs: [
          "Používáme prověřené materiály a skladby. Levné výrobky do střechy nezabudováváme, protože z dlouhodobého hlediska vyjdou nejdráž. To je věta z našeho stávajícího webu a držíme se jí.",
          "Když chcete nabídku na střešní konstrukci, pošlete projekt a popište, co potřebujete. Když projekt není, stačí náčrt. Připravíme předběžný rozpočet, sejdeme se, stavbu zaměříme a po záloze zahájíme výrobu.",
        ],
      },
      {
        heading: "Lidé",
        bullets: [
          "Mgr. Michal Nikola, obchodní ředitel a majitel.",
          "Ing. Pavel Přikryl, obchod a cenové nabídky.",
          "René Menšík, vedoucí výroby a montáží.",
          "Ing. Ondřej Čuma, hlavní projektant.",
        ],
      },
    ],
    cta: { href: "/kontakt", label: "Kontakt" },
  },
  {
    path: "vyroba",
    title: "Výroba",
    description: "Výroba příhradových vazníků v hale PENTI PREFAB v Ivanovicích na Hané: pořez, CNC, lisování styčníkových desek a expedice.",
    eyebrow: "Výroba",
    heading: "Hala v Ivanovicích na Hané",
    lead: "Vazníky vyrábíme dopředu, uskladníme je a na stavbu odvezeme v domluvený termín. Skladování do expedice je u nás bez příplatku, jak uvádíme na stávajícím webu.",
    sections: [
      {
        heading: "Postup u vazníku",
        bullets: [
          "Z výrobních dat vznikne schéma pořezu. Operátor nachystá řezivo v požadovaných průřezech.",
          "CNC pila prvky vyřeže a bezkontaktně popíše.",
          "Na lisovacím stole nastavíme geometrii podle výkresu.",
          "Styčníkové desky uložíme podle kladečského plánu a zalisujeme.",
          "Hotovou dávku přesuneme do venkovního skladu a po dokončení střechy ji expedujeme autem s hydraulickou rukou.",
        ],
      },
    ],
    cta: { href: "/technologie", label: "Technologie" },
  },
  {
    path: "technologie",
    title: "Technologie",
    description: "CNC opracování, statický návrh a sušené řezivo ve výrobě PENTI PREFAB. Bez chemické ochrany tam, kde to sušení dovolí.",
    eyebrow: "Technologie",
    heading: "Přesný návrh a CNC opracování",
    lead: "Návrh konstrukce a výrobní dokumentace vznikají ve specializovaném statickém softwaru. Data z něj jdou rovnou do pily.",
    sections: [
      {
        heading: "Na čem stavíme",
        bullets: [
          "Statický výpočet před cenovou nabídkou a znovu před výrobou.",
          "CNC vyřezání prvků včetně popisu, aby se omezila chyba při skládání.",
          "Lisování styčníkových desek u vazníků.",
          "Sušené hoblované řezivo, které dál nesesychá tak jako nevysušené a u vazníků se nemusí chemicky ošetřovat.",
        ],
      },
    ],
    cta: { href: "/vyroba", label: "Podívat se na výrobu" },
  },
  {
    path: "ochrana-udaju",
    title: "Ochrana osobních údajů",
    description: "Zásady zpracování osobních údajů na webu PENTI PREFAB: poptávka střechy, kontakt a volitelná analytika.",
    eyebrow: "Právní",
    heading: "Ochrana osobních údajů",
    lead: "Správcem je PENTI PREFAB s. r. o., IČ 27712061, Osvoboditelů 609, 683 23 Ivanovice na Hané, zapsaná u Krajského soudu v Brně, oddíl C, vložka 53843. Pište na info@penti.cz.",
    sections: [
      {
        heading: "Poptávka a kontakt",
        paragraphs: [
          "U poptávky zpracujeme údaje, které sami vyplníte: jméno, e-mail, telefon, roli, adresu stavby, parametry střechy, poznámku a přílohy. Slouží k přípravě nabídky a k jednání o smlouvě. Právním základem jsou kroky před uzavřením smlouvy. Bez kontaktu poptávku nevyřídíme.",
          "Rozpracovanou poptávku ukládáme jen ve vašem prohlížeči, dokud ji neodešlete. Po odeslání ji zapíšeme do databáze, až bude připojené úložiště. Do té doby zůstane jen u vás a v souboru JSON, který si můžete stáhnout.",
        ],
      },
      {
        heading: "Analytika",
        paragraphs: [
          "Google Tag Manager spustíme teprve po souhlasu v liště. Do té doby se značky nenačítají. Souhlas můžete odvolat vymazáním volby v tomto prohlížeči, klíč penti_consent.",
        ],
      },
      {
        heading: "Jak dlouho údaje držíme",
        paragraphs: [
          "Poptávku držíme po dobu jednání a následně po dobu, kterou ukládají účetní a archivační předpisy, pokud z poptávky vznikne zakázka. Máte právo na přístup, opravu, omezení, námitku a stížnost u Úřadu pro ochranu osobních údajů.",
        ],
      },
    ],
  },
  {
    path: "cookies",
    title: "Cookies",
    description: "Jaké cookies a úložiště používá nový web PENTI PREFAB a jak souhlas odvolat.",
    eyebrow: "Právní",
    heading: "Cookies a úložiště prohlížeče",
    lead: "Rozpracovanou poptávku a volbu souhlasu ukládáme do localStorage v tomto prohlížeči. Není to cookie třetí strany.",
    sections: [
      {
        heading: "Nezbytné",
        bullets: [
          "penti.inquiry.draft.v1 — rozpracovaná poptávka střechy, jen ve vašem prohlížeči, dokud ji nesmažete.",
          "penti_consent — vaše volba přijmout, nebo odmítnout analytiku.",
        ],
      },
      {
        heading: "Analytika a marketing",
        paragraphs: [
          "Až po souhlasu načteme Google Tag Manager GTM-NXDXJL6X, který na stávajícím webu spravuje měření. Bez souhlasu se nenačte. Podrobnosti o stávajících cookies jsou i na https://penti.cz/cookies.",
        ],
      },
    ],
  },
  {
    path: "obchodni-podminky",
    title: "Obchodní podmínky",
    description: "Obchodní podmínky PENTI PREFAB. Platné znění je v PDF na stávajícím webu, dokud soubor nepřenesieme sem.",
    eyebrow: "Právní",
    heading: "Obchodní podmínky",
    lead: "Všeobecné obchodní podmínky, prohlášení o vlastnostech vazníků a certifikáty jsou ke stažení na stávajícím webu v části O nás.",
    notice: "PDF sem zatím nekopírujeme. Odkaz vede na stávající stránku, kde soubory jsou.",
    sections: [
      {
        heading: "Kde je najdete",
        paragraphs: ["Otevřete https://penti.cz/o-penti a v části Ke stažení vyberte všeobecné obchodní podmínky a další dokumenty. Až soubory dostaneme, vystavíme je přímo tady."],
      },
    ],
  },
];

export function getPage(path: string | undefined): SitePage | undefined {
  return pages.find((page) => page.path === path);
}
