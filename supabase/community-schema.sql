-- Сообщество тренировок: публикация, поиск, лайки/дизлайки.
-- Выполнить один раз в SQL Editor проекта Supabase.

create table if not exists public.shared_workouts (
  id uuid primary key default gen_random_uuid(),
  author_key text not null,
  author_name text not null default 'Атлет',
  title text not null check (char_length(title) between 1 and 80),
  description text not null default '' check (char_length(description) <= 1000),
  items jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.shared_workouts
  add column if not exists description text not null default '';

create table if not exists public.workout_votes (
  workout_id uuid not null references public.shared_workouts(id) on delete cascade,
  voter_key text not null,
  value smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (workout_id, voter_key)
);

drop view if exists public.shared_workouts_rated;

create view public.shared_workouts_rated with (security_invoker = true) as
select
  w.id, w.author_key, w.author_name, w.title, w.description, w.items, w.created_at,
  coalesce(sum(v.value), 0)::int as score,
  count(v.*) filter (where v.value = 1)::int as likes,
  count(v.*) filter (where v.value = -1)::int as dislikes
from public.shared_workouts w
left join public.workout_votes v on v.workout_id = w.id
group by w.id;

alter table public.shared_workouts enable row level security;
alter table public.workout_votes enable row level security;

drop policy if exists "shared_workouts read" on public.shared_workouts;
create policy "shared_workouts read" on public.shared_workouts for select using (true);
drop policy if exists "shared_workouts insert" on public.shared_workouts;
create policy "shared_workouts insert" on public.shared_workouts for insert with check (true);

drop policy if exists "workout_votes read" on public.workout_votes;
create policy "workout_votes read" on public.workout_votes for select using (true);
drop policy if exists "workout_votes insert" on public.workout_votes;
create policy "workout_votes insert" on public.workout_votes for insert with check (true);
drop policy if exists "workout_votes update" on public.workout_votes;
create policy "workout_votes update" on public.workout_votes for update using (true) with check (true);
drop policy if exists "workout_votes delete" on public.workout_votes;
create policy "workout_votes delete" on public.workout_votes for delete using (true);

-- Видео и фото упражнений для публичных тренировок (до 50 МБ на файл).
insert into storage.buckets (id, name, public, file_size_limit)
values ('workout-media', 'workout-media', true, 52428800)
on conflict (id) do update set public = true, file_size_limit = 52428800;

drop policy if exists "workout media read" on storage.objects;
create policy "workout media read" on storage.objects for select using (bucket_id = 'workout-media');
drop policy if exists "workout media upload" on storage.objects;
create policy "workout media upload" on storage.objects for insert with check (bucket_id = 'workout-media');

alter table public.shared_workouts
  add column if not exists reward_xp_max smallint not null default 50
  check (reward_xp_max between 1 and 50);

create table if not exists public.workout_reviews (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.shared_workouts(id) on delete cascade,
  reviewer_key text not null,
  reviewer_name text not null default 'Атлет',
  stars smallint not null check (stars between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workout_id, reviewer_key)
);

alter table public.workout_reviews enable row level security;
drop policy if exists "workout_reviews read" on public.workout_reviews;
create policy "workout_reviews read" on public.workout_reviews for select using (true);
drop policy if exists "workout_reviews insert" on public.workout_reviews;
create policy "workout_reviews insert" on public.workout_reviews for insert with check (true);
drop policy if exists "workout_reviews update" on public.workout_reviews;
create policy "workout_reviews update" on public.workout_reviews for update using (true) with check (true);
drop policy if exists "workout_reviews delete" on public.workout_reviews;
create policy "workout_reviews delete" on public.workout_reviews for delete using (true);

create or replace view public.shared_workouts_rated with (security_invoker = true) as
select
  w.id, w.author_key, w.author_name, w.title, w.description, w.items, w.created_at,
  coalesce(v.score, 0)::int as score,
  coalesce(v.likes, 0)::int as likes,
  coalesce(v.dislikes, 0)::int as dislikes,
  coalesce(r.avg_rating, 0)::numeric(3,2) as avg_rating,
  coalesce(r.review_count, 0)::int as review_count,
  w.reward_xp_max
from public.shared_workouts w
left join (
  select workout_id, sum(value)::int as score,
    count(*) filter (where value = 1)::int as likes,
    count(*) filter (where value = -1)::int as dislikes
  from public.workout_votes group by workout_id
) v on v.workout_id = w.id
left join (
  select workout_id, avg(stars)::numeric(3,2) as avg_rating,
    count(*)::int as review_count
  from public.workout_reviews group by workout_id
) r on r.workout_id = w.id;

create or replace view public.shared_workout_author_ratings with (security_invoker = true) as
select w.author_key, max(w.author_name) as author_name,
  count(distinct w.id)::int as workout_count,
  coalesce(sum(v.score), 0)::int as score,
  coalesce(sum(v.likes), 0)::int as likes,
  coalesce(sum(v.dislikes), 0)::int as dislikes,
  coalesce(sum(r.avg_rating * r.review_total) / nullif(sum(r.review_total), 0), 0)::numeric(3,2) as avg_rating,
  coalesce(sum(r.review_total), 0)::int as review_count
from public.shared_workouts w
left join (
  select workout_id, sum(value)::int as score,
    count(*) filter (where value = 1)::int as likes,
    count(*) filter (where value = -1)::int as dislikes
  from public.workout_votes group by workout_id
) v on v.workout_id = w.id
left join (
  select workout_id, avg(stars)::numeric(3,2) as avg_rating,
    count(*)::int as review_total
  from public.workout_reviews group by workout_id
) r on r.workout_id = w.id
group by w.author_key;

create table if not exists public.sport_clans (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  tag text unique,
  emblem text not null default '',
  owner_key text not null,
  description text not null default '',
  avatar_url text,
  min_xp integer not null default 0,
  created_at timestamptz not null default now()
);

-- Existing installations may use bigint or uuid for sport_clans.id.
do $$
declare
  clan_id_type text;
begin
  select format_type(a.atttypid, a.atttypmod) into clan_id_type
  from pg_attribute a
  where a.attrelid = 'public.sport_clans'::regclass
    and a.attname = 'id'
    and not a.attisdropped;

  if clan_id_type is null then
    raise exception 'Не удалось определить тип public.sport_clans.id';
  end if;

  execute format($ddl$
    create table if not exists public.sport_clan_members (
      clan_id %s not null references public.sport_clans(id) on delete cascade,
      player_key text not null,
      role text not null default 'member',
      created_at timestamptz not null default now(),
      primary key (clan_id, player_key)
    )
  $ddl$, clan_id_type);

  execute format($ddl$
    create table if not exists public.sport_clan_messages (
      id bigint generated always as identity primary key,
      clan_id %s not null references public.sport_clans(id) on delete cascade,
      player_key text not null,
      author_name text not null default 'Атлет',
      message text not null check (char_length(message) between 1 and 1000),
      created_at timestamptz not null default now()
    )
  $ddl$, clan_id_type);
end;
$$;

alter table public.sport_clans
  add column if not exists description text not null default '',
  add column if not exists avatar_url text,
  add column if not exists min_xp integer not null default 0
    check (min_xp between 0 and 1000000);

-- Клановые таблицы используются приложением напрямую через public-ключ.
-- RLS отключён, чтобы старые политики не мешали повторному запуску миграции.
alter table public.sport_clans disable row level security;
alter table public.sport_clan_members disable row level security;

create index if not exists sport_clan_messages_recent
  on public.sport_clan_messages (clan_id, created_at desc);
alter table public.sport_clan_messages disable row level security;

create or replace function public.require_sport_clan_message_member()
returns trigger language plpgsql as $$
begin
  if not exists (
    select 1 from public.sport_clan_members
    where clan_id = new.clan_id and player_key = new.player_key
  ) then
    raise exception 'В чат могут писать только участники клана';
  end if;
  return new;
end;
$$;

drop trigger if exists sport_clan_message_member on public.sport_clan_messages;
create trigger sport_clan_message_member
before insert on public.sport_clan_messages
for each row execute function public.require_sport_clan_message_member();

insert into storage.buckets (id, name, public, file_size_limit)
values ('clan-avatars', 'clan-avatars', true, 5242880)
on conflict (id) do update set public = true, file_size_limit = 5242880;
drop policy if exists "clan avatar read" on storage.objects;
drop policy if exists clan_avatar_read on storage.objects;
create policy clan_avatar_read
on storage.objects for select
using (bucket_id = 'clan-avatars');

drop policy if exists "clan avatar upload" on storage.objects;
drop policy if exists clan_avatar_upload on storage.objects;
create policy clan_avatar_upload
on storage.objects for insert
with check (bucket_id = 'clan-avatars');

drop policy if exists "clan avatar update" on storage.objects;
drop policy if exists clan_avatar_update on storage.objects;
create policy clan_avatar_update
on storage.objects for update
using (bucket_id = 'clan-avatars')
with check (bucket_id = 'clan-avatars');

create or replace function public.enforce_sport_clan_join_rules()
returns trigger language plpgsql as $$
declare
  required_xp integer;
  player_xp integer := 0;
  member_count integer;
begin
  perform pg_advisory_xact_lock(hashtext(new.clan_id::text));
  select min_xp into required_xp from public.sport_clans where id = new.clan_id;
  if required_xp is null then raise exception 'Клан не найден'; end if;

  if new.player_key like 'tg:%' then
    select coalesce(max(xp), 0) into player_xp from public.user_links
    where telegram_id::text = substring(new.player_key from 4);
  elsif new.player_key like 'email:%' then
    select coalesce(max(xp), 0) into player_xp from public.user_links
    where lower(email) = lower(substring(new.player_key from 7));
  end if;
  if player_xp < required_xp then
    raise exception 'Для вступления нужно не меньше % XP', required_xp;
  end if;

  select count(*) into member_count from public.sport_clan_members where clan_id = new.clan_id;
  if member_count >= 30 then raise exception 'В клане уже 30 участников'; end if;
  return new;
end;
$$;

drop trigger if exists sport_clan_join_rules on public.sport_clan_members;
create trigger sport_clan_join_rules
before insert on public.sport_clan_members
for each row execute function public.enforce_sport_clan_join_rules();
