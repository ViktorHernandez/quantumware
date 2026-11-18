SET client_encoding TO 'UTF8';

INSERT INTO producto (nombre, descripcion, categoria, precio, stock, stock_minimo)
SELECT v.nombre, v.descripcion, v.categoria, v.precio, v.stock, v.stock_minimo
FROM (
 VALUES
 ('Teclado compacto', 'Teclado 60% de laboratorio para pruebas de QuantumWare', 'Periféricos', 520.00, 12, 5),
 ('Mouse óptico', 'Mouse de ejemplo para el catálogo de pruebas', 'Periféricos', 180.00, 25, 8),
 ('Monitor curvo 27″', 'Monitor de 27 pulgadas para el catálogo', 'Monitores', 3900.00, 6, 4),
 ('Monitor portátil 15″', 'Monitor portátil de ejemplo para pruebas', 'Monitores', 2600.00, 4, 5),
 ('Cable DisplayPort', 'Cable DisplayPort de ejemplo para el inventario', 'Accesorios', 150.00, 40, 15),
 ('Hub USB-C', 'Hub USB-C de laboratorio con puertos', 'Accesorios', 410.00, 18, 6),
 ('SSD NVMe 1 TB', 'Unidad de estado sólido para pruebas', 'Almacenamiento', 1250.00, 20, 6),
 ('Disco externo 2 TB', 'Disco externo de ejemplo para el catálogo', 'Almacenamiento', 1650.00, 9, 4),
 ('Memoria USB 64 GB', 'Memoria USB de laboratorio para pruebas', 'Almacenamiento', 220.00, 50, 20),
 ('Router de prueba', 'Router de laboratorio para el catálogo de pruebas', 'Redes', 980.00, 7, 3),
 ('Switch de red 8 puertos', 'Switch de ejemplo para el inventario de pruebas', 'Redes', 760.00, 5, 3),
 ('Tarjeta de red', 'Adaptador de red de laboratorio para pruebas', 'Redes', 340.00, 14, 5),
 ('Memoria RAM 16 GB', 'Módulo de memoria para el catálogo', 'Componentes', 1100.00, 16, 6),
 ('Fuente de poder 650 W', 'Fuente de poder de ejemplo para pruebas', 'Componentes', 1450.00, 8, 3),
 ('Ventilador 120 mm', 'Ventilador de laboratorio para el inventario', 'Componentes', 190.00, 30, 10),
 ('Audífonos', 'Audífonos de ejemplo para el catálogo de pruebas', 'Audio', 640.00, 22, 8),
 ('Micrófono USB', 'Micrófono de laboratorio para pruebas', 'Audio', 880.00, 11, 4),
 ('Bocina compacta', 'Bocina de ejemplo para el inventario de pruebas', 'Audio', 560.00, 13, 5)
) AS v (nombre, descripcion, categoria, precio, stock, stock_minimo)
WHERE NOT EXISTS (
 SELECT 1 FROM producto p WHERE p.nombre = v.nombre
);
