import { expect, test } from "@playwright/test";

test("public reader can browse and search posts", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "文章" })).toBeVisible();
  await expect(page.getByRole("link", { name: "第一篇日记" })).toBeVisible();

  await page.getByRole("link", { name: "搜索" }).click();
  await page.getByLabel("搜索关键词").fill("牛肉");
  await page.getByRole("button", { name: "搜索" }).click();
  await expect(page.getByRole("link", { name: "鹰嘴豆炖牛肉" })).toBeVisible();

  await page.getByRole("link", { name: "鹰嘴豆炖牛肉" }).click();
  await expect(page.getByRole("heading", { name: "鹰嘴豆炖牛肉" })).toBeVisible();
  await expect(page.locator(".article-body img")).toHaveAttribute("src", "https://assets.example/beef.jpg");
});

test("admin login accepts configured password", async ({ page }) => {
  await page.goto("/admin");
  await page.getByLabel("后台密码").fill("secret");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page.getByLabel("标题")).toBeVisible();
});
