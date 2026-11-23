import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const puertosPermitidos = ['3000', '4000', '5173'];
  const hosts = ['localhost', '127.0.0.1'];
  const origenesBase = hosts.flatMap((h) =>
    puertosPermitidos.map((p) => `http://${h}:${p}`),
  );
  const origenesExtra = (process.env.CORS_EXTRA_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0);
  app.enableCors({
    origin: [...origenesBase, ...origenesExtra],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
}

bootstrap().catch((error) => {
  new Logger('Bootstrap').error('No se pudo iniciar la aplicación.', error);
  process.exit(1);
});
