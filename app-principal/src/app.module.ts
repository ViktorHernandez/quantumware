import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { DatabaseModule } from './database/database.module';
import { CorreoModule } from './correo/correo.module';
import { AuthModule } from './auth/auth.module';
import { ProductosModule } from './productos/productos.module';
import { PedidosModule } from './pedidos/pedidos.module';
import { PerfilModule } from './perfil/perfil.module';
import { CuentaModule } from './cuenta/cuenta.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { MovimientosModule } from './movimientos/movimientos.module';
import { LaboratorioModule } from './laboratorio/laboratorio.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { NotificacionesModule } from './notificaciones/notificaciones.module';
import { ResenasModule } from './resenas/resenas.module';
import { SeguridadModule } from './seguridad/seguridad.module';
import { SaludController } from './salud.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'web', 'dist'),
      exclude: [
        '/salud',
        '/productos',
        '/productos/{*resto}',
        '/pedidos',
        '/pedidos/{*resto}',
        '/perfil',
        '/perfil/{*resto}',
        '/usuarios',
        '/usuarios/{*resto}',
        '/cuenta',
        '/cuenta/{*resto}',
        '/movimientos',
        '/movimientos/{*resto}',
        '/dashboard',
        '/dashboard/{*resto}',
        '/notificaciones',
        '/notificaciones/{*resto}',
        '/lab',
        '/lab/{*resto}',
      ],
    }),
    DatabaseModule,
    CorreoModule,
    AuthModule,
    ProductosModule,
    PedidosModule,
    PerfilModule,
    UsuariosModule,
    CuentaModule,
    MovimientosModule,
    DashboardModule,
    NotificacionesModule,
    ResenasModule,
    SeguridadModule,
    LaboratorioModule,
  ],
  controllers: [SaludController],
})
export class AppModule {}
