import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface FactorAdmin {
  id: string;
  status: string;
  factor_type?: string;
}

interface EntradaCache {
  valor: boolean;
  hasta: number;
}

const TTL_MS = 60000;

@Injectable()
export class FactoresMfaService {
  private readonly logger = new Logger('FactoresMfa');
  private readonly url: string;
  private readonly claveServicio: string;
  private readonly cache = new Map<string, EntradaCache>();

  constructor(config: ConfigService) {
    this.url = config.get<string>('SUPABASE_URL', '').replace(/\/+$/, '');
    this.claveServicio = config.get<string>('SUPABASE_SERVICE_ROLE_KEY', '');
  }

  configurado(): boolean {
    return Boolean(this.url && this.claveServicio);
  }

  invalidar(sub: string): void {
    this.cache.delete(sub);
  }

  async tieneFactorVerificado(sub: string): Promise<boolean> {
    const ahora = Date.now();
    const en_cache = this.cache.get(sub);
    if (en_cache && en_cache.hasta > ahora) {
      return en_cache.valor;
    }
    const respuesta = await fetch(
      `${this.url}/auth/v1/admin/users/${encodeURIComponent(sub)}/factors`,
      {
        headers: {
          apikey: this.claveServicio,
          authorization: `Bearer ${this.claveServicio}`,
        },
      },
    );
    if (!respuesta.ok) {
      this.logger.warn(
        `La consulta de factores MFA respondió ${respuesta.status}.`,
      );
      throw new Error(`Consulta de factores MFA fallida (${respuesta.status})`);
    }
    const cuerpo = (await respuesta.json()) as FactorAdmin[] | null;
    const valor = Array.isArray(cuerpo)
      ? cuerpo.some((f) => f.status === 'verified')
      : false;
    this.cache.set(sub, { valor, hasta: ahora + TTL_MS });
    return valor;
  }
}
