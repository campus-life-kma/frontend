import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { getFloorMapData, getFloors } from '../api/locations';
import type { RoomOnMap } from '../types/locations';
import FloorMap from '../components/FloorMap';
import RoomDetailsPanel from '../components/RoomDetailsPanel';

function toNumberOrNull(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function MapPage() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const [pickedFloorId, setPickedFloorId] = useState<number | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);

  const floorsQuery = useQuery({
    queryKey: ['floors', user?.dormitory_id],
    queryFn: () => getFloors(user!.dormitory_id!),
    enabled: !!user?.dormitory_id,
  });

  const effectiveFloorId: number | null =
    pickedFloorId ??
    toNumberOrNull(user?.floor_id) ??
    floorsQuery.data?.[0]?.id ??
    null;

  const mapQuery = useQuery({
    queryKey: ['floor-map', effectiveFloorId],
    queryFn: () => getFloorMapData(effectiveFloorId!),
    enabled: effectiveFloorId !== null,
  });

  const selectedRoom: RoomOnMap | null =
    mapQuery.data?.rooms.find((room) => room.id === selectedRoomId) ?? null;

  const handleRoomClick = (room: RoomOnMap) => setSelectedRoomId(room.id);

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header
        className={
          'flex items-center justify-between border-b border-gray-200 ' +
          'bg-white px-6 py-3'
        }
      >
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold text-gray-900">
            {mapQuery.data?.dormitory_name ?? 'Campus Life'}
          </h1>
          {floorsQuery.data && floorsQuery.data.length > 0 && (
            <select
              value={effectiveFloorId ?? ''}
              onChange={(event) => {
                setPickedFloorId(Number(event.target.value));
                setSelectedRoomId(null);
              }}
              className="rounded border border-gray-300 px-2 py-1 text-sm"
            >
              {floorsQuery.data.map((floor) => (
                <option key={floor.id} value={floor.id}>
                  Поверх {floor.number}
                </option>
              ))}
            </select>
          )}
        </div>
        <button
          type="button"
          onClick={logout}
          className={
            'rounded bg-gray-900 px-3 py-1 text-sm font-medium text-white ' +
            'hover:bg-gray-800'
          }
        >
          Вийти
        </button>
      </header>

      <main className="grid flex-1 grid-cols-[1fr_320px] gap-4 p-4">
        <section className="rounded-xl bg-white p-4 shadow-sm">
          {mapQuery.isLoading && (
            <p className="text-sm text-gray-500">Завантажуємо…</p>
          )}
          {mapQuery.isError && (
            <p className="text-sm text-red-700">Не вдалося завантажити мапу.</p>
          )}
          {mapQuery.data && (
            <FloorMap
              data={mapQuery.data}
              onRoomClick={handleRoomClick}
              selectedRoomId={selectedRoomId}
            />
          )}
        </section>

        <aside className="flex flex-col gap-4 rounded-xl bg-white p-4 shadow-sm">
          {mapQuery.data && mapQuery.data.active_floor_events.length > 0 && (
            <section className="border-b border-gray-100 pb-4">
              <h2 className="mb-2 text-sm font-medium text-gray-700">
                Події на поверсі
              </h2>
              <ul className="flex flex-col gap-2 text-sm">
                {mapQuery.data.active_floor_events.map((event) => (
                  <li key={event.id} className="rounded bg-gray-50 p-2">
                    <p className="font-medium">{event.title}</p>
                    <p className="text-xs text-gray-500">
                      {event.creator.display_name} · {event.participants_count}{' '}
                      учасник(ів)
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <RoomDetailsPanel room={selectedRoom} />
        </aside>
      </main>
    </div>
  );
}
