SET client_encoding TO 'UTF8';

UPDATE producto SET
    nombre = 'Teclado mecánico',
    descripcion = 'Teclado mecánico de laboratorio para pruebas de QuantumWare',
    categoria = 'Periféricos'
WHERE nombre LIKE 'Teclado mec%nico ficticio' AND nombre <> 'Teclado mecánico ficticio';

UPDATE producto SET
    nombre = 'Monitor de prueba 24″',
    descripcion = 'Monitor de 24 pulgadas para el catálogo de pruebas',
    categoria = 'Monitores'
WHERE nombre LIKE 'Monitor de prueba 24%' AND nombre <> 'Monitor de prueba 24″';

UPDATE producto SET
    descripcion = 'Cable HDMI de ejemplo para el inventario de pruebas',
    categoria = 'Accesorios'
WHERE nombre = 'Cable HDMI ficticio';

UPDATE producto SET categoria = 'Periféricos' WHERE categoria LIKE 'Perif%ricos' AND categoria <> 'Periféricos';

