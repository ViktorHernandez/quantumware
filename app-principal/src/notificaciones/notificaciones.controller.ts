import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { AuthGuard } from '../auth/auth.guard';
import { UsuarioActual } from '../auth/usuario-actual.decorator';
import type { UsuarioAutenticado } from '../auth/usuario-actual.decorator';
import { NotificacionesService } from './notificaciones.service';
import type { EventoNotificacion } from './notificaciones.service';
import { StreamTicketService } from './stream-ticket.service';
import { ConsultaNotificacionesDto } from './dto/consulta-notificaciones.dto';

@Controller('notificaciones')
export class NotificacionesController {
  constructor(
    private readonly notificaciones: NotificacionesService,
    private readonly tickets: StreamTicketService,
  ) {}

  @Get()
  @UseGuards(AuthGuard)
  listar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Query() consulta: ConsultaNotificacionesDto,
  ) {
    return this.notificaciones.listar(usuario.sub, {
      soloNoLeidas: consulta.soloNoLeidas === 'true',
      tipo: consulta.tipo,
      busqueda: consulta.busqueda,
      pagina: consulta.pagina,
      tamano: consulta.tamano,
    });
  }

  @Get('contador')
  @UseGuards(AuthGuard)
  contador(@UsuarioActual() usuario: UsuarioAutenticado) {
    return this.notificaciones.contador(usuario.sub);
  }

  @Get('recientes')
  @UseGuards(AuthGuard)
  recientes(@UsuarioActual() usuario: UsuarioAutenticado) {
    return this.notificaciones.recientes(usuario.sub);
  }

  @Post('ticket')
  @UseGuards(AuthGuard)
  ticket(@UsuarioActual() usuario: UsuarioAutenticado) {
    return { ticket: this.tickets.emitir(usuario.sub) };
  }

  @Sse('stream')
  stream(
    @Query('ticket') ticket: string,
  ): Observable<{ data: EventoNotificacion }> {
    const userId = this.tickets.consumir(ticket ?? '');
    return this.notificaciones.flujo(userId);
  }

  @Patch(':id/leer')
  @UseGuards(AuthGuard)
  marcarLeida(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.notificaciones.marcarLeida(usuario.sub, id);
  }

  @Post('leer-todas')
  @UseGuards(AuthGuard)
  marcarTodas(@UsuarioActual() usuario: UsuarioAutenticado) {
    return this.notificaciones.marcarTodas(usuario.sub);
  }
}
