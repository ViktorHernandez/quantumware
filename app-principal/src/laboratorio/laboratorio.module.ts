import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LaboratorioController } from './laboratorio.controller';
import { LaboratorioService } from './laboratorio.service';

@Module({
  imports: [AuthModule],
  controllers: [LaboratorioController],
  providers: [LaboratorioService],
})
export class LaboratorioModule {}
