import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { BrevoService } from '../src/correo/brevo.service';
import { CorreoSalidaService } from '../src/correo/correo-salida.service';
import { CredencialTokenService } from '../src/cuenta/credencial-token.service';
import { CuentaService } from '../src/cuenta/cuenta.service';
import { DatabaseService } from '../src/database/database.service';
import { NotificacionesService } from '../src/notificaciones/notificaciones.service';
import { SupabaseAdminService } from '../src/usuarios/supabase-admin.service';
import { UsuariosService } from '../src/usuarios/usuarios.service';

process.env.DATABASE_HOST = process.env.DATABASE_HOST ?? 'localhost';
process.env.DATABASE_PORT = process.env.DATABASE_PORT ?? '5432';
process.env.DATABASE_NAME = process.env.DATABASE_NAME ?? 'quantumware';
process.env.DATABASE_USER = process.env.DATABASE_USER ?? 'quantumware_app';
process.env.DATABASE_PASSWORD = process.env.DATABASE_PASSWORD ?? 'lab_pw_local';
process.env.APP_WEB_URL = 'http://localhost:5173';
process.env.CORREO_WORKER_ACTIVO = 'false';

const CLIENTE = 'zz-cta-recupera@example.test';
const INVITADO = 'zz-cta-invitado@example.test';
const SUB_CLIENTE = '00000000-0000-0000-0000-0000000000c1';
const SUB_ADMIN = '00000000-0000-0000-0000-0000000000a1';
const SUB_NUEVO = '00000000-0000-0000-0000-0000000000e1';

