-- 023_google_tokens.sql  —  Tokens OAuth do Google Calendar por usuário.
-- access_token/refresh_token ficam protegidos por RLS (profile_id = auth.uid()).
-- O edge function usa service_role_key e bypassa RLS quando precisa refrescar tokens.

create table if not exists public.google_tokens (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade unique,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  calendar_id text default 'primary',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.google_tokens enable row level security;

drop policy if exists "Own token only" on public.google_tokens;
create policy "Own token only" on public.google_tokens
  for all using (profile_id = auth.uid());
