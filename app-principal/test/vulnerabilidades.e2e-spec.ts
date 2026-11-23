import { ConfigModule, ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService } from '../src/database/database.service';
import { NotificacionesService } from '../src/notificaciones/notificaciones.service';
import { SupabaseAdminService } from '../src/usuarios/supabase-admin.service';
import { BrevoService } from '../src/correo/brevo.service';
import { CorreoSalidaService } from '../src/correo/correo-salida.service';
import { ProductosService } from '../src/productos/productos.service';
import { PedidosService } from '../src/pedidos/pedidos.service';
import { DashboardService } from '../src/dashboard/dashboard.service';

process.env.DATABASE_HOST = process.env.DATABASE_HOST ?? 'localhost';
process.env.DATABASE_PORT = process.env.DATABASE_PORT ?? '5432';
process.env.DATABASE_NAME = process.env.DATABASE_NAME ?? 'quantumware';
process.env.DATABASE_USER = process.env.DATABASE_USER ?? 'quantumware_app';
process.env.DATABASE_PASSWORD = process.env.DATABASE_PASSWORD ?? 'lab_pw_local';

const CLIENTE = '00000000-0000-0000-0000-00000000f001';
const NOMBRE = 'ZZ_TEST_VULN_UNICO';

function configModo(modo: string): ConfigService {
  return {
    get: (clave: string, def?: string) => (clave === 'VULN_MODE' ? modo : def),
  } as unknown as ConfigService;
}

describe('Vulnerabilidades intencionales y regresión del dashboard', () => {
  let modulo: TestingModule;
  let db: DatabaseService;
  let notif: NotificacionesService;
  let dashboard: DashboardService;
  let productoId: string;

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
        DashboardService,
      ],
    }).compile();
    db = modulo.get(DatabaseService);
    notif = modulo.get(NotificacionesService);
    dashboard = modulo.get(DashboardService);
    await limpiar();
    const p = await db.query<{ id: string }>(
      `INSERT INTO producto (nombre, precio, stock) VALUES ($1,$2,$3) RETURNING id`,
      [NOMBRE, '10.00', 100],
    );
    productoId = p.rows[0].id;
  });

  afterAll(async () => {
    await limpiar();
    await db.query(`DELETE FROM producto WHERE nombre = $1`, [NOMBRE]);
    await modulo.close();
  });

  async function limpiar() {
    await db.query(
      `DELETE FROM detalle_pedido WHERE pedido_id IN
         (SELECT id FROM pedido WHERE cliente_sub = $1)`,
      [CLIENTE],
    );
    await db.query('DELETE FROM pedido WHERE cliente_sub = $1', [CLIENTE]);
  }

  it('PF-01 / PE-01: la inyección SQL solo altera resultados en modo vulnerable', async () => {
    const corregido = new ProductosService(db, configModo('corregido'), notif);
    const vulnerable = new ProductosService(
      db,
      configModo('vulnerable'),
      notif,
    );
    const carga = "%' OR '1'='1' --";

    const legitima = await corregido.buscar(NOMBRE);
    expect(legitima.length).toBeGreaterThanOrEqual(1);
    expect(legitima.every((p) => p.nombre.includes(NOMBRE))).toBe(true);

    const corregidoInj = await corregido.buscar(carga);
    expect(corregidoInj.length).toBe(0);

    const total = await db.query<{ n: string }>(
      'SELECT count(*)::text AS n FROM producto',
    );
    const vulnerableInj = await vulnerable.buscar(carga);
    expect(vulnerableInj.length).toBe(Number(total.rows[0].n));
    expect(vulnerableInj.length).toBeGreaterThan(corregidoInj.length);
  });

  it('PE-02: el límite de cantidad solo se omite en modo vulnerable', async () => {
    const corregido = new PedidosService(db, configModo('corregido'), notif);
    const vulnerable = new PedidosService(db, configModo('vulnerable'), notif);

    await expect(
      corregido.crear(CLIENTE, {
        items: [{ producto_id: productoId, cantidad: 99999 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    const pedido = await vulnerable.crear(CLIENTE, {
      items: [{ producto_id: productoId, cantidad: 99999 }],
    });
    const detalle = await db.query<{ cantidad: number }>(
      'SELECT cantidad FROM detalle_pedido WHERE pedido_id = $1',
      [pedido.id],
    );
    expect(detalle.rows[0].cantidad).toBe(99999);
  });

  it('regresión dashboard: resumen entrega arreglos para admin y cliente', async () => {
    const admin = await dashboard.resumen(CLIENTE, true);
    expect(Array.isArray(admin.seriePedidos)).toBe(true);
    expect(Array.isArray(admin.pedidosPorEstado)).toBe(true);

    const cliente = await dashboard.resumen(CLIENTE, false);
    expect(Array.isArray(cliente.seriePedidos)).toBe(true);
    expect(Array.isArray(cliente.pedidosPorEstado)).toBe(true);
  });
});
