import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  createEvent,
  createSharingRequest,
  getEvent,
  getSharingRequest,
  updateEvent,
  updateSharingRequest,
} from '../api/social';
import { getFloors, getRooms } from '../api/locations';
import AppHeader from '../components/AppHeader';
import { useAuthStore } from '../store/authStore';
import type {
  SocialEventPayload,
  SocialEventUpdatePayload,
} from '../types/social';

type CreateType = 'event' | 'sharing';

/**
 * Перетворює локальну дату/час на формат ISO 8601 для відправки на API.
 */
function toApiDateTime(value: string): string {
  const parsed = new Date(value);
  if (isNaN(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
}

/**
 * Перетворює дату з API у локальний формат, сумісний з
 * input type="datetime-local".
 */
function toLocalDateTimeInput(value: string): string {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

const ERROR_FIELD_LABELS: Record<string, string> = {
  title: 'Назва',
  description: 'Опис',
  start_time: 'Початок',
  end_time: 'Завершення',
  max_person: 'Кількість учасників',
  room: 'Кімната',
  floor: 'Поверх',
  custom_location: 'Локація',
  is_faculty_only: 'Обмеження факультетом',
  is_major_only: 'Обмеження спеціальністю',
  non_field_errors: 'Помилка',
  detail: '',
};

/**
 * Рекурсивно розгортає об'єкт помилок валідації API у плоский
 * масив повідомлень, підставляючи україномовні назви полів.
 */
function flattenErrorMessages(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(flattenErrorMessages);
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).flatMap(([key, nestedValue]) => {
      const messages = flattenErrorMessages(nestedValue);
      const label = ERROR_FIELD_LABELS[key] ?? key;
      if (!label) return messages;
      return messages.map((message) => `${label}: ${message}`);
    });
  }
  return [];
}

/**
 * Нормалізує помилку запиту Axios до об'єднаного текстового повідомлення.
 */
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
    const messages = flattenErrorMessages(data);
    if (messages.length > 0) return messages.join(' ');
  }
  return 'Не вдалося опублікувати. Перевірте поля і спробуйте ще раз.';
}

/**
 * Сторінка створення та редагування соціальних елементів.
 * Дозволяє користувачам публікувати або змінювати оголошення про події (events)
 * чи запити на позичання речей (sharing requests) з налаштуванням фільтрів
 * одержувачів (факультет, спеціальність, поверх).
 */
