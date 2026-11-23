import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ROLES_KEY } from './roles.decorator';
import { RolesService } from './roles.service';
import { UsuarioAutenticado } from './usuario-actual.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly roles: RolesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requeridos = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requeridos || requeridos.length === 0) {
      return true;
    }
    const req = context.switchToHttp().getRequest<Request>();
    const usuario = (req as unknown as { usuario?: UsuarioAutenticado })
      .usuario;
    if (!usuario || !usuario.sub) {
      throw new ForbiddenException('Permisos insuficientes.');
    }
    const rol = await this.roles.rolDe(usuario.sub);
    if (!rol || !requeridos.includes(rol)) {
      throw new ForbiddenException('Permisos insuficientes.');
    }
    usuario.rol = rol;
    return true;
  }
}
