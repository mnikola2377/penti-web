import type { ImageMetadata } from "astro";
import krovNebe from "../assets/foto/album1-014.jpg";
import krovNebeSirsi from "../assets/foto/album1-012.jpg";
import krovCelek from "../assets/foto/album1-015.jpg";
import krovBsh from "../assets/foto/album1-071.jpg";
import skelet from "../assets/foto/album1-052.jpg";
import pergola from "../assets/foto/album2-028.jpg";
import pergolaDalky from "../assets/foto/album2-030.jpg";
import vaznikyNebe from "../assets/foto/album3-003.jpg";
import vaznikJerab from "../assets/foto/album3-033.jpg";
import podkrovi from "../assets/foto/album3-018.jpg";
import bobrovkaKominy from "../assets/foto/historie1-008.jpg";
import bobrovkaHotovo from "../assets/foto/historie1-015.jpg";
import bobrovkaDetail from "../assets/foto/historie1-022.jpg";
import opravaKrovu from "../assets/foto/historie1-029.jpg";
import altan from "../assets/foto/historie2-001.jpg";
import pavilon from "../assets/foto/historie3-007.jpg";
import stodola from "../assets/foto/historie4-001.jpg";
import krovPredValkou from "../assets/foto/historie4-002.jpg";
import pila from "../assets/foto/historie4-006.jpg";
import lateDevadesata from "../assets/foto/historie4-026.jpg";
import strechaDevadesata from "../assets/foto/historie4-030.jpg";
import areal from "../assets/foto/historie4-034.jpg";

export interface Foto {
  src: ImageMetadata;
  alt: string;
}

export interface Realizace {
  slug: string;
  title: string;
  year: string;
  kind: string;
  lead: string;
  cover: Foto;
  photos: Foto[];
  featured: boolean;
  /** Když chybí, na kartě zůstane „Doplní firma“. */
  obec?: string;
  /** null = rozměr neuvádět. Když chybí, na kartě zůstane „Doplní firma“. */
  rozmer?: string | null;
}

export const chybiObec = "Doplní firma";
export const chybiRozmer = "Doplní firma";

export const hero: Foto = {
  src: krovNebe,
  alt: "Klasický krov ze světlého dřeva proti modré obloze, pohled zespodu do vazby a kleštin.",
};

export const sluzby = {
  konstrukce: {
    src: krovCelek,
    alt: "Sedlový klasický krov ze světlého dřeva, uprostřed ocelová spojka, v pozadí stromy.",
  },
  pokryvacstvi: {
    src: bobrovkaDetail,
    alt: "Položená bobrovka na střeše a oplechovaný komín, zakázka z roku 2007.",
  },
  klempirstvi: {
    src: bobrovkaKominy,
    alt: "Oplechování dvou komínů v bobrovce při pokládce krytiny v roce 2007.",
  },
  drevostavby: {
    src: skelet,
    alt: "Skelet dřevostavby se štítem a stropem z desek, montáž na připravených patkách.",
  },
} satisfies Record<string, Foto>;

