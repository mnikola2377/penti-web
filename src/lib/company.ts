/** Údaje ověřené na https://penti.cz (listopad 2026). Nic dalšího nedoplňujeme. */
export const company = {
  name: "PENTI PREFAB s. r. o.",
  short: "PENTI PREFAB",
  street: "Osvoboditelů 609",
  city: "Ivanovice na Hané",
  postal: "683 23",
  country: "CZ",
  ico: "27712061",
  dic: "CZ27712061",
  court: "Krajský soud v Brně, oddíl C, vložka 53843",
  phoneDisplay: "+420 777 805 784",
  phoneTel: "+420777805784",
  email: "info@penti.cz",
  inquiries: "poptavky@penti.cz",
  since: 1992,
  url: "https://penti.cz",
  instagram: "https://www.instagram.com/pentiprefab/",
  facebook: "https://www.facebook.com/pentiprefab",
  reservio: "https://penti-prefab-s-r-o.reservio.com/",
  gtmId: "GTM-NXDXJL6X",
  people: [
    {
      name: "Mgr. Michal Nikola",
      role: "obchodní ředitel, majitel společnosti",
      email: "m.nikola@penti.cz",
      phoneDisplay: "+420 777 805 784",
      phoneTel: "+420777805784",
    },
    {
      name: "Ing. Pavel Přikryl",
      role: "obchod, cenové nabídky",
      email: "prikryl@penti.cz",
      phoneDisplay: "+420 735 987 377",
      phoneTel: "+420735987377",
    },
    {
      name: "René Menšík",
      role: "vedoucí výroby a montáží",
      email: "mensik@penti.cz",
      phoneDisplay: "+420 777 312 039",
      phoneTel: "+420777312039",
    },
    {
      name: "Ing. Ondřej Čuma",
      role: "hlavní projektant",
      email: "cuma@penti.cz",
    },
  ],
} as const;

export const nav = [
  {
    label: "Střechy",
    href: "/strechy",
    children: [
      { label: "Příhradové vazníky", href: "/strechy/vazniky" },
      { label: "Klasické krovy", href: "/strechy/krovy" },
      { label: "Pokrývačství", href: "/strechy/pokryvacstvi" },
      { label: "Klempířství", href: "/strechy/klempirstvi" },
      { label: "Kompletní střecha", href: "/strechy/kompletni-strecha" },
    ],
  },
  {
    label: "Dřevostavby",
    href: "/drevostavby",
    children: [
      { label: "Typové domy", href: "/drevostavby/typove-domy" },
      { label: "Panely a hrubá stavba", href: "/drevostavby/panely-hruba-stavba" },
      { label: "Dům na míru", href: "/drevostavby/na-miru" },
    ],
  },
  { label: "Realizace", href: "/realizace" },
  { label: "Poradna", href: "/poradna" },
  {
    label: "O nás",
    href: "/o-nas",
    children: [
      { label: "O firmě", href: "/o-nas" },
      { label: "Výroba", href: "/vyroba" },
      { label: "Technologie", href: "/technologie" },
      { label: "Kontakt", href: "/kontakt" },
    ],
  },
] as const;
