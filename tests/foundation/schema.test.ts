import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("Supabase schema", () => {
  const schema = readFileSync("supabase/schema.sql", "utf8");

  it("defines the required blog tables", () => {
    expect(schema).toContain("create table if not exists public.posts");
    expect(schema).toContain("create table if not exists public.assets");
    expect(schema).toContain("create table if not exists public.post_assets");
    expect(schema).toContain("create table if not exists public.tags");
    expect(schema).toContain("create table if not exists public.post_tags");
  });

  it("keeps legacy identifiers and asset lineage", () => {
    expect(schema).toContain("legacy_id integer unique");
    expect(schema).toContain("legacy_path text");
    expect(schema).toContain("source_url text");
    expect(schema).toContain("blob_url text not null");
    expect(schema).toContain("sha256 text");
  });

  it("defines database-backed search without an external search service", () => {
    expect(schema).toContain("create or replace function public.search_posts");
    expect(schema).toContain("ilike '%' || q || '%'");
  });

  it("defines recipe kind and tag RPCs", () => {
    expect(schema).toContain("content_kind text not null default 'post'");
    expect(schema).toContain("create or replace function public.save_post_tags");
    expect(schema).toContain("create or replace function public.list_recipe_tags");
    expect(schema).toContain("create or replace function public.list_recipe_posts_by_tag");
    expect(schema).toContain("create or replace function public.list_recipe_posts_by_tags");
    expect(schema).toContain("create or replace function public.search_recipe_posts_by_tags");
    expect(schema).toContain("select distinct trim(value) as slug");
    expect(schema).toContain("having count(distinct tags.slug) = (select count(*) from selected_tags)");
  });

  it("defines recipe nutrition estimate persistence", () => {
    expect(schema).toContain("create table if not exists public.recipe_nutrition_estimates");
    expect(schema).toContain("post_id uuid not null references public.posts(id) on delete cascade");
    expect(schema).toContain("calories_total_kcal integer not null");
    expect(schema).toContain("calories_per_serving_kcal integer");
    expect(schema).toContain("ingredient_estimates_json jsonb not null default '[]'::jsonb");
    expect(schema).toContain("unique(post_id)");
    expect(schema).toContain("create or replace function public.save_recipe_nutrition_estimate");
    expect(schema).toContain("create or replace function public.list_recipe_nutrition_estimate");
  });

  it("versions public content transactionally for race-safe cache keys", () => {
    expect(schema).toContain("create table if not exists public.public_content_versions");
    expect(schema).toContain("create or replace function public.get_public_content_version()");
    expect(schema).toContain("create or replace function public.bump_public_content_version()");
    expect(schema).toContain("create trigger posts_bump_public_content_version");
    expect(schema).toContain("create trigger tags_bump_public_content_version");
    expect(schema).toContain("create trigger post_tags_bump_public_content_version");
    expect(schema).toContain("create trigger recipe_nutrition_bump_public_content_version");
  });

  it("defines one bounded recipe page RPC with a list-only return projection", () => {
    const start = schema.indexOf("create or replace function public.list_recipe_posts_page");
    const end = schema.indexOf("create or replace function", start + 1);
    const recipePageFunction = schema.slice(start, end < 0 ? undefined : end);
    const returnProjection = recipePageFunction.slice(
      recipePageFunction.indexOf("returns table"),
      recipePageFunction.indexOf("language sql")
    );

    expect(start).toBeGreaterThanOrEqual(0);
    expect(recipePageFunction).toContain("matching_count as");
    expect(recipePageFunction).toContain("bounded_paging as");
    expect(recipePageFunction).toContain("((matching_count.total_count - 1) / normalized_paging.page_limit)");
    expect(recipePageFunction).not.toContain("count(*) over()");
    expect(recipePageFunction).toContain("greatest(1, least(coalesce(page_limit, 10), 50))");
    expect(recipePageFunction).toContain("not exists");
    expect(returnProjection).not.toContain("content_html");
    expect(returnProjection).not.toContain("ingredient_estimates_json");
    expect(returnProjection).not.toContain("raw_estimate_json");
  });
});