export const stranky: Record<string, Foto[]> = {
  "strechy/vazniky": [
    {
      src: vaznikyNebe,
      alt: "Řada příhradových vazníků na betonovém věnci proti modré obloze.",
    },
    {
      src: podkrovi,
      alt: "Podkroví s příhradovými vazníky, styčníkovými deskami a střešními okny.",
    },
  ],
  "strechy/krovy": [
    {
      src: krovNebe,
      alt: "Detail klasického krovu ze světlého dřeva proti obloze.",
    },
    {
      src: krovBsh,
      alt: "Štítová vazba z lepeného dřeva nad rozestavěným zdivem.",
    },
  ],
  "strechy/pokryvacstvi": [
    {
      src: bobrovkaDetail,
      alt: "Bobrovka a oplechování komína na střeše z roku 2007.",
    },
    {
      src: lateDevadesata,
      alt: "Laťování a pojistná fólie na sedlové střeše v devadesátých letech, na montérkách je nápis Penti.",
    },
  ],
  "strechy/klempirstvi": [
    {
      src: bobrovkaKominy,
      alt: "Klempířské lemování komínů uprostřed pokládky bobrovky, rok 2007.",
    },
    {
      src: bobrovkaDetail,
      alt: "Hotové oplechování komína v ploše bobrovky.",
    },
  ],
  "strechy/kompletni-strecha": [
    {
      src: vaznikJerab,
      alt: "Jeřáb zvedá příhradový vazník nad rozestavěný dům.",
    },
  ],
  drevostavby: [
    {
      src: skelet,
      alt: "Hrubá dřevěná konstrukce domu se štítovou vazbou během montáže.",
    },
  ],
  "drevostavby/panely-hruba-stavba": [
    {
      src: skelet,
      alt: "Skelet dřevostavby na patkách, s podlahou z desek a rozpracovaným krovem.",
    },
  ],
};

