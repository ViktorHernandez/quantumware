import { Module } from '@nestjs/common';
import { PedidosController } from './pedidos.controller';
import { PedidosService } from './pedidos.service';
import { SeguimientoDemoService } from './seguimiento-demo.service';

@Module({
  controllers: [PedidosController],
  providers: [PedidosService, SeguimientoDemoService],
  exports: [PedidosService],
})
export class PedidosModule {}
