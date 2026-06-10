create extension if not exists pgcrypto;

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  legacy_id integer unique,
  title text not null,
  slug text not null unique,
  content_html text not null default '',
  excerpt text,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  legacy_path text,
  source_url text,
  blob_url text not null,
  blob_pathname text not null,
  sha256 text,
  size bigint,
  content_type text,
  status text not null default 'uploaded' check (status in ('planned', 'uploaded', 'missing', 'failed')),
  migrated_at timestamptz
);

create table if not exists public.post_assets (
  post_id uuid not null references public.posts(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  primary key (post_id, asset_id)
);

create index if not exists posts_status_published_at_idx
  on public.posts(status, published_at desc);

create index if not exists posts_legacy_id_idx
  on public.posts(legacy_id);

create index if not exists assets_legacy_path_idx
  on public.assets(legacy_path);

create or replace function public.search_posts(q text)
returns setof public.posts
language sql
stable
as $$
  select *
  from public.posts
  where status = 'published'
    and length(trim(q)) > 0
    and (
      title ilike '%' || q || '%'
      or content_html ilike '%' || q || '%'
    )
  order by published_at desc nulls last, created_at desc;
$$;
