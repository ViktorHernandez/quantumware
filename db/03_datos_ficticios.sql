SET client_encoding TO 'UTF8';

INSERT INTO producto (nombre, descripcion, categoria, precio, stock, stock_minimo)
SELECT v.nombre, v.descripcion, v.categoria, v.precio, v.stock, v.stock_minimo
FROM (
 VALUES
 ('Teclado mecánico', 'Teclado mecánico de laboratorio para pruebas de QuantumWare', 'Periféricos', 450.00, 15, 5),
 ('Monitor de prueba 24″', 'Monitor de 24 pulgadas para el catálogo de pruebas', 'Monitores', 2300.00, 8, 10),
 ('Cable HDMI', 'Cable HDMI de ejemplo para el inventario de pruebas', 'Accesorios', 120.00, 50, 15)
) AS v (nombre, descripcion, categoria, precio, stock, stock_minimo)
WHERE NOT EXISTS (
 SELECT 1 FROM producto p WHERE p.nombre = v.nombre
);

UPDATE producto SET stock_minimo = 5 WHERE nombre = 'Teclado mecánico' AND stock_minimo = 0;
UPDATE producto SET stock_minimo = 10 WHERE nombre = 'Monitor de prueba 24″' AND stock_minimo = 0;
UPDATE producto SET stock_minimo = 15 WHERE nombre = 'Cable HDMI' AND stock_minimo = 0;
