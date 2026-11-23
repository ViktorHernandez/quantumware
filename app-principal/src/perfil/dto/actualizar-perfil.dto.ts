import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class ActualizarPerfilDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  nombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Matches(/^[0-9+()\s-]*$/)
  telefono?: string;
}
