import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { CreateProductoDto } from './dto/create-producto.dto';
import { UpdateProductoDto } from './dto/update-producto.dto';
import { ConsultaProductosDto } from './dto/consulta-productos.dto';

export interface Producto {
  id: string;
  nombre: string;
  descripcion: string | null;
  categoria: string | null;
  precio: string;
  stock: number;
  stock_minimo: number;
  estado: string;
  imagen_url: string | null;
}

const COLUMNAS =
  'id, nombre, descripcion, categoria, precio, stock, stock_minimo, estado, imagen_url';
const ORDEN_PERMITIDO: Record<string, string> = {
  nombre: 'nombre',
  categoria: 'categoria',
  precio: 'precio',
  stock: 'stock',
};

const IMAGENES_CATALOGO = new Set([
  'audifonos',
  'bocina-compacta',
  'cable-displayport',
  'cable-hdmi',
  'disco-externo-2-tb',
  'fuente-de-poder-650-w',
  'hub-usb-c',
  'memoria-ram-16-gb',
  'memoria-usb-64-gb',
  'microfono-usb',
  'monitor-curvo-27',
  'monitor-de-prueba-24',
  'monitor-portatil-15',
  'mouse-optico',
  'router-de-prueba',
  'ssd-nvme-1-tb',
  'switch-de-red-8-puertos',
  'tarjeta-de-red',
  'teclado-compacto',
  'teclado-mecanico',
  'ventilador-120-mm',
]);

