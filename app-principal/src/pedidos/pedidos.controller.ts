import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesService } from '../auth/roles.service';
import { UsuarioActual } from '../auth/usuario-actual.decorator';
import type { UsuarioAutenticado } from '../auth/usuario-actual.decorator';
import { PedidosService } from './pedidos.service';
import { CreatePedidoDto } from './dto/create-pedido.dto';
import { PagarPedidoDto } from './dto/pagar-pedido.dto';
import { ConsultaPedidosDto } from './dto/consulta-pedidos.dto';
import { CambiarEstadoDto } from './dto/cambiar-estado.dto';

@Controller('pedidos')
@UseGuards(AuthGuard)
export class PedidosController {
  constructor(
    private readonly pedidos: PedidosService,
    private readonly roles: RolesService,
  ) {}

  @Post()
  crear(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() dto: CreatePedidoDto,
  ) {
    return this.pedidos.crear(usuario.sub, dto);
  }

  @Post('checkout')
  checkout(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() dto: CreatePedidoDto,
  ) {
    return this.pedidos.checkout(usuario.sub, dto);
  }

  @Post(':id/pagar')
  pagar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: PagarPedidoDto,
  ) {
    return this.pedidos.pagar(id, usuario.sub, dto);
  }

  @Get()
  async listar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Query() consulta: ConsultaPedidosDto,
  ) {
    const esAdmin = await this.roles.esAdmin(usuario.sub);
    return this.pedidos.listar(usuario.sub, esAdmin, consulta);
  }

  @Get(':id')
  async obtener(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const esAdmin = await this.roles.esAdmin(usuario.sub);
    return this.pedidos.obtener(id, usuario.sub, esAdmin);
  }

  @Patch(':id/estado')
  @UseGuards(RolesGuard)
  @Roles('admin')
  cambiarEstado(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CambiarEstadoDto,
  ) {
    return this.pedidos.cambiarEstado(id, dto.estado);
  }

  @Post('procesar-transiciones')
  @UseGuards(RolesGuard)
  @Roles('admin')
  procesarTransiciones() {
    return this.pedidos.procesarTransicionesVencidas();
  }
}
