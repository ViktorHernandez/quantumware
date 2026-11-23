import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

interface RangoSerie {
  inicio: string;
  fin: string;
  paso: string;
  formato: string;
  union: string;
}

const RANGOS: Record<string, RangoSerie> = {
  '1d': {
    inicio: "date_trunc('hour', now()) - interval '23 hours'",
    fin: "date_trunc('hour', now())",
    paso: '1 hour',
    formato: 'HH24:00',
    union: "date_trunc('hour', p.fecha) = g.punto",
  },
  '7d': {
    inicio: "current_date - interval '6 days'",
    fin: 'current_date',
    paso: '1 day',
    formato: 'DD/MM',
    union: 'p.fecha::date = g.punto::date',
  },
  '30d': {
    inicio: "current_date - interval '29 days'",
    fin: 'current_date',
    paso: '1 day',
    formato: 'DD/MM',
    union: 'p.fecha::date = g.punto::date',
  },
  '90d': {
    inicio: "date_trunc('week', current_date) - interval '11 weeks'",
    fin: "date_trunc('week', current_date)",
    paso: '1 week',
    formato: '"sem" DD/MM',
    union: "date_trunc('week', p.fecha) = g.punto",
  },
};

@Injectable()
export class DashboardService {
  constructor(private readonly db: DatabaseService) {}

  async seriePedidos(sub: string, esAdmin: boolean, rango: string) {
    const cfg = RANGOS[rango] ?? RANGOS['7d'];
    const rangoEfectivo = RANGOS[rango] ? rango : '7d';
    const subFiltro = esAdmin ? null : sub;
    const valores = subFiltro ? [subFiltro] : [];
    const condicion = subFiltro ? 'AND p.cliente_sub = $1' : '';
    const r = await this.db.query<{ etiqueta: string; n: number }>(
      `SELECT to_char(g.punto, '${cfg.formato}') AS etiqueta,
              count(p.id)::int AS n
       FROM generate_series(${cfg.inicio}, ${cfg.fin}, interval '${cfg.paso}') AS g(punto)
       LEFT JOIN pedido p ON ${cfg.union} ${condicion}
       GROUP BY g.punto
       ORDER BY g.punto`,
      valores,
    );
    return { rango: rangoEfectivo, puntos: r.rows };
  }

  private async serieUltimos7Dias(subFiltro: string | null) {
    const valores = subFiltro ? [subFiltro] : [];
    const condicion = subFiltro ? 'AND p.cliente_sub = $1' : '';
    const r = await this.db.query<{ dia: string; n: number }>(
      `SELECT to_char(d.dia, 'YYYY-MM-DD') AS dia,
              count(p.id)::int AS n
       FROM generate_series(current_date - interval '6 days', current_date, interval '1 day') AS d(dia)
       LEFT JOIN pedido p ON p.fecha::date = d.dia::date ${condicion}
       GROUP BY d.dia
       ORDER BY d.dia`,
      valores,
    );
    return r.rows;
  }

  async analisisInventario() {
    const porCategoria = await this.db.query(
      `SELECT COALESCE(categoria, 'Sin categoría') AS categoria,
              count(*)::int AS productos,
              COALESCE(sum(stock), 0)::int AS unidades,
              COALESCE(sum(precio * stock), 0)::text AS valor
       FROM producto
       GROUP BY COALESCE(categoria, 'Sin categoría')
       ORDER BY sum(precio * stock) DESC NULLS LAST`,
    );
    const topProductos = await this.db.query(
      `SELECT id, nombre, categoria, precio, stock,
              (precio * stock)::text AS valor
       FROM producto
       ORDER BY precio * stock DESC
       LIMIT 10`,
    );
    const totales = await this.db.query<{
      valor: string;
      unidades: number;
      productos: number;
    }>(
      `SELECT COALESCE(sum(precio * stock), 0)::text AS valor,
              COALESCE(sum(stock), 0)::int AS unidades,
              count(*)::int AS productos
       FROM producto`,
    );
    return {
      totalValor: totales.rows[0].valor,
      totalUnidades: totales.rows[0].unidades,
      totalProductos: totales.rows[0].productos,
      porCategoria: porCategoria.rows,
      topProductos: topProductos.rows,
    };
  }

