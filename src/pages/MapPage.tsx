import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { getFloorMapData, getFloors } from '../api/locations';
import type { RoomOnMap } from '../types/locations';
import FloorMap from '../components/FloorMap';
import FloorRail from '../components/FloorRail';
import ProfileMenu from '../components/ProfileMenu';
import RoomDetailsDrawer from '../components/RoomDetailsDrawer';

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
    refetchInterval: 2 * 60 * 1000,
  });

  const selectedRoom: RoomOnMap | null =
    mapQuery.data?.rooms.find((room) => room.id === selectedRoomId) ?? null;

  const handleFloorSelect = (floorId: number) => {
    setPickedFloorId(floorId);
    setSelectedRoomId(null);
  };

  const floorEvents = mapQuery.data?.active_floor_events ?? [];

  return (
    <div id="map-page" className="flex h-screen flex-col bg-gray-50">
      <header
        id="map-header"
        className={
          'flex h-14 items-center justify-between border-b border-gray-200 ' +
          'bg-white px-6'
        }
      >
        <h1 className="text-lg font-semibold text-gray-900">
          {mapQuery.data?.dormitory_name ?? 'Campus Life'}
        </h1>
        {user && <ProfileMenu user={user} onLogout={logout} />}
      </header>

      <main id="map-main" className="relative flex flex-1 overflow-hidden">
        {floorsQuery.data && (
          <FloorRail
            floors={floorsQuery.data}
            selectedFloorId={effectiveFloorId}
            onSelect={handleFloorSelect}
          />
        )}

        {floorEvents.length > 0 && (
          <div
            id="floor-events-banner"
            className={
              'pointer-events-none absolute top-3 left-1/2 z-10 ' +
              '-translate-x-1/2 rounded-full bg-white/95 px-4 py-1.5 ' +
              'text-xs font-medium text-gray-700 shadow'
            }
          >
            🎉 На поверсі: {floorEvents.map((event) => event.title).join(', ')}
          </div>
        )}

        <div
          id="map-canvas"
          className="flex flex-1 items-stretch justify-stretch"
        >
          {mapQuery.isLoading && (
            <p className="m-auto text-sm text-gray-500">Завантажуємо…</p>
          )}
          {mapQuery.isError && (
            <p className="m-auto text-sm text-red-700">
              Не вдалося завантажити мапу.
            </p>
          )}
          {mapQuery.data && (
            <FloorMap
              data={mapQuery.data}
              onRoomClick={(room) => setSelectedRoomId(room.id)}
              selectedRoomId={selectedRoomId}
            />
          )}
        </div>
      </main>

      <RoomDetailsDrawer
        room={selectedRoom}
        floorId={mapQuery.data?.id ?? effectiveFloorId}
        floorNumber={mapQuery.data?.number ?? null}
        dormitoryName={mapQuery.data?.dormitory_name ?? null}
        onClose={() => setSelectedRoomId(null)}
      />
    </div>
  );
}
