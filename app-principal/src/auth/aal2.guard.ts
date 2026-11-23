import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { FactoresMfaService } from './factores-mfa.service';
import { UsuarioAutenticado } from './usuario-actual.decorator';

@Injectable()
export class Aal2Guard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly factores: FactoresMfaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const usuario = (req as unknown as { usuario?: UsuarioAutenticado })
      .usuario;
    if (!usuario?.sub) {
      throw new ForbiddenException('Permisos insuficientes.');
    }
    if (usuario.aal === 'aal2') {
      return true;
    }
    if (this.factores.configurado()) {
      let tieneFactor: boolean;
      try {
        tieneFactor = await this.factores.tieneFactorVerificado(usuario.sub);
      } catch {
        throw new ForbiddenException(
          'No fue posible comprobar el estado de MFA de la cuenta. La operación sensible se bloquea por seguridad; inténtalo de nuevo más tarde.',
        );
      }
      if (tieneFactor) {
        throw new ForbiddenException(
          'Esta operación sensible requiere completar la verificación en dos pasos (MFA) en la sesión actual. Cierra sesión y vuelve a entrar con tu código de autenticación.',
        );
      }
      return true;
    }
    const obligatorio =
      this.config
        .get<string>('MFA_ADMIN_OBLIGATORIO', 'false')
        .toLowerCase() === 'true';
    if (!obligatorio) {
      return true;
    }
    throw new ForbiddenException(
      'Esta operación sensible requiere verificación en dos pasos (MFA) activa en la sesión.',
    );
  }
}
