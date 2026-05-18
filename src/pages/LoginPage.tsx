import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMsal } from '@azure/msal-react';
import axios from 'axios';
import { devLogin, loginWithMicrosoft } from '../api/auth';
import { msalLoginRequest } from '../api/msal-config';
import { useAuthStore } from '../store/authStore';

function extractErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { detail?: string; email?: string[] }
      | undefined;
    if (data?.detail) return data.detail;
    if (Array.isArray(data?.email) && data.email.length > 0)
      return data.email[0];
  }
  return fallback;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { instance: msalInstance } = useMsal();
  const setSession = useAuthStore((state) => state.setSession);

  const [email, setEmail] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSso() {
    setError(null);
    setSsoLoading(true);
    try {
      const result = await msalInstance.loginPopup(msalLoginRequest);
      const session = await loginWithMicrosoft(result.accessToken);
      setSession({
        accessToken: session.access,
        refreshToken: session.refresh,
        user: session.user,
      });
      navigate('/');
    } catch (err) {
      setError(extractErrorMessage(err, 'Не вдалося увійти через SSO.'));
    } finally {
      setSsoLoading(false);
    }
  }

  async function handleDevLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setEmailLoading(true);
    try {
      const session = await devLogin(email.trim());
      setSession({
        accessToken: session.access,
        refreshToken: session.refresh,
        user: session.user,
      });
      navigate('/');
    } catch (err) {
      setError(extractErrorMessage(err, 'Не вдалося увійти через пошту.'));
    } finally {
      setEmailLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-md">
        <h1 className="mb-2 text-center text-2xl font-semibold text-gray-900">
          Campus Life
        </h1>
        <p className="mb-6 text-center text-sm text-gray-500">
          Увійдіть, щоб продовжити
        </p>

        <button
          type="button"
          onClick={handleSso}
          disabled={ssoLoading || emailLoading}
          className={
            'mb-4 w-full rounded-md bg-blue-600 px-4 py-2 font-medium ' +
            'text-white transition hover:bg-blue-700 ' +
            'disabled:cursor-not-allowed disabled:bg-blue-300'
          }
        >
          {ssoLoading ? 'Вхід…' : 'Увійти через корпоративну пошту (SSO)'}
        </button>

        <div className="my-6 flex items-center gap-3 text-xs text-gray-400">
          <div className="h-px flex-1 bg-gray-200" />
          <span>або</span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        <form onSubmit={handleDevLogin} className="flex flex-col gap-3">
          <label className="text-sm font-medium text-gray-700" htmlFor="email">
            Пошта
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@ukma.edu.ua"
            className={
              'rounded-md border border-gray-300 px-3 py-2 outline-none ' +
              'focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
            }
          />
          <button
            type="submit"
            disabled={emailLoading || ssoLoading || !email.trim()}
            className={
              'rounded-md bg-gray-900 px-4 py-2 font-medium text-white ' +
              'transition hover:bg-gray-800 ' +
              'disabled:cursor-not-allowed disabled:bg-gray-400'
            }
          >
            {emailLoading ? 'Вхід…' : 'Увійти через пошту'}
          </button>
        </form>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
