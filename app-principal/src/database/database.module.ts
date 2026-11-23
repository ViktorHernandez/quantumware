import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { MigracionesCheckService } from './migraciones-check.service';

@Global()
@Module({
  providers: [DatabaseService, MigracionesCheckService],
  exports: [DatabaseService, MigracionesCheckService],
})
export class DatabaseModule {}