  async resumen(sub: string, esAdmin: boolean) {
    const serie = await this.serieUltimos7Dias(esAdmin ? null : sub);

    if (!esAdmin) {
      const propios = await this.db.query<{
        total: number;
        importe: string;
      }>(
        `SELECT count(*)::int AS total, COALESCE(sum(total), 0)::text AS importe
         FROM pedido WHERE cliente_sub = $1`,
        [sub],
      );
      const porEstado = await this.db.query<{ estado: string; n: number }>(
        `SELECT estado, count(*)::int AS n FROM pedido
         WHERE cliente_sub = $1 GROUP BY estado ORDER BY estado`,
        [sub],
      );
      const recientes = await this.db.query(
        `SELECT id, fecha, estado, total FROM pedido
         WHERE cliente_sub = $1 ORDER BY fecha DESC LIMIT 5`,
        [sub],
      );
      const catalogo = await this.db.query<{ n: number }>(
        'SELECT count(*)::int AS n FROM producto',
      );
      return {
        rol: 'cliente',
        misPedidos: propios.rows[0].total,
        miImporteTotal: propios.rows[0].importe,
        pedidosPorEstado: porEstado.rows,
        pedidosRecientes: recientes.rows,
        productosEnCatalogo: catalogo.rows[0].n,
        seriePedidos: serie,
      };
    }

    const inventario = await this.db.query<{
      total: number;
      valor: string;
      bajos: number;
      unidades: number;
    }>(
      `SELECT count(*)::int AS total,
              COALESCE(sum(precio * stock), 0)::text AS valor,
              count(*) FILTER (WHERE stock <= stock_minimo)::int AS bajos,
              COALESCE(sum(stock), 0)::int AS unidades
       FROM producto`,
    );
    const pedidos = await this.db.query<{ total: number; importe: string }>(
      `SELECT count(*)::int AS total, COALESCE(sum(total), 0)::text AS importe
       FROM pedido`,
    );
    const porEstado = await this.db.query<{ estado: string; n: number }>(
      'SELECT estado, count(*)::int AS n FROM pedido GROUP BY estado ORDER BY estado',
    );
    const stockBajo = await this.db.query(
      `SELECT id, nombre, categoria, stock, stock_minimo FROM producto
       WHERE stock <= stock_minimo ORDER BY (stock - stock_minimo) ASC LIMIT 5`,
    );
    const topProductos = await this.db.query(
      `SELECT p.id, p.nombre, SUM(d.cantidad)::int AS unidades,
              SUM(d.cantidad * d.precio_unitario)::text AS importe
       FROM detalle_pedido d
       JOIN producto p ON p.id = d.producto_id
       GROUP BY p.id, p.nombre
       ORDER BY unidades DESC LIMIT 5`,
    );
    const recientes = await this.db.query(
      'SELECT id, cliente_sub, fecha, estado, total FROM pedido ORDER BY fecha DESC LIMIT 5',
    );
    const movimientos = await this.db.query(
      `SELECT m.id, m.tipo, m.cantidad, m.stock_resultante, m.fecha, p.nombre
       FROM movimiento_inventario m
       LEFT JOIN producto p ON p.id = m.producto_id
       ORDER BY m.fecha DESC LIMIT 5`,
    );

    return {
      rol: 'admin',
      productos: inventario.rows[0].total,
      unidadesEnInventario: inventario.rows[0].unidades,
      valorInventario: inventario.rows[0].valor,
      productosStockBajo: inventario.rows[0].bajos,
      totalPedidos: pedidos.rows[0].total,
      importeTotalPedidos: pedidos.rows[0].importe,
      pedidosPorEstado: porEstado.rows,
      alertasStockBajo: stockBajo.rows,
      topProductos: topProductos.rows,
      pedidosRecientes: recientes.rows,
      movimientosRecientes: movimientos.rows,
      seriePedidos: serie,
    };
  }
}
