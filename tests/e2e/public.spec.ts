import { expect, test, type Page } from "@playwright/test";

async function unlockSite(page: Page, next = "/") {
  await page.goto(`/admin?next=${encodeURIComponent(next)}`);
  await page.getByLabel("后台密码").fill("secret");
  await page.getByRole("button", { name: "登录" }).click();
}

test("private reader can unlock the site and browse and search posts", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/admin\?next=%2F$/);
  await page.getByLabel("后台密码").fill("secret");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page).toHaveURL(/\/$/);
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
  await expect(page.getByRole("button", { name: "删除 第一篇日记" })).toBeVisible();

  await page.getByRole("link", { name: "搜索" }).click();
  await page.getByLabel("搜索关键词").fill("牛肉");
  await page.getByRole("button", { name: "搜索" }).click();
  await expect(page.getByRole("link", { name: "鹰嘴豆炖牛肉" })).toBeVisible();

  await page.getByRole("link", { name: "鹰嘴豆炖牛肉" }).click();
  await expect(page.getByRole("heading", { name: "鹰嘴豆炖牛肉" })).toBeVisible();
  await expect(page.locator(".article-body img")).toHaveAttribute("src", "https://assets.example/beef.jpg");
  await expect(page.getByRole("link", { name: "编辑 鹰嘴豆炖牛肉" })).toHaveAttribute(
    "href",
    /\/admin\?edit=beef-and-chickpeas/
  );
  await expect(page.getByRole("button", { name: "删除 鹰嘴豆炖牛肉" })).toBeVisible();
});

test("mobile public list wraps long titles and excerpts without horizontal scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await unlockSite(page);
  await expect(page.getByRole("heading", { name: "文章" })).toBeVisible();

  await page.locator(".post-item").first().evaluate((item) => {
    const title = item.querySelector("h2 a");
    const excerpt = item.querySelector(".post-excerpt");
    if (title) {
      title.textContent = "VeryLongUnbrokenTitleForMobileChromeOverflowRegression012345678901234567890123456789";
    }
    if (excerpt) {
      excerpt.textContent = "https://example.com/very/long/path/that/should/not/create/horizontal/scrolling/on/ios/chrome";
    }
  });

  const metrics = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    documentScroll: document.documentElement.scrollWidth,
    bodyScroll: document.body.scrollWidth,
    firstPostWidth: document.querySelector(".post-item")?.getBoundingClientRect().width ?? 0
  }));

  expect(metrics.documentScroll).toBeLessThanOrEqual(metrics.viewport + 1);
  expect(metrics.bodyScroll).toBeLessThanOrEqual(metrics.viewport + 1);
  expect(metrics.firstPostWidth).toBeLessThanOrEqual(metrics.viewport);
});

test("admin login accepts configured password", async ({ page }) => {
  await page.goto("/admin");
  await page.getByLabel("后台密码").fill("secret");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page.getByRole("textbox", { name: "标题" })).toBeVisible();
});

test("admin can see post actions and gets confirmation before logical delete", async ({ page }) => {
  await page.goto("/admin");
  await page.getByLabel("后台密码").fill("secret");
  await page.getByRole("button", { name: "登录" }).click();

  await page.goto("/?sort=asc");
  await expect(page.getByRole("link", { name: "编辑 第一篇日记" })).toHaveAttribute("href", /\/admin\?edit=first-note/);
  const deleteButton = page.getByRole("button", { name: "删除 第一篇日记" });
  await expect(deleteButton).toBeVisible();

  page.on("dialog", async (dialog) => {
    expect(dialog.message()).toContain("移入草稿");
    await dialog.dismiss();
  });
  await deleteButton.click();
  await expect(page).toHaveURL(/\/\?sort=asc/);
});

test("admin can manage drafts and reopen a draft in the editor", async ({ page }) => {
  await page.goto("/admin");
  await page.getByLabel("后台密码").fill("secret");
  await page.getByRole("button", { name: "登录" }).click();

  await expect(page.getByRole("heading", { name: "草稿管理" })).toBeVisible();
  await expect(page.getByText("旧草稿")).toBeVisible();
  await page.getByRole("link", { name: "编辑 旧草稿" }).click();

  await expect(page.getByRole("textbox", { name: "标题" })).toHaveValue("旧草稿");
  await expect(page.getByLabel("状态")).toHaveValue("draft");
});

