import {
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PoolClient } from 'pg';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { CreatePedidoDto } from './dto/create-pedido.dto';
import { PagarPedidoDto } from './dto/pagar-pedido.dto';
import { ConsultaPedidosDto } from './dto/consulta-pedidos.dto';
import { NotificacionesService } from '../notificaciones/notificaciones.service';

export const LIMITE_CANTIDAD = 10;

const TRANSICIONES: Record<string, string[]> = {
  registrado: ['cancelado'],
  confirmado: ['procesando', 'cancelado'],
  pago_aprobado: ['procesando', 'cancelado'],
  procesando: ['preparando', 'cancelado'],
  preparando: ['empaquetado', 'cancelado'],
  empaquetado: ['listo_envio', 'cancelado'],
  listo_envio: ['enviado'],
  enviado: ['en_transito'],
  en_transito: ['en_reparto'],
  en_reparto: ['entregado'],
  entregado: ['devuelto'],
  cancelado: [],
  devuelto: [],
};

const SECUENCIA_DEMO = [
  'pago_aprobado',
  'procesando',
  'preparando',
  'empaquetado',
  'listo_envio',
  'enviado',
  'en_transito',
  'en_reparto',
  'entregado',
];

const MENSAJE_ESTADO: Record<string, string> = {
  pago_aprobado: 'Tu pago fue aprobado y tu pedido quedó confirmado.',
  procesando: 'Tu pedido está siendo procesado.',
  preparando: 'Estamos preparando tu pedido.',
  empaquetado: 'Tu pedido fue empaquetado.',
  listo_envio: 'Tu pedido está listo para envío.',
  enviado: 'Tu pedido fue enviado.',
  en_transito: 'Tu pedido está en tránsito.',
  en_reparto: 'Tu pedido salió a reparto.',
  entregado: 'Tu pedido fue entregado. Gracias por tu compra.',
  cancelado: 'Tu pedido fue cancelado.',
  devuelto: 'Se registró la devolución de tu pedido.',
};

const METODOS_PAGO = [
  'tarjeta_credito',
  'tarjeta_debito',
  'transferencia',
  'efectivo_simulado',
];

const COLS =
  'id, cliente_sub, fecha, estado, estado_pago, metodo_pago, numero_seguimiento, pagado_en, total';

interface FilaProducto {
  id: string;
  precio: string;
}

interface FilaPedido {
  id: string;
  cliente_sub: string;
  fecha: Date;
  estado: string;
  estado_pago: string;
  metodo_pago: string | null;
  numero_seguimiento: string | null;
  pagado_en: Date | null;
  total: string;
}

