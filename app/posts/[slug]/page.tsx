import { notFound } from "next/navigation";
import { getPostBySlug } from "@/lib/posts";
import { sanitizePostHtml } from "@/lib/html";

export const dynamic = "force-dynamic";

type PostPageProps = {
  params: Promise<{ slug: string }>;
};

function formatDate(value: string | null): string {
  if (!value) {
    return "未发布";
  }
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(new Date(value));
}

export default async function PostPage({ params }: PostPageProps) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) {
    notFound();
  }

  return (
    <main className="page">
      <article className="article">
        <h1>{post.title}</h1>
        <p className="post-meta">{formatDate(post.published_at ?? post.created_at)}</p>
        <div className="article-body" dangerouslySetInnerHTML={{ __html: sanitizePostHtml(post.content_html) }} />
      </article>
    </main>
  );
}

