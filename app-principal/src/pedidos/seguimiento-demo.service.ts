import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';
import { PedidosService } from './pedidos.service';

@Injectable()
export class SeguimientoDemoService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('SeguimientoDemo');
  private temporizador: ReturnType<typeof setInterval> | null = null;
  private ocupado = false;

  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    private readonly pedidos: PedidosService,
  ) {}

  onModuleInit(): void {
    const activo =
      this.config
        .get<string>('PEDIDO_AVANCE_AUTOMATICO', 'true')
        .toLowerCase() !== 'false';
    if (!activo) {
      return;
    }
    const intervalo = Math.max(
      5000,
      Number(this.config.get<string>('PEDIDO_AVANCE_SONDEO_MS', '30000')),
    );
    this.logger.log(
      `Avance automático de pedidos activo (sondeo cada ${intervalo} ms).`,
    );
    this.temporizador = setInterval(() => {
      void this.tick().catch(() => undefined);
    }, intervalo);
    this.temporizador.unref?.();
  }

  onModuleDestroy(): void {
    if (this.temporizador) {
      clearInterval(this.temporizador);
      this.temporizador = null;
    }
  }

  private async tick(): Promise<void> {
    if (this.ocupado) {
      return;
    }
    this.ocupado = true;
    try {
      await this.pedidos.procesarTransicionesVencidas();
    } finally {
      this.ocupado = false;
    }
  }
}
