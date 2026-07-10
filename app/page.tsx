import { type PostSort } from "@/lib/posts";
import { listPublishedPostsPageCached } from "@/lib/public-posts";
import { PostAdminActions } from "@/components/PostAdminActions";
import { isAdminSessionValid } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

type HomePageProps = {
  searchParams?: Promise<{ page?: string; sort?: string; wide?: string }>;
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

function normalizeSort(value: string | undefined): PostSort {
  return value === "asc" ? "asc" : "desc";
}

function hrefFor(input: { page?: number; sort: PostSort; wide: boolean }): string {
  const params = new URLSearchParams();
  if (input.page && input.page > 1) {
    params.set("page", String(input.page));
  }
  if (input.sort === "asc") {
    params.set("sort", "asc");
  }
  if (input.wide) {
    params.set("wide", "1");
  }
  const query = params.toString();
  return query ? `/?${query}` : "/";
}

function postHref(slug: string, wide: boolean): string {
  return wide ? `/posts/${slug}?wide=1` : `/posts/${slug}`;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const sort = normalizeSort(params?.sort);
  const wide = params?.wide === "1";
  const currentPage = parsePage(params?.page);
  const result = await listPublishedPostsPageCached({ page: currentPage, pageSize: 10, sort });
  const isAdmin = await isAdminSessionValid();
  const posts = result.posts;
  const returnTo = hrefFor({ page: result.page, sort: result.sort, wide });

  return (
    <main className={wide ? "page page-wide" : "page"}>
      <h1 className="page-title">文章</h1>
      <p className="page-subtitle">菜谱、技术笔记和生活记录。</p>
      <div className="list-controls" aria-label="文章列表控制">
        <a className={result.sort === "desc" ? "control-active" : ""} href={hrefFor({ sort: "desc", wide })}>
          新到旧
        </a>
        <a className={result.sort === "asc" ? "control-active" : ""} href={hrefFor({ sort: "asc", wide })}>
          旧到新
        </a>
        <a href={hrefFor({ page: result.page, sort: result.sort, wide: !wide })}>{wide ? "标准模式" : "宽模式"}</a>
      </div>
      {posts.length === 0 ? (
        <div className="empty-state">还没有已发布文章。</div>
      ) : (
        <div className="post-list">
          {posts.map((post) => (
            <article className="post-item" key={post.id}>
              <h2>
                <a href={postHref(post.slug, wide)}>{post.title}</a>
              </h2>
              <p className="post-meta">{formatDate(post.published_at ?? post.created_at)}</p>
              {post.excerpt ? <p className="post-excerpt">{post.excerpt}</p> : null}
              {isAdmin ? <PostAdminActions slug={post.slug} title={post.title} returnTo={returnTo} /> : null}
            </article>
          ))}
        </div>
      )}
      <nav className="pagination" aria-label="分页">
        {result.page > 1 ? (
          <a href={hrefFor({ page: result.page - 1, sort: result.sort, wide })}>上一页</a>
        ) : (
          <span>上一页</span>
        )}
        <span>
          第 {result.page} / {result.pageCount} 页
        </span>
        {result.page < result.pageCount ? (
          <a href={hrefFor({ page: result.page + 1, sort: result.sort, wide })}>下一页</a>
        ) : (
          <span>下一页</span>
        )}
      </nav>
    </main>
  );
}
