/* eslint-disable max-len */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { createUser, updateUserProfile } from '../api/users';
import { getRoles } from '../api/dictionaries';
import { getAnnouncementRecipients } from '../api/announcements';
import UserAvatar from './UserAvatar';
import type { AnnouncementRecipient } from '../types/announcements';

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
  const [activeTab, setActiveTab] = useState<'new' | 'existing'>('existing');

  // New user state
  const [email, setEmail] = useState('');
  const [position, setPosition] = useState('STUDENT');
  const [roleId, setRoleId] = useState<number | ''>('');

  // Existing user state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] =
    useState<AnnouncementRecipient | null>(null);

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

  const existingUsersQuery = useQuery({
    queryKey: [
      'announcement-recipients',
      searchQuery,
      'display_name',
      'SPECIFIC_USERS',
    ],
    queryFn: () =>
      getAnnouncementRecipients({ q: searchQuery, ordering: 'display_name', is_active: 'all' }),
    enabled: activeTab === 'existing',
  });

  const relocateMutation = useMutation({
    mutationFn: () => updateUserProfile(selectedUser!.id, { room: roomId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['floor-map'] });
      void queryClient.invalidateQueries({
        queryKey: ['room-details', roomId],
      });
      onClose();
    },
  });

  const errorMessage =
    activeTab === 'new' && createMutation.error
      ? extractErrorMessage(
          createMutation.error,
          'Помилка при створенні користувача.'
        )
      : activeTab === 'existing' && relocateMutation.error
        ? extractErrorMessage(
            relocateMutation.error,
            'Помилка при переселенні користувача.'
          )
        : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="p-6 pb-4">
          <h2 className="mb-4 text-xl font-bold text-gray-900">
            Додати мешканця
          </h2>

          <div className="mb-4 flex rounded-md bg-gray-100 p-1">
            <button
              onClick={() => setActiveTab('existing')}
              className={`flex-1 rounded-sm py-1.5 text-sm font-medium ${
                activeTab === 'existing'
                  ? 'bg-white text-gray-900 shadow'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Наявний користувач
            </button>
            <button
              onClick={() => setActiveTab('new')}
              className={`flex-1 rounded-sm py-1.5 text-sm font-medium ${
                activeTab === 'new'
                  ? 'bg-white text-gray-900 shadow'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Новий користувач
            </button>
          </div>

          <div className="overflow-y-auto">
            {activeTab === 'new' ? (
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
              </div>
            ) : (
              <div className="flex flex-col gap-4 text-sm">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSelectedUser(null);
                  }}
                  placeholder="Пошук за поштою, іменем..."
                  className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
                />

                <div className="flex min-h-[300px] max-h-[300px] flex-col gap-2 overflow-y-auto pr-1">
                  {existingUsersQuery.isLoading || existingUsersQuery.isFetching ? (
                    <div className="flex h-full items-center justify-center">
                      <p className="text-gray-500">Шукаємо...</p>
                    </div>
                  ) : existingUsersQuery.data?.length === 0 ? (
                    <div className="flex h-full items-center justify-center">
                      <p className="text-gray-500">Нікого не знайдено</p>
                    </div>
                  ) : (
                    existingUsersQuery.data?.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => setSelectedUser(user)}
                        className={`flex items-center gap-3 rounded-md border p-2 text-left ${
                          selectedUser?.id === user.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className="shrink-0">
                          <UserAvatar
                            photo={user.photo}
                            name={user.display_name}
                            size={40}
                          />
                        </div>
                        <div className="overflow-hidden">
                          <p className="truncate font-medium text-gray-900">
                            {user.display_name}
                          </p>
                          <p className="truncate text-xs text-gray-500">
                            {user.email}
                          </p>
                          {user.room_name && (
                            <p className="mt-0.5 truncate text-xs text-blue-600">
                              {user.room_name} ({user.floor_number} поверх)
                            </p>
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {errorMessage && (
            <p className="mt-4 rounded-md bg-red-50 p-2 text-sm text-red-700">
              {errorMessage}
            </p>
          )}

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={createMutation.isPending || relocateMutation.isPending}
              className={
                'flex-1 rounded-md border border-gray-300 py-2 text-center text-sm ' +
                'text-gray-700 hover:bg-gray-50 disabled:opacity-60'
              }
            >
              Скасувати
            </button>
            {activeTab === 'new' ? (
              <button
                type="button"
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || !email.trim()}
                className={
                  'flex-1 rounded-md bg-blue-600 py-2 text-center text-sm font-medium ' +
                  'text-white hover:bg-blue-700 disabled:opacity-50'
                }
              >
                {createMutation.isPending ? 'Додаємо...' : 'Додати'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => relocateMutation.mutate()}
                disabled={relocateMutation.isPending || !selectedUser}
                className={
                  'flex-1 rounded-md bg-blue-600 py-2 text-center text-sm font-medium ' +
                  'text-white hover:bg-blue-700 disabled:opacity-50'
                }
              >
                {relocateMutation.isPending ? 'Переселяємо...' : 'Заселити'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
