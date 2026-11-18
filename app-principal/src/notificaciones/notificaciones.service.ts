import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { Observable, Subject } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { DatabaseService } from '../database/database.service';
import { CorreoSalidaService } from '../correo/correo-salida.service';
import { SupabaseAdminService } from '../usuarios/supabase-admin.service';
import {
  asuntoCorreo,
  detallesDeDatos,
  plantillaCorreo,
} from '../correo/plantilla-correo';

interface Consultor {
  query: DatabaseService['query'];
}

export interface CrearNotificacion {
  userId: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  datos?: Record<string, unknown>;
  claveDedupe?: string;
}

export interface EventoNotificacion {
  id: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  datos: Record<string, unknown>;
  creada: string;
}

@Injectable()
export class NotificacionesService {
  private readonly bus = new Subject<{
    userId: string;
    evento: EventoNotificacion;
  }>();

  private cuentasCache: {
    hasta: number;
    mapa: Map<string, { email: string | null }>;
  } | null = null;

  constructor(
    private readonly db: DatabaseService,
    private readonly correoSalida: CorreoSalidaService,
    private readonly admin: SupabaseAdminService,
  ) {}

  private async emailDeCuenta(userId: string): Promise<string | null> {
    if (!this.admin.configurado()) {
      return null;
    }
    const ahora = Date.now();
    if (!this.cuentasCache || this.cuentasCache.hasta <= ahora) {
      try {
        const mapa = await this.admin.usuariosPorId();
        this.cuentasCache = { hasta: ahora + 60000, mapa };
      } catch {
        return null;
      }
    }
    return this.cuentasCache.mapa.get(userId)?.email ?? null;
  }

  private async emailDeUsuario(
    c: Consultor,
    userId: string,
  ): Promise<string | null> {
    const r = await c.query<{ email: string | null }>(
      'SELECT email FROM perfil_usuario WHERE user_id = $1',
      [userId],
    );
    const local = r.rows[0]?.email ?? null;
    if (local) {
      return local;
    }
    const deCuenta = await this.emailDeCuenta(userId);
    if (!deCuenta) {
      return null;
    }
    await c.query(
      `INSERT INTO perfil_usuario (user_id, email) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email
       WHERE perfil_usuario.email IS NULL`,
      [userId, deCuenta],
    );
    return deCuenta;
  }

  private async marcarCorreo(
    c: Consultor,
    notificacionId: string,
    estado: 'encolado' | 'sin_destinatario',
  ): Promise<void> {
    await c.query('UPDATE notificacion SET correo_estado = $2 WHERE id = $1', [
      notificacionId,
      estado,
    ]);
  }

  private async encolarCorreo(
    c: Consultor,
    notificacionId: string,
    email: string,
    n: Omit<CrearNotificacion, 'userId'> & { userId?: string },
  ): Promise<void> {
    await this.correoSalida.encolar(
      {
        notificacionId,
        destinatario: email,
        asunto: asuntoCorreo(n.titulo),
        html: plantillaCorreo({
          titulo: n.titulo,
          mensaje: n.mensaje,
          detalles: detallesDeDatos(n.datos),
        }),
        texto: n.mensaje,
        claveDedupe: `not:${notificacionId}`,
      },
      c,
    );
  }

  flujo(userId: string): Observable<{ data: EventoNotificacion }> {
    return this.bus.asObservable().pipe(
      filter((e) => e.userId === userId),
      map((e) => ({ data: e.evento })),
    );
  }

  private async insertar(
    c: Consultor,
    n: CrearNotificacion,
  ): Promise<{ id: string; creada: Date } | null> {
    const r = await c.query<{
      id: string;
      creada: Date;
    }>(
      `INSERT INTO notificacion (user_id, tipo, titulo, mensaje, datos, clave_dedupe)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)
       ON CONFLICT (user_id, clave_dedupe) WHERE clave_dedupe IS NOT NULL AND leida = false
       DO NOTHING
       RETURNING id, creada`,
      [
        n.userId,
        n.tipo,
        n.titulo,
        n.mensaje,
        JSON.stringify(n.datos ?? {}),
        n.claveDedupe ?? null,
      ],
    );
    if (r.rows.length === 0) {
      return null;
    }
    this.bus.next({
      userId: n.userId,
      evento: {
        id: r.rows[0].id,
        tipo: n.tipo,
        titulo: n.titulo,
        mensaje: n.mensaje,
        datos: n.datos ?? {},
        creada: r.rows[0].creada.toISOString(),
      },
    });
    return r.rows[0];
  }

  async crear(n: CrearNotificacion, cliente?: PoolClient): Promise<void> {
    const c: Consultor = cliente ?? this.db;
    const insertada = await this.insertar(c, n);
    if (!insertada) {
      return;
    }
    const email = await this.emailDeUsuario(c, n.userId);
    if (email) {
      await this.encolarCorreo(c, insertada.id, email, n);
      await this.marcarCorreo(c, insertada.id, 'encolado');
    } else {
      await this.marcarCorreo(c, insertada.id, 'sin_destinatario');
    }
  }

