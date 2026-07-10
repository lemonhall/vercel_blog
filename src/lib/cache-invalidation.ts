import { revalidatePath, revalidateTag } from "next/cache";

export type CacheInvalidationAdapter = {
  tag(value: string): void;
  path(value: string): void;
};

const nextCacheAdapter: CacheInvalidationAdapter = {
  tag: revalidateTag,
  path: revalidatePath
};

export function invalidatePostCaches(slug: string, adapter: CacheInvalidationAdapter = nextCacheAdapter): void {
  adapter.tag("posts");
  adapter.tag("recipes");
  adapter.path("/");
  adapter.path("/recipes");
  adapter.path(`/posts/${encodeURIComponent(slug)}`);
}

export async function runWithPostCacheInvalidation<T>(
  slug: string,
  operation: () => Promise<T>,
  adapter: CacheInvalidationAdapter = nextCacheAdapter
): Promise<T> {
  const result = await operation();
  invalidatePostCaches(slug, adapter);
  return result;
}
