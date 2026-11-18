import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Length,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateProductoDto {
  @IsString()
  @Length(1, 120)
  nombre!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descripcion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  categoria?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  precio!: number;

  @IsInt()
  @Min(0)
  stock!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  stock_minimo?: number;

  @IsOptional()
  @IsString()
  @Matches(/^\/media\/productos\/[a-z0-9-]+\.webp$/, {
    message:
      'imagen_url debe ser una ruta del catálogo, por ejemplo /media/productos/audifonos.webp',
  })
  imagen_url?: string;
}
