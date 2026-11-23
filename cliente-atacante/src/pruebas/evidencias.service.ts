import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';

@Injectable()
export class EvidenciasService {
  constructor(private readonly config: ConfigService) {}

  private directorio(): string {
    const dir = this.config.get<string>('EVIDENCE_DIR', './evidencias');
    const ruta = resolve(dir);
    if (!existsSync(ruta)) {
      mkdirSync(ruta, { recursive: true });
    }
    return ruta;
  }

  guardar(identificador: string, contenido: unknown): string {
    const ruta = this.directorio();
    const marca = new Date().toISOString().replace(/[:.]/g, '-');
    const nombre = `${identificador}-${marca}.json`;
    const destino = join(ruta, nombre);
    writeFileSync(destino, JSON.stringify(contenido, null, 2), 'utf8');
    return nombre;
  }

  listar(): string[] {
    const ruta = this.directorio();
    return readdirSync(ruta).filter((f) => f.endsWith('.json'));
  }
}
