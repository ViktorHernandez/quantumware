import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class EstablecerContrasenaDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{43}$/, {
    message: 'El enlace no tiene un formato válido.',
  })
  token!: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
  @MaxLength(72, { message: 'La contraseña no debe exceder 72 caracteres.' })
  password!: string;
}
