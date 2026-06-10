import { useMemo, useState } from 'react';
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import {
  completeSharingRequest,
  deleteEvent,
  deleteSharingRequest,
  getEvent,
  getFeed,
  getSharingRequest,
  joinEvent,
  leaveEvent,
  updateEvent,
} from '../api/social';
import {
  createAnnouncement,
  getActiveAnnouncements,
  getAnnouncementRecipients,
  markAnnouncementRead,
} from '../api/announcements';
import { getFloors, getRooms } from '../api/locations';
import UserAvatar from '../components/UserAvatar';
import AppHeader from '../components/AppHeader';
import ConfirmDialog from '../components/UI/ConfirmDialog';
import { useAuthStore } from '../store/authStore';
import type {
  Announcement,
  AnnouncementPayload,
  AnnouncementRecipient,
  AnnouncementTargetType,
} from '../types/announcements';
import type {
  FeedItem,
  SocialEvent,
  SocialSharingRequest,
} from '../types/social';
import type { FloorListItem, RoomListItem } from '../types/locations';

type FeedType = 'all' | 'events' | 'sharing';
type FeedOrdering = 'created_at' | 'start_time';
type PendingDelete =
  | { kind: 'event'; id: number; title: string }
  | { kind: 'sharing'; id: number; title: string };
type PendingComplete =
  | { kind: 'event'; id: number; title: string }
  | { kind: 'sharing'; id: number; title: string };

const ANNOUNCEMENT_ERROR_LABELS: Record<string, string> = {
  title: 'Заголовок',
  message: 'Текст',
  target_type: 'Аудиторія',
  target_floor: 'Поверх',
  target_room: 'Кімната',
  target_users: 'Користувачі',
  expires_at: 'Час завершення',
  is_pinned: 'Закріплення',
  detail: '',
  non_field_errors: 'Помилка',
};

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('uk-UA', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatParticipantLimit(event: SocialEvent): string {
  const count = event.participants?.length ?? event.participants_count ?? 0;
  return event.max_person > 0
    ? `${count} / ${event.max_person}`
    : `${count} · необмежено`;
}

function formatSocialStatus(status: string): string {
  const labels: Record<string, string> = {
    ACTIVE: 'Активний',
    COMPLETED: 'Виконано',
    DONE: 'Виконано',
    CANCELLED: 'Скасовано',
  };
  return labels[status] ?? status;
}

function formatAnnouncementTarget(announcement: Announcement): string {
  const labels: Record<string, string> = {
    GLOBAL: 'Для всього гуртожитку',
    FLOOR: 'Для вашого поверху',
    ROOM: 'Для вашої кімнати',
    SPECIFIC_USERS: 'Особисте оголошення',
  };

  return labels[announcement.target_type] ?? 'Оголошення для вас';
}

function formatEventLocation(
  event: SocialEvent,
  floors: FloorListItem[]
): string {
  if (event.room_name) {
    const floor = event.floor_id
      ? floors.find((item) => item.id === event.floor_id)
      : null;
    return floor
      ? `${event.room_name} · ${floor.number} поверх`
      : event.room_name;
  }
  if (event.custom_location) return event.custom_location;

  if (event.floor_id) {
    const floor = floors.find((item) => item.id === event.floor_id);
    return floor ? `Поверх ${floor.number}` : `Поверх #${event.floor_id}`;
  }

  return 'Локацію не вказано';
}

function toInputDate(value: string): string {
  return value ? value.slice(0, 10) : '';
}

function isEvent(item: FeedItem): item is SocialEvent {
  return item.type === 'event';
}

function isSharing(item: FeedItem): item is SocialSharingRequest {
  return item.type === 'sharing_request';
}

function isActiveEvent(event: SocialEvent): boolean {
  const now = new Date();
  return (
    event.status === 'ACTIVE' &&
    new Date(event.start_time) <= now &&
    new Date(event.end_time) > now
  );
}

function canCancelSocialItem(item: FeedItem): boolean {
  return item.status === 'ACTIVE';
}

function toApiFeedType(type: FeedType): 'all' | 'event' | 'sharing_request' {
  if (type === 'events') return 'event';
  if (type === 'sharing') return 'sharing_request';
  return 'all';
}

function normalizeError(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof error.response === 'object' &&
    error.response !== null &&
    'data' in error.response
  ) {
    const data = error.response.data;
    if (typeof data === 'object' && data !== null && 'detail' in data) {
      return String(data.detail);
    }
  }
  return 'Не вдалося виконати дію.';
}

function flattenErrorMessages(
  value: unknown,
  labels: Record<string, string> = {}
): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value))
    return value.flatMap((item) => flattenErrorMessages(item, labels));
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).flatMap(([key, nestedValue]) => {
      const messages = flattenErrorMessages(nestedValue, labels);
      const label = labels[key] ?? key;
      if (!label) return messages;
      return messages.map((message) => `${label}: ${message}`);
    });
  }
  return [];
}

function normalizeAnnouncementError(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof error.response === 'object' &&
    error.response !== null &&
    'data' in error.response
  ) {
    const messages = flattenErrorMessages(
      error.response.data,
      ANNOUNCEMENT_ERROR_LABELS
    );
    if (messages.length > 0) return messages.join(' ');
  }
  return 'Не вдалося створити оголошення. Перевірте поля і спробуйте ще раз.';
}

function readAcknowledgedTimedAnnouncements(storageKey: string | null) {
  if (!storageKey || typeof window === 'undefined') return new Set<number>();

  try {
    const stored = localStorage.getItem(storageKey);
    const ids = stored ? (JSON.parse(stored) as number[]) : [];
    return new Set(ids);
  } catch {
    return new Set<number>();
  }
}

