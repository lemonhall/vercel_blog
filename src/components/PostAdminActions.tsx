"use client";

type PostAdminActionsProps = {
  slug: string;
  title: string;
  returnTo: string;
};

export function PostAdminActions({ slug, title, returnTo }: PostAdminActionsProps) {
  return (
    <div className="post-actions">
      <a className="icon-action" aria-label={`编辑 ${title}`} title="编辑" href={`/admin?edit=${encodeURIComponent(slug)}`}>
        ✏️
      </a>
      <form
        action="/api/admin/posts/delete"
        method="post"
        onSubmit={(event) => {
          if (!window.confirm(`确认把《${title}》移入草稿吗？`)) {
            event.preventDefault();
          }
        }}
      >
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="return_to" value={returnTo} />
        <button className="icon-action" type="submit" aria-label={`删除 ${title}`} title="移入草稿">
          🗑️
        </button>
      </form>
    </div>
  );
}
