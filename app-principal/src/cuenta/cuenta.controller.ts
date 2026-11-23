import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import { CuentaService, EstadoEnlace } from './cuenta.service';
import { EstablecerContrasenaDto } from './dto/establecer-contrasena.dto';
import { SolicitarRecuperacionDto } from './dto/solicitar-recuperacion.dto';

@Controller('cuenta')
export class CuentaController {
  constructor(private readonly cuenta: CuentaService) {}

  @Post('recuperacion')
  @HttpCode(202)
  async solicitarRecuperacion(
    @Body() dto: SolicitarRecuperacionDto,
  ): Promise<{ aceptada: boolean }> {
    await this.cuenta.solicitarRecuperacion(dto.email);
    return { aceptada: true };
  }

  @Get('enlace/:token')
  async inspeccionar(@Param('token') token: string): Promise<EstadoEnlace> {
    return this.cuenta.inspeccionar(token);
  }

  @Post('contrasena')
  @HttpCode(200)
  async establecer(@Body() dto: EstablecerContrasenaDto) {
    const r = await this.cuenta.establecerContrasena(dto.token, dto.password);
    if (!r.ok) {
      throw new BadRequestException(r.mensaje ?? 'El enlace no es válido.');
    }
    return { ok: true, tipo: r.tipo, email: r.email };
  }
}
