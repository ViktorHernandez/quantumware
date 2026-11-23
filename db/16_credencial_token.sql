SET client_encoding TO 'UTF8';

CREATE TABLE IF NOT EXISTS credencial_token (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo varchar(12) NOT NULL,
    token_hash char(64) NOT NULL UNIQUE,
    email varchar(255) NOT NULL,
    usuario_sub uuid,
    rol varchar(10),
    invitacion_id uuid REFERENCES invitacion(id) ON DELETE CASCADE,
    expira_en timestamptz NOT NULL,
    usado_en timestamptz,
    anulado_en timestamptz,
    creado_en timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE credencial_token DROP CONSTRAINT IF EXISTS credencial_token_tipo_check;
ALTER TABLE credencial_token ADD CONSTRAINT credencial_token_tipo_check
    CHECK (tipo IN ('invitacion', 'recuperacion'));

ALTER TABLE credencial_token DROP CONSTRAINT IF EXISTS credencial_token_rol_check;
ALTER TABLE credencial_token ADD CONSTRAINT credencial_token_rol_check
    CHECK (rol IS NULL OR rol IN ('admin', 'cliente'));

CREATE INDEX IF NOT EXISTS idx_credencial_token_email
    ON credencial_token (lower(email), tipo, creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_credencial_token_vigente
    ON credencial_token (expira_en)
    WHERE usado_en IS NULL AND anulado_en IS NULL;

CREATE TABLE IF NOT EXISTS schema_migrations (
    archivo text PRIMARY KEY,
    aplicada timestamptz NOT NULL DEFAULT now()
);
INSERT INTO schema_migrations (archivo) VALUES ('16_credencial_token.sql')
ON CONFLICT (archivo) DO NOTHING;
