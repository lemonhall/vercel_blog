import Link from "next/link";
import { listRecipePostsPage, listRecipeTags, type PostSort, type PostWithTags, type RecipeTag } from "@/lib/posts";

export const dynamic = "force-dynamic";

type RecipesPageProps = {
  searchParams?: Promise<{ page?: string }>;
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

function hrefFor(page?: number): string {
  if (!page || page <= 1) {
    return "/recipes";
  }
  return `/recipes?page=${page}`;
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
  let result = { posts: [] as PostWithTags[], page: currentPage, pageSize: 10, pageCount: 1, total: 0, sort: "desc" as PostSort };
  let tags: RecipeTag[] = [];
  let setupError = false;
  try {
    [result, tags] = await Promise.all([listRecipePostsPage({ page: currentPage, pageSize: 10 }), listRecipeTags()]);
  } catch {
    setupError = true;
  }

  return (
    <main className="page">
      <h1 className="page-title">食谱</h1>
      <p className="page-subtitle">按菜系、食材和做法整理的厨房笔记。</p>
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
        <div className="empty-state">还没有已发布食谱。</div>
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
          {result.page > 1 ? <a href={hrefFor(result.page - 1)}>上一页</a> : <span>上一页</span>}
          <span>
            第 {result.page} / {result.pageCount} 页
          </span>
          {result.page < result.pageCount ? <a href={hrefFor(result.page + 1)}>下一页</a> : <span>下一页</span>}
        </nav>
      ) : null}
    </main>
  );
}
