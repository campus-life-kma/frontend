import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { createUser } from '../api/users';
import { getRoles } from '../api/dictionaries';

interface AddResidentModalProps {
  roomId: number;
  onClose: () => void;
}

function extractErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { detail?: string; [key: string]: string[] | string | undefined }
      | undefined;
    if (data?.detail) return data.detail;
    const firstFieldError = Object.values(data ?? {}).find(Boolean);
    if (Array.isArray(firstFieldError)) return firstFieldError[0] ?? fallback;
    if (typeof firstFieldError === 'string') return firstFieldError;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

export default function AddResidentModal({
  roomId,
  onClose,
}: AddResidentModalProps) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [position, setPosition] = useState('STUDENT');
  const [roleId, setRoleId] = useState<number | ''>('');

  const rolesQuery = useQuery({
    queryKey: ['roles'],
    queryFn: getRoles,
  });

  const roles = rolesQuery.data ?? [];
  const selectedRoleId =
    roleId === ''
      ? (roles.find((r) => r.name === 'RESIDENT')?.id ?? roles[0]?.id ?? 0)
      : roleId;

  const createMutation = useMutation({
    mutationFn: () =>
      createUser({
        email: email.trim(),
        position,
        role: selectedRoleId as number,
        room: roomId,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['floor-map'] });
      void queryClient.invalidateQueries({
        queryKey: ['room-details', roomId],
      });
      onClose();
    },
  });

  const errorMessage = createMutation.error
    ? extractErrorMessage(
        createMutation.error,
        'Помилка при створенні користувача.'
      )
    : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-xl font-bold text-gray-900">
          Додати мешканця
        </h2>
        <div className="flex flex-col gap-4 text-sm">
          <div>
            <label className="mb-1 block font-medium text-gray-700">
              Корпоративна пошта
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="student@ukma.edu.ua"
              className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block font-medium text-gray-700">
              Посада у ВНЗ
            </label>
            <select
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 outline-none focus:border-blue-500"
            >
              <option value="STUDENT">Студент</option>
              <option value="TEACHER">Викладач</option>
              <option value="EMPLOYEE">Працівник</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block font-medium text-gray-700">
              Роль в системі
            </label>
            <select
              value={selectedRoleId}
              onChange={(e) => setRoleId(Number(e.target.value))}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 outline-none focus:border-blue-500"
            >
              <option value="" disabled>
                Завантаження ролей...
              </option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name === 'RESIDENT'
                    ? 'Мешканець'
                    : r.name === 'MODERATOR'
                      ? 'Модератор'
                      : r.name === 'ADMIN'
                        ? 'Адміністратор'
                        : r.name}
                </option>
              ))}
            </select>
          </div>

          {errorMessage && (
            <p className="rounded-md bg-red-50 p-2 text-red-700">
              {errorMessage}
            </p>
          )}

          <div className="mt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={createMutation.isPending}
              className={
                'flex-1 rounded-md border border-gray-300 py-2 text-center ' +
                'text-gray-700 hover:bg-gray-50 disabled:opacity-60'
              }
            >
              Скасувати
            </button>
            <button
              type="button"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !email.trim()}
              className={
                'flex-1 rounded-md bg-blue-600 py-2 text-center font-medium ' +
                'text-white hover:bg-blue-700 disabled:opacity-50'
              }
            >
              {createMutation.isPending ? 'Додаємо...' : 'Додати'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
