import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './components/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { RegistroPage } from './pages/RegistroPage';
import { RecuperarPage } from './pages/RecuperarPage';
import { RestablecerPage } from './pages/RestablecerPage';
import { AceptarInvitacionPage } from './pages/AceptarInvitacionPage';
import { MfaVerificacionPage } from './pages/MfaVerificacionPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProductosPage } from './pages/ProductosPage';
import { CatalogoClientePage } from './pages/CatalogoClientePage';
import { ProductoDetallePage } from './pages/ProductoDetallePage';
import { useAuth } from './auth/authEstado';
import { InventarioPage } from './pages/InventarioPage';
import { AnalisisPage } from './pages/AnalisisPage';
import { NotificacionesPage } from './pages/NotificacionesPage';
import { PedidosPage } from './pages/PedidosPage';
import { PedidoDetallePage } from './pages/PedidoDetallePage';
import { CarritoPage } from './pages/CarritoPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { PagoPage } from './pages/PagoPage';
import { UsuariosPage } from './pages/UsuariosPage';
import { PerfilPage } from './pages/PerfilPage';
import { AjustesPage } from './pages/AjustesPage';
import { NoEncontrado } from './pages/PaginasError';
import type { ReactNode } from 'react';

function Privada({
  children,
  soloAdmin = false,
}: {
  children: ReactNode;
  soloAdmin?: boolean;
}) {
  return (
    <ProtectedRoute soloAdmin={soloAdmin}>
      <AppLayout>{children}</AppLayout>
    </ProtectedRoute>
  );
}

function Catalogo() {
  const { esAdmin } = useAuth();
  return esAdmin ? <ProductosPage /> : <CatalogoClientePage />;
}

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/registro" element={<RegistroPage />} />
        <Route path="/recuperar-contrasena" element={<RecuperarPage />} />
        <Route path="/restablecer-contrasena" element={<RestablecerPage />} />
        <Route path="/aceptar-invitacion" element={<AceptarInvitacionPage />} />
        <Route path="/mfa-verificacion" element={<MfaVerificacionPage />} />
        <Route
          path="/u/panel"
          element={
            <Privada>
              <DashboardPage />
            </Privada>
          }
        />
        <Route
          path="/u/productos"
          element={
            <Privada>
              <Catalogo />
            </Privada>
          }
        />
        <Route
          path="/u/productos/:id"
          element={
            <Privada>
              <ProductoDetallePage />
            </Privada>
          }
        />
        <Route
          path="/u/inventario"
          element={
            <Privada soloAdmin>
              <InventarioPage />
            </Privada>
          }
        />
        <Route
          path="/u/analisis"
          element={
            <Privada soloAdmin>
              <AnalisisPage />
            </Privada>
          }
        />
        <Route
          path="/u/notificaciones"
          element={
            <Privada>
              <NotificacionesPage />
            </Privada>
          }
        />
        <Route
          path="/u/pedidos"
          element={
            <Privada>
              <PedidosPage />
            </Privada>
          }
        />
        <Route
          path="/u/pedidos/:id"
          element={
            <Privada>
              <PedidoDetallePage />
            </Privada>
          }
        />
        <Route
          path="/u/pedidos/:id/pagar"
          element={
            <Privada>
              <PagoPage />
            </Privada>
          }
        />
        <Route
          path="/u/carrito"
          element={
            <Privada>
              <CarritoPage />
            </Privada>
          }
        />
        <Route
          path="/u/checkout"
          element={
            <Privada>
              <CheckoutPage />
            </Privada>
          }
        />
        <Route
          path="/u/usuarios"
          element={
            <Privada soloAdmin>
              <UsuariosPage />
            </Privada>
          }
        />
        <Route
          path="/u/perfil"
          element={
            <Privada>
              <PerfilPage />
            </Privada>
          }
        />
        <Route
          path="/u/ajustes"
          element={
            <Privada>
              <AjustesPage />
            </Privada>
          }
        />
        <Route path="/" element={<Navigate to="/u/panel" replace />} />
        <Route path="*" element={<NoEncontrado />} />
      </Routes>
    </>
  );
}
