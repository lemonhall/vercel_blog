export type RecipeSearchParams = {
  page?: string;
  q?: string;
  tags?: string | string[];
};

export type RecipeHrefInput = {
  page?: number;
  query: string;
  tags: string[];
};

function decodeTag(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function normalizeRecipeTags(value: string | string[] | undefined): string[] {
  const inputs = Array.isArray(value) ? value : [value ?? ""];
  const tags = inputs
    .flatMap((input) => input.split(","))
    .map((tag) => decodeTag(tag).trim())
    .filter(Boolean);

  return [...new Set(tags)].sort((left, right) => left.localeCompare(right));
}

export function recipeHref(input: RecipeHrefInput): string {
  const params = new URLSearchParams();
  const query = input.query.trim();
  const tags = normalizeRecipeTags(input.tags);
  if (query) {
    params.set("q", query);
  }
  if (tags.length > 0) {
    params.set("tags", tags.join(","));
  }
  if (input.page && input.page > 1) {
    params.set("page", String(Math.floor(input.page)));
  }
  const value = params.toString();
  return value ? `/recipes?${value}` : "/recipes";
}

export function recipeIndexPolicy(input: { page: number; query: string; tags: string[] }): {
  canonical: string;
  noindex: boolean;
} {
  const tags = normalizeRecipeTags(input.tags);
  return {
    canonical: tags.length === 1 ? recipeHref({ query: "", tags }) : "/recipes",
    noindex: input.page > 1 || Boolean(input.query.trim()) || tags.length > 1
  };
}
