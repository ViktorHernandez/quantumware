import { Body, Controller, Get, Post } from '@nestjs/common';
import { MotorService } from './motor.service';
import { SesionService } from './sesion.service';
import { EvidenciasService } from './evidencias.service';
import { EscenariosService } from './escenarios.service';
import { SesionDto } from './dto/sesion.dto';
import { EjecutarDto } from './dto/ejecutar.dto';
import { EscenarioDto } from './dto/escenario.dto';

@Controller('api')
export class PruebasController {
  constructor(
    private readonly motor: MotorService,
    private readonly sesion: SesionService,
    private readonly evidencias: EvidenciasService,
    private readonly escenarios: EscenariosService,
  ) {}

  @Get('salud')
  salud() {
    return { ok: true, servicio: 'cliente-atacante' };
  }

  @Get('config')
  async configuracion() {
    return {
      objetivo: this.motor.baseObjetivo(),
      vulnMode: await this.motor.modoObjetivo(),
      supabaseConfigurado: this.sesion.configurado(),
      permitirExplotacion: this.escenarios.permitirExplotacion(),
      escenarios: this.escenarios.listar(),
      sesiones: this.sesion.estado(),
    };
  }

  @Get('estado')
  async estado() {
    return {
      objetivo: this.motor.baseObjetivo(),
      vulnMode: await this.motor.modoObjetivo(),
      sesiones: this.sesion.estado(),
    };
  }

  @Post('sesion/apartar-expiracion')
  async apartarExpiracion() {
    return this.escenarios.generarTokenExpiradoLab();
  }

  @Get('lab/pedidos-descubribles')
  async pedidosDescubribles() {
    return this.escenarios.descubrirPedidosAjenos();
  }

  @Post('sesion')
  async iniciarSesion(@Body() dto: SesionDto) {
    const info = await this.sesion.iniciar(dto.rol, dto.codigoMfa);
    return { ok: true, rol: dto.rol, ...info, sesiones: this.sesion.estado() };
  }

  @Post('sesion/cerrar')
  cerrarSesion(@Body() dto: SesionDto) {
    this.sesion.cerrar(dto.rol);
    return { ok: true, sesiones: this.sesion.estado() };
  }

  @Post('ejecutar')
  ejecutar(@Body() dto: EjecutarDto) {
    return this.motor.ejecutar({
      metodo: dto.metodo,
      ruta: dto.ruta,
      origenToken: dto.origenToken,
      tokenManual: dto.tokenManual,
      cuerpo: dto.cuerpo,
      cabeceras: dto.cabeceras,
    });
  }

  @Post('escenario')
  escenario(@Body() dto: EscenarioDto) {
    return this.escenarios.ejecutar(dto.id, {
      tokenManual: dto.tokenManual,
      cantidad: dto.cantidad,
      q: dto.q,
      pedidoObjetivo: dto.pedidoObjetivo,
    });
  }

  @Get('evidencias')
  listarEvidencias() {
    return { evidencias: this.evidencias.listar() };
  }
}
