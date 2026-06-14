import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

/**
 * Властивості для компонента ProtectedRoute.
 */
interface ProtectedRouteProps {
  /** Дочірні елементи, які рендеряться у разі успішної авторизації. */
  children: ReactNode;
}

/**
 * Компонент-обгортка для захисту приватних роутів.
 * Перенаправляє користувача на сторінку входу `/login`,
 * якщо сесія авторизації відсутня у сховищі.
 */
export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const user = useAuthStore((state) => state.user);
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}
