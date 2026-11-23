import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateKeyPair, SignJWT, type CryptoKey } from 'jose';

export type PropositoTokenLab = 'expirado' | 'vigente';

export interface TokenLaboratorio {
  token: string;
  proposito: PropositoTokenLab;
  sub: string;
  aal: string;
  emitidoEn: number;
  expEpoch: number;
  desfaseSegundos: number;
  vigente: boolean;
}

const KID_LAB = 'lab-expiracion-pa04';
const MARGEN_EXPIRADO_POR_DEFECTO = 60;
const MARGEN_EXPIRADO_MAXIMO = 86400;
const MARGEN_VIGENTE_POR_DEFECTO = 60;
const MARGEN_VIGENTE_MAXIMO = 300;

@Injectable()
export class LabIdentidadService {
  private par: Promise<{ publicKey: CryptoKey; privateKey: CryptoKey }> | null =
    null;

  constructor(private readonly config: ConfigService) {}

  habilitado(): boolean {
    return (
      this.config.get<string>('LAB_TOKEN_EXPIRACION', 'false').toLowerCase() ===
      'true'
    );
  }

  tokensVigentesHabilitados(): boolean {
    return (
      this.habilitado() &&
      this.config
        .get<string>('LAB_TOKEN_VIGENTE_DEMO', 'false')
        .toLowerCase() === 'true'
    );
  }

  kid(): string {
    return KID_LAB;
  }

  private emisor(): string {
    return this.config.get<string>('SUPABASE_ISSUER', '');
  }

  private destinatario(): string {
    return this.config.get<string>('SUPABASE_AUDIENCE', 'authenticated');
  }

  private sujeto(): string {
    return this.config.get<string>(
      'LAB_SUB_EXPIRACION',
      '00000000-0000-0000-0000-0000000000de',
    );
  }

  private obtenerPar(): Promise<{
    publicKey: CryptoKey;
    privateKey: CryptoKey;
  }> {
    if (!this.par) {
      this.par = generateKeyPair('ES256', { extractable: false });
    }
    return this.par;
  }

  async clavePublica(): Promise<CryptoKey> {
    const { publicKey } = await this.obtenerPar();
    return publicKey;
  }

  private margenExpirado(valor?: number): number {
    const base = Number.isFinite(valor) ? Number(valor) : undefined;
    if (base === undefined) {
      return MARGEN_EXPIRADO_POR_DEFECTO;
    }
    return Math.min(Math.max(Math.round(base), 1), MARGEN_EXPIRADO_MAXIMO);
  }

  private margenVigente(valor?: number): number {
    const base = Number.isFinite(valor) ? Number(valor) : undefined;
    if (base === undefined) {
      return MARGEN_VIGENTE_POR_DEFECTO;
    }
    return Math.min(Math.max(Math.round(base), 1), MARGEN_VIGENTE_MAXIMO);
  }

  async emitir(
    proposito: PropositoTokenLab,
    margenSegundos?: number,
  ): Promise<TokenLaboratorio> {
    const { privateKey } = await this.obtenerPar();
    const ahora = Math.floor(Date.now() / 1000);
    const desfase =
      proposito === 'expirado'
        ? this.margenExpirado(margenSegundos)
        : this.margenVigente(margenSegundos);
    const expEpoch =
      proposito === 'expirado' ? ahora - desfase : ahora + desfase;
    const sub = this.sujeto();
    const aal = 'aal1';

    const token = await new SignJWT({ aal })
      .setProtectedHeader({ alg: 'ES256', kid: KID_LAB })
      .setSubject(sub)
      .setIssuer(this.emisor())
      .setAudience(this.destinatario())
      .setIssuedAt(ahora)
      .setExpirationTime(expEpoch)
      .sign(privateKey);

    return {
      token,
      proposito,
      sub,
      aal,
      emitidoEn: ahora,
      expEpoch,
      desfaseSegundos: desfase,
      vigente: expEpoch > ahora,
    };
  }
}
