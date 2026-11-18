import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from './database/database.service';
import { MigracionesCheckService } from './database/migraciones-check.service';

@Controller('salud')
export class SaludController {
  constructor(
    private readonly config: ConfigService,
    private readonly db: DatabaseService,
    private readonly migraciones: MigracionesCheckService,
  ) {}

  @Get()
  async estado() {
    if (this.migraciones.estado().esquema === 'sin_verificar') {
      await this.migraciones.verificar();
    }
    return {
      servicio: 'app-principal',
      estado: 'activo',
      vulnMode: this.config.get<string>('VULN_MODE', 'corregido'),
      registroAbierto:
        this.config.get<string>('REGISTRO_ABIERTO', 'false').toLowerCase() ===
        'true',
      entorno: this.config.get<string>('NODE_ENV', 'development'),
      conexionBaseDatos: this.db.descripcionConexion(),
      ...this.migraciones.estado(),
    };
  }
}
