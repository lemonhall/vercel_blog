# Recipe Traffic Containment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bound crawler URL discovery, Supabase calls, query payloads, and cache lifetime for recipe reading while preserving private login and multi-tag AND filtering.

**Architecture:** A pure access-decision layer returns 403 for known crawlers and redirects ordinary unauthenticated browsers. Recipe filters normalize into a stable URL representation and submit multi-tag choices through a GET form. A single SQL RPC returns a paged list projection with aggregated tags and compact nutrition; Next data-cache wrappers reuse public reads and admin routes invalidate cache only after successful writes.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Supabase Postgres/PostgREST RPC, Vitest, Playwright with system Chrome.

---

## File Map

- `src/lib/site-access.ts`: pure access and crawler decision protocol.
- `middleware.ts`: translate decisions into Next responses.
- `app/robots.ts`: private-site crawler policy.
- `src/lib/recipe-filters.ts`: canonical query parsing and URL generation without UI dependencies.
- `app/recipes/page.tsx`: form UI, metadata and recipe rendering.
- `supabase/schema.sql`: bounded recipe page RPC.
- `src/lib/posts.ts`: RPC row mapping, explicit list projections and cached read entry points.
- `src/lib/cache-invalidation.ts`: framework adapter for post/recipe cache invalidation.
- `app/api/admin/posts/route.ts`: invalidate after successful save.
- `app/api/admin/posts/delete/route.ts`: invalidate after successful logical delete.

### Task 1: Crawler Access Boundary

**Files:**
- Create: `app/robots.ts`
- Modify: `src/lib/site-access.ts`
- Modify: `middleware.ts`
- Test: `tests/admin/auth.test.ts`
- Test: `tests/e2e/public.spec.ts`

- [ ] **Step 1: Write failing access tests**

Add a `userAgent` to every `getSiteAccessDecision` input and assert the new behavior:

```ts
it("returns forbidden for known crawlers without redirecting to admin", async () => {
  const decision = await getSiteAccessDecision({
    method: "GET",
    url: "https://lemonhall.me/recipes?tags=beef,stew",
    userAgent: "Mozilla/5.0 compatible; OAI-SearchBot/1.0",
    sessionToken: undefined,
    env: { authCookieSecret: "cookie-secret", adminPassword: "admin-password" }
  });
  expect(decision).toEqual({ action: "forbidden" });
});
```

Add Playwright request assertions for `403` and `/robots.txt`.

- [ ] **Step 2: Run red test**

Run: `npm test -- tests/admin/auth.test.ts`

Expected: TypeScript/Vitest failure because `userAgent` and `forbidden` are not part of the decision protocol.

- [ ] **Step 3: Implement the pure decision**

Use an explicit bounded set of crawler tokens; matching changes only the unauthenticated response:

```ts
const CRAWLER_USER_AGENT = /(?:GPTBot|ChatGPT-User|OAI-SearchBot|ClaudeBot|Google-Extended|Bytespider)/i;

export type SiteAccessDecision =
  | { action: "allow" }
  | { action: "redirect"; location: string }
  | { action: "unauthorized" }
  | { action: "forbidden" };
```

Read `request.headers.get("user-agent")` in middleware and return `NextResponse.json({ error: "Forbidden" }, { status: 403 })` for `forbidden`.

- [ ] **Step 4: Add robots metadata route**

```ts
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
```

- [ ] **Step 5: Run green tests and commit**

Run: `npm test -- tests/admin/auth.test.ts`

Expected: all tests in the file pass.

Commit: `v8: feat: block crawlers before login redirect`

### Task 2: Canonical Recipe Filter URLs

**Files:**
- Create: `src/lib/recipe-filters.ts`
- Modify: `app/recipes/page.tsx`
- Test: `tests/public/posts.test.ts`
- Test: `tests/e2e/public.spec.ts`

- [ ] **Step 1: Write failing normalization tests**

```ts
expect(normalizeRecipeTags(["stew", "beef", "stew", ""])).toEqual(["beef", "stew"]);
expect(recipeHref({ query: "", tags: ["stew", "beef"] })).toBe("/recipes?tags=beef%2Cstew");
```

