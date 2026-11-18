import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { BrevoService } from './brevo.service';

function servicio(valores: Record<string, string>) {
  const config = {
    get: (clave: string, def?: string) => valores[clave] ?? def,
  } as unknown as ConfigService;
  return new BrevoService(config);
}

describe('BrevoService', () => {
  it('no está configurado sin API key ni remitente', () => {
    expect(servicio({}).configurado()).toBe(false);
    expect(servicio({ BREVO_API_KEY: 'x' }).configurado()).toBe(false);
  });

  it('está configurado con API key y remitente', () => {
    const s = servicio({
      BREVO_API_KEY: 'x',
      BREVO_SENDER_EMAIL: 'no-reply@quantumware.local',
    });
    expect(s.configurado()).toBe(true);
  });

  it('enviar es un no-op seguro cuando no está configurado', async () => {
    const registro = jest
      .spyOn(Logger.prototype, 'debug')
      .mockImplementation(() => undefined);
    const s = servicio({});
    const ok = await s.enviar({
      para: 'a@b.c',
      asunto: 'Prueba',
      html: '<p>hola</p>',
    });
    expect(ok).toBe(false);
    registro.mockRestore();
  });

  it('envía mediante la API cuando está configurado', async () => {
    const s = servicio({
      BREVO_API_KEY: 'clave',
      BREVO_SENDER_EMAIL: 'no-reply@quantumware.local',
    });
    const fetchOriginal = global.fetch;
    const espia = jest.fn().mockResolvedValue({ ok: true, status: 201 });
    global.fetch = espia;
    try {
      const ok = await s.enviar({
        para: 'cliente@correo.com',
        asunto: 'Pedido registrado',
        html: '<p>Tu pedido</p>',
      });
      expect(ok).toBe(true);
      expect(espia).toHaveBeenCalledWith(
        'https://api.brevo.com/v3/smtp/email',
        expect.objectContaining({ method: 'POST' }),
      );
    } finally {
      global.fetch = fetchOriginal;
    }
  });
});
