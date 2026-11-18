import { Global, Module } from '@nestjs/common';
import { BrevoService } from './brevo.service';
import { CorreoSalidaService } from './correo-salida.service';

@Global()
@Module({
  providers: [BrevoService, CorreoSalidaService],
  exports: [BrevoService, CorreoSalidaService],
})
export class CorreoModule {}
