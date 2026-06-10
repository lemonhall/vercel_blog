import { cookies } from "next/headers";
import { getServerEnv } from "@/lib/env";
import { verifyAdminSessionToken } from "@/lib/auth";
import { RichTextEditor } from "@/components/RichTextEditor";
import { getPostForAdminBySlug, listDraftPosts, listTagsForPost, type Post } from "@/lib/posts";

export const dynamic = "force-dynamic";

type AdminPageProps = {
  searchParams?: Promise<{ edit?: string; next?: string }>;
};

function nextPathForEdit(slug: string | undefined): string {
  return slug ? `/admin?edit=${encodeURIComponent(slug)}` : "/admin";
}

function formatDate(value: string | null): string {
  if (!value) {
    return "无更新时间";
  }
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function DraftManagement({ drafts }: { drafts: Post[] }) {
  return (
    <section className="draft-panel" aria-labelledby="drafts-heading">
      <div className="section-heading">
        <h2 id="drafts-heading">草稿管理</h2>
        <span>{drafts.length} 篇</span>
      </div>
      {drafts.length === 0 ? (
        <div className="empty-state">暂无草稿。</div>
      ) : (
        <div className="draft-list">
          {drafts.map((post) => (
            <article className="draft-item" key={post.id}>
              <div>
                <h3>{post.title}</h3>
                <p>更新于 {formatDate(post.updated_at)}</p>
              </div>
              <a className="button-link" aria-label={`编辑 ${post.title}`} href={`/admin?edit=${encodeURIComponent(post.slug)}`}>
                编辑
              </a>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

async function safeListTagsForPost(post: Post | null) {
  if (!post) {
    return [];
  }
  try {
    return await listTagsForPost(post.id);
  } catch {
    return [];
  }
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const params = await searchParams;
  const env = getServerEnv();
  const cookieStore = await cookies();
  const isAuthed = verifyAdminSessionToken(
    cookieStore.get("admin_session")?.value,
    env.authCookieSecret,
    env.adminPassword
  );
  const editingPost = isAuthed && params?.edit ? await getPostForAdminBySlug(params.edit) : null;
  const editingTags = await safeListTagsForPost(editingPost);
  const drafts = isAuthed ? await listDraftPosts() : [];
  const nextPath = params?.next ?? nextPathForEdit(params?.edit);

  return (
    <main className={isAuthed ? "page page-wide" : "page"}>
      <h1 className="page-title">后台</h1>
      {isAuthed ? (
        <>
          <form className="admin-form" action="/api/admin/posts" method="post">
            {editingPost ? <input type="hidden" name="id" value={editingPost.id} /> : null}
            <input name="title" placeholder="标题" aria-label="标题" defaultValue={editingPost?.title ?? ""} required />
            <input name="slug" placeholder="slug" aria-label="slug" defaultValue={editingPost?.slug ?? ""} required />
            <select name="status" defaultValue={editingPost?.status === "published" ? "published" : "draft"} aria-label="状态">
              <option value="draft">草稿</option>
              <option value="published">发布</option>
            </select>
            <select
              name="content_kind"
              defaultValue={editingPost?.content_kind === "recipe" ? "recipe" : "post"}
              aria-label="文章类型"
            >
              <option value="post">普通文章</option>
              <option value="recipe">食谱</option>
            </select>
            <input
              name="tags"
              placeholder="Tags，用逗号分隔"
              aria-label="Tags"
              defaultValue={editingTags.map((tag) => tag.name).join(", ")}
            />
            <RichTextEditor name="content_html" initialHtml={editingPost?.content_html ?? ""} />
            <button className="button-link" type="submit">
              {editingPost ? "更新" : "保存"}
            </button>
          </form>
          <DraftManagement drafts={drafts} />
        </>
      ) : (
        <form className="search-form" action="/api/admin/login" method="post">
          <input type="hidden" name="next" value={nextPath} />
          <input name="password" type="password" placeholder="后台密码" aria-label="后台密码" />
          <button type="submit">登录</button>
        </form>
      )}
    </main>
  );
}
