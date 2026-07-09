import { unstable_cache } from "next/cache";
import {
  getPostWithNutritionBySlug,
  listPublishedPostsPage,
  listRecipeTags,
  searchRecipePostsByTagsPage,
  type PostPageOptions
} from "@/lib/posts";

const PUBLIC_CACHE_SECONDS = 3600;

export const listPublishedPostsPageCached = unstable_cache(
  async (options: PostPageOptions) => listPublishedPostsPage(options),
  ["public-posts-page-v1"],
  { revalidate: PUBLIC_CACHE_SECONDS, tags: ["posts"] }
);

export const listRecipePostsPageCached = unstable_cache(
  async (query: string, tagSlugs: string[], options: PostPageOptions) =>
    searchRecipePostsByTagsPage(query, tagSlugs, options),
  ["public-recipe-posts-page-v1"],
  { revalidate: PUBLIC_CACHE_SECONDS, tags: ["posts", "recipes"] }
);

export const listRecipeTagsCached = unstable_cache(
  async () => listRecipeTags(),
  ["public-recipe-tags-v1"],
  { revalidate: PUBLIC_CACHE_SECONDS, tags: ["posts", "recipes"] }
);

export const getPostWithNutritionBySlugCached = unstable_cache(
  async (slug: string) => getPostWithNutritionBySlug(slug),
  ["public-post-detail-v1"],
  { revalidate: PUBLIC_CACHE_SECONDS, tags: ["posts", "recipes"] }
);
