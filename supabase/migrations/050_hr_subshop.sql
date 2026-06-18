-- ============================================================
-- 050: Tách nhân sự theo XƯỞNG NHỎ (production-entry sub-shop).
--   Thêm cột human_resource.subshop để gán mỗi người vào 1 xưởng nhỏ
--   (DMC1-PU/PK/CT, DMC3-PN/PK/CT, DMC4-XG/PK). DMC5 / Công trình / phòng ban
--   không tách → để subshop NULL, dùng "factory" làm nhóm.
--
--   THUẦN BỔ SUNG (additive, non-breaking): cột nullable, không đổi dữ liệu cũ,
--   không phá tab Nhân sự hiện tại (tab cũ gom theo "factory", bỏ qua subshop).
--   hr_daily KHÔNG đổi schema: cột "factory" (TEXT) tái dùng để lưu mã nhóm
--   xưởng nhỏ ở giao diện mới; bản ghi daily cũ ở mức nhà máy gốc là legacy.
-- ============================================================

ALTER TABLE public.human_resource
  ADD COLUMN IF NOT EXISTS subshop TEXT;

-- Lọc/gom theo xưởng nhỏ nhanh hơn.
CREATE INDEX IF NOT EXISTS human_resource_subshop_idx
  ON public.human_resource (subshop);

COMMENT ON COLUMN public.human_resource.subshop IS
  'Xưởng nhỏ (production-entry sub-shop) của nhân sự: DMC1-PU/PK/CT, DMC3-PN/PK/CT, DMC4-XG/PK. NULL = dùng factory làm nhóm (DMC5/Công trình/phòng ban).';
