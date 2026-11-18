import { IsInt, Max, Min } from 'class-validator';

export class ResistenciaDto {
  @IsInt()
  @Min(1)
  @Max(20)
  intentos!: number;
}
