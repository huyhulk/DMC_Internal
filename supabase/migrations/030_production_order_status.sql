create table if not exists public.production_order_status (
  pcode text primary key,
  status text not null,
  produced_quantity numeric not null default 0,
  quantity numeric not null default 0,
  completion_pct numeric not null default 0,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),

  constraint production_order_status_status_check
    check (status in ('Chưa SX', 'Đang SX', 'Đã SX')),
  constraint production_order_status_produced_quantity_check
    check (produced_quantity >= 0),
  constraint production_order_status_quantity_check
    check (quantity >= 0),
  constraint production_order_status_completion_pct_check
    check (completion_pct >= 0 and completion_pct <= 100)
);

alter table public.production_order_status enable row level security;

drop policy if exists "Authenticated users can read production order status" on public.production_order_status;
create policy "Authenticated users can read production order status"
  on public.production_order_status
  for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can insert production order status" on public.production_order_status;
create policy "Authenticated users can insert production order status"
  on public.production_order_status
  for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated users can update production order status" on public.production_order_status;
create policy "Authenticated users can update production order status"
  on public.production_order_status
  for update
  to authenticated
  using (true)
  with check (true);

create index if not exists idx_production_order_status_updated_at
  on public.production_order_status (updated_at desc);
