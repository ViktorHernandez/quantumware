import { IsEmail, MaxLength } from 'class-validator';

export class SolicitarRecuperacionDto {
  @IsEmail({}, { message: 'El correo electrónico no es válido.' })
  @MaxLength(255)
  email!: string;
}
