import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class ConsultaPedidosDto {
  @IsOptional()
  @IsIn(['true', 'false'])
  todos?: string;

  @IsOptional()
  @IsIn(['registrado', 'confirmado', 'enviado', 'entregado', 'cancelado'])
  estado?: string;

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
