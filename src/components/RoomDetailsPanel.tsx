import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RoomOnMap } from '../types/locations';
import { useAuthStore } from '../store/authStore';
import { checkIn, getMyPresence, goHome } from '../api/presence';
import { blockRoom, unblockRoom } from '../api/rooms';
import UserAvatar from './UserAvatar';
import ResourceTypeIcon from './ResourceTypeIcon';
import { Link } from 'react-router-dom';

interface RoomDetailsPanelProps {
  room: RoomOnMap | null;
  floorId?: number | null;
  floorNumber?: number | null;
  dormitoryName?: string | null;
}

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
    const detail = (error.response?.data as { detail?: string } | undefined)
      ?.detail;
    if (detail) return detail;
  }
  return fallback;
}

export default function RoomDetailsPanel({
  room,
  floorId,
  floorNumber,
  dormitoryName,
}: RoomDetailsPanelProps) {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();

  const presenceQuery = useQuery({
    queryKey: ['presence-me'],
    queryFn: getMyPresence,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['floor-map'] });
    queryClient.invalidateQueries({ queryKey: ['presence-me'] });
  };

  const checkInMutation = useMutation({
    mutationFn: (roomId: number) => checkIn(roomId),
    onSuccess: refresh,
  });
  const goHomeMutation = useMutation({
    mutationFn: goHome,
    onSuccess: refresh,
  });
  const blockMutation = useMutation({
    mutationFn: (roomId: number) => blockRoom(roomId),
    onSuccess: refresh,
  });
  const unblockMutation = useMutation({
    mutationFn: (roomId: number) => unblockRoom(roomId),
    onSuccess: refresh,
  });

  if (!room) {
    return (
      <p className="text-sm text-gray-500">
        Натисніть на кімнату на мапі, щоб побачити деталі.
      </p>
    );
  }

  const typeLabel = ROOM_TYPE_LABEL[room.room_type] ?? room.room_type;
  const hasEvents = room.active_events.length > 0;
  const isAdmin = user?.role === 'ADMIN';

  const homeRoomId = user?.room_id ? Number(user.room_id) : null;
  const presence = presenceQuery.data ?? null;
  const isHome = homeRoomId !== null && room.id === homeRoomId;
  const isPresentHere = presence?.room_id === room.id;
  const isAway = presence !== null;

  const presenceBusy = checkInMutation.isPending || goHomeMutation.isPending;
  const blockBusy = blockMutation.isPending || unblockMutation.isPending;
  const actionError =
    checkInMutation.error ??
    goHomeMutation.error ??
    blockMutation.error ??
    unblockMutation.error;

  const goHomeButton = (
    <button
      id="room-go-home"
      type="button"
      onClick={() => goHomeMutation.mutate()}
      disabled={presenceBusy}
      className={
        'w-full rounded-md border border-gray-300 px-4 py-2 font-medium ' +
        'text-gray-700 transition hover:bg-gray-50 ' +
        'disabled:cursor-not-allowed disabled:opacity-60'
      }
    >
      {presenceBusy ? 'Зачекайте…' : 'Повернутися додому'}
    </button>
  );

  return (
    <div id={`room-details-${room.id}`} className="flex flex-col gap-4 text-sm">
      <header>
        <h2 className="text-lg font-semibold text-gray-900">
          {hasEvents && <span aria-hidden="true">🎉 </span>}
          {room.name}
        </h2>
        <p className="text-gray-500">
          {typeLabel} · до {room.max_person} осіб
          {room.is_blocked && (
            <span className="ml-2 rounded bg-red-100 px-2 py-0.5 text-xs text-red-700">
              заблоковано
            </span>
          )}
        </p>
      </header>

      <section>
        <h3 className="mb-2 font-medium text-gray-700">
          Зараз тут ({room.current_users.length})
        </h3>
        {room.current_users.length === 0 ? (
          <p className="text-gray-400">Порожньо</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {room.current_users.map((u) => (
              <li key={u.id} id={`room-user-${room.id}-${u.id}`}>
                <Link
                  to={`/profile/${u.id}`}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 transition hover:bg-gray-50"
                >
                  <UserAvatar name={u.display_name} photo={u.photo} size={28} />
                  <span>{u.display_name}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {hasEvents && (
        <section>
          <h3 className="mb-2 font-medium text-gray-700">
            Активні події ({room.active_events.length})
          </h3>
          <ul className="flex flex-col gap-2">
            {room.active_events.map((event) => (
              <li
                key={event.id}
                id={`room-event-${event.id}`}
                className="flex items-start gap-2 rounded bg-gray-50 p-2"
              >
                <UserAvatar
                  name={event.creator.display_name}
                  photo={event.creator.photo}
                  size={28}
                />
                <div className="min-w-0">
                  <Link
                    to={`/feed?eventId=${event.id}`}
                    className="font-medium hover:text-blue-700 hover:underline"
                  >
                    {event.title}
                  </Link>
                  <p className="text-xs text-gray-500">
                    <Link
                      to={`/profile/${event.creator.id}`}
                      className="hover:text-blue-700 hover:underline"
                    >
                      {event.creator.display_name}
                    </Link>{' '}
                    · {event.participants_count} учасник(ів)
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {room.resources.length > 0 && (
        <section>
          <h3 className="mb-2 font-medium text-gray-700">
            Ресурси ({room.resources.length})
          </h3>
          <ul className="flex flex-col gap-1">
            {room.resources.map((resource) => (
              <li key={resource.id} id={`room-resource-${resource.id}`}>
                <Link
                  to={`/resources/${resource.id}`}
                  state={{
                    resource,
                    room,
                    floorId,
                    floorNumber,
                    dormitoryName,
                  }}
                  className={
                    'flex items-center gap-2 rounded-md px-2 py-1.5 ' +
                    'transition hover:bg-gray-50'
                  }
                >
                  <ResourceTypeIcon resource={resource} size={18} />
                  <span className="flex-1">{resource.name}</span>
                  {resource.is_blocked && (
                    <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-700">
                      заблоковано
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="flex flex-col gap-2 border-t border-gray-100 pt-4">
        {isPresentHere ? (
          <>
            <button
              id="room-extend"
              type="button"
              onClick={() => checkInMutation.mutate(room.id)}
              disabled={presenceBusy || room.is_blocked}
              className={
                'w-full rounded-md bg-blue-600 px-4 py-2 font-medium ' +
                'text-white transition hover:bg-blue-700 ' +
                'disabled:cursor-not-allowed disabled:bg-blue-300'
              }
            >
              {checkInMutation.isPending ? 'Продовжуємо…' : 'Продовжити'}
            </button>
            {goHomeButton}
          </>
        ) : isHome ? (
          isAway && goHomeButton
        ) : (
          !room.is_blocked && (
            <button
              id="room-check-in"
              type="button"
              onClick={() => checkInMutation.mutate(room.id)}
              disabled={presenceBusy}
              className={
                'w-full rounded-md bg-blue-600 px-4 py-2 font-medium ' +
                'text-white transition hover:bg-blue-700 ' +
                'disabled:cursor-not-allowed disabled:bg-blue-300'
              }
            >
              {checkInMutation.isPending ? 'Відмічаємо…' : 'Відмітитися тут'}
            </button>
          )
        )}

        {isAdmin &&
          (room.is_blocked ? (
            <button
              id="room-unblock"
              type="button"
              onClick={() => unblockMutation.mutate(room.id)}
              disabled={blockBusy}
              className={
                'w-full rounded-md border border-gray-300 px-4 py-2 ' +
                'font-medium text-gray-700 transition hover:bg-gray-50 ' +
                'disabled:cursor-not-allowed disabled:opacity-60'
              }
            >
              {blockBusy ? 'Зачекайте…' : 'Розблокувати кімнату'}
            </button>
          ) : (
            <button
              id="room-block"
              type="button"
              onClick={() => blockMutation.mutate(room.id)}
              disabled={blockBusy}
              className={
                'w-full rounded-md border border-red-300 px-4 py-2 ' +
                'font-medium text-red-700 transition hover:bg-red-50 ' +
                'disabled:cursor-not-allowed disabled:opacity-60'
              }
            >
              {blockBusy ? 'Зачекайте…' : 'Заблокувати кімнату'}
            </button>
          ))}

        {actionError && (
          <p role="alert" className="text-xs text-red-700">
            {extractErrorMessage(actionError, 'Дію не вдалося виконати.')}
          </p>
        )}
      </footer>
    </div>
  );
}
