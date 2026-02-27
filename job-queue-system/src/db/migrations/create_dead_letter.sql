CREATE TABLE dead_letter_jobs(
    id                  BIGSERIAL PRIMARY KEY,
    original_job_id     BIGINT NOT NULL,
    type                VARCHAR(100) NOT NULL,
    payload             JSONB NOT NULL,
    error_message       TEXT,
    retry_strategy      VARCHAR(20),
    attempts            INTEGER NOT NULL DEFAULT 0,
    failed_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status              VARCHAR(20) NOT NULL DEFAULT 'dead',
    requeued_at         TIMESTAMPTZ,
    requeued_job_id     BIGINT
);

CREATE INDEX idx_dlq_status         ON dead_letter_jobs(status);
CREATE INDEX idx_dlq_type           ON dead_letter_jobs(type);
CREATE INDEX idx_dlq_original_job   ON dead_letter_jobs(original_job_id);