export const realizace: Realizace[] = [
  {
    slug: "prihradove-vazniky-2017-2023",
    title: "Příhradové vazníky, 2017–2023",
    year: "2017–2023",
    kind: "Příhradové vazníky",
    lead: "Montáž příhradových vazníků z alba zakázek mezi lety 2017 a 2023. Jednotlivé roky u fotek v podkladech nejsou, proto uvádíme celé rozpětí.",
    featured: true,
    cover: {
      src: vaznikyNebe,
      alt: "Příhradové vazníky osazené na věnci, pohled zespodu proti obloze.",
    },
    photos: [
      {
        src: vaznikyNebe,
        alt: "Příhradové vazníky na betonovém věnci, mezi nimi prosvítá obloha.",
      },
      {
        src: vaznikJerab,
        alt: "Hydraulická ruka zvedá světlý příhradový vazník nad stavbu.",
      },
      {
        src: podkrovi,
        alt: "Hotové podkroví: vazníky, záklopy a řada střešních oken.",
      },
    ],
  },
  {
    slug: "klasicky-krov-2008-2023",
    title: "Klasický krov proti obloze, 2008–2023",
    year: "2008–2023",
    kind: "Klasický krov",
    lead: "Pohledy do klasického krovu z alba zakázek mezi lety 2008 a 2023. Přesný rok jednotlivých snímků v podkladech není.",
    featured: true,
    cover: {
      src: krovNebeSirsi,
      alt: "Klasický krov z hranolů proti obloze, dole cihlový štít.",
    },
    photos: [
      {
        src: krovNebe,
        alt: "Hustá vazba klasického krovu ze světlého dřeva proti modré obloze.",
      },
      {
        src: krovNebeSirsi,
        alt: "Krokve, kleštiny a ocelová spojka klasického krovu, v pozadí zdivo.",
      },
      {
        src: krovCelek,
        alt: "Celý sedlový krov od pozednice po hřeben, za ním borovice.",
      },
    ],
  },
  {
    slug: "tezek-krov-z-lepeného-dreva",
    title: "Těžký krov z lepeného dřeva, 2008–2023",
    year: "2008–2023",
    kind: "Krov z lepeného dřeva",
    lead: "Štítová vazba z lepeného dřeva. Snímek je z alba klasických krovů, roky 2008 až 2023. Přesnější datum u fotky nemáme.",
    featured: true,
    cover: {
      src: krovBsh,
      alt: "Velká štítová vazba z lepeného dřeva proti obloze, pod ní lešení a zdivo.",
    },
    photos: [
      {
        src: krovBsh,
        alt: "Štít z lepených hranolů: krokve, sloupky a vodorovný trám nad stavbou.",
      },
    ],
  },
  {
    slug: "skelet-drevostavby",
    title: "Skelet dřevostavby, 2008–2023",
    year: "2008–2023",
    kind: "Dřevostavba",
    lead: "Skelet domu se štítem během montáže. Fotka je z alba klasických krovů z let 2008 až 2023, bližší rok u snímku není.",
    featured: true,
    cover: {
      src: skelet,
      alt: "Dřevěný skelet domu na patkách, s rozpracovanou štítovou vazbou.",
    },
    photos: [
      {
        src: skelet,
        alt: "Celkový pohled na skelet dřevostavby, strop z desek a štít ve stavbě.",
      },
    ],
  },
  {
    slug: "drevena-pergola-2025",
    title: "Dřevěná pergola u moderního domu, 2025",
    year: "2025",
    kind: "Pergola",
    lead: "Hotová dřevěná pergola u moderního domu. Podle data snímku z 9. září 2025.",
    featured: true,
    cover: {
      src: pergola,
      alt: "Dřevěná pergola z hranolů podél prosklené fasády moderního domu, září 2025.",
    },
    photos: [
      {
        src: pergola,
        alt: "Pohled podél pergoly: dřevěné trámy, sloupy a kamenná dlažba.",
      },
      {
        src: pergolaDalky,
        alt: "Pergola u domu s velkými okny, dřevěné sloupy a zastřešení z trámů.",
      },
    ],
  },
  {
    slug: "pokryvacstvi-klempirstvi-2007",
    title: "Rekonstrukce střechy předzámčí, Ivanovice na Hané",
    year: "26. 2. 2007",
    kind: "Pokrývačství a klempířství",
    lead: "26. února 2007. Pokládka bobrovky, klempířina u komínů a oprava krovu.",
    obec: "Ivanovice na Hané",
    rozmer: null,
    featured: true,
    cover: {
      src: bobrovkaDetail,
      alt: "Plocha bobrovky s oplechovaným komínem, rekonstrukce střechy předzámčí v Ivanovicích na Hané, 26. února 2007.",
    },
    photos: [
      {
        src: bobrovkaDetail,
        alt: "Detail bobrovky a růžového oplechování komína.",
      },
      {
        src: bobrovkaKominy,
        alt: "Pokládka bobrovky kolem dvou oplechovaných komínů.",
      },
      {
        src: bobrovkaHotovo,
        alt: "Hotová střecha s bobrovkou na světlé budově s věží, rok 2007.",
      },
      {
        src: opravaKrovu,
        alt: "Oprava starého krovu: nové hranoly mezi původními krokvemi, únor 2007.",
      },
    ],
  },
  {
    slug: "pavilon-z-lepeného-dreva-2011-2012",
    title: "Pavilon z lepeného dřeva, 2011–2012",
    year: "2011–2012",
    kind: "Lepené dřevo",
    lead: "Stavba pavilonu z lepeného dřeva od prosince 2011 do dubna 2012. V podkladech je zakázka vedená jako Vincentium.",
    featured: false,
    cover: {
      src: pavilon,
      alt: "Rozestavěný pavilon z tmavého lepeného dřeva, sloupy, vazby a ocelové patky.",
    },
    photos: [
      {
        src: pavilon,
        alt: "Nosná konstrukce pavilonu z lepených hranolů na betonových patkách.",
      },
    ],
  },
  {
    slug: "sestiboky-altan-2016",
    title: "Šestiboký altán, 2016",
    year: "2016",
    kind: "Altán",
    lead: "Montáž šestibokého altánu 11. dubna 2016. Obec v popisku fotky neuvádíme, v podkladech je jen název alba.",
    featured: false,
    cover: {
      src: altan,
      alt: "Šestiboký dřevěný rám altánu na sloupkách během montáže 11. dubna 2016.",
    },
    photos: [
      {
        src: altan,
        alt: "Sestavený šestiboký věnec altánu na kovových patkách v trávě.",
      },
    ],
  },
];

export function realizacePodleSlug(slug: string | undefined): Realizace | undefined {
  return realizace.find((item) => item.slug === slug);
}

export interface Obdobi {
  id: string;
  label: string;
  title: string;
  text: string;
  photos: Foto[];
}

