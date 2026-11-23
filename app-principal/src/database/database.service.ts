import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool: Pool;
  private readonly conexion: string;

  constructor(config: ConfigService) {
    const url = config.get<string>('DATABASE_URL', '');
    const esquema = (config.get<string>('DATABASE_SCHEMA', '') || '').trim();
    const opciones =
      esquema && /^[A-Za-z_][A-Za-z0-9_]*$/.test(esquema)
        ? `-c search_path=${esquema}`
        : undefined;
    if (url) {
      const sslActivo =
        config.get<string>('DATABASE_SSL', 'true').toLowerCase() !== 'false';
      this.pool = new Pool({
        connectionString: url,
        ssl: sslActivo ? { rejectUnauthorized: false } : undefined,
        max: 10,
        connectionTimeoutMillis: 8000,
        options: opciones,
      });
      this.conexion = `remota mediante DATABASE_URL (base ${this.nombreBaseDeUrl(url)}${
        esquema ? `, esquema ${esquema}` : ''
      })`;
    } else {
      const host = config.get<string>('DATABASE_HOST', 'localhost');
      const puerto = config.get<string>('DATABASE_PORT', '5432');
      const nombre = config.get<string>('DATABASE_NAME', 'quantumware');
      this.pool = new Pool({
        host,
        port: Number(puerto),
        database: nombre,
        user: config.get<string>('DATABASE_USER', 'quantumware_app'),
        password: config.get<string>('DATABASE_PASSWORD', ''),
        ssl: false,
        max: 10,
        connectionTimeoutMillis: 8000,
        options: opciones,
      });
      this.conexion = `parámetros locales (${host}:${puerto}/${nombre}${
        esquema ? `, esquema ${esquema}` : ''
      })`;
    }
  }

  private nombreBaseDeUrl(url: string): string {
    try {
      const ruta = new URL(url).pathname.replace(/^\//, '');
      return ruta || 'desconocida';
    } catch {
      return 'desconocida';
    }
  }

  descripcionConexion(): string {
    return this.conexion;
  }

  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, params as never[]);
  }

  async transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const resultado = await fn(client);
      await client.query('COMMIT');
      return resultado;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
