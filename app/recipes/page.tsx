import Link from "next/link";
import {
  listRecipePostsPage,
  listRecipeTags,
  searchRecipePostsPage,
  type PostSort,
  type PostWithTags,
  type RecipeTag
} from "@/lib/posts";

export const dynamic = "force-dynamic";

type RecipesPageProps = {
  searchParams?: Promise<{ page?: string; q?: string }>;
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

function hrefFor(input: { page?: number; query: string }): string {
  const params = new URLSearchParams();
  const q = input.query.trim();
  if (q) {
    params.set("q", q);
  }
  if (input.page && input.page > 1) {
    params.set("page", String(input.page));
  }
  const value = params.toString();
  return value ? `/recipes?${value}` : "/recipes";
}

function RecipePostTags({ post }: { post: PostWithTags }) {
  if (post.tags.length === 0) {
    return null;
  }
  return (
    <div className="post-tags" aria-label={`${post.title} tags`}>
      {post.tags.map((tag) => (
        <Link key={tag.slug} href={`/recipes/tags/${tag.slug}`}>
          {tag.name}
        </Link>
      ))}
    </div>
  );
}

export default async function RecipesPage({ searchParams }: RecipesPageProps) {
  const params = await searchParams;
  const currentPage = parsePage(params?.page);
  const query = params?.q ?? "";
  let result = { posts: [] as PostWithTags[], page: currentPage, pageSize: 10, pageCount: 1, total: 0, sort: "desc" as PostSort };
  let tags: RecipeTag[] = [];
  let setupError = false;
  try {
    const postsPromise = query.trim()
      ? searchRecipePostsPage(query, { page: currentPage, pageSize: 10 })
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
        <input name="q" defaultValue={query} placeholder="只搜索食谱标题和正文" aria-label="食谱搜索关键词" />
        <button type="submit">搜索食谱</button>
      </form>
      {setupError ? (
        <div className="empty-state">食谱数据库结构尚未应用。请先在 Supabase 执行 v5 schema。</div>
      ) : null}
      {tags.length > 0 ? (
        <nav className="tag-cloud" aria-label="食谱 Tags">
          {tags.map((tag) => (
            <Link key={tag.slug} href={`/recipes/tags/${tag.slug}`}>
              {tag.name}
              <span>{tag.post_count}</span>
            </Link>
          ))}
        </nav>
      ) : null}
      {result.posts.length === 0 ? (
        <div className="empty-state">{query.trim() ? "没有找到匹配食谱。" : "还没有已发布食谱。"}</div>
      ) : (
        <div className="post-list">
          {result.posts.map((post) => (
            <article className="post-item" key={post.id}>
              <h2>
                <Link href={`/posts/${post.slug}`}>{post.title}</Link>
              </h2>
              <p className="post-meta">{formatDate(post.published_at ?? post.created_at)}</p>
              <RecipePostTags post={post} />
              {post.excerpt ? <p className="post-excerpt">{post.excerpt}</p> : null}
            </article>
          ))}
        </div>
      )}
      {!setupError ? (
        <nav className="pagination" aria-label="分页">
          {result.page > 1 ? <a href={hrefFor({ page: result.page - 1, query })}>上一页</a> : <span>上一页</span>}
          <span>
            第 {result.page} / {result.pageCount} 页
          </span>
          {result.page < result.pageCount ? <a href={hrefFor({ page: result.page + 1, query })}>下一页</a> : <span>下一页</span>}
        </nav>
      ) : null}
    </main>
  );
}
