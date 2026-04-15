-- 024_events_guests.sql  —  Lista de guests (emails) por evento.
-- Usado para preencher `attendees` no Google Calendar na hora de sincronizar.

alter table public.events
  add column if not exists guests text[] default '{}';
