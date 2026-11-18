import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { LaboratorioService } from './laboratorio.service';
import { ResistenciaDto } from './dto/resistencia.dto';

@Controller('lab')
@UseGuards(AuthGuard)
export class LaboratorioController {
  constructor(private readonly laboratorio: LaboratorioService) {}

  @Post('resistencia-autenticacion')
  resistencia(@Body() dto: ResistenciaDto) {
    return this.laboratorio.resistenciaAutenticacion(dto.intentos);
  }
}
