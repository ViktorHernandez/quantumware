import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesService } from '../auth/roles.service';
import { UsuarioActual } from '../auth/usuario-actual.decorator';
import type { UsuarioAutenticado } from '../auth/usuario-actual.decorator';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(AuthGuard)
export class DashboardController {
  constructor(
    private readonly dashboard: DashboardService,
    private readonly roles: RolesService,
  ) {}

  @Get()
  async resumen(@UsuarioActual() usuario: UsuarioAutenticado) {
    const esAdmin = await this.roles.esAdmin(usuario.sub);
    return this.dashboard.resumen(usuario.sub, esAdmin);
  }

  @Get('serie-pedidos')
  async seriePedidos(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Query('rango') rango?: string,
  ) {
    const esAdmin = await this.roles.esAdmin(usuario.sub);
    return this.dashboard.seriePedidos(usuario.sub, esAdmin, rango ?? '7d');
  }

  @Get('valor-inventario')
  @UseGuards(RolesGuard)
  @Roles('admin')
  analisisInventario() {
    return this.dashboard.analisisInventario();
  }
}
