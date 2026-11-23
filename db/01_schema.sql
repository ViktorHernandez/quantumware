SET client_encoding TO 'UTF8';

CREATE TABLE IF NOT EXISTS producto (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre varchar(120) NOT NULL,
    descripcion text,
    categoria varchar(60),
    precio numeric(10, 2) NOT NULL CHECK (precio >= 0),
    stock integer NOT NULL CHECK (stock >= 0)
);

ALTER TABLE producto ADD COLUMN IF NOT EXISTS stock_minimo integer NOT NULL DEFAULT 0;
ALTER TABLE producto DROP CONSTRAINT IF EXISTS producto_stock_minimo_check;
ALTER TABLE producto ADD CONSTRAINT producto_stock_minimo_check CHECK (stock_minimo >= 0);

CREATE TABLE IF NOT EXISTS pedido (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_sub uuid NOT NULL,
    fecha timestamptz NOT NULL DEFAULT now(),
    estado varchar(20) NOT NULL DEFAULT 'registrado',
    total numeric(12, 2) NOT NULL CHECK (total >= 0)
);

ALTER TABLE pedido DROP CONSTRAINT IF EXISTS pedido_estado_check;
ALTER TABLE pedido ADD CONSTRAINT pedido_estado_check
    CHECK (estado IN ('registrado', 'confirmado', 'enviado', 'entregado', 'cancelado'));

CREATE TABLE IF NOT EXISTS detalle_pedido (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    pedido_id uuid NOT NULL REFERENCES pedido (id) ON DELETE CASCADE,
    producto_id uuid NOT NULL REFERENCES producto (id),
    cantidad integer NOT NULL CHECK (cantidad > 0),
    precio_unitario numeric(10, 2) NOT NULL CHECK (precio_unitario >= 0)
);

CREATE TABLE IF NOT EXISTS user_roles (
    user_id uuid PRIMARY KEY,
    rol varchar(20) NOT NULL CHECK (rol IN ('admin', 'cliente'))
);

CREATE TABLE IF NOT EXISTS perfil_usuario (
    user_id uuid PRIMARY KEY,
    nombre varchar(120),
    telefono varchar(30),
    actualizado timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS movimiento_inventario (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    producto_id uuid NOT NULL REFERENCES producto (id) ON DELETE CASCADE,
    tipo varchar(10) NOT NULL CHECK (tipo IN ('entrada', 'salida', 'ajuste')),
    cantidad integer NOT NULL CHECK (cantidad > 0),
    stock_resultante integer NOT NULL CHECK (stock_resultante >= 0),
    motivo varchar(200),
    usuario_sub uuid NOT NULL,
    fecha timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_detalle_pedido_pedido ON detalle_pedido (pedido_id);
CREATE INDEX IF NOT EXISTS idx_detalle_pedido_producto ON detalle_pedido (producto_id);
CREATE INDEX IF NOT EXISTS idx_pedido_cliente ON pedido (cliente_sub);
CREATE INDEX IF NOT EXISTS idx_pedido_estado ON pedido (estado);
CREATE INDEX IF NOT EXISTS idx_producto_nombre ON producto (nombre);
CREATE INDEX IF NOT EXISTS idx_producto_categoria ON producto (categoria);
CREATE INDEX IF NOT EXISTS idx_movimiento_producto ON movimiento_inventario (producto_id);
CREATE INDEX IF NOT EXISTS idx_movimiento_fecha ON movimiento_inventario (fecha DESC);
