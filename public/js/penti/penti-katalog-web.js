/* ==========================================================================
   PENTI — VEŘEJNÝ KATALOG KRYTIN A OKAPŮ
   --------------------------------------------------------------------------
   TENTO SOUBOR SE NEUPRAVUJE RUČNĚ.
   Vygeneroval ho `node nastroje/katalog-web.js` z interních ceníků
   dne 2026-11-25. Když do ceníku přibude model nebo barva, spusť generátor
   znovu — jinak bude web nabízet loňský sortiment.

   Jsou tu JEN NÁZVY: výrobce, model, povrch, barva a její odstín.
   Nic z obchodních podmínek — ty zůstávají v interních cenících, které
   se do webové sady nepřidávají.
   ========================================================================== */
(function (global) {
"use strict";
global.PENTI_KATALOG_WEB = {
 "tvary": [
  {
   "kod": "klasicka",
   "nazev": "Klasická",
   "popis": "Tradiční profil s vlnou a drážkou",
   "materialy": [
    {
     "kod": "keramická",
     "nazev": "Keramická"
    }
   ]
  },
  {
   "kod": "plocha",
   "nazev": "Plochá",
   "popis": "Rovný povrch bez vlny, moderní vzhled",
   "materialy": [
    {
     "kod": "betonová",
     "nazev": "Betonová"
    },
    {
     "kod": "keramická",
     "nazev": "Keramická"
    },
    {
     "kod": "plechová",
     "nazev": "Plechová"
    }
   ]
  },
  {
   "kod": "plocha_vlna",
   "nazev": "Plochá s mírnou vlnou",
   "popis": "Rovná taška s mělkou vlnou — klidná, ale ne úplně hladká",
   "materialy": [
    {
     "kod": "keramická",
     "nazev": "Keramická"
    }
   ]
  },
  {
   "kod": "mirna_vlna",
   "nazev": "Mírná vlna",
   "popis": "Jemné zvlnění, klidný celkový dojem",
   "materialy": [
    {
     "kod": "betonová",
     "nazev": "Betonová"
    },
    {
     "kod": "plechová",
     "nazev": "Plechová"
    }
   ]
  },
  {
   "kod": "velka_vlna",
   "nazev": "Velká vlna",
   "popis": "Výrazná vlna, plastický stín",
   "materialy": [
    {
     "kod": "keramická",
     "nazev": "Keramická"
    }
   ]
  }
 ],
 "krytiny": [
  {
   "kod": "classic",
   "nazev": "Bramac Classic",
   "znacka": "Bramac",
   "material": "betonová",
   "tvar": "mirna_vlna",
   "vyrobce": "Bramac betonová",
   "povrchy": [
    {
     "kod": "star",
     "nazev": "Classic Star",
     "barvy": [
      {
       "kod": "mocca_metalic",
       "nazev": "mocca metalic"
      },
      {
       "kod": "granit_metalic",
       "nazev": "granit metalic"
      }
     ]
    },
    {
     "kod": "protectorplus",
     "nazev": "Classic Protector Plus",
     "barvy": [
      {
       "kod": "cihlove_cervena",
       "nazev": "cihlově červená"
      },
      {
       "kod": "cervenohneda",
       "nazev": "červenohnědá"
      },
      {
       "kod": "tmavohneda",
       "nazev": "tmavohnědá"
      },
      {
       "kod": "antracit",
       "nazev": "antracit"
      },
      {
       "kod": "ebenove_cerna",
       "nazev": "ebenově černá"
      }
     ]
    },
    {
     "kod": "novo",
     "nazev": "Classic NOVO",
     "barvy": [
      {
       "kod": "cihlove_cervena",
       "nazev": "cihlově červená"
      },
      {
       "kod": "cervenohneda",
       "nazev": "červenohnědá"
      },
      {
       "kod": "tmavohneda",
       "nazev": "tmavohnědá"
      },
      {
       "kod": "bridlicove_cerna",
       "nazev": "břidlicově černá"
      }
     ]
    }
   ]
  },
  {
   "kod": "tegalit",
   "nazev": "Bramac Tegalit",
   "znacka": "Bramac",
   "material": "betonová",
   "tvar": "plocha",
   "vyrobce": "Bramac betonová",
   "povrchy": [
    {
     "kod": "star",
     "nazev": "Tegalit Star",
     "barvy": [
      {
       "kod": "zinkove_seda",
       "nazev": "zinkově šedá"
      },
      {
       "kod": "granit_metalic",
       "nazev": "granit metalic"
      },
      {
       "kod": "ebenove_cerna",
       "nazev": "ebenově černá"
      }
     ]
    },
    {
     "kod": "protectorplus",
     "nazev": "Tegalit Protector PLUS",
     "barvy": [
      {
       "kod": "antracit",
       "nazev": "antracit"
      }
     ]
    },
    {
     "kod": "novo",
     "nazev": "Tegalit NOVO",
     "barvy": [
      {
       "kod": "bridlicove_cerna",
       "nazev": "břidlicově černá"
      }
     ]
    }
   ]
  },
  {
   "kod": "granat13",
   "nazev": "Bramac Granát 13",
   "znacka": "Bramac",
   "material": "keramická",
   "tvar": "klasicka",
   "vyrobce": "Bramac keramická",
   "povrchy": [
    {
     "kod": "rezna",
     "nazev": "Granát 13 – režná",
     "barvy": [
      {
       "kod": "rezna",
       "nazev": "režná"
      }
     ]
    },
    {
     "kod": "engoba",
     "nazev": "Granát 13 – engoba",
     "barvy": [
      {
       "kod": "engoba_medena",
       "nazev": "engoba měděná"
      },
      {
       "kod": "engoba_antracitova",
       "nazev": "engoba antracitová"
      }
     ]
    },
    {
     "kod": "glazura",
     "nazev": "Granát 13 – glazura",
     "barvy": [
      {
       "kod": "glazura_cerna",
       "nazev": "glazura černá"
      },
      {
       "kod": "glazura_cervenohneda",
       "nazev": "glazura červenohnědá"
      },
      {
       "kod": "glazura_kastanova",
       "nazev": "glazura kaštanově hnědá"
      }
     ]
    }
   ]
  },
  {
   "kod": "topas13",
   "nazev": "Bramac Topas 13",
   "znacka": "Bramac",
   "material": "keramická",
   "tvar": "plocha_vlna",
   "vyrobce": "Bramac keramická",
   "povrchy": [
    {
     "kod": "rezna",
     "nazev": "Topas 13 – režná",
     "barvy": [
      {
       "kod": "rezna",
       "nazev": "režná"
      }
     ]
    },
    {
     "kod": "engoba",
     "nazev": "Topas 13 – engoba",
     "barvy": [
      {
       "kod": "engoba_medena",
       "nazev": "engoba měděná"
      },
      {
       "kod": "engoba_hneda",
       "nazev": "engoba hnědá"
      }
     ]
    },
    {
     "kod": "engoba_probarvena",
     "nazev": "Topas 13 – engoba s probarveným střepem",
     "barvy": [
      {
       "kod": "engoba_antracitova",
       "nazev": "engoba antracitová"
      }
     ]
    },
    {
     "kod": "glazura",
     "nazev": "Topas 13 – glazura",
     "barvy": [
      {
       "kod": "glazura_cervenohneda",
       "nazev": "glazura červenohnědá"
      },
      {
       "kod": "glazura_kastanova",
       "nazev": "glazura kaštanově hnědá"
      },
      {
       "kod": "glazura_tmavohneda",
       "nazev": "glazura tmavohnědá"
      },
      {
       "kod": "glazura_tmave_seda",
       "nazev": "glazura tmavě šedá"
      }
     ]
    },
    {
     "kod": "glazura_probarvena",
     "nazev": "Topas 13 – glazura s probarveným střepem",
     "barvy": [
      {
       "kod": "glazura_cerna",
       "nazev": "glazura černá"
      }
     ]
    }
   ]
  },
  {
   "kod": "bramacmax",
   "nazev": "Bramac MAX",
   "znacka": "Bramac",
   "material": "betonová",
   "tvar": "mirna_vlna",
   "vyrobce": "Bramac betonová",
   "povrchy": [
    {
     "kod": "zakladni",
     "nazev": "Bramac MAX",
     "barvy": [
      {
       "kod": "cihlove_cervena",
       "nazev": "cihlově červená"
      },
      {
       "kod": "cervenohneda",
       "nazev": "červenohnědá"
      },
      {
       "kod": "ebenove_cerna",
       "nazev": "ebenově černá"
      }
     ]
    }
   ]
  },
  {
   "kod": "viva",
   "nazev": "Bramac Viva",
   "znacka": "Bramac",
   "material": "betonová",
   "tvar": "mirna_vlna",
   "vyrobce": "Bramac betonová",
   "povrchy": [
    {
     "kod": "zakladni",
     "nazev": "Viva",
     "barvy": [
      {
       "kod": "cihlove_cervena",
       "nazev": "cihlově červená"
      },
      {
       "kod": "antik",
       "nazev": "antik"
      }
     ]
    }
   ]
  },
  {
   "kod": "moravska",
   "nazev": "Bramac Moravská taška Protector PLUS",
   "znacka": "Bramac",
   "material": "betonová",
   "tvar": "mirna_vlna",
   "vyrobce": "Bramac betonová",
   "povrchy": [
    {
     "kod": "zakladni",
     "nazev": "Moravská taška Protector PLUS",
     "barvy": [
      {
       "kod": "cihlove_cervena",
       "nazev": "cihlově červená"
      },
      {
       "kod": "cervenohneda",
       "nazev": "červenohnědá"
      },
      {
       "kod": "tmavohneda",
       "nazev": "tmavohnědá"
      },
      {
       "kod": "ebenove_cerna",
       "nazev": "ebenově černá"
      }
     ]
    }
   ]
  },
  {
   "kod": "granat11",
   "nazev": "Bramac Granát 11",
   "znacka": "Bramac",
   "material": "keramická",
   "tvar": "klasicka",
   "vyrobce": "Bramac keramická",
   "povrchy": [
    {
     "kod": "rezna",
     "nazev": "Granát 11 – režná",
     "barvy": [
      {
       "kod": "rezna",
       "nazev": "režná"
      }
     ]
    },
    {
     "kod": "engoba",
     "nazev": "Granát 11 – engoba",
     "barvy": [
      {
       "kod": "engoba_medena",
       "nazev": "engoba měděná"
      },
      {
       "kod": "engoba_antracitova",
       "nazev": "engoba antracitová"
      }
     ]
    }
   ]
  },
  {
   "kod": "rubin9",
   "nazev": "Bramac Rubín 9",
   "znacka": "Bramac",
   "material": "keramická",
   "tvar": "velka_vlna",
   "vyrobce": "Bramac keramická",
   "povrchy": [
    {
     "kod": "rezna",
     "nazev": "Rubín 9 – režná",
     "barvy": [
      {
       "kod": "rezna",
       "nazev": "režná"
      }
     ]
    },
    {
     "kod": "engoba",
     "nazev": "Rubín 9 – engoba",
     "barvy": [
      {
       "kod": "engoba_medena",
       "nazev": "engoba měděná"
      },
      {
       "kod": "engoba_antracitova",
       "nazev": "engoba antracitová"
      }
     ]
    },
    {
     "kod": "glazura",
     "nazev": "Rubín 9 – glazura",
     "barvy": [
      {
       "kod": "glazura_cerna",
       "nazev": "glazura černá"
      }
     ]
    }
   ]
  },
  {
   "kod": "contiton",
   "nazev": "Tondach Contiton 12",
   "znacka": "Tondach",
   "material": "keramická",
   "tvar": "plocha_vlna",
   "vyrobce": "Tondach keramická",
   "povrchy": [
    {
     "kod": "rezna",
     "nazev": "režná",
     "barvy": [
      {
       "kod": "rezna",
       "nazev": "režná"
      }
     ]
    },
    {
     "kod": "engoba",
     "nazev": "engoba",
     "barvy": [
      {
       "kod": "engoba_medena",
       "nazev": "engoba měděná"
      },
      {
       "kod": "engoba_grafen",
       "nazev": "engoba grafen"
      },
      {
       "kod": "engoba_cerna",
       "nazev": "engoba černá"
      },
      {
       "kod": "engoba_tm_hneda",
       "nazev": "engoba tmavě hnědá"
      }
     ]
    },
    {
     "kod": "glazura_amadeus",
     "nazev": "glazura Amadeus",
     "barvy": [
      {
       "kod": "glazura_amadeus",
       "nazev": "glazura Amadeus"
      }
     ]
    }
   ]
  },
  {
   "kod": "planoton11",
   "nazev": "Tondach Planoton 11",
   "znacka": "Tondach",
   "material": "keramická",
   "tvar": "plocha",
   "vyrobce": "Tondach keramická",
   "povrchy": [
    {
     "kod": "rezna",
     "nazev": "režná",
     "barvy": [
      {
       "kod": "rezna",
       "nazev": "režná"
      }
     ]
    },
    {
     "kod": "engoba",
     "nazev": "engoba",
     "barvy": [
      {
       "kod": "engoba_cervena",
       "nazev": "engoba červená"
      },
      {
       "kod": "engoba_hneda",
       "nazev": "engoba hnědá"
      },
      {
       "kod": "engoba_grafen",
       "nazev": "engoba grafen"
      }
     ]
    },
    {
     "kod": "glazura_amadeus",
     "nazev": "glazura Amadeus",
     "barvy": [
      {
       "kod": "glazura_amadeus",
       "nazev": "glazura Amadeus"
      }
     ]
    }
   ]
  },
  {
   "kod": "planoton14",
   "nazev": "Tondach Planoton 14",
   "znacka": "Tondach",
   "material": "keramická",
   "tvar": "plocha",
   "vyrobce": "Tondach keramická",
   "povrchy": [
    {
     "kod": "zakladni",
     "nazev": "Planoton 14",
     "barvy": [
      {
       "kod": "engoba_granit",
       "nazev": "engoba granit"
      }
     ]
    }
   ]
  },
  {
   "kod": "sensaton11",
   "nazev": "Tondach Sensaton 11",
   "znacka": "Tondach",
   "material": "keramická",
   "tvar": "velka_vlna",
   "vyrobce": "Tondach keramická",
   "povrchy": [
    {
     "kod": "rezna",
     "nazev": "režná",
     "barvy": [
      {
       "kod": "rezna",
       "nazev": "režná"
      }
     ]
    },
    {
     "kod": "engoba",
     "nazev": "engoba",
     "barvy": [
      {
       "kod": "engoba_cervena",
       "nazev": "engoba červená"
      },
      {
       "kod": "engoba_hneda",
       "nazev": "engoba hnědá"
      },
      {
       "kod": "engoba_grafen",
       "nazev": "engoba grafen"
      }
     ]
    },
    {
     "kod": "glazura_amadeus",
     "nazev": "glazura Amadeus",
     "barvy": [
      {
       "kod": "amadeus_cervena",
       "nazev": "Amadeus červená"
      },
      {
       "kod": "amadeus_cerna",
       "nazev": "Amadeus černá"
      },
      {
       "kod": "amadeus_hneda",
       "nazev": "Amadeus hnědá"
      }
     ]
    }
   ]
  },
  {
   "kod": "renoton11",
   "nazev": "Tondach Renoton 11",
   "znacka": "Tondach",
   "material": "keramická",
   "tvar": "klasicka",
   "vyrobce": "Tondach keramická",
   "povrchy": [
    {
     "kod": "rezna",
     "nazev": "režná",
     "barvy": [
      {
       "kod": "rezna",
       "nazev": "režná"
      }
     ]
    },
    {
     "kod": "engoba",
     "nazev": "engoba",
     "barvy": [
      {
       "kod": "engoba_cervena",
       "nazev": "engoba červená"
      },
      {
       "kod": "engoba_hneda",
       "nazev": "engoba hnědá"
      },
      {
       "kod": "engoba_grafen",
       "nazev": "engoba grafen"
      }
     ]
    },
    {
     "kod": "glazura_amadeus",
     "nazev": "glazura Amadeus",
     "barvy": [
      {
       "kod": "amadeus_cervena",
       "nazev": "Amadeus červená"
      },
      {
       "kod": "amadeus_cerna",
       "nazev": "Amadeus černá"
      }
     ]
    }
   ]
  },
  {
   "kod": "renoton14",
   "nazev": "Tondach Renoton 14",
   "znacka": "Tondach",
   "material": "keramická",
   "tvar": "klasicka",
   "vyrobce": "Tondach keramická",
   "povrchy": [
    {
     "kod": "rezna",
     "nazev": "režná",
     "barvy": [
      {
       "kod": "rezna",
       "nazev": "režná"
      }
     ]
    },
    {
     "kod": "engoba",
     "nazev": "engoba",
     "barvy": [
      {
       "kod": "engoba_cervena",
       "nazev": "engoba červená"
      },
      {
       "kod": "engoba_hneda",
       "nazev": "engoba hnědá"
      },
      {
       "kod": "engoba_grafen",
       "nazev": "engoba grafen"
      }
     ]
    },
    {
     "kod": "glazura_amadeus",
     "nazev": "glazura Amadeus",
     "barvy": [
      {
       "kod": "amadeus_cervena",
       "nazev": "Amadeus červená"
      },
      {
       "kod": "amadeus_cerna",
       "nazev": "Amadeus černá"
      }
     ]
    }
   ]
  },
  {
   "kod": "erlusxxl",
   "nazev": "ERLUS Reformpfanne XXL",
   "znacka": "Erlus",
   "material": "keramická",
   "tvar": "plocha_vlna",
   "vyrobce": "Erlus keramická",
   "povrchy": [
    {
     "kod": "zakladni",
     "nazev": "Reformpfanne XXL",
     "barvy": [
      {
       "kod": "prirodni_cervena",
       "nazev": "přírodní červená"
      },
      {
       "kod": "antracit",
       "nazev": "antracit"
      }
     ]
    }
   ]
  },
  {
   "kod": "falcovana",
   "nazev": "Falcovaná krytina (hliník)",
   "znacka": "",
   "material": "plechová",
   "tvar": "plocha",
   "vyrobce": "Plechová krytina",
   "povrchy": [
    {
     "kod": "zaklad",
     "nazev": "KJG hliník mat nebo PREFA Prefalz, tl. 0,7 mm",
     "barvy": [
      {
       "kod": "antracit",
       "nazev": "antracit RAL 7016"
      }
     ]
    }
   ]
  },
  {
   "kod": "click",
   "nazev": "Click panel",
   "znacka": "",
   "material": "plechová",
   "tvar": "plocha",
   "vyrobce": "Plechová krytina",
   "povrchy": [
    {
     "kod": "zaklad",
     "nazev": "Lakovaný pozink KJG",
     "barvy": [
      {
       "kod": "antracit",
       "nazev": "antracit RAL 7016"
      }
     ]
    }
   ]
  },
  {
   "kod": "bella",
   "nazev": "Bella Sara (Budmat)",
   "znacka": "",
   "material": "plechová",
   "tvar": "mirna_vlna",
   "vyrobce": "Plechová krytina",
   "povrchy": [
    {
     "kod": "zaklad",
     "nazev": "Maloformátová plechová taška, krycí 1150 × 700 mm, laťování fixně 350 mm",
     "barvy": [
      {
       "kod": "antracit",
       "nazev": "antracit RAL 7016"
      }
     ]
    }
   ]
  }
 ],
 "okapy": {
  "materialy": [
   {
    "kod": "pozink",
    "nazev": "Lakovaný pozink (lesk)",
    "barvy": [
     {
      "hex": "#383E42",
      "nazev": "Antracit 7016"
     },
     {
      "hex": "#0E0E10",
      "nazev": "Intenzivně černá 9005"
     },
     {
      "hex": "#6D342D",
      "nazev": "Ocelově červená 3009"
     },
     {
      "hex": "#8E402A",
      "nazev": "Měděnohnědá 8004"
     },
     {
      "hex": "#4A3B2A",
      "nazev": "Tmavě hnědá 8028"
     },
     {
      "hex": "#114232",
      "nazev": "Mechově zelená 6005"
     },
     {
      "hex": "#D7D5CB",
      "nazev": "Šedobílá 9002"
     },
     {
      "hex": "#A5A5A8",
      "nazev": "Bílo hliníková 9006"
     },
     {
      "hex": "#45322E",
      "nazev": "Čokoládová 8017"
     },
     {
      "hex": "#8F8F8F",
      "nazev": "Šedý hliník 9007"
     },
     {
      "hex": "#C5C7C4",
      "nazev": "Světle šedá 7035"
     }
    ],
    "velikosti": [
     {
      "rs": 330,
      "prumer": 150
     },
     {
      "rs": 280,
      "prumer": 125
     }
    ]
   },
   {
    "kod": "hlinik",
    "nazev": "Lakovaný hliník (mat)",
    "barvy": [
     {
      "hex": "#383E42",
      "nazev": "Antracit 7016"
     },
     {
      "hex": "#4A3B2A",
      "nazev": "Testa di Moro 8028"
     },
     {
      "hex": "#6B716F",
      "nazev": "Myší šedá 7005"
     },
     {
      "hex": "#57493A",
      "nazev": "Hnědošedá 7013"
     },
     {
      "hex": "#8E402A",
      "nazev": "Měděnohnědá 8004"
     },
     {
      "hex": "#0E0E10",
      "nazev": "Černá 9005"
     },
     {
      "hex": "#6D342D",
      "nazev": "Ocelově červená 3009"
     },
     {
      "hex": "#8F8F8F",
      "nazev": "Šedý hliník 9007"
     },
     {
      "hex": "#114232",
      "nazev": "Mechově zelená 6005"
     },
     {
      "hex": "#A5A5A8",
      "nazev": "Bílý hliník 9006"
     }
    ],
    "velikosti": [
     {
      "rs": 333,
      "prumer": 150
     },
     {
      "rs": 280,
      "prumer": 125
     }
    ]
   },
   {
    "kod": "med",
    "nazev": "Měď",
    "barvy": [],
    "velikosti": [
     {
      "rs": 330,
      "prumer": null
     },
     {
      "rs": 280,
      "prumer": null
     }
    ]
   },
   {
    "kod": "titanzinek",
    "nazev": "Titanzinek",
    "barvy": [],
    "velikosti": [
     {
      "rs": 330,
      "prumer": null
     },
     {
      "rs": 280,
      "prumer": null
     }
    ]
   }
  ],
  "vychoziRs": 330
 }
};
})(typeof window !== "undefined" ? window : globalThis);
