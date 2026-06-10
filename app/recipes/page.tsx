import Link from "next/link";
import { listRecipePosts, listRecipeTags, type Post, type RecipeTag } from "@/lib/posts";

export const dynamic = "force-dynamic";

function formatDate(value: string | null): string {
  if (!value) {
    return "未发布";
  }
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(new Date(value));
}

export default async function RecipesPage() {
  let posts: Post[] = [];
  let tags: RecipeTag[] = [];
  let setupError = false;
  try {
    [posts, tags] = await Promise.all([listRecipePosts(), listRecipeTags()]);
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
      {posts.length === 0 ? (
        <div className="empty-state">还没有已发布食谱。</div>
      ) : (
        <div className="post-list">
          {posts.map((post) => (
            <article className="post-item" key={post.id}>
              <h2>
                <Link href={`/posts/${post.slug}`}>{post.title}</Link>
              </h2>
              <p className="post-meta">{formatDate(post.published_at ?? post.created_at)}</p>
              {post.excerpt ? <p className="post-excerpt">{post.excerpt}</p> : null}
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
