-- 017_machines.sql
-- Bảng danh mục máy móc thiết bị — cung cấp dữ liệu cho droplist nhập liệu

CREATE TABLE IF NOT EXISTS machines (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_name     text        NOT NULL,
  machine_code     text,
  machine_location text        NOT NULL
    CHECK (machine_location IN ('DMC1','DMC3','DMC4','DMC5')),
  machine_status   text        NOT NULL DEFAULT 'active'
    CHECK (machine_status IN ('active','inactive','maintenance','broken')),
  machine_capacity text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS machines_code_unique
  ON machines (machine_code) WHERE machine_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_machines_location ON machines (machine_location);
CREATE INDEX IF NOT EXISTS idx_machines_status   ON machines (machine_status);

ALTER TABLE machines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "machines_select" ON machines
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "machines_insert" ON machines
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN','MANAGER'))
  );

CREATE POLICY "machines_update" ON machines
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN','MANAGER'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN','MANAGER'))
  );

CREATE POLICY "machines_delete" ON machines
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
  );

CREATE OR REPLACE FUNCTION machines_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER machines_updated_at
  BEFORE UPDATE ON machines
  FOR EACH ROW EXECUTE FUNCTION machines_set_updated_at();

-- ─── Seed: Danh mục máy móc (theo tài liệu ngày 12/11/2024) ──────────────────
DO $seed$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM machines LIMIT 1) THEN

    INSERT INTO machines (machine_name, machine_code, machine_location, machine_capacity) VALUES

    -- ── DMC1 ──────────────────────────────────────────────────────────────────
    ('Máy cán tôn 5S',                    'CT5S',       'DMC1', '18 m/phút'),
    ('Máy cán tôn 7S-11S',                'CT7-11S',    'DMC1', '14–16 m/phút'),
    ('Máy cán tôn 9S-13S',                'CT9-13S',    'DMC1', '12–14 m/phút'),
    ('Máy cán tôn sàn deck',              'SD01',       'DMC1', '12–16 m/phút'),
    ('Máy cán tôn 6S-11S (01)',           'CT6-11S-01', 'DMC1', '14–16 m/phút'),
    ('Máy phun PU 6-11S',                 'PU-01',      'DMC1', '5–6 m/phút'),
    ('Máy dập vòm 2 tầng 7-9S',           'DV-01',      'DMC1', '5–6 m/phút'),
    ('Máy dập vòm 2 tầng 5-11S',          'DV-02',      'DMC1', '5–6 m/phút'),
    ('Máy dập vòm 1 tầng 6S',             'DV-03',      'DMC1', '5–6 m/phút'),
    ('Máy dập vòm 2 tầng 6-11S PU',       'DV-04',      'DMC1', '5–6 m/phút'),
    ('Máy nhấn 1mm (01)',                  'MN-01',      'DMC1', '5–6 m/phút'),
    ('Máy nhấn 1mm (02)',                  'MN-02',      'DMC1', '5–6 m/phút'),
    ('Máy nhấn CNC (01)',                  'CCNC-01',    'DMC1', '5–6 m/phút'),
    ('Máy xả cuộn tự động (01)',           'XCA-01',     'DMC1', '30 m/phút'),
    ('Máy xả cuộn tự động (02)',           'XCA-02',     'DMC1', '30 m/phút'),
    ('Máy xả cuộn tự động (03)',           'XCA-03',     'DMC1', '30 m/phút'),
    ('Máy Rọc (01)',                       'MR-01',      'DMC1', '10–12 m/phút'),
    ('Cầu Trục PX1 (01)',                  'CT-1',       'DMC1', '20 m/phút'),
    ('Cầu Trục PX2 (02)',                  'CT-2',       'DMC1', '20 m/phút'),
    ('Cầu Trục PX3 (03)',                  'CT-3',       'DMC1', '20 m/phút'),
    ('Cầu Trục PX1 (04)',                  'CT-4',       'DMC1', '20 m/phút'),
    ('Máy dập Cliplock bước 1',            'CL-1',       'DMC1', '10 cái/phút'),
    ('Máy dập Cliplock bước 2',            'CL-2',       'DMC1', '10 cái/phút'),
    ('Máy dập Cliplock bước 3',            'CL-3',       'DMC1', '5 cái/phút'),
    ('Máy dập Cliplock bước 4',            'CL-4',       'DMC1', '5 cái/phút'),
    ('Máy dập Seamlock bước 1',            'SL-1',       'DMC1', '5 cái/phút'),
    ('Máy dập Seamlock bước 2',            'SL-2',       'DMC1', '5 cái/phút'),
    ('Máy dập Seamlock bước 3',            'SL-3',       'DMC1', '5 cái/phút'),
    ('Máy dập Seamlock bước 3 (số 2)',     'SL-4',       'DMC1', '5 cái/phút'),
    ('Máy quấn PE',                        'PE-01',      'DMC1', '10 m/phút'),
    ('Cửa cuốn PX1',                       'CC-1',       'DMC1', '30 m/phút'),
    ('Cửa cuốn PX2',                       'CC-2',       'DMC1', '30 m/phút'),
    ('Cửa cuốn PX3',                       'CC-3',       'DMC1', '30 m/phút'),
    ('Cửa cuốn phòng kỹ thuật',            'CC-4',       'DMC1', '30 m/phút'),
    ('Cửa cuốn văn phòng',                 'CC-5',       'DMC1', '30 m/phút'),
    ('Máy Nén Khí Hitachi (01)',           'MNK-01',     'DMC1', '1.72 m³/phút'),
    ('Máy Nén Khí Hitachi (02)',           'MNK-02',     'DMC1', '1.72 m³/phút'),
    ('Máy xả cuộn tay số 4',              'XCT-04',     'DMC1', '20 m/phút'),
    ('Máy xả cuộn tay số 6',              'XCT-06',     'DMC1', '20 m/phút'),
    ('Máy xả cuộn tay số 3',              'XCT-03',     'DMC1', '20 m/phút'),
    ('Máy cán đai chống bão',             'MCD-01',     'DMC1', '20 cái/phút'),
    ('Máy dập Seamlock bước 2 (cơ)',      'SL-2-02',    'DMC1', '5 cái/phút'),
    ('Máy rùa seam 1',                     'RS-01',      'DMC1', '20 m/phút'),
    ('Máy rùa seam 2',                     'RS-02',      'DMC1', '20 m/phút'),
    ('Máy rùa seam 3',                     'RS-03',      'DMC1', '20 m/phút'),

    -- ── DMC3 ──────────────────────────────────────────────────────────────────
    ('Máy cán tôn 5S-13S',                'CT5-13S',    'DMC3', '13–14 m/phút'),
    ('Máy Panel',                          'PN-01',      'DMC3', '3–4 m/phút'),
    ('Máy xả cuộn tự động (05)',           'XCA-05',     'DMC3', NULL),
    ('Máy chạy V23',                       'V23',        'DMC3', '3 cây/phút'),
    ('Máy chạy V25',                       'V25',        'DMC3', '3 cây/phút'),
    ('Máy chạy U chân',                    'U-PN',       'DMC3', '3 cây/phút'),
    ('Cổng Trục DM3 (06)',                 'CT-6',       'DMC3', '20 m/phút'),
    ('Cổng Trục DM3 (05)',                 'CT-5',       'DMC3', '20 m/phút'),
    ('Máy Nén Khí Hitachi 7.5',           'MNK-03',     'DMC3', '1.72 m³/phút'),
    ('Máy xả cuộn tay số 5',              'XCT-05',     'DMC3', '20 m/phút'),
    ('Máy rọc 03',                         'MR-03',      'DMC3', '20 m/phút'),
    ('Máy cán tôn 11-13S',                'CT11-13S',   'DMC3', '22 m/phút'),

    -- ── DMC4 ──────────────────────────────────────────────────────────────────
    ('Máy cán xà gồ C nhỏ',               'XGC1',       'DMC4', '12–18 m/phút'),
    ('Máy cán xà gồ C lớn',               'XGC2',       'DMC4', '12–18 m/phút'),
    ('Máy cán xà gồ C-Z',                 'XGCZ1',      'DMC4', '8–12 m/phút'),
    ('Máy cán tôn Seamlock 485',           'CT-SL0485',  'DMC4', '12–14 m/phút'),
    ('Máy cán tôn Seamlock 500',           'CT-SL-500',  'DMC4', '12–14 m/phút'),
    ('Máy cán tôn Cliplock',               'CT-CL',      'DMC4', '8–12 m/phút'),
    ('Máy xả cuộn tự động (04)',           'XCA-04',     'DMC4', '30 m/phút'),
    ('Máy xả cuộn tay 01',                 'XCT-01',     'DMC4', '30 m/phút'),
    ('Máy rọc số 2',                       'MR-02',      'DMC4', '50 m/phút'),
    ('Máy xả cuộn tay 02',                 'XCT-02',     'DMC4', '30 m/phút'),
    ('Máy cắt Laser',                      'LS-CNC-01',  'DMC4', '30 m/phút'),
    ('Máy nhấn CNC 300T-6000',            'CCNC-02',    'DMC4', '30 m/phút'),
    ('Máy Nhấn NC 70T-1500',              'CNC-01',     'DMC4', '10 m/phút'),
    ('Máy đột lớn',                        'MD-01',      'DMC4', '40 lần/phút'),
    ('Máy đột nhỏ',                        'MD-02',      'DMC4', '40 lần/phút'),
    ('Máy phun keo Sealant',               'MPK-01',     'DMC4', '50 m/phút'),
    ('Máy Hàn Đinh Welcom',               'MHD-01',     'DMC4', '6 cây/phút'),
    ('Máy hàn đinh AP',                    'MHD-02',     'DMC4', '6 cây/phút'),
    ('Cầu Trục DM4 (07)',                  'CT-7',       'DMC4', '20 m/phút'),
    ('Cầu Trục DM4 (08)',                  'CT-8',       'DMC4', '20 m/phút'),
    ('Cửa cuốn DM4-1',                     'CC-6',       'DMC4', '20 m/phút'),
    ('Cửa cuốn DM4-2',                     'CC-7',       'DMC4', '20 m/phút'),
    ('Cửa cuốn DM4-3',                     'CC-8',       'DMC4', '20 m/phút'),
    ('Cửa cuốn DM4-4',                     'CC-9',       'DMC4', '20 m/phút'),
    ('Cửa cuốn DM4-5',                     'CC-10',      'DMC4', '20 m/phút'),
    ('Cửa cuốn DM4-6',                     'CC-11',      'DMC4', '20 m/phút'),
    ('Máy cắt tôn 3 ly k1500-3',           'CK1500-3',   'DMC4', '20 m/phút'),
    ('Máy xả cuộn tự động số 7',           'XCA-07',     'DMC4', '30 m/phút'),
    ('Máy xả cuộn tự động số 8',           'XCT-08',     'DMC4', '30 m/phút'),
    ('Máy xả cuộn tay số 7',               'XCT-07',     'DMC4', '20 m/phút'),
    ('Máy xả cuộn tay số 8',               'XCT-08B',    'DMC4', '20 m/phút'),
    ('Máy hàn laser',                      'HLS-01',     'DMC4', '10 m/phút'),
    ('Máy lốc-hàn phễu',                   'LHP-01',     'DMC4', '10 phút/cái'),
    ('Máy nén khí Hitachi DM4',            'MNK-04',     'DMC4', NULL),

    -- ── DMC5 ──────────────────────────────────────────────────────────────────
    ('Máy cán tôn 6S-11S (02)',            'CT6-11S-02', 'DMC5', '14–16 m/phút'),
    ('Máy phun PU 6-11S (02)',             'PU-02',      'DMC5', '5–6 m/phút'),
    ('Máy xả cuộn tự động (06)',           'XCA-06',     'DMC5', '20 m/phút'),
    ('Máy nhấn H613',                      'MN-04',      'DMC5', '5–6 m/phút'),
    ('Máy dập vòm 2 tầng 6-11S PU (05)',  'DV-05',      'DMC5', '5–6 m/phút'),
    ('Cầu Trục DM5',                       'CT-9',       'DMC5', '20 m/phút'),
    ('Cổng Trục DM5',                      'CT-10',      'DMC5', '20 m/phút'),
    ('Bình nén 1000L',                     'BN-1000',    'DMC5', '1000 L');

  END IF;
END $seed$;
