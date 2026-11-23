import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ModerarResenaDto {
  @IsIn(['ocultar', 'publicar'])
  accion!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivo?: string;
}
