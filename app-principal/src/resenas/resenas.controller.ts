import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Aal2Guard } from '../auth/aal2.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesService } from '../auth/roles.service';
import { UsuarioActual } from '../auth/usuario-actual.decorator';
import type { UsuarioAutenticado } from '../auth/usuario-actual.decorator';
import { ResenasService } from './resenas.service';
import { CrearResenaDto } from './dto/crear-resena.dto';
import { ActualizarResenaDto } from './dto/actualizar-resena.dto';
import { ConsultaResenasDto } from './dto/consulta-resenas.dto';
import { ModerarResenaDto } from './dto/moderar-resena.dto';

@Controller('productos/:productoId/resenas')
@UseGuards(AuthGuard)
export class ProductoResenasController {
  constructor(
    private readonly resenas: ResenasService,
    private readonly roles: RolesService,
  ) {}

  @Get()
  async listar(
    @Param('productoId', new ParseUUIDPipe()) productoId: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Query() consulta: ConsultaResenasDto,
  ) {
    const esAdmin = await this.roles.esAdmin(usuario.sub);
    return this.resenas.listar(productoId, consulta, usuario.sub, esAdmin);
  }

  @Post()
  async crear(
    @Param('productoId', new ParseUUIDPipe()) productoId: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() dto: CrearResenaDto,
  ) {
    const esAdmin = await this.roles.esAdmin(usuario.sub);
    return this.resenas.crear(productoId, usuario.sub, esAdmin, dto);
  }
}

@Controller('resenas')
@UseGuards(AuthGuard)
export class ResenasController {
  constructor(
    private readonly resenas: ResenasService,
    private readonly roles: RolesService,
  ) {}

  @Put(':id')
  async actualizar(
    @Param('id', new ParseUUIDPipe()) id: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() dto: ActualizarResenaDto,
  ) {
    const esAdmin = await this.roles.esAdmin(usuario.sub);
    return this.resenas.actualizar(id, usuario.sub, esAdmin, dto);
  }

  @Delete(':id')
  async eliminar(
    @Param('id', new ParseUUIDPipe()) id: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    const esAdmin = await this.roles.esAdmin(usuario.sub);
    return this.resenas.eliminar(id, usuario.sub, esAdmin);
  }

  @Post(':id/util')
  votarUtil(
    @Param('id', new ParseUUIDPipe()) id: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.resenas.votarUtil(id, usuario.sub);
  }

  @Post(':id/moderar')
  @UseGuards(RolesGuard, Aal2Guard)
  @Roles('admin')
  moderar(
    @Param('id', new ParseUUIDPipe()) id: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() dto: ModerarResenaDto,
  ) {
    return this.resenas.moderar(id, usuario.sub, dto);
  }
}
