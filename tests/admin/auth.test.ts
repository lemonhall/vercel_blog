import { describe, expect, it } from "vitest";
import { maybeEstimateAndSaveRecipeNutrition, deleteAdminPost, saveAdminPost } from "@/lib/admin-posts";
import { createAdminSessionToken, verifyAdminPassword, verifyAdminSessionToken } from "@/lib/auth";
import { estimateRecipeNutritionWithGateway, validateRecipeNutritionJson } from "@/lib/recipe-nutrition";
import { getSiteAccessDecision, verifySiteSessionToken } from "@/lib/site-access";

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

  it("lets middleware verify the existing admin session cookie without node crypto", async () => {
    const token = createAdminSessionToken("cookie-secret", "admin-password");

    await expect(
      verifySiteSessionToken(token, { authCookieSecret: "cookie-secret", adminPassword: "admin-password" })
    ).resolves.toBe(true);
    await expect(
      verifySiteSessionToken(token, { authCookieSecret: "cookie-secret", adminPassword: "wrong-password" })
    ).resolves.toBe(false);
    await expect(
      verifySiteSessionToken(undefined, { authCookieSecret: "cookie-secret", adminPassword: "admin-password" })
    ).resolves.toBe(false);
  });

  it("redirects unauthenticated page requests before they reach Supabase-backed pages", async () => {
    const decision = await getSiteAccessDecision({
      method: "GET",
      url: "https://lemonhall.me/recipes?tags=beef",
      sessionToken: undefined,
      env: { authCookieSecret: "cookie-secret", adminPassword: "admin-password" }
    });

    expect(decision).toEqual({
      action: "redirect",
      location: "https://lemonhall.me/admin?next=%2Frecipes%3Ftags%3Dbeef"
    });
  });

  it("forbids known crawlers without redirecting them to the dynamic login page", async () => {
    const decision = await getSiteAccessDecision({
      method: "GET",
      url: "https://lemonhall.me/recipes?tags=beef,stew",
      userAgent: "Mozilla/5.0 compatible; OAI-SearchBot/1.0",
      sessionToken: undefined,
      env: { authCookieSecret: "cookie-secret", adminPassword: "admin-password" }
    });

    expect(decision).toEqual({ action: "forbidden" });
  });

  it("forbids crawlers from opening the dynamic admin login directly", async () => {
    await expect(
      getSiteAccessDecision({
        method: "GET",
        url: "https://lemonhall.me/admin",
        userAgent: "ChatGPT-User/1.0",
        sessionToken: undefined,
        env: { authCookieSecret: "cookie-secret", adminPassword: "admin-password" }
      })
    ).resolves.toEqual({ action: "forbidden" });
  });

  it("does not mistake dotted dynamic post slugs for public static assets", async () => {
    const env = { authCookieSecret: "cookie-secret", adminPassword: "admin-password" };
    await expect(
      getSiteAccessDecision({
        method: "GET",
        url: "https://lemonhall.me/posts/private-note.txt",
        userAgent: "Mozilla/5.0",
        sessionToken: undefined,
        env
      })
    ).resolves.toEqual({
      action: "redirect",
      location: "https://lemonhall.me/admin?next=%2Fposts%2Fprivate-note.txt"
    });
    await expect(
      getSiteAccessDecision({
        method: "GET",
        url: "https://lemonhall.me/posts/private-note.txt",
        userAgent: "OAI-SearchBot/1.0",
        sessionToken: undefined,
        env
      })
    ).resolves.toEqual({ action: "forbidden" });
  });

  it("allows login and static assets while rejecting unauthenticated protected APIs", async () => {
    const env = { authCookieSecret: "cookie-secret", adminPassword: "admin-password" };

    await expect(
      getSiteAccessDecision({ method: "GET", url: "https://lemonhall.me/admin?next=%2F", sessionToken: undefined, env })
    ).resolves.toEqual({ action: "allow" });
    await expect(
      getSiteAccessDecision({ method: "POST", url: "https://lemonhall.me/api/admin/login", sessionToken: undefined, env })
    ).resolves.toEqual({ action: "allow" });
    await expect(
      getSiteAccessDecision({ method: "GET", url: "https://lemonhall.me/icon.svg", sessionToken: undefined, env })
    ).resolves.toEqual({ action: "allow" });
    await expect(
      getSiteAccessDecision({ method: "GET", url: "https://lemonhall.me/robots.txt", sessionToken: undefined, env })
    ).resolves.toEqual({ action: "allow" });
    await expect(
      getSiteAccessDecision({ method: "POST", url: "https://lemonhall.me/api/uploads/image", sessionToken: undefined, env })
    ).resolves.toEqual({ action: "unauthorized" });
  });

  it("allows protected pages when the existing admin session cookie is valid", async () => {
    const env = { authCookieSecret: "cookie-secret", adminPassword: "admin-password" };
    const token = createAdminSessionToken(env.authCookieSecret, env.adminPassword);

    await expect(
      getSiteAccessDecision({ method: "GET", url: "https://lemonhall.me/posts/first-note", sessionToken: token, env })
    ).resolves.toEqual({ action: "allow" });
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

  it("does not estimate calories for ordinary posts or unrequested recipe saves", async () => {
    const client = {
      from() {
        throw new Error("must not write nutrition");
      },
      rpc() {
        throw new Error("must not call nutrition rpc");
      }
    };
    const estimator = async () => {
      throw new Error("must not call estimator");
    };

    await maybeEstimateAndSaveRecipeNutrition(
      {
        title: "普通文章",
        slug: "normal-post",
        contentHtml: "<p>正文</p>",
        status: "draft",
        contentKind: "post",
        tagNames: [],
        estimateCalories: true
      },
      client,
      estimator
    );
    await maybeEstimateAndSaveRecipeNutrition(
      {
        title: "番茄炖牛肉",
        slug: "tomato-beef",
        contentHtml: "<p>牛肉和番茄慢炖。</p>",
        status: "published",
        contentKind: "recipe",
        tagNames: ["牛肉"],
        estimateCalories: false
      },
      client,
      estimator
    );
  });

  it("estimates recipe calories with GPT-5.2 and persists ingredient details", async () => {
    const calls: Array<{ name: string; args: unknown }> = [];
    const client = {
      from() {
        throw new Error("must use rpc");
      },
      rpc(name: string, args: unknown) {
        calls.push({ name, args });
        return Promise.resolve({ data: null, error: null });
      }
    };
    const estimator = async (input: { title: string; model: string }) => {
      expect(input.title).toBe("番茄炖牛肉");
      expect(input.model).toBe("openai/gpt-5.2");
      return {
        servings: 4,
        caloriesTotalKcal: 1800,
        caloriesPerServingKcal: 450,
        ingredientEstimates: [{ name: "牛肉", amount: "500g", caloriesKcal: 1250, note: "按 250 kcal/100g 估算" }],
        confidence: 0.72,
        needsReview: false,
        summary: "每份约 450 kcal。",
        model: "openai/gpt-5.2",
        promptVersion: "recipe-calorie-v1",
        sourceHash: "hash-1",
        rawEstimateJson: { ok: true }
      };
    };

    await maybeEstimateAndSaveRecipeNutrition(
      {
        title: "番茄炖牛肉",
        slug: "tomato-beef",
        contentHtml: "<p>牛肉和番茄慢炖。</p>",
        status: "published",
        contentKind: "recipe",
        tagNames: ["牛肉", "炖菜"],
        estimateCalories: true
      },
      client,
      estimator
    );

    expect(calls).toEqual([
      {
        name: "save_recipe_nutrition_estimate",
        args: {
          post_slug: "tomato-beef",
          servings: 4,
          calories_total_kcal: 1800,
          calories_per_serving_kcal: 450,
          ingredient_estimates_json: [{ name: "牛肉", amount: "500g", caloriesKcal: 1250, note: "按 250 kcal/100g 估算" }],
          confidence: 0.72,
          needs_review: false,
          summary: "每份约 450 kcal。",
          model: "openai/gpt-5.2",
          prompt_version: "recipe-calorie-v1",
          source_hash: "hash-1",
          raw_estimate_json: { ok: true }
        }
      }
    ]);
  });

  it("uses AI Gateway chat completions without response_format for provider compatibility", async () => {
    let requestBody: Record<string, unknown> | null = null;
    const fetchImpl = async (_url: string, init?: RequestInit) => {
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  servings: 2,
                  calories_total_kcal: 600,
                  calories_per_serving_kcal: 300,
                  ingredient_estimates: [{ name: "鸡蛋", amount: "2个", calories_kcal: 160, note: "估算" }],
                  confidence: 0.7,
                  needs_review: false,
                  summary: "每份约 300 kcal。"
                })
              }
            }
          ]
        }),
        { status: 200 }
      );
    };

    await estimateRecipeNutritionWithGateway(
      { title: "鸡蛋羹", slug: "egg", contentHtml: "<p>鸡蛋 2 个。</p>", tagNames: ["家常菜"] },
      { apiKey: "key", fetchImpl: fetchImpl as typeof fetch }
    );

    expect(requestBody).toMatchObject({
      model: "openai/gpt-5.2",
      stream: false
    });
    expect(requestBody).not.toHaveProperty("response_format");
  });

  it("includes AI Gateway error body when calorie estimation is rejected", async () => {
    const fetchImpl = async () =>
      new Response(JSON.stringify({ error: { message: "Unsupported parameter: response_format" } }), { status: 400 });

    await expect(
      estimateRecipeNutritionWithGateway(
        { title: "鸡蛋羹", slug: "egg", contentHtml: "<p>鸡蛋 2 个。</p>", tagNames: ["家常菜"] },
        { apiKey: "key", fetchImpl: fetchImpl as typeof fetch }
      )
    ).rejects.toThrow("Unsupported parameter: response_format");
  });

  it("accepts common model JSON aliases for recipe calories", () => {
    const estimate = validateRecipeNutritionJson(
      {
        servings: "4人份",
        total_calories: "1800 kcal",
        per_serving_calories: "450 kcal",
        ingredients: [{ name: "牛肉", quantity: "500g", calories: "1250 kcal", notes: "按常见热量估算" }],
        confidence: 72,
        explanation: "每份约 450 kcal。"
      },
      { model: "openai/gpt-5.2", sourceHash: "hash-1" }
    );

    expect(estimate).toMatchObject({
      servings: 4,
      caloriesTotalKcal: 1800,
      caloriesPerServingKcal: 450,
      confidence: 0.72,
      summary: "每份约 450 kcal。"
    });
    expect(estimate.ingredientEstimates).toEqual([
      { name: "牛肉", amount: "500g", caloriesKcal: 1250, note: "按常见热量估算" }
    ]);
  });

  it("reports invalid model JSON keys when recipe calorie validation fails", () => {
    expect(() =>
      validateRecipeNutritionJson({ total: 123, food: [] }, { model: "openai/gpt-5.2", sourceHash: "hash-1" })
    ).toThrow("keys=total,food");
  });

  it("salvages correct-key model JSON with weak optional fields", () => {
    const estimate = validateRecipeNutritionJson(
      {
        servings: null,
        calories_total_kcal: 880,
        calories_per_serving_kcal: null,
        ingredient_estimates: [{ name: "豆腐", amount: "300g", calories_kcal: 270, note: "估算" }],
        confidence: "medium",
        needs_review: true,
        summary: ""
      },
      { model: "openai/gpt-5.2", sourceHash: "hash-1" }
    );

    expect(estimate).toMatchObject({
      servings: 4,
      caloriesTotalKcal: 880,
      caloriesPerServingKcal: 220,
      confidence: 0.5,
      needsReview: true,
      summary: "按模型返回的总热量估算，约 4 份，每份约 220 kcal。"
    });
  });
});
