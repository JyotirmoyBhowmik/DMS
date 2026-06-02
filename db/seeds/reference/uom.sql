-- =============================================================================
-- Reference Seed: Units of Measure (UOM)
-- =============================================================================

CREATE TABLE IF NOT EXISTS uoms (
  code        VARCHAR(10)  PRIMARY KEY,
  name        VARCHAR(100) NOT NULL UNIQUE,
  is_base     BOOLEAN      NOT NULL DEFAULT true
);

INSERT INTO uoms (code, name, is_base) VALUES
  ('PC', 'Piece', true),
  ('CASE', 'Shipping Case (24 units)', false),
  ('BOX', 'Inner Box (6 units)', false),
  ('LTR', 'Litre', true),
  ('KG', 'Kilogram', true)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  is_base = EXCLUDED.is_base;
