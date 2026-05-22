import type { RoomOnMap } from '../types/locations';

interface RoomDetailsPanelProps {
  room: RoomOnMap | null;
}

const ROOM_TYPE_LABEL: Record<string, string> = {
  LIVING: 'Житлова',
  COMMON_AREA: 'Спільний простір',
  KITCHEN: 'Кухня',
  LAUNDRY: 'Пральня',
  BATHROOM: 'Душова',
};

export default function RoomDetailsPanel({ room }: RoomDetailsPanelProps) {
  if (!room) {
    return (
      <p className="text-sm text-gray-500">
        Натисніть на кімнату на мапі, щоб побачити деталі.
      </p>
    );
  }

  const typeLabel = ROOM_TYPE_LABEL[room.room_type] ?? room.room_type;

  return (
    <div className="flex flex-col gap-4 text-sm">
      <header>
        <h2 className="text-lg font-semibold text-gray-900">{room.name}</h2>
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
              <li key={u.id} className="flex items-center gap-2">
                {u.photo ? (
                  <img
                    src={u.photo}
                    alt=""
                    className="h-6 w-6 rounded-full object-cover"
                  />
                ) : (
                  <span className="h-6 w-6 rounded-full bg-gray-200" />
                )}
                <span>{u.display_name}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {room.active_events.length > 0 && (
        <section>
          <h3 className="mb-2 font-medium text-gray-700">
            Активні події ({room.active_events.length})
          </h3>
          <ul className="flex flex-col gap-2">
            {room.active_events.map((event) => (
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

      {room.resources.length > 0 && (
        <section>
          <h3 className="mb-2 font-medium text-gray-700">
            Ресурси ({room.resources.length})
          </h3>
          <ul className="flex flex-col gap-1">
            {room.resources.map((resource) => (
              <li
                key={resource.id}
                className="flex items-center justify-between"
              >
                <span>{resource.name}</span>
                {resource.is_blocked && (
                  <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-700">
                    зайнято
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
