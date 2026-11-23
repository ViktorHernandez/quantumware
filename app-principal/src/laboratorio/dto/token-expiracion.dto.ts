import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class TokenExpiracionDto {
  @IsOptional()
  @IsIn(['expirado', 'vigente'])
  proposito?: 'expirado' | 'vigente';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(86400)
  margenSegundos?: number;
}
