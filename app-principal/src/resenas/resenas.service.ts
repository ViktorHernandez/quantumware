import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CrearResenaDto } from './dto/crear-resena.dto';
import { ActualizarResenaDto } from './dto/actualizar-resena.dto';
import { ConsultaResenasDto } from './dto/consulta-resenas.dto';
import { ModerarResenaDto } from './dto/moderar-resena.dto';

interface FilaResena {
  id: string;
  producto_id: string;
  autor_sub: string;
  puntuacion: number;
  comentario: string | null;
  compra_verificada: boolean;
  estado: string;
  creado_en: string;
  actualizado_en: string;
  autor_nombre: string | null;
  util: number;
  voto_propio: boolean;
}

export interface ResenaPublica {
  id: string;
  puntuacion: number;
  comentario: string | null;
  compra_verificada: boolean;
  estado: string;
  creado_en: string;
  actualizado_en: string;
  autor: string;
  propia: boolean;
  util: number;
  voto_propio: boolean;
  autor_sub?: string;
}

export interface Resumen {
  total: number;
  promedio: number;
  distribucion: Record<string, number>;
}

const ORDEN_PERMITIDO: Record<string, string> = {
  fecha: 'r.creado_en',
  puntuacion: 'r.puntuacion',
  utilidad: 'util',
};

@Injectable()
export class ResenasService {
  constructor(private readonly db: DatabaseService) {}

  private mapear(
    fila: FilaResena,
    sub: string,
    esAdmin: boolean,
  ): ResenaPublica {
    const nombre = (fila.autor_nombre ?? '').trim();
    const salida: ResenaPublica = {
      id: fila.id,
      puntuacion: fila.puntuacion,
      comentario: fila.comentario,
      compra_verificada: fila.compra_verificada,
      estado: fila.estado,
      creado_en: fila.creado_en,
      actualizado_en: fila.actualizado_en,
      autor: nombre.length > 0 ? nombre : 'Cliente',
      propia: fila.autor_sub === sub,
      util: Number(fila.util),
      voto_propio: fila.voto_propio,
    };
    if (esAdmin) {
      salida.autor_sub = fila.autor_sub;
    }
    return salida;
  }

  private async productoExiste(productoId: string): Promise<string> {
    const r = await this.db.query<{ estado: string }>(
      'SELECT estado FROM producto WHERE id = $1',
      [productoId],
    );
    if (r.rowCount === 0) {
      throw new NotFoundException('Producto no encontrado.');
    }
    return r.rows[0].estado;
  }

  async resumen(productoId: string): Promise<Resumen> {
    const r = await this.db.query<{
      total: string;
      promedio: string | null;
      e1: string;
      e2: string;
      e3: string;
      e4: string;
      e5: string;
    }>(
      `SELECT count(*)::text AS total,
              round(avg(puntuacion)::numeric, 2)::text AS promedio,
              count(*) FILTER (WHERE puntuacion = 1)::text AS e1,
              count(*) FILTER (WHERE puntuacion = 2)::text AS e2,
              count(*) FILTER (WHERE puntuacion = 3)::text AS e3,
              count(*) FILTER (WHERE puntuacion = 4)::text AS e4,
              count(*) FILTER (WHERE puntuacion = 5)::text AS e5
       FROM resena
       WHERE producto_id = $1 AND estado = 'publicada'`,
      [productoId],
    );
    const fila = r.rows[0];
    return {
      total: Number(fila.total),
      promedio: fila.promedio ? Number(fila.promedio) : 0,
      distribucion: {
        '1': Number(fila.e1),
        '2': Number(fila.e2),
        '3': Number(fila.e3),
        '4': Number(fila.e4),
        '5': Number(fila.e5),
      },
    };
  }

  async miResena(
    productoId: string,
    sub: string,
    esAdmin: boolean,
  ): Promise<ResenaPublica | null> {
    const r = await this.db.query<FilaResena>(
      `SELECT r.id, r.producto_id, r.autor_sub, r.puntuacion, r.comentario,
              r.compra_verificada, r.estado, r.creado_en, r.actualizado_en,
              pu.nombre AS autor_nombre,
              (SELECT count(*) FROM resena_voto v WHERE v.resena_id = r.id)::int AS util,
              EXISTS(
                SELECT 1 FROM resena_voto v
                WHERE v.resena_id = r.id AND v.votante_sub = $2
              ) AS voto_propio
       FROM resena r
       LEFT JOIN perfil_usuario pu ON pu.user_id = r.autor_sub
       WHERE r.producto_id = $1 AND r.autor_sub = $2`,
      [productoId, sub],
    );
    if (r.rowCount === 0) {
      return null;
    }
    return this.mapear(r.rows[0], sub, esAdmin);
  }

