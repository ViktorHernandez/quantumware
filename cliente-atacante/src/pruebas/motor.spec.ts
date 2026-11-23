import { enmascararToken } from './enmascarar';

describe('enmascararToken', () => {
  it('devuelve null cuando no hay token', () => {
    expect(enmascararToken(null)).toBeNull();
  });

  it('oculta tokens cortos por completo', () => {
    expect(enmascararToken('abc123')).toBe('***');
  });

  it('muestra solo los extremos de un token largo', () => {
    const token =
      'eyJhbGciOiJFUzI1NiIsImtpZCI6ImxhYi1rZXktMSJ9.payload.firmaDePrueba';
    const salida = enmascararToken(token);
    expect(salida).toContain('[enmascarado]');
    expect(salida).toContain('eyJhbGciOi');
    expect(salida).not.toContain('payload');
  });
});
