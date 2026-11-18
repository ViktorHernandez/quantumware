SET client_encoding TO 'UTF8';

CREATE TABLE IF NOT EXISTS invitacion (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email varchar(255) NOT NULL,
    rol varchar(10) NOT NULL DEFAULT 'cliente',
    estado varchar(10) NOT NULL DEFAULT 'pendiente',
    usuario_sub uuid,
    creada_por uuid NOT NULL,
    expira_en timestamptz NOT NULL,
    creado_en timestamptz NOT NULL DEFAULT now(),
    aceptada_en timestamptz
);

ALTER TABLE invitacion DROP CONSTRAINT IF EXISTS invitacion_rol_check;
ALTER TABLE invitacion ADD CONSTRAINT invitacion_rol_check
    CHECK (rol IN ('admin', 'cliente'));

ALTER TABLE invitacion DROP CONSTRAINT IF EXISTS invitacion_estado_check;
ALTER TABLE invitacion ADD CONSTRAINT invitacion_estado_check
    CHECK (estado IN ('pendiente', 'aceptada', 'revocada', 'expirada'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_invitacion_email_pendiente
    ON invitacion (lower(email)) WHERE estado = 'pendiente';
CREATE INDEX IF NOT EXISTS idx_invitacion_estado
    ON invitacion (estado, expira_en);

CREATE TABLE IF NOT EXISTS schema_migrations (
    archivo text PRIMARY KEY,
    aplicada timestamptz NOT NULL DEFAULT now()
);
INSERT INTO schema_migrations (archivo) VALUES ('11_invitaciones.sql')
ON CONFLICT (archivo) DO NOTHING;
