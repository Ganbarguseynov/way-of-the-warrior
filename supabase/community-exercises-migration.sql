-- Выполнить один раз после обновления приложения.
-- Добавляет публичные упражнения и акцент группы мышц у тренировок.

alter table public.shared_workouts
  add column if not exists focus_group text not null default '';

create table if not exists public.shared_exercises (
  id uuid primary key default gen_random_uuid(),
  author_key text not null,
  author_name text not null default 'Атлет',
  name text not null check (char_length(name) between 1 and 80),
  description text not null default '',
  group_name text not null default 'Всё тело',
  icon text not null default '⭐',
  met numeric(4,1) not null default 5,
  created_at timestamptz not null default now()
);

alter table public.shared_exercises enable row level security;

drop policy if exists "shared_exercises read" on public.shared_exercises;
create policy "shared_exercises read"
on public.shared_exercises
for select using (true);

drop policy if exists "shared_exercises insert" on public.shared_exercises;
create policy "shared_exercises insert"
on public.shared_exercises
for insert with check (true);

drop view if exists public.shared_workouts_rated cascade;

create view public.shared_workouts_rated as
select
  w.id,
  w.author_key,
  w.author_name,
  w.title,
  w.description,
  w.focus_group,
  w.items,
  w.created_at,
  coalesce(v.score, 0)::int as score,
  coalesce(v.likes, 0)::int as likes,
  coalesce(v.dislikes, 0)::int as dislikes,
  coalesce(r.avg_rating, 0)::numeric(3,2) as avg_rating,
  coalesce(r.review_count, 0)::int as review_count,
  w.reward_xp_max
from public.shared_workouts w
left join (
  select
    workout_id,
    sum(value)::int as score,
    count(*) filter (where value = 1)::int as likes,
    count(*) filter (where value = -1)::int as dislikes
  from public.workout_votes
  group by workout_id
) v on v.workout_id = w.id
left join (
  select
    workout_id,
    avg(stars)::numeric(3,2) as avg_rating,
    count(*)::int as review_count
  from public.workout_reviews
  group by workout_id
) r on r.workout_id = w.id;
