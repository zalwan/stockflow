CREATE TABLE order_requests (
    key VARCHAR(128) PRIMARY KEY,
    request_hash TEXT NOT NULL,
    order_id INTEGER NOT NULL REFERENCES sales_orders(id),
    response JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
