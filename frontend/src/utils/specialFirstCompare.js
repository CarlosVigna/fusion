export function specialFirstCompare(a, b) {

  const isSpecial = (s) =>
    !!s && /^[^a-zA-Z0-9àáâãéêíóôõúü]/i.test(s);

  if (isSpecial(a) && !isSpecial(b)) {
    return -1;
  }

  if (!isSpecial(a) && isSpecial(b)) {
    return 1;
  }

  return (a || "").localeCompare(b || "", "pt-BR", {
    sensitivity: "base",
  });

}
