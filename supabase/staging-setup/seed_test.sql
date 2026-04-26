-- ============================================================
-- STAGING SEED DATA — DMC Production Manager
-- Chỉ chạy trên STAGING DB (vfzjweyzwjczrxphnvaa)
-- KHÔNG chạy trên production
-- ============================================================

-- ------------------------------------------------------------
-- PART 1: Test users (via auth.users + profiles)
-- Mật khẩu mặc định: Test@123456
-- ------------------------------------------------------------

-- Insert vào auth.users (cần service_role để bypass RLS)
-- Nếu chạy qua psql, cần kết nối bằng service_role URL
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token,
  email_change_token_new, email_change, aud, role
)
VALUES
  (
    'aaaaaaaa-0001-0001-0001-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'admin@test.local',
    crypt('Test@123456', gen_salt('bf')),
    NOW(), '{"provider":"email","providers":["email"]}', '{}',
    NOW(), NOW(), '', '', '', '', 'authenticated', 'authenticated'
  ),
  (
    'aaaaaaaa-0001-0001-0001-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'manager@test.local',
    crypt('Test@123456', gen_salt('bf')),
    NOW(), '{"provider":"email","providers":["email"]}', '{}',
    NOW(), NOW(), '', '', '', '', 'authenticated', 'authenticated'
  ),
  (
    'aaaaaaaa-0001-0001-0001-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'sup-dmc1@test.local',
    crypt('Test@123456', gen_salt('bf')),
    NOW(), '{"provider":"email","providers":["email"]}', '{}',
    NOW(), NOW(), '', '', '', '', 'authenticated', 'authenticated'
  ),
  (
    'aaaaaaaa-0001-0001-0001-000000000004',
    '00000000-0000-0000-0000-000000000000',
    'user-dmc1@test.local',
    crypt('Test@123456', gen_salt('bf')),
    NOW(), '{"provider":"email","providers":["email"]}', '{}',
    NOW(), NOW(), '', '', '', '', 'authenticated', 'authenticated'
  )
ON CONFLICT (id) DO NOTHING;

-- Insert profiles (trigger handle_new_user sẽ tự tạo row khi signup bình thường,
-- nhưng vì chúng ta insert thẳng auth.users nên cần insert profiles thủ công)
INSERT INTO public.profiles (id, username, role, workspace, created_at)
VALUES
  ('aaaaaaaa-0001-0001-0001-000000000001', 'Test Admin',       'ADMIN',      'ALL',  NOW()),
  ('aaaaaaaa-0001-0001-0001-000000000002', 'Test Manager',     'MANAGER',    'ALL',  NOW()),
  ('aaaaaaaa-0001-0001-0001-000000000003', 'Test Supervisor',  'SUPERVISOR', 'DMC1', NOW()),
  ('aaaaaaaa-0001-0001-0001-000000000004', 'Test User DMC1',   'USER',       'DMC1', NOW())
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- PART 2: 100 lệnh sản xuất test (bảng data)
-- DMC1=30, DMC3=25, DMC4=25, DMC5=20
-- ------------------------------------------------------------

INSERT INTO public.data (
  "PCODE", "INITIALDATE", "CUSTOMER", "WORKSHOP",
  "DESCRIPTION", "QUANTITY", "DEADLINEDATE", "STATUS"
)
SELECT
  'TEST-' || LPAD(n::TEXT, 5, '0') AS "PCODE",
  (CURRENT_DATE - (n % 30) * INTERVAL '1 day')::DATE AS "INITIALDATE",
  CASE (n % 5)
    WHEN 0 THEN 'Khách hàng A'
    WHEN 1 THEN 'Khách hàng B'
    WHEN 2 THEN 'Khách hàng C'
    WHEN 3 THEN 'Khách hàng D'
    ELSE 'Khách hàng E'
  END AS "CUSTOMER",
  CASE
    WHEN n <= 30 THEN 'DMC1'
    WHEN n <= 55 THEN 'DMC3'
    WHEN n <= 80 THEN 'DMC4'
    ELSE 'DMC5'
  END AS "WORKSHOP",
  'Sản phẩm test #' || n AS "DESCRIPTION",
  (100 + (n * 7) % 900)::NUMERIC AS "QUANTITY",
  (CURRENT_DATE + ((n % 30) + 1) * INTERVAL '1 day') AS "DEADLINEDATE",
  CASE (n % 3)
    WHEN 0 THEN 'Đang sản xuất'
    WHEN 1 THEN 'Chờ sản xuất'
    ELSE 'Hoàn thành'
  END AS "STATUS"
FROM generate_series(1, 100) AS n
ON CONFLICT ("PCODE") DO NOTHING;

-- ------------------------------------------------------------
-- PART 3: 50 Production records (7 ngày gần nhất)
-- ------------------------------------------------------------

INSERT INTO public."Production" (
  pdate, totalem, pcode, products, material,
  poutput, eoutput, routput, workforce,
  starttime, endtime, realnorm
)
SELECT
  (CURRENT_DATE - (n % 7) * INTERVAL '1 day')::DATE AS pdate,
  CASE (n % 4)
    WHEN 0 THEN 'DMC1'
    WHEN 1 THEN 'DMC3'
    WHEN 2 THEN 'DMC4'
    ELSE 'DMC5'
  END AS totalem,
  'TEST-' || LPAD(((n % 100) + 1)::TEXT, 5, '0') AS pcode,
  'Sản phẩm test #' || ((n % 100) + 1) AS products,
  'Vật liệu ' || CHR(65 + (n % 5)) AS material,
  (200 + (n * 13) % 300)::NUMERIC AS poutput,
  (180 + (n * 11) % 280)::NUMERIC AS eoutput,
  (5 + n % 20)::NUMERIC AS routput,
  (5 + n % 10)::NUMERIC AS workforce,
  CASE (n % 5)
    WHEN 0 THEN '07:30'
    WHEN 1 THEN '09:30'
    WHEN 2 THEN '12:30'
    WHEN 3 THEN '14:30'
    ELSE '16:30'
  END AS starttime,
  CASE (n % 5)
    WHEN 0 THEN '09:30'
    WHEN 1 THEN '11:30'
    WHEN 2 THEN '14:30'
    WHEN 3 THEN '16:30'
    ELSE '22:00'
  END AS endtime,
  (50 + (n * 3) % 100)::NUMERIC AS realnorm
FROM generate_series(1, 50) AS n
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------
-- VERIFY (uncomment để chạy sau khi insert)
-- ------------------------------------------------------------
-- SELECT 'auth.users' AS tbl, COUNT(*) FROM auth.users WHERE email LIKE '%@test.local'
-- UNION ALL
-- SELECT 'profiles', COUNT(*) FROM public.profiles WHERE username LIKE 'Test%'
-- UNION ALL
-- SELECT 'data TEST-*', COUNT(*) FROM public.data WHERE "PCODE" LIKE 'TEST-%'
-- UNION ALL
-- SELECT 'Production (7d)', COUNT(*) FROM public."Production" WHERE pdate >= CURRENT_DATE - 7;
