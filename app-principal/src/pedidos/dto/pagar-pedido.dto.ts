import { IsIn, IsOptional, IsString, Matches } from 'class-validator';

export class PagarPedidoDto {
  @IsIn([
    'tarjeta_credito',
    'tarjeta_debito',
    'transferencia',
    'efectivo_simulado',
  ])
  metodo!: string;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{4}$/)
  tarjeta_ultimos4?: string;
}
