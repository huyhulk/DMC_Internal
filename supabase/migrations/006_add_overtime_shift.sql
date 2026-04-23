-- ============================================================
-- 006: Thêm ca tăng ca vào fn_classify_shift
-- ca_tang_ca: 16:30–22:00 (990–1320 phút)
-- Phụ thuộc: migration 005 (fn_classify_shift đã tồn tại)
-- ============================================================

CREATE OR REPLACE FUNCTION fn_classify_shift(p_starttime TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_parts TEXT[];
  v_h     INTEGER;
  v_m     INTEGER;
  v_total INTEGER;
BEGIN
  IF p_starttime IS NULL OR trim(p_starttime) = '' THEN RETURN 'khac'; END IF;

  v_parts := regexp_split_to_array(trim(p_starttime), ':');
  BEGIN
    v_h := (v_parts[1])::INTEGER;
    v_m := (v_parts[2])::INTEGER;
  EXCEPTION WHEN OTHERS THEN
    RETURN 'khac';
  END;

  IF v_h IS NULL OR v_m IS NULL THEN RETURN 'khac'; END IF;

  v_total := v_h * 60 + v_m;

  IF    v_total >= 450  AND v_total < 570  THEN RETURN 'ca_sang_1';   -- 07:30–09:30
  ELSIF v_total >= 570  AND v_total < 690  THEN RETURN 'ca_sang_2';   -- 09:30–11:30
  ELSIF v_total >= 750  AND v_total < 870  THEN RETURN 'ca_chieu_1';  -- 12:30–14:30
  ELSIF v_total >= 870  AND v_total < 990  THEN RETURN 'ca_chieu_2';  -- 14:30–16:30
  ELSIF v_total >= 990  AND v_total < 1320 THEN RETURN 'ca_tang_ca';  -- 16:30–22:00
  ELSE  RETURN 'khac';
  END IF;
END;
$$;

-- Verify:
-- SELECT fn_classify_shift('16:30'); -- → ca_tang_ca
-- SELECT fn_classify_shift('21:59'); -- → ca_tang_ca
-- SELECT fn_classify_shift('22:00'); -- → khac
-- SELECT fn_classify_shift('14:30'); -- → ca_chieu_2 (không đổi)
-- ============================================================
