CREATE TABLE distributor_onboarding_workflows (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL,
    distributor_id VARCHAR(50) NOT NULL,
    current_stage VARCHAR(50) NOT NULL,
    kyc_status VARCHAR(50) NOT NULL,
    credit_check_status VARCHAR(50) NOT NULL,
    contract_signed BOOLEAN NOT NULL DEFAULT FALSE,
    approved_by VARCHAR(50),
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_distributor_onboarding_workflows_tenant_id ON distributor_onboarding_workflows(tenant_id);
CREATE INDEX idx_distributor_onboarding_workflows_distributor_id ON distributor_onboarding_workflows(distributor_id);
