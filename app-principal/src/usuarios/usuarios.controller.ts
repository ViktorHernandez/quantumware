import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Aal2Guard } from '../auth/aal2.guard';
import { Roles } from '../auth/roles.decorator';
import { UsuarioActual } from '../auth/usuario-actual.decorator';
import type { UsuarioAutenticado } from '../auth/usuario-actual.decorator';
import { UsuariosService } from './usuarios.service';
import { AsignarRolDto } from './dto/asignar-rol.dto';
import { ConsultaUsuariosDto } from './dto/consulta-usuarios.dto';
import { InvitarUsuarioDto } from './dto/invitar-usuario.dto';

@Controller('usuarios')
@UseGuards(AuthGuard, RolesGuard)
@Roles('admin')
export class UsuariosController {
  constructor(private readonly usuarios: UsuariosService) {}

  @Get()
  listar(@Query() consulta: ConsultaUsuariosDto) {
    return this.usuarios.listar(consulta);
  }

  @Post('rol')
  @UseGuards(Aal2Guard)
  asignar(
    @Body() dto: AsignarRolDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.usuarios.asignar(dto, usuario.sub);
  }

  @Get('invitaciones')
  invitaciones() {
    return this.usuarios.listarInvitaciones();
  }

  @Post('invitaciones')
  @UseGuards(Aal2Guard)
  invitar(
    @Body() dto: InvitarUsuarioDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.usuarios.invitar(dto, usuario.sub);
  }

  @Delete('invitaciones/:id')
  @UseGuards(Aal2Guard)
  revocarInvitacion(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.usuarios.revocarInvitacion(id);
  }

  @Delete(':sub')
  @UseGuards(Aal2Guard)
  eliminarCuenta(
    @Param('sub', new ParseUUIDPipe()) sub: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.usuarios.eliminarCuenta(sub, usuario.sub);
  }
}
