import { Global, Module } from '@nestjs/common';
import { NotificacionesController } from './notificaciones.controller';
import { NotificacionesService } from './notificaciones.service';
import { StreamTicketService } from './stream-ticket.service';
import { SupabaseAdminService } from '../usuarios/supabase-admin.service';

@Global()
@Module({
  controllers: [NotificacionesController],
  providers: [NotificacionesService, StreamTicketService, SupabaseAdminService],
  exports: [NotificacionesService],
})
export class NotificacionesModule {}
