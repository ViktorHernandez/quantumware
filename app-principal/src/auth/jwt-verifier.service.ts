import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';

type ConjuntoClaves = ReturnType<typeof createRemoteJWKSet>;

@Injectable()
export class JwtVerifierService {
  private readonly jwksUrl: string;
  private readonly issuer: string;
  private readonly audience: string;
  private jwks: ConjuntoClaves | null = null;

  constructor(config: ConfigService) {
    this.jwksUrl = config.get<string>('SUPABASE_JWKS_URL', '');
    this.issuer = config.get<string>('SUPABASE_ISSUER', '');
    this.audience = config.get<string>('SUPABASE_AUDIENCE', 'authenticated');
  }

  private obtenerJwks(): ConjuntoClaves {
    if (!this.jwksUrl) {
      throw new Error('SUPABASE_JWKS_URL no configurado');
    }
    if (!this.jwks) {
      this.jwks = createRemoteJWKSet(new URL(this.jwksUrl));
    }
    return this.jwks;
  }

  async verificar(token: string): Promise<JWTPayload> {
    const { payload } = await jwtVerify(token, this.obtenerJwks(), {
      issuer: this.issuer || undefined,
      audience: this.audience || undefined,
    });
    return payload;
  }
}