Add E2E expectations that `.tag-cloud` contains checkboxes and no anchor whose `href` contains two tag slugs.

- [ ] **Step 2: Run red tests**

Run: `npm test -- tests/public/posts.test.ts`

Expected: import failure for `@/lib/recipe-filters`.

- [ ] **Step 3: Implement the filter protocol**

```ts
export type RecipeSearchParams = {
  page?: string;
  q?: string;
  tags?: string | string[];
};

export function normalizeRecipeTags(value: string | string[] | undefined): string[] {
  const parts = Array.isArray(value) ? value : [value ?? ""];
  return [...new Set(parts.flatMap((item) => item.split(",")).map(decodeTag).map((tag) => tag.trim()).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right));
}
```

`recipeHref` must use only normalized tags and omit default page/query values.

- [ ] **Step 4: Replace recursive links with a GET form**

Render checkbox inputs named `tags`, preserve `q` as hidden input, and add one submit command. Recipe-card tag anchors use `recipeHref({ tags: [tag.slug] })` only.

Add `generateMetadata`:

```ts
const noindex = tags.length > 1 || Boolean(q.trim()) || page > 1;
return {
  alternates: { canonical: recipeHref({ tags: tags.slice(0, 1) }) },
  robots: noindex ? { index: false, follow: true } : undefined
};
```

- [ ] **Step 5: Run tests and commit**

Run: `npm test -- tests/public/posts.test.ts`

Run: `npm run e2e -- --grep "recipe tag"`

Expected: unit and focused E2E tests pass on Desktop Chrome and mobile.

Commit: `v8: feat: bound recipe filter URLs`

### Task 3: Single Bounded Recipe Page RPC

**Files:**
- Modify: `supabase/schema.sql`
- Modify: `src/lib/posts.ts`
- Modify: `app/recipes/page.tsx`
- Modify: `app/page.tsx`
- Test: `tests/foundation/schema.test.ts`
- Test: `tests/public/posts.test.ts`

- [ ] **Step 1: Write failing schema assertions**

Extract the new function block and assert required/forbidden protocol tokens:

```ts
expect(recipePageFunction).toContain("create or replace function public.list_recipe_posts_page");
expect(recipePageFunction).toContain("count(*) over()");
expect(recipePageFunction).toContain("greatest(1, least(page_limit, 50))");
expect(recipePageFunction).not.toContain("content_html");
expect(recipePageFunction).not.toContain("ingredient_estimates_json");
expect(recipePageFunction).not.toContain("raw_estimate_json");
```

- [ ] **Step 2: Write failing one-call mapping test**

Provide a fake client whose only accepted operation is:

```ts
rpc("list_recipe_posts_page", {
  query_text: "beef",
  tag_slugs: ["beef", "stew"],
  page_offset: 10,
  page_limit: 10,
  sort_ascending: false
})
```

Return one row with `tags: [{ id, name, slug }]`, compact kcal fields and `total_count: 21`; assert pageCount 3 and exactly one RPC call.

- [ ] **Step 3: Run red tests**

Run: `npm test -- tests/foundation/schema.test.ts tests/public/posts.test.ts`

Expected: missing SQL function and unexpected legacy RPC calls.

- [ ] **Step 4: Implement SQL function**

Define a table return type containing list-only post columns, `tags jsonb`, compact nutrition scalars and `total_count bigint`. Use CTEs for normalized tags, eligible posts, paged posts and JSON aggregation. Apply `offset greatest(page_offset, 0)` and a limit constrained to 1..50.

- [ ] **Step 5: Implement TypeScript row mapping**

Replace the database branches of `listRecipePostsPage`, tag variants and recipe search variants with one `queryRecipePostsPage` call. Keep fixture filtering in memory, but attach fixture tags/nutrition without database calls.

Change homepage list selection from `"*"` to:

```ts
const POST_LIST_COLUMNS = "id,legacy_id,title,slug,excerpt,status,content_kind,created_at,updated_at,published_at";
```

- [ ] **Step 6: Run green tests, typecheck and commit**

Run: `npm test -- tests/foundation/schema.test.ts tests/public/posts.test.ts`

Run: `npx tsc --noEmit`

Expected: both commands exit 0; one-call assertion observes exactly one recipe page RPC.

