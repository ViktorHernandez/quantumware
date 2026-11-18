import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export interface UsuarioAutenticado {
  sub: string;
  email?: string;
  rol?: string | null;
  aal?: string | null;
}

export const UsuarioActual = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UsuarioAutenticado => {
    const req = ctx.switchToHttp().getRequest<Request>();
    return (req as unknown as { usuario: UsuarioAutenticado }).usuario;
  },
);
