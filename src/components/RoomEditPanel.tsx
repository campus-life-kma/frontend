import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { RoomOnMap } from '../types/locations';
import { updateRoom, createResource, deleteResource } from '../api/locations';
import { getRoomTypes, getResourceTypes } from '../api/dictionaries';
import ResourceTypeIcon from './ResourceTypeIcon';

const ROOM_TYPE_LABEL: Record<string, string> = {
  LIVING: 'Житлова',
  COMMON_AREA: 'Спільний простір',
  KITCHEN: 'Кухня',
  LAUNDRY: 'Пральня',
  BATHROOM: 'Душова',
  TOILET: 'Туалет',
  STORAGE: 'Склад',
};

const RESOURCE_TYPE_LABEL: Record<string, string> = {
  OVEN: 'Духовка',
  STOVE: 'Плита',
  COOKTOP: 'Варильна поверхня',
  WASHING_MACHINE: 'Пральна машина',
  DRYER: 'Сушарка',
  MICROWAVE: 'Мікрохвильовка',
  FRIDGE: 'Холодильник',
  IRON: 'Праска',
  VACUUM_CLEANER: 'Пилосос',
  OTHER: 'Інше',
};

interface RoomEditPanelProps {
  room: RoomOnMap;
  floorId?: number | null;
  onCancel: () => void;
}

