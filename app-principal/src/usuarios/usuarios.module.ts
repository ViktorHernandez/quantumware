import { Module } from '@nestjs/common';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';
import { SupabaseAdminService } from './supabase-admin.service';

import { CuentaModule } from '../cuenta/cuenta.module';

@Module({
  imports: [CuentaModule],
  controllers: [UsuariosController],
  providers: [UsuariosService, SupabaseAdminService],
  exports: [UsuariosService],
})
export class UsuariosModule {}
