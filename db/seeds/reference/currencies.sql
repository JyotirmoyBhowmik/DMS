-- =============================================================================
-- Reference Seed: Currencies
-- =============================================================================

CREATE TABLE IF NOT EXISTS currencies (
  code        VARCHAR(3)   PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  symbol      VARCHAR(10)  NOT NULL,
  decimals    INTEGER      NOT NULL DEFAULT 2
);

INSERT INTO currencies (code, name, symbol, decimals) VALUES
  ('INR', 'Indian Rupee', '₹', 2),
  ('USD', 'United States Dollar', '$', 2),
  ('EUR', 'Euro', '€', 2)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  symbol = EXCLUDED.symbol,
  decimals = EXCLUDED.decimals;
