import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { PedidosService } from './pedidos/pedidos.service';
import { CorreoSalidaService } from './correo/correo-salida.service';

async function ejecutar(): Promise<void> {
  const registro = new Logger('ProcesarTransiciones');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['warn', 'error'],
  });
  try {
    const pedidos = app.get(PedidosService);
    const resultado = await pedidos.procesarTransicionesVencidas(200);
    registro.log(
      `Transiciones aplicadas: ${resultado.procesados}${
        resultado.procesados > 0
          ? ' -> ' + resultado.avances.map((a) => a.estado).join(', ')
          : ''
      }`,
    );
    const correo = app.get(CorreoSalidaService);
    const envio = await correo.procesarPendientes(100);
    registro.log(
      `Correos procesados: ${envio.procesados} (enviados ${envio.enviados}, reintentos ${envio.reintentos}, fallidos ${envio.fallidos})`,
    );
  } finally {
    await app.close();
  }
}

ejecutar()
  .then(() => process.exit(0))
  .catch((e: unknown) => {
    new Logger('ProcesarTransiciones').error(
      `Fallo al procesar: ${(e as Error).message}`,
    );
    process.exit(1);
  });
