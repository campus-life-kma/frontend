import { useEffect } from 'react';
import type { RoomOnMap } from '../types/locations';
import RoomDetailsPanel from './RoomDetailsPanel';

interface RoomDetailsModalProps {
  room: RoomOnMap | null;
  onClose: () => void;
}

export default function RoomDetailsModal({
  room,
  onClose,
}: RoomDetailsModalProps) {
  useEffect(() => {
    if (!room) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [room, onClose]);

  if (!room) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className={
        'fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4'
      }
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className={
          'relative max-h-[85vh] w-full max-w-md overflow-y-auto ' +
          'rounded-xl bg-white p-6 shadow-2xl'
        }
      >
        <button
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
        <RoomDetailsPanel room={room} />
      </div>
    </div>
  );
}
