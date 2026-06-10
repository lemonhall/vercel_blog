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
  await expect(page.getByRole("textbox", { name: "标题" })).toBeVisible();
});

test("admin editor exposes upgraded controls and mobile friendly toolbar", async ({ page, isMobile }) => {
  await page.goto("/admin");
  await page.getByLabel("后台密码").fill("secret");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page.locator("main.page")).toHaveClass(/page-wide/);

  for (const name of ["标题 1", "项目符号", "链接", "图片", "表格", "代码块", "撤销", "重做"]) {
    const button = page.getByRole("button", { name, exact: true });
    await expect(button).toBeVisible();
    await expect(button).toHaveAttribute("title", name);
  }

  await expect(page.getByRole("button", { name: "图片", exact: true })).toHaveText("图片");

  const metrics = await page.locator(".editor-toolbar").evaluate((toolbar) => {
    const firstButton = toolbar.querySelector("button");
    const buttonRect = firstButton?.getBoundingClientRect();
    const toolbarRect = toolbar.getBoundingClientRect();
    return {
      viewport: document.documentElement.clientWidth,
      bodyScroll: document.documentElement.scrollWidth,
      toolbarScroll: toolbar.scrollWidth,
      toolbarClient: toolbar.clientWidth,
      buttonHeight: buttonRect?.height ?? 0,
      position: window.getComputedStyle(toolbar).position,
      toolbarTop: toolbarRect.top
    };
  });

  expect(metrics.bodyScroll).toBeLessThanOrEqual(metrics.viewport + 1);
  expect(metrics.buttonHeight).toBeGreaterThanOrEqual(44);
  expect(metrics.position).toBe("sticky");
  expect(metrics.toolbarTop).toBeGreaterThanOrEqual(0);
  expect(metrics.toolbarScroll).toBeLessThanOrEqual(metrics.toolbarClient + 1);

  await page.locator(".editor-surface").evaluate((surface) => {
    (surface as HTMLElement).style.minHeight = "1800px";
  });
  await page.evaluate(() => window.scrollTo(0, 900));
  const stickyTop = await page.locator(".editor-toolbar").evaluate((toolbar) => toolbar.getBoundingClientRect().top);
  expect(stickyTop).toBeGreaterThanOrEqual(isMobile ? 96 : 54);
  expect(stickyTop).toBeLessThanOrEqual(isMobile ? 124 : 84);
});
