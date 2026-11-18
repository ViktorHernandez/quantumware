import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';
import { BrevoService } from './brevo.service';

interface Consultor {
  query: DatabaseService['query'];
}

export interface CorreoEncolado {
  destinatario: string;
  asunto: string;
  html: string;
  texto?: string;
  claveDedupe?: string;
  notificacionId?: string;
}

export interface ResultadoProceso {
  procesados: number;
  enviados: number;
  reintentos: number;
  fallidos: number;
}

interface FilaPendiente {
  id: string;
  destinatario: string;
  asunto: string;
  html: string;
  texto: string | null;
  intentos: number;
  max_intentos: number;
}

const INTERVALO_MS = 15000;
const LOTE = 10;

@Injectable()
export class CorreoSalidaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('CorreoSalida');
  private temporizador: ReturnType<typeof setInterval> | null = null;
  private procesando = false;

  constructor(
    private readonly db: DatabaseService,
    private readonly brevo: BrevoService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    const activo =
      this.config.get<string>('CORREO_WORKER_ACTIVO', 'true').toLowerCase() !==
      'false';
    if (!activo) {
      return;
    }
    this.logger.log(
      `Worker de correo activo (intervalo ${INTERVALO_MS} ms). Proveedor Brevo ${
        this.brevo.configurado()
          ? 'configurado'
          : 'NO configurado: los correos quedarán en cola'
      }.`,
    );
    this.temporizador = setInterval(() => {
      void this.procesarPendientes().catch(() => undefined);
    }, INTERVALO_MS);
    this.temporizador.unref?.();
  }

  onModuleDestroy(): void {
    if (this.temporizador) {
      clearInterval(this.temporizador);
      this.temporizador = null;
    }
  }

  async encolar(
    correo: CorreoEncolado,
    consultor?: Consultor,
  ): Promise<boolean> {
    const c = consultor ?? this.db;
    const r = await c.query<{ id: string }>(
      `INSERT INTO correo_salida
         (notificacion_id, destinatario, asunto, html, texto, clave_dedupe)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (clave_dedupe) WHERE clave_dedupe IS NOT NULL DO NOTHING
       RETURNING id`,
      [
        correo.notificacionId ?? null,
        correo.destinatario,
        correo.asunto,
        correo.html,
        correo.texto ?? null,
        correo.claveDedupe ?? null,
      ],
    );
    return (r.rowCount ?? 0) > 0;
  }

  async procesarPendientes(
    limite = LOTE,
    soloIds?: string[],
  ): Promise<ResultadoProceso> {
    const resultado: ResultadoProceso = {
      procesados: 0,
      enviados: 0,
      reintentos: 0,
      fallidos: 0,
    };
    if (this.procesando || !this.brevo.configurado()) {
      return resultado;
    }
    const acotado = Array.isArray(soloIds) && soloIds.length > 0;
    this.procesando = true;
    try {
      const rescatadas = await this.db.query(
        `UPDATE correo_salida
         SET estado = 'pendiente'
         WHERE estado = 'enviando'
           AND creado_en < now() - interval '5 minutes'
           AND intentos < max_intentos`,
      );
      if (rescatadas.rowCount && rescatadas.rowCount > 0) {
        this.logger.warn(
          `Se recuperaron ${rescatadas.rowCount} correo(s) que quedaron en envío por una interrupción previa.`,
        );
      }
      const lote = await this.db.query<FilaPendiente>(
        `UPDATE correo_salida SET estado = 'enviando'
         WHERE id IN (
           SELECT id FROM correo_salida
           WHERE estado = 'pendiente' AND proximo_intento <= now()
             ${acotado ? 'AND id = ANY($2::uuid[])' : ''}
           ORDER BY creado_en
           LIMIT $1
           FOR UPDATE SKIP LOCKED
         )
         RETURNING id, destinatario, asunto, html, texto, intentos, max_intentos`,
        acotado ? [limite, soloIds] : [limite],
      );
      for (const fila of lote.rows) {
        resultado.procesados += 1;
        const envio = await this.brevo.enviarDetallado({
          para: fila.destinatario,
          asunto: fila.asunto,
          html: fila.html,
          texto: fila.texto ?? undefined,
        });
        if (envio.enviado) {
          await this.db.query(
            `UPDATE correo_salida
             SET estado = 'enviado', enviado_en = now(), ultimo_error = NULL
             WHERE id = $1`,
            [fila.id],
          );
          resultado.enviados += 1;
        } else {
          const intentos = fila.intentos + 1;
          const agotado = intentos >= fila.max_intentos || envio.permanente;
          await this.db.query(
            `UPDATE correo_salida
             SET estado = $2,
                 intentos = $3,
                 ultimo_error = $4,
                 proximo_intento = now() +
                   (power(2, least($3, 6)) * interval '1 minute')
             WHERE id = $1`,
            [
              fila.id,
              agotado ? 'fallido' : 'pendiente',
              intentos,
              envio.detalle ?? 'El proveedor de correo no aceptó el envío.',
            ],
          );
          if (agotado) {
            resultado.fallidos += 1;
            this.logger.warn(
              `Correo ${fila.id} marcado como fallido tras ${intentos} intento(s)${
                envio.permanente ? ' (error permanente)' : ''
              }: ${envio.detalle ?? 'sin detalle'}`,
            );
          } else {
            resultado.reintentos += 1;
          }
        }
      }
      return resultado;
    } finally {
      this.procesando = false;
    }
  }

  async estadisticas(): Promise<Record<string, number>> {
    const r = await this.db.query<{ estado: string; n: string }>(
      'SELECT estado, count(*)::text AS n FROM correo_salida GROUP BY estado',
    );
    const salida: Record<string, number> = {
      pendiente: 0,
      enviando: 0,
      enviado: 0,
      fallido: 0,
    };
    for (const fila of r.rows) {
      salida[fila.estado] = Number(fila.n);
    }
    return salida;
  }
}
