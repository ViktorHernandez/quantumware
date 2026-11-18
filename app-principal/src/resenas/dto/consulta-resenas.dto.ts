import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class ConsultaResenasDto {
  @IsOptional()
  @IsIn(['fecha', 'puntuacion', 'utilidad'])
  orden?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  direccion?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  tamano?: number;
}
