-- 001: extensions, enum types, users, categories

-- PostGIS gives us spatial types and functions (ST_DWithin etc.).
-- IF NOT EXISTS makes this safe to run on a database that already has it.
CREATE EXTENSION IF NOT EXISTS postgis;

-- ENUM types: the database itself rejects any value not in this list.
CREATE TYPE user_role AS ENUM
  ('citizen', 'volunteer', 'staff', 'admin', 'super_admin');

-- The five modules of CivicSync
CREATE TYPE module_type AS ENUM
  ('public_service', 'streetlight', 'flood', 'road', 'fire');

CREATE TABLE users (
  id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  full_name             TEXT        NOT NULL,
  email                 TEXT        NOT NULL,
  phone                 TEXT,
  password_hash         TEXT        NOT NULL,   -- bcrypt hash, never the real password
  role                  user_role   NOT NULL DEFAULT 'citizen',
  department            module_type,            -- staff only: which module they handle
  email_verified        BOOLEAN     NOT NULL DEFAULT false,
  totp_secret           TEXT,                   -- for admin 2FA (Phase 4)
  totp_enabled          BOOLEAN     NOT NULL DEFAULT false,
  failed_login_attempts INTEGER     NOT NULL DEFAULT 0,
  locked_until          TIMESTAMPTZ,            -- account lockout (Phase 2)
  is_active             BOOLEAN     NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- CHECK constraints: rules the database enforces on every insert/update
  CONSTRAINT users_email_format  CHECK (email LIKE '%_@_%'),
  CONSTRAINT users_failed_logins CHECK (failed_login_attempts >= 0),
  CONSTRAINT users_staff_dept    CHECK (role <> 'staff' OR department IS NOT NULL)
);

-- Unique index on lower(email) so "A@x.com" and "a@x.com" count as the same account
CREATE UNIQUE INDEX users_email_unique ON users (lower(email));

CREATE TABLE categories (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  module     module_type NOT NULL,
  name       TEXT        NOT NULL,
  sla_hours  INTEGER     NOT NULL CHECK (sla_hours > 0),  -- deadline to resolve
  UNIQUE (module, name)
);