  async crearParaAdmins(
    n: Omit<CrearNotificacion, 'userId'>,
    cliente?: PoolClient,
  ): Promise<void> {
    const c: Consultor = cliente ?? this.db;
    const admins = await c.query<{ user_id: string; email: string | null }>(
      `SELECT ur.user_id, p.email FROM user_roles ur
       LEFT JOIN perfil_usuario p ON p.user_id = ur.user_id
       WHERE ur.rol = 'admin'`,
    );
    for (const admin of admins.rows) {
      const insertada = await this.insertar(c, {
        ...n,
        userId: admin.user_id,
      });
      if (!insertada) {
        continue;
      }
      const destino =
        admin.email ?? (await this.emailDeUsuario(c, admin.user_id));
      if (destino) {
        await this.encolarCorreo(c, insertada.id, destino, {
          ...n,
          userId: admin.user_id,
        });
        await this.marcarCorreo(c, insertada.id, 'encolado');
      } else {
        await this.marcarCorreo(c, insertada.id, 'sin_destinatario');
      }
    }
  }

  async alertaExistencias(
    producto: {
      id: string;
      nombre: string;
      stock: number;
      stock_minimo: number;
    },
    cliente?: PoolClient,
  ): Promise<void> {
    if (producto.stock > producto.stock_minimo) {
      return;
    }
    const agotado = producto.stock === 0;
    await this.crearParaAdmins(
      {
        tipo: agotado ? 'stock_agotado' : 'stock_bajo',
        titulo: agotado ? 'Producto agotado' : 'Existencias bajas',
        mensaje: agotado
          ? `${producto.nombre} se quedó sin existencias.`
          : `${producto.nombre} tiene ${producto.stock} unidad(es), en o por debajo del mínimo (${producto.stock_minimo}).`,
        datos: { producto_id: producto.id, stock: producto.stock },
        claveDedupe: `${agotado ? 'agotado' : 'bajo'}:${producto.id}`,
      },
      cliente,
    );
  }

  async listar(
    userId: string,
    opciones: {
      soloNoLeidas?: boolean;
      tipo?: string;
      busqueda?: string;
      pagina?: number;
      tamano?: number;
    },
  ) {
    const condiciones = ['user_id = $1'];
    const valores: unknown[] = [userId];
    if (opciones.soloNoLeidas) {
      condiciones.push('leida = false');
    }
    if (opciones.tipo) {
      valores.push(opciones.tipo);
      condiciones.push(`tipo = $${valores.length}`);
    }
    if (opciones.busqueda) {
      valores.push(`%${opciones.busqueda}%`);
      condiciones.push(
        `(titulo ILIKE $${valores.length} OR mensaje ILIKE $${valores.length})`,
      );
    }
    const where = `WHERE ${condiciones.join(' AND ')}`;
    const tamano = opciones.tamano ?? 10;
    const pagina = opciones.pagina ?? 1;
    const offset = (pagina - 1) * tamano;

    const total = await this.db.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM notificacion ${where}`,
      valores,
    );
    const items = await this.db.query(
      `SELECT id, tipo, titulo, mensaje, datos, leida, creada, leida_en
       FROM notificacion ${where}
       ORDER BY creada DESC LIMIT ${tamano} OFFSET ${offset}`,
      valores,
    );
    return {
      items: items.rows,
      total: Number(total.rows[0].n),
      pagina,
      tamano,
    };
  }

  async contador(userId: string): Promise<{ noLeidas: number }> {
    const r = await this.db.query<{ n: string }>(
      'SELECT count(*)::text AS n FROM notificacion WHERE user_id = $1 AND leida = false',
      [userId],
    );
    return { noLeidas: Number(r.rows[0].n) };
  }

  async recientes(userId: string) {
    const r = await this.db.query(
      `SELECT id, tipo, titulo, mensaje, datos, leida, creada
       FROM notificacion WHERE user_id = $1
       ORDER BY creada DESC LIMIT 8`,
      [userId],
    );
    return r.rows;
  }

  async marcarLeida(userId: string, id: string): Promise<{ ok: boolean }> {
    const r = await this.db.query(
      `UPDATE notificacion SET leida = true, leida_en = now()
       WHERE id = $1 AND user_id = $2 AND leida = false`,
      [id, userId],
    );
    return { ok: (r.rowCount ?? 0) > 0 };
  }

  async marcarTodas(userId: string): Promise<{ actualizadas: number }> {
    const r = await this.db.query(
      `UPDATE notificacion SET leida = true, leida_en = now()
       WHERE user_id = $1 AND leida = false`,
      [userId],
    );
    return { actualizadas: r.rowCount ?? 0 };
  }
}