describe('Recuperación de contraseña e invitaciones por token propio', () => {
  let modulo: TestingModule;
  let db: DatabaseService;
  let cuenta: CuentaService;
  let tokens: CredencialTokenService;
  let usuarios: UsuariosService;
  let contrasenasAplicadas: { sub: string; password: string }[];
  let fallarProveedor = false;
  let cuentasCreadas: { email: string; password: string }[];

  async function limpiar() {
    await db.query(
      `DELETE FROM correo_salida WHERE lower(destinatario) LIKE 'zz-cta-%'`,
    );
    await db.query(
      `DELETE FROM credencial_token WHERE lower(email) LIKE 'zz-cta-%'`,
    );
    await db.query(`DELETE FROM invitacion WHERE lower(email) LIKE 'zz-cta-%'`);
    await db.query('DELETE FROM user_roles WHERE user_id = ANY($1::uuid[])', [
      [SUB_CLIENTE, SUB_NUEVO],
    ]);
    await db.query(
      'DELETE FROM perfil_usuario WHERE user_id = ANY($1::uuid[])',
      [[SUB_CLIENTE, SUB_NUEVO]],
    );
    await db.query('DELETE FROM notificacion WHERE user_id = $1', [SUB_ADMIN]);
  }

  async function tokenDelUltimoCorreo(destinatario: string): Promise<string> {
    const r = await db.query<{ texto: string }>(
      `SELECT texto FROM correo_salida WHERE destinatario = $1
       ORDER BY creado_en DESC LIMIT 1`,
      [destinatario],
    );
    const encontrado = /[?&]token=([A-Za-z0-9_-]{43})/.exec(r.rows[0].texto);
    if (!encontrado) {
      throw new Error('El correo encolado no contiene un enlace con token.');
    }
    return encontrado[1];
  }

  beforeAll(async () => {
    contrasenasAplicadas = [];
    cuentasCreadas = [];
    modulo = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true })],
      providers: [
        DatabaseService,
        CredencialTokenService,
        CorreoSalidaService,
        NotificacionesService,
        CuentaService,
        UsuariosService,
        { provide: BrevoService, useValue: { configurado: () => false } },
        {
          provide: SupabaseAdminService,
          useValue: {
            configurado: () => true,
            buscarPorEmail: (email: string) =>
              Promise.resolve(
                email.toLowerCase() === CLIENTE
                  ? { sub: SUB_CLIENTE, email: CLIENTE }
                  : null,
              ),
            actualizarContrasena: (sub: string, password: string) => {
              if (fallarProveedor) {
                return Promise.resolve({
                  ok: false,
                  mensaje: 'fallo simulado del proveedor',
                });
              }
              contrasenasAplicadas.push({ sub, password });
              return Promise.resolve({ ok: true });
            },
            crearConContrasena: (email: string, password: string) => {
              cuentasCreadas.push({ email, password });
              return Promise.resolve({ ok: true, sub: SUB_NUEVO });
            },
            eliminarUsuario: () => Promise.resolve({ ok: true }),
            usuariosPorId: () => Promise.resolve(new Map()),
          },
        },
      ],
    }).compile();
    db = modulo.get(DatabaseService);
    cuenta = modulo.get(CuentaService);
    tokens = modulo.get(CredencialTokenService);
    usuarios = modulo.get(UsuariosService);
    await limpiar();
    await db.query(
      `INSERT INTO perfil_usuario (user_id, nombre, email) VALUES ($1,'Cliente de prueba',$2)`,
      [SUB_CLIENTE, CLIENTE],
    );
    await db.query(
      `INSERT INTO user_roles (user_id, rol) VALUES ($1,'admin')
       ON CONFLICT (user_id) DO UPDATE SET rol = 'admin'`,
      [SUB_ADMIN],
    );
  });

  afterAll(async () => {
    await limpiar();
    await db.query('DELETE FROM user_roles WHERE user_id = $1', [SUB_ADMIN]);
    await modulo.close();
  });

  describe('Recuperación de contraseña', () => {
    it('una solicitud genera un token y encola el correo con el enlace', async () => {
      await cuenta.solicitarRecuperacion(CLIENTE);
      const correo = await db.query<{ asunto: string; texto: string }>(
        `SELECT asunto, texto FROM correo_salida WHERE destinatario = $1`,
        [CLIENTE],
      );
      expect(correo.rowCount).toBe(1);
      expect(correo.rows[0].texto).toContain(
        'http://localhost:5173/restablecer-contrasena?token=',
      );
      const fila = await db.query<{ tipo: string; usuario_sub: string }>(
        `SELECT tipo, usuario_sub FROM credencial_token WHERE lower(email) = $1`,
        [CLIENTE],
      );
      expect(fila.rowCount).toBe(1);
      expect(fila.rows[0].tipo).toBe('recuperacion');
      expect(fila.rows[0].usuario_sub).toBe(SUB_CLIENTE);
    });

    it('el enlace recién emitido se valida correctamente', async () => {
      const token = await tokenDelUltimoCorreo(CLIENTE);
      const estado = await cuenta.inspeccionar(token);
      expect(estado.valido).toBe(true);
      expect(estado.tipo).toBe('recuperacion');
      expect(estado.email).toBe(CLIENTE);
    });

    it('consultar el enlace NO lo consume: un rastreador de clics no lo invalida', async () => {
      const token = await tokenDelUltimoCorreo(CLIENTE);
      await cuenta.inspeccionar(token);
      await cuenta.inspeccionar(token);
      await cuenta.inspeccionar(token);
      const estado = await cuenta.inspeccionar(token);
      expect(estado.valido).toBe(true);
      const fila = await db.query<{ usado_en: Date | null }>(
        `SELECT usado_en FROM credencial_token WHERE lower(email) = $1`,
        [CLIENTE],
      );
      expect(fila.rows[0].usado_en).toBeNull();
    });

    it('establece la contraseña en el proveedor de identidad y marca el token como usado', async () => {
      const token = await tokenDelUltimoCorreo(CLIENTE);
      const r = await cuenta.establecerContrasena(token, 'ClaveNueva123');
      expect(r.ok).toBe(true);
      expect(r.tipo).toBe('recuperacion');
      expect(contrasenasAplicadas).toEqual([
        { sub: SUB_CLIENTE, password: 'ClaveNueva123' },
      ]);
      const fila = await db.query<{ usado_en: Date | null }>(
        `SELECT usado_en FROM credencial_token WHERE lower(email) = $1`,
        [CLIENTE],
      );
      expect(fila.rows[0].usado_en).not.toBeNull();
    });

    it('el mismo enlace no puede reutilizarse', async () => {
      const token = await tokenDelUltimoCorreo(CLIENTE);
      const r = await cuenta.establecerContrasena(token, 'OtraClave456');
      expect(r.ok).toBe(false);
      expect(r.mensaje).toContain('ya fue utilizado');
      expect(contrasenasAplicadas).toHaveLength(1);
    });

    it('un token expirado se rechaza con su motivo', async () => {
      const emitido = await tokens.emitir({
        tipo: 'recuperacion',
        email: CLIENTE,
        usuarioSub: SUB_CLIENTE,
        minutosVigencia: 60,
      });
      await db.query(
        `UPDATE credencial_token SET expira_en = now() - interval '1 minute' WHERE id = $1`,
        [emitido.id],
      );
      const estado = await cuenta.inspeccionar(emitido.token);
      expect(estado.valido).toBe(false);
      expect(estado.motivo).toBe('expirado');
      const r = await cuenta.establecerContrasena(emitido.token, 'Clave789012');
      expect(r.ok).toBe(false);
    });

    it('emitir un enlace nuevo anula el anterior', async () => {
      await db.query(`DELETE FROM credencial_token WHERE lower(email) = $1`, [
        CLIENTE,
      ]);
      await db.query(`DELETE FROM correo_salida WHERE destinatario = $1`, [
        CLIENTE,
      ]);
      await cuenta.solicitarRecuperacion(CLIENTE);
      const primero = await tokenDelUltimoCorreo(CLIENTE);
      await cuenta.solicitarRecuperacion(CLIENTE);
      const segundo = await tokenDelUltimoCorreo(CLIENTE);
      expect(segundo).not.toBe(primero);

      const viejo = await cuenta.inspeccionar(primero);
      expect(viejo.valido).toBe(false);
      expect(viejo.motivo).toBe('anulado');
      const nuevo = await cuenta.inspeccionar(segundo);
      expect(nuevo.valido).toBe(true);
    });

    it('limita la frecuencia de solicitudes sin desactivar la protección', async () => {
      await db.query(`DELETE FROM credencial_token WHERE lower(email) = $1`, [
        CLIENTE,
      ]);
      await cuenta.solicitarRecuperacion(CLIENTE);
      await cuenta.solicitarRecuperacion(CLIENTE);
      await cuenta.solicitarRecuperacion(CLIENTE);
      const antes = await db.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM credencial_token WHERE lower(email) = $1`,
        [CLIENTE],
      );
      await cuenta.solicitarRecuperacion(CLIENTE);
      const despues = await db.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM credencial_token WHERE lower(email) = $1`,
        [CLIENTE],
      );
      expect(Number(antes.rows[0].n)).toBe(3);
      expect(Number(despues.rows[0].n)).toBe(3);
    });

    it('si el proveedor de identidad falla, el enlace NO se consume y sigue sirviendo', async () => {
      await db.query(`DELETE FROM credencial_token WHERE lower(email) = $1`, [
        CLIENTE,
      ]);
      const emitido = await tokens.emitir({
        tipo: 'recuperacion',
        email: CLIENTE,
        usuarioSub: SUB_CLIENTE,
        minutosVigencia: 60,
      });

      fallarProveedor = true;
      await expect(
        cuenta.establecerContrasena(emitido.token, 'ClaveFalla123'),
      ).rejects.toThrow('fallo simulado del proveedor');
      fallarProveedor = false;

      const fila = await db.query<{ usado_en: Date | null }>(
        'SELECT usado_en FROM credencial_token WHERE id = $1',
        [emitido.id],
      );
      expect(fila.rows[0].usado_en).toBeNull();

      const reintento = await cuenta.establecerContrasena(
        emitido.token,
        'ClaveReintento1',
      );
      expect(reintento.ok).toBe(true);
    });

    it('un correo sin cuenta no genera token ni revela su existencia', async () => {
      await cuenta.solicitarRecuperacion('zz-cta-inexistente@example.test');
      const fila = await db.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM credencial_token WHERE lower(email) = $1`,
        ['zz-cta-inexistente@example.test'],
      );
      expect(Number(fila.rows[0].n)).toBe(0);
    });
  });

  describe('Invitaciones', () => {
    it('invitar genera la invitación, su token y el correo con el enlace', async () => {
      const r = await usuarios.invitar(
        { email: INVITADO, rol: 'admin' },
        SUB_ADMIN,
      );
      expect(r.estado).toBe('pendiente');
      const correo = await db.query<{ texto: string }>(
        `SELECT texto FROM correo_salida WHERE destinatario = $1`,
        [INVITADO],
      );
      expect(correo.rowCount).toBe(1);
      expect(correo.rows[0].texto).toContain(
        'http://localhost:5173/aceptar-invitacion?token=',
      );
      const fila = await db.query<{ tipo: string; rol: string }>(
        `SELECT tipo, rol FROM credencial_token WHERE lower(email) = $1`,
        [INVITADO],
      );
      expect(fila.rows[0].tipo).toBe('invitacion');
      expect(fila.rows[0].rol).toBe('admin');
    });

    it('el enlace de invitación se identifica como invitación, no como recuperación', async () => {
      const token = await tokenDelUltimoCorreo(INVITADO);
      const estado = await cuenta.inspeccionar(token);
      expect(estado.valido).toBe(true);
      expect(estado.tipo).toBe('invitacion');
      expect(estado.email).toBe(INVITADO);
    });

    it('aceptarla crea la cuenta, asigna el rol fijado por el administrador y marca la invitación', async () => {
      const token = await tokenDelUltimoCorreo(INVITADO);
      const r = await cuenta.establecerContrasena(token, 'ClaveInvitado1');
      expect(r.ok).toBe(true);
      expect(r.tipo).toBe('invitacion');
      expect(cuentasCreadas).toEqual([
        { email: INVITADO, password: 'ClaveInvitado1' },
      ]);

      const rol = await db.query<{ rol: string }>(
        'SELECT rol FROM user_roles WHERE user_id = $1',
        [SUB_NUEVO],
      );
      expect(rol.rows[0].rol).toBe('admin');

      const perfil = await db.query<{ email: string }>(
        'SELECT email FROM perfil_usuario WHERE user_id = $1',
        [SUB_NUEVO],
      );
      expect(perfil.rows[0].email).toBe(INVITADO);

      const invitacion = await db.query<{
        estado: string;
        usuario_sub: string;
      }>('SELECT estado, usuario_sub FROM invitacion WHERE lower(email) = $1', [
        INVITADO,
      ]);
      expect(invitacion.rows[0].estado).toBe('aceptada');
      expect(invitacion.rows[0].usuario_sub).toBe(SUB_NUEVO);
    });

    it('la invitación aceptada no puede reutilizarse', async () => {
      const token = await tokenDelUltimoCorreo(INVITADO);
      const r = await cuenta.establecerContrasena(token, 'Reutilizada123');
      expect(r.ok).toBe(false);
      expect(cuentasCreadas).toHaveLength(1);
    });

    it('revocar una invitación pendiente anula su enlace', async () => {
      await db.query(`DELETE FROM credencial_token WHERE lower(email) = $1`, [
        INVITADO,
      ]);
      await db.query(`DELETE FROM invitacion WHERE lower(email) = $1`, [
        INVITADO,
      ]);
      await db.query(`DELETE FROM correo_salida WHERE destinatario = $1`, [
        INVITADO,
      ]);
      await db.query('DELETE FROM user_roles WHERE user_id = $1', [SUB_NUEVO]);
      await db.query('DELETE FROM perfil_usuario WHERE user_id = $1', [
        SUB_NUEVO,
      ]);

      const creada = await usuarios.invitar(
        { email: INVITADO, rol: 'cliente' },
        SUB_ADMIN,
      );
      const token = await tokenDelUltimoCorreo(INVITADO);
      await usuarios.revocarInvitacion(creada.id);

      const estado = await cuenta.inspeccionar(token);
      expect(estado.valido).toBe(false);
      expect(estado.motivo).toBe('anulado');
      const r = await cuenta.establecerContrasena(token, 'NoDeberia123');
      expect(r.ok).toBe(false);
    });
  });
});
