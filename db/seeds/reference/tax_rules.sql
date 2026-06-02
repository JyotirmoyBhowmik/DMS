-- =============================================================================
-- Reference Seed: Tax Rules (GST rates)
-- =============================================================================

CREATE TABLE IF NOT EXISTS tax_rules (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL UNIQUE,
  rate_pct    NUMERIC(5,2) NOT NULL CHECK (rate_pct >= 0 AND rate_pct <= 100),
  description TEXT
);

INSERT INTO tax_rules (name, rate_pct, description) VALUES
  ('GST_ZERO', 0.00, 'Exempt goods'),
  ('GST_5', 5.00, 'Essential goods'),
  ('GST_12', 12.00, 'Standard slab 1'),
  ('GST_18', 18.00, 'Standard slab 2 (FMCG, services)'),
  ('GST_28', 28.00, 'Luxury / demerit goods')
ON CONFLICT (name) DO UPDATE SET
  rate_pct = EXCLUDED.rate_pct,
  description = EXCLUDED.description;
