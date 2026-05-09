-- SHIFT SOLVER AI — Auth tables (NextAuth v5 / Auth.js pg-adapter)

CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          TEXT,
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT,                          -- null si usa OAuth
    email_verified TIMESTAMPTZ,
    image         TEXT,
    restaurant_id  UUID REFERENCES restaurants(id),
    role          TEXT NOT NULL DEFAULT 'owner', -- owner | manager | viewer
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- NextAuth pg-adapter tables
CREATE TABLE IF NOT EXISTS accounts (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type                 TEXT NOT NULL,
    provider             TEXT NOT NULL,
    provider_account_id  TEXT NOT NULL,
    refresh_token        TEXT,
    access_token         TEXT,
    expires_at           BIGINT,
    token_type           TEXT,
    scope                TEXT,
    id_token             TEXT,
    session_state        TEXT,
    UNIQUE (provider, provider_account_id)
);

CREATE TABLE IF NOT EXISTS sessions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_token TEXT UNIQUE NOT NULL,
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires       TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS verification_tokens (
    identifier TEXT NOT NULL,
    token      TEXT NOT NULL,
    expires    TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (identifier, token)
);

CREATE INDEX IF NOT EXISTS users_email ON users (email);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user_id);