test("admin can edit recipe tags and readers can browse recipe tag pages", async ({ page }) => {
  await page.goto("/admin");
  await page.getByLabel("后台密码").fill("secret");
  await page.getByRole("button", { name: "登录" }).click();

  await page.goto("/admin?edit=beef-and-chickpeas");
  await expect(page.getByLabel("文章类型")).toHaveValue("recipe");
  await expect(page.getByLabel("Tags")).toHaveValue(/牛肉/);
  await expect(page.getByLabel("AI 估算卡路里")).toBeVisible();
  await expect(page.getByLabel("已保存卡路里估算")).toContainText("约 450 kcal/份");

  await page.getByLabel("Tags").fill("牛肉, 炖菜, 家常菜");
  await page.getByRole("button", { name: "更新" }).click();

  await page.goto("/recipes");
  await expect(page.getByRole("heading", { name: "食谱", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "鹰嘴豆炖牛肉" })).toBeVisible();
  const recipeCard = page.locator(".post-item").filter({ has: page.getByRole("link", { name: "鹰嘴豆炖牛肉" }) });
  await expect(recipeCard).toContainText("约 450 kcal/份");
  await expect(recipeCard.locator(".post-tags")).toContainText("牛肉");
  await expect(recipeCard.locator(".post-tags")).toContainText("炖菜");
  await recipeCard.getByRole("link", { name: "鹰嘴豆炖牛肉" }).click();
  await expect(page.getByRole("region", { name: "卡路里估算" })).toContainText("牛肉");
  await expect(page.getByRole("region", { name: "卡路里估算" })).toContainText("约 1250 kcal");
  await page.goto("/recipes");
  await expect(page.getByRole("navigation", { name: "分页" })).toContainText("第 1 / 2 页");
  await expect(page.getByRole("link", { name: "下一页" })).toBeVisible();
  await page.getByLabel("食谱搜索关键词").fill("鹰嘴豆");
  await page.getByRole("button", { name: "搜索食谱" }).click();
  await expect(page).toHaveURL(/\/recipes\?q=/);
  await expect(page.getByRole("link", { name: "鹰嘴豆炖牛肉" })).toBeVisible();
  await expect(page.getByRole("link", { name: "测试食谱 1" })).toHaveCount(0);
  await page.getByLabel("食谱搜索关键词").fill("第14篇日记");
  await page.getByRole("button", { name: "搜索食谱" }).click();
  await expect(page.getByText("没有找到匹配食谱。")).toBeVisible();
  await page.goto("/recipes");
  const beefTag = page.locator(".tag-cloud").getByRole("link", { name: "牛肉 1" });
  await expect(beefTag).toBeVisible();
  await expect(beefTag).toHaveAttribute("href", "/recipes?tags=beef");
  await beefTag.click();
  await expect(page).toHaveURL(/\/recipes\?tags=beef/);
  await expect(page.locator(".tag-cloud").getByRole("link", { name: "牛肉 1" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("link", { name: "全部取消" })).toBeVisible();
  await expect(page.getByRole("link", { name: "鹰嘴豆炖牛肉" })).toBeVisible();

  await page.locator(".tag-cloud").getByRole("link", { name: "炖菜 1" }).click();
  await expect(page).toHaveURL(/\/recipes\?tags=beef%2Cstew/);
  await expect(page.locator(".tag-cloud").getByRole("link", { name: "牛肉 1" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".tag-cloud").getByRole("link", { name: "炖菜 1" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("link", { name: "鹰嘴豆炖牛肉" })).toBeVisible();
  await expect(page.getByRole("link", { name: "测试食谱 1" })).toHaveCount(0);

  await page.locator(".tag-cloud").getByRole("link", { name: "炖菜 1" }).click();
  await expect(page).toHaveURL(/\/recipes\?tags=beef/);
  await expect(page.locator(".tag-cloud").getByRole("link", { name: "炖菜 1" })).toHaveAttribute("aria-pressed", "false");
  await page.locator(".tag-cloud").getByRole("link", { name: "牛肉 1" }).click();
  await expect(page).toHaveURL(/\/recipes$/);
  await expect(page.getByRole("link", { name: "全部取消" })).toHaveCount(0);

  await page.goto("/recipes?tags=beef,stew");
  await page.getByRole("link", { name: "全部取消" }).click();
  await expect(page).toHaveURL(/\/recipes$/);

  await page.goto("/recipes/tags/beef");
  await expect(page).toHaveURL(/\/recipes\?tags=beef/);
  await expect(page.getByRole("heading", { name: "食谱", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "鹰嘴豆炖牛肉" })).toBeVisible();
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
