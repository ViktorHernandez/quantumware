import { ConfigModule } from '@nestjs/config';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
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

const CLIENTE = '00000000-0000-0000-0000-0000000ca001';
const OTRO = '00000000-0000-0000-0000-0000000ca002';

describe('Checkout, pago simulado y seguimiento (integración)', () => {
  let modulo: TestingModule;
  let db: DatabaseService;
  let pedidos: PedidosService;
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
        PedidosService,
      ],
    }).compile();
    db = modulo.get(DatabaseService);
    pedidos = modulo.get(PedidosService);
    await limpiar();
    const p = await db.query<{ id: string }>(
      `INSERT INTO producto (nombre, precio, stock) VALUES ($1,$2,$3) RETURNING id`,
      ['ZZ_TEST_CHECKOUT', '100.00', 500],
    );
    productoId = p.rows[0].id;
  });

  afterAll(async () => {
    await limpiar();
    await db.query(`DELETE FROM producto WHERE nombre = 'ZZ_TEST_CHECKOUT'`);
    await modulo.close();
  });

  async function limpiar() {
    await db.query(`DELETE FROM pedido WHERE cliente_sub = ANY($1::uuid[])`, [
      [CLIENTE, OTRO],
    ]);
  }

  it('checkout crea pedido pendiente con evento inicial', async () => {
    const pedido = await pedidos.checkout(CLIENTE, {
      items: [{ producto_id: productoId, cantidad: 2 }],
    });
    expect(pedido.estado).toBe('registrado');
    expect(pedido.estado_pago).toBe('pendiente');
    const detalle = await pedidos.obtener(pedido.id, CLIENTE, false);
    expect(detalle.eventos.some((e) => e.estado === 'registrado')).toBe(true);
  });

  it('pago aprobado confirma el pedido y genera seguimiento', async () => {
    const pedido = await pedidos.checkout(CLIENTE, {
      items: [{ producto_id: productoId, cantidad: 1 }],
    });
    const pagado = await pedidos.pagar(pedido.id, CLIENTE, {
      metodo: 'tarjeta_credito',
      tarjeta_ultimos4: '1111',
    });
    expect(pagado.estado_pago).toBe('aprobado');
    expect(pagado.estado).toBe('pago_aprobado');
    expect(pagado.numero_seguimiento).toBeTruthy();
    expect(pagado.eventos.some((e) => e.estado === 'pago_aprobado')).toBe(true);
  });

  it('el pago aprobado es idempotente: un segundo intento no duplica la operación', async () => {
    const pedido = await pedidos.checkout(CLIENTE, {
      items: [{ producto_id: productoId, cantidad: 1 }],
    });
    const primero = await pedidos.pagar(pedido.id, CLIENTE, {
      metodo: 'tarjeta_debito',
      tarjeta_ultimos4: '4242',
    });
    const segundo = await pedidos.pagar(pedido.id, CLIENTE, {
      metodo: 'tarjeta_debito',
      tarjeta_ultimos4: '4242',
    });
    expect(segundo.numero_seguimiento).toBe(primero.numero_seguimiento);
    const eventosPago = segundo.eventos.filter(
      (e) => e.estado === 'pago_aprobado',
    );
    expect(eventosPago).toHaveLength(1);
  });

  it('un pago con tarjeta sin los últimos cuatro dígitos se rechaza con 400', async () => {
    const pedido = await pedidos.checkout(CLIENTE, {
      items: [{ producto_id: productoId, cantidad: 1 }],
    });
    await expect(
      pedidos.pagar(pedido.id, CLIENTE, { metodo: 'tarjeta_credito' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('pago rechazado no confirma el pedido', async () => {
    const pedido = await pedidos.checkout(CLIENTE, {
      items: [{ producto_id: productoId, cantidad: 1 }],
    });
    const r = await pedidos.pagar(pedido.id, CLIENTE, {
      metodo: 'tarjeta_credito',
      tarjeta_ultimos4: '0002',
    });
    expect(r.estado_pago).toBe('rechazado');
    expect(r.estado).toBe('registrado');
    expect(r.pagado_en).toBeNull();
  });

  it('tras un rechazo el titular puede reintentar y aprobar el pago', async () => {
    const pedido = await pedidos.checkout(CLIENTE, {
      items: [{ producto_id: productoId, cantidad: 1 }],
    });
    const rechazado = await pedidos.pagar(pedido.id, CLIENTE, {
      metodo: 'tarjeta_credito',
      tarjeta_ultimos4: '0002',
    });
    expect(rechazado.estado_pago).toBe('rechazado');
    const aprobado = await pedidos.pagar(pedido.id, CLIENTE, {
      metodo: 'tarjeta_credito',
      tarjeta_ultimos4: '1111',
    });
    expect(aprobado.estado_pago).toBe('aprobado');
    expect(aprobado.estado).toBe('pago_aprobado');
  });

  it('solo el titular puede pagar su pedido', async () => {
    const pedido = await pedidos.checkout(CLIENTE, {
      items: [{ producto_id: productoId, cantidad: 1 }],
    });
    await expect(
      pedidos.pagar(pedido.id, OTRO, { metodo: 'transferencia' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('idempotencia: el mismo checkout no duplica el pedido', async () => {
    const a = await pedidos.checkout(CLIENTE, {
      items: [{ producto_id: productoId, cantidad: 1 }],
      clave_idempotencia: 'K-TEST-1',
    });
    const b = await pedidos.checkout(CLIENTE, {
      items: [{ producto_id: productoId, cantidad: 1 }],
      clave_idempotencia: 'K-TEST-1',
    });
    expect(b.id).toBe(a.id);
  });

  it('las transiciones de estado inválidas se rechazan', async () => {
    const pedido = await pedidos.checkout(CLIENTE, {
      items: [{ producto_id: productoId, cantidad: 1 }],
    });
    await pedidos.pagar(pedido.id, CLIENTE, {
      metodo: 'transferencia',
    });
    await pedidos.cambiarEstado(pedido.id, 'procesando');
    await expect(
      pedidos.cambiarEstado(pedido.id, 'entregado'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('checkout respeta el límite de cantidad en modo corregido (PE-02 protegido)', async () => {
    await expect(
      pedidos.checkout(CLIENTE, {
        items: [{ producto_id: productoId, cantidad: 99999 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