function slugCatalogo(nombre: string): string {
  return nombre
    .replace(/[\u2033\u201c\u201d'"]/g, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

export function imagenPorNombre(nombre: string): string | null {
  const slug = slugCatalogo(nombre);
  return IMAGENES_CATALOGO.has(slug) ? `/media/productos/${slug}.webp` : null;
}

@Injectable()
export class ProductosService implements OnModuleInit {
  private readonly registro = new Logger('Productos');

  async onModuleInit(): Promise<void> {
    try {
      const sinImagen = await this.db.query<{ id: string; nombre: string }>(
        'SELECT id, nombre FROM producto WHERE imagen_url IS NULL',
      );
      let asignadas = 0;
      for (const fila of sinImagen.rows) {
        const ruta = imagenPorNombre(fila.nombre);
        if (!ruta) {
          continue;
        }
        await this.db.query(
          'UPDATE producto SET imagen_url = $2 WHERE id = $1 AND imagen_url IS NULL',
          [fila.id, ruta],
        );
        asignadas += 1;
      }
      if (asignadas > 0) {
        this.registro.log(
          `Se asociaron ${asignadas} imagen(es) de catálogo a productos que no la tenían.`,
        );
      }
    } catch (error) {
      const detalle = error instanceof Error ? error.message : 'error desconocido';
      this.registro.warn(
        `No se pudieron completar las imágenes de catálogo al iniciar: ${detalle}`,
      );
    }
  }
  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    private readonly notificaciones: NotificacionesService,
  ) {}

  private modo(): string {
    return this.config.get<string>('VULN_MODE', 'corregido');
  }

  private construirFiltros(
    consulta: ConsultaProductosDto,
    incluirArchivados: boolean,
  ) {
    const condiciones: string[] = [];
    const valores: unknown[] = [];
    const estado = incluirArchivados ? (consulta.estado ?? 'todos') : 'activo';
    if (estado !== 'todos') {
      valores.push(estado);
      condiciones.push(`estado = $${valores.length}`);
    }
    if (consulta.q) {
      valores.push(`%${consulta.q}%`);
      condiciones.push(`nombre ILIKE $${valores.length}`);
    }
    if (consulta.categoria) {
      valores.push(consulta.categoria);
      condiciones.push(`categoria = $${valores.length}`);
    }
    if (consulta.stockBajo === 'true') {
      condiciones.push('stock <= stock_minimo');
    }
    const where = condiciones.length
      ? `WHERE ${condiciones.join(' AND ')}`
      : '';
    const columna = ORDEN_PERMITIDO[consulta.orden ?? 'nombre'] ?? 'nombre';
    const direccion = consulta.direccion === 'desc' ? 'DESC' : 'ASC';
    return { where, valores, orderBy: `ORDER BY ${columna} ${direccion}` };
  }

  async listar(consulta: ConsultaProductosDto, incluirArchivados = false) {
    const { where, valores, orderBy } = this.construirFiltros(
      consulta,
      incluirArchivados,
    );

    if (consulta.pagina === undefined) {
      const r = await this.db.query<Producto>(
        `SELECT ${COLUMNAS} FROM producto ${where} ${orderBy}`,
        valores,
      );
      return r.rows;
    }

    const tamano = consulta.tamano ?? 10;
    const desplazamiento = (consulta.pagina - 1) * tamano;
    const total = await this.db.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM producto ${where}`,
      valores,
    );
    const r = await this.db.query<Producto>(
      `SELECT ${COLUMNAS} FROM producto ${where} ${orderBy}
       LIMIT ${tamano} OFFSET ${desplazamiento}`,
      valores,
    );
    return {
      items: r.rows,
      total: Number(total.rows[0].n),
      pagina: consulta.pagina,
      tamano,
    };
  }

  async buscar(q: string): Promise<Producto[]> {
    const termino = q ?? '';
    if (this.modo() === 'vulnerable') {
      const sql =
        `SELECT ${COLUMNAS} FROM producto ` +
        `WHERE nombre ILIKE '%` +
        termino +
        `%' ORDER BY nombre`;
      const r = await this.db.query<Producto>(sql);
      return r.rows;
    }
    const r = await this.db.query<Producto>(
      `SELECT ${COLUMNAS} FROM producto WHERE nombre ILIKE $1 ORDER BY nombre`,
      [`%${termino}%`],
    );
    return r.rows;
  }

  async categorias(): Promise<string[]> {
    const r = await this.db.query<{ categoria: string }>(
      `SELECT DISTINCT categoria FROM producto
       WHERE categoria IS NOT NULL AND categoria <> '' AND estado = 'activo'
       ORDER BY categoria`,
    );
    return r.rows.map((f) => f.categoria);
  }

  async crear(dto: CreateProductoDto): Promise<Producto> {
    const r = await this.db.query<Producto>(
      `INSERT INTO producto (nombre, descripcion, categoria, precio, stock, stock_minimo, imagen_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING ${COLUMNAS}`,
      [
        dto.nombre,
        dto.descripcion ?? null,
        dto.categoria ?? null,
        dto.precio,
        dto.stock,
        dto.stock_minimo ?? 0,
        dto.imagen_url ?? imagenPorNombre(dto.nombre),
      ],
    );
    const producto = r.rows[0];
    await this.notificaciones.alertaExistencias(producto);
    await this.notificaciones.crearParaAdmins({
      tipo: 'producto_creado',
      titulo: 'Producto agregado al catálogo',
      mensaje: `Se agregó "${producto.nombre}" al catálogo.`,
      datos: { producto_id: producto.id },
    });
    return producto;
  }

  async actualizar(id: string, dto: UpdateProductoDto): Promise<Producto> {
    const campos: string[] = [];
    const valores: unknown[] = [];
    let indice = 1;
    for (const [clave, valor] of Object.entries(dto)) {
      if (valor !== undefined) {
        campos.push(`${clave} = $${indice}`);
        valores.push(valor);
        indice += 1;
      }
    }
    if (campos.length === 0) {
      return this.obtener(id);
    }
    valores.push(id);
    const r = await this.db.query<Producto>(
      `UPDATE producto SET ${campos.join(', ')} WHERE id = $${indice}
       RETURNING ${COLUMNAS}`,
      valores,
    );
    if (r.rowCount === 0) {
      throw new NotFoundException('Producto no encontrado.');
    }
    const producto = r.rows[0];
    await this.notificaciones.alertaExistencias(producto);
    await this.notificaciones.crearParaAdmins({
      tipo: 'producto_actualizado',
      titulo: 'Producto actualizado',
      mensaje: `Se actualizó "${producto.nombre}".`,
      datos: { producto_id: producto.id },
    });
    return producto;
  }

  private async contarReferencias(
    id: string,
  ): Promise<{ pedidos: number; movimientos: number }> {
    const pedidos = await this.db.query<{ n: string }>(
      'SELECT count(*)::text AS n FROM detalle_pedido WHERE producto_id = $1',
      [id],
    );
    const movimientos = await this.db.query<{ n: string }>(
      'SELECT count(*)::text AS n FROM movimiento_inventario WHERE producto_id = $1',
      [id],
    );
    return {
      pedidos: Number(pedidos.rows[0].n),
      movimientos: Number(movimientos.rows[0].n),
    };
  }

  async eliminar(
    id: string,
  ): Promise<{ id: string; eliminado: boolean; archivado?: boolean }> {
    const producto = await this.obtener(id);
    const referencias = await this.contarReferencias(id);
    if (referencias.pedidos > 0 || referencias.movimientos > 0) {
      throw new ConflictException(
        `El producto "${producto.nombre}" no puede eliminarse porque tiene ${referencias.pedidos} pedido(s) y ${referencias.movimientos} movimiento(s) asociados. Archívalo para retirarlo del catálogo conservando su historial.`,
      );
    }
    await this.db.query('DELETE FROM producto WHERE id = $1', [id]);
    return { id, eliminado: true };
  }

  async archivar(id: string): Promise<Producto> {
    const r = await this.db.query<Producto>(
      `UPDATE producto SET estado = 'archivado', archivado_en = now()
       WHERE id = $1 RETURNING ${COLUMNAS}`,
      [id],
    );
    if (r.rowCount === 0) {
      throw new NotFoundException('Producto no encontrado.');
    }
    await this.notificaciones.crearParaAdmins({
      tipo: 'producto_archivado',
      titulo: 'Producto archivado',
      mensaje: `"${r.rows[0].nombre}" se retiró del catálogo y conserva su historial.`,
      datos: { producto_id: id },
    });
    return r.rows[0];
  }

  async reactivar(id: string): Promise<Producto> {
    const r = await this.db.query<Producto>(
      `UPDATE producto SET estado = 'activo', archivado_en = NULL
       WHERE id = $1 RETURNING ${COLUMNAS}`,
      [id],
    );
    if (r.rowCount === 0) {
      throw new NotFoundException('Producto no encontrado.');
    }
    return r.rows[0];
  }

  async obtener(id: string): Promise<Producto> {
    const r = await this.db.query<Producto>(
      `SELECT ${COLUMNAS} FROM producto WHERE id = $1`,
      [id],
    );
    if (r.rowCount === 0) {
      throw new NotFoundException('Producto no encontrado.');
    }
    return r.rows[0];
  }
}
