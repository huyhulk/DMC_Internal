-- ============================================================
-- 047: norm_override — bảng ánh xạ "từ khóa diễn giải → định mức (Norm) cụ thể"
-- Dùng cho matcher tab "Tổng quan LSX" (lib/production/workflow.ts) để override
-- việc khớp định mức theo heuristic vốn không thể nhắm tới biến thể đặc hiệu
-- (vd "PKK - cùm" — tên norm không chứa "phụ kiện" nên family-score luôn = 0).
-- ADMIN quản lý qua /dashboard/admin/norm-override.
-- ============================================================

create table if not exists public.norm_override (
  id              bigint generated always as identity primary key,
  keyword         text    not null,             -- chuỗi tìm trong DESCRIPTION (so khớp đã chuẩn hóa, bỏ dấu)
  workshop        text,                          -- null = mọi xưởng; nếu set → khớp theo mã xưởng gốc (DMC1/3/4/5/CONG_TRINH)
  target_products text    not null,              -- phải khớp Norm.products
  require_any     text[]  not null default '{}', -- (tùy chọn) ít nhất một marker phải xuất hiện trong diễn giải
  priority        integer not null default 0,    -- cao hơn thắng khi nhiều override cùng khớp
  note            text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists norm_override_workshop_idx on public.norm_override (workshop);

alter table public.norm_override enable row level security;

-- Đọc: mọi user đã đăng nhập (matcher chạy cho tất cả người nhập sản xuất).
drop policy if exists norm_override_select on public.norm_override;
create policy norm_override_select on public.norm_override
  for select to authenticated
  using (true);

-- Ghi: chỉ ADMIN (quản lý trong trang Hệ Thống).
drop policy if exists norm_override_admin_write on public.norm_override;
create policy norm_override_admin_write on public.norm_override
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN'));

-- Seed: "PKK - cùm" (phụ kiện kẽm có cùm, DMC1, norm 650). Heuristic gán nhầm vào
-- "Phụ kiện inox - kẽm" (100) → sai ~6.5 lần; override trỏ thẳng về đúng norm.
insert into public.norm_override (keyword, workshop, target_products, require_any, priority, note)
select 'PKK - cùm', 'DMC1', 'PKK - cùm', '{}'::text[], 100,
       'Đơn "PKK - cùm 11s/5s - IPC" khớp đúng norm PKK - cùm (650) thay vì Phụ kiện inox - kẽm (100)'
where not exists (
  select 1 from public.norm_override
  where keyword = 'PKK - cùm' and coalesce(workshop, '') = 'DMC1'
);