export const historie: Obdobi[] = [
  {
    id: "pred-valkou",
    label: "Před válkou",
    title: "Firma pradědečka Oskara Funtíčka",
    text: "PENTI navazuje na firmu pradědečka Oskara Funtíčka. Z té doby máme černobílé snímky krovu stodoly, krovu u zděného domu a pořezu na rámové pile. Přesný rok neznáme, proto ho neuvádíme.",
    photos: [
      {
        src: stodola,
        alt: "Černobílá fotografie rozestavěného krovu stodoly v polích. Přesný rok není známý.",
      },
      {
        src: krovPredValkou,
        alt: "Černobílá fotografie valbového krovu na zděném domě za branou. Přesný rok není známý.",
      },
      {
        src: pila,
        alt: "Černobílá fotografie rámové pily a pořezu klád v dílně. Přesný rok není známý.",
      },
    ],
  },
  {
    id: "devadesata",
    label: "90. léta",
    title: "Počátky PENTI",
    text: "Barevné snímky z devadesátých let: laťování střechy a hotová červená krytina s dřevěnou pergolou. Na jedné montérce je nápis Penti. Černobílý snímek areálu je z počátků firmy, ne z doby před válkou. Jména lidí na fotkách neuvádíme.",
    photos: [
      {
        src: lateDevadesata,
        alt: "Laťování sedlové střechy v devadesátých letech, na modré montérce je nápis Penti.",
      },
      {
        src: strechaDevadesata,
        alt: "Hotová červená střecha a dřevěná pergola u světlého domu, devadesátá léta.",
      },
      {
        src: areal,
        alt: "Černobílý snímek areálu z počátků PENTI, na konstrukci je nápis Penti.",
      },
    ],
  },
  {
    id: "predzamci-2007",
    label: "26. 2. 2007",
    title: "Rekonstrukce střechy předzámčí, Ivanovice na Hané",
    text: "26. února 2007, rekonstrukce střechy předzámčí v Ivanovicích na Hané: pokládka bobrovky, klempířina u komínů a oprava krovu.",
    photos: [
      {
        src: bobrovkaDetail,
        alt: "Bobrovka a oplechovaný komín, rekonstrukce střechy předzámčí v Ivanovicích na Hané, 26. února 2007.",
      },
      {
        src: bobrovkaHotovo,
        alt: "Hotová střecha s bobrovkou na budově s věží, zakázka z roku 2007.",
      },
      {
        src: opravaKrovu,
        alt: "Výměna prvků ve starém krovu při zakázce z února 2007.",
      },
    ],
  },
  {
    id: "vincentium",
    label: "2011–2012",
    title: "Vincentium, pavilon z lepeného dřeva",
    text: "Od prosince 2011 do dubna 2012 vznikl pavilon z lepeného dřeva. V podkladech je zakázka vedená jako Vincentium.",
    photos: [
      {
        src: pavilon,
        alt: "Pavilon z lepeného dřeva ve stavbě, sloupy a šikmé vzpěry, přelom let 2011 a 2012.",
      },
    ],
  },
  {
    id: "altan",
    label: "2016",
    title: "Šestiboký altán",
    text: "11. dubna 2016 se montoval šestiboký altán. Obec k fotce v podkladech neuvádíme.",
    photos: [
      {
        src: altan,
        alt: "Montáž šestibokého dřevěného rámu altánu na kovových patkách, 11. dubna 2016.",
      },
    ],
  },
  {
    id: "dnes",
    label: "Dnes",
    title: "Vazníky, krovy a pergoly",
    text: "Dnes vyrábíme v Ivanovicích na Hané. Na snímcích je montáž příhradových vazníků z let 2017 až 2023 a pergola z 9. září 2025.",
    photos: [
      {
        src: vaznikyNebe,
        alt: "Současná montáž příhradových vazníků proti obloze, album z let 2017 až 2023.",
      },
      {
        src: pergola,
        alt: "Dřevěná pergola u moderního domu, snímek z 9. září 2025.",
      },
    ],
  },
];
