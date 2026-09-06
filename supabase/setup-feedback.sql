-- Run once in the Supabase SQL editor (Dashboard → SQL → New query).
--
-- Creates the table that collects feedback, bug reports and crash telemetry
-- from the arcade, and lets anonymous users write to it. New rows are then
-- forwarded to Slack by the `notify-slack` edge function (see below).

create table if not exists public.feedback (
  id bigint generated always as identity primary key,
  type text not null check (type in ('feedback', 'issue', 'crash')),
  name text,
  message text not null,
  game text,
  url text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

create policy "anon can insert feedback"
  on public.feedback
  for insert to anon, authenticated
  with check (true);

-- Optional but useful: let you (the owner) query recent rows easily.
create index if not exists feedback_created_idx on public.feedback (created_at desc);