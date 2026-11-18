import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DatabaseService } from './database.service';

interface Requisito {
  tabla: string;
  columna?: string;
  migracion: string;
}

const REQUERIDAS: Requisito[] = [
  { tabla: 'notificacion', migracion: '04_notificaciones.sql' },
  {
    tabla: 'producto',
    columna: 'estado',
    migracion: '05_ciclo_vida_producto.sql',
  },
  {
    tabla: 'perfil_usuario',
    columna: 'email',
    migracion: '06_perfil_email.sql',
  },
  {
    tabla: 'pedido',
    columna: 'estado_pago',
    migracion: '08_pedidos_checkout_seguimiento.sql',
  },
  {
    tabla: 'pedido',
    columna: 'clave_idempotencia',
    migracion: '08_pedidos_checkout_seguimiento.sql',
  },
  { tabla: 'pedido_evento', migracion: '08_pedidos_checkout_seguimiento.sql' },
  { tabla: 'resena', migracion: '09_resenas.sql' },
  { tabla: 'resena_voto', migracion: '09_resenas.sql' },
  { tabla: 'resena_moderacion', migracion: '09_resenas.sql' },
  { tabla: 'correo_salida', migracion: '10_correo_salida.sql' },
  { tabla: 'invitacion', migracion: '11_invitaciones.sql' },
];

@Injectable()
export class MigracionesCheckService implements OnModuleInit {
  private readonly logger = new Logger('Migraciones');
  private pendientes: string[] | null = null;

  constructor(private readonly db: DatabaseService) {}

  estado(): { esquema: string; migracionesPendientes: string[] } {
    if (this.pendientes === null) {
      return { esquema: 'sin_verificar', migracionesPendientes: [] };
    }
    if (this.pendientes.length > 0) {
      return {
        esquema: 'migraciones_pendientes',
        migracionesPendientes: this.pendientes,
      };
    }
    return { esquema: 'al_dia', migracionesPendientes: [] };
  }

  async onModuleInit(): Promise<void> {
    await this.verificar();
  }

  async verificar(): Promise<void> {
    const faltantes = new Set<string>();
    for (const req of REQUERIDAS) {
      try {
        const r = req.columna
          ? await this.db.query(
              `SELECT 1 FROM information_schema.columns
               WHERE table_name = $1 AND column_name = $2`,
              [req.tabla, req.columna],
            )
          : await this.db.query(
              `SELECT 1 FROM information_schema.tables WHERE table_name = $1`,
              [req.tabla],
            );
        if (r.rowCount === 0) {
          faltantes.add(req.migracion);
        }
      } catch {
        this.logger.warn(
          `No fue posible verificar el esquema de la conexión ${this.db.descripcionConexion()} (¿servicio apagado, credenciales incorrectas o host inaccesible?).`,
        );
        return;
      }
    }
    this.pendientes = [...faltantes].sort();
    if (this.pendientes.length > 0) {
      const lista = this.pendientes.join(', ');
      this.logger.error(
        `En la conexión ${this.db.descripcionConexion()} faltan migraciones por aplicar: ${lista}. Pedidos, pagos, notificaciones o catálogo responderán 500 hasta aplicarlas.`,
      );
      this.logger.error(
        'Ejecuta db\\aplicar-migraciones.ps1 desde la raíz del proyecto; aplica las migraciones pendientes de forma incremental y segura.',
      );
    } else {
      this.logger.log('Esquema de base de datos al día.');
    }
  }
}
