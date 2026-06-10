import { expect, test } from "@playwright/test";

test("public reader can browse and search posts", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "文章" })).toBeVisible();
  await expect(page.getByRole("link", { name: "第14篇日记", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "🍋 柠檬叔的博客" })).toBeVisible();
  await expect(page.getByRole("contentinfo")).toContainText("lemonhall.me");

  await page.getByRole("link", { name: "宽模式" }).click();
  await expect(page.locator("main.page")).toHaveClass(/page-wide/);

  await page.getByRole("link", { name: "旧到新" }).click();
  await expect(page.getByRole("link", { name: "第一篇日记", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "下一页" })).toBeVisible();
  await expect(page.getByRole("link", { name: "编辑 第一篇日记" })).toHaveAttribute("href", /\/admin\?edit=first-note/);

  await page.getByRole("link", { name: "搜索" }).click();
  await page.getByLabel("搜索关键词").fill("牛肉");
  await page.getByRole("button", { name: "搜索" }).click();
  await expect(page.getByRole("link", { name: "鹰嘴豆炖牛肉" })).toBeVisible();

  await page.getByRole("link", { name: "鹰嘴豆炖牛肉" }).click();
  await expect(page.getByRole("heading", { name: "鹰嘴豆炖牛肉" })).toBeVisible();
  await expect(page.locator(".article-body img")).toHaveAttribute("src", "https://assets.example/beef.jpg");
  await expect(page.getByRole("link", { name: "编辑 鹰嘴豆炖牛肉" })).toBeVisible();
  await expect(page.getByRole("button", { name: "删除 鹰嘴豆炖牛肉" })).toBeVisible();
});

test("admin login accepts configured password", async ({ page }) => {
  await page.goto("/admin");
  await page.getByLabel("后台密码").fill("secret");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page.getByLabel("标题")).toBeVisible();
});
