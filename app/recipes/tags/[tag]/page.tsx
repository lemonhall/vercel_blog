import Link from "next/link";
import { notFound } from "next/navigation";
import { listRecipePostsByTag, listRecipeTags, type Post, type RecipeTag } from "@/lib/posts";

export const dynamic = "force-dynamic";

type RecipeTagPageProps = {
  params: Promise<{ tag: string }>;
};

function formatDate(value: string | null): string {
  if (!value) {
    return "未发布";
  }
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(new Date(value));
}

export default async function RecipeTagPage({ params }: RecipeTagPageProps) {
  const { tag } = await params;
  let tags: RecipeTag[] = [];
  let posts: Post[] = [];
  let setupError = false;
  try {
    [tags, posts] = await Promise.all([listRecipeTags(), listRecipePostsByTag(tag)]);
  } catch {
    setupError = true;
  }
  if (setupError) {
    return (
      <main className="page">
        <h1 className="page-title">食谱标签</h1>
        <div className="empty-state">食谱数据库结构尚未应用。请先在 Supabase 执行 v5 schema。</div>
      </main>
    );
  }
  const activeTag = tags.find((item) => item.slug === decodeURIComponent(tag));
  if (!activeTag) {
    notFound();
  }

  return (
    <main className="page">
      <h1 className="page-title">{activeTag.name}</h1>
      <p className="page-subtitle">食谱标签。</p>
      <nav className="tag-cloud" aria-label="食谱 Tags">
        {tags.map((item) => (
          <Link className={item.slug === activeTag.slug ? "tag-active" : ""} key={item.slug} href={`/recipes/tags/${item.slug}`}>
            {item.name}
            <span>{item.post_count}</span>
          </Link>
        ))}
      </nav>
      {posts.length === 0 ? (
        <div className="empty-state">这个标签下还没有已发布食谱。</div>
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
