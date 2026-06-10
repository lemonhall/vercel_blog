import Link from "next/link";
import { searchPublishedPosts } from "@/lib/posts";

export const dynamic = "force-dynamic";

type SearchPageProps = {
  searchParams?: Promise<{ q?: string }>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const query = params?.q ?? "";
  const posts = query.trim() ? await searchPublishedPosts(query) : [];

  return (
    <main className="page">
      <h1 className="page-title">搜索</h1>
      <form className="search-form" action="/search">
        <input name="q" defaultValue={query} placeholder="输入标题或正文关键词" aria-label="搜索关键词" />
        <button type="submit">搜索</button>
      </form>

      {!query.trim() ? (
        <div className="empty-state">输入关键词后搜索文章标题和正文。</div>
      ) : posts.length === 0 ? (
        <div className="empty-state">没有找到匹配文章。</div>
      ) : (
        <div className="post-list">
          {posts.map((post) => (
            <article className="post-item" key={post.id}>
              <h2>
                <Link href={`/posts/${post.slug}`}>{post.title}</Link>
              </h2>
              {post.excerpt ? <p className="post-excerpt">{post.excerpt}</p> : null}
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