Commit: `v8: feat: add bounded recipe page query`

### Task 4: Cached Reads and Explicit Invalidation

**Files:**
- Create: `src/lib/cache-invalidation.ts`
- Modify: `src/lib/posts.ts`
- Modify: `app/page.tsx`
- Modify: `app/recipes/page.tsx`
- Modify: `app/posts/[slug]/page.tsx`
- Modify: `app/api/admin/posts/route.ts`
- Modify: `app/api/admin/posts/delete/route.ts`
- Test: `tests/admin/auth.test.ts`
- Test: `tests/public/posts.test.ts`

- [ ] **Step 1: Write failing invalidation tests**

Test a pure adapter contract:

```ts
const calls: string[] = [];
invalidatePostCaches("beef", {
  tag: (value) => calls.push(`tag:${value}`),
  path: (value) => calls.push(`path:${value}`)
});
expect(calls).toEqual([
  "tag:posts", "tag:recipes", "path:/", "path:/recipes", "path:/posts/beef"
]);
```

Route tests must assert invalidation occurs after a successful save/delete and not when persistence throws.

- [ ] **Step 2: Run red tests**

Run: `npm test -- tests/admin/auth.test.ts tests/public/posts.test.ts`

Expected: missing cache module/wrapper exports.

- [ ] **Step 3: Implement invalidation adapter**

Bind the production adapter to `revalidateTag`/`revalidatePath`, while keeping the decision function injectable for tests.

- [ ] **Step 4: Add read caches**

Create cached no-client entry points with `unstable_cache`, stable serialized arguments and tags `posts`/`recipes`. Do not cache functions when a test client is injected. Page components call cached entry points; admin edit continues to call uncached functions.

- [ ] **Step 5: Invalidate only after successful writes**

Call `invalidatePostCaches(slug)` after save plus optional nutrition persistence succeeds, and after logical delete succeeds. Return existing errors without invalidating.

- [ ] **Step 6: Run green tests and commit**

Run: `npm test -- tests/admin/auth.test.ts tests/public/posts.test.ts`

Run: `npx tsc --noEmit`

Expected: commands exit 0, including success/failure invalidation assertions.

Commit: `v8: feat: cache public reads and invalidate writes`

### Task 5: Full Regression, Review and Release

**Files:**
- Modify: `docs/plan/v8-index.md`
- Modify: `docs/ecn/ECN-0010-recipe-traffic-containment.md`
- Modify: `docs/plan/tashan-loop-log.md` if present or create it.

- [ ] **Step 1: Run complete verification**

Run in order:

```powershell
npm test
npx tsc --noEmit
npm run build
npm run e2e
```

Expected: all commands exit 0; Playwright uses system Chrome for desktop and mobile projects.

- [ ] **Step 2: Run independent strict review**

Give a fresh-context reviewer the PRD, ECN, design, v8 plans, `git diff`, and command evidence. Require severity/signature/evidence/disposition. Fix all BLOCKER and MAJOR findings, then rerun impacted tests.

- [ ] **Step 3: Apply schema before application release**

After Supabase service restoration:

```powershell
supabase link --project-ref zlscvciucppvsrorwzjt
supabase db query --linked --file supabase/schema.sql
```

Expected: exit 0 and no SQL error. If quota restriction persists, record a BLOCKER and do not emit completion signal.

- [ ] **Step 4: Push and run live smoke**

Push the final application commit only after schema success. Verify:

```powershell
curl.exe -sS -o NUL -w "%{http_code}" -A "OAI-SearchBot/1.0" https://blog.lemonhall.me/recipes
curl.exe -sS -o NUL -w "%{http_code} %{redirect_url}" -A "Mozilla/5.0" https://blog.lemonhall.me/recipes
curl.exe -sS https://blog.lemonhall.me/robots.txt
```

Expected: `403`; `303` to `/admin?next=%2Frecipes`; robots contains `Disallow: /`.

- [ ] **Step 5: Close traceability and commit**

Update milestone states, exact test counts, review log, trigger audit, residual risks, schema/deployment evidence and ECN checklist.

Commit: `v8: doc: close traffic containment evidence`

Push: `git push`