export default function RoomEditPanel({
  room,
  floorId,
  onCancel,
}: RoomEditPanelProps) {
  const queryClient = useQueryClient();

  const [name, setName] = useState(room.name);
  const [roomType, setRoomType] = useState(room.room_type as string);
  const [maxPerson, setMaxPerson] = useState(room.max_person);
  const [isBlocked, setIsBlocked] = useState(room.is_blocked);
  const [errorMsg, setErrorMsg] = useState('');

  const [isAddingResource, setIsAddingResource] = useState(false);
  const [newResourceName, setNewResourceName] = useState('');
  const [newResourceType, setNewResourceType] = useState<number | ''>('');
  const [newResourceMaxPerson, setNewResourceMaxPerson] = useState(1);

  const { data: roomTypes } = useQuery({
    queryKey: ['room-types'],
    queryFn: getRoomTypes,
  });

  const { data: resourceTypes } = useQuery({
    queryKey: ['resource-types'],
    queryFn: getResourceTypes,
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      // Find roomType ID based on string
      const selectedType = roomTypes?.find((rt) => rt.type === roomType);
      await updateRoom(room.id, {
        name,
        room_type: selectedType ? selectedType.id : undefined,
        max_person: maxPerson,
        is_blocked: isBlocked,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['floor-map', floorId] });
      onCancel();
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.detail || 'Помилка при збереженні');
    },
  });

  const deleteResourceMutation = useMutation({
    mutationFn: (resourceId: number) => deleteResource(resourceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['floor-map', floorId] });
    },
  });

  const createResourceMutation = useMutation({
    mutationFn: async () => {
      if (!newResourceType) throw new Error('Оберіть тип ресурсу');
      return createResource(room.id, {
        name: newResourceName,
        resource_type: Number(newResourceType),
        max_person: newResourceMaxPerson,
        is_blocked: false,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['floor-map', floorId] });
      setIsAddingResource(false);
      setNewResourceName('');
      setNewResourceType('');
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.detail || 'Помилка створення ресурсу');
    },
  });

  const hasResidents = room.current_users.length > 0;

  useEffect(() => {
    if (hasResidents && isBlocked) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsBlocked(false);
    }
  }, [hasResidents, isBlocked]);

  const canHaveResources = ['KITCHEN', 'LAUNDRY'].includes(roomType);

  const kitchenResources = ['OVEN', 'COOKTOP', 'STOVE', 'MICROWAVE', 'FRIDGE'];
  const laundryResources = ['WASHING_MACHINE', 'DRYER', 'IRON'];

  const filteredResourceTypes = resourceTypes?.filter((rt) => {
    if (roomType === 'KITCHEN') return kitchenResources.includes(rt.type);
    if (roomType === 'LAUNDRY') return laundryResources.includes(rt.type);
    return false;
  });

  return (
    <div className="flex flex-col gap-5 text-sm">
      <header className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          Редагування: {room.name}
        </h2>
      </header>

      {errorMsg && (
        <div className="rounded border border-red-200 bg-red-50 p-2 text-red-600">
          {errorMsg}
        </div>
      )}

      <section className="flex flex-col gap-3">
        <div>
          <label className="mb-1 block font-medium text-gray-700">Назва</label>
          <input
            type="text"
            className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div>
          <label className="mb-1 block font-medium text-gray-700">Тип</label>
          <select
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 outline-none focus:border-blue-500"
            value={roomType}
            onChange={(e) => setRoomType(e.target.value)}
          >
            {roomTypes?.map((rt) => (
              <option key={rt.id} value={rt.type}>
                {ROOM_TYPE_LABEL[rt.type] || rt.type}
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
            className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
            value={maxPerson}
            onChange={(e) => setMaxPerson(Number(e.target.value))}
          />
        </div>

        <label className="mt-2 flex cursor-pointer items-center gap-3">
          <div className="relative">
            <input
              type="checkbox"
              className="sr-only"
              checked={isBlocked}
              disabled={hasResidents}
              onChange={(e) => setIsBlocked(e.target.checked)}
            />
            <div
              className={`block h-6 w-10 rounded-full transition-colors ${
                isBlocked
                  ? 'bg-red-500'
                  : hasResidents
                    ? 'bg-gray-200'
                    : 'bg-gray-300'
              }`}
            ></div>
            <div
              className={`dot absolute top-1 left-1 h-4 w-4 rounded-full bg-white transition-transform ${
                isBlocked ? 'translate-x-4' : ''
              }`}
            ></div>
          </div>
          <div className="flex flex-col">
            <span
              className={`font-medium ${isBlocked ? 'text-red-600' : 'text-gray-700'}`}
            >
              Заблокована кімната
            </span>
            {hasResidents && (
              <span className="text-xs text-red-500">
                Неможливо заблокувати: в кімнаті є мешканці
              </span>
            )}
          </div>
        </label>
      </section>

      <section className="mt-2 border-t pt-4">
        <h3 className="mb-3 font-medium text-gray-700">Інвентар</h3>
        {!canHaveResources ? (
          <div className="rounded-md bg-gray-50 px-3 py-2 text-center text-xs text-gray-500">
            Додавання інвентарю доступне лише для кухонь та пралень
          </div>
        ) : (
          <>
            <ul className="flex flex-col gap-2">
              {room.resources.map((resource) => (
                <li
                  key={resource.id}
                  className="flex items-center justify-between rounded-md border border-gray-100 bg-gray-50 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <ResourceTypeIcon resource={resource} size={18} />
                    <span>{resource.name}</span>
                  </div>
                  <button
                    type="button"
                    className="text-gray-400 hover:text-red-500"
                    onClick={() => deleteResourceMutation.mutate(resource.id)}
                  >
                    Видалити
                  </button>
                </li>
              ))}
            </ul>

            {isAddingResource ? (
              <div className="mt-3 flex flex-col gap-2 rounded-md border border-gray-200 bg-gray-50 p-3">
                <input
                  type="text"
                  placeholder="Назва ресурсу"
                  className="w-full rounded border px-2 py-1 text-sm outline-none focus:border-blue-500"
                  value={newResourceName}
                  onChange={(e) => setNewResourceName(e.target.value)}
                />
                <select
                  className="w-full rounded border bg-white px-2 py-1 text-sm outline-none focus:border-blue-500"
                  value={newResourceType}
                  onChange={(e) => setNewResourceType(Number(e.target.value))}
                >
                  <option value="" disabled>
                    Оберіть тип ресурсу
                  </option>
                  {filteredResourceTypes?.map((rt) => (
                    <option key={rt.id} value={rt.id}>
                      {RESOURCE_TYPE_LABEL[rt.type] || rt.type}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  placeholder="Місткість"
                  className="w-full rounded border px-2 py-1 text-sm outline-none focus:border-blue-500"
                  value={newResourceMaxPerson}
                  onChange={(e) =>
                    setNewResourceMaxPerson(Number(e.target.value))
                  }
                />
                <div className="mt-1 flex justify-end gap-2">
                  <button
                    type="button"
                    className="text-xs text-gray-500 hover:text-gray-700"
                    onClick={() => setIsAddingResource(false)}
                  >
                    Скасувати
                  </button>
                  <button
                    type="button"
                    className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
                    onClick={() => createResourceMutation.mutate()}
                    disabled={!newResourceName || !newResourceType}
                  >
                    Зберегти
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className={
                  'mt-3 w-full rounded border border-dashed border-gray-300 py-1.5 ' +
                  'text-gray-500 hover:border-gray-400 hover:bg-gray-50'
                }
                onClick={() => setIsAddingResource(true)}
              >
                + Додати ресурс
              </button>
            )}
          </>
        )}
      </section>

      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-md border border-gray-300 py-2 text-center text-gray-700 hover:bg-gray-50"
        >
          Скасувати
        </button>
        <button
          type="button"
          onClick={() => updateMutation.mutate()}
          className="flex-1 rounded-md bg-blue-600 py-2 text-center text-white hover:bg-blue-700 disabled:opacity-50"
          disabled={updateMutation.isPending}
        >
          {updateMutation.isPending ? 'Збереження...' : 'Зберегти'}
        </button>
      </div>
    </div>
  );
}
