import { useEffect, useState } from 'react';
import type { RoomOnMap } from '../types/locations';
import RoomDetailsPanel from './RoomDetailsPanel';
import RoomEditPanel from './RoomEditPanel';
import { useAuthStore } from '../store/authStore';

interface RoomDetailsDrawerProps {
  room: RoomOnMap | null;
  floorId?: number | null;
  floorNumber?: number | null;
  dormitoryName?: string | null;
  onClose: () => void;
}

export default function RoomDetailsDrawer({
  room,
  floorId,
  floorNumber,
  dormitoryName,
  onClose,
}: RoomDetailsDrawerProps) {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!room) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [room, onClose]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsEditing(false);
  }, [room?.id]);

  if (!room) return null;

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
        {isAdmin && !isEditing && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
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
        {isEditing ? (
          <RoomEditPanel
            room={room}
            floorId={floorId}
            onCancel={() => setIsEditing(false)}
          />
        ) : (
          <RoomDetailsPanel
            room={room}
            floorId={floorId}
            floorNumber={floorNumber}
            dormitoryName={dormitoryName}
          />
        )}
      </div>
    </div>
  );
}