function writeAcknowledgedTimedAnnouncements(
  storageKey: string | null,
  ids: Set<number>
) {
  if (!storageKey || typeof window === 'undefined') return;

  localStorage.setItem(storageKey, JSON.stringify([...ids]));
}

function canModerate(
  role: string | null | undefined,
  userFloorId: string | null | undefined,
  itemFloorId: number | null
): boolean {
  if (role === 'ADMIN') return true;
  if (role !== 'MODERATOR') return false;
  return Boolean(itemFloorId && String(itemFloorId) === String(userFloorId));
}

export default function SocialFeedPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [page, setPage] = useState(1);
  const [acknowledgedTimedState, setAcknowledgedTimedState] = useState<{
    key: string | null;
    ids: Set<number>;
  }>({ key: null, ids: new Set() });
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(
    null
  );
  const [pendingComplete, setPendingComplete] =
    useState<PendingComplete | null>(null);
  const [announcementModalOpen, setAnnouncementModalOpen] = useState(false);
  const [announcementError, setAnnouncementError] = useState<string | null>(
    null
  );

  const type = (searchParams.get('type') as FeedType | null) ?? 'all';
  const q = searchParams.get('q') ?? '';
  const floor = searchParams.get('floor') ?? 'all';
  const activeOnly = searchParams.get('active') === 'true';
  const startDate = searchParams.get('start') ?? '';
  const endDate = searchParams.get('end') ?? '';
  const ordering =
    (searchParams.get('ordering') as FeedOrdering | null) ?? 'created_at';
  const eventId = Number(searchParams.get('eventId'));
  const sharingId = Number(searchParams.get('sharingId'));
  const mapFloorId =
    searchParams.get('mapFloorId') ??
    (floor === 'mine' ? user?.floor_id : floor !== 'all' ? floor : null);
  const mapPath = mapFloorId ? `/?floorId=${mapFloorId}` : '/';
  const statisticsPath = mapFloorId
    ? `/statistics?mapFloorId=${mapFloorId}`
    : '/statistics';
  const acknowledgedTimedStorageKey = user?.id
    ? `campus-life:acknowledged-timed-announcements:${user.id}`
    : null;

  const acknowledgedTimed = useMemo(() => {
    if (acknowledgedTimedState.key === acknowledgedTimedStorageKey) {
      return acknowledgedTimedState.ids;
    }

    return readAcknowledgedTimedAnnouncements(acknowledgedTimedStorageKey);
  }, [acknowledgedTimedState, acknowledgedTimedStorageKey]);

  const feedFilters = useMemo(
    () => ({
      item_type: toApiFeedType(type),
      start_date: type === 'events' ? startDate : undefined,
      end_date: type === 'events' ? endDate : undefined,
      is_active: type === 'events' && activeOnly ? true : undefined,
      floor_id: floor === 'all' ? undefined : floor === 'mine' ? 'my' : floor,
      ordering: type === 'sharing' ? 'start_time' : ordering,
    }),
    [activeOnly, endDate, floor, ordering, startDate, type]
  );

  const feedQueries = useQueries({
    queries: Array.from({ length: page }, (_, index) => ({
      queryKey: ['feed', index + 1, feedFilters],
      queryFn: () => getFeed(index + 1, feedFilters),
    })),
  });

  const announcementsQuery = useQuery({
    queryKey: ['announcements-active'],
    queryFn: getActiveAnnouncements,
  });

  const floorsQuery = useQuery({
    queryKey: ['feed-floors', user?.dormitory_id],
    queryFn: () => getFloors(user!.dormitory_id!),
    enabled: !!user?.dormitory_id,
  });

  const canCreateAnnouncements =
    user?.role === 'ADMIN' || user?.role === 'MODERATOR';

  const roomsQuery = useQuery({
    queryKey: ['announcement-rooms'],
    queryFn: getRooms,
    enabled: canCreateAnnouncements,
  });

  const eventDetailQuery = useQuery({
    queryKey: ['event-detail', eventId],
    queryFn: () => getEvent(eventId),
    enabled: Number.isFinite(eventId) && eventId > 0,
  });

  const sharingDetailQuery = useQuery({
    queryKey: ['sharing-request-detail', sharingId],
    queryFn: () => getSharingRequest(sharingId),
    enabled: Number.isFinite(sharingId) && sharingId > 0,
  });

  const feedItems = useMemo(
    () => feedQueries.flatMap((query) => query.data?.results ?? []),
    [feedQueries]
  );

  const hasNext = feedQueries.at(-1)?.data?.has_next ?? false;
  const isLoading = feedQueries.some((query) => query.isLoading);

  const selectedSharing =
    sharingDetailQuery.data ??
    (Number.isFinite(sharingId)
      ? (feedItems.find((item) => isSharing(item) && item.id === sharingId) as
          | SocialSharingRequest
          | undefined)
      : undefined);

  const selectedEvent =
    eventDetailQuery.data ??
    (Number.isFinite(eventId)
      ? (feedItems.find((item) => isEvent(item) && item.id === eventId) as
          | SocialEvent
          | undefined)
      : undefined);

  const visibleItems = useMemo(() => {
    const lowerQ = q.trim().toLowerCase();
    const now = new Date();
    return feedItems.filter((item) => {
      if (lowerQ && !item.title.toLowerCase().includes(lowerQ)) return false;
      if (type !== 'events' || !isEvent(item)) return true;
      if (activeOnly) {
        const start = new Date(item.start_time);
        const end = new Date(item.end_time);
        if (!(start <= now && end >= now)) return false;
      }
      if (startDate && toInputDate(item.start_time) < startDate) return false;
      if (endDate && toInputDate(item.start_time) > endDate) return false;
      return true;
    });
  }, [activeOnly, endDate, feedItems, q, startDate, type]);

  const readMutation = useMutation({
    mutationFn: markAnnouncementRead,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['announcements-active'] }),
  });

  const createAnnouncementMutation = useMutation({
    mutationFn: createAnnouncement,
    onSuccess: async () => {
      setAnnouncementModalOpen(false);
      setAnnouncementError(null);
      await queryClient.invalidateQueries({
        queryKey: ['announcements-active'],
      });
    },
    onError: (error) => setAnnouncementError(normalizeAnnouncementError(error)),
  });

  const joinMutation = useMutation({
    mutationFn: joinEvent,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['feed'] });
      await queryClient.invalidateQueries({ queryKey: ['event-detail'] });
    },
    onError: (error) => setActionError(normalizeError(error)),
  });

  const leaveMutation = useMutation({
    mutationFn: leaveEvent,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['feed'] });
      await queryClient.invalidateQueries({ queryKey: ['event-detail'] });
    },
    onError: (error) => setActionError(normalizeError(error)),
  });

  const deleteEventMutation = useMutation({
    mutationFn: deleteEvent,
    onSuccess: async () => {
      setPendingDelete(null);
      closeModal();
      await queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
    onError: (error) => setActionError(normalizeError(error)),
  });

  const deleteSharingMutation = useMutation({
    mutationFn: deleteSharingRequest,
    onSuccess: async () => {
      setPendingDelete(null);
      closeModal();
      await queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
    onError: (error) => setActionError(normalizeError(error)),
  });

  const completeSharingMutation = useMutation({
    mutationFn: completeSharingRequest,
    onSuccess: async () => {
      setPendingComplete(null);
      closeModal();
      await queryClient.invalidateQueries({ queryKey: ['feed'] });
      await queryClient.invalidateQueries({
        queryKey: ['sharing-request-detail'],
      });
    },
    onError: (error) => setActionError(normalizeError(error)),
  });

  const completeEventMutation = useMutation({
    mutationFn: (eventIdToComplete: number) =>
      updateEvent(eventIdToComplete, { end_time: new Date().toISOString() }),
    onSuccess: async () => {
      setPendingComplete(null);
      closeModal();
      await queryClient.invalidateQueries({ queryKey: ['feed'] });
      await queryClient.invalidateQueries({ queryKey: ['event-detail'] });
    },
    onError: (error) => setActionError(normalizeError(error)),
  });

  function updateParam(key: string, value: string | null) {
    const next = new URLSearchParams(searchParams);
    if (!value || value === 'all') next.delete(key);
    else next.set(key, value);
    if (key === 'type' && value !== 'events') {
      next.delete('active');
      next.delete('start');
      next.delete('end');
    }
    setPage(1);
    setSearchParams(next);
  }

  function openItem(item: FeedItem) {
    const next = new URLSearchParams(searchParams);
    next.delete('eventId');
    next.delete('sharingId');
    next.set(isEvent(item) ? 'eventId' : 'sharingId', String(item.id));
    setSearchParams(next);
    setActionError(null);
  }

  function closeModal() {
    const next = new URLSearchParams(searchParams);
    next.delete('eventId');
    next.delete('sharingId');
    setSearchParams(next, { replace: true });
    setActionError(null);
  }

  function acknowledgeTimedAnnouncement(announcementId: number) {
    const next = new Set(acknowledgedTimed).add(announcementId);
    try {
      writeAcknowledgedTimedAnnouncements(acknowledgedTimedStorageKey, next);
    } catch {
      return;
    }
    setAcknowledgedTimedState({ key: acknowledgedTimedStorageKey, ids: next });
    readMutation.mutate(announcementId);
  }

  const activeAnnouncements = announcementsQuery.data ?? [];
  const pendingDeleteLabel =
    pendingDelete?.kind === 'event' ? 'подію' : 'запит на шеринг';
  const isDeleting =
    deleteEventMutation.isPending || deleteSharingMutation.isPending;
  const pendingCompleteLabel =
    pendingComplete?.kind === 'event' ? 'івент' : 'запит на шеринг';
  const isCompleting =
    completeEventMutation.isPending || completeSharingMutation.isPending;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <AppHeader
        active="feed"
        mapPath={mapPath}
        statisticsPath={statisticsPath}
      />

      <main className="mx-auto flex max-w-7xl flex-col gap-5 px-6 py-6">
        <section className="space-y-3">
          {canCreateAnnouncements && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setAnnouncementError(null);
                  setAnnouncementModalOpen(true);
                }}
                className={
                  'rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold ' +
                  'text-white shadow-sm hover:bg-sky-700'
                }
              >
                + Оголошення
              </button>
            </div>
          )}
          {activeAnnouncements.map((announcement) => (
            <AnnouncementBanner
              key={announcement.id}
              announcement={announcement}
              onRead={() => readMutation.mutate(announcement.id)}
              onAcknowledgeTimed={() =>
                acknowledgeTimedAnnouncement(announcement.id)
              }
              showAction={
                !announcement.expires_at ||
                !acknowledgedTimed.has(announcement.id)
              }
            />
          ))}
        </section>

        <ControlBar
          type={type}
          q={q}
          floor={floor}
          activeOnly={activeOnly}
          startDate={startDate}
          endDate={endDate}
          ordering={ordering}
          floors={floorsQuery.data ?? []}
          userFloorId={user?.floor_id ?? null}
          onChange={updateParam}
        />

        <section>
          {isLoading && (
            <p className="py-12 text-center text-sm text-gray-500">
              Завантажуємо стрічку…
            </p>
          )}
          {!isLoading && visibleItems.length === 0 && (
            <div className="rounded-lg border border-gray-200 bg-white py-12 text-center text-sm text-gray-500">
              Нічого не знайдено за поточними фільтрами.
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleItems.map((item) => (
              <FeedCard
                key={`${item.type}-${item.id}`}
                item={item}
                onOpen={() => openItem(item)}
              />
            ))}
          </div>

          {hasNext && (
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={() => setPage((current) => current + 1)}
                className={
                  'rounded-md border border-gray-200 bg-white px-4 py-2 ' +
                  'text-sm font-medium text-gray-700 hover:bg-gray-50'
                }
              >
                Завантажити ще
              </button>
            </div>
          )}
        </section>
      </main>

      {(selectedEvent ||
        selectedSharing ||
        eventDetailQuery.isLoading ||
        sharingDetailQuery.isLoading) && (
        <DetailsModal
          event={selectedEvent}
          sharing={selectedSharing}
          loading={eventDetailQuery.isLoading || sharingDetailQuery.isLoading}
          actionError={actionError}
          floors={floorsQuery.data ?? []}
          currentUserId={user?.id ?? null}
          canModerateItem={(item) =>
            canModerate(user?.role, user?.floor_id, item.floor_id)
          }
          onClose={closeModal}
          onJoin={(id) => joinMutation.mutate(id)}
          onLeave={(id) => leaveMutation.mutate(id)}
          onDeleteEvent={(item) => setPendingDelete(item)}
          onDeleteSharing={(item) => setPendingDelete(item)}
          onCompleteEvent={(item) => setPendingComplete(item)}
          onCompleteSharing={(item) => setPendingComplete(item)}
        />
      )}

      {announcementModalOpen && user && (
        <AnnouncementCreateModal
          currentRole={user.role}
          userFloorId={user.floor_id}
          floors={floorsQuery.data ?? []}
          rooms={roomsQuery.data ?? []}
          error={announcementError}
          isPending={createAnnouncementMutation.isPending}
          onClose={() => {
            setAnnouncementModalOpen(false);
            setAnnouncementError(null);
          }}
          onSubmit={(payload) => createAnnouncementMutation.mutate(payload)}
        />
      )}

      {pendingDelete && (
        <ConfirmDialog
          variant="danger"
          title={`Скасувати ${pendingDeleteLabel}?`}
          description={`«${pendingDelete.title}» буде скасовано і прибрано з активної стрічки.`}
          cancelLabel="Залишити"
          confirmLabel={isDeleting ? 'Скасовуємо…' : 'Скасувати'}
          isPending={isDeleting}
          onClose={() => setPendingDelete(null)}
          onConfirm={() => {
            if (pendingDelete.kind === 'event') {
              deleteEventMutation.mutate(pendingDelete.id);
            } else {
              deleteSharingMutation.mutate(pendingDelete.id);
            }
          }}
        />
      )}

      {pendingComplete && (
        <ConfirmDialog
          variant="info"
          title={`Позначити ${pendingCompleteLabel} виконаним?`}
          description={
            pendingComplete.kind === 'event'
              ? `Івент «${pendingComplete.title}» буде завершено зараз і зникне з актуальної стрічки.`
              : `Запит «${pendingComplete.title}» отримає статус «Виконано» і зникне з активної стрічки.`
          }
          cancelLabel="Не зараз"
          confirmLabel={isCompleting ? 'Оновлюємо…' : 'Позначити виконаним'}
          isPending={isCompleting}
          onClose={() => setPendingComplete(null)}
          onConfirm={() => {
            if (pendingComplete.kind === 'event') {
              completeEventMutation.mutate(pendingComplete.id);
            } else {
              completeSharingMutation.mutate(pendingComplete.id);
            }
          }}
        />
      )}
    </div>
  );
}

