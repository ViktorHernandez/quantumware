import { Alert, Button, Center, Loader, Stack, Text } from '@mantine/core';
import { IconPlugConnectedX, IconRefresh } from '@tabler/icons-react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useLab } from './store/labEstado';
import { LabLayout } from './components/LabLayout';
import { PanelLab } from './pages/PanelLab';
import { Configuracion } from './pages/Configuracion';
import { Sesiones } from './components/Sesiones';
import { Escenarios } from './components/Escenarios';
import { Consola } from './components/Consola';
import { Terminal } from './components/Terminal';
import { Historial } from './components/Historial';
import { Evidencias } from './components/Evidencias';

export default function App() {
  const { config, error, refrescar } = useLab();

  if (!config && !error) {
    return (
      <Center h="100vh">
        <Loader color="laboratorio" />
      </Center>
    );
  }

  if (!config && error) {
    return (
      <Center h="100vh" px="md">
        <Stack maw={520} gap="md">
          <Alert
            color="red"
            icon={<IconPlugConnectedX size={20} />}
            title="No se pudo conectar con el backend del cliente atacante"
          >
            <Text size="sm">{error}</Text>
            <Text size="sm" mt="sm">
              Verifica que el backend del cliente atacante esté en ejecución en
              el puerto 4000 y abre esta interfaz con la misma dirección
              (http://localhost:5174) para evitar diferencias de origen entre
              localhost y 127.0.0.1.
            </Text>
          </Alert>
          <Button
            leftSection={<IconRefresh size={16} />}
            color="laboratorio"
            onClick={() => void refrescar()}
          >
            Reintentar conexión
          </Button>
        </Stack>
      </Center>
    );
  }

  return (
    <LabLayout>
      <Routes>
        <Route path="/panel" element={<PanelLab />} />
        <Route path="/sesiones" element={<Sesiones />} />
        <Route path="/funcionales" element={<Escenarios tipo="funcional" />} />
        <Route path="/vulnerabilidades" element={<Escenarios tipo="explotacion" />} />
        <Route path="/autorizacion" element={<Escenarios tipo="autorizacion" />} />
        <Route path="/terminal" element={<Terminal />} />
        <Route path="/consola" element={<Consola />} />
        <Route path="/historial" element={<Historial />} />
        <Route path="/evidencias" element={<Evidencias />} />
        <Route path="/configuracion" element={<Configuracion />} />
        <Route path="*" element={<Navigate to="/panel" replace />} />
      </Routes>
    </LabLayout>
  );
}
