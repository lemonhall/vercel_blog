import type { Metadata, Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  type PostSort,
  type PostWithTags,
  type RecipeTag
} from "@/lib/posts";
import { listRecipePostsPageCached, listRecipeTagsCached } from "@/lib/public-posts";
import {
  normalizeRecipeTags,
  recipeHref,
  recipeIndexPolicy,
  type RecipeSearchParams
} from "@/lib/recipe-filters";

export const dynamic = "force-dynamic";

type RecipesPageProps = {
  searchParams?: Promise<RecipeSearchParams>;
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

function RecipePostTags({ post }: { post: PostWithTags }) {
  if (post.tags.length === 0) {
    return null;
  }
  return (
    <div className="post-tags" aria-label={`${post.title} tags`}>
      {post.tags.map((tag) => (
        <a key={tag.slug} href={recipeHref({ query: "", tags: [tag.slug] })}>
          {tag.name}
        </a>
      ))}
    </div>
  );
}

export async function generateMetadata({ searchParams }: RecipesPageProps): Promise<Metadata> {
  const params = await searchParams;
  const page = parsePage(params?.page);
  const query = params?.q ?? "";
  const tags = normalizeRecipeTags(params?.tags);
  const policy = recipeIndexPolicy({ page, query, tags });
  return {
    alternates: { canonical: policy.canonical },
    robots: policy.noindex ? { index: false, follow: true } : undefined
  };
}

function RecipeNutritionBadge({ post }: { post: PostWithTags }) {
  if (!post.nutrition) {
    return null;
  }
  const value = post.nutrition.caloriesPerServingKcal ?? post.nutrition.caloriesTotalKcal;
  const suffix = post.nutrition.caloriesPerServingKcal ? "/份" : "";
  return <p className="nutrition-badge">约 {value} kcal{suffix}</p>;
}

export default async function RecipesPage({ searchParams }: RecipesPageProps) {
  const params = await searchParams;
  const currentPage = parsePage(params?.page);
  const query = params?.q ?? "";
  const selectedTags = normalizeRecipeTags(params?.tags);
  const canonicalTags = selectedTags.join(",");
  if (params?.tags !== undefined && (Array.isArray(params.tags) || params.tags !== canonicalTags)) {
    redirect(recipeHref({ page: currentPage, query, tags: selectedTags }) as Route);
  }
  let result = { posts: [] as PostWithTags[], page: currentPage, pageSize: 10, pageCount: 1, total: 0, sort: "desc" as PostSort };
  let tags: RecipeTag[] = [];
  let setupError = false;
  try {
    [result, tags] = await Promise.all([
      listRecipePostsPageCached(query, selectedTags, { page: currentPage, pageSize: 10 }),
      listRecipeTagsCached()
    ]);
  } catch {
    setupError = true;
  }

  return (
    <main className="page">
      <h1 className="page-title">食谱</h1>
      <p className="page-subtitle">按菜系、食材和做法整理的厨房笔记。</p>
      <form className="search-form" action="/recipes">
        {selectedTags.length > 0 ? <input type="hidden" name="tags" value={canonicalTags} /> : null}
        <input name="q" defaultValue={query} placeholder="只搜索食谱标题和正文" aria-label="食谱搜索关键词" />
        <button type="submit">搜索食谱</button>
      </form>
      {setupError ? (
        <div className="empty-state">食谱数据库结构尚未应用。请先在 Supabase 执行 v5 schema。</div>
      ) : null}
      {tags.length > 0 ? (
        <form className="tag-filter-form" action="/recipes">
          {query.trim() ? <input type="hidden" name="q" value={query.trim()} /> : null}
          <fieldset className="tag-cloud" aria-label="食谱 Tags">
            <legend>按 Tags 筛选</legend>
            {tags.map((tag) => (
              <label className={selectedTags.includes(tag.slug) ? "tag-active" : ""} key={tag.slug}>
                <input name="tags" type="checkbox" value={tag.slug} defaultChecked={selectedTags.includes(tag.slug)} />
                <span>{tag.name}</span>
                <span>{tag.post_count}</span>
              </label>
            ))}
          </fieldset>
          <div className="tag-filter-actions">
            <button type="submit">应用筛选</button>
            {selectedTags.length > 0 ? (
              <a className="clear-tags" href={recipeHref({ query, tags: [] })}>
                全部取消
              </a>
            ) : null}
          </div>
        </form>
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
              <RecipeNutritionBadge post={post} />
              <RecipePostTags post={post} />
              {post.excerpt ? <p className="post-excerpt">{post.excerpt}</p> : null}
            </article>
          ))}
        </div>
      )}
      {!setupError ? (
        <nav className="pagination" aria-label="分页">
          {result.page > 1 ? <a href={recipeHref({ page: result.page - 1, query, tags: selectedTags })}>上一页</a> : <span>上一页</span>}
          <span>
            第 {result.page} / {result.pageCount} 页
          </span>
          {result.page < result.pageCount ? (
            <a href={recipeHref({ page: result.page + 1, query, tags: selectedTags })}>下一页</a>
          ) : (
            <span>下一页</span>
          )}
        </nav>
      ) : null}
    </main>
  );
}
