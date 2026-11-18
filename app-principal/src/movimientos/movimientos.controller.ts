import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Aal2Guard } from '../auth/aal2.guard';
import { Roles } from '../auth/roles.decorator';
import { UsuarioActual } from '../auth/usuario-actual.decorator';
import type { UsuarioAutenticado } from '../auth/usuario-actual.decorator';
import { MovimientosService } from './movimientos.service';
import { CrearMovimientoDto } from './dto/crear-movimiento.dto';
import { ConsultaMovimientosDto } from './dto/consulta-movimientos.dto';

@Controller('movimientos')
@UseGuards(AuthGuard, RolesGuard)
@Roles('admin')
export class MovimientosController {
  constructor(private readonly movimientos: MovimientosService) {}

  @Get()
  listar(@Query() consulta: ConsultaMovimientosDto) {
    return this.movimientos.listar(consulta);
  }

  @Post()
  @UseGuards(Aal2Guard)
  crear(
    @Body() dto: CrearMovimientoDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.movimientos.crear(dto, usuario.sub);
  }
}
