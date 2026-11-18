import { Injectable } from '@nestjs/common';
import { NotificacionesService } from '../notificaciones/notificaciones.service';

const VENTANA_AGRUPACION_MS = 10 * 60 * 1000;

@Injectable()
export class SeguridadService {
  constructor(private readonly notificaciones: NotificacionesService) {}

  async registrarInicioSesion(
    sub: string,
    opciones: {
      agente?: string | null;
      aal?: string | null;
      momento?: Date;
    } = {},
  ): Promise<{ registrado: boolean }> {
    const momento = opciones.momento ?? new Date();
    const ventana = Math.floor(momento.getTime() / VENTANA_AGRUPACION_MS);
    const agente = (opciones.agente ?? '').slice(0, 120).trim();
    const fechaTexto = momento.toLocaleString('es-MX', {
      dateStyle: 'long',
      timeStyle: 'short',
      timeZone: 'America/Mexico_City',
    });
    const conMfa = opciones.aal === 'aal2';
    await this.notificaciones.crear({
      userId: sub,
      tipo: 'seguridad_inicio_sesion',
      titulo: 'Nuevo inicio de sesión en tu cuenta',
      mensaje: `Se inició sesión en tu cuenta de QuantumWare el ${fechaTexto}${
        conMfa ? ', con verificación en dos pasos completada' : ''
      }. Si no reconoces esta actividad, cambia tu contraseña de inmediato.`,
      datos: {
        momento: momento.toISOString(),
        evento: 'inicio_sesion',
        ...(agente ? { agente } : {}),
        ...(opciones.aal ? { nivel: opciones.aal } : {}),
      },
      claveDedupe: `seguridad:login:${ventana}`,
    });
    return { registrado: true };
  }
}
