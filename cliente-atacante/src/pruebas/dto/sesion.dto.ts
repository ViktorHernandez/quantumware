import { IsIn } from 'class-validator';

export class SesionDto {
  @IsIn(['admin', 'cliente'])
  rol!: 'admin' | 'cliente';
}
