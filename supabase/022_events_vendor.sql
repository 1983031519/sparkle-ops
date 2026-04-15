-- 022_events_vendor.sql  —  Schedule: vendor reference + Google event id
-- Permite anexar um Vendor (tabela suppliers) ao evento, em adição ou alternativa ao Client.
-- Também adiciona google_event_id como preparação para o sync com Google Calendar (parte b).

alter table public.events
  add column if not exists vendor_id uuid references public.suppliers(id) on delete set null;

alter table public.events
  add column if not exists google_event_id text;

create index if not exists events_vendor_id_idx on public.events(vendor_id);
