-- ============================================================
-- Migration 003
-- クロスフロー・チューブラ水車の追加
-- is_active = FALSE で初期登録（コード変更なしでオン/オフ可能）
-- ============================================================

INSERT INTO turbine_types (name, icon, color, sort_order, is_active) VALUES
  ('クロスフロー水車', '🔄', '#fb923c', 4, FALSE),
  ('チューブラ水車',   '🌐', '#f472b6', 5, FALSE);

-- Ns 適用範囲
INSERT INTO ns_ranges (turbine_type_id, ns_min, ns_max, overlap_note, source, note)
VALUES
(
  (SELECT id FROM turbine_types WHERE name = 'クロスフロー水車'),
  50, 250,
  'Ns=80〜150 はペルトン・フランシスとの重複範囲。小水力・農業用水路向け。',
  'IEC 60193 / 実務参考値',
  'バンキ水車とも呼ばれる。部分負荷特性が広く安定。'
),
(
  (SELECT id FROM turbine_types WHERE name = 'チューブラ水車'),
  300, 800,
  'Ns=300〜400 はカプランとの重複範囲。超低落差・大流量向け。',
  'IEC 60193 / 実務参考値',
  '水平軸または傾斜軸型。H≦20m の超低落差に適用。'
);

-- H-Q 適用範囲
INSERT INTO hq_ranges (turbine_type_id, boundary_points, h_min, h_max, q_min, q_max, source, note)
VALUES
(
  (SELECT id FROM turbine_types WHERE name = 'クロスフロー水車'),
  '[{"q":0.02,"h":2},{"q":0.02,"h":200},{"q":10,"h":200},{"q":10,"h":2}]',
  2, 200, 0.02, 10,
  'IEC 60193 / 実務参考値',
  '小水力向け。低落差〜中落差の広い範囲に対応。'
),
(
  (SELECT id FROM turbine_types WHERE name = 'チューブラ水車'),
  '[{"q":1,"h":1},{"q":1,"h":20},{"q":500,"h":20},{"q":500,"h":1}]',
  1, 20, 1, 500,
  'IEC 60193 / 実務参考値',
  '超低落差（H≦20m）・大流量専用。'
);
