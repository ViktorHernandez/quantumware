import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CrearMovimientoDto {
  @IsUUID()
  producto_id!: string;

  @IsIn(['entrada', 'salida', 'ajuste'])
  tipo!: 'entrada' | 'salida' | 'ajuste';

  @IsInt()
  @Min(1)
  cantidad!: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  motivo?: string;
}
