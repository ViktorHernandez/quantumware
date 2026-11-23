import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, Group, Text } from '@mantine/core';
import { IconTerminal2 } from '@tabler/icons-react';
import { useLab } from '../store/labEstado';
import type { ResultadoSolicitud } from '../types';

interface Linea {
  tipo: 'prompt' | 'ok' | 'err' | 'warn' | 'dim' | 'label' | 'normal';
  texto: string;
}

const COMANDOS = [
  'help',
  'clear',
  'objetivo',
  'modo',
  'login',
  'logout',
  'sesiones',
  'escenarios',
  'escenario',
  'get',
  'post',
  'put',
  'delete',
  'patch',
  'historial',
  'evidencias',
  'token',
  'apartar',
  'descubrir',
];

const ESCENARIOS_ID = [
  'PF-01',
  'PE-01',
  'PE-02',
  'PE-03',
  'PE-04',
  'PA-01',
  'PA-02',
  'PA-03',
  'PA-04',
  'PA-05',
];

const AYUDA: string[] = [
  'Terminal del laboratorio. Solo opera contra la aplicación principal autorizada.',
  '',
  'Estado y preparación',
  '  objetivo                     URL objetivo y VULN_MODE del backend',
  '  modo                         VULN_MODE activo del backend',
  '  login <admin|cliente> [codigo]   Captura la sesión. El código de 6 dígitos',
  '                               completa MFA y eleva el token a aal2 (necesario para PA-01)',
  '  logout <admin|cliente>       Cierra la sesión capturada',
  '  sesiones                     Sesiones capturadas, con nivel aal y caducidad',
  '  token <admin|cliente>        Token enmascarado y su expiración',
  '  apartar                      Genera un token de laboratorio ya vencido para',
  '                               PA-04 (listo para ejecutarse de inmediato)',
  '  descubrir                    Lista pedidos de otros clientes de laboratorio',
  '                               (usa la sesión admin) para elegir el objetivo de PE-03',
  '',
  'Escenarios del protocolo',
  '  escenarios                   Lista los escenarios disponibles',
  '  escenario <ID>               Ejecuta un escenario',
  '  escenario PE-03 <uuid>       Requiere el pedido de otro cliente (BOLA)',
  '  escenario PE-04 [intentos]   Intentos repetidos; por omisión 12, máximo 20',
  '',
  'Solicitudes manuales',
  '  get <ruta> [--token O]       O = none|admin|cliente|tampered|expired',
  '  post <ruta> [--token O] [--body <json>]',
  '  put | patch | delete         Igual que post',
  '',
  'Bitácora',
  '  historial                    Últimas solicitudes con código y tiempo',
  '  evidencias                   Archivos de evidencia generados',
  '  clear                        Limpia la pantalla',
  '',
  'Ejemplos para la demostración',
  '  login cliente',
  '  get /productos --token cliente',
  '  escenario PF-01',
  '  escenario PE-01',
  '  escenario PE-04 12',
  '  login admin 123456',
  '  escenario PA-01',
  '  apartar',
  '  escenario PA-04',
  '  descubrir',
  '  get /pedidos --token none',
  '  post /pedidos --token cliente --body {"items":[{"producto_id":"<uuid>","cantidad":99}]}',
];

const MAPA_ORIGEN: Record<string, string> = {
  none: 'ninguno',
  ninguno: 'ninguno',
  admin: 'admin',
  cliente: 'cliente',
  tampered: 'alterado',
  alterado: 'alterado',
  expired: 'expirado',
  expirado: 'expirado',
};

