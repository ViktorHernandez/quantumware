import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtVerifierService } from './jwt-verifier.service';
import { UsuarioAutenticado } from './usuario-actual.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly verifier: JwtVerifierService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const encabezado = req.headers['authorization'];
    if (!encabezado || !encabezado.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token de acceso ausente.');
    }
    const token = encabezado.slice(7).trim();
    if (!token) {
      throw new UnauthorizedException('Token de acceso ausente.');
    }
    try {
      const payload = await this.verifier.verificar(token);
      const sub = String(payload.sub ?? '');
      if (!sub) {
        throw new UnauthorizedException('Token de acceso inválido.');
      }
      const usuario: UsuarioAutenticado = {
        sub,
        email: typeof payload.email === 'string' ? payload.email : undefined,
        rol: null,
        aal: typeof payload.aal === 'string' ? payload.aal : null,
      };
      (req as unknown as { usuario: UsuarioAutenticado }).usuario = usuario;
      return true;
    } catch {
      throw new UnauthorizedException('Token de acceso inválido.');
    }
  }
}
