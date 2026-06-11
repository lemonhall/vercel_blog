import { notFound } from "next/navigation";
import { getPostWithNutritionBySlug } from "@/lib/posts";
import { sanitizePostHtml } from "@/lib/html";
import { PostAdminActions } from "@/components/PostAdminActions";
import { isAdminSessionValid } from "@/lib/admin-session";

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
  const post = await getPostWithNutritionBySlug(slug);
  const isAdmin = await isAdminSessionValid();
  if (!post) {
    notFound();
  }

  const returnTo = wide ? `/posts/${post.slug}?wide=1` : `/posts/${post.slug}`;

  return (
    <main className={wide ? "page page-wide" : "page"}>
      <article className={wide ? "article article-wide" : "article"}>
        <h1>{post.title}</h1>
        <p className="post-meta">{formatDate(post.published_at ?? post.created_at)}</p>
        {post.nutrition ? (
          <section className="nutrition-detail" aria-label="卡路里估算">
            <h2>卡路里估算</h2>
            <p>
              约 {post.nutrition.caloriesPerServingKcal ?? post.nutrition.caloriesTotalKcal} kcal
              {post.nutrition.caloriesPerServingKcal ? "/份" : ""}，共 {post.nutrition.servings} 份。
            </p>
            <p>{post.nutrition.summary}</p>
            {post.nutrition.ingredientEstimates.length > 0 ? (
              <ul>
                {post.nutrition.ingredientEstimates.map((item) => (
                  <li key={`${item.name}-${item.caloriesKcal}`}>
                    {item.name}
                    {item.amount ? `（${item.amount}）` : ""}：约 {item.caloriesKcal} kcal
                    {item.note ? `，${item.note}` : ""}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}
        <div className="article-body" dangerouslySetInnerHTML={{ __html: sanitizePostHtml(post.content_html) }} />
        {isAdmin ? (
          <div className="article-actions">
            <PostAdminActions slug={post.slug} title={post.title} returnTo={returnTo} />
          </div>
        ) : null}
      </article>
    </main>
  );
}
