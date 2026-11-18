import { Badge, Code, Group, Stack, Text } from '@mantine/core';
import type { ResultadoSolicitud } from '../types';
import { colorEstado } from '../utils/colorEstado';

export function ResultadoView({ resultado }: { resultado: ResultadoSolicitud }) {
  const { request, response } = resultado;
  return (
    <Stack gap="xs" mt="sm">
      <Group gap="xs" wrap="wrap">
        <Badge variant="filled" color="gray">
          {request.metodo}
        </Badge>
        <Text size="sm" ff="monospace" style={{ wordBreak: 'break-all' }}>
          {request.url}
        </Text>
        <Badge color={colorEstado(response.status)}>HTTP {response.status}</Badge>
        <Badge variant="light" color="gray">
          {response.tiempoMs} ms
        </Badge>
      </Group>
      <Group gap="xs">
        <Text size="xs" c="dimmed">
          Token: {request.tokenEnmascarado ?? 'ninguno'} (origen: {request.origenToken})
        </Text>
        {request.tokenExpiradoAlEnviar === true && (
          <Badge size="xs" color="red" variant="light">
            token vencido al enviar
          </Badge>
        )}
      </Group>
      {request.cuerpo !== undefined && request.cuerpo !== null && (
        <div>
          <Text size="xs" fw={600}>
            Cuerpo de la solicitud
          </Text>
          <Code block>{JSON.stringify(request.cuerpo, null, 2)}</Code>
        </div>
      )}
      <div>
        <Text size="xs" fw={600}>
          Respuesta
        </Text>
        <Code block>{JSON.stringify(response.cuerpo, null, 2)}</Code>
      </div>
    </Stack>
  );
}
