import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService } from '../src/database/database.service';
import { RolesService } from '../src/auth/roles.service';

process.env.DATABASE_HOST = process.env.DATABASE_HOST ?? 'localhost';
process.env.DATABASE_PORT = process.env.DATABASE_PORT ?? '5432';
process.env.DATABASE_NAME = process.env.DATABASE_NAME ?? 'quantumware';
process.env.DATABASE_USER = process.env.DATABASE_USER ?? 'quantumware_app';
process.env.DATABASE_PASSWORD = process.env.DATABASE_PASSWORD ?? 'lab_pw_local';
process.env.ADMIN_EMAILS =
  'jefe@quantumware.local, OTRO.ADMIN@quantumware.local';

const A = '00000000-0000-0000-0000-0000000a0001';
const B = '00000000-0000-0000-0000-0000000b0002';
const C = '00000000-0000-0000-0000-0000000c0003';
const D = '00000000-0000-0000-0000-0000000d0004';
const IDS = [A, B, C, D];

describe('Asignación segura de roles (integración)', () => {
  let modulo: TestingModule;
  let db: DatabaseService;
  let roles: RolesService;

  beforeAll(async () => {
    modulo = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true })],
      providers: [DatabaseService, RolesService],
    }).compile();
    db = modulo.get(DatabaseService);
    roles = modulo.get(RolesService);
    await limpiar();
  });

  afterAll(async () => {
    await limpiar();
    await modulo.close();
  });

  async function limpiar() {
    await db.query('DELETE FROM user_roles WHERE user_id = ANY($1::uuid[])', [
      IDS,
    ]);
  }

  it('asigna admin a un correo de la lista blanca y lo persiste', async () => {
    const rol = await roles.asegurarRol(A, 'JEFE@quantumware.local');
    expect(rol).toBe('admin');
    expect(await roles.rolDe(A)).toBe('admin');
  });

  it('asigna cliente automáticamente a un usuario sin rol fuera de la lista', async () => {
    const rol = await roles.asegurarRol(B, 'persona@correo.com');
    expect(rol).toBe('cliente');
    expect(await roles.rolDe(B)).toBe('cliente');
  });

  it('no degrada a un administrador existente que no está en la lista', async () => {
    await db.query(
      `INSERT INTO user_roles (user_id, rol) VALUES ($1, 'admin')`,
      [C],
    );
    const rol = await roles.asegurarRol(C, 'admin.manual@correo.com');
    expect(rol).toBe('admin');
  });

  it('un cliente no puede autopromoverse: el rol no depende de un correo arbitrario del cliente sino del verificado', async () => {
    const rol = await roles.asegurarRol(B, 'persona@correo.com');
    expect(rol).toBe('cliente');
  });

  it('promueve a admin una cuenta que ya existía como cliente cuando su correo entra a ADMIN_EMAILS', async () => {
    await db.query(
      `INSERT INTO user_roles (user_id, rol) VALUES ($1, 'cliente')
       ON CONFLICT (user_id) DO UPDATE SET rol = 'cliente'`,
      [A],
    );
    expect(await roles.rolDe(A)).toBe('cliente');
    const rol = await roles.asegurarRol(A, 'otro.admin@quantumware.local');
    expect(rol).toBe('admin');
    expect(await roles.rolDe(A)).toBe('admin');
  });

  it('una cuenta cuyo correo no está en ADMIN_EMAILS nunca obtiene admin aunque se consulte varias veces', async () => {
    const correoCliente = 'cliente.de.prueba@correo.com';
    expect(await roles.asegurarRol(B, correoCliente)).toBe('cliente');
    expect(await roles.asegurarRol(B, correoCliente)).toBe('cliente');
    expect(await roles.esAdmin(B)).toBe(false);
  });

  it('exige coincidencia exacta de correo: un correo parecido pero distinto no sustituye al administrador', async () => {
    expect(await roles.asegurarRol(A, 'jefe@quantumware.local')).toBe('admin');
    expect(await roles.asegurarRol(D, 'jefe2@quantumware.local')).toBe(
      'cliente',
    );
    expect(await roles.asegurarRol(D, 'jefe-personal@quantumware.local')).toBe(
      'cliente',
    );
    expect(await roles.esAdmin(D)).toBe(false);
  });

  it('reconoce al administrador sin distinguir mayúsculas ni espacios sobrantes', async () => {
    expect(await roles.asegurarRol(B, '  OTRO.ADMIN@quantumware.local ')).toBe(
      'admin',
    );
  });
});
