const KNOWN_TAG_SLUGS: Record<string, string> = {
  牛肉: "beef",
  牛腩: "beef-brisket",
  海鲜: "seafood",
  鱼: "fish",
  虾: "shrimp",
  鸡肉: "chicken",
  猪肉: "pork",
  羊肉: "lamb",
  意大利菜: "italian",
  法国菜: "french",
  中餐: "chinese",
  日料: "japanese",
  韩餐: "korean",
  炖菜: "stew",
  烘焙: "baking",
  甜点: "dessert",
  早餐: "breakfast",
  家常菜: "home-cooking",
  素菜: "vegetarian"
};

function hashTag(value: string): string {
  let hash = 5381;
  for (const char of value) {
    hash = (hash * 33) ^ char.codePointAt(0)!;
  }
  return (hash >>> 0).toString(36);
}

export function normalizeTagName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function tagSlugFromName(value: string): string {
  const name = normalizeTagName(value);
  if (!name) {
    return "";
  }
  const known = KNOWN_TAG_SLUGS[name];
  if (known) {
    return known;
  }
  const ascii = name
    .normalize("NFKD")
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return ascii || `tag-${hashTag(name)}`;
}

export function parseTagInput(value: string): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const part of value.split(/[,，\n]/)) {
    const tag = normalizeTagName(part);
    if (tag && !seen.has(tag)) {
      seen.add(tag);
      tags.push(tag);
    }
  }
  return tags;
}
