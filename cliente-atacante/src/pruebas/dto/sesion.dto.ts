import { IsIn, IsOptional, Matches } from 'class-validator';

export class SesionDto {
  @IsIn(['admin', 'cliente'])
  rol!: 'admin' | 'cliente';

  @IsOptional()
  @Matches(/^[0-9]{6}$/, {
    message: 'El código de verificación en dos pasos debe tener 6 dígitos.',
  })
  codigoMfa?: string;
}
