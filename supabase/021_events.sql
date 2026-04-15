-- 021_events.sql  —  Schedule / Events
-- Agenda de site visits, job starts, meetings, follow-ups, etc.

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  type text not null default 'other',
  -- 'site_visit' | 'job_start' | 'job_ongoing' | 'meeting' | 'follow_up' | 'other'
  date date not null,
  time_start time,
  time_end time,
  client_id uuid references public.clients(id) on delete set null,
  address text,
  assigned_to uuid references public.profiles(id) on delete set null,
  notes text,
  google_calendar_link text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

create index if not exists events_date_idx on public.events(date);
create index if not exists events_assigned_to_idx on public.events(assigned_to);
create index if not exists events_client_id_idx on public.events(client_id);

alter table public.events enable row level security;

drop policy if exists "Authenticated users can do all" on public.events;
create policy "Authenticated users can do all" on public.events
  for all using (auth.role() = 'authenticated');
