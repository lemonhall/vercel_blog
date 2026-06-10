import { describe, expect, it } from "vitest";
import { deleteAdminPost, saveAdminPost } from "@/lib/admin-posts";
import { createAdminSessionToken, verifyAdminPassword, verifyAdminSessionToken } from "@/lib/auth";

describe("admin auth", () => {
  it("verifies the configured admin password", () => {
    expect(verifyAdminPassword("secret", "secret")).toBe(true);
    expect(verifyAdminPassword("wrong", "secret")).toBe(false);
  });

  it("creates deterministic session tokens bound to the cookie secret", () => {
    const token = createAdminSessionToken("cookie-secret", "admin-password");

    expect(verifyAdminSessionToken(token, "cookie-secret", "admin-password")).toBe(true);
    expect(verifyAdminSessionToken(token, "other-secret", "admin-password")).toBe(false);
    expect(verifyAdminSessionToken(token, "cookie-secret", "wrong-password")).toBe(false);
  });
});

describe("admin post actions", () => {
  it("updates an existing post when an id is provided", async () => {
    const calls: Array<{ name: string; args: unknown[] }> = [];
    const builder = {
      update(payload: unknown) {
        calls.push({ name: "update", args: [payload] });
        return builder;
      },
      insert(payload: unknown) {
        calls.push({ name: "insert", args: [payload] });
        return Promise.resolve({ data: null, error: null });
      },
      eq(column: string, value: unknown) {
        calls.push({ name: "eq", args: [column, value] });
        return Promise.resolve({ data: null, error: null });
      }
    };
    const client = {
      from(table: string) {
        calls.push({ name: "from", args: [table] });
        return builder;
      }
    };

    await saveAdminPost(
      {
        id: "post-1",
        title: "更新标题",
        slug: "updated-title",
        contentHtml: "<p>更新正文</p>",
        status: "published"
      },
      client
    );

    expect(calls.some((call) => call.name === "insert")).toBe(false);
    expect(calls).toContainEqual({ name: "eq", args: ["id", "post-1"] });
    expect(calls.find((call) => call.name === "update")?.args[0]).toMatchObject({
      title: "更新标题",
      slug: "updated-title",
      status: "published"
    });
  });

  it("logically deletes a post by demoting it to draft without deleting the row", async () => {
    const calls: Array<{ name: string; args: unknown[] }> = [];
    const builder = {
      update(payload: unknown) {
        calls.push({ name: "update", args: [payload] });
        return builder;
      },
      insert(payload: unknown) {
        calls.push({ name: "insert", args: [payload] });
        return Promise.resolve({ data: null, error: null });
      },
      delete() {
        calls.push({ name: "delete", args: [] });
        return builder;
      },
      eq(column: string, value: unknown) {
        calls.push({ name: "eq", args: [column, value] });
        return Promise.resolve({ data: null, error: null });
      }
    };
    const client = {
      from(table: string) {
        calls.push({ name: "from", args: [table] });
        return builder;
      }
    };

    await deleteAdminPost("post-slug", client);

    expect(calls.some((call) => call.name === "delete")).toBe(false);
    expect(calls).toContainEqual({ name: "update", args: [{ status: "draft" }] });
    expect(calls).toContainEqual({ name: "eq", args: ["slug", "post-slug"] });
  });

  it("saves recipe kind and tag names through the post tag RPC", async () => {
    const calls: Array<{ name: string; args: unknown[] }> = [];
    const builder = {
      update(payload: unknown) {
        calls.push({ name: "update", args: [payload] });
        return builder;
      },
      insert(payload: unknown) {
        calls.push({ name: "insert", args: [payload] });
        return Promise.resolve({ data: null, error: null });
      },
      eq(column: string, value: unknown) {
        calls.push({ name: "eq", args: [column, value] });
        return Promise.resolve({ data: null, error: null });
      }
    };
    const client = {
      from(table: string) {
        calls.push({ name: "from", args: [table] });
        return builder;
      },
      rpc(name: string, args: unknown) {
        calls.push({ name: "rpc", args: [name, args] });
        return Promise.resolve({ data: null, error: null });
      }
    };

    await saveAdminPost(
      {
        id: "post-1",
        title: "番茄炖牛肉",
        slug: "tomato-beef",
        contentHtml: "<p>牛肉和番茄慢炖。</p>",
        status: "published",
        contentKind: "recipe",
        tagNames: ["牛肉", "炖菜", "法国菜"]
      },
      client
    );

    expect(calls.find((call) => call.name === "update")?.args[0]).toMatchObject({
      content_kind: "recipe"
    });
    expect(calls).toContainEqual({
      name: "rpc",
      args: ["save_post_tags", { post_slug: "tomato-beef", tag_names: ["牛肉", "炖菜", "法国菜"] }]
    });
  });
});
