SET client_encoding TO 'UTF8';

ALTER TABLE pedido DROP CONSTRAINT IF EXISTS pedido_estado_check;
ALTER TABLE pedido ADD CONSTRAINT pedido_estado_check CHECK (
    estado IN (
        'registrado', 'confirmado', 'pago_aprobado', 'procesando',
        'preparando', 'empaquetado', 'listo_envio', 'enviado',
        'en_transito', 'en_reparto', 'entregado', 'cancelado', 'devuelto'
    )
);

ALTER TABLE pedido ADD COLUMN IF NOT EXISTS estado_pago varchar(12) NOT NULL DEFAULT 'pendiente';
ALTER TABLE pedido DROP CONSTRAINT IF EXISTS pedido_estado_pago_check;
ALTER TABLE pedido ADD CONSTRAINT pedido_estado_pago_check
    CHECK (estado_pago IN ('pendiente', 'aprobado', 'rechazado'));
ALTER TABLE pedido ADD COLUMN IF NOT EXISTS metodo_pago varchar(30);
ALTER TABLE pedido ADD COLUMN IF NOT EXISTS referencia_pago varchar(40);
ALTER TABLE pedido ADD COLUMN IF NOT EXISTS tarjeta_ultimos4 varchar(4);
ALTER TABLE pedido ADD COLUMN IF NOT EXISTS numero_seguimiento varchar(30);
ALTER TABLE pedido ADD COLUMN IF NOT EXISTS pagado_en timestamptz;
ALTER TABLE pedido ADD COLUMN IF NOT EXISTS clave_idempotencia varchar(64);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pedido_idempotencia
    ON pedido (clave_idempotencia) WHERE clave_idempotencia IS NOT NULL;

CREATE TABLE IF NOT EXISTS pedido_evento (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    pedido_id uuid NOT NULL REFERENCES pedido (id) ON DELETE CASCADE,
    estado varchar(20) NOT NULL,
    nota text,
    creado_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pedido_evento_pedido ON pedido_evento (pedido_id, creado_en);

CREATE TABLE IF NOT EXISTS schema_migrations (
    archivo text PRIMARY KEY,
    aplicada timestamptz NOT NULL DEFAULT now()
);
INSERT INTO schema_migrations (archivo) VALUES ('08_pedidos_checkout_seguimiento.sql')
ON CONFLICT (archivo) DO NOTHING;
