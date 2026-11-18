SET client_encoding TO 'UTF8';

INSERT INTO producto (nombre, descripcion, categoria, precio, stock, stock_minimo)
SELECT v.nombre, v.descripcion, v.categoria, v.precio, v.stock, v.stock_minimo
FROM (VALUES
  ('Teclado Nexus D01','Producto de demostración de QuantumWare (periféricos).','Periféricos',1936.76,8,8),
  ('Mouse Orbi D02','Producto de demostración de QuantumWare (periféricos).','Periféricos',302.29,2,3),
  ('Webcam Volt D03','Producto de demostración de QuantumWare (periféricos).','Periféricos',1476.58,11,3),
  ('Micrófono Cima D04','Producto de demostración de QuantumWare (periféricos).','Periféricos',302.89,19,15),
  ('Lector de huella Lumen D05','Producto de demostración de QuantumWare (periféricos).','Periféricos',1127.72,44,15),
  ('Tableta gráfica QW D06','Producto de demostración de QuantumWare (periféricos).','Periféricos',316.75,11,8),
  ('Monitor 24" Nexus D07','Producto de demostración de QuantumWare (monitores).','Monitores',3395.72,0,10),
  ('Monitor 27" Orbi D08','Producto de demostración de QuantumWare (monitores).','Monitores',573.34,5,5),
  ('Monitor curvo 32" Volt D09','Producto de demostración de QuantumWare (monitores).','Monitores',3095.42,1,3),
  ('Monitor portátil Cima D10','Producto de demostración de QuantumWare (monitores).','Monitores',174.92,27,8),
  ('Monitor 4K Lumen D11','Producto de demostración de QuantumWare (monitores).','Monitores',2907.81,47,10),
  ('SSD 500 GB QW D12','Producto de demostración de QuantumWare (almacenamiento).','Almacenamiento',197.03,18,10),
  ('SSD 1 TB Nexus D13','Producto de demostración de QuantumWare (almacenamiento).','Almacenamiento',1150.36,41,15),
  ('Disco 2 TB Orbi D14','Producto de demostración de QuantumWare (almacenamiento).','Almacenamiento',1407.69,0,3),
  ('Memoria USB 64 GB Volt D15','Producto de demostración de QuantumWare (almacenamiento).','Almacenamiento',123.87,8,8),
  ('Tarjeta microSD 128 GB Cima D16','Producto de demostración de QuantumWare (almacenamiento).','Almacenamiento',192.79,1,3),
  ('NVMe 2 TB Lumen D17','Producto de demostración de QuantumWare (almacenamiento).','Almacenamiento',445.81,21,8),
  ('Router dual banda QW D18','Producto de demostración de QuantumWare (redes).','Redes',582.63,15,8),
  ('Switch 8 puertos Nexus D19','Producto de demostración de QuantumWare (redes).','Redes',1540.49,33,15),
  ('Adaptador USB-Ethernet Orbi D20','Producto de demostración de QuantumWare (redes).','Redes',248.11,46,8),
  ('Repetidor Wi-Fi Volt D21','Producto de demostración de QuantumWare (redes).','Redes',331.82,0,3),
  ('Cable de red 3 m Cima D22','Producto de demostración de QuantumWare (redes).','Redes',340.60,8,8),
  ('Memoria RAM 8 GB Lumen D23','Producto de demostración de QuantumWare (componentes).','Componentes',743.77,3,5),
  ('Memoria RAM 16 GB QW D24','Producto de demostración de QuantumWare (componentes).','Componentes',329.95,42,10),
  ('Fuente 650 W Nexus D25','Producto de demostración de QuantumWare (componentes).','Componentes',238.24,43,5),
  ('Ventilador 120 mm Orbi D26','Producto de demostración de QuantumWare (componentes).','Componentes',1143.06,45,15),
  ('Pasta térmica Volt D27','Producto de demostración de QuantumWare (componentes).','Componentes',1469.82,16,5),
  ('Gabinete ATX Cima D28','Producto de demostración de QuantumWare (componentes).','Componentes',1198.44,0,3),
  ('Audífonos over-ear Lumen D29','Producto de demostración de QuantumWare (audio).','Audio',167.50,5,5),
  ('Audífonos in-ear QW D30','Producto de demostración de QuantumWare (audio).','Audio',3315.51,14,15),
  ('Bocina Bluetooth Nexus D31','Producto de demostración de QuantumWare (audio).','Audio',761.53,46,10),
  ('Barra de sonido Orbi D32','Producto de demostración de QuantumWare (audio).','Audio',492.40,13,3),
  ('Diadema con micrófono Volt D33','Producto de demostración de QuantumWare (audio).','Audio',2261.61,32,8),
  ('Cable HDMI 2 m Cima D34','Producto de demostración de QuantumWare (accesorios).','Accesorios',172.57,37,5),
  ('Cable USB-C 1 m Lumen D35','Producto de demostración de QuantumWare (accesorios).','Accesorios',130.89,0,8),
  ('Hub USB 4 puertos QW D36','Producto de demostración de QuantumWare (accesorios).','Accesorios',1262.87,15,15),
  ('Base enfriadora Nexus D37','Producto de demostración de QuantumWare (accesorios).','Accesorios',193.34,7,8),
  ('Soporte de monitor Orbi D38','Producto de demostración de QuantumWare (accesorios).','Accesorios',243.70,42,5),
  ('Limpiador de pantalla Volt D39','Producto de demostración de QuantumWare (accesorios).','Accesorios',3470.36,26,3),
  ('Impresora láser Cima D40','Producto de demostración de QuantumWare (impresión).','Impresión',858.70,30,8),
  ('Impresora tinta Lumen D41','Producto de demostración de QuantumWare (impresión).','Impresión',291.71,23,15),
  ('Tóner negro QW D42','Producto de demostración de QuantumWare (impresión).','Impresión',188.35,0,3),
  ('Cartucho color Nexus D43','Producto de demostración de QuantumWare (impresión).','Impresión',3220.93,5,5),
  ('Resma de papel Orbi D44','Producto de demostración de QuantumWare (impresión).','Impresión',257.99,14,15)
) AS v(nombre, descripcion, categoria, precio, stock, stock_minimo)
WHERE NOT EXISTS (SELECT 1 FROM producto p WHERE p.nombre = v.nombre);

