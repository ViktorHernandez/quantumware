import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class EscenarioDto {
  @IsString()
  id!: string;

  @IsOptional()
  @IsString()
  tokenManual?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  cantidad?: number;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  pedidoObjetivo?: string;
}
