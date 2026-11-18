import { IsIn, IsUUID } from 'class-validator';

export class AsignarRolDto {
  @IsUUID()
  user_id!: string;

  @IsIn(['admin', 'cliente'])
  rol!: 'admin' | 'cliente';
}