export default function SocialCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const [type, setType] = useState<CreateType>('event');
  const [error, setError] = useState<string | null>(null);
  const [initializedEditKey, setInitializedEditKey] = useState<string | null>(
    null
  );
  const editEventId = Number(searchParams.get('eventId'));
  const editSharingId = Number(searchParams.get('sharingId'));
  const isEditingEvent = Number.isFinite(editEventId) && editEventId > 0;
  const isEditingSharing = Number.isFinite(editSharingId) && editSharingId > 0;
  const isEditing = isEditingEvent || isEditingSharing;
  const editKey = isEditingEvent
    ? `event-${editEventId}`
    : isEditingSharing
      ? `sharing-${editSharingId}`
      : null;
  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    start_time: '',
    end_time: '',
    max_person: '0',
    has_limit: false,
    is_faculty_only: false,
    is_major_only: false,
    room: '',
    floor: '',
    custom_location: '',
  });
  const [sharingTitle, setSharingTitle] = useState('');
  const canUseFacultyRestriction = Boolean(user?.faculty_id);
  const canUseMajorRestriction = Boolean(user?.major_id);

  const floorsQuery = useQuery({
    queryKey: ['create-feed-floors', user?.dormitory_id],
    queryFn: () => getFloors(user!.dormitory_id!),
    enabled: !!user?.dormitory_id,
  });

  const roomsQuery = useQuery({
    queryKey: ['create-feed-rooms'],
    queryFn: getRooms,
    enabled: type === 'event',
  });

  const eventDetailQuery = useQuery({
    queryKey: ['event-detail', editEventId],
    queryFn: () => getEvent(editEventId),
    enabled: isEditingEvent,
  });

  const sharingDetailQuery = useQuery({
    queryKey: ['sharing-request-detail', editSharingId],
    queryFn: () => getSharingRequest(editSharingId),
    enabled: isEditingSharing,
  });

  useEffect(() => {
    if (!isEditing || !editKey || initializedEditKey === editKey) return;

    if (isEditingEvent && eventDetailQuery.data) {
      const event = eventDetailQuery.data;
      queueMicrotask(() => {
        setType('event');
        setEventForm({
          title: event.title,
          description: event.description,
          start_time: toLocalDateTimeInput(event.start_time),
          end_time: toLocalDateTimeInput(event.end_time),
          max_person: String(event.max_person || 0),
          has_limit: event.max_person > 0,
          is_faculty_only: event.is_faculty_only,
          is_major_only: event.is_major_only,
          room: event.room_id ? String(event.room_id) : '',
          floor: event.floor_id ? String(event.floor_id) : '',
          custom_location: event.custom_location ?? '',
        });
        setInitializedEditKey(editKey);
      });
    }

    if (isEditingSharing && sharingDetailQuery.data) {
      const sharing = sharingDetailQuery.data;
      queueMicrotask(() => {
        setType('sharing');
        setSharingTitle(sharing.title);
        setInitializedEditKey(editKey);
      });
    }
  }, [
    editKey,
    eventDetailQuery.data,
    initializedEditKey,
    isEditing,
    isEditingEvent,
    isEditingSharing,
    sharingDetailQuery.data,
  ]);

  const eventMutation = useMutation({
    mutationFn: createEvent,
    onSuccess: () => navigate('/feed'),
    onError: (mutationError) => setError(normalizeError(mutationError)),
  });

  const eventUpdateMutation = useMutation({
    mutationFn: (payload: SocialEventUpdatePayload) =>
      updateEvent(editEventId, payload),
    onSuccess: (event) => navigate(`/feed?eventId=${event.id}`),
    onError: (mutationError) => setError(normalizeError(mutationError)),
  });

  const sharingMutation = useMutation({
    mutationFn: createSharingRequest,
    onSuccess: () => navigate('/feed'),
    onError: (mutationError) => setError(normalizeError(mutationError)),
  });

  const sharingUpdateMutation = useMutation({
    mutationFn: (payload: { title: string }) =>
      updateSharingRequest(editSharingId, payload),
    onSuccess: (request) => navigate(`/feed?sharingId=${request.id}`),
    onError: (mutationError) => setError(normalizeError(mutationError)),
  });

  const isSubmitting =
    eventMutation.isPending ||
    eventUpdateMutation.isPending ||
    sharingMutation.isPending ||
    sharingUpdateMutation.isPending;
  const isLoadingEdit =
    (isEditingEvent && eventDetailQuery.isLoading) ||
    (isEditingSharing && sharingDetailQuery.isLoading);
  const pageTitle = isEditing ? 'Редагувати' : 'Створити';
  const submitLabel = isEditing
    ? isSubmitting
      ? 'Зберігаємо…'
      : 'Зберегти зміни'
    : isSubmitting
      ? 'Публікуємо…'
      : 'Опублікувати';

  const cancelPath = useMemo(() => {
    if (isEditingEvent) return `/feed?eventId=${editEventId}`;
    if (isEditingSharing) return `/feed?sharingId=${editSharingId}`;
    return '/feed';
  }, [editEventId, editSharingId, isEditingEvent, isEditingSharing]);

  const floorNumberById = useMemo(
    () =>
      new Map(
        (floorsQuery.data ?? []).map((floor) => [floor.id, floor.number])
      ),
    [floorsQuery.data]
  );

  const roomById = useMemo(
    () => new Map((roomsQuery.data ?? []).map((room) => [room.id, room])),
    [roomsQuery.data]
  );

  const selectedFloorId = eventForm.floor ? Number(eventForm.floor) : null;
  const selectedRoom = eventForm.room
    ? roomById.get(Number(eventForm.room))
    : null;
  const selectedFloorNumber = selectedFloorId
    ? floorNumberById.get(selectedFloorId)
    : null;

  const roomOptions = useMemo(() => {
    const floors = floorsQuery.data ?? [];
    const floorIds = new Set(floors.map((floor) => floor.id));

    return (roomsQuery.data ?? [])
      .filter((room) => floorIds.size === 0 || floorIds.has(room.floor))
      .filter((room) => !selectedFloorId || room.floor === selectedFloorId)
      .sort((firstRoom, secondRoom) => {
        const firstFloor = floorNumberById.get(firstRoom.floor) ?? 0;
        const secondFloor = floorNumberById.get(secondRoom.floor) ?? 0;
        if (firstFloor !== secondFloor) return firstFloor - secondFloor;
        return firstRoom.name.localeCompare(secondRoom.name, 'uk', {
          numeric: true,
          sensitivity: 'base',
        });
      });
  }, [floorNumberById, floorsQuery.data, roomsQuery.data, selectedFloorId]);

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
    if (new Date(eventForm.start_time) >= new Date(eventForm.end_time)) {
      setError('Час завершення події має бути пізнішим за час початку.');
      return;
    }
    if (
      !eventForm.room &&
      !eventForm.floor &&
      !eventForm.custom_location.trim()
    ) {
      setError('Вкажіть кімнату, поверх або довільну локацію.');
      return;
    }

    const payload: SocialEventPayload = {
      title: eventForm.title.trim(),
      description: eventForm.description.trim(),
      start_time: toApiDateTime(eventForm.start_time),
      end_time: toApiDateTime(eventForm.end_time),
      max_person: eventForm.has_limit ? Number(eventForm.max_person) || 1 : 0,
      is_faculty_only: canUseFacultyRestriction && eventForm.is_faculty_only,
      is_major_only: canUseMajorRestriction && eventForm.is_major_only,
      room: eventForm.room ? Number(eventForm.room) : null,
      floor: eventForm.floor ? Number(eventForm.floor) : null,
      custom_location: eventForm.custom_location.trim() || null,
    };
    if (isEditingEvent) {
      const updatePayload: SocialEventUpdatePayload = { ...payload };
      const originalStart = eventDetailQuery.data?.start_time;
      if (
        originalStart &&
        eventForm.start_time === toLocalDateTimeInput(originalStart) &&
        new Date(originalStart) < new Date()
      ) {
        delete updatePayload.start_time;
      }
      eventUpdateMutation.mutate(updatePayload);
    } else {
      eventMutation.mutate(payload);
    }
  }

  function submitSharing() {
    setError(null);
    if (!sharingTitle.trim()) {
      setError('Вкажіть, що саме вам потрібно.');
      return;
    }
    const payload = { title: sharingTitle.trim() };
    if (isEditingSharing) sharingUpdateMutation.mutate(payload);
    else sharingMutation.mutate(payload);
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <AppHeader active="feed" />

      <main className="mx-auto max-w-3xl px-6 py-8">
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-gray-950">
                {pageTitle}
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                {isEditing
                  ? 'Оновіть інформацію, яку бачать мешканці у стрічці.'
                  : 'Опублікуйте івент або короткий запит на шеринг.'}
              </p>
            </div>
            <Link
              className="text-sm font-medium text-gray-500 hover:text-gray-800"
              to={cancelPath}
            >
              Скасувати
            </Link>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setType('event')}
              disabled={isEditing}
              className={
                'rounded-lg border p-4 text-left transition ' +
                (type === 'event'
                  ? 'border-blue-300 bg-blue-50'
                  : 'border-gray-200 hover:bg-gray-50') +
                (isEditing ? ' cursor-not-allowed opacity-70' : '')
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
              disabled={isEditing}
              className={
                'rounded-lg border p-4 text-left transition ' +
                (type === 'sharing'
                  ? 'border-blue-300 bg-blue-50'
                  : 'border-gray-200 hover:bg-gray-50') +
                (isEditing ? ' cursor-not-allowed opacity-70' : '')
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

          {isLoadingEdit ? (
            <p className="mt-6 rounded-md bg-gray-50 px-3 py-4 text-sm text-gray-500">
              Завантажуємо дані для редагування…
            </p>
          ) : type === 'event' ? (
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
                <div className="rounded-lg border border-gray-200 p-3">
                  <p className="text-sm font-medium text-gray-700">
                    Локація івенту
                  </p>
                  <p className="mt-2 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-600">
                    {selectedRoom
                      ? `${selectedRoom.name}${selectedFloorNumber ? ` · ${selectedFloorNumber} поверх` : ''}`
                      : eventForm.floor
                        ? selectedFloorNumber
                          ? `Поверх ${selectedFloorNumber}`
                          : `Поверх #${eventForm.floor}`
                        : eventForm.custom_location.trim()
                          ? eventForm.custom_location.trim()
                          : 'Оберіть поверх, кімнату або довільну локацію.'}
                  </p>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-gray-700">
                  Поверх
                  <select
                    value={eventForm.floor}
                    onChange={(event) => {
                      const nextFloor = event.target.value;
                      const currentRoom = eventForm.room
                        ? roomById.get(Number(eventForm.room))
                        : null;
                      setEventForm((form) => ({
                        ...form,
                        room:
                          currentRoom && String(currentRoom.floor) === nextFloor
                            ? form.room
                            : '',
                        floor: nextFloor,
                        custom_location: '',
                      }));
                    }}
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
                <label className="block text-sm font-medium text-gray-700">
                  Кімната
                  <select
                    value={eventForm.room}
                    onChange={(event) => {
                      const room = event.target.value
                        ? roomById.get(Number(event.target.value))
                        : null;
                      setEventForm((form) => ({
                        ...form,
                        room: event.target.value,
                        floor: room ? String(room.floor) : form.floor,
                        custom_location: '',
                      }));
                    }}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="">
                      {roomsQuery.isLoading
                        ? 'Завантажуємо кімнати...'
                        : selectedFloorNumber
                          ? `Увесь ${selectedFloorNumber} поверх`
                          : 'Не обрано'}
                    </option>
                    {roomOptions.map((room) => {
                      const floorNumber = floorNumberById.get(room.floor);
                      return (
                        <option key={room.id} value={room.id}>
                          {room.name}
                          {!selectedFloorId && floorNumber
                            ? ` · ${floorNumber} поверх`
                            : ''}
                        </option>
                      );
                    })}
                  </select>
                </label>
              </div>
              <TextInput
                label="Довільна локація"
                value={eventForm.custom_location}
                onChange={(value) =>
                  setEventForm((form) => ({
                    ...form,
                    room: '',
                    floor: '',
                    custom_location: value,
                  }))
                }
              />
              {(canUseFacultyRestriction || canUseMajorRestriction) && (
                <div className="flex flex-wrap gap-3">
                  {canUseFacultyRestriction && (
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
                  )}
                  {canUseMajorRestriction && (
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
                  )}
                </div>
              )}
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
              to={cancelPath}
              className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Скасувати
            </Link>
            <button
              type="button"
              onClick={type === 'event' ? submitEvent : submitSharing}
              disabled={isSubmitting || isLoadingEdit}
              className={
                'rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold ' +
                'text-white hover:bg-blue-700 disabled:bg-gray-300'
              }
            >
              {submitLabel}
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
