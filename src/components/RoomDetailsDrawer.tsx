import { useEffect, useState } from 'react';
import type { InactiveRoomOnMap, RoomOnMap } from '../types/locations';
import RoomDetailsPanel from './RoomDetailsPanel';
import RoomEditPanel from './RoomEditPanel';
import RoomCreatePanel from './RoomCreatePanel';
import { useAuthStore } from '../store/authStore';

/**
 * Властивості для компонента RoomDetailsDrawer.
 */
interface RoomDetailsDrawerProps {
  /** Об'єкт активної кімнати або null. */
  room: RoomOnMap | null;
  /** Об'єкт неактивної кімнати на карті. */
  inactiveRoom?: InactiveRoomOnMap | null;
  /** ID поверху. */
  floorId?: number | null;
  /** Номер поверху. */
  floorNumber?: number | null;
  /** Назва гуртожитку. */
  dormitoryName?: string | null;
  /** Зворотний виклик для закриття шторки (drawer). */
  onClose: () => void;
  /** Зворотний виклик після створення нової кімнати. */
  onRoomCreated?: (room: RoomOnMap) => void;
}

/**
 * Висувна нижня/бічна шторка для відображення деталей кімнати.
 * Використовується на мобільних пристроях чи вузьких екранах.
 * Обгортає панелі створення (`RoomCreatePanel`), редагування (`RoomEditPanel`)
 * та перегляду деталей кімнати (`RoomDetailsPanel`).
 */
export default function RoomDetailsDrawer({
  room,
  inactiveRoom,
  floorId,
  floorNumber,
  dormitoryName,
  onClose,
  onRoomCreated,
}: RoomDetailsDrawerProps) {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';
  const [editingRoomId, setEditingRoomId] = useState<number | null>(null);
  const hasInactiveRoom = Boolean(inactiveRoom);
  const isEditing = Boolean(room && editingRoomId === room.id);

  useEffect(() => {
    if (!room && !inactiveRoom) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [room, inactiveRoom, onClose]);

  if (!room && !inactiveRoom) return null;

  return (
    <div
      id="room-details-overlay"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className={
        'fixed inset-0 z-30 flex items-center justify-center bg-black/40 ' +
        'p-4 md:items-stretch md:justify-end md:p-0'
      }
    >
      <div
        id="room-details-drawer"
        onClick={(event) => event.stopPropagation()}
        className={
          'relative max-h-[85vh] w-full max-w-md overflow-y-auto rounded-xl ' +
          'bg-white p-6 shadow-2xl ' +
          'md:h-full md:max-h-none md:max-w-sm md:rounded-none md:rounded-l-xl ' +
          'md:shadow-[-8px_0_24px_rgba(0,0,0,0.15)]'
        }
      >
        {isAdmin && room && !isEditing && (
          <button
            type="button"
            onClick={() => setEditingRoomId(room.id)}
            className={
              'absolute top-3 right-12 flex h-8 items-center justify-center rounded-full ' +
              'px-3 text-sm font-medium text-gray-500 transition hover:bg-gray-100 hover:text-gray-900'
            }
          >
            ✏️ Редагувати
          </button>
        )}
        <button
          id="room-details-close"
          type="button"
          onClick={onClose}
          aria-label="Закрити"
          className={
            'absolute top-3 right-3 flex h-8 w-8 items-center justify-center ' +
            'rounded-full text-gray-400 transition hover:bg-gray-100 ' +
            'hover:text-gray-700'
          }
        >
          ×
        </button>
        {hasInactiveRoom && inactiveRoom && floorId ? (
          <RoomCreatePanel
            floorId={floorId}
            svgElementId={inactiveRoom.svg_element_id}
            onCancel={onClose}
            onCreated={(createdRoom) => {
              onRoomCreated?.(createdRoom);
              setEditingRoomId(null);
            }}
          />
        ) : isEditing && room ? (
          <RoomEditPanel
            room={room}
            floorId={floorId}
            onCancel={() => setEditingRoomId(null)}
          />
        ) : room ? (
          <RoomDetailsPanel
            room={room}
            floorId={floorId}
            floorNumber={floorNumber}
            dormitoryName={dormitoryName}
            onRoomDeleted={onClose}
          />
        ) : null}
      </div>
    </div>
  );
}
