import { Module } from '@nestjs/common';
import { PruebasController } from './pruebas.controller';
import { MotorService } from './motor.service';
import { SesionService } from './sesion.service';
import { EvidenciasService } from './evidencias.service';
import { EscenariosService } from './escenarios.service';

@Module({
  controllers: [PruebasController],
  providers: [
    MotorService,
    SesionService,
    EvidenciasService,
    EscenariosService,
  ],
})
export class PruebasModule {}
