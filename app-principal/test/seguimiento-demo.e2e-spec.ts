import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService } from '../src/database/database.service';
import { NotificacionesService } from '../src/notificaciones/notificaciones.service';
import { SupabaseAdminService } from '../src/usuarios/supabase-admin.service';
import { BrevoService } from '../src/correo/brevo.service';
import { CorreoSalidaService } from '../src/correo/correo-salida.service';
import { PedidosService } from '../src/pedidos/pedidos.service';

process.env.DATABASE_HOST = process.env.DATABASE_HOST ?? 'localhost';
process.env.DATABASE_PORT = process.env.DATABASE_PORT ?? '5432';
process.env.DATABASE_NAME = process.env.DATABASE_NAME ?? 'quantumware';
process.env.DATABASE_USER = process.env.DATABASE_USER ?? 'quantumware_app';
process.env.DATABASE_PASSWORD = process.env.DATABASE_PASSWORD ?? 'lab_pw_local';
process.env.VULN_MODE = 'corregido';

const CLIENTE = '00000000-0000-0000-0000-00000000de01';

describe('Modo demostración de seguimiento (integración)', () => {
  let modulo: TestingModule;
  let db: DatabaseService;
  let pedidos: PedidosService;
  let productoId: string;

  async function limpiar() {
    await db.query('DELETE FROM pedido WHERE cliente_sub = $1', [CLIENTE]);
    await db.query(`DELETE FROM producto WHERE nombre = 'ZZ_DEMO_SEG'`);
  }

  beforeAll(async () => {
    modulo = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true })],
      providers: [
        {
          provide: SupabaseAdminService,
          useValue: {
            configurado: () => false,
            usuariosPorId: () =>
              Promise.resolve(new Map<string, { email: string | null }>()),
          },
        },
        DatabaseService,
        NotificacionesService,
        BrevoService,
        CorreoSalidaService,
        PedidosService,
      ],
    }).compile();
    db = modulo.get(DatabaseService);
    pedidos = modulo.get(PedidosService);
    await limpiar();
    const p = await db.query<{ id: string }>(
      `INSERT INTO producto (nombre, precio, stock) VALUES ($1,$2,$3) RETURNING id`,
      ['ZZ_DEMO_SEG', '50.00', 100],
    );
    productoId = p.rows[0].id;
  });

  afterAll(async () => {
    await limpiar();
    await modulo.close();
  });

  it('avanza un pedido pagado a lo largo de la secuencia hasta entregado, con notas de demostración', async () => {
    const pedido = await pedidos.checkout(CLIENTE, {
      items: [{ producto_id: productoId, cantidad: 1 }],
    });
    await pedidos.pagar(pedido.id, CLIENTE, {
      metodo: 'tarjeta_credito',
      tarjeta_ultimos4: '4242',
    });

    const secuencia = [
      'procesando',
      'preparando',
      'empaquetado',
      'listo_envio',
      'enviado',
      'en_transito',
      'en_reparto',
      'entregado',
    ];
    for (const esperado of secuencia) {
      const siguiente = await pedidos.avanzarDemo(pedido.id);
      expect(siguiente).toBe(esperado);
    }

    const tope = await pedidos.avanzarDemo(pedido.id);
    expect(tope).toBeNull();

    const detalle = await pedidos.obtener(pedido.id, CLIENTE, true);
    expect(detalle.estado).toBe('entregado');
    const eventosDemo = detalle.eventos.filter((e) =>
      (e.nota ?? '').includes('[Demostración]'),
    );
    expect(eventosDemo.length).toBe(8);
  });

  it('no avanza un pedido no pagado', async () => {
    const pedido = await pedidos.checkout(CLIENTE, {
      items: [{ producto_id: productoId, cantidad: 1 }],
    });
    const r = await pedidos.avanzarDemo(pedido.id);
    expect(r).toBeNull();
  });
});
