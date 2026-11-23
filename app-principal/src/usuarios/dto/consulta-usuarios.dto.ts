import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ConsultaUsuariosDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsIn(['admin', 'cliente', 'sin_rol'])
  rol?: string;

  @IsOptional()
  @IsIn(['nombre', 'email', 'rol', 'actualizado'])
  orden?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  direccion?: string;
}
