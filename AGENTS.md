# Agent Instructions

## Project Scope

This repository is a Vercel-friendly rewrite of Lemon Uncle's personal blog.

Current v1 scope:

- Build the Next.js/Supabase/Vercel Blob application shell.
- Keep Supabase empty tables/schema ready.
- Provide public reading pages, basic `ILIKE` search, single-admin editing, and image upload.

Migration scope:

- All production migration work belongs to v2.
- Do not run migration against `refs/lemon_blog/app.db` as acceptance evidence.
- Do not treat `refs/` as authoritative production data.
- Wait for Linode data to be pulled locally before starting v2 migration.

## Required Documents

- PRD: `docs/prd/PRD-0001-vercel-blog-migration.md`
- v1 plan: `docs/plan/v1-index.md`
- v2 migration plan: `docs/plan/v2-index.md`
- ECNs: `docs/ecn/`

If implementation changes scope, update ECN and plan docs before continuing.

## Commands

Use PowerShell syntax.

```powershell
npm install
npm test
npm run build
npm run e2e
```

For E2E, Playwright config sets fixture env automatically.

## Playwright Browser

- Use the user's installed Chrome for Playwright E2E.
- Configure Playwright projects with `channel: "chrome"`.
- Do not ask to download Playwright browsers unless the user explicitly requests it.
- If Playwright says its bundled browser is missing, first switch to system Chrome.

## Files And Safety

- `refs/` must stay ignored by git.
- Never commit `.env`, Supabase service keys, Blob tokens, or APNs secrets.
- Do not write user uploads to the project filesystem.
- Vercel Blob is the only intended runtime image storage for uploads.
- Supabase Postgres is the database.

## Development Discipline

- Follow the vN plan and Req ID traceability.
- Prefer tests before implementation.
- Run `npm test` and `npm run build` before claiming a code change is complete.
- Run `npm run e2e` for user-facing workflow changes when Playwright browsers are available.
- If E2E cannot run because browser binaries are missing, report that clearly.

## Frontend Style

Use `E:\development\homestay` as the visual reference:

- Warm beige background.
- Dark ink text.
- Muted grey-green accent.
- Serif display headings.
- Restrained surfaces, thin lines, and quiet shadows.

Keep the blog usable and readable. Do not turn it into a marketing landing page.
