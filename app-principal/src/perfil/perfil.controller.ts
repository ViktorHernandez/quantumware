import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { UsuarioActual } from '../auth/usuario-actual.decorator';
import type { UsuarioAutenticado } from '../auth/usuario-actual.decorator';
import { PerfilService } from './perfil.service';
import { ActualizarPerfilDto } from './dto/actualizar-perfil.dto';

@Controller('perfil')
@UseGuards(AuthGuard)
export class PerfilController {
  constructor(private readonly perfil: PerfilService) {}

  @Get()
  obtener(@UsuarioActual() usuario: UsuarioAutenticado) {
    return this.perfil.obtener(usuario.sub, usuario.email);
  }

  @Put()
  actualizar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() dto: ActualizarPerfilDto,
  ) {
    return this.perfil.actualizar(usuario.sub, dto, usuario.email);
  }
}
