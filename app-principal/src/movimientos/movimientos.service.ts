import { BadRequestException, Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { CrearMovimientoDto } from './dto/crear-movimiento.dto';
import { ConsultaMovimientosDto } from './dto/consulta-movimientos.dto';

export interface MovimientoCreado {
  id: string;
  producto_id: string;
  tipo: string;
  cantidad: number;
  stock_resultante: number;
  motivo: string | null;
  usuario_sub: string;
  fecha: Date;
}

@Injectable()
export class MovimientosService {
  constructor(
    private readonly db: DatabaseService,
    private readonly notificaciones: NotificacionesService,
  ) {}

  async listar(consulta: ConsultaMovimientosDto) {
    const condiciones: string[] = [];
    const valores: unknown[] = [];
    if (consulta.producto_id) {
      valores.push(consulta.producto_id);
      condiciones.push(`m.producto_id = $${valores.length}`);
    }
    if (consulta.tipo) {
      valores.push(consulta.tipo);
      condiciones.push(`m.tipo = $${valores.length}`);
    }
    const where = condiciones.length
      ? `WHERE ${condiciones.join(' AND ')}`
      : '';
    const tamano = consulta.tamano ?? 10;
    const pagina = consulta.pagina ?? 1;
    const desplazamiento = (pagina - 1) * tamano;

    const total = await this.db.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM movimiento_inventario m ${where}`,
      valores,
    );
    const r = await this.db.query(
      `SELECT m.id, m.producto_id, p.nombre, m.tipo, m.cantidad,
              m.stock_resultante, m.motivo, m.usuario_sub, m.fecha
       FROM movimiento_inventario m
       LEFT JOIN producto p ON p.id = m.producto_id
       ${where}
       ORDER BY m.fecha DESC
       LIMIT ${tamano} OFFSET ${desplazamiento}`,
      valores,
    );
    return {
      items: r.rows,
      total: Number(total.rows[0].n),
      pagina,
      tamano,
    };
  }

  async crear(dto: CrearMovimientoDto, sub: string): Promise<MovimientoCreado> {
    return this.db.transaction<MovimientoCreado>(async (client: PoolClient) => {
      const prod = await client.query<{
        id: string;
        nombre: string;
        stock: number;
        stock_minimo: number;
      }>(
        'SELECT id, nombre, stock, stock_minimo FROM producto WHERE id = $1 FOR UPDATE',
        [dto.producto_id],
      );
      if (prod.rowCount === 0) {
        throw new BadRequestException('Producto inexistente.');
      }
      const actual = prod.rows[0].stock;
      let resultante: number;
      if (dto.tipo === 'entrada') {
        resultante = actual + dto.cantidad;
      } else if (dto.tipo === 'salida') {
        resultante = actual - dto.cantidad;
        if (resultante < 0) {
          throw new BadRequestException(
            'Las existencias no pueden quedar por debajo de cero.',
          );
        }
      } else {
        resultante = dto.cantidad;
      }

      await client.query('UPDATE producto SET stock = $1 WHERE id = $2', [
        resultante,
        dto.producto_id,
      ]);
      const mov = await client.query<MovimientoCreado>(
        `INSERT INTO movimiento_inventario
           (producto_id, tipo, cantidad, stock_resultante, motivo, usuario_sub)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, producto_id, tipo, cantidad, stock_resultante, motivo, usuario_sub, fecha`,
        [
          dto.producto_id,
          dto.tipo,
          dto.cantidad,
          resultante,
          dto.motivo ?? null,
          sub,
        ],
      );
      await this.notificaciones.crearParaAdmins(
        {
          tipo: 'movimiento_inventario',
          titulo: 'Movimiento de inventario',
          mensaje: `${dto.tipo} de ${dto.cantidad} en "${prod.rows[0].nombre}". Existencias: ${resultante}.`,
          datos: { producto_id: dto.producto_id, tipo: dto.tipo },
        },
        client,
      );
      await this.notificaciones.alertaExistencias(
        {
          id: prod.rows[0].id,
          nombre: prod.rows[0].nombre,
          stock: resultante,
          stock_minimo: prod.rows[0].stock_minimo,
        },
        client,
      );
      return mov.rows[0];
    });
  }
}
