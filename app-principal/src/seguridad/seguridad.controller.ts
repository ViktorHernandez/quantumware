import { Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { UsuarioActual } from '../auth/usuario-actual.decorator';
import type { UsuarioAutenticado } from '../auth/usuario-actual.decorator';
import { SeguridadService } from './seguridad.service';

@Controller('seguridad')
@UseGuards(AuthGuard)
export class SeguridadController {
  constructor(private readonly seguridad: SeguridadService) {}

  @Post('inicio-sesion')
  inicioSesion(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Req() req: Request,
  ) {
    return this.seguridad.registrarInicioSesion(usuario.sub, {
      agente: req.headers['user-agent'] ?? null,
      aal: usuario.aal ?? null,
    });
  }
}