export function Terminal() {
  const lab = useLab();
  const [lineas, setLineas] = useState<Linea[]>([
    { tipo: 'label', texto: 'QuantumWare — Terminal de laboratorio' },
    { tipo: 'dim', texto: 'Escribe "help" para ver los comandos. Tab autocompleta.' },
  ]);
  const [entrada, setEntrada] = useState('');
  const [histComandos, setHistComandos] = useState<string[]>([]);
  const [posicion, setPosicion] = useState(-1);
  const vista = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (vista.current) {
      vista.current.scrollTop = vista.current.scrollHeight;
    }
  }, [lineas]);

  const escribir = (nuevas: Linea[]) => setLineas((l) => [...l, ...nuevas]);

  const resumenRespuesta = (r: ResultadoSolicitud): Linea[] => {
    const out: Linea[] = [];
    const ok = r.response.status >= 200 && r.response.status < 300;
    out.push({
      tipo: ok ? 'ok' : r.response.status < 400 ? 'warn' : 'err',
      texto: `  HTTP ${r.response.status} · ${r.response.tiempoMs} ms · token ${r.request.tokenEnmascarado ?? 'ninguno'} (${r.request.origenToken})`,
    });
    const cuerpo = JSON.stringify(r.response.cuerpo, null, 2) ?? 'null';
    for (const linea of cuerpo.split('\n').slice(0, 24)) {
      out.push({ tipo: 'dim', texto: `  ${linea}` });
    }
    return out;
  };

  const parsear = (texto: string) => {
    let body: string | undefined;
    let resto = texto;
    const idx = texto.indexOf('--body');
    if (idx >= 0) {
      body = texto.slice(idx + 6).trim();
      resto = texto.slice(0, idx).trim();
    }
    const partes = resto.split(/\s+/).filter(Boolean);
    let token = 'cliente';
    const posicionales: string[] = [];
    for (let i = 0; i < partes.length; i += 1) {
      if (partes[i] === '--token' && partes[i + 1]) {
        token = partes[i + 1];
        i += 1;
      } else {
        posicionales.push(partes[i]);
      }
    }
    return { posicionales, token, body };
  };

  const ejecutarRaw = async (metodo: string, args: string) => {
    const { posicionales, token, body } = parsear(args);
    const ruta = posicionales[0];
    if (!ruta || !ruta.startsWith('/')) {
      escribir([{ tipo: 'err', texto: '  La ruta debe comenzar con "/".' }]);
      return;
    }
    const origen = MAPA_ORIGEN[token] ?? 'cliente';
    let cuerpo: Record<string, unknown> | undefined;
    if (body) {
      try {
        cuerpo = JSON.parse(body);
      } catch {
        escribir([{ tipo: 'err', texto: '  El cuerpo (--body) no es JSON válido.' }]);
        return;
      }
    }
    try {
      const r = await lab.ejecutarSolicitud(
        { metodo, ruta, origenToken: origen, cuerpo },
        'terminal',
        `${metodo} ${ruta}`,
      );
      escribir(resumenRespuesta(r));
    } catch (e) {
      escribir([
        { tipo: 'err', texto: `  ${e instanceof Error ? e.message : 'Error'}` },
      ]);
    }
  };

  const ejecutar = async (comando: string) => {
    const texto = comando.trim();
    escribir([{ tipo: 'prompt', texto: `quantumware> ${texto}` }]);
    if (!texto) {
      return;
    }
    const [cmd, ...rest] = texto.split(/\s+/);
    const args = rest.join(' ');
    const c = cmd.toLowerCase();

    if (c === 'help' || c === 'ayuda' || c === '?') {
      escribir(AYUDA.map((t) => ({ tipo: 'normal', texto: t })));
    } else if (c === 'clear' || c === 'cls' || c === 'limpiar') {
      setLineas([]);
    } else if (c === 'objetivo' || c === 'target') {
      escribir([
        { tipo: 'label', texto: `  Objetivo: ${lab.config?.objetivo ?? '—'}` },
        { tipo: 'dim', texto: `  Modo del backend: ${lab.config?.vulnMode ?? '—'}` },
      ]);
    } else if (c === 'modo' || c === 'mode') {
      await lab.refrescar();
      escribir([{ tipo: 'label', texto: `  VULN_MODE: ${lab.config?.vulnMode ?? '—'}` }]);
    } else if (c === 'login' || c === 'entrar') {
      const rol = rest[0];
      const codigo = (rest[1] ?? '').trim();
      if (rol !== 'admin' && rol !== 'cliente') {
        escribir([
          { tipo: 'err', texto: '  Uso: login <admin|cliente> [codigo MFA]' },
        ]);
      } else if (codigo && !/^[0-9]{6}$/.test(codigo)) {
        escribir([
          {
            tipo: 'err',
            texto: '  El código de verificación en dos pasos debe tener 6 dígitos.',
          },
        ]);
      } else {
        try {
          const info = await lab.iniciarSesion(rol, codigo || undefined);
          escribir([
            {
              tipo: info.mfaPendiente ? 'warn' : 'ok',
              texto: info.mfaPendiente
                ? `  Sesión ${rol} capturada con nivel aal1: MFA pendiente. Repite con "login ${rol} <codigo>" para PA-01.`
                : `  Sesión ${rol} capturada${info.aal ? ` (nivel ${info.aal})` : ''}.`,
            },
          ]);
        } catch (e) {
          escribir([
            { tipo: 'err', texto: `  ${e instanceof Error ? e.message : 'Error'}` },
          ]);
        }
      }
    } else if (c === 'logout' || c === 'salir') {
      const rol = rest[0];
      if (rol !== 'admin' && rol !== 'cliente') {
        escribir([{ tipo: 'err', texto: '  Uso: logout <admin|cliente>' }]);
      } else {
        await lab.cerrarSesion(rol);
        escribir([{ tipo: 'ok', texto: `  Sesión ${rol} cerrada.` }]);
      }
    } else if (c === 'apartar') {
      try {
        const r = await lab.generarTokenExpirado();
        escribir([{ tipo: r.ok ? 'ok' : 'warn', texto: `  ${r.mensaje}` }]);
      } catch (e) {
        escribir([
          { tipo: 'err', texto: `  ${e instanceof Error ? e.message : 'Error'}` },
        ]);
      }
    } else if (c === 'descubrir') {
      try {
        const r = await lab.descubrirPedidos();
        escribir([{ tipo: r.ok ? 'ok' : 'warn', texto: `  ${r.mensaje}` }]);
        const ajenos = r.pedidos.filter((p) => !p.esDelAtacante);
        if (ajenos.length > 0) {
          escribir(
            ajenos.slice(0, 12).map((p) => ({
              tipo: 'normal' as const,
              texto: `  ${p.id}  ${p.estado || 'pedido'} · ${p.propietarioEtiqueta}`,
            })),
          );
          escribir([
            {
              tipo: 'dim',
              texto: '  Copia un identificador y ejecuta: escenario PE-03 <uuid>',
            },
          ]);
        }
      } catch (e) {
        escribir([
          { tipo: 'err', texto: `  ${e instanceof Error ? e.message : 'Error'}` },
        ]);
      }
    } else if (c === 'sesiones' || c === 'sessions') {
      const s = lab.config?.sesiones ?? {};
      const claves = Object.keys(s);
      if (claves.length === 0) {
        escribir([{ tipo: 'dim', texto: '  Sin sesiones capturadas.' }]);
      } else {
        escribir(
          claves.map((k) => ({
            tipo: 'normal' as const,
            texto: `  ${k}: ${s[k].email} · ${s[k].tokenEnmascarado} · ${s[k].expirado ? 'expirado' : 'vigente'}`,
          })),
        );
      }
    } else if (c === 'token') {
      const rol = rest[0];
      const s = lab.config?.sesiones[rol];
      if (!s) {
        escribir([{ tipo: 'err', texto: '  Uso: token <admin|cliente> (sesión capturada)' }]);
      } else {
        escribir([
          { tipo: 'normal', texto: `  ${rol}: ${s.tokenEnmascarado}` },
          { tipo: 'dim', texto: `  expira: ${s.expiraEn ?? 'desconocido'}` },
        ]);
      }
    } else if (c === 'escenarios' || c === 'scenarios') {
      escribir(
        ESCENARIOS_ID.map((id) => {
          const def = lab.config?.escenarios.find((e) => e.id === id);
          return {
            tipo: 'normal' as const,
            texto: `  ${id}  ${def?.titulo ?? ''}`,
          };
        }),
      );
    } else if (c === 'escenario' || c === 'scenario') {
      const id = (rest[0] ?? '').toUpperCase();
      if (!ESCENARIOS_ID.includes(id)) {
        escribir([{ tipo: 'err', texto: `  Escenario no válido. Usa: ${ESCENARIOS_ID.join(', ')}` }]);
      } else {
        escribir([{ tipo: 'dim', texto: `  Ejecutando ${id}...` }]);
        try {
          const extra = (rest[1] ?? '').trim();
          const opciones =
            id === 'PE-03' && extra
              ? { pedidoObjetivo: extra }
              : id === 'PE-04' && extra
                ? { cantidad: Number(extra) }
                : undefined;
          const r = await lab.ejecutarEscenario(id, opciones, 'terminal');
          escribir(resumenRespuesta(r.resultado));
          const veredicto =
            r.cumple === null ? 'pendiente de criterio' : r.cumple ? 'SATISFACTORIA' : 'FALLIDA';
          escribir([
            {
              tipo: r.cumple === null ? 'warn' : r.cumple ? 'ok' : 'err',
              texto: `  Resultado: ${veredicto} (esperado: ${r.statusEsperado ?? 'variable'}, modo: ${r.modoBackend})`,
            },
            { tipo: 'dim', texto: `  ${r.observacion}` },
            { tipo: 'dim', texto: `  Evidencia: ${r.evidencia}` },
          ]);
        } catch (e) {
          escribir([
            { tipo: 'err', texto: `  ${e instanceof Error ? e.message : 'Error'}` },
          ]);
        }
      }
    } else if (['get', 'post', 'put', 'delete', 'patch'].includes(c)) {
      await ejecutarRaw(c.toUpperCase(), args);
    } else if (c === 'historial' || c === 'history') {
      const h = lab.historial.slice(0, 10);
      if (h.length === 0) {
        escribir([{ tipo: 'dim', texto: '  Sin solicitudes registradas.' }]);
      } else {
        escribir(
          h.map((e) => ({
            tipo: 'normal' as const,
            texto: `  [${e.origen}] ${e.metodo} ${e.ruta} → ${e.status} (${e.tiempoMs} ms)`,
          })),
        );
      }
    } else if (c === 'evidencias' || c === 'evidence') {
      try {
        const r = await fetch('/api/evidencias');
        const d = (await r.json()) as { evidencias: string[] };
        if (!d.evidencias || d.evidencias.length === 0) {
          escribir([{ tipo: 'dim', texto: '  Sin evidencias registradas.' }]);
        } else {
          escribir(d.evidencias.map((a) => ({ tipo: 'normal' as const, texto: `  ${a}` })));
        }
      } catch {
        escribir([{ tipo: 'err', texto: '  No se pudieron leer las evidencias.' }]);
      }
    } else {
      escribir([
        { tipo: 'err', texto: `  Comando no reconocido: ${cmd}. Escribe "help".` },
      ]);
    }
  };

  const autocompletar = () => {
    const texto = entrada.trim();
    const partes = texto.split(/\s+/);
    if (partes.length <= 1) {
      const coincidencias = COMANDOS.filter((c) => c.startsWith(partes[0] ?? ''));
      if (coincidencias.length === 1) {
        setEntrada(coincidencias[0] + ' ');
      } else if (coincidencias.length > 1) {
        escribir([
          { tipo: 'prompt', texto: `quantumware> ${entrada}` },
          { tipo: 'dim', texto: `  ${coincidencias.join('  ')}` },
        ]);
      }
    } else if (['escenario', 'scenario'].includes(partes[0].toLowerCase())) {
      const coincidencias = ESCENARIOS_ID.filter((id) =>
        id.startsWith((partes[1] ?? '').toUpperCase()),
      );
      if (coincidencias.length === 1) {
        setEntrada(`${partes[0]} ${coincidencias[0]}`);
      } else if (coincidencias.length > 1) {
        escribir([{ tipo: 'dim', texto: `  ${coincidencias.join('  ')}` }]);
      }
    }
  };

  const alTeclear = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const cmd = entrada;
      setEntrada('');
      if (cmd.trim()) {
        setHistComandos((h) => [cmd, ...h].slice(0, 50));
      }
      setPosicion(-1);
      void ejecutar(cmd);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      autocompletar();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const n = Math.min(posicion + 1, histComandos.length - 1);
      if (n >= 0) {
        setPosicion(n);
        setEntrada(histComandos[n]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const n = posicion - 1;
      if (n >= 0) {
        setPosicion(n);
        setEntrada(histComandos[n]);
      } else {
        setPosicion(-1);
        setEntrada('');
      }
    }
  };

  const clases = useMemo(
    () => ({
      prompt: 'qw-term-prompt',
      ok: 'qw-term-ok',
      err: 'qw-term-err',
      warn: 'qw-term-warn',
      dim: 'qw-term-dim',
      label: 'qw-term-label',
      normal: '',
    }),
    [],
  );

  return (
    <Card withBorder padding="md">
      <Group justify="space-between" mb="sm">
        <Group gap="xs">
          <IconTerminal2 size={18} />
          <Text fw={600}>Terminal interactiva</Text>
        </Group>
        <Text size="xs" c="dimmed">
          Solo interpreta comandos del laboratorio; no ejecuta comandos del sistema.
        </Text>
      </Group>
      <div
        className="qw-terminal"
        ref={vista}
        onClick={() => inputRef.current?.focus()}
      >
        {lineas.map((l, i) => (
          <div key={i} className={clases[l.tipo]}>
            {l.texto}
          </div>
        ))}
        <Group gap={6} wrap="nowrap" mt={4}>
          <span className="qw-term-prompt">quantumware&gt;</span>
          <input
            ref={inputRef}
            className="qw-terminal-input"
            value={entrada}
            onChange={(e) => setEntrada(e.currentTarget.value)}
            onKeyDown={alTeclear}
            spellCheck={false}
            autoComplete="off"
            aria-label="Entrada de la terminal del laboratorio"
          />
        </Group>
      </div>
    </Card>
  );
}
