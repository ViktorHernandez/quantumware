import { ConfigModule } from '@nestjs/config';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService } from '../src/database/database.service';
import { ResenasService } from '../src/resenas/resenas.service';

process.env.DATABASE_HOST = process.env.DATABASE_HOST ?? 'localhost';
process.env.DATABASE_PORT = process.env.DATABASE_PORT ?? '5432';
process.env.DATABASE_NAME = process.env.DATABASE_NAME ?? 'quantumware';
process.env.DATABASE_USER = process.env.DATABASE_USER ?? 'quantumware_app';
process.env.DATABASE_PASSWORD = process.env.DATABASE_PASSWORD ?? 'lab_pw_local';

const CLIENTE_A = '00000000-0000-0000-0000-0000000000a1';
const CLIENTE_B = '00000000-0000-0000-0000-0000000000b2';
const ADMIN = '00000000-0000-0000-0000-0000000000ad';

describe('Sistema de reseñas (integración con base de datos local)', () => {
  let modulo: TestingModule;
  let db: DatabaseService;
  let resenas: ResenasService;
  let productoId: string;
  let productoCompradoId: string;

  async function limpiar() {
    await db.query(
      `DELETE FROM resena WHERE producto_id IN
         (SELECT id FROM producto WHERE nombre IN ('ZZ_RESENA','ZZ_RESENA_COMPRA'))`,
    );
    await db.query(
      `DELETE FROM detalle_pedido WHERE pedido_id IN
         (SELECT id FROM pedido WHERE cliente_sub = ANY($1::uuid[]))`,
      [[CLIENTE_A, CLIENTE_B, ADMIN]],
    );
    await db.query('DELETE FROM pedido WHERE cliente_sub = ANY($1::uuid[])', [
      [CLIENTE_A, CLIENTE_B, ADMIN],
    ]);
    await db.query(
      `DELETE FROM producto WHERE nombre IN ('ZZ_RESENA','ZZ_RESENA_COMPRA')`,
    );
  }

  beforeAll(async () => {
    process.env.VULN_MODE = 'corregido';
    modulo = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true })],
      providers: [DatabaseService, ResenasService],
    }).compile();
    db = modulo.get(DatabaseService);
    resenas = modulo.get(ResenasService);
    await limpiar();

    const p = await db.query<{ id: string }>(
      `INSERT INTO producto (nombre, precio, stock) VALUES ($1,$2,$3) RETURNING id`,
      ['ZZ_RESENA', '10.00', 100],
    );
    productoId = p.rows[0].id;

    const pc = await db.query<{ id: string }>(
      `INSERT INTO producto (nombre, precio, stock) VALUES ($1,$2,$3) RETURNING id`,
      ['ZZ_RESENA_COMPRA', '25.00', 100],
    );
    productoCompradoId = pc.rows[0].id;

    const pedido = await db.query<{ id: string }>(
      `INSERT INTO pedido (cliente_sub, total, estado, estado_pago)
       VALUES ($1, '25.00', 'pago_aprobado', 'aprobado') RETURNING id`,
      [CLIENTE_A],
    );
    await db.query(
      `INSERT INTO detalle_pedido (pedido_id, producto_id, cantidad, precio_unitario)
       VALUES ($1, $2, 1, '25.00')`,
      [pedido.rows[0].id, productoCompradoId],
    );
  });

  afterAll(async () => {
    await limpiar();
    await modulo.close();
  });

  it('un cliente puede publicar una reseña y queda marcada como propia', async () => {
    const r = await resenas.crear(productoId, CLIENTE_A, false, {
      puntuacion: 4,
      comentario: 'Buen producto de prueba.',
    });
    expect(r.puntuacion).toBe(4);
    expect(r.propia).toBe(true);
    expect(r.compra_verificada).toBe(false);
    expect(r.estado).toBe('publicada');
  });

  it('la reseña se marca como compra verificada si hay un pedido pagado del producto', async () => {
    const r = await resenas.crear(productoCompradoId, CLIENTE_A, false, {
      puntuacion: 5,
      comentario: 'Lo compré y funciona.',
    });
    expect(r.compra_verificada).toBe(true);
  });

  it('un cliente no puede publicar dos reseñas del mismo producto (409)', async () => {
    await expect(
      resenas.crear(productoId, CLIENTE_A, false, { puntuacion: 2 }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('el autor puede editar su propia reseña', async () => {
    const mia = await resenas.miResena(productoId, CLIENTE_A, false);
    expect(mia).not.toBeNull();
    const r = await resenas.actualizar(mia!.id, CLIENTE_A, false, {
      puntuacion: 3,
      comentario: 'Actualicé mi opinión.',
    });
    expect(r.puntuacion).toBe(3);
    expect(r.comentario).toBe('Actualicé mi opinión.');
  });

  it('un cliente no puede editar la reseña de otro (403)', async () => {
    const mia = await resenas.miResena(productoId, CLIENTE_A, false);
    await expect(
      resenas.actualizar(mia!.id, CLIENTE_B, false, { puntuacion: 1 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('el voto útil alterna y no permite votar la propia reseña', async () => {
    const mia = await resenas.miResena(productoId, CLIENTE_A, false);
    await expect(resenas.votarUtil(mia!.id, CLIENTE_A)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    const v1 = await resenas.votarUtil(mia!.id, CLIENTE_B);
    expect(v1).toEqual({ util: 1, voto_propio: true });
    const v2 = await resenas.votarUtil(mia!.id, CLIENTE_B);
    expect(v2).toEqual({ util: 0, voto_propio: false });
  });

  it('el resumen refleja promedio y distribución de reseñas publicadas', async () => {
    await resenas.crear(productoId, CLIENTE_B, false, { puntuacion: 5 });
    const resumen = await resenas.resumen(productoId);
    expect(resumen.total).toBe(2);
    expect(resumen.promedio).toBeCloseTo(4, 1);
    expect(resumen.distribucion['3']).toBe(1);
    expect(resumen.distribucion['5']).toBe(1);
  });

  it('la moderación oculta la reseña y registra trazabilidad sin alterar autor ni puntuación', async () => {
    const mia = await resenas.miResena(productoId, CLIENTE_A, false);
    const antes = mia!;
    const moderada = await resenas.moderar(mia!.id, ADMIN, {
      accion: 'ocultar',
      motivo: 'Prueba de moderación.',
    });
    expect(moderada.estado).toBe('oculta');
    expect(moderada.puntuacion).toBe(antes.puntuacion);
    expect(moderada.autor_sub).toBe(CLIENTE_A);

    const traza = await db.query<{ accion: string; admin_sub: string }>(
      'SELECT accion, admin_sub FROM resena_moderacion WHERE resena_id = $1',
      [mia!.id],
    );
    expect(traza.rowCount).toBe(1);
    expect(traza.rows[0].accion).toBe('ocultar');
    expect(traza.rows[0].admin_sub).toBe(ADMIN);

    const listadoCliente = await resenas.listar(
      productoId,
      {},
      CLIENTE_B,
      false,
    );
    const visible = listadoCliente.items.find((i) => i.id === mia!.id);
    expect(visible).toBeUndefined();
    expect(listadoCliente.resumen.total).toBe(1);

    const propia = await resenas.miResena(productoId, CLIENTE_A, false);
    expect(propia!.estado).toBe('oculta');
  });

  it('el administrador vuelve a publicar la reseña y la ve en su listado', async () => {
    const mia = await resenas.miResena(productoId, CLIENTE_A, true);
    await resenas.moderar(mia!.id, ADMIN, { accion: 'publicar' });
    const listadoAdmin = await resenas.listar(productoId, {}, ADMIN, true);
    const visible = listadoAdmin.items.find((i) => i.id === mia!.id);
    expect(visible).toBeDefined();
    expect(visible!.estado).toBe('publicada');
  });

  it('el administrador puede eliminar cualquier reseña', async () => {
    const mia = await resenas.miResena(productoId, CLIENTE_A, true);
    const r = await resenas.eliminar(mia!.id, ADMIN, true);
    expect(r.eliminada).toBe(true);
    const propia = await resenas.miResena(productoId, CLIENTE_A, false);
    expect(propia).toBeNull();
  });

  it('no se puede reseñar un producto inexistente (404)', async () => {
    await expect(
      resenas.crear('00000000-0000-0000-0000-0000000000ff', CLIENTE_A, false, {
        puntuacion: 5,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
