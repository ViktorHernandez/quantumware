SET client_encoding TO 'UTF8';

CREATE TABLE IF NOT EXISTS resena (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    producto_id uuid NOT NULL REFERENCES producto (id) ON DELETE CASCADE,
    autor_sub uuid NOT NULL,
    puntuacion smallint NOT NULL,
    comentario text,
    compra_verificada boolean NOT NULL DEFAULT false,
    estado varchar(10) NOT NULL DEFAULT 'publicada',
    creado_en timestamptz NOT NULL DEFAULT now(),
    actualizado_en timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE resena DROP CONSTRAINT IF EXISTS resena_puntuacion_check;
ALTER TABLE resena ADD CONSTRAINT resena_puntuacion_check
    CHECK (puntuacion BETWEEN 1 AND 5);

ALTER TABLE resena DROP CONSTRAINT IF EXISTS resena_estado_check;
ALTER TABLE resena ADD CONSTRAINT resena_estado_check
    CHECK (estado IN ('publicada', 'oculta'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_resena_producto_autor
    ON resena (producto_id, autor_sub);
CREATE INDEX IF NOT EXISTS idx_resena_producto_estado
    ON resena (producto_id, estado, creado_en DESC);

CREATE TABLE IF NOT EXISTS resena_voto (
    resena_id uuid NOT NULL REFERENCES resena (id) ON DELETE CASCADE,
    votante_sub uuid NOT NULL,
    creado_en timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (resena_id, votante_sub)
);

CREATE TABLE IF NOT EXISTS resena_moderacion (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    resena_id uuid NOT NULL REFERENCES resena (id) ON DELETE CASCADE,
    admin_sub uuid NOT NULL,
    accion varchar(10) NOT NULL,
    motivo text,
    creado_en timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE resena_moderacion DROP CONSTRAINT IF EXISTS resena_moderacion_accion_check;
ALTER TABLE resena_moderacion ADD CONSTRAINT resena_moderacion_accion_check
    CHECK (accion IN ('ocultar', 'publicar'));

CREATE INDEX IF NOT EXISTS idx_resena_moderacion_resena
    ON resena_moderacion (resena_id, creado_en DESC);

CREATE TABLE IF NOT EXISTS schema_migrations (
    archivo text PRIMARY KEY,
    aplicada timestamptz NOT NULL DEFAULT now()
);
INSERT INTO schema_migrations (archivo) VALUES ('09_resenas.sql')
ON CONFLICT (archivo) DO NOTHING;
