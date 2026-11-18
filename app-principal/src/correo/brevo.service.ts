import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface CorreoSalida {
  para: string;
  asunto: string;
  html: string;
  texto?: string;
}

export interface ResultadoEnvio {
  enviado: boolean;
  permanente: boolean;
  detalle?: string;
}

@Injectable()
export class BrevoService {
  private readonly logger = new Logger('Brevo');
  private readonly apiKey: string;
  private readonly remitente: string;
  private readonly nombreRemitente: string;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('BREVO_API_KEY', '');
    this.remitente = config.get<string>('BREVO_SENDER_EMAIL', '');
    this.nombreRemitente = config.get<string>(
      'BREVO_SENDER_NAME',
      'QuantumWare',
    );
  }

  configurado(): boolean {
    return Boolean(this.apiKey && this.remitente);
  }

  async enviarDetallado(correo: CorreoSalida): Promise<ResultadoEnvio> {
    if (!this.configurado()) {
      this.logger.debug(
        `Correo omitido (Brevo no configurado): "${correo.asunto}" para ${correo.para}`,
      );
      return {
        enviado: false,
        permanente: false,
        detalle: 'Brevo no configurado',
      };
    }
    if (!correo.para) {
      return {
        enviado: false,
        permanente: true,
        detalle: 'Destinatario vacío',
      };
    }
    try {
      const r = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': this.apiKey,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({
          sender: { email: this.remitente, name: this.nombreRemitente },
          to: [{ email: correo.para }],
          subject: correo.asunto,
          htmlContent: correo.html,
          textContent: correo.texto ?? undefined,
        }),
      });
      if (!r.ok) {
        const cuerpo = (await r.text()).slice(0, 300);
        const permanente =
          r.status === 400 || r.status === 401 || r.status === 403;
        this.logger.warn(
          `Brevo respondió ${r.status} al enviar "${correo.asunto}": ${cuerpo}`,
        );
        return {
          enviado: false,
          permanente,
          detalle: `HTTP ${r.status}: ${cuerpo}`,
        };
      }
      return { enviado: true, permanente: false };
    } catch (e) {
      const detalle = (e as Error).message;
      this.logger.warn(
        `No se pudo enviar el correo "${correo.asunto}": ${detalle}`,
      );
      return { enviado: false, permanente: false, detalle };
    }
  }

  async enviar(correo: CorreoSalida): Promise<boolean> {
    return (await this.enviarDetallado(correo)).enviado;
  }
}
