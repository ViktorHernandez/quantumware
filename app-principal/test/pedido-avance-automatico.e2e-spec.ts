import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService } from '../src/database/database.service';
import { NotificacionesService } from '../src/notificaciones/notificaciones.service';
import { BrevoService } from '../src/correo/brevo.service';
import { CorreoSalidaService } from '../src/correo/correo-salida.service';
import { SupabaseAdminService } from '../src/usuarios/supabase-admin.service';
import { PedidosService } from '../src/pedidos/pedidos.service';

process.env.DATABASE_HOST = process.env.DATABASE_HOST ?? 'localhost';
process.env.DATABASE_NAME = process.env.DATABASE_NAME ?? 'quantumware';
process.env.DATABASE_USER = process.env.DATABASE_USER ?? 'quantumware_app';
process.env.DATABASE_PASSWORD = process.env.DATABASE_PASSWORD ?? 'lab_pw_local';
process.env.VULN_MODE = 'corregido';
process.env.CORREO_WORKER_ACTIVO = 'false';
process.env.PEDIDO_AVANCE_AUTOMATICO = 'true';
process.env.PEDIDO_AVANCE_SEGUNDOS = '3600';

const CLIENTE = '00000000-0000-0000-0000-0000000000a1';
const PAGO = { metodo: 'tarjeta_credito', tarjeta_ultimos4: '4242' };

describe('Avance automático y persistente de pedidos (integración)', () => {
  let modulo: TestingModule;
  let db: DatabaseService;
  let pedidos: PedidosService;
  let productoId: string;

  async function limpiar() {
    await db.query(
      `DELETE FROM movimiento_inventario WHERE producto_id IN (SELECT id FROM producto WHERE nombre LIKE 'ZZ_AV%')`,
    );
    await db.query('DELETE FROM pedido WHERE cliente_sub = $1', [CLIENTE]);
    await db.query(`DELETE FROM producto WHERE nombre LIKE 'ZZ_AV%'`);
  }

  async function estadoDe(id: string) {
    const r = await db.query<{ estado: string; avanza_en: string | null }>(
      'SELECT estado, avanza_en FROM pedido WHERE id = $1',
      [id],
    );
    return r.rows[0];
  }

  async function vencer(id: string) {
    await db.query(
      `UPDATE pedido SET avanza_en = now() - interval '1 second' WHERE id = $1`,
      [id],
    );
  }

  async function pedidoPagado() {
    const p = await pedidos.checkout(CLIENTE, {
      items: [{ producto_id: productoId, cantidad: 1 }],
    });
    await pedidos.pagar(p.id, CLIENTE, PAGO);
    return p.id;
  }

  beforeAll(async () => {
    modulo = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true })],
      providers: [
        DatabaseService,
        ConfigService,
        CorreoSalidaService,
        NotificacionesService,
        PedidosService,
        { provide: BrevoService, useValue: { configurado: () => false } },
        {
          provide: SupabaseAdminService,
          useValue: {
            configurado: () => false,
            usuariosPorId: () =>
              Promise.resolve(new Map<string, { email: string | null }>()),
          },
        },
      ],
    }).compile();
    db = modulo.get(DatabaseService);
    pedidos = modulo.get(PedidosService);
    await limpiar();
    const r = await db.query<{ id: string }>(
      `INSERT INTO producto (nombre, precio, stock) VALUES ('ZZ_AV_PROD','100.00',500) RETURNING id`,
    );
    productoId = r.rows[0].id;
  });

  afterAll(async () => {
    await limpiar();
    await modulo.close();
  });

  it('al aprobarse el pago queda programado el siguiente avance en la base de datos', async () => {
    const id = await pedidoPagado();
    const e = await estadoDe(id);
    expect(e.estado).toBe('pago_aprobado');
    expect(e.avanza_en).not.toBeNull();
  });

  it('no avanza antes de la fecha programada', async () => {
    const id = await pedidoPagado();
    const r = await pedidos.procesarTransicionesVencidas();
    const e = await estadoDe(id);
    expect(e.estado).toBe('pago_aprobado');
    expect(r.avances.some((a) => a.pedido === id)).toBe(false);
  });

  it('avanza una etapa cuando vence, respetando el orden y reprogramando la siguiente', async () => {
    const id = await pedidoPagado();
    await vencer(id);
    await pedidos.procesarTransicionesVencidas();
    const e = await estadoDe(id);
    expect(e.estado).toBe('procesando');
    expect(e.avanza_en).not.toBeNull();
  });

  it('no salta etapas ni duplica avances si se procesa varias veces seguidas', async () => {
    const id = await pedidoPagado();
    await vencer(id);
    await pedidos.procesarTransicionesVencidas();
    await pedidos.procesarTransicionesVencidas();
    await pedidos.procesarTransicionesVencidas();
    expect((await estadoDe(id)).estado).toBe('procesando');
    const ev = await db.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM pedido_evento WHERE pedido_id = $1 AND estado = 'procesando'`,
      [id],
    );
    expect(Number(ev.rows[0].n)).toBe(1);
  });

  it('recupera el retraso acumulado tras una interrupción y llega hasta entregado', async () => {
    const id = await pedidoPagado();
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
      await vencer(id);
      await pedidos.procesarTransicionesVencidas();
      expect((await estadoDe(id)).estado).toBe(esperado);
    }
    const final = await estadoDe(id);
    expect(final.estado).toBe('entregado');
    expect(final.avanza_en).toBeNull();
  });

  it('nunca avanza un pedido cuyo pago no está aprobado', async () => {
    const p = await pedidos.checkout(CLIENTE, {
      items: [{ producto_id: productoId, cantidad: 1 }],
    });
    await db.query(
      `UPDATE pedido SET avanza_en = now() - interval '1 hour' WHERE id = $1`,
      [p.id],
    );
    await pedidos.procesarTransicionesVencidas();
    expect((await estadoDe(p.id)).estado).toBe('registrado');
  });

  it('genera una notificación por cada cambio de estado, sin duplicados', async () => {
    const id = await pedidoPagado();
    await vencer(id);
    await pedidos.procesarTransicionesVencidas();
    await vencer(id);
    await pedidos.procesarTransicionesVencidas();
    const n = await db.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM notificacion
       WHERE user_id = $1 AND datos->>'pedido_id' = $2 AND tipo = 'pedido_estado'`,
      [CLIENTE, id],
    );
    expect(Number(n.rows[0].n)).toBe(2);
  });
});
