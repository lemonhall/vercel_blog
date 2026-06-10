import Link from "next/link";
import { listPublishedPosts } from "@/lib/posts";

export const dynamic = "force-dynamic";

function formatDate(value: string | null): string {
  if (!value) {
    return "未发布";
  }
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(new Date(value));
}

export default async function HomePage() {
  const posts = await listPublishedPosts();

  return (
    <main className="page">
      <h1 className="page-title">文章</h1>
      <p className="page-subtitle">菜谱、技术笔记和生活记录。</p>
      {posts.length === 0 ? (
        <div className="empty-state">还没有已发布文章。</div>
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

