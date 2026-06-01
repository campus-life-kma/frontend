import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { createEvent, createSharingRequest } from '../api/social';
import { getFloors } from '../api/locations';
import ProfileMenu from '../components/ProfileMenu';
import { APP_TITLE } from '../constants/app';
import { useAuthStore } from '../store/authStore';
import type { SocialEventPayload } from '../types/social';

type CreateType = 'event' | 'sharing';

function toApiDateTime(value: string): string {
  return new Date(value).toISOString();
}

function normalizeError(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof error.response === 'object' &&
    error.response !== null &&
    'data' in error.response
  ) {
    const data = error.response.data;
    if (typeof data === 'object' && data !== null && 'detail' in data) {
      return String(data.detail);
    }
  }
  return 'Не вдалося опублікувати. Перевірте поля і спробуйте ще раз.';
}

export default function SocialCreatePage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const [type, setType] = useState<CreateType>('event');
  const [error, setError] = useState<string | null>(null);
  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    start_time: '',
    end_time: '',
    max_person: '0',
    has_limit: false,
    is_faculty_only: false,
    is_major_only: false,
    floor: '',
    custom_location: '',
  });
  const [sharingTitle, setSharingTitle] = useState('');

  const floorsQuery = useQuery({
    queryKey: ['create-feed-floors', user?.dormitory_id],
    queryFn: () => getFloors(user!.dormitory_id!),
    enabled: !!user?.dormitory_id,
  });

  const eventMutation = useMutation({
    mutationFn: createEvent,
    onSuccess: (event) => navigate(`/feed?eventId=${event.id}`),
    onError: (mutationError) => setError(normalizeError(mutationError)),
  });

  const sharingMutation = useMutation({
    mutationFn: createSharingRequest,
    onSuccess: (request) => navigate(`/feed?sharingId=${request.id}`),
    onError: (mutationError) => setError(normalizeError(mutationError)),
  });

  function submitEvent() {
    setError(null);
    if (!eventForm.title.trim() || !eventForm.description.trim()) {
      setError('Заповніть назву та опис події.');
      return;
    }
    if (!eventForm.start_time || !eventForm.end_time) {
      setError('Вкажіть час початку та завершення події.');
      return;
    }
    if (!eventForm.floor && !eventForm.custom_location.trim()) {
      setError('Вкажіть поверх або довільну локацію.');
      return;
    }

    const payload: SocialEventPayload = {
      title: eventForm.title.trim(),
      description: eventForm.description.trim(),
      start_time: toApiDateTime(eventForm.start_time),
      end_time: toApiDateTime(eventForm.end_time),
      max_person: eventForm.has_limit ? Number(eventForm.max_person) || 1 : 0,
      is_faculty_only: eventForm.is_faculty_only,
      is_major_only: eventForm.is_major_only,
      floor: eventForm.floor ? Number(eventForm.floor) : null,
      custom_location: eventForm.custom_location.trim() || null,
    };
    eventMutation.mutate(payload);
  }

  function submitSharing() {
    setError(null);
    if (!sharingTitle.trim()) {
      setError('Вкажіть, що саме вам потрібно.');
      return;
    }
    sharingMutation.mutate({ title: sharingTitle.trim() });
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-6">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold text-gray-900">
            <Link to="/">{APP_TITLE}</Link>
          </h1>
          <nav className="flex items-center gap-2 text-sm">
            <Link
              className="rounded-md px-3 py-1.5 text-gray-600 hover:bg-gray-50"
              to="/"
            >
              Мапа
            </Link>
            <Link
              className="rounded-md px-3 py-1.5 text-gray-600 hover:bg-gray-50"
              to="/feed"
            >
              Стрічка
            </Link>
          </nav>
        </div>
        {user && <ProfileMenu user={user} onLogout={logout} />}
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-gray-950">Створити</h1>
              <p className="mt-1 text-sm text-gray-500">
                Опублікуйте івент або короткий запит на шеринг.
              </p>
            </div>
            <Link
              className="text-sm font-medium text-gray-500 hover:text-gray-800"
              to="/feed"
            >
              Скасувати
            </Link>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setType('event')}
              className={
                'rounded-lg border p-4 text-left transition ' +
                (type === 'event'
                  ? 'border-blue-300 bg-blue-50'
                  : 'border-gray-200 hover:bg-gray-50')
              }
            >
              <span className="text-sm font-semibold text-gray-950">
                Створити івент
              </span>
              <span className="mt-1 block text-sm text-gray-500">
                Подія з часом, локацією та учасниками.
              </span>
            </button>
            <button
              type="button"
              onClick={() => setType('sharing')}
              className={
                'rounded-lg border p-4 text-left transition ' +
                (type === 'sharing'
                  ? 'border-blue-300 bg-blue-50'
                  : 'border-gray-200 hover:bg-gray-50')
              }
            >
              <span className="text-sm font-semibold text-gray-950">
                Запит на шеринг
              </span>
              <span className="mt-1 block text-sm text-gray-500">
                Коротко попросіть річ або допомогу.
              </span>
            </button>
          </div>

          {type === 'event' ? (
            <div className="mt-6 space-y-4">
              <TextInput
                label="Назва"
                value={eventForm.title}
                onChange={(value) =>
                  setEventForm((form) => ({ ...form, title: value }))
                }
              />
              <label className="block text-sm font-medium text-gray-700">
                Опис
                <textarea
                  value={eventForm.description}
                  onChange={(event) =>
                    setEventForm((form) => ({
                      ...form,
                      description: event.target.value,
                    }))
                  }
                  rows={4}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextInput
                  label="Початок"
                  type="datetime-local"
                  value={eventForm.start_time}
                  onChange={(value) =>
                    setEventForm((form) => ({ ...form, start_time: value }))
                  }
                />
                <TextInput
                  label="Завершення"
                  type="datetime-local"
                  value={eventForm.end_time}
                  onChange={(value) =>
                    setEventForm((form) => ({ ...form, end_time: value }))
                  }
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-gray-200 p-3">
                  <label className="flex items-center justify-between gap-3 text-sm font-medium text-gray-700">
                    <span>Кількість учасників</span>
                    <span className="flex items-center gap-2 text-xs text-gray-500">
                      Необмежено
                      <input
                        type="checkbox"
                        checked={!eventForm.has_limit}
                        onChange={(event) =>
                          setEventForm((form) => ({
                            ...form,
                            has_limit: !event.target.checked,
                          }))
                        }
                        className="h-4 w-4 accent-blue-600"
                      />
                    </span>
                  </label>
                  {eventForm.has_limit ? (
                    <input
                      type="number"
                      min="1"
                      value={eventForm.max_person}
                      onChange={(event) =>
                        setEventForm((form) => ({
                          ...form,
                          max_person: event.target.value,
                        }))
                      }
                      className="mt-2 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                  ) : (
                    <p className="mt-2 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700">
                      До події зможе приєднатися будь-яка кількість людей.
                    </p>
                  )}
                </div>
                <label className="block text-sm font-medium text-gray-700">
                  Поверх
                  <select
                    value={eventForm.floor}
                    onChange={(event) =>
                      setEventForm((form) => ({
                        ...form,
                        floor: event.target.value,
                      }))
                    }
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="">Не обрано</option>
                    {floorsQuery.data?.map((floor) => (
                      <option key={floor.id} value={floor.id}>
                        Поверх {floor.number}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <TextInput
                label="Довільна локація"
                value={eventForm.custom_location}
                onChange={(value) =>
                  setEventForm((form) => ({ ...form, custom_location: value }))
                }
              />
              <div className="flex flex-wrap gap-3">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={eventForm.is_faculty_only}
                    onChange={(event) =>
                      setEventForm((form) => ({
                        ...form,
                        is_faculty_only: event.target.checked,
                      }))
                    }
                    className="h-4 w-4 accent-blue-600"
                  />
                  Лише мій факультет
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={eventForm.is_major_only}
                    onChange={(event) =>
                      setEventForm((form) => ({
                        ...form,
                        is_major_only: event.target.checked,
                      }))
                    }
                    className="h-4 w-4 accent-blue-600"
                  />
                  Лише моя спеціальність
                </label>
              </div>
            </div>
          ) : (
            <div className="mt-6">
              <TextInput
                label="Що потрібно?"
                value={sharingTitle}
                onChange={setSharingTitle}
              />
            </div>
          )}

          {error && (
            <p className="mt-5 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="mt-6 flex justify-end gap-2">
            <Link
              to="/feed"
              className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Скасувати
            </Link>
            <button
              type="button"
              onClick={type === 'event' ? submitEvent : submitSharing}
              disabled={eventMutation.isPending || sharingMutation.isPending}
              className={
                'rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold ' +
                'text-white hover:bg-blue-700 disabled:bg-gray-300'
              }
            >
              Опублікувати
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block text-sm font-medium text-gray-700">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
    </label>
  );
}
