import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import type { ResourceOnMap, RoomOnMap } from '../types/locations';
import {
  updateRoom,
  createResource,
  updateResource,
  deleteResource,
} from '../api/locations';
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
  const [errorMsg, setErrorMsg] = useState('');

  const [isAddingResource, setIsAddingResource] = useState(false);
  const [newResourceName, setNewResourceName] = useState('');
  const [newResourceType, setNewResourceType] = useState<number | ''>('');
  const [newResourceMaxPerson, setNewResourceMaxPerson] = useState(1);
  const [editingResourceId, setEditingResourceId] = useState<number | null>(
    null
  );
  const [editResourceName, setEditResourceName] = useState('');
  const [editResourceType, setEditResourceType] = useState<number | ''>('');
  const [editResourceMaxPerson, setEditResourceMaxPerson] = useState(1);
  const [editResourceBlocked, setEditResourceBlocked] = useState(false);

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
        name: name.trim(),
        room_type: selectedType ? selectedType.id : undefined,
        max_person: maxPerson,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['floor-map', floorId] });
      onCancel();
    },
    onError: (err: AxiosError<{ detail?: string }>) => {
      setErrorMsg(err.response?.data?.detail || 'Помилка при збереженні');
    },
  });

  const deleteResourceMutation = useMutation({
    mutationFn: (resourceId: number) => deleteResource(resourceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['floor-map', floorId] });
    },
    onError: (err: AxiosError<{ detail?: string }>) => {
      setErrorMsg(err.response?.data?.detail || 'Помилка видалення ресурсу');
    },
  });

  const createResourceMutation = useMutation({
    mutationFn: async () => {
      if (!newResourceType) throw new Error('Оберіть тип ресурсу');
      return createResource(room.id, {
        name: newResourceName.trim(),
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
      setNewResourceMaxPerson(1);
    },
    onError: (err: AxiosError<{ detail?: string }>) => {
      setErrorMsg(err.response?.data?.detail || 'Помилка створення ресурсу');
    },
  });

  const updateResourceMutation = useMutation({
    mutationFn: async () => {
      if (!editingResourceId) throw new Error('Ресурс не обрано');
      if (!editResourceName.trim()) throw new Error('Вкажіть назву ресурсу');
      if (!editResourceType) throw new Error('Оберіть тип ресурсу');
      return updateResource(editingResourceId, {
        name: editResourceName.trim(),
        resource_type: Number(editResourceType),
        max_person: editResourceMaxPerson,
        is_blocked: editResourceBlocked,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['floor-map', floorId] });
      stopEditingResource();
    },
    onError: (err: AxiosError<{ detail?: string }>) => {
      setErrorMsg(err.response?.data?.detail || 'Помилка редагування ресурсу');
    },
  });

  const canHaveResources = ['KITCHEN', 'LAUNDRY'].includes(roomType);

  const kitchenResources = ['OVEN', 'COOKTOP', 'STOVE', 'MICROWAVE', 'FRIDGE'];
  const laundryResources = ['WASHING_MACHINE', 'DRYER', 'IRON'];

  const filteredResourceTypes = resourceTypes?.filter((rt) => {
    if (roomType === 'KITCHEN') return kitchenResources.includes(rt.type);
    if (roomType === 'LAUNDRY') return laundryResources.includes(rt.type);
    return false;
  });

  function getResourceTypeOptions(resource?: ResourceOnMap) {
    const options = filteredResourceTypes ? [...filteredResourceTypes] : [];
    if (!resource || !resourceTypes) return options;

    const currentType = resourceTypes.find(
      (type) => type.type === resource.resource_type
    );
    if (currentType && !options.some((type) => type.id === currentType.id)) {
      options.push(currentType);
    }

    return options;
  }

  function getResourceTypeId(resource: ResourceOnMap): number | '' {
    const resourceType = resourceTypes?.find(
      (type) => type.type === resource.resource_type
    );
    return resourceType?.id ?? '';
  }

  function startEditingResource(resource: ResourceOnMap) {
    setErrorMsg('');
    setIsAddingResource(false);
    setEditingResourceId(resource.id);
    setEditResourceName(resource.name);
    setEditResourceType(getResourceTypeId(resource));
    setEditResourceMaxPerson(resource.max_person);
    setEditResourceBlocked(resource.is_blocked);
  }

  function stopEditingResource() {
    setEditingResourceId(null);
    setEditResourceName('');
    setEditResourceType('');
    setEditResourceMaxPerson(1);
    setEditResourceBlocked(false);
  }

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
                  className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2"
                >
                  {editingResourceId === resource.id ? (
                    <div className="flex flex-col gap-2">
                      <input
                        type="text"
                        placeholder="Назва ресурсу"
                        className="w-full rounded border px-2 py-1 text-sm outline-none focus:border-blue-500"
                        value={editResourceName}
                        onChange={(e) => setEditResourceName(e.target.value)}
                      />
                      <select
                        className="w-full rounded border bg-white px-2 py-1 text-sm outline-none focus:border-blue-500"
                        value={editResourceType}
                        onChange={(e) =>
                          setEditResourceType(Number(e.target.value))
                        }
                      >
                        <option value="" disabled>
                          Оберіть тип ресурсу
                        </option>
                        {getResourceTypeOptions(resource).map((rt) => (
                          <option key={rt.id} value={rt.id}>
                            {RESOURCE_TYPE_LABEL[rt.type] || rt.type}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        placeholder="Місткість"
                        className="w-full rounded border px-2 py-1 text-sm outline-none focus:border-blue-500"
                        value={editResourceMaxPerson}
                        onChange={(e) =>
                          setEditResourceMaxPerson(Number(e.target.value))
                        }
                      />
                      <label className="flex items-center gap-2 text-xs text-gray-600">
                        <input
                          type="checkbox"
                          checked={editResourceBlocked}
                          onChange={(e) =>
                            setEditResourceBlocked(e.target.checked)
                          }
                        />
                        Заблоковано
                      </label>
                      <div className="mt-1 flex justify-end gap-2">
                        <button
                          type="button"
                          className="text-xs text-gray-500 hover:text-gray-700"
                          onClick={stopEditingResource}
                          disabled={updateResourceMutation.isPending}
                        >
                          Скасувати
                        </button>
                        <button
                          type="button"
                          className={
                            'rounded bg-blue-600 px-3 py-1 text-xs text-white ' +
                            'hover:bg-blue-700 disabled:opacity-50'
                          }
                          onClick={() => {
                            if (
                              editResourceMaxPerson < 1 ||
                              editResourceMaxPerson > 100
                            ) {
                              setErrorMsg(
                                'Місткість ресурсу повинна бути від 1 до 100.'
                              );
                              return;
                            }
                            updateResourceMutation.mutate();
                          }}
                          disabled={
                            updateResourceMutation.isPending ||
                            !editResourceName.trim() ||
                            !editResourceType
                          }
                        >
                          {updateResourceMutation.isPending
                            ? 'Зберігаємо...'
                            : 'Зберегти'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <ResourceTypeIcon resource={resource} size={18} />
                          <span className="truncate">{resource.name}</span>
                        </div>
                        <p className="mt-1 text-xs text-gray-500">
                          {resource.resource_type
                            ? RESOURCE_TYPE_LABEL[resource.resource_type] ||
                              resource.resource_type
                            : 'Тип не вказано'}{' '}
                          · {resource.max_person} місц.
                          {resource.is_blocked ? ' · заблоковано' : ''}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          className="text-gray-500 hover:text-blue-600"
                          onClick={() => startEditingResource(resource)}
                        >
                          Редагувати
                        </button>
                        <button
                          type="button"
                          className="text-gray-400 hover:text-red-500"
                          onClick={() => {
                            if (
                              window.confirm(
                                'Ви впевнені, що хочете видалити цей ресурс? ' +
                                  'Це призведе до скасування всіх активних бронювань.'
                              )
                            ) {
                              deleteResourceMutation.mutate(resource.id);
                            }
                          }}
                          disabled={deleteResourceMutation.isPending}
                        >
                          Видалити
                        </button>
                      </div>
                    </div>
                  )}
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
                  max={100}
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
                    onClick={() => {
                      if (
                        newResourceMaxPerson < 1 ||
                        newResourceMaxPerson > 100
                      ) {
                        setErrorMsg(
                          'Місткість ресурсу повинна бути від 1 до 100.'
                        );
                        return;
                      }
                      createResourceMutation.mutate();
                    }}
                    disabled={!newResourceName.trim() || !newResourceType}
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
          disabled={updateMutation.isPending || !name.trim()}
        >
          {updateMutation.isPending ? 'Збереження...' : 'Зберегти'}
        </button>
      </div>
    </div>
  );
}
