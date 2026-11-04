-- Migração idempotente: preserva registros, sequências, IDs, índices e vínculos FK.
-- Uma transação única impede migração parcial.
BEGIN;
DO $migra$
DECLARE v_old text; v_new text;
BEGIN
 FOR v_old,v_new IN SELECT * FROM (VALUES
 ('users','usuarios'),
 ('one_time_tokens','tokens_acesso'),
 ('tickets','chamados'),
 ('interactions','interacoes'),
 ('attachments','anexos')
 ) AS m(origem,destino)
 LOOP
  IF to_regclass('public.'||v_old) IS NOT NULL THEN
   IF to_regclass('public.'||v_new) IS NOT NULL THEN
    RAISE EXCEPTION 'Migração interrompida: tabelas % e % coexistem. Conferir manualmente.',v_old,v_new;
   END IF;
   EXECUTE format('ALTER TABLE public.%I RENAME TO %I',v_old,v_new);
  END IF;
 END LOOP;
END
$migra$;

CREATE TABLE IF NOT EXISTS usuarios (
 id BIGSERIAL PRIMARY KEY, company_code TEXT NOT NULL, employee_id TEXT NOT NULL, name TEXT NOT NULL,
 email TEXT NOT NULL UNIQUE, passhash TEXT, role TEXT NOT NULL DEFAULT 'COLABORADOR' CHECK(role IN ('COLABORADOR','ANALISTA','ADMIN')),
 enabled BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(company_code,employee_id)
);
-- Cadastro: login individual; CPF armazenado como HMAC irreversível.
-- O e-mail pertence ao contato, não à identidade única.
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS users_email_key;
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_email_key;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS login TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS cpf_hash TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS employee_lookup TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS test_expires_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_usuarios_role_enabled ON usuarios(role,enabled);

-- Contas legadas recebem um login único e continuam com a mesma senha.
UPDATE usuarios SET login='usuario-'||id WHERE login IS NULL OR login='';
UPDATE usuarios SET employee_lookup=name WHERE employee_lookup IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_usuarios_login ON usuarios(login);
CREATE UNIQUE INDEX IF NOT EXISTS ux_usuarios_empresa_cpf ON usuarios(company_code,cpf_hash) WHERE cpf_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS tokens_acesso (
 id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
 token_hash TEXT NOT NULL UNIQUE, purpose TEXT NOT NULL CHECK(purpose IN ('ATIVACAO','RESET','CONVITE')),
 expires_at TIMESTAMPTZ NOT NULL, used_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS chamados (
 id BIGSERIAL PRIMARY KEY, requester_id BIGINT NOT NULL REFERENCES usuarios(id), company_code TEXT NOT NULL,
 category TEXT NOT NULL, subject TEXT NOT NULL, description TEXT NOT NULL,
 urgency TEXT NOT NULL DEFAULT 'NORMAL' CHECK(urgency IN ('BAIXA','NORMAL','ALTA','CRITICA')),
 status TEXT NOT NULL DEFAULT 'ABERTO' CHECK(status IN ('ABERTO','EM_ATENDIMENTO','AGUARDANDO_USUARIO','RESOLVIDO','CANCELADO')),
 assignee_id BIGINT REFERENCES usuarios(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 resolved_at TIMESTAMPTZ
);
ALTER TABLE chamados ADD COLUMN IF NOT EXISTS resolution_summary TEXT;
-- Prazo dos lembretes conta a partir da entrada no status Aguardando usuário,
-- não da criação nem de alterações comuns do chamado.
ALTER TABLE chamados ADD COLUMN IF NOT EXISTS waiting_since TIMESTAMPTZ;
ALTER TABLE chamados ADD COLUMN IF NOT EXISTS waiting_cycle BIGINT NOT NULL DEFAULT 0;
-- Chamados já aguardando na implantação iniciam um novo ciclo agora,
-- evitando envios retroativos em massa.
UPDATE chamados SET waiting_since=now(), waiting_cycle=waiting_cycle+1
WHERE status='AGUARDANDO_USUARIO' AND waiting_since IS NULL;
CREATE INDEX IF NOT EXISTS idx_chamados_aguardando_prazo
 ON chamados(waiting_since) WHERE status='AGUARDANDO_USUARIO';

CREATE TABLE IF NOT EXISTS lembretes_aguardando_usuario (
 ticket_id BIGINT NOT NULL REFERENCES chamados(id) ON DELETE CASCADE,
 waiting_cycle BIGINT NOT NULL,
 stage_hours SMALLINT NOT NULL CHECK(stage_hours IN (24,48)),
 recipient_email TEXT NOT NULL,
 sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(ticket_id,waiting_cycle,stage_hours)
);
CREATE INDEX IF NOT EXISTS idx_lembretes_aguardando_enviados
 ON lembretes_aguardando_usuario(sent_at DESC);

CREATE TABLE IF NOT EXISTS interacoes (
 id BIGSERIAL PRIMARY KEY, ticket_id BIGINT NOT NULL REFERENCES chamados(id), author_id BIGINT NOT NULL REFERENCES usuarios(id),
 kind TEXT NOT NULL, body TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Visibilidade explícita: mensagens antigas permanecem públicas.
ALTER TABLE interacoes ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'SOLICITANTE';
DO $visibility$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='interacoes_visibility_check' AND conrelid='interacoes'::regclass) THEN
  ALTER TABLE interacoes ADD CONSTRAINT interacoes_visibility_check CHECK (visibility IN ('SOLICITANTE','EQUIPE'));
 END IF;
END
$visibility$;

CREATE TABLE IF NOT EXISTS avaliacoes_chamados (
 ticket_id BIGINT PRIMARY KEY REFERENCES chamados(id) ON DELETE CASCADE,
 requester_id BIGINT NOT NULL REFERENCES usuarios(id),
 rating SMALLINT NOT NULL CHECK(rating BETWEEN 1 AND 5),
 solution_rating SMALLINT NOT NULL CHECK(solution_rating BETWEEN 1 AND 5),
 time_rating SMALLINT NOT NULL CHECK(time_rating BETWEEN 1 AND 5),
 comment TEXT NOT NULL DEFAULT '',
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_requester ON avaliacoes_chamados(requester_id,created_at DESC);

-- Compartilhamento: responsável continua único, colaboradores de TI adicionais podem acompanhar.
CREATE TABLE IF NOT EXISTS chamados_compartilhados (
 ticket_id BIGINT NOT NULL REFERENCES chamados(id) ON DELETE CASCADE,
 user_id BIGINT NOT NULL REFERENCES usuarios(id),
 added_by BIGINT NOT NULL REFERENCES usuarios(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(ticket_id,user_id)
);
CREATE INDEX IF NOT EXISTS idx_chamados_compartilhados_user ON chamados_compartilhados(user_id,ticket_id);

CREATE TABLE IF NOT EXISTS anexos (
 id BIGSERIAL PRIMARY KEY, ticket_id BIGINT NOT NULL REFERENCES chamados(id), interaction_id BIGINT REFERENCES interacoes(id),
 filename TEXT NOT NULL, mime TEXT NOT NULL, data BYTEA NOT NULL, uploaded_by BIGINT NOT NULL REFERENCES usuarios(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tickets_requester ON chamados(requester_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_assignee ON chamados(assignee_id,status);
CREATE INDEX IF NOT EXISTS idx_interactions_ticket ON interacoes(ticket_id,created_at);

COMMIT;
