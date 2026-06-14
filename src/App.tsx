import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import MapPage from './pages/MapPage';
import ResourceBookingPage from './pages/ResourceBookingPage';
import SocialCreatePage from './pages/SocialCreatePage';
import SocialFeedPage from './pages/SocialFeedPage';
import AuthCallbackPage from './pages/AuthCallbackPage';
import UserProfilePage from './pages/UserProfilePage';
import StatisticsPage from './pages/StatisticsPage';
import ProtectedRoute from './components/ProtectedRoute';
import AutoElementIds from './components/AutoElementIds';
import { useAuthStore } from './store/authStore';

/**
 * Кореневий компонент додатка.
 * На етапі монтування виконує відновлення сесії авторизації (bootstrap).
 * Відображає екран завантаження, поки сесія не перевірена.
 * Налаштовує маршрутизацію (маршрути для карти, соціальної стрічки,
 * профілів, статистики та входу) та обгортає приватні роути в ProtectedRoute.
 */
function App() {
  const bootstrap = useAuthStore((state) => state.bootstrap);
  const isBootstrapped = useAuthStore((state) => state.isBootstrapped);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  if (!isBootstrapped) {
    return (
      <div
        id="app-bootstrap"
        className="flex min-h-screen items-center justify-center bg-gray-50"
      >
        <p className="text-sm text-gray-500">Завантаження…</p>
      </div>
    );
  }

  return (
    <>
      <AutoElementIds />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <MapPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/resources/:resourceId"
          element={
            <ProtectedRoute>
              <ResourceBookingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/feed"
          element={
            <ProtectedRoute>
              <SocialFeedPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/feed/create"
          element={
            <ProtectedRoute>
              <SocialCreatePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile/me"
          element={
            <ProtectedRoute>
              <UserProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile/:userId"
          element={
            <ProtectedRoute>
              <UserProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/users/:userId"
          element={
            <ProtectedRoute>
              <UserProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/statistics"
          element={
            <ProtectedRoute>
              <StatisticsPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default App;
