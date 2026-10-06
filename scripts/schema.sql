CREATE TABLE drug_codes (
  id                  INTEGER PRIMARY KEY,
  code24              TEXT NOT NULL,      -- รหัสยาแผนไทย 24 หลัก (ซ้ำได้ เช่น ขนาดบรรจุต่างกัน)
  ttmtid              TEXT,               -- TTMTID
  drug_type           TEXT NOT NULL,      -- เดี่ยว / ตำรับ
  formula_type        TEXT,
  key_ingredient_code TEXT,
  drug_name           TEXT,
  trade_name          TEXT,
  indication          TEXT,
  strength            TEXT,
  strength_code       TEXT,
  dosage_form         TEXT,
  dosage_form_code    TEXT,
  manufacturer        TEXT,
  manufacturer_code   TEXT,
  registration_no     TEXT,
  work_code           TEXT,
  source_code         TEXT,
  thai_theory_code    TEXT,
  remark              TEXT,
  assigned_round      TEXT,
  pack_size           TEXT
);
CREATE INDEX idx_drug_codes_code24 ON drug_codes(code24);
CREATE INDEX idx_drug_codes_ttmtid ON drug_codes(ttmtid);
CREATE INDEX idx_drug_codes_name ON drug_codes(drug_name);

CREATE TABLE ttmt_master (
  ttmt_code         TEXT PRIMARY KEY,
  active_ingredient TEXT,
  strength          TEXT,
  dosage_form       TEXT,
  cont_value        TEXT,
  cont_unit         TEXT,
  disp_unit         TEXT,
  trade_name        TEXT,
  manufacturer      TEXT,
  fsn               TEXT,
  status            TEXT,
  ttmt_type         TEXT,
  change_date       TEXT,
  ed                TEXT,
  drug_group_nhso   TEXT
);
CREATE INDEX idx_master_group ON ttmt_master(drug_group_nhso);

CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);

-- มุมมองรวม: ทุกรหัส 24 หลัก + ข้อมูลจาก Master (ถ้ามี)
CREATE VIEW drug_lookup AS
SELECT d.*,
       m.ttmt_code IS NOT NULL       AS in_master,
       m.drug_group_nhso IS NOT NULL AS has_drug_group,
       m.drug_group_nhso             AS drug_group,
       m.active_ingredient           AS master_active_ingredient,
       m.strength                    AS master_strength,
       m.dosage_form                 AS master_dosage_form,
       m.trade_name                  AS master_trade_name,
       m.manufacturer                AS master_manufacturer,
       m.fsn                         AS master_fsn,
       m.ttmt_type                   AS master_ttmt_type,
       m.ed                          AS master_ed,
       m.change_date                 AS master_change_date
  FROM drug_codes d
  LEFT JOIN ttmt_master m ON m.ttmt_code = d.ttmtid;
