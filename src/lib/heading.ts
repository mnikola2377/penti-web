const CONJUNCTIONS = new Set(["a", "i", "nebo", "ani"]);
const CLITICS = new Set(["se", "si"]);
const DANGLING = new Set(["v", "k", "s", "z", "o", "u"]);

function bare(word: string): string {
  return word.toLowerCase().replace(/^[„"'(]+|[.,;:?!“")]+$/g, "");
}

/** První třetina slov je lehký úvod, zbytek je klíčová část.
    U sloganu to dá „Vyrábíme a realizujeme“ a „dřevěné konstrukce a střechy na klíč“. */
export function splitHeading(text: string): { light: string; strong: string } {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) return { light: "", strong: words[0] ?? "" };
  if (words.length === 2 && CLITICS.has(bare(words[1]))) return { light: "", strong: text.trim() };

  let cut = Math.ceil(words.length / 3);
  if (cut >= words.length) cut = words.length - 1;
  if (cut > 1 && CONJUNCTIONS.has(bare(words[cut]))) cut -= 1;
  if (cut > 1 && DANGLING.has(bare(words[cut - 1]))) cut -= 1;

  return {
    light: words.slice(0, cut).join(" "),
    strong: words.slice(cut).join(" "),
  };
}
