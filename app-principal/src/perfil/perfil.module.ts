import { Module } from '@nestjs/common';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { PerfilController } from './perfil.controller';
import { PerfilService } from './perfil.service';

@Module({
  imports: [UsuariosModule],
  controllers: [PerfilController],
  providers: [PerfilService],
})
export class PerfilModule {}
