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
import { ProductosService } from './productos.service';
import { CreateProductoDto } from './dto/create-producto.dto';
import { UpdateProductoDto } from './dto/update-producto.dto';
import { ConsultaProductosDto } from './dto/consulta-productos.dto';

@Controller('productos')
@UseGuards(AuthGuard)
export class ProductosController {
  constructor(
    private readonly productos: ProductosService,
    private readonly roles: RolesService,
  ) {}

  @Get()
  async listar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Query() consulta: ConsultaProductosDto,
  ) {
    const incluirArchivados = await this.roles.esAdmin(usuario.sub);
    return this.productos.listar(consulta, incluirArchivados);
  }

  @Get('buscar')
  buscar(@Query('q') q: string) {
    return this.productos.buscar(q ?? '');
  }

  @Get('categorias')
  categorias() {
    return this.productos.categorias();
  }

  @Get(':id')
  obtener(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.productos.obtener(id);
  }

  @Post()
  @UseGuards(RolesGuard, Aal2Guard)
  @Roles('admin')
  crear(@Body() dto: CreateProductoDto) {
    return this.productos.crear(dto);
  }

  @Put(':id')
  @UseGuards(RolesGuard, Aal2Guard)
  @Roles('admin')
  actualizar(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateProductoDto,
  ) {
    return this.productos.actualizar(id, dto);
  }

  @Post(':id/archivar')
  @UseGuards(RolesGuard, Aal2Guard)
  @Roles('admin')
  archivar(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.productos.archivar(id);
  }

  @Post(':id/reactivar')
  @UseGuards(RolesGuard, Aal2Guard)
  @Roles('admin')
  reactivar(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.productos.reactivar(id);
  }

  @Delete(':id')
  @UseGuards(RolesGuard, Aal2Guard)
  @Roles('admin')
  eliminar(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.productos.eliminar(id);
  }
}
