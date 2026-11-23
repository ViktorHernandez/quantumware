import { useEffect, useRef, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Pagination,
  Progress,
  Rating,
  Select,
  Stack,
  Text,
  Textarea,
  Title,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconCheck,
  IconEye,
  IconEyeOff,
  IconPencil,
  IconThumbUp,
  IconTrash,
} from '@tabler/icons-react';
import { apiFetch } from '../api/client';
import { useAuth } from '../auth/authEstado';
import { EstadoVacio } from './EstadoVacio';
import { fechaHora } from '../utils/formato';

interface Resena {
  id: string;
  puntuacion: number;
  comentario: string | null;
  compra_verificada: boolean;
  estado: string;
  creado_en: string;
  actualizado_en: string;
  autor: string;
  propia: boolean;
  util: number;
  voto_propio: boolean;
}

interface Resumen {
  total: number;
  promedio: number;
  distribucion: Record<string, number>;
}

interface RespuestaResenas {
  items: Resena[];
  total: number;
  pagina: number;
  tamano: number;
  resumen: Resumen;
  miResena: Resena | null;
}

const TAMANO = 5;

function Estrellas({ valor }: { valor: number }) {
  return <Rating value={valor} fractions={2} readOnly size="sm" />;
}

export function ResenasProducto({ productoId }: { productoId: string }) {
  const { esAdmin } = useAuth();
  const [datos, setDatos] = useState<RespuestaResenas | null>(null);
  const [cargando, setCargando] = useState(true);
  const [pagina, setPagina] = useState(1);
  const [orden, setOrden] = useState('fecha');
  const [puntuacion, setPuntuacion] = useState(0);
  const [comentario, setComentario] = useState('');
  const [editando, setEditandoEstado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [recarga, setRecarga] = useState(0);
  const editandoRef = useRef(false);

  const setEditando = (valor: boolean) => {
    editandoRef.current = valor;
    setEditandoEstado(valor);
  };

  const cargar = () => setRecarga((n) => n + 1);

  useEffect(() => {
    let vigente = true;
    const solicitar = async () => {
      const [campo, direccion] = orden.split(':');
      const consulta = `orden=${campo}&direccion=${direccion ?? 'desc'}&pagina=${pagina}&tamano=${TAMANO}`;
      const r = await apiFetch<RespuestaResenas>(
        `/productos/${productoId}/resenas?${consulta}`,
      );
      if (!vigente) {
        return;
      }
      setCargando(false);
      if (r.ok && r.data) {
        setDatos(r.data);
        if (r.data.miResena && !editandoRef.current) {
          setPuntuacion(r.data.miResena.puntuacion);
          setComentario(r.data.miResena.comentario ?? '');
        }
      }
    };
    void solicitar();
    return () => {
      vigente = false;
    };
  }, [productoId, pagina, orden, recarga]);

  const miResena = datos?.miResena ?? null;

  const enviar = async () => {
    if (puntuacion < 1) {
      notifications.show({
        color: 'red',
        message: 'Selecciona una puntuación de 1 a 5 estrellas.',
      });
      return;
    }
    setEnviando(true);
    const cuerpo = { puntuacion, comentario: comentario.trim() || undefined };
    const r = miResena
      ? await apiFetch(`/resenas/${miResena.id}`, {
          metodo: 'PUT',
          cuerpo,
        })
      : await apiFetch(`/productos/${productoId}/resenas`, {
          metodo: 'POST',
          cuerpo,
        });
    setEnviando(false);
    if (!r.ok) {
      notifications.show({
        color: 'red',
        message: r.mensaje ?? 'No se pudo guardar la reseña.',
      });
      return;
    }
    notifications.show({
      color: 'teal',
      message: miResena ? 'Reseña actualizada.' : 'Reseña publicada.',
    });
    setEditando(false);
    cargar();
  };

  const eliminarPropia = async () => {
    if (!miResena) {
      return;
    }
    const r = await apiFetch(`/resenas/${miResena.id}`, { metodo: 'DELETE' });
    if (!r.ok) {
      notifications.show({
        color: 'red',
        message: r.mensaje ?? 'No se pudo eliminar la reseña.',
      });
      return;
    }
    setPuntuacion(0);
    setComentario('');
    setEditando(false);
    notifications.show({ color: 'teal', message: 'Reseña eliminada.' });
    cargar();
  };

  const votar = async (id: string) => {
    const r = await apiFetch(`/resenas/${id}/util`, { metodo: 'POST' });
    if (!r.ok) {
      notifications.show({
        color: 'red',
        message: r.mensaje ?? 'No se pudo registrar el voto.',
      });
      return;
    }
    cargar();
  };

  const moderar = async (id: string, accion: 'ocultar' | 'publicar') => {
    const r = await apiFetch(`/resenas/${id}/moderar`, {
      metodo: 'POST',
      cuerpo: { accion },
    });
    if (!r.ok) {
      notifications.show({
        color: 'red',
        message: r.mensaje ?? 'No se pudo moderar la reseña.',
      });
      return;
    }
    notifications.show({
      color: 'teal',
      message: accion === 'ocultar' ? 'Reseña ocultada.' : 'Reseña publicada.',
    });
    cargar();
  };

  const eliminarComoAdmin = async (id: string) => {
    const r = await apiFetch(`/resenas/${id}`, { metodo: 'DELETE' });
    if (!r.ok) {
      notifications.show({
        color: 'red',
        message: r.mensaje ?? 'No se pudo eliminar la reseña.',
      });
      return;
    }
    notifications.show({ color: 'teal', message: 'Reseña eliminada.' });
    cargar();
  };

  if (cargando) {
    return null;
  }

  const resumen = datos?.resumen ?? {
    total: 0,
    promedio: 0,
    distribucion: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
  };
  const totalPaginas = datos ? Math.max(1, Math.ceil(datos.total / TAMANO)) : 1;

  return (
    <Stack gap="lg">
      <Title order={3}>Opiniones de clientes</Title>

      <Card withBorder>
        <Group align="flex-start" wrap="wrap" gap="xl">
          <Stack gap={2} align="center" miw={140}>
            <Text fz={44} fw={700} lh={1}>
              {resumen.promedio.toFixed(1)}
            </Text>
            <Estrellas valor={resumen.promedio} />
            <Text size="sm" c="dimmed">
              {resumen.total} reseña(s)
            </Text>
          </Stack>
          <Stack gap={6} flex={1} miw={220}>
            {['5', '4', '3', '2', '1'].map((estrella) => {
              const cantidad = resumen.distribucion[estrella] ?? 0;
              const porcentaje =
                resumen.total > 0 ? (cantidad / resumen.total) * 100 : 0;
              return (
                <Group key={estrella} gap="sm" wrap="nowrap">
                  <Text size="sm" w={32}>
                    {estrella} ★
                  </Text>
                  <Progress value={porcentaje} flex={1} size="md" />
                  <Text size="sm" c="dimmed" w={28} ta="right">
                    {cantidad}
                  </Text>
                </Group>
              );
            })}
          </Stack>
        </Group>
      </Card>

      {!esAdmin && (
        <Card withBorder>
          <Stack gap="sm">
            <Text fw={600}>
              {miResena ? 'Tu reseña' : 'Comparte tu opinión'}
            </Text>
            {miResena && miResena.estado === 'oculta' && (
              <Badge color="orange" variant="light" w="fit-content">
                Oculta por moderación
              </Badge>
            )}
            <Group gap="sm">
              <Rating
                value={puntuacion}
                onChange={setPuntuacion}
                size="lg"
                readOnly={Boolean(miResena) && !editando}
              />
              {miResena && !editando && (
                <Badge variant="light" color="gray">
                  Publicada el {fechaHora(miResena.creado_en)}
                </Badge>
              )}
            </Group>
            {(!miResena || editando) && (
              <Textarea
                placeholder="Describe tu experiencia con el producto (opcional)."
                minRows={3}
                autosize
                maxLength={2000}
                value={comentario}
                onChange={(e) => setComentario(e.currentTarget.value)}
              />
            )}
            {miResena && !editando && miResena.comentario && (
              <Text size="sm">{miResena.comentario}</Text>
            )}
            <Group>
              {!miResena && (
                <Button loading={enviando} onClick={enviar}>
                  Publicar reseña
                </Button>
              )}
              {miResena && !editando && (
                <>
                  <Button
                    variant="light"
                    leftSection={<IconPencil size={16} />}
                    onClick={() => setEditando(true)}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="subtle"
                    color="red"
                    leftSection={<IconTrash size={16} />}
                    onClick={eliminarPropia}
                  >
                    Eliminar
                  </Button>
                </>
              )}
              {miResena && editando && (
                <>
                  <Button loading={enviando} onClick={enviar}>
                    Guardar cambios
                  </Button>
                  <Button
                    variant="default"
                    onClick={() => {
                      setEditando(false);
                      setPuntuacion(miResena.puntuacion);
                      setComentario(miResena.comentario ?? '');
                    }}
                  >
                    Cancelar
                  </Button>
                </>
              )}
            </Group>
          </Stack>
        </Card>
      )}

      <Group justify="space-between">
        <Text fw={600}>Todas las reseñas</Text>
        <Select
          size="xs"
          w={200}
          value={orden}
          onChange={(v) => {
            setOrden(v ?? 'fecha');
            setPagina(1);
          }}
          data={[
            { value: 'fecha', label: 'Más recientes' },
            { value: 'puntuacion', label: 'Mayor puntuación' },
            { value: 'utilidad', label: 'Más útiles' },
          ]}
          allowDeselect={false}
        />
      </Group>

      {!datos || datos.items.length === 0 ? (
        <EstadoVacio
          titulo="Todavía no hay reseñas"
          descripcion="Sé el primero en opinar sobre este producto."
        />
      ) : (
        <Stack gap="sm">
          {datos.items.map((r) => (
            <Card key={r.id} withBorder padding="md">
              <Stack gap="xs">
                <Group justify="space-between" wrap="nowrap">
                  <Group gap="sm" wrap="nowrap">
                    <Rating value={r.puntuacion} readOnly size="sm" />
                    <Text fw={600}>{r.autor}</Text>
                    {r.compra_verificada && (
                      <Badge
                        color="teal"
                        variant="light"
                        leftSection={<IconCheck size={12} />}
                      >
                        Compra verificada
                      </Badge>
                    )}
                    {r.propia && (
                      <Badge variant="light" color="blue">
                        Tú
                      </Badge>
                    )}
                    {esAdmin && r.estado === 'oculta' && (
                      <Badge variant="light" color="orange">
                        Oculta
                      </Badge>
                    )}
                  </Group>
                  <Text size="xs" c="dimmed">
                    {fechaHora(r.creado_en)}
                  </Text>
                </Group>
                {r.comentario && <Text size="sm">{r.comentario}</Text>}
                <Group gap="xs">
                  {!r.propia && (
                    <Button
                      size="compact-xs"
                      variant={r.voto_propio ? 'filled' : 'light'}
                      color="gray"
                      leftSection={<IconThumbUp size={14} />}
                      onClick={() => votar(r.id)}
                    >
                      Útil ({r.util})
                    </Button>
                  )}
                  {r.propia && r.util > 0 && (
                    <Badge variant="light" color="gray">
                      {r.util} marcaron útil
                    </Badge>
                  )}
                  {esAdmin && (
                    <>
                      {r.estado === 'publicada' ? (
                        <Tooltip label="Ocultar del catálogo público">
                          <ActionIcon
                            variant="light"
                            color="orange"
                            onClick={() => moderar(r.id, 'ocultar')}
                          >
                            <IconEyeOff size={16} />
                          </ActionIcon>
                        </Tooltip>
                      ) : (
                        <Tooltip label="Volver a publicar">
                          <ActionIcon
                            variant="light"
                            color="teal"
                            onClick={() => moderar(r.id, 'publicar')}
                          >
                            <IconEye size={16} />
                          </ActionIcon>
                        </Tooltip>
                      )}
                      <Tooltip label="Eliminar reseña">
                        <ActionIcon
                          variant="light"
                          color="red"
                          onClick={() => eliminarComoAdmin(r.id)}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </>
                  )}
                </Group>
              </Stack>
            </Card>
          ))}
          {totalPaginas > 1 && (
            <Group justify="center">
              <Pagination
                total={totalPaginas}
                value={pagina}
                onChange={setPagina}
                size="sm"
              />
            </Group>
          )}
        </Stack>
      )}
    </Stack>
  );
}
