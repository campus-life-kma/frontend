import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { getFloorMapData, getFloors } from '../api/locations';
import type { RoomOnMap } from '../types/locations';
import AppHeader from '../components/AppHeader';
import FloorMap from '../components/FloorMap';
import FloorRail from '../components/FloorRail';
import RoomDetailsDrawer from '../components/RoomDetailsDrawer';

function toNumberOrNull(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function MapPage() {
  const user = useAuthStore((state) => state.user);
  const [searchParams, setSearchParams] = useSearchParams();

  const [pickedFloorId, setPickedFloorId] = useState<number | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [selectedInactiveRoomId, setSelectedInactiveRoomId] = useState<
    string | null
  >(null);
  const urlFloorId = toNumberOrNull(searchParams.get('floorId'));

  const floorsQuery = useQuery({
    queryKey: ['floors', user?.dormitory_id],
    queryFn: () => getFloors(user!.dormitory_id!),
    enabled: !!user?.dormitory_id,
  });

  const effectiveFloorId: number | null =
    pickedFloorId ??
    urlFloorId ??
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
  const selectedInactiveRoom = selectedInactiveRoomId
    ? { svg_element_id: selectedInactiveRoomId }
    : null;
  const isAdmin = user?.role === 'ADMIN';

  const handleFloorSelect = (floorId: number) => {
    setPickedFloorId(floorId);
    setSelectedRoomId(null);
    setSelectedInactiveRoomId(null);
    const next = new URLSearchParams(searchParams);
    next.set('floorId', String(floorId));
    setSearchParams(next, { replace: true });
  };

  const floorEvents = mapQuery.data?.active_floor_events ?? [];
  const feedPath = effectiveFloorId
    ? `/feed?mapFloorId=${effectiveFloorId}`
    : '/feed';
  const floorEventsFeedPath = effectiveFloorId
    ? `/feed?type=events&floor=${effectiveFloorId}&active=true&mapFloorId=${effectiveFloorId}`
    : '/feed?type=events&active=true';
  const mapPath = effectiveFloorId ? `/?floorId=${effectiveFloorId}` : '/';
  const statisticsPath = effectiveFloorId
    ? `/management?mapFloorId=${effectiveFloorId}`
    : '/management';

  return (
    <div id="map-page" className="flex h-screen flex-col bg-gray-50">
      <AppHeader
        active="map"
        mapPath={mapPath}
        feedPath={feedPath}
        statisticsPath={statisticsPath}
      />

      <main id="map-main" className="relative flex flex-1 overflow-hidden">
        {floorsQuery.data && (
          <FloorRail
            floors={floorsQuery.data}
            selectedFloorId={effectiveFloorId}
            onSelect={handleFloorSelect}
          />
        )}

        {floorEvents.length > 0 && (
          <Link
            to={floorEventsFeedPath}
            id="floor-events-banner"
            className={
              'absolute top-3 left-1/2 z-10 ' +
              '-translate-x-1/2 rounded-full bg-white/95 px-4 py-1.5 ' +
              'text-xs font-medium text-gray-700 shadow transition hover:bg-blue-50 hover:text-blue-700'
            }
          >
            На поверсі: {floorEvents.map((event) => event.title).join(', ')}
          </Link>
        )}

        {mapQuery.data?.notice && (
          <div
            className={
              'absolute bottom-6 left-1/2 z-10 w-max max-w-sm ' +
              '-translate-x-1/2 rounded-full border border-amber-200 bg-amber-50 px-5 py-2 ' +
              'text-center text-sm font-medium text-amber-800 shadow-lg'
            }
          >
            ⚠️ {mapQuery.data.notice}
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
              onRoomClick={(room) => {
                setSelectedInactiveRoomId(null);
                setSelectedRoomId(room.id);
              }}
              onInactiveRoomClick={(svgElementId) => {
                setSelectedRoomId(null);
                setSelectedInactiveRoomId(svgElementId);
              }}
              selectedRoomId={selectedRoomId}
              selectedInactiveRoomId={selectedInactiveRoomId}
              canActivateInactiveRooms={isAdmin}
            />
          )}
        </div>
      </main>

      <RoomDetailsDrawer
        room={selectedRoom}
        inactiveRoom={selectedInactiveRoom}
        floorId={mapQuery.data?.id ?? effectiveFloorId}
        floorNumber={mapQuery.data?.number ?? null}
        dormitoryName={mapQuery.data?.dormitory_name ?? null}
        onClose={() => {
          setSelectedRoomId(null);
          setSelectedInactiveRoomId(null);
        }}
        onRoomCreated={(room) => {
          setSelectedInactiveRoomId(null);
          setSelectedRoomId(room.id);
        }}
      />
    </div>
  );
}
