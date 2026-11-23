import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  NotFoundException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { LabIdentidadService } from '../auth/lab-identidad.service';
import { LaboratorioService } from './laboratorio.service';
import { ResistenciaDto } from './dto/resistencia.dto';
import { TokenExpiracionDto } from './dto/token-expiracion.dto';

@Controller('lab')
@UseGuards(AuthGuard)
export class LaboratorioController {
  constructor(
    private readonly laboratorio: LaboratorioService,
    private readonly identidad: LabIdentidadService,
  ) {}

  @Post('resistencia-autenticacion')
  @HttpCode(200)
  resistencia(@Body() dto: ResistenciaDto) {
    return this.laboratorio.resistenciaAutenticacion(dto.intentos);
  }

  @Post('token-expiracion')
  @HttpCode(200)
  async tokenExpiracion(@Body() dto: TokenExpiracionDto) {
    if (!this.identidad.habilitado()) {
      throw new NotFoundException(
        'La generación de tokens de laboratorio no está habilitada en este objetivo. Habilítala con la variable de entorno LAB_TOKEN_EXPIRACION=true.',
      );
    }
    const proposito = dto.proposito ?? 'expirado';
    if (
      proposito === 'vigente' &&
      !this.identidad.tokensVigentesHabilitados()
    ) {
      throw new ForbiddenException(
        'Este objetivo solo emite tokens de laboratorio ya expirados. Los tokens vigentes requieren LAB_TOKEN_VIGENTE_DEMO=true y no deben habilitarse en un servidor público.',
      );
    }
    return this.identidad.emitir(proposito, dto.margenSegundos);
  }
}
