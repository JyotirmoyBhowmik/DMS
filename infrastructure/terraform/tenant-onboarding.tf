variable "tenant_code" {
  type        = string
  description = "Unique tenant identifier code (e.g. acme)"
}

variable "plan_tier" {
  type        = string
  default     = "STARTER"
  description = "Tenant plan tier: FREE, STARTER, PROFESSIONAL, ENTERPRISE"
}

resource "vault_mount" "tenant_vault" {
  path        = "secret/tenants/${var.tenant_code}"
  type        = "kv-v2"
  description = "Isolated Vault secret engine for tenant ${var.tenant_code}"
}

resource "cloudflare_record" "tenant_subdomain" {
  zone_id = "0123456789abcdef0123456789abcdef"
  name    = var.tenant_code
  value   = "ingress.dmsenterprise.com"
  type    = "CNAME"
  proxied = true
}
