import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CrearResenaDto {
  @IsInt()
  @Min(1)
  @Max(5)
  puntuacion!: number;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  comentario?: string;
}
