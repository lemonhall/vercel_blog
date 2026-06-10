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
  });
});
