import { cookies } from "next/headers";
import { getServerEnv } from "@/lib/env";
import { verifyAdminSessionToken } from "@/lib/auth";
import { RichTextEditor } from "@/components/RichTextEditor";
import { getPostForAdminBySlug } from "@/lib/posts";

export const dynamic = "force-dynamic";

type AdminPageProps = {
  searchParams?: Promise<{ edit?: string; next?: string }>;
};

function nextPathForEdit(slug: string | undefined): string {
  return slug ? `/admin?edit=${encodeURIComponent(slug)}` : "/admin";
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
  const nextPath = params?.next ?? nextPathForEdit(params?.edit);

  return (
    <main className={isAuthed ? "page page-wide" : "page"}>
      <h1 className="page-title">后台</h1>
      {isAuthed ? (
        <form className="admin-form" action="/api/admin/posts" method="post">
          {editingPost ? <input type="hidden" name="id" value={editingPost.id} /> : null}
          <input name="title" placeholder="标题" aria-label="标题" defaultValue={editingPost?.title ?? ""} required />
          <input name="slug" placeholder="slug" aria-label="slug" defaultValue={editingPost?.slug ?? ""} required />
          <select name="status" defaultValue={editingPost?.status === "published" ? "published" : "draft"} aria-label="状态">
            <option value="draft">草稿</option>
            <option value="published">发布</option>
          </select>
          <RichTextEditor name="content_html" initialHtml={editingPost?.content_html ?? ""} />
          <button className="button-link" type="submit">
            {editingPost ? "更新" : "保存"}
          </button>
        </form>
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
