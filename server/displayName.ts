// Short names people actually say, such as JVC or Dubai Marina.
// Official DLD subdivision names stay only when no alias exists.

const SHORT_CODE = /^(jvc|jvt|jlt)$/;
const DLD_SUBDIVISION = /^(Al |Wadi |Madinat |Hadaeq |Me'|Jabal |Nad |Nadd |Saih |Um |Warsan |Zaabeel |Trade Center|Rega |Island |Bukadra|Hessyan|Marsa |Muhaisanah|Ras Al|Burj Khalifa$)/;

function titleCase(value: string): string {
  return value.split(/\s+/).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

export function displayName(official: string, aliases: string[]): string {
  const code = aliases.find((alias) => SHORT_CODE.test(alias));
  if (code) return code.toUpperCase();
  const phrase = aliases.find((alias) => alias.includes(" ") && !alias.startsWith("the "));
  // A phrase alias is the name people use, including Palm Deira → Deira Islands.
  // "the palm" and a short code such as "bb" do not replace Palm Jumeirah or Business Bay.
  if (!DLD_SUBDIVISION.test(official)) return phrase ? titleCase(phrase) : official;
  if (phrase) return titleCase(phrase);
  const word = [...aliases].sort((a, b) => b.length - a.length).find((alias) => alias.length > 3);
  if (word) return titleCase(word);
  return official;
}
