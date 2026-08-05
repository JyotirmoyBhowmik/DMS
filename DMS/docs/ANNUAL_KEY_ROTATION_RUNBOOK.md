# Annual Key Encryption Key (KEK) Rotation Operational Runbook

This runbook outlines mandatory compliance procedures for annual platform Key Encryption Key (KEK) rotation under **SOC 2 CC6.6** and **PCI-DSS / India DPDP Act** requirements.

---

## 1. Cryptographic Key Architecture

- **Platform Key Encryption Key (KEK)**: 256-bit AES-GCM master key stored in HashiCorp Vault transit engine at `transit/keys/platform-kek`.
- **Tenant Data Encryption Keys (DEKs)**: Unique 256-bit symmetric keys generated per tenant and wrapped by the active platform KEK version (`env:v1:...`).

---

## 2. Annual Rotation Execution Procedure

Run the zero-downtime KEK rotation script:
```bash
./scripts/rotate-kek.sh v2
```

### Technical Workflow:
1. **New KEK Version Creation**: Vault Transit engine issues key version `v2`.
2. **Batch DEK Re-Wrapping**: All tenant DEK ciphertexts are re-wrapped using `transit/rewrap/platform-kek` without decrypting underlying application data.
3. **Audit Event Emission**: Audit log event `security.kek_rotated` is appended to the cryptographic audit ledger.
