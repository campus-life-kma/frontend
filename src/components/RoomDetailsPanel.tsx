import type { RoomOnMap } from '../types/locations';
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
  STORAGE: 'Склад',
};

export default function RoomDetailsPanel({
  room,
  floorId,
  floorNumber,
  dormitoryName,
}: RoomDetailsPanelProps) {
  if (!room) {
    return (
      <p className="text-sm text-gray-500">
        Натисніть на кімнату на мапі, щоб побачити деталі.
      </p>
    );
  }

  const typeLabel = ROOM_TYPE_LABEL[room.room_type] ?? room.room_type;
  const hasEvents = room.active_events.length > 0;

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
                      зайнято
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
