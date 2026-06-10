export function slugifyTitle(legacyId: number, title: string): string {
  const normalized = title
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "");

  return `${legacyId}-${normalized || "post"}`;
}
