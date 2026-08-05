CREATE TABLE delivery_confirmations (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    order_id UUID NOT NULL,
    delivered_at TIMESTAMPTZ NOT NULL,
    received_by VARCHAR(255) NOT NULL,
    signature_photo_url VARCHAR(1024),
    gps_lat DECIMAL(10, 8) NOT NULL,
    gps_lon DECIMAL(11, 8) NOT NULL,
    status VARCHAR(50) NOT NULL,
    rejection_reason TEXT,
    version INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_delivery_confirmations_tenant_order ON delivery_confirmations(tenant_id, order_id);

CREATE TABLE competitor_captures (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    outlet_id UUID NOT NULL,
    brand VARCHAR(255) NOT NULL,
    sku_id UUID NOT NULL,
    observed_price DECIMAL(19, 4) NOT NULL,
    observed_price_currency VARCHAR(3) NOT NULL,
    promotion_details TEXT,
    photo_url VARCHAR(1024),
    version INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_competitor_captures_tenant_outlet ON competitor_captures(tenant_id, outlet_id);
