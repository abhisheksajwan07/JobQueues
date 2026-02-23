CREATE TABLE jobs(
    id BIGSERIAL PRIMARY KEY,
    type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    idempotency_key TEXT UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    error_message TEXT,
    scheduled_for TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    locked_until TIMESTAMPTZ,
    retry_strategy VARCHAR(20),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);





CREATE INDEX idx_jobs_status_scheduled ON
jobs (status,scheduled_for);

CREATE INDEX idx_jobs_locked_until ON 
jobs(locked_until);

CREATE INDEX idx_jobs_type
ON jobs(type);

