import type { Post } from "@/lib/posts";

export const fixturePosts: Post[] = [
  {
    id: "fixture-1",
    legacy_id: 1,
    title: "第一篇日记",
    slug: "first-note",
    content_html: "<p>这是迁移后的第一篇日记。</p><pre><code class=\"language-ts\">console.log('hello')</code></pre>",
    excerpt: "这是迁移后的第一篇日记。",
    status: "published",
    created_at: "2022-05-20T21:20:14.000Z",
    updated_at: "2022-05-21T21:30:38.430Z",
    published_at: "2022-05-20T21:20:14.000Z"
  },
  {
    id: "fixture-2",
    legacy_id: 6,
    title: "鹰嘴豆炖牛肉",
    slug: "beef-and-chickpeas",
    content_html: "<p>牛肉、鹰嘴豆、番茄和香料。</p><img src=\"https://assets.example/beef.jpg\" alt=\"牛肉\" />",
    excerpt: "牛肉、鹰嘴豆、番茄和香料。",
    status: "published",
    created_at: "2022-05-23T21:09:02.478Z",
    updated_at: "2022-05-23T21:24:19.540Z",
    published_at: "2022-05-23T21:09:02.478Z"
  },
  {
    id: "fixture-draft-1",
    legacy_id: 18,
    title: "旧草稿",
    slug: "old-draft",
    content_html: "<p>这是一篇还没有发布的草稿。</p>",
    excerpt: "这是一篇还没有发布的草稿。",
    status: "draft",
    created_at: "2022-05-24T09:00:00.000Z",
    updated_at: "2022-05-24T10:00:00.000Z",
    published_at: null
  },
  ...Array.from({ length: 12 }, (_, index) => {
    const day = String(index + 1).padStart(2, "0");
    return {
      id: `fixture-extra-${index + 1}`,
      legacy_id: 100 + index,
      title: `第${index + 3}篇日记`,
      slug: `note-${index + 3}`,
      content_html: `<p>这是第${index + 3}篇分页测试日记。</p>`,
      excerpt: `这是第${index + 3}篇分页测试日记。`,
      status: "published" as const,
      created_at: `2022-06-${day}T09:00:00.000Z`,
      updated_at: `2022-06-${day}T09:00:00.000Z`,
      published_at: `2022-06-${day}T09:00:00.000Z`
    };
  })
];

export function useFixtureData(): boolean {
  return process.env.USE_FIXTURE_DATA === "1";
}
