import { Module } from '@nestjs/common';
import {
  ProductoResenasController,
  ResenasController,
} from './resenas.controller';
import { ResenasService } from './resenas.service';

@Module({
  controllers: [ProductoResenasController, ResenasController],
  providers: [ResenasService],
  exports: [ResenasService],
})
export class ResenasModule {}
