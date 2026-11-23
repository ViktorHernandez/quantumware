import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ConsultaProductosDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  categoria?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  stockBajo?: string;

  @IsOptional()
  @IsIn(['activo', 'archivado', 'todos'])
  estado?: string;

  @IsOptional()
  @IsIn(['nombre', 'categoria', 'precio', 'stock'])
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
  @Max(100)
  tamano?: number;
}