DO $$
DECLARE
  demo_cliente uuid := '00000000-0000-0000-0000-0000000000de';
  demo_admin   uuid := '00000000-0000-0000-0000-0000000000ad';
  prod RECORD;
  nuevo_pedido uuid;
  cant int;
  i int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pedido WHERE cliente_sub = demo_cliente) THEN
    FOR i IN 1..12 LOOP
      INSERT INTO pedido (cliente_sub, estado, total, fecha)
      VALUES (demo_cliente,
              (ARRAY['registrado','confirmado','enviado','entregado','cancelado'])[1 + (i % 5)],
              0,
              now() - (i || ' days')::interval)
      RETURNING id INTO nuevo_pedido;
      FOR prod IN (SELECT id, precio FROM producto WHERE descripcion LIKE 'Producto de demostración%' ORDER BY random() LIMIT (1 + (i % 3))) LOOP
        cant := 1 + (i % 5);
        INSERT INTO detalle_pedido (pedido_id, producto_id, cantidad, precio_unitario)
        VALUES (nuevo_pedido, prod.id, cant, prod.precio);
      END LOOP;
      UPDATE pedido SET total = (SELECT COALESCE(SUM(cantidad*precio_unitario),0) FROM detalle_pedido WHERE pedido_id = nuevo_pedido)
      WHERE id = nuevo_pedido;
    END LOOP;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM movimiento_inventario WHERE usuario_sub = demo_admin) THEN
    FOR prod IN (SELECT id, stock FROM producto WHERE descripcion LIKE 'Producto de demostración%' ORDER BY random() LIMIT 20) LOOP
      INSERT INTO movimiento_inventario (producto_id, tipo, cantidad, stock_resultante, motivo, usuario_sub, fecha)
      VALUES (prod.id, 'entrada', 5, prod.stock, 'Recepción de demostración', demo_admin, now() - (random()*10 || ' days')::interval);
    END LOOP;
  END IF;
END $$;