function AnnouncementBanner({
  announcement,
  onRead,
  onAcknowledgeTimed,
  showAction,
}: {
  announcement: Announcement;
  onRead: () => void;
  onAcknowledgeTimed: () => void;
  showAction: boolean;
}) {
  const expires = announcement.expires_at
    ? new Date(announcement.expires_at)
    : null;
  return (
    <article className="rounded-lg border border-blue-200 bg-blue-50 p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-wide text-blue-700 uppercase">
            Оголошення · {formatAnnouncementTarget(announcement)}
          </p>
          <h2 className="mt-1 text-base font-semibold text-blue-950">
            {announcement.title}
          </h2>
          <p className="mt-1 text-sm text-blue-900">{announcement.message}</p>
          {expires && (
            <p className="mt-2 text-xs text-blue-700">
              Актуально до {formatDateTime(announcement.expires_at!)}
            </p>
          )}
        </div>
        {showAction && (
          <button
            type="button"
            onClick={expires ? onAcknowledgeTimed : onRead}
            className={
              'shrink-0 rounded-md border border-blue-300 bg-white px-3 py-1.5 ' +
              'text-sm font-medium text-blue-700 hover:bg-blue-100'
            }
          >
            Зрозуміло
          </button>
        )}
      </div>
    </article>
  );
}

