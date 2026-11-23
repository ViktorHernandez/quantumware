import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

interface RespuestaError {
  statusCode: number;
  error: string;
  message: string;
}

function hostFalso() {
  const json = jest.fn<void, [RespuestaError]>();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
    }),
  };
  return { host, status, json };
}

describe('HttpExceptionFilter', () => {
  const filter = new HttpExceptionFilter();

  it('conserva el estado de una HttpException', () => {
    const { host, status, json } = hostFalso();
    filter.catch(
      new HttpException('Prohibido', HttpStatus.FORBIDDEN),
      host as never,
    );
    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403, error: 'Forbidden' }),
    );
  });

  it('convierte un error genérico en 500 sin filtrar detalles', () => {
    const registro = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const { host, status, json } = hostFalso();
    filter.catch(new Error('detalle interno con SQL'), host as never);
    expect(status).toHaveBeenCalledWith(500);
    const argumento = json.mock.calls[0][0];
    expect(argumento.statusCode).toBe(500);
    expect(argumento.message).not.toContain('SQL');
    expect(registro).toHaveBeenCalledTimes(1);
    registro.mockRestore();
  });
});
