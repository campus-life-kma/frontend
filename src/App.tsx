import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import MapPage from './pages/MapPage';
import ResourceBookingPage from './pages/ResourceBookingPage';
import SocialCreatePage from './pages/SocialCreatePage';
import SocialFeedPage from './pages/SocialFeedPage';
import AuthCallbackPage from './pages/AuthCallbackPage';
import ProtectedRoute from './components/ProtectedRoute';
import { useAuthStore } from './store/authStore';

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
      <Route path="*" element={<Navigate to="/map" replace />} />
    </Routes>
  );
}

export default App;
