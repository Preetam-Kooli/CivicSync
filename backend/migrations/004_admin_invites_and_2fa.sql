-- 004: admin invitations and 2FA replay protection

-- The last 30-second time step that was used successfully. A code from the
-- same (or an earlier) step is refused, so a code works only once.
ALTER TABLE users ADD COLUMN totp_last_step BIGINT;

CREATE TABLE admin_invites (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email       TEXT        NOT NULL,
  role        user_role   NOT NULL,
  department  module_type,
  token_hash  TEXT        NOT NULL UNIQUE,   -- only the hash of the link token is stored
  created_by  BIGINT      REFERENCES users(id) ON DELETE SET NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT invites_role_check   CHECK (role IN ('staff', 'admin', 'super_admin')),
  CONSTRAINT invites_staff_dept   CHECK (role <> 'staff' OR department IS NOT NULL),
  CONSTRAINT invites_email_format CHECK (email LIKE '%_@_%')
);

-- At most ONE open invitation per email address
CREATE UNIQUE INDEX admin_invites_open_email
  ON admin_invites (lower(email))
  WHERE used_at IS NULL AND revoked_at IS NULL;