import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const hosts = ['localhost', '127.0.0.1'];
  const origenesPermitidos = hosts.flatMap((h) => [
    `http://${h}:4000`,
    `http://${h}:5174`,
  ]);
  app.enableCors({
    origin: origenesPermitidos,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
}

bootstrap().catch((error) => {
  new Logger('Bootstrap').error('No se pudo iniciar la aplicación.', error);
  process.exit(1);
});
