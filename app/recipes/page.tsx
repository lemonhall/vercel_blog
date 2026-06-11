import Link from "next/link";
import {
  listRecipePostsByTagsPage,
  listRecipePostsPage,
  listRecipeTags,
  searchRecipePostsByTagsPage,
  searchRecipePostsPage,
  type PostSort,
  type PostWithTags,
  type RecipeTag
} from "@/lib/posts";

export const dynamic = "force-dynamic";

type RecipesPageProps = {
  searchParams?: Promise<{ page?: string; q?: string; tags?: string }>;
};

function formatDate(value: string | null): string {
  if (!value) {
    return "未发布";
  }
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(new Date(value));
}

function parsePage(value: string | undefined): number {
  const page = Number(value);
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

function selectedTagsFromParam(value: string | undefined): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const part of (value ?? "").split(",")) {
    const tag = part.trim();
    if (tag && !seen.has(tag)) {
      seen.add(tag);
      tags.push(tag);
    }
  }
  return tags;
}

function tagsParam(tags: string[]): string {
  return tags.join(",");
}

function hrefFor(input: { page?: number; query: string; tags: string[] }): string {
  const params = new URLSearchParams();
  const q = input.query.trim();
  if (q) {
    params.set("q", q);
  }
  if (input.tags.length > 0) {
    params.set("tags", tagsParam(input.tags));
  }
  if (input.page && input.page > 1) {
    params.set("page", String(input.page));
  }
  const value = params.toString();
  return value ? `/recipes?${value}` : "/recipes";
}

function hrefForToggledTag(input: { tagSlug: string; selectedTags: string[]; query: string }): string {
  const nextTags = input.selectedTags.includes(input.tagSlug)
    ? input.selectedTags.filter((slug) => slug !== input.tagSlug)
    : [...input.selectedTags, input.tagSlug];
  return hrefFor({ query: input.query, tags: nextTags });
}

function RecipePostTags({ post, selectedTags, query }: { post: PostWithTags; selectedTags: string[]; query: string }) {
  if (post.tags.length === 0) {
    return null;
  }
  return (
    <div className="post-tags" aria-label={`${post.title} tags`}>
      {post.tags.map((tag) => (
        <a key={tag.slug} href={hrefForToggledTag({ tagSlug: tag.slug, selectedTags, query })}>
          {tag.name}
        </a>
      ))}
    </div>
  );
}

export default async function RecipesPage({ searchParams }: RecipesPageProps) {
  const params = await searchParams;
  const currentPage = parsePage(params?.page);
  const query = params?.q ?? "";
  const selectedTags = selectedTagsFromParam(params?.tags);
  let result = { posts: [] as PostWithTags[], page: currentPage, pageSize: 10, pageCount: 1, total: 0, sort: "desc" as PostSort };
  let tags: RecipeTag[] = [];
  let setupError = false;
  try {
    const postsPromise = query.trim()
      ? searchRecipePostsByTagsPage(query, selectedTags, { page: currentPage, pageSize: 10 })
      : selectedTags.length > 0
        ? listRecipePostsByTagsPage(selectedTags, { page: currentPage, pageSize: 10 })
      : listRecipePostsPage({ page: currentPage, pageSize: 10 });
    [result, tags] = await Promise.all([postsPromise, listRecipeTags()]);
  } catch {
    setupError = true;
  }

  return (
    <main className="page">
      <h1 className="page-title">食谱</h1>
      <p className="page-subtitle">按菜系、食材和做法整理的厨房笔记。</p>
      <form className="search-form" action="/recipes">
        {selectedTags.length > 0 ? <input type="hidden" name="tags" value={tagsParam(selectedTags)} /> : null}
        <input name="q" defaultValue={query} placeholder="只搜索食谱标题和正文" aria-label="食谱搜索关键词" />
        <button type="submit">搜索食谱</button>
      </form>
      {setupError ? (
        <div className="empty-state">食谱数据库结构尚未应用。请先在 Supabase 执行 v5 schema。</div>
      ) : null}
      {tags.length > 0 ? (
        <nav className="tag-cloud" aria-label="食谱 Tags">
          {tags.map((tag) => (
            <a
              aria-pressed={selectedTags.includes(tag.slug)}
              className={selectedTags.includes(tag.slug) ? "tag-active" : ""}
              key={tag.slug}
              href={hrefForToggledTag({ tagSlug: tag.slug, selectedTags, query })}
            >
              {tag.name}
              <span>{tag.post_count}</span>
            </a>
          ))}
          {selectedTags.length > 0 ? (
            <a className="clear-tags" href={hrefFor({ query, tags: [] })}>
              全部取消
            </a>
          ) : null}
        </nav>
      ) : null}
      {result.posts.length === 0 ? (
        <div className="empty-state">
          {query.trim() || selectedTags.length > 0 ? "没有找到匹配食谱。" : "还没有已发布食谱。"}
        </div>
      ) : (
        <div className="post-list">
          {result.posts.map((post) => (
            <article className="post-item" key={post.id}>
              <h2>
                <Link href={`/posts/${post.slug}`}>{post.title}</Link>
              </h2>
              <p className="post-meta">{formatDate(post.published_at ?? post.created_at)}</p>
              <RecipePostTags post={post} selectedTags={selectedTags} query={query} />
              {post.excerpt ? <p className="post-excerpt">{post.excerpt}</p> : null}
            </article>
          ))}
        </div>
      )}
      {!setupError ? (
        <nav className="pagination" aria-label="分页">
          {result.page > 1 ? <a href={hrefFor({ page: result.page - 1, query, tags: selectedTags })}>上一页</a> : <span>上一页</span>}
          <span>
            第 {result.page} / {result.pageCount} 页
          </span>
          {result.page < result.pageCount ? (
            <a href={hrefFor({ page: result.page + 1, query, tags: selectedTags })}>下一页</a>
          ) : (
            <span>下一页</span>
          )}
        </nav>
      ) : null}
    </main>
  );
}
