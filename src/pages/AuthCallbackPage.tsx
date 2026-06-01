import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMsal } from '@azure/msal-react';
import { loginWithMicrosoft } from '../api/auth';
import { useAuthStore } from '../store/authStore';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const { instance: msalInstance } = useMsal();
  const setSession = useAuthStore((state) => state.setSession);

  const [error, setError] = useState<string | null>(null);
  const isProcessing = useRef(false);

  useEffect(() => {
    if (isProcessing.current) return;
    isProcessing.current = true;

    msalInstance
      .handleRedirectPromise()
      .then(async (response) => {
        if (response && response.accessToken) {
          try {
            const session = await loginWithMicrosoft(response.accessToken);
            setSession({
              accessToken: session.access,
              refreshToken: session.refresh,
              user: session.user,
            });
            navigate('/', { replace: true });
          } catch (err) {
            console.error('Backend auth error:', err);
            setError(
              'Не вдалося авторизуватися на сервері. Зверніться до адміністратора.'
            );
          }
        } else {
          navigate('/login', { replace: true });
        }
      })
      .catch((err) => {
        console.error('MSAL Redirect Error:', err);
        setError('Помилка при поверненні з Microsoft SSO.');
      });
  }, [msalInstance, navigate, setSession]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
      {error ? (
        <div className="text-center">
          <p className="mb-4 font-medium text-red-600">{error}</p>
          <button
            onClick={() => navigate('/login', { replace: true })}
            className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700"
          >
            Повернутися до входу
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
          <p className="animate-pulse text-sm font-medium text-gray-500">
            Завершуємо вхід через SSO…
          </p>
        </div>
      )}
    </div>
  );
}
