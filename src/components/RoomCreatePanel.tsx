import axios from 'axios';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createRoom } from '../api/locations';
import { getRoomTypes } from '../api/dictionaries';
import type { RoomOnMap } from '../types/locations';

const ROOM_TYPE_LABEL: Record<string, string> = {
  LIVING: 'Житлова',
  COMMON_AREA: 'Спільний простір',
  KITCHEN: 'Кухня',
  LAUNDRY: 'Пральня',
  BATHROOM: 'Душова',
  TOILET: 'Туалет',
  STORAGE: 'Склад',
};

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

/**
 * Властивості для компонента RoomCreatePanel.
 */
interface RoomCreatePanelProps {
  /** ID поверху, на якому створюється кімната. */
  floorId: number;
  /** SVG-ідентифікатор елемента кімнати на карті поверху. */
  svgElementId: string;
  /** Скасування процесу створення. */
  onCancel: () => void;
  /** Зворотний виклик після успішного створення кімнати. */
  onCreated: (room: RoomOnMap) => void;
}

/**
 * Панель створення нової кімнати модератором або адміністратором.
 * Дозволяє вказати назву, тип кімнати, місткість та статус блокування.
 * Прив'язує кімнату до вибраного неактивного елемента SVG-карти поверху.
 */
export default function RoomCreatePanel({
  floorId,
  svgElementId,
  onCancel,
  onCreated,
}: RoomCreatePanelProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [roomType, setRoomType] = useState<number | ''>('');
  const [maxPerson, setMaxPerson] = useState(1);
  const [isBlocked, setIsBlocked] = useState(false);

  const roomTypesQuery = useQuery({
    queryKey: ['room-types'],
    queryFn: getRoomTypes,
  });

  const defaultRoomType = useMemo(
    () => roomTypesQuery.data?.find((type) => type.type === 'LIVING'),
    [roomTypesQuery.data]
  );
  const selectedRoomType =
    roomType === '' ? (defaultRoomType?.id ?? '') : roomType;

  const createMutation = useMutation({
    mutationFn: () => {
      if (!name.trim()) throw new Error('Вкажіть назву кімнати.');
      if (!selectedRoomType) throw new Error('Оберіть тип кімнати.');
      return createRoom(floorId, {
        name: name.trim(),
        room_type: Number(selectedRoomType),
        max_person: maxPerson,
        is_blocked: isBlocked,
        svg_element_id: svgElementId,
      });
    },
    onSuccess: (room) => {
      queryClient.invalidateQueries({ queryKey: ['floor-map', floorId] });
      onCreated(room);
    },
  });

  const errorMessage = createMutation.error
    ? extractErrorMessage(
        createMutation.error,
        'Не вдалося додати кімнату до гуртожитку.'
      )
    : '';

  return (
    <div className="flex flex-col gap-5 text-sm">
      <header className="pr-8">
        <p className="mb-1 text-xs font-semibold tracking-wide text-amber-700 uppercase">
          Неактивна зона мапи
        </p>
        <h2 className="text-lg font-semibold text-gray-900">
          Додати кімнату до гуртожитку
        </h2>
      </header>

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
        Ця зона є на мапі, але ще не належить гуртожитку, бо є частиною
        житлового будинку. Після додавання вона стане частиною гуртожитку та
        буде клікабельною для мешканців.
      </div>

      <section className="flex flex-col gap-3">
        <div>
          <label className="mb-1 block font-medium text-gray-700">Назва</label>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Наприклад, 101 або Комора"
            className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="mb-1 block font-medium text-gray-700">Тип</label>
          <select
            value={selectedRoomType}
            onChange={(event) => setRoomType(Number(event.target.value))}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 outline-none focus:border-blue-500"
          >
            <option value="" disabled>
              Оберіть тип кімнати
            </option>
            {roomTypesQuery.data?.map((type) => (
              <option key={type.id} value={type.id}>
                {ROOM_TYPE_LABEL[type.type] ?? type.type}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block font-medium text-gray-700">
            Місткість
          </label>
          <input
            type="number"
            min={0}
            value={maxPerson}
            onChange={(event) => setMaxPerson(Number(event.target.value))}
            className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
          />
        </div>

        <label className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-gray-700">
          <input
            type="checkbox"
            checked={isBlocked}
            onChange={(event) => setIsBlocked(event.target.checked)}
          />
          Створити одразу заблокованою
        </label>
      </section>

      {errorMessage && (
        <p role="alert" className="rounded-md bg-red-50 p-2 text-red-700">
          {errorMessage}
        </p>
      )}

      <div className="mt-2 flex gap-3">
        <button
          type="button"
          onClick={onCancel}
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
          disabled={
            createMutation.isPending || !name.trim() || !selectedRoomType
          }
          className={
            'flex-1 rounded-md bg-blue-600 py-2 text-center font-medium ' +
            'text-white hover:bg-blue-700 disabled:opacity-50'
          }
        >
          {createMutation.isPending ? 'Додаємо...' : 'Додати кімнату'}
        </button>
      </div>
    </div>
  );
}
