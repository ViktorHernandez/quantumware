import { IsIn } from 'class-validator';

export class CambiarEstadoDto {
  @IsIn([
    'procesando',
    'preparando',
    'empaquetado',
    'listo_envio',
    'enviado',
    'en_transito',
    'en_reparto',
    'entregado',
    'cancelado',
    'devuelto',
  ])
  estado!: string;
}
