-- =============================================================================
-- Column-Level Encryption Policy Notes
-- Explains how columns decorated with `@Encrypted` are persisted in the database.
-- =============================================================================

-- 1. Encryption Algorithm: AES-256-GCM
-- Ciphertext layout:
-- Column Type: TEXT (base64url encoded representation of v1 pack format)
-- Format: "v1.<base64url(iv)>.<base64url(ciphertext)>.<base64url(authTag)>"
-- Nonce: 12-byte cryptographically random IV generated per write (NEVER REUSED).
-- AAD: (Optional) Bound to the tenant_id and record ID to prevent block-copying.

-- 2. Blind Indexing for Exact Matching
-- Encrypted columns cannot be searched using raw indexes. To support querying (e.g., lookups by email or tax number):
-- We store a separate blind index column: `<column_name>_bindex`.
-- Formula: `SHA-256(plaintext + tenant_specific_salt)`.
-- Database Index Type: B-Tree for fast O(1) exact match indexing.

-- Example Schema Layout for encrypted columns:
-- ALTER TABLE retail_outlets ADD COLUMN phone_encrypted TEXT;
-- ALTER TABLE retail_outlets ADD COLUMN phone_bindex VARCHAR(64);
-- CREATE INDEX idx_outlets_phone_bindex ON retail_outlets (tenant_id, phone_bindex);