@Injectable()
export class PedidosService {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    private readonly notificaciones: NotificacionesService,
  ) {}

  private modo(): string {
    return this.config.get<string>('VULN_MODE', 'corregido');
  }

  private async crearInterno(
    sub: string,
    dto: CreatePedidoDto,
    clave?: string,
  ) {
    if (this.modo() !== 'vulnerable') {
      for (const item of dto.items) {
        if (item.cantidad > LIMITE_CANTIDAD) {
          throw new BadRequestException(
            `La cantidad por producto no puede superar ${LIMITE_CANTIDAD} unidades.`,
          );
        }
      }
    }

    if (clave) {
      const existente = await this.db.query<FilaPedido>(
        `SELECT ${COLS} FROM pedido WHERE clave_idempotencia = $1`,
        [clave],
      );
      if (existente.rowCount && existente.rowCount > 0) {
        const [pedido] = await this.conItems(existente.rows);
        return pedido;
      }
    }

    return this.db.transaction(async (client: PoolClient) => {
      let total = 0;
      const lineas: {
        producto_id: string;
        cantidad: number;
        precio_unitario: string;
      }[] = [];

      for (const item of dto.items) {
        const prod = await client.query<FilaProducto>(
          'SELECT id, precio FROM producto WHERE id = $1',
          [item.producto_id],
        );
        if (prod.rowCount === 0) {
          throw new BadRequestException('Producto inexistente en el pedido.');
        }
        const precioUnitario = prod.rows[0].precio;
        total += Number(precioUnitario) * item.cantidad;
        lineas.push({
          producto_id: item.producto_id,
          cantidad: item.cantidad,
          precio_unitario: precioUnitario,
        });
      }

      const pedido = await client.query<FilaPedido>(
        `INSERT INTO pedido (cliente_sub, estado, total, clave_idempotencia)
         VALUES ($1, 'registrado', $2, $3)
         RETURNING ${COLS}`,
        [sub, total.toFixed(2), clave ?? null],
      );
      const pedidoId = pedido.rows[0].id;

      for (const linea of lineas) {
        await client.query(
          `INSERT INTO detalle_pedido (pedido_id, producto_id, cantidad, precio_unitario)
           VALUES ($1, $2, $3, $4)`,
          [pedidoId, linea.producto_id, linea.cantidad, linea.precio_unitario],
        );
      }

      await client.query(
        `INSERT INTO pedido_evento (pedido_id, estado, nota)
         VALUES ($1, 'registrado', 'Pedido registrado')`,
        [pedidoId],
      );

      await this.notificaciones.crearParaAdmins(
        {
          tipo: 'pedido_nuevo',
          titulo: 'Nuevo pedido registrado',
          mensaje: `Se registró un pedido por ${pedido.rows[0].total} con ${lineas.length} línea(s).`,
          datos: { pedido_id: pedidoId },
        },
        client,
      );
      await this.notificaciones.crear(
        {
          userId: sub,
          tipo: 'pedido_registrado',
          titulo: 'Pedido registrado',
          mensaje: `Tu pedido por ${pedido.rows[0].total} fue registrado. Completa el pago para confirmarlo.`,
          datos: { pedido_id: pedidoId },
        },
        client,
      );

      return {
        id: pedidoId,
        cliente_sub: sub,
        fecha: pedido.rows[0].fecha,
        estado: pedido.rows[0].estado,
        estado_pago: pedido.rows[0].estado_pago,
        total: pedido.rows[0].total,
        items: lineas,
      };
    });
  }

  async crear(sub: string, dto: CreatePedidoDto) {
    return this.crearInterno(sub, dto);
  }

  async checkout(
    sub: string,
    dto: CreatePedidoDto & { clave_idempotencia?: string },
  ) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('El carrito está vacío.');
    }
    return this.crearInterno(sub, dto, dto.clave_idempotencia);
  }

  private esMetodoTarjeta(metodo: string): boolean {
    return metodo === 'tarjeta_credito' || metodo === 'tarjeta_debito';
  }

  private simulacionAprobada(metodo: string, ultimos4: string | null): boolean {
    if (!this.esMetodoTarjeta(metodo)) {
      return true;
    }
    return ultimos4 !== null && ultimos4 !== '0002';
  }

  async pagar(id: string, sub: string, dto: PagarPedidoDto) {
    if (!METODOS_PAGO.includes(dto.metodo)) {
      throw new BadRequestException('Método de pago no válido.');
    }
    if (this.esMetodoTarjeta(dto.metodo) && !dto.tarjeta_ultimos4) {
      throw new BadRequestException(
        'Para pagos con tarjeta se requieren los últimos cuatro dígitos de la tarjeta de prueba.',
      );
    }
    const actual = await this.db.query<FilaPedido>(
      `SELECT ${COLS} FROM pedido WHERE id = $1`,
      [id],
    );
    if (actual.rowCount === 0) {
      throw new NotFoundException('Pedido no encontrado.');
    }
    if (actual.rows[0].cliente_sub !== sub && this.modo() !== 'vulnerable') {
      throw new ForbiddenException('Solo el titular del pedido puede pagarlo.');
    }
    if (actual.rows[0].estado_pago === 'aprobado') {
      return this.obtener(id, sub, false);
    }
    if (actual.rows[0].estado === 'cancelado') {
      throw new BadRequestException('El pedido está cancelado.');
    }

    const ultimos4 = dto.tarjeta_ultimos4 ?? null;
    const aprobado = this.simulacionAprobada(dto.metodo, ultimos4);

    if (!aprobado) {
      await this.db.transaction(async (client) => {
        await client.query(
          `UPDATE pedido SET estado_pago = 'rechazado', metodo_pago = $1, tarjeta_ultimos4 = $2
           WHERE id = $3`,
          [dto.metodo, ultimos4, id],
        );
        await client.query(
          `INSERT INTO pedido_evento (pedido_id, estado, nota)
           VALUES ($1, 'registrado', 'Pago rechazado en la simulación')`,
          [id],
        );
        await this.notificaciones.crear(
          {
            userId: sub,
            tipo: 'pago_rechazado',
            titulo: 'Pago rechazado',
            mensaje:
              'La simulación de pago fue rechazada. Puedes intentar con otro método o tarjeta de prueba.',
            datos: { pedido_id: id },
          },
          client,
        );
      });
      return this.obtener(id, sub, false);
    }

    const referencia = `SIM-${randomUUID().slice(0, 8).toUpperCase()}`;
    const seguimiento = `QW${Date.now().toString().slice(-8)}`;
    await this.db.transaction(async (client) => {
      await this.descontarInventario(
        client,
        id,
        actual.rows[0].cliente_sub,
        referencia,
      );
      await client.query(
        `UPDATE pedido
         SET estado_pago = 'aprobado', estado = 'pago_aprobado', metodo_pago = $1,
             tarjeta_ultimos4 = $2, referencia_pago = $3, numero_seguimiento = $4,
             pagado_en = now()
         WHERE id = $5`,
        [dto.metodo, ultimos4, referencia, seguimiento, id],
      );
      await this.programarAvance(client, id, 'pago_aprobado');
      await client.query(
        `INSERT INTO pedido_evento (pedido_id, estado, nota)
         VALUES ($1, 'pago_aprobado', $2)`,
        [id, `Pago aprobado (${dto.metodo}). Referencia ${referencia}`],
      );
      await this.notificaciones.crear(
        {
          userId: sub,
          tipo: 'pedido_pagado',
          titulo: 'Pago aprobado',
          mensaje: `Tu pago fue aprobado. Número de seguimiento ${seguimiento}.`,
          datos: { pedido_id: id, numero_seguimiento: seguimiento },
        },
        client,
      );
    });
    return this.obtener(id, sub, false);
  }

  private async eventos(pedidoId: string) {
    const r = await this.db.query<{
      estado: string;
      nota: string | null;
      creado_en: Date;
    }>(
      `SELECT estado, nota, creado_en FROM pedido_evento
       WHERE pedido_id = $1 ORDER BY creado_en ASC`,
      [pedidoId],
    );
    return r.rows;
  }

  private async conItems(pedidos: FilaPedido[]) {
    if (pedidos.length === 0) {
      return [];
    }
    const ids = pedidos.map((p) => p.id);
    const detalles = await this.db.query<{
      pedido_id: string;
      producto_id: string;
      nombre: string | null;
      cantidad: number;
      precio_unitario: string;
      imagen_url: string | null;
    }>(
      `SELECT d.pedido_id, d.producto_id, pr.nombre, pr.imagen_url,
              d.cantidad, d.precio_unitario
       FROM detalle_pedido d
       LEFT JOIN producto pr ON pr.id = d.producto_id
       WHERE d.pedido_id = ANY($1::uuid[])`,
      [ids],
    );
    return pedidos.map((p) => ({
      ...p,
      items: detalles.rows
        .filter((d) => d.pedido_id === p.id)
        .map((d) => ({
          producto_id: d.producto_id,
          nombre: d.nombre,
          imagen_url: d.imagen_url,
          cantidad: d.cantidad,
          precio_unitario: d.precio_unitario,
        })),
    }));
  }

  async listar(sub: string, esAdmin: boolean, consulta: ConsultaPedidosDto) {
    await this.aplicarVencidasSilencioso();
    const condiciones: string[] = [];
    const valores: unknown[] = [];
    const verTodos = consulta.todos === 'true' && esAdmin;
    if (!verTodos) {
      valores.push(sub);
      condiciones.push(`cliente_sub = $${valores.length}`);
    }
    if (consulta.estado) {
      valores.push(consulta.estado);
      condiciones.push(`estado = $${valores.length}`);
    }
    const where = condiciones.length
      ? `WHERE ${condiciones.join(' AND ')}`
      : '';

    if (consulta.pagina === undefined) {
      const r = await this.db.query<FilaPedido>(
        `SELECT ${COLS} FROM pedido ${where} ORDER BY fecha DESC`,
        valores,
      );
      return this.conItems(r.rows);
    }

    const tamano = consulta.tamano ?? 10;
    const desplazamiento = (consulta.pagina - 1) * tamano;
    const total = await this.db.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM pedido ${where}`,
      valores,
    );
    const r = await this.db.query<FilaPedido>(
      `SELECT ${COLS} FROM pedido ${where} ORDER BY fecha DESC
       LIMIT ${tamano} OFFSET ${desplazamiento}`,
      valores,
    );
    return {
      items: await this.conItems(r.rows),
      total: Number(total.rows[0].n),
      pagina: consulta.pagina,
      tamano,
    };
  }

  async obtener(id: string, sub: string, esAdmin: boolean) {
    await this.aplicarVencidasSilencioso();
    const r = await this.db.query<FilaPedido>(
      `SELECT ${COLS} FROM pedido WHERE id = $1`,
      [id],
    );
    if (r.rowCount === 0) {
      throw new NotFoundException('Pedido no encontrado.');
    }
    if (
      !esAdmin &&
      r.rows[0].cliente_sub !== sub &&
      this.modo() !== 'vulnerable'
    ) {
      throw new ForbiddenException('Permisos insuficientes.');
    }
    const [pedido] = await this.conItems(r.rows);
    return { ...pedido, eventos: await this.eventos(id) };
  }

  async cambiarEstado(id: string, estado: string) {
    const actual = await this.db.query<FilaPedido>(
      `SELECT ${COLS} FROM pedido WHERE id = $1`,
      [id],
    );
    if (actual.rowCount === 0) {
      throw new NotFoundException('Pedido no encontrado.');
    }
    const estadoActual = actual.rows[0].estado;
    if (estadoActual === estado) {
      return this.obtener(id, actual.rows[0].cliente_sub, true);
    }
    const permitidos = TRANSICIONES[estadoActual] ?? [];
    if (!permitidos.includes(estado)) {
      throw new BadRequestException(
        `No es posible cambiar un pedido de "${estadoActual}" a "${estado}".`,
      );
    }
    await this.db.transaction(async (client) => {
      if (estado === 'cancelado' || estado === 'devuelto') {
        await this.restaurarInventario(
          client,
          id,
          actual.rows[0].cliente_sub,
          estado === 'devuelto'
            ? `Devolución del pedido ${id.slice(0, 8).toUpperCase()}`
            : `Cancelación del pedido ${id.slice(0, 8).toUpperCase()}`,
        );
      }
      await client.query('UPDATE pedido SET estado = $1 WHERE id = $2', [
        estado,
        id,
      ]);
      await client.query(
        `INSERT INTO pedido_evento (pedido_id, estado, nota) VALUES ($1, $2, $3)`,
        [id, estado, MENSAJE_ESTADO[estado] ?? `Estado: ${estado}`],
      );
      const tipo =
        estado === 'entregado' ? 'pedido_entregado' : 'pedido_estado';
      await this.notificaciones.crear(
        {
          userId: actual.rows[0].cliente_sub,
          tipo,
          titulo:
            estado === 'entregado'
              ? 'Pedido entregado'
              : 'Actualización de tu pedido',
          mensaje: MENSAJE_ESTADO[estado] ?? `Tu pedido pasó a "${estado}".`,
          datos: { pedido_id: id, estado },
        },
        client,
      );
    });
    return this.obtener(id, actual.rows[0].cliente_sub, true);
  }

  private async descontarInventario(
    client: PoolClient,
    pedidoId: string,
    clienteSub: string,
    referencia: string,
  ): Promise<void> {
    const bloqueo = await client.query<{ inventario_descontado: boolean }>(
      'SELECT inventario_descontado FROM pedido WHERE id = $1 FOR UPDATE',
      [pedidoId],
    );
    if (bloqueo.rowCount === 0 || bloqueo.rows[0].inventario_descontado) {
      return;
    }
    const items = await client.query<{ producto_id: string; cantidad: number }>(
      `SELECT producto_id, sum(cantidad)::int AS cantidad
       FROM detalle_pedido WHERE pedido_id = $1
       GROUP BY producto_id
       ORDER BY producto_id`,
      [pedidoId],
    );
    for (const item of items.rows) {
      const r = await client.query<{ nombre: string; stock: number }>(
        `UPDATE producto SET stock = stock - $2
         WHERE id = $1 AND stock >= $2
         RETURNING nombre, stock`,
        [item.producto_id, item.cantidad],
      );
      if (r.rowCount === 0) {
        const info = await client.query<{ nombre: string; stock: number }>(
          'SELECT nombre, stock FROM producto WHERE id = $1',
          [item.producto_id],
        );
        const nombre = info.rows[0]?.nombre ?? 'producto';
        const disponible = info.rows[0]?.stock ?? 0;
        throw new ConflictException(
          `No hay existencias suficientes de "${nombre}": se solicitaron ${item.cantidad} y quedan ${disponible}.`,
        );
      }
      await client.query(
        `INSERT INTO movimiento_inventario
           (producto_id, tipo, cantidad, stock_resultante, motivo, usuario_sub, pedido_id)
         VALUES ($1, 'salida', $2, $3, $4, $5, $6)`,
        [
          item.producto_id,
          item.cantidad,
          r.rows[0].stock,
          `Venta del pedido ${pedidoId.slice(0, 8).toUpperCase()} (${referencia})`,
          clienteSub,
          pedidoId,
        ],
      );
    }
    await client.query(
      'UPDATE pedido SET inventario_descontado = true WHERE id = $1',
      [pedidoId],
    );
  }

  private async restaurarInventario(
    client: PoolClient,
    pedidoId: string,
    clienteSub: string,
    motivo: string,
  ): Promise<void> {
    const bloqueo = await client.query<{ inventario_descontado: boolean }>(
      'SELECT inventario_descontado FROM pedido WHERE id = $1 FOR UPDATE',
      [pedidoId],
    );
    if (bloqueo.rowCount === 0 || !bloqueo.rows[0].inventario_descontado) {
      return;
    }
    const items = await client.query<{ producto_id: string; cantidad: number }>(
      `SELECT producto_id, sum(cantidad)::int AS cantidad
       FROM detalle_pedido WHERE pedido_id = $1
       GROUP BY producto_id
       ORDER BY producto_id`,
      [pedidoId],
    );
    for (const item of items.rows) {
      const r = await client.query<{ stock: number }>(
        `UPDATE producto SET stock = stock + $2 WHERE id = $1 RETURNING stock`,
        [item.producto_id, item.cantidad],
      );
      if (r.rowCount === 0) {
        continue;
      }
      await client.query(
        `INSERT INTO movimiento_inventario
           (producto_id, tipo, cantidad, stock_resultante, motivo, usuario_sub, pedido_id)
         VALUES ($1, 'entrada', $2, $3, $4, $5, $6)`,
        [
          item.producto_id,
          item.cantidad,
          r.rows[0].stock,
          motivo,
          clienteSub,
          pedidoId,
        ],
      );
    }
    await client.query(
      'UPDATE pedido SET inventario_descontado = false WHERE id = $1',
      [pedidoId],
    );
  }

  private segundosPorEtapa(): number {
    const valor = Number(
      this.config.get<string>('PEDIDO_AVANCE_SEGUNDOS', '3600'),
    );
    return Number.isFinite(valor) && valor > 0 ? valor : 3600;
  }

  private avanceAutomaticoActivo(): boolean {
    return (
      this.config
        .get<string>('PEDIDO_AVANCE_AUTOMATICO', 'true')
        .toLowerCase() !== 'false'
    );
  }

  private async programarAvance(
    client: PoolClient,
    pedidoId: string,
    estado: string,
  ): Promise<void> {
    const idx = SECUENCIA_DEMO.indexOf(estado);
    const haySiguiente = idx >= 0 && idx < SECUENCIA_DEMO.length - 1;
    if (!haySiguiente || !this.avanceAutomaticoActivo()) {
      await client.query('UPDATE pedido SET avanza_en = NULL WHERE id = $1', [
        pedidoId,
      ]);
      return;
    }
    await client.query(
      `UPDATE pedido SET avanza_en = now() + ($2 || ' seconds')::interval
       WHERE id = $1`,
      [pedidoId, String(this.segundosPorEtapa())],
    );
  }

  private async aplicarVencidasSilencioso(): Promise<void> {
    try {
      await this.procesarTransicionesVencidas(10);
    } catch {
      return;
    }
  }

  async procesarTransicionesVencidas(limite = 50): Promise<{
    procesados: number;
    avances: Array<{ pedido: string; estado: string }>;
  }> {
    const avances: Array<{ pedido: string; estado: string }> = [];
    if (!this.avanceAutomaticoActivo()) {
      return { procesados: 0, avances };
    }
    for (let i = 0; i < limite; i += 1) {
      const siguiente = await this.db.query<{ id: string }>(
        `SELECT id FROM pedido
         WHERE avanza_en IS NOT NULL
           AND avanza_en <= now()
           AND estado_pago = 'aprobado'
           AND estado = ANY($1)
         ORDER BY avanza_en
         LIMIT 1`,
        [SECUENCIA_DEMO.slice(0, -1)],
      );
      if (siguiente.rowCount === 0) {
        break;
      }
      const estado = await this.avanzarProgramado(siguiente.rows[0].id);
      if (!estado) {
        break;
      }
      avances.push({ pedido: siguiente.rows[0].id, estado });
    }
    return { procesados: avances.length, avances };
  }

  private async avanzarProgramado(id: string): Promise<string | null> {
    let resultado: string | null = null;
    await this.db.transaction(async (client) => {
      const actual = await client.query<{
        estado: string;
        cliente_sub: string;
        estado_pago: string;
        vencido: boolean;
      }>(
        `SELECT estado, cliente_sub, estado_pago,
                (avanza_en IS NOT NULL AND avanza_en <= now()) AS vencido
         FROM pedido WHERE id = $1 FOR UPDATE`,
        [id],
      );
      if (actual.rowCount === 0) {
        return;
      }
      const fila = actual.rows[0];
      if (fila.estado_pago !== 'aprobado' || !fila.vencido) {
        return;
      }
      const idx = SECUENCIA_DEMO.indexOf(fila.estado);
      if (idx < 0 || idx >= SECUENCIA_DEMO.length - 1) {
        await client.query('UPDATE pedido SET avanza_en = NULL WHERE id = $1', [
          id,
        ]);
        return;
      }
      const siguiente = SECUENCIA_DEMO[idx + 1];
      await client.query('UPDATE pedido SET estado = $1 WHERE id = $2', [
        siguiente,
        id,
      ]);
      await client.query(
        `INSERT INTO pedido_evento (pedido_id, estado, nota) VALUES ($1, $2, $3)`,
        [id, siguiente, MENSAJE_ESTADO[siguiente] ?? `Estado: ${siguiente}`],
      );
      await this.notificaciones.crear(
        {
          userId: fila.cliente_sub,
          tipo:
            siguiente === 'entregado' ? 'pedido_entregado' : 'pedido_estado',
          titulo:
            siguiente === 'entregado'
              ? 'Pedido entregado'
              : 'Actualización de tu pedido',
          mensaje: MENSAJE_ESTADO[siguiente] ?? `Estado: ${siguiente}`,
          datos: { pedido_id: id, estado: siguiente },
          claveDedupe: `avance:${id}:${siguiente}`,
        },
        client,
      );
      await this.programarAvance(client, id, siguiente);
      resultado = siguiente;
    });
    return resultado;
  }

  async avanzarDemo(id: string): Promise<string | null> {
    const actual = await this.db.query<{
      estado: string;
      cliente_sub: string;
    }>('SELECT estado, cliente_sub FROM pedido WHERE id = $1', [id]);
    if (actual.rowCount === 0) {
      return null;
    }
    const idx = SECUENCIA_DEMO.indexOf(actual.rows[0].estado);
    if (idx < 0 || idx >= SECUENCIA_DEMO.length - 1) {
      return null;
    }
    const siguiente = SECUENCIA_DEMO[idx + 1];
    const nota = `[Demostración] ${
      MENSAJE_ESTADO[siguiente] ?? `Estado: ${siguiente}`
    } (avance simulado, sin envío real)`;
    await this.db.transaction(async (client) => {
      await client.query('UPDATE pedido SET estado = $1 WHERE id = $2', [
        siguiente,
        id,
      ]);
      await client.query(
        `INSERT INTO pedido_evento (pedido_id, estado, nota) VALUES ($1, $2, $3)`,
        [id, siguiente, nota],
      );
      await this.notificaciones.crear(
        {
          userId: actual.rows[0].cliente_sub,
          tipo:
            siguiente === 'entregado' ? 'pedido_entregado' : 'pedido_estado',
          titulo:
            siguiente === 'entregado'
              ? 'Pedido entregado (demostración)'
              : 'Actualización de tu pedido (demostración)',
          mensaje: nota,
          datos: { pedido_id: id, estado: siguiente, demostracion: true },
          claveDedupe: `demo:${id}:${siguiente}`,
        },
        client,
      );
    });
    return siguiente;
  }
}
