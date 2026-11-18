import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const MAX_INTENTOS_PERMITIDOS = 20;
const UMBRAL_BLOQUEO = 5;

export interface ResultadoResistencia {
  modo: string;
  limiteActivo: boolean;
  intentosSolicitados: number;
  intentosProcesados: number;
  intentosRechazadosPorCredencial: number;
  bloqueadoEn: number | null;
  observacion: string;
}

@Injectable()
export class LaboratorioService {
  constructor(private readonly config: ConfigService) {}

  private modo(): string {
    return this.config.get<string>('VULN_MODE', 'corregido');
  }

  resistenciaAutenticacion(intentosSolicitados: number): ResultadoResistencia {
    if (
      !Number.isInteger(intentosSolicitados) ||
      intentosSolicitados < 1 ||
      intentosSolicitados > MAX_INTENTOS_PERMITIDOS
    ) {
      throw new BadRequestException(
        `El número de intentos debe estar entre 1 y ${MAX_INTENTOS_PERMITIDOS}. Esta simulación está acotada y no puede ampliarse a valores peligrosos.`,
      );
    }

    const limiteActivo = this.modo() !== 'vulnerable';
    let procesados = 0;
    let rechazados = 0;
    let bloqueadoEn: number | null = null;

    for (let intento = 1; intento <= intentosSolicitados; intento++) {
      if (limiteActivo && procesados >= UMBRAL_BLOQUEO) {
        bloqueadoEn = intento;
        break;
      }
      procesados++;
      rechazados++;
    }

    const observacion = limiteActivo
      ? bloqueadoEn !== null
        ? `El mecanismo de protección bloqueó los intentos a partir del intento ${bloqueadoEn}, tras ${UMBRAL_BLOQUEO} fallos. La autenticación resiste intentos repetidos.`
        : `Se procesaron ${procesados} intentos sin alcanzar el umbral de bloqueo (${UMBRAL_BLOQUEO}).`
      : `Modo vulnerable: sin límite activo, se procesaron los ${procesados} intentos sin bloqueo. Demuestra el riesgo de no limitar los intentos.`;

    return {
      modo: this.modo(),
      limiteActivo,
      intentosSolicitados,
      intentosProcesados: procesados,
      intentosRechazadosPorCredencial: rechazados,
      bloqueadoEn,
      observacion,
    };
  }
}