  async listar(
    productoId: string,
    consulta: ConsultaResenasDto,
    sub: string,
    esAdmin: boolean,
  ) {
    await this.productoExiste(productoId);

    const filtroEstado = esAdmin ? '' : `AND r.estado = 'publicada'`;
    const columna = ORDEN_PERMITIDO[consulta.orden ?? 'fecha'] ?? 'r.creado_en';
    const direccion = consulta.direccion === 'asc' ? 'ASC' : 'DESC';
    const pagina = consulta.pagina ?? 1;
    const tamano = consulta.tamano ?? 10;
    const desplazamiento = (pagina - 1) * tamano;

    const total = await this.db.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM resena r
       WHERE r.producto_id = $1 ${filtroEstado}`,
      [productoId],
    );

    const filas = await this.db.query<FilaResena>(
      `SELECT r.id, r.producto_id, r.autor_sub, r.puntuacion, r.comentario,
              r.compra_verificada, r.estado, r.creado_en, r.actualizado_en,
              pu.nombre AS autor_nombre,
              (SELECT count(*) FROM resena_voto v WHERE v.resena_id = r.id)::int AS util,
              EXISTS(
                SELECT 1 FROM resena_voto v
                WHERE v.resena_id = r.id AND v.votante_sub = $2
              ) AS voto_propio
       FROM resena r
       LEFT JOIN perfil_usuario pu ON pu.user_id = r.autor_sub
       WHERE r.producto_id = $1 ${filtroEstado}
       ORDER BY ${columna} ${direccion}, r.creado_en DESC
       LIMIT ${tamano} OFFSET ${desplazamiento}`,
      [productoId, sub],
    );

    return {
      items: filas.rows.map((f) => this.mapear(f, sub, esAdmin)),
      total: Number(total.rows[0].n),
      pagina,
      tamano,
      resumen: await this.resumen(productoId),
      miResena: await this.miResena(productoId, sub, esAdmin),
    };
  }

  private async compraVerificada(
    sub: string,
    productoId: string,
  ): Promise<boolean> {
    const r = await this.db.query<{ existe: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM pedido pe
         JOIN detalle_pedido dp ON dp.pedido_id = pe.id
         WHERE pe.cliente_sub = $1
           AND dp.producto_id = $2
           AND pe.estado_pago = 'aprobado'
       ) AS existe`,
      [sub, productoId],
    );
    return r.rows[0].existe;
  }

  async crear(
    productoId: string,
    sub: string,
    esAdmin: boolean,
    dto: CrearResenaDto,
  ): Promise<ResenaPublica> {
    await this.productoExiste(productoId);
    const comentario = dto.comentario?.trim() || null;
    const verificada = await this.compraVerificada(sub, productoId);
    try {
      const r = await this.db.query<{ id: string }>(
        `INSERT INTO resena (producto_id, autor_sub, puntuacion, comentario, compra_verificada)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [productoId, sub, dto.puntuacion, comentario, verificada],
      );
      const creada = await this.miResena(productoId, sub, esAdmin);
      if (!creada) {
        throw new NotFoundException('No se pudo recuperar la reseña creada.');
      }
      void r;
      return creada;
    } catch (error) {
      if (
        error instanceof Error &&
        'code' in error &&
        (error as { code?: string }).code === '23505'
      ) {
        throw new ConflictException(
          'Ya publicaste una reseña para este producto. Puedes editarla en lugar de crear otra.',
        );
      }
      throw error;
    }
  }

  private async cargarPropiedad(
    resenaId: string,
  ): Promise<{ autor_sub: string; producto_id: string; estado: string }> {
    const r = await this.db.query<{
      autor_sub: string;
      producto_id: string;
      estado: string;
    }>('SELECT autor_sub, producto_id, estado FROM resena WHERE id = $1', [
      resenaId,
    ]);
    if (r.rowCount === 0) {
      throw new NotFoundException('Reseña no encontrada.');
    }
    return r.rows[0];
  }

  async actualizar(
    resenaId: string,
    sub: string,
    esAdmin: boolean,
    dto: ActualizarResenaDto,
  ): Promise<ResenaPublica> {
    const propiedad = await this.cargarPropiedad(resenaId);
    if (propiedad.autor_sub !== sub) {
      throw new ForbiddenException('Solo puedes editar tus propias reseñas.');
    }
    if (dto.puntuacion === undefined && dto.comentario === undefined) {
      throw new BadRequestException('No se indicaron cambios.');
    }
    const campos: string[] = [];
    const valores: unknown[] = [];
    let indice = 1;
    if (dto.puntuacion !== undefined) {
      campos.push(`puntuacion = $${indice}`);
      valores.push(dto.puntuacion);
      indice += 1;
    }
    if (dto.comentario !== undefined) {
      campos.push(`comentario = $${indice}`);
      valores.push(dto.comentario.trim() || null);
      indice += 1;
    }
    campos.push('actualizado_en = now()');
    valores.push(resenaId);
    await this.db.query(
      `UPDATE resena SET ${campos.join(', ')} WHERE id = $${indice}`,
      valores,
    );
    const actualizada = await this.miResena(
      propiedad.producto_id,
      sub,
      esAdmin,
    );
    if (!actualizada) {
      throw new NotFoundException('Reseña no encontrada.');
    }
    return actualizada;
  }

  async eliminar(
    resenaId: string,
    sub: string,
    esAdmin: boolean,
  ): Promise<{ id: string; eliminada: boolean }> {
    const propiedad = await this.cargarPropiedad(resenaId);
    if (propiedad.autor_sub !== sub && !esAdmin) {
      throw new ForbiddenException('Solo puedes eliminar tus propias reseñas.');
    }
    await this.db.query('DELETE FROM resena WHERE id = $1', [resenaId]);
    return { id: resenaId, eliminada: true };
  }

  async votarUtil(
    resenaId: string,
    sub: string,
  ): Promise<{ util: number; voto_propio: boolean }> {
    const propiedad = await this.cargarPropiedad(resenaId);
    if (propiedad.autor_sub === sub) {
      throw new ForbiddenException(
        'No puedes marcar como útil tu propia reseña.',
      );
    }
    const existente = await this.db.query(
      'SELECT 1 FROM resena_voto WHERE resena_id = $1 AND votante_sub = $2',
      [resenaId, sub],
    );
    let votoPropio: boolean;
    if (existente.rowCount && existente.rowCount > 0) {
      await this.db.query(
        'DELETE FROM resena_voto WHERE resena_id = $1 AND votante_sub = $2',
        [resenaId, sub],
      );
      votoPropio = false;
    } else {
      await this.db.query(
        'INSERT INTO resena_voto (resena_id, votante_sub) VALUES ($1, $2)',
        [resenaId, sub],
      );
      votoPropio = true;
    }
    const conteo = await this.db.query<{ n: string }>(
      'SELECT count(*)::text AS n FROM resena_voto WHERE resena_id = $1',
      [resenaId],
    );
    return { util: Number(conteo.rows[0].n), voto_propio: votoPropio };
  }

  async moderar(
    resenaId: string,
    adminSub: string,
    dto: ModerarResenaDto,
  ): Promise<ResenaPublica> {
    const propiedad = await this.cargarPropiedad(resenaId);
    const nuevoEstado = dto.accion === 'ocultar' ? 'oculta' : 'publicada';
    await this.db.transaction(async (client) => {
      await client.query('UPDATE resena SET estado = $1 WHERE id = $2', [
        nuevoEstado,
        resenaId,
      ]);
      await client.query(
        `INSERT INTO resena_moderacion (resena_id, admin_sub, accion, motivo)
         VALUES ($1, $2, $3, $4)`,
        [resenaId, adminSub, dto.accion, dto.motivo?.trim() || null],
      );
    });
    const r = await this.db.query<FilaResena>(
      `SELECT r.id, r.producto_id, r.autor_sub, r.puntuacion, r.comentario,
              r.compra_verificada, r.estado, r.creado_en, r.actualizado_en,
              pu.nombre AS autor_nombre,
              (SELECT count(*) FROM resena_voto v WHERE v.resena_id = r.id)::int AS util,
              false AS voto_propio
       FROM resena r
       LEFT JOIN perfil_usuario pu ON pu.user_id = r.autor_sub
       WHERE r.id = $1`,
      [resenaId],
    );
    void propiedad;
    return this.mapear(r.rows[0], adminSub, true);
  }
}
