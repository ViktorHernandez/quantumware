import { IsEmail, IsIn } from 'class-validator';

export class InvitarUsuarioDto {
  @IsEmail()
  email!: string;

  @IsIn(['admin', 'cliente'])
  rol!: string;
}
