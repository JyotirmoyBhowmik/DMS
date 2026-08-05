-- =============================================================================
-- V004: Create kyc_documents table
-- Tracks distributor KYC verification documents (GSTIN, PAN, etc.)
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS kyc_documents (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID          NOT NULL,
  distributor_id        UUID          NOT NULL REFERENCES distributors(id) ON DELETE CASCADE,
  document_type         VARCHAR(30)   NOT NULL
                          CHECK (document_type IN ('GSTIN','PAN','TRADE_LICENSE','FSSAI','DRUG_LICENSE','BANK_PROOF')),
  document_number       VARCHAR(100)  NOT NULL,
  document_url          VARCHAR(1024),
  verification_status   VARCHAR(20)   NOT NULL DEFAULT 'PENDING'
                          CHECK (verification_status IN ('PENDING','VERIFIED','REJECTED','EXPIRED')),
  verified_by           UUID,
  verified_at           TIMESTAMPTZ,
  expires_at            TIMESTAMPTZ,
  rejection_reason      TEXT,
  version               INTEGER       NOT NULL DEFAULT 1,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),

  -- A distributor can have only one document per type per tenant
  CONSTRAINT uq_kyc_doc_type UNIQUE (tenant_id, distributor_id, document_type)
);

-- Indexes
CREATE INDEX idx_kyc_tenant          ON kyc_documents (tenant_id);
CREATE INDEX idx_kyc_distributor     ON kyc_documents (tenant_id, distributor_id);
CREATE INDEX idx_kyc_status          ON kyc_documents (tenant_id, verification_status);
CREATE INDEX idx_kyc_expiry          ON kyc_documents (expires_at) WHERE expires_at IS NOT NULL;

CREATE TRIGGER trg_kyc_updated_at
  BEFORE UPDATE ON kyc_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;
