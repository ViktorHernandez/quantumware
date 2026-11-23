import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

interface ErrorPg {
  code?: string;
  message?: string;
}

const CODIGOS_ESQUEMA = ['42703', '42P01'];

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Excepciones');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      const mensaje =
        typeof payload === 'string'
          ? payload
          : ((payload as Record<string, unknown>).message ?? exception.message);
      response.status(status).json({
        statusCode: status,
        error: this.nombreError(status),
        message: mensaje,
      });
      return;
    }

    this.registrarCausaReal(exception);

    const status = HttpStatus.INTERNAL_SERVER_ERROR;
    response.status(status).json({
      statusCode: status,
      error: 'Internal Server Error',
      message: 'Ocurrió un error interno en el servidor.',
    });
  }

  private registrarCausaReal(exception: unknown): void {
    if (exception instanceof Error) {
      this.logger.error(
        `Error no controlado: ${exception.message}`,
        exception.stack,
      );
    } else {
      this.logger.error(`Error no controlado: ${String(exception)}`);
    }
    const codigo = (exception as ErrorPg)?.code;
    if (codigo && CODIGOS_ESQUEMA.includes(codigo)) {
      this.logger.error(
        'La base de datos no tiene el esquema esperado (columna o tabla inexistente). ' +
          'Aplica las migraciones pendientes con db\\aplicar-migraciones.ps1 y revisa GET /salud.',
      );
    }
  }

  private nombreError(status: number): string {
    const mapa: Record<number, string> = {
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      409: 'Conflict',
      422: 'Unprocessable Entity',
    };
    return mapa[status] ?? 'Error';
  }
}
