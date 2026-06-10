import { notFound } from "next/navigation";
import { getPostBySlug } from "@/lib/posts";
import { sanitizePostHtml } from "@/lib/html";

export const dynamic = "force-dynamic";

type PostPageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ wide?: string }>;
};

function formatDate(value: string | null): string {
  if (!value) {
    return "未发布";
  }
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(new Date(value));
}

export default async function PostPage({ params, searchParams }: PostPageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const wide = query?.wide === "1";
  const post = await getPostBySlug(slug);
  if (!post) {
    notFound();
  }

  const returnTo = wide ? `/posts/${post.slug}?wide=1` : `/posts/${post.slug}`;

  return (
    <main className={wide ? "page page-wide" : "page"}>
      <article className={wide ? "article article-wide" : "article"}>
        <h1>{post.title}</h1>
        <p className="post-meta">{formatDate(post.published_at ?? post.created_at)}</p>
        <div className="article-body" dangerouslySetInnerHTML={{ __html: sanitizePostHtml(post.content_html) }} />
        <div className="post-actions article-actions">
          <a className="icon-action" aria-label={`编辑 ${post.title}`} href={`/admin?edit=${encodeURIComponent(post.slug)}`}>
            ✏️
          </a>
          <form action="/api/admin/posts/delete" method="post">
            <input type="hidden" name="slug" value={post.slug} />
            <input type="hidden" name="return_to" value={returnTo} />
            <button className="icon-action" type="submit" aria-label={`删除 ${post.title}`}>
              🗑️
            </button>
          </form>
        </div>
      </article>
    </main>
  );
}
