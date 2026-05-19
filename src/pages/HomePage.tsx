import { useAuthStore } from '../store/authStore';

export default function HomePage() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-md">
        <h1 className="mb-4 text-xl font-semibold text-gray-900">
          Вітаємо{user?.full_name ? `, ${user.full_name}` : ''}!
        </h1>
        <dl className="space-y-2 text-sm text-gray-700">
          <div className="flex justify-between gap-3">
            <dt className="font-medium text-gray-500">Email</dt>
            <dd className="truncate">{user?.email ?? '—'}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="font-medium text-gray-500">Роль</dt>
            <dd>{user?.role ?? '—'}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="font-medium text-gray-500">Гуртожиток</dt>
            <dd>{user?.dormitory_id ?? '—'}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="font-medium text-gray-500">Поверх</dt>
            <dd>{user?.floor_id ?? '—'}</dd>
          </div>
        </dl>
        <button
          type="button"
          onClick={logout}
          className="mt-6 w-full rounded-md bg-gray-900 px-4 py-2 font-medium text-white transition hover:bg-gray-800"
        >
          Вийти
        </button>
      </div>
    </div>
  );
}
