/** "Side Lunges" -> "side-lunges". Appends -2, -3, ... on collision so ids stay stable
 * and human-readable instead of falling back to a random uuid. */
export function slugify(name: string, existingIds: string[]): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!existingIds.includes(base)) return base;

  let n = 2;
  while (existingIds.includes(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}
