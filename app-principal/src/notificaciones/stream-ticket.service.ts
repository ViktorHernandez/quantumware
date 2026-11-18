import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'crypto';

interface TicketInfo {
  userId: string;
  expira: number;
}

const VIGENCIA_MS = 30000;

@Injectable()
export class StreamTicketService {
  private readonly tickets = new Map<string, TicketInfo>();

  emitir(userId: string): string {
    this.purgar();
    const ticket = randomUUID();
    this.tickets.set(ticket, { userId, expira: Date.now() + VIGENCIA_MS });
    return ticket;
  }

  consumir(ticket: string): string {
    const info = this.tickets.get(ticket);
    this.tickets.delete(ticket);
    if (!info || info.expira < Date.now()) {
      throw new UnauthorizedException(
        'Ticket de conexión inválido o expirado.',
      );
    }
    return info.userId;
  }

  private purgar(): void {
    const ahora = Date.now();
    for (const [clave, info] of this.tickets.entries()) {
      if (info.expira < ahora) {
        this.tickets.delete(clave);
      }
    }
  }
}
