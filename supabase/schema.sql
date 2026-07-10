create extension if not exists pgcrypto;

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  legacy_id integer unique,
  title text not null,
  slug text not null unique,
  content_html text not null default '',
  excerpt text,
  status text not null default 'draft' check (status in ('draft', 'published')),
  content_kind text not null default 'post' check (content_kind in ('post', 'recipe')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

alter table public.posts
  add column if not exists content_kind text not null default 'post';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'posts_content_kind_check'
  ) then
    alter table public.posts
      add constraint posts_content_kind_check check (content_kind in ('post', 'recipe'));
  end if;
end $$;

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

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  tag_type text not null default 'recipe' check (tag_type in ('recipe')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.post_tags (
  post_id uuid not null references public.posts(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, tag_id)
);

create table if not exists public.recipe_nutrition_estimates (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  servings integer not null check (servings > 0),
  calories_total_kcal integer not null check (calories_total_kcal > 0),
  calories_per_serving_kcal integer check (calories_per_serving_kcal > 0),
  confidence numeric not null default 0 check (confidence >= 0 and confidence <= 1),
  needs_review boolean not null default false,
  summary text not null default '',
  ingredient_estimates_json jsonb not null default '[]'::jsonb,
  model text not null,
  prompt_version text not null,
  source_hash text not null,
  raw_estimate_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(post_id)
);

create table if not exists public.public_content_versions (
  singleton boolean primary key default true check (singleton),
  version bigint not null default 1 check (version > 0)
);

insert into public.public_content_versions(singleton, version)
values (true, 1)
on conflict (singleton) do nothing;

create or replace function public.get_public_content_version()
returns bigint
language sql
stable
as $$
  select version
  from public.public_content_versions
  where singleton = true;
$$;

create or replace function public.bump_public_content_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.public_content_versions
  set version = version + 1
  where singleton = true;
  return null;
end;
$$;

drop trigger if exists posts_bump_public_content_version on public.posts;
create trigger posts_bump_public_content_version
after insert or update or delete on public.posts
for each statement execute function public.bump_public_content_version();

drop trigger if exists tags_bump_public_content_version on public.tags;
create trigger tags_bump_public_content_version
after insert or update or delete on public.tags
for each statement execute function public.bump_public_content_version();

drop trigger if exists post_tags_bump_public_content_version on public.post_tags;
create trigger post_tags_bump_public_content_version
after insert or update or delete on public.post_tags
for each statement execute function public.bump_public_content_version();

drop trigger if exists recipe_nutrition_bump_public_content_version on public.recipe_nutrition_estimates;
create trigger recipe_nutrition_bump_public_content_version
after insert or update or delete on public.recipe_nutrition_estimates
for each statement execute function public.bump_public_content_version();

create index if not exists posts_status_published_at_idx
  on public.posts(status, published_at desc);

create index if not exists posts_recipe_published_at_idx
  on public.posts(content_kind, status, published_at desc);

create index if not exists posts_legacy_id_idx
  on public.posts(legacy_id);

create index if not exists assets_legacy_path_idx
  on public.assets(legacy_path);

create index if not exists post_tags_tag_id_idx
  on public.post_tags(tag_id);

create index if not exists recipe_nutrition_estimates_post_id_idx
  on public.recipe_nutrition_estimates(post_id);

create or replace function public.tag_slug_from_name(tag_name text)
returns text
language sql
immutable
as $$
  select case trim(tag_name)
    when '牛肉' then 'beef'
    when '牛腩' then 'beef-brisket'
    when '海鲜' then 'seafood'
    when '鱼' then 'fish'
    when '虾' then 'shrimp'
    when '鸡肉' then 'chicken'
    when '猪肉' then 'pork'
    when '羊肉' then 'lamb'
    when '意大利菜' then 'italian'
    when '法国菜' then 'french'
    when '中餐' then 'chinese'
    when '日料' then 'japanese'
    when '韩餐' then 'korean'
    when '炖菜' then 'stew'
    when '烘焙' then 'baking'
    when '甜点' then 'dessert'
    when '早餐' then 'breakfast'
    when '家常菜' then 'home-cooking'
    when '素菜' then 'vegetarian'
    else 'tag-' || substr(md5(trim(tag_name)), 1, 12)
  end;
$$;

create or replace function public.save_post_tags_for_post(target_post_id uuid, tag_names text[])
returns void
language plpgsql
as $$
begin
  delete from public.post_tags where post_id = target_post_id;

  with input_tags as (
    select distinct trim(value) as name
    from unnest(coalesce(tag_names, array[]::text[])) as value
    where length(trim(value)) > 0
  ),
  upserted as (
    insert into public.tags(name, slug, tag_type)
    select name, public.tag_slug_from_name(name), 'recipe'
    from input_tags
    on conflict (slug) do update set name = excluded.name
    returning id
  ),
  existing as (
    select tags.id
    from public.tags
    join input_tags on tags.slug = public.tag_slug_from_name(input_tags.name)
  ),
  all_tags as (
    select id from upserted
    union
    select id from existing
  )
  insert into public.post_tags(post_id, tag_id)
  select target_post_id, id from all_tags
  on conflict do nothing;
end;
$$;

create or replace function public.save_post_tags(post_slug text, tag_names text[])
returns void
language plpgsql
as $$
declare
  target_post_id uuid;
begin
  select id into target_post_id from public.posts where slug = post_slug;
  if target_post_id is null then
    raise exception 'post not found for slug %', post_slug;
  end if;
  perform public.save_post_tags_for_post(target_post_id, tag_names);
end;
$$;

create or replace function public.save_recipe_nutrition_estimate_for_post(
  target_post_id uuid,
  servings integer,
  calories_total_kcal integer,
  calories_per_serving_kcal integer,
  ingredient_estimates_json jsonb,
  confidence numeric,
  needs_review boolean,
  summary text,
  model text,
  prompt_version text,
  source_hash text,
  raw_estimate_json jsonb
)
returns void
language sql
as $$
  insert into public.recipe_nutrition_estimates(
    post_id,
    servings,
    calories_total_kcal,
    calories_per_serving_kcal,
    ingredient_estimates_json,
    confidence,
    needs_review,
    summary,
    model,
    prompt_version,
    source_hash,
    raw_estimate_json,
    updated_at
  )
  values (
    target_post_id,
    servings,
    calories_total_kcal,
    calories_per_serving_kcal,
    coalesce(ingredient_estimates_json, '[]'::jsonb),
    confidence,
    needs_review,
    summary,
    model,
    prompt_version,
    source_hash,
    coalesce(raw_estimate_json, '{}'::jsonb),
    now()
  )
  on conflict (post_id) do update set
    servings = excluded.servings,
    calories_total_kcal = excluded.calories_total_kcal,
    calories_per_serving_kcal = excluded.calories_per_serving_kcal,
    ingredient_estimates_json = excluded.ingredient_estimates_json,
    confidence = excluded.confidence,
    needs_review = excluded.needs_review,
    summary = excluded.summary,
    model = excluded.model,
    prompt_version = excluded.prompt_version,
    source_hash = excluded.source_hash,
    raw_estimate_json = excluded.raw_estimate_json,
    updated_at = now();
$$;

create or replace function public.save_recipe_nutrition_estimate(
  post_slug text,
  servings integer,
  calories_total_kcal integer,
  calories_per_serving_kcal integer,
  ingredient_estimates_json jsonb,
  confidence numeric,
  needs_review boolean,
  summary text,
  model text,
  prompt_version text,
  source_hash text,
  raw_estimate_json jsonb
)
returns void
language plpgsql
as $$
declare
  target_post_id uuid;
begin
  select id into target_post_id from public.posts where slug = post_slug;
  if target_post_id is null then
    raise exception 'post not found for slug %', post_slug;
  end if;
  perform public.save_recipe_nutrition_estimate_for_post(
    target_post_id,
    servings,
    calories_total_kcal,
    calories_per_serving_kcal,
    ingredient_estimates_json,
    confidence,
    needs_review,
    summary,
    model,
    prompt_version,
    source_hash,
    raw_estimate_json
  );
end;
$$;

create or replace function public.list_recipe_nutrition_estimate(target_post_id uuid)
returns table(
  servings integer,
  calories_total_kcal integer,
  calories_per_serving_kcal integer,
  confidence numeric,
  needs_review boolean,
  summary text,
  ingredient_estimates_json jsonb,
  model text,
  prompt_version text,
  source_hash text,
  raw_estimate_json jsonb,
  updated_at timestamptz
)
language sql
stable
as $$
  select
    servings,
    calories_total_kcal,
    calories_per_serving_kcal,
    confidence,
    needs_review,
    summary,
    ingredient_estimates_json,
    model,
    prompt_version,
    source_hash,
    raw_estimate_json,
    updated_at
  from public.recipe_nutrition_estimates
  where post_id = target_post_id
  limit 1;
$$;

create or replace function public.list_recipe_tags()
returns table(id uuid, name text, slug text, post_count bigint)
language sql
stable
as $$
  select tags.id, tags.name, tags.slug, count(*) as post_count
  from public.tags
  join public.post_tags on post_tags.tag_id = tags.id
  join public.posts on posts.id = post_tags.post_id
  where posts.status = 'published'
    and posts.content_kind = 'recipe'
  group by tags.id, tags.name, tags.slug, tags.sort_order
  order by post_count desc, tags.sort_order asc, tags.name asc;
$$;

create or replace function public.list_recipe_posts_page(
  query_text text default '',
  tag_slugs text[] default array[]::text[],
  page_offset integer default 0,
  page_limit integer default 10,
  sort_ascending boolean default false
)
returns table(
  id uuid,
  legacy_id integer,
  title text,
  slug text,
  excerpt text,
  status text,
  content_kind text,
  created_at timestamptz,
  updated_at timestamptz,
  published_at timestamptz,
  tags jsonb,
  servings integer,
  calories_total_kcal integer,
  calories_per_serving_kcal integer,
  total_count bigint
)
language sql
stable
as $$
  with selected_tags as (
    select distinct trim(value) as slug
    from unnest(coalesce(tag_slugs, array[]::text[])) as value
    where length(trim(value)) > 0
  ),
  normalized_paging as (
    select greatest(1, least(coalesce(page_limit, 10), 50))::bigint as page_limit
  ),
  matching_posts as (
    select posts.*
    from public.posts
    where posts.status = 'published'
      and posts.content_kind = 'recipe'
      and (
        length(trim(coalesce(query_text, ''))) = 0
        or posts.title ilike '%' || trim(query_text) || '%'
        or posts.content_html ilike '%' || trim(query_text) || '%'
      )
      and not exists (
        select 1
        from selected_tags
        where not exists (
          select 1
          from public.post_tags
          join public.tags on tags.id = post_tags.tag_id
          where post_tags.post_id = posts.id
            and tags.slug = selected_tags.slug
        )
      )
  ),
  matching_count as (
    select count(*)::bigint as total_count
    from matching_posts
  ),
  bounded_paging as (
    select
      normalized_paging.page_limit,
      matching_count.total_count,
      case
        when matching_count.total_count = 0 then 0::bigint
        else least(
          greatest(coalesce(page_offset, 0), 0)::bigint,
          ((matching_count.total_count - 1) / normalized_paging.page_limit) * normalized_paging.page_limit
        )
      end as page_offset
    from matching_count
    cross join normalized_paging
  ),
  paged_posts as (
    select matching_posts.*, bounded_paging.total_count
    from matching_posts
    cross join bounded_paging
    order by
      case when coalesce(sort_ascending, false) then coalesce(published_at, created_at) end asc,
      case when not coalesce(sort_ascending, false) then coalesce(published_at, created_at) end desc,
      id asc
    offset (select page_offset from bounded_paging)
    limit (select page_limit from bounded_paging)
  )
  select
    paged_posts.id,
    paged_posts.legacy_id,
    paged_posts.title,
    paged_posts.slug,
    paged_posts.excerpt,
    paged_posts.status,
    paged_posts.content_kind,
    paged_posts.created_at,
    paged_posts.updated_at,
    paged_posts.published_at,
    tag_data.tags,
    nutrition.servings,
    nutrition.calories_total_kcal,
    nutrition.calories_per_serving_kcal,
    paged_posts.total_count
  from paged_posts
  left join lateral (
    select coalesce(
      jsonb_agg(
        jsonb_build_object('id', tags.id, 'name', tags.name, 'slug', tags.slug)
        order by tags.sort_order asc, tags.name asc
      ),
      '[]'::jsonb
    ) as tags
    from public.post_tags
    join public.tags on tags.id = post_tags.tag_id
    where post_tags.post_id = paged_posts.id
  ) as tag_data on true
  left join public.recipe_nutrition_estimates as nutrition on nutrition.post_id = paged_posts.id
  order by
    case when coalesce(sort_ascending, false) then coalesce(paged_posts.published_at, paged_posts.created_at) end asc,
    case when not coalesce(sort_ascending, false) then coalesce(paged_posts.published_at, paged_posts.created_at) end desc,
    paged_posts.id asc;
$$;

create or replace function public.list_recipe_posts_by_tag(tag_slug text)
returns setof public.posts
language sql
stable
as $$
  select posts.*
  from public.posts
  join public.post_tags on post_tags.post_id = posts.id
  join public.tags on tags.id = post_tags.tag_id
  where posts.status = 'published'
    and posts.content_kind = 'recipe'
    and tags.slug = tag_slug
  order by posts.published_at desc nulls last, posts.created_at desc;
$$;

create or replace function public.list_recipe_posts_by_tags(tag_slugs text[])
returns setof public.posts
language sql
stable
as $$
  with selected_tags as (
    select distinct trim(value) as slug
    from unnest(coalesce(tag_slugs, array[]::text[])) as value
    where length(trim(value)) > 0
  )
  select posts.*
  from public.posts
  join public.post_tags on post_tags.post_id = posts.id
  join public.tags on tags.id = post_tags.tag_id
  where posts.status = 'published'
    and posts.content_kind = 'recipe'
    and tags.slug in (select slug from selected_tags)
  group by posts.id
  having count(distinct tags.slug) = (select count(*) from selected_tags)
  order by posts.published_at desc nulls last, posts.created_at desc;
$$;

create or replace function public.search_recipe_posts_by_tags(q text, tag_slugs text[])
returns setof public.posts
language sql
stable
as $$
  with selected_tags as (
    select distinct trim(value) as slug
    from unnest(coalesce(tag_slugs, array[]::text[])) as value
    where length(trim(value)) > 0
  )
  select posts.*
  from public.posts
  join public.post_tags on post_tags.post_id = posts.id
  join public.tags on tags.id = post_tags.tag_id
  where posts.status = 'published'
    and posts.content_kind = 'recipe'
    and length(trim(q)) > 0
    and (
      posts.title ilike '%' || q || '%'
      or posts.content_html ilike '%' || q || '%'
    )
    and tags.slug in (select slug from selected_tags)
  group by posts.id
  having count(distinct tags.slug) = (select count(*) from selected_tags)
  order by posts.published_at desc nulls last, posts.created_at desc;
$$;

create or replace function public.list_tags_for_post(target_post_id uuid)
returns table(id uuid, name text, slug text)
language sql
stable
as $$
  select tags.id, tags.name, tags.slug
  from public.tags
  join public.post_tags on post_tags.tag_id = tags.id
  where post_tags.post_id = target_post_id
  order by tags.sort_order asc, tags.name asc;
$$;

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
