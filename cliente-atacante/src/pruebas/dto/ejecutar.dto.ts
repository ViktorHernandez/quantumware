import { IsIn, IsObject, IsOptional, IsString, Matches } from 'class-validator';

export class EjecutarDto {
  @IsIn(['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])
  metodo!: string;

  @IsString()
  @Matches(/^\//)
  ruta!: string;

  @IsIn([
    'ninguno',
    'admin',
    'cliente',
    'alterado',
    'expirado',
    'personalizado',
  ])
  origenToken!:
    'ninguno' | 'admin' | 'cliente' | 'alterado' | 'expirado' | 'personalizado';

  @IsOptional()
  @IsString()
  tokenManual?: string;

  @IsOptional()
  @IsObject()
  cuerpo?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  cabeceras?: Record<string, string>;
}
