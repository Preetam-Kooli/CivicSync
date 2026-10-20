-- 003: refresh tokens and audit log

CREATE TYPE portal_type AS ENUM ('citizen', 'admin');

-- Only the SHA-256 HASH of each refresh token is stored, never the token itself.
CREATE TABLE refresh_tokens (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT         NOT NULL UNIQUE,
  portal     portal_type  NOT NULL,
  expires_at TIMESTAMPTZ  NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX refresh_tokens_user_idx ON refresh_tokens (user_id);

-- Every login attempt (success and failure) is recorded here.
CREATE TABLE audit_logs (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id         BIGINT       REFERENCES users(id) ON DELETE SET NULL,
  email_attempted TEXT,
  portal          portal_type,
  action          TEXT         NOT NULL,
  success         BOOLEAN      NOT NULL,
  ip              TEXT,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX audit_logs_user_idx    ON audit_logs (user_id);
CREATE INDEX audit_logs_created_idx ON audit_logs (created_at);