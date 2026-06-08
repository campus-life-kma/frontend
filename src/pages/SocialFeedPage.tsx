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
  getActiveAnnouncements,
  markAnnouncementRead,
} from '../api/announcements';
import { getFloors } from '../api/locations';
import UserAvatar from '../components/UserAvatar';
import ProfileMenu from '../components/ProfileMenu';
import ConfirmDialog from '../components/UI/ConfirmDialog';
import { APP_TITLE } from '../constants/app';
import { useAuthStore } from '../store/authStore';
import type { Announcement } from '../types/announcements';
import type {
  FeedItem,
  SocialEvent,
  SocialSharingRequest,
} from '../types/social';
import type { FloorListItem } from '../types/locations';

type FeedType = 'all' | 'events' | 'sharing';
type FeedOrdering = 'created_at' | 'start_time';
type PendingDelete =
  | { kind: 'event'; id: number; title: string }
  | { kind: 'sharing'; id: number; title: string };
type PendingComplete =
  | { kind: 'event'; id: number; title: string }
  | { kind: 'sharing'; id: number; title: string };

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
  const logout = useAuthStore((state) => state.logout);
  const [page, setPage] = useState(1);
  const [dismissedTimed, setDismissedTimed] = useState<Set<number>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(
    null
  );
  const [pendingComplete, setPendingComplete] =
    useState<PendingComplete | null>(null);

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

  const activeAnnouncements =
    announcementsQuery.data?.filter(
      (announcement) => !dismissedTimed.has(announcement.id)
    ) ?? [];
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
      <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-6">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold text-gray-900">
            <Link to={mapPath}>{APP_TITLE}</Link>
          </h1>
          <nav className="flex items-center gap-2 text-sm">
            <Link
              className="rounded-md px-3 py-1.5 text-gray-600 hover:bg-gray-50"
              to={mapPath}
            >
              Мапа
            </Link>
            <Link
              className="rounded-md bg-blue-50 px-3 py-1.5 font-medium text-blue-700"
              to="/feed"
            >
              Стрічка
            </Link>
          </nav>
        </div>
        {user && <ProfileMenu user={user} onLogout={logout} />}
      </header>

      <main className="mx-auto flex max-w-7xl flex-col gap-5 px-6 py-6">
        <section className="space-y-3">
          {activeAnnouncements.map((announcement) => (
            <AnnouncementBanner
              key={announcement.id}
              announcement={announcement}
              onRead={() => readMutation.mutate(announcement.id)}
              onDismissTimed={() =>
                setDismissedTimed((prev) => new Set(prev).add(announcement.id))
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
  onDismissTimed,
}: {
  announcement: Announcement;
  onRead: () => void;
  onDismissTimed: () => void;
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
        <button
          type="button"
          onClick={expires ? onDismissTimed : onRead}
          className={
            'shrink-0 rounded-md border border-blue-300 bg-white px-3 py-1.5 ' +
            'text-sm font-medium text-blue-700 hover:bg-blue-100'
          }
        >
          Зрозуміло
        </button>
      </div>
    </article>
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
