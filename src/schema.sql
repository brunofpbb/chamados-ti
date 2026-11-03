CREATE TABLE IF NOT EXISTS users (
 id BIGSERIAL PRIMARY KEY, company_code TEXT NOT NULL, employee_id TEXT NOT NULL, name TEXT NOT NULL,
 email TEXT NOT NULL UNIQUE, passhash TEXT, role TEXT NOT NULL DEFAULT 'COLABORADOR' CHECK(role IN ('COLABORADOR','ANALISTA','ADMIN')),
 enabled BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(company_code,employee_id)
);
CREATE TABLE IF NOT EXISTS one_time_tokens (
 id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 token_hash TEXT NOT NULL UNIQUE, purpose TEXT NOT NULL CHECK(purpose IN ('ATIVACAO','RESET','CONVITE')),
 expires_at TIMESTAMPTZ NOT NULL, used_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS tickets (
 id BIGSERIAL PRIMARY KEY, requester_id BIGINT NOT NULL REFERENCES users(id), company_code TEXT NOT NULL,
 category TEXT NOT NULL, subject TEXT NOT NULL, description TEXT NOT NULL,
 urgency TEXT NOT NULL DEFAULT 'NORMAL' CHECK(urgency IN ('BAIXA','NORMAL','ALTA','CRITICA')),
 status TEXT NOT NULL DEFAULT 'ABERTO' CHECK(status IN ('ABERTO','EM_ATENDIMENTO','AGUARDANDO_USUARIO','RESOLVIDO','CANCELADO')),
 assignee_id BIGINT REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 resolved_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS interactions (
 id BIGSERIAL PRIMARY KEY, ticket_id BIGINT NOT NULL REFERENCES tickets(id), author_id BIGINT NOT NULL REFERENCES users(id),
 kind TEXT NOT NULL, body TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS attachments (
 id BIGSERIAL PRIMARY KEY, ticket_id BIGINT NOT NULL REFERENCES tickets(id), interaction_id BIGINT REFERENCES interactions(id),
 filename TEXT NOT NULL, mime TEXT NOT NULL, data BYTEA NOT NULL, uploaded_by BIGINT NOT NULL REFERENCES users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tickets_requester ON tickets(requester_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_assignee ON tickets(assignee_id,status);
CREATE INDEX IF NOT EXISTS idx_interactions_ticket ON interactions(ticket_id,created_at);
