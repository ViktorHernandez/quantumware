import { Module } from '@nestjs/common';
import { CorreoModule } from '../correo/correo.module';
import { DatabaseModule } from '../database/database.module';
import { CredencialTokenService } from './credencial-token.service';
import { CuentaController } from './cuenta.controller';
import { CuentaService } from './cuenta.service';
import { SupabaseAdminService } from '../usuarios/supabase-admin.service';

@Module({
  imports: [DatabaseModule, CorreoModule],
  controllers: [CuentaController],
  providers: [CuentaService, CredencialTokenService, SupabaseAdminService],
  exports: [CredencialTokenService, CuentaService],
})
export class CuentaModule {}