function AnnouncementCreateModal({
  currentRole,
  userFloorId,
  floors,
  rooms,
  error,
  isPending,
  onClose,
  onSubmit,
}: {
  currentRole: string | null;
  userFloorId: string | null;
  floors: FloorListItem[];
  rooms: RoomListItem[];
  error: string | null;
  isPending: boolean;
  onClose: () => void;
  onSubmit: (payload: AnnouncementPayload) => void;
}) {
  const isAdmin = currentRole === 'ADMIN';
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetType, setTargetType] = useState<AnnouncementTargetType>(
    isAdmin ? 'GLOBAL' : 'FLOOR'
  );
  const [targetFloor, setTargetFloor] = useState(userFloorId ?? '');
  const [targetRoom, setTargetRoom] = useState('');
  const [selectedRecipients, setSelectedRecipients] = useState<
    AnnouncementRecipient[]
  >([]);
  const [recipientSearch, setRecipientSearch] = useState('');
  const [recipientOrdering, setRecipientOrdering] = useState('display_name');
  const [expiresAt, setExpiresAt] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const floorById = useMemo(
    () => new Map(floors.map((floor) => [floor.id, floor])),
    [floors]
  );
  const roomOptions = useMemo(() => {
    const availableFloorIds = new Set(floors.map((floor) => floor.id));
    return rooms
      .filter(
        (room) =>
          availableFloorIds.size === 0 || availableFloorIds.has(room.floor)
      )
      .sort((firstRoom, secondRoom) => {
        const firstFloor = floorById.get(firstRoom.floor)?.number ?? 0;
        const secondFloor = floorById.get(secondRoom.floor)?.number ?? 0;
        if (firstFloor !== secondFloor) return firstFloor - secondFloor;
        return firstRoom.name.localeCompare(secondRoom.name, 'uk', {
          numeric: true,
          sensitivity: 'base',
        });
      });
  }, [floorById, floors, rooms]);
  const selectedRecipientIds = useMemo(
    () => new Set(selectedRecipients.map((recipient) => recipient.id)),
    [selectedRecipients]
  );
  const recipientsQuery = useQuery({
    queryKey: [
      'announcement-recipients',
      recipientSearch,
      recipientOrdering,
      targetType,
    ],
    queryFn: () =>
      getAnnouncementRecipients({
        q: recipientSearch,
        ordering: recipientOrdering,
      }),
    enabled: targetType === 'SPECIFIC_USERS',
  });

  function toggleRecipient(recipient: AnnouncementRecipient) {
    setSelectedRecipients((current) => {
      if (current.some((item) => item.id === recipient.id)) {
        return current.filter((item) => item.id !== recipient.id);
      }
      return [...current, recipient];
    });
  }

  function submit() {
    setLocalError(null);
    const cleanTitle = title.trim();
    const cleanMessage = message.trim();

    if (!cleanTitle || !cleanMessage) {
      setLocalError('Заповніть заголовок і текст оголошення.');
      return;
    }

    if (targetType === 'FLOOR' && !targetFloor) {
      setLocalError('Оберіть поверх для оголошення.');
      return;
    }

    if (targetType === 'ROOM' && !targetRoom) {
      setLocalError('Оберіть кімнату для оголошення.');
      return;
    }

    if (targetType === 'SPECIFIC_USERS' && selectedRecipients.length === 0) {
      setLocalError('Оберіть хоча б одного адресата оголошення.');
      return;
    }

    if (expiresAt && new Date(expiresAt) <= new Date()) {
      setLocalError('Час завершення оголошення має бути в майбутньому.');
      return;
    }

    onSubmit({
      title: cleanTitle,
      message: cleanMessage,
      target_type: targetType,
      target_floor: targetType === 'FLOOR' ? Number(targetFloor) : null,
      target_room: targetType === 'ROOM' ? Number(targetRoom) : null,
      target_users:
        targetType === 'SPECIFIC_USERS'
          ? selectedRecipients.map((recipient) => recipient.id)
          : [],
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      is_pinned: isPinned,
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        className={
          'flex max-h-[calc(100dvh-1rem)] w-full max-w-2xl flex-col ' +
          'rounded-lg bg-white shadow-2xl sm:max-h-[92dvh]'
        }
        onClick={(event) => event.stopPropagation()}
      >
        <div className="shrink-0 border-b border-gray-100 p-4 pb-3 sm:p-6 sm:pb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="text-xs font-semibold tracking-wide text-sky-700 uppercase">
                Оголошення
              </span>
              <h2 className="mt-1 text-lg font-semibold text-gray-950 sm:text-xl">
                Створити оголошення
              </h2>
            </div>
            <button
              className="rounded-full px-2 text-2xl text-gray-400 hover:bg-gray-100"
              onClick={onClose}
              type="button"
            >
              ×
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
          <label className="block text-sm font-medium text-gray-700">
            Заголовок
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-sm font-medium text-gray-700">
            Текст оголошення
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={4}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-gray-700">
              Аудиторія
              <select
                value={targetType}
                onChange={(event) => {
                  const value = event.target.value as AnnouncementTargetType;
                  setTargetType(value);
                  setTargetFloor(value === 'FLOOR' ? (userFloorId ?? '') : '');
                  setTargetRoom('');
                  setSelectedRecipients([]);
                }}
                className="mt-1 block h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
              >
                {isAdmin && <option value="GLOBAL">Весь гуртожиток</option>}
                <option value="FLOOR">Поверх</option>
                {isAdmin && <option value="ROOM">Кімната</option>}
                <option value="SPECIFIC_USERS">Конкретні користувачі</option>
              </select>
            </label>

            <label className="block text-sm font-medium text-gray-700">
              Діє до
              <input
                type="datetime-local"
                value={expiresAt}
                onChange={(event) => setExpiresAt(event.target.value)}
                className="mt-1 block h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
              />
            </label>
          </div>

          {targetType === 'FLOOR' && (
            <label className="block text-sm font-medium text-gray-700">
              Поверх
              <select
                value={targetFloor}
                disabled={!isAdmin}
                onChange={(event) => setTargetFloor(event.target.value)}
                className="mt-1 block h-10 w-full rounded-md border border-gray-300 px-3 text-sm disabled:bg-gray-50"
              >
                <option value="">Оберіть поверх</option>
                {floors.map((floor) => (
                  <option key={floor.id} value={floor.id}>
                    Поверх {floor.number}
                  </option>
                ))}
              </select>
            </label>
          )}

          {targetType === 'ROOM' && (
            <label className="block text-sm font-medium text-gray-700">
              Кімната
              <select
                value={targetRoom}
                onChange={(event) => setTargetRoom(event.target.value)}
                className="mt-1 block h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
              >
                <option value="">Оберіть кімнату</option>
                {roomOptions.map((room) => {
                  const floor = floorById.get(room.floor);
                  return (
                    <option key={room.id} value={room.id}>
                      {room.name}
                      {floor ? ` · ${floor.number} поверх` : ''}
                    </option>
                  );
                })}
              </select>
            </label>
          )}

          {targetType === 'SPECIFIC_USERS' && (
            <div className="flex min-h-[420px] flex-col gap-3 rounded-lg border border-gray-200 p-3 sm:min-h-[460px]">
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <label className="block text-sm font-medium text-gray-700">
                  Пошук адресата
                  <input
                    value={recipientSearch}
                    onChange={(event) => setRecipientSearch(event.target.value)}
                    placeholder="Ім'я, пошта, кімната, факультет..."
                    className="mt-1 block h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
                  />
                </label>
                <label className="block text-sm font-medium text-gray-700">
                  Сортування
                  <select
                    value={recipientOrdering}
                    onChange={(event) =>
                      setRecipientOrdering(event.target.value)
                    }
                    className="mt-1 block h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
                  >
                    <option value="display_name">За ім'ям</option>
                    <option value="-display_name">За ім'ям спадно</option>
                    <option value="email">За поштою</option>
                    <option value="-email">За поштою спадно</option>
                    <option value="role">За роллю</option>
                    <option value="floor,room,display_name">За поверхом</option>
                    <option value="room,display_name">За кімнатою</option>
                    <option value="faculty,major,display_name">
                      За факультетом
                    </option>
                    <option value="major,display_name">За спеціальністю</option>
                    <option value="year,display_name">За курсом</option>
                    <option value="id">За ID</option>
                  </select>
                </label>
              </div>

              <div className="max-h-24 min-h-11 overflow-y-auto rounded-md bg-gray-50 px-2 py-2">
                {selectedRecipients.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedRecipients.map((recipient) => (
                      <button
                        key={recipient.id}
                        type="button"
                        onClick={() => toggleRecipient(recipient)}
                        className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700 hover:bg-sky-100"
                      >
                        {recipient.display_name} ×
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="px-1 py-1 text-xs text-gray-500">
                    Обрані адресати з'являться тут.
                  </p>
                )}
              </div>

              <div className="h-64 overflow-y-auto rounded-md border border-gray-100 bg-gray-50 sm:h-72">
                {recipientsQuery.isLoading && (
                  <p className="px-3 py-4 text-sm text-gray-500">
                    Завантажуємо адресатів...
                  </p>
                )}
                {!recipientsQuery.isLoading &&
                  (recipientsQuery.data?.length ?? 0) === 0 && (
                    <p className="px-3 py-4 text-sm text-gray-500">
                      Адресатів не знайдено.
                    </p>
                  )}
                {recipientsQuery.data?.map((recipient) => (
                  <label
                    key={recipient.id}
                    className={
                      'flex cursor-pointer items-start gap-3 border-b ' +
                      'border-gray-100 bg-white px-3 py-2 last:border-b-0 ' +
                      'hover:bg-sky-50'
                    }
                  >
                    <input
                      type="checkbox"
                      checked={selectedRecipientIds.has(recipient.id)}
                      onChange={() => toggleRecipient(recipient)}
                      className="mt-1 h-4 w-4 accent-sky-600"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-gray-800">
                        {recipient.display_name}
                      </span>
                      <span className="block truncate text-xs text-gray-500">
                        {recipient.email}
                      </span>
                      <span className="block text-xs text-gray-500">
                        {[
                          recipient.room_name
                            ? `кімната ${recipient.room_name}`
                            : null,
                          recipient.floor_number
                            ? `${recipient.floor_number} поверх`
                            : null,
                          recipient.major_name,
                          recipient.faculty_name,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              checked={isPinned}
              onChange={(event) => setIsPinned(event.target.checked)}
              className="h-4 w-4 accent-sky-600"
            />
            Закріпити зверху
          </label>

          {(localError || error) && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {localError || error}
            </p>
          )}
        </div>

        <div
          className={
            'flex shrink-0 flex-col-reverse gap-2 border-t border-gray-100 ' +
            'p-4 sm:flex-row sm:justify-end sm:p-6 sm:pt-4'
          }
        >
          <button
            type="button"
            onClick={onClose}
            className={
              'rounded-md border border-gray-200 px-4 py-2 text-sm ' +
              'font-medium text-gray-700 hover:bg-gray-50'
            }
          >
            Скасувати
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={isPending}
            className={
              'rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold ' +
              'text-white hover:bg-sky-700 disabled:bg-gray-300'
            }
          >
            {isPending ? 'Створюємо…' : 'Створити'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ControlBar({
  type,
  q,
  floor,
  activeOnly,
  startDate,
  endDate,
  ordering,
  floors,
  userFloorId,
  onChange,
}: {
  type: FeedType;
  q: string;
  floor: string;
  activeOnly: boolean;
  startDate: string;
  endDate: string;
  ordering: FeedOrdering;
  floors: { id: number; number: number }[];
  userFloorId: string | null;
  onChange: (key: string, value: string | null) => void;
}) {
  const [eventFiltersOpen, setEventFiltersOpen] = useState(false);
  const hasEventFilters = Boolean(
    floor !== 'all' || startDate || endDate || activeOnly
  );

  return (
    <section className="sticky top-0 z-20 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
      <div
        className={
          'grid gap-3 lg:grid-cols-[1fr_auto_auto_auto] lg:items-center'
        }
      >
        <input
          value={q}
          onChange={(event) => onChange('q', event.target.value)}
          placeholder="Пошук за назвою"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        />

        <div className="flex rounded-md border border-gray-200 bg-gray-50 p-1 text-sm">
          {[
            ['all', 'Всі'],
            ['events', 'Івенти'],
            ['sharing', 'Шеринг'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                onChange('type', value);
              }}
              className={
                'rounded px-3 py-1.5 font-medium ' +
                (type === value
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-gray-600')
              }
            >
              {label}
            </button>
          ))}
        </div>

        <div className="relative min-h-10">
          <button
            type="button"
            onClick={() => setEventFiltersOpen((open) => !open)}
            className={
              'flex h-10 w-full items-center justify-center rounded-md ' +
              'border border-gray-200 px-3 text-sm font-medium ' +
              (eventFiltersOpen || hasEventFilters
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-700 hover:bg-gray-50')
            }
          >
            Фільтри{hasEventFilters ? ' •' : ''}
          </button>

          {eventFiltersOpen && (
            <div
              className={
                'mt-2 rounded-lg border border-gray-200 bg-white p-4 ' +
                'shadow-xl sm:absolute sm:top-full sm:right-0 sm:z-30 ' +
                (type === 'events' ? 'sm:w-[min(540px,90vw)]' : 'sm:w-56')
              }
            >
              <div
                className={
                  'grid gap-3 ' + (type === 'events' ? 'sm:grid-cols-2' : '')
                }
              >
                <label className="grid gap-1 text-xs font-medium text-gray-500">
                  Поверх
                  <select
                    value={floor}
                    onChange={(event) => onChange('floor', event.target.value)}
                    className={
                      'h-10 rounded-md border border-gray-300 px-3 text-sm ' +
                      'font-normal text-gray-800'
                    }
                  >
                    <option value="all">Всі поверхи</option>
                    {userFloorId && <option value="mine">Мій поверх</option>}
                    {floors.map((item) => (
                      <option key={item.id} value={item.id}>
                        Поверх {item.number}
                      </option>
                    ))}
                  </select>
                </label>

                {type === 'events' && (
                  <>
                    <label className="grid gap-1 text-xs font-medium text-gray-500">
                      Сортування
                      <select
                        value={ordering}
                        onChange={(event) =>
                          onChange('ordering', event.target.value)
                        }
                        className={
                          'h-10 rounded-md border border-gray-300 px-3 ' +
                          'text-sm font-normal text-gray-800'
                        }
                      >
                        <option value="created_at">За датою створення</option>
                        <option value="start_time">За часом початку</option>
                      </select>
                    </label>

                    <label className="grid gap-1 text-xs font-medium text-gray-500">
                      Стан
                      <button
                        type="button"
                        onClick={() =>
                          onChange('active', activeOnly ? null : 'true')
                        }
                        className={
                          'flex h-10 items-center gap-2 rounded-md border ' +
                          'border-gray-200 px-3 text-left text-sm ' +
                          'font-normal text-gray-800'
                        }
                      >
                        <input
                          type="checkbox"
                          checked={activeOnly}
                          readOnly
                          className="h-4 w-4 accent-blue-600"
                        />
                        Активні зараз
                      </button>
                    </label>

                    <label className="grid gap-1 text-xs font-medium text-gray-500">
                      Початок
                      <input
                        type="date"
                        value={startDate}
                        onChange={(event) =>
                          onChange('start', event.target.value)
                        }
                        className="h-10 rounded-md border border-gray-300 px-2 text-sm"
                      />
                    </label>

                    <label className="grid gap-1 text-xs font-medium text-gray-500">
                      Кінець
                      <input
                        type="date"
                        value={endDate}
                        onChange={(event) =>
                          onChange('end', event.target.value)
                        }
                        className="h-10 rounded-md border border-gray-300 px-2 text-sm"
                      />
                    </label>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <Link
          to="/feed/create"
          className={
            'rounded-md bg-blue-600 px-4 py-2 text-center text-sm ' +
            'font-semibold whitespace-nowrap text-white hover:bg-blue-700'
          }
        >
          + Створити
        </Link>
      </div>
    </section>
  );
}

function FeedCard({ item, onOpen }: { item: FeedItem; onOpen: () => void }) {
  const badge =
    item.type === 'event'
      ? 'bg-violet-100 text-violet-800'
      : 'bg-emerald-100 text-emerald-800';
  return (
    <button
      type="button"
      onClick={onOpen}
      className={
        'rounded-lg border border-gray-200 bg-white p-4 text-left shadow-sm ' +
        'transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md'
      }
    >
      <span
        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${badge}`}
      >
        {item.type === 'event' ? 'Івент' : 'Шеринг'}
      </span>
      <h3 className="mt-3 line-clamp-2 text-base font-semibold text-gray-950">
        {item.title}
      </h3>
      <div className="mt-4 flex items-center gap-2">
        <UserAvatar
          name={item.creator.display_name}
          photo={item.creator.photo}
          size={30}
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-gray-700">
            {item.creator.display_name}
          </p>
          <p className="text-xs text-gray-500">
            {isEvent(item)
              ? `${formatDateTime(item.start_time)} · ${formatSocialStatus(item.status)}`
              : formatSocialStatus(item.status)}
          </p>
        </div>
      </div>
    </button>
  );
}

function DetailsModal({
  event,
  sharing,
  loading,
  actionError,
  floors,
  currentUserId,
  canModerateItem,
  onClose,
  onJoin,
  onLeave,
  onDeleteEvent,
  onDeleteSharing,
  onCompleteEvent,
  onCompleteSharing,
}: {
  event?: SocialEvent;
  sharing?: SocialSharingRequest;
  loading: boolean;
  actionError: string | null;
  floors: FloorListItem[];
  currentUserId: string | null;
  canModerateItem: (item: FeedItem) => boolean;
  onClose: () => void;
  onJoin: (id: number) => void;
  onLeave: (id: number) => void;
  onDeleteEvent: (item: PendingDelete) => void;
  onDeleteSharing: (item: PendingDelete) => void;
  onCompleteEvent: (item: PendingComplete) => void;
  onCompleteSharing: (item: PendingComplete) => void;
}) {
  const item = event ?? sharing;
  const isOwner = item?.creator.id === currentUserId;
  const canDelete = item
    ? (isOwner || canModerateItem(item)) && canCancelSocialItem(item)
    : false;
  const canEdit = item ? isOwner && canCancelSocialItem(item) : false;
  const canCompleteSharing =
    Boolean(sharing) && sharing?.status === 'ACTIVE' && isOwner;
  const canCompleteEvent = event ? isOwner && isActiveEvent(event) : false;
  const joined =
    event?.participants?.some(
      (participant) => participant.id === currentUserId
    ) ?? false;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-2xl flex-col rounded-lg bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 p-6 pb-4">
          <div>
            <span className="text-xs font-semibold tracking-wide text-blue-700 uppercase">
              {event ? 'Івент' : 'Шеринг'}
            </span>
            <h2 className="mt-1 text-xl font-semibold text-gray-950">
              {loading ? 'Завантаження…' : item?.title}
            </h2>
          </div>
          <button
            className="rounded-full px-2 text-2xl text-gray-400 hover:bg-gray-100"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>

        {item && (
          <div className="min-h-0 overflow-y-auto px-6 py-5">
            <div className="space-y-5">
              <div className="flex items-center gap-3 rounded-md bg-gray-50 p-3">
                <UserAvatar
                  name={item.creator.display_name}
                  photo={item.creator.photo}
                  size={38}
                />
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    {item.creator.display_name}
                  </p>
                  <Link
                    to={`/profile/${item.creator.id}`}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Профіль автора
                  </Link>
                </div>
              </div>

              {event && (
                <>
                  <p className="text-sm leading-6 text-gray-700">
                    {event.description}
                  </p>
                  <dl className="grid gap-3 rounded-md border border-gray-200 p-3 text-sm sm:grid-cols-2">
                    <InfoItem
                      label="Статус"
                      value={formatSocialStatus(event.status)}
                    />
                    <InfoItem
                      label="Початок"
                      value={formatDateTime(event.start_time)}
                    />
                    <InfoItem
                      label="Кінець"
                      value={formatDateTime(event.end_time)}
                    />
                    <InfoItem
                      label="Локація"
                      value={formatEventLocation(event, floors)}
                    />
                    <InfoItem
                      label="Учасники"
                      value={formatParticipantLimit(event)}
                    />
                  </dl>
                  {event.participants && (
                    <div>
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <h3 className="text-sm font-semibold text-gray-700">
                          Учасники
                        </h3>
                        <span className="text-xs font-medium text-gray-400">
                          {event.participants.length}
                        </span>
                      </div>
                      <div className="max-h-48 overflow-y-auto rounded-md border border-gray-100 bg-gray-50/60 p-2">
                        <div className="flex flex-wrap gap-2">
                          {event.participants.map((participant) => (
                            <span
                              key={participant.id}
                              className="flex items-center gap-2 rounded-full bg-white px-2 py-1 text-xs shadow-sm"
                            >
                              <UserAvatar
                                name={participant.display_name}
                                photo={participant.photo}
                                size={22}
                              />
                              {participant.display_name}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {sharing && (
                <dl className="grid gap-3 rounded-md border border-gray-200 p-3 text-sm sm:grid-cols-2">
                  <InfoItem
                    label="Статус"
                    value={formatSocialStatus(sharing.status)}
                  />
                  <InfoItem
                    label="Створено"
                    value={formatDateTime(sharing.created_at)}
                  />
                </dl>
              )}

              {actionError && (
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                  {actionError}
                </p>
              )}
            </div>
          </div>
        )}

        {item && (
          <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 p-6 pt-4">
            {event && event.status === 'ACTIVE' && (
              <button
                type="button"
                onClick={() => (joined ? onLeave(event.id) : onJoin(event.id))}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                {joined ? "Від'єднатися" : 'Приєднатися'}
              </button>
            )}
            {canCompleteEvent && event && (
              <button
                type="button"
                onClick={() =>
                  onCompleteEvent({
                    kind: 'event',
                    id: event.id,
                    title: event.title,
                  })
                }
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Завершити івент
              </button>
            )}
            {canCompleteSharing && sharing && (
              <button
                type="button"
                onClick={() =>
                  onCompleteSharing({
                    kind: 'sharing',
                    id: sharing.id,
                    title: sharing.title,
                  })
                }
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Виконано
              </button>
            )}
            {canDelete && event && (
              <button
                type="button"
                onClick={() =>
                  onDeleteEvent({
                    kind: 'event',
                    id: event.id,
                    title: event.title,
                  })
                }
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                Скасувати
              </button>
            )}
            {canDelete && sharing && (
              <button
                type="button"
                onClick={() =>
                  onDeleteSharing({
                    kind: 'sharing',
                    id: sharing.id,
                    title: sharing.title,
                  })
                }
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                Скасувати
              </button>
            )}
            {canEdit && (
              <Link
                to={
                  event
                    ? `/feed/create?eventId=${event.id}`
                    : `/feed/create?sharingId=${sharing?.id}`
                }
                className={
                  'rounded-md bg-orange-500 px-4 py-2 text-sm ' +
                  'font-semibold text-white hover:bg-orange-600'
                }
              >
                Редагувати
              </Link>
            )}
            <button
              type="button"
              onClick={onClose}
              className={
                'rounded-md bg-emerald-600 px-4 py-2 text-sm ' +
                'font-semibold text-white hover:bg-emerald-700'
              }
            >
              Готово
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium tracking-wide text-gray-400 uppercase">
        {label}
      </dt>
      <dd className="mt-1 font-medium text-gray-800">{value}</dd>
    </div>
  );
}
