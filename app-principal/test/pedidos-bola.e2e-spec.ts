import { ConfigModule } from '@nestjs/config';
import { ForbiddenException } from '@nestjs/common';
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

const PROPIETARIO = '00000000-0000-0000-0000-00000000b0a1';
const ATACANTE = '00000000-0000-0000-0000-00000000b0b2';

async function construir(modo: string) {
  process.env.VULN_MODE = modo;
  const modulo = await Test.createTestingModule({
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
  return modulo;
}

describe('PE-03 BOLA/IDOR en pedidos (integración)', () => {
  let modulo: TestingModule;
  let db: DatabaseService;
  let productoId: string;
  let pedidoPropietario: string;

  async function limpiar() {
    await db.query(
      `DELETE FROM detalle_pedido WHERE pedido_id IN
         (SELECT id FROM pedido WHERE cliente_sub = ANY($1::uuid[]))`,
      [[PROPIETARIO, ATACANTE]],
    );
    await db.query('DELETE FROM pedido WHERE cliente_sub = ANY($1::uuid[])', [
      [PROPIETARIO, ATACANTE],
    ]);
  }

  beforeAll(async () => {
    modulo = await construir('corregido');
    db = modulo.get(DatabaseService);
    const pedidos = modulo.get(PedidosService);
    await limpiar();
    const p = await db.query<{ id: string }>(
      `INSERT INTO producto (nombre, precio, stock) VALUES ($1,$2,$3) RETURNING id`,
      ['ZZ_TEST_BOLA', '10.00', 100],
    );
    productoId = p.rows[0].id;
    const pedido = await pedidos.crear(PROPIETARIO, {
      items: [{ producto_id: productoId, cantidad: 1 }],
    });
    pedidoPropietario = pedido.id;
  });

  afterAll(async () => {
    await limpiar();
    await db.query(`DELETE FROM producto WHERE nombre = 'ZZ_TEST_BOLA'`);
    await modulo.close();
  });

  it('modo corregido: el atacante NO puede leer el pedido de otro cliente (403)', async () => {
    const pedidos = modulo.get(PedidosService);
    await expect(
      pedidos.obtener(pedidoPropietario, ATACANTE, false),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('modo corregido: el cuerpo del error 403 no revela datos del pedido ni del propietario', async () => {
    const pedidos = modulo.get(PedidosService);
    let capturada: ForbiddenException | null = null;
    try {
      await pedidos.obtener(pedidoPropietario, ATACANTE, false);
    } catch (e) {
      capturada = e as ForbiddenException;
    }
    expect(capturada).toBeInstanceOf(ForbiddenException);
    const cuerpo = JSON.stringify(capturada?.getResponse() ?? {});
    expect(capturada?.getStatus()).toBe(403);
    expect(cuerpo).not.toContain(pedidoPropietario);
    expect(cuerpo).not.toContain(PROPIETARIO);
    expect(cuerpo.toLowerCase()).not.toContain('cliente_sub');
    expect(cuerpo.toLowerCase()).not.toContain('total');
    expect(cuerpo.toLowerCase()).not.toContain('select');
  });

  it('modo corregido: el atacante NO puede pagar el pedido de otro cliente (403)', async () => {
    const pedidos = modulo.get(PedidosService);
    await expect(
      pedidos.pagar(pedidoPropietario, ATACANTE, {
        metodo: 'tarjeta_credito',
        tarjeta_ultimos4: '4242',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('modo corregido: el propietario SÍ puede leer su propio pedido', async () => {
    const pedidos = modulo.get(PedidosService);
    const r = await pedidos.obtener(pedidoPropietario, PROPIETARIO, false);
    expect(r.id).toBe(pedidoPropietario);
  });

  it('modo vulnerable: el atacante SÍ accede al pedido de otro cliente (se reproduce BOLA)', async () => {
    const vuln = await construir('vulnerable');
    const pedidosVuln = vuln.get(PedidosService);
    const r = await pedidosVuln.obtener(pedidoPropietario, ATACANTE, false);
    expect(r.id).toBe(pedidoPropietario);
    expect(r.cliente_sub).toBe(PROPIETARIO);
    await vuln.close();
  });
});
