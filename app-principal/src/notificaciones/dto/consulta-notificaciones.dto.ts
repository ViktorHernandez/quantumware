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

export class ConsultaNotificacionesDto {
  @IsOptional()
  @IsIn(['true', 'false'])
  soloNoLeidas?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  tipo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  busqueda?: string;

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
