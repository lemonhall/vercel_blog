import { cookies } from "next/headers";
import { getServerEnv } from "@/lib/env";
import { verifyAdminSessionToken } from "@/lib/auth";
import { RichTextEditor } from "@/components/RichTextEditor";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const env = getServerEnv();
  const cookieStore = await cookies();
  const isAuthed = verifyAdminSessionToken(
    cookieStore.get("admin_session")?.value,
    env.authCookieSecret,
    env.adminPassword
  );

  return (
    <main className="page">
      <h1 className="page-title">后台</h1>
      {isAuthed ? (
        <form className="admin-form" action="/api/admin/posts" method="post">
          <input name="title" placeholder="标题" aria-label="标题" required />
          <input name="slug" placeholder="slug" aria-label="slug" required />
          <select name="status" defaultValue="draft" aria-label="状态">
            <option value="draft">草稿</option>
            <option value="published">发布</option>
          </select>
          <RichTextEditor name="content_html" />
          <button className="button-link" type="submit">
            保存
          </button>
        </form>
      ) : (
        <form className="search-form" action="/api/admin/login" method="post">
          <input name="password" type="password" placeholder="后台密码" aria-label="后台密码" />
          <button type="submit">登录</button>
        </form>
      )}
    </main>
  );
}
