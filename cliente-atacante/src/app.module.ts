import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { PruebasModule } from './pruebas/pruebas.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'web', 'dist'),
      exclude: ['/api', '/api/{*resto}'],
    }),
    PruebasModule,
  ],
})
export class AppModule {}
