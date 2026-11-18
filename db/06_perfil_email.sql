SET client_encoding TO 'UTF8';

ALTER TABLE perfil_usuario ADD COLUMN IF NOT EXISTS email varchar(255);
ALTER TABLE perfil_usuario ADD COLUMN IF NOT EXISTS creado timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_perfil_email ON perfil_usuario (email);
