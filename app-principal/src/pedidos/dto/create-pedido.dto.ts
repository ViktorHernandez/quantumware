import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class ItemPedidoDto {
  @IsUUID()
  producto_id!: string;

  @IsInt()
  @Min(1)
  cantidad!: number;
}

export class CreatePedidoDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ItemPedidoDto)
  items!: ItemPedidoDto[];

  @IsOptional()
  @IsString()
  @MaxLength(64)
  clave_idempotencia?: string;
}
