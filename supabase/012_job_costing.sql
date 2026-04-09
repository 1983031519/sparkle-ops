-- Job Costing tables — internal cost tracking per job

create table if not exists public.job_material_costs (
  id uuid primary key default uuid_generate_v4(),
  job_id uuid references public.jobs(id) on delete cascade,
  description text not null,
  quantity numeric default 1,
  unit text default 'each',
  unit_cost numeric default 0,
  total numeric default 0,
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.job_labor_costs (
  id uuid primary key default uuid_generate_v4(),
  job_id uuid references public.jobs(id) on delete cascade,
  description text not null,
  total_amount numeric default 0,
  created_at timestamptz default now()
);

create table if not exists public.job_other_costs (
  id uuid primary key default uuid_generate_v4(),
  job_id uuid references public.jobs(id) on delete cascade,
  description text not null,
  amount numeric default 0,
  created_at timestamptz default now()
);

alter table public.job_material_costs enable row level security;
alter table public.job_labor_costs enable row level security;
alter table public.job_other_costs enable row level security;

create policy "Authenticated full access on job_material_costs" on public.job_material_costs for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated full access on job_labor_costs" on public.job_labor_costs for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated full access on job_other_costs" on public.job_other_costs for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create index if not exists idx_job_material_costs_job on public.job_material_costs(job_id);
create index if not exists idx_job_labor_costs_job on public.job_labor_costs(job_id);
create index if not exists idx_job_other_costs_job on public.job_other_costs(job_id);
