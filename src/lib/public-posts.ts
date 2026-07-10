import { unstable_cache } from "next/cache";
import {
  getPublicContentVersion,
  getPostWithNutritionBySlug,
  listPublishedPostsPage,
  listRecipeTags,
  searchRecipePostsByTagsPage,
  type PostPageOptions
} from "@/lib/posts";

const PUBLIC_CACHE_SECONDS = 3600;

const listPublishedPostsPageByVersion = unstable_cache(
  async (_version: string, options: PostPageOptions) => listPublishedPostsPage(options),
  ["public-posts-page-v2"],
  { revalidate: PUBLIC_CACHE_SECONDS, tags: ["posts"] }
);

const listRecipePostsPageByVersion = unstable_cache(
  async (_version: string, query: string, tagSlugs: string[], options: PostPageOptions) =>
    searchRecipePostsByTagsPage(query, tagSlugs, options),
  ["public-recipe-posts-page-v2"],
  { revalidate: PUBLIC_CACHE_SECONDS, tags: ["posts", "recipes"] }
);

const listRecipeTagsByVersion = unstable_cache(
  async (_version: string) => listRecipeTags(),
  ["public-recipe-tags-v2"],
  { revalidate: PUBLIC_CACHE_SECONDS, tags: ["posts", "recipes"] }
);

const getPostWithNutritionBySlugByVersion = unstable_cache(
  async (_version: string, slug: string) => getPostWithNutritionBySlug(slug),
  ["public-post-detail-v2"],
  { revalidate: PUBLIC_CACHE_SECONDS, tags: ["posts", "recipes"] }
);

export async function listPublishedPostsPageCached(options: PostPageOptions) {
  return listPublishedPostsPageByVersion(await getPublicContentVersion(), options);
}

export async function listRecipePageDataCached(
  query: string,
  tagSlugs: string[],
  options: PostPageOptions
) {
  const version = await getPublicContentVersion();
  return Promise.all([
    listRecipePostsPageByVersion(version, query, tagSlugs, options),
    listRecipeTagsByVersion(version)
  ]);
}

export async function getPostWithNutritionBySlugCached(slug: string) {
  return getPostWithNutritionBySlugByVersion(await getPublicContentVersion(), slug);
}
