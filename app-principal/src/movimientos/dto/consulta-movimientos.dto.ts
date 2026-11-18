import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class ConsultaMovimientosDto {
  @IsOptional()
  @IsUUID()
  producto_id?: string;

  @IsOptional()
  @IsIn(['entrada', 'salida', 'ajuste'])
  tipo?: string;

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
