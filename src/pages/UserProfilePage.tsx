import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { cancelBooking, getMyBookings } from '../api/bookings';
import {
  deleteEvent,
  deleteSharingRequest,
  getEvent,
  getSharingRequest,
  joinEvent,
  leaveEvent,
} from '../api/social';
import {
  getUserProfile,
  getUserSocialActivity,
  updateUserProfile,
} from '../api/users';
import ProfileMenu from '../components/ProfileMenu';
import UserAvatar from '../components/UserAvatar';
import { APP_TITLE } from '../constants/app';
import { useAuthStore } from '../store/authStore';
import type { Booking } from '../types/bookings';
import type {
  FeedItem,
  SocialEvent,
  SocialSharingRequest,
} from '../types/social';
import type {
  UserProfile,
  UserProfileEvent,
  UserProfileSharingRequest,
  UserProfileUpdatePayload,
} from '../types/users';

type ActivityTab = 'hosted' | 'going';
type HostedItem = UserProfileEvent | UserProfileSharingRequest;

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('uk-UA', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatBookingTime(startValue: string, endValue: string): string {
  const start = new Date(startValue);
  const end = new Date(endValue);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  const sameDate = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const day = sameDate(start, today)
    ? 'Сьогодні'
    : sameDate(start, tomorrow)
      ? 'Завтра'
      : new Intl.DateTimeFormat('uk-UA', {
          day: 'numeric',
          month: 'short',
        }).format(start);

  const time = new Intl.DateTimeFormat('uk-UA', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return `${day}, ${time.format(start)} - ${time.format(end)}`;
}

function formatRole(role: string | null): string {
  const labels: Record<string, string> = {
    ADMIN: 'Адміністрація',
    MODERATOR: 'Голова поверху',
    RESIDENT: 'Мешканець',
  };
  return role ? (labels[role] ?? role) : 'Мешканець';
}

function formatSharingStatus(status: string): string {
  const labels: Record<string, string> = {
    ACTIVE: 'Активний',
    COMPLETED: 'Виконано',
    DONE: 'Виконано',
    CANCELLED: 'Скасовано',
  };
  return labels[status] ?? status;
}

function hasValue(value: string | number | null | undefined): boolean {
  return value !== null && value !== undefined && String(value).trim() !== '';
}

function locationLine(profile: UserProfile): string {
  const parts = [
    profile.dormitory_name,
    profile.floor_number ? `${profile.floor_number} поверх` : null,
    profile.room_name ? `кімната ${profile.room_name}` : null,
  ].filter(hasValue);

  return parts.length > 0 ? parts.join(' • ') : 'Локацію не вказано';
}

function studyLine(profile: UserProfile): string {
  const parts = [
    profile.faculty_name,
    profile.major_name,
    profile.year ? `${profile.year} курс` : null,
  ].filter(hasValue);

  return parts.length > 0 ? parts.join(' / ') : 'Навчальні дані не вказані';
}

function isEventItem(item: HostedItem): item is UserProfileEvent {
  return item.type === 'event';
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

function canManageItem(
  currentUserId: string | null | undefined,
  currentRole: string | null | undefined,
  item: FeedItem
): boolean {
  return item.creator.id === currentUserId || currentRole === 'ADMIN';
}

export default function UserProfilePage() {
  const { userId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const updateCurrentUser = useAuthStore((state) => state.updateUser);
  const [activeTab, setActiveTab] = useState<ActivityTab>('hosted');
  const [actionError, setActionError] = useState<string | null>(null);

  const isPrivateMode = !userId || userId === 'me';
  const targetUserId = isPrivateMode ? currentUser?.id : userId;
  const canEditProfile =
    Boolean(targetUserId) &&
    (isPrivateMode ||
      currentUser?.id === targetUserId ||
      currentUser?.role === 'ADMIN');

  const selectedEventId = Number(searchParams.get('eventId'));
  const selectedSharingId = Number(searchParams.get('sharingId'));

  const profileQuery = useQuery({
    queryKey: ['user-profile', targetUserId],
    queryFn: () => getUserProfile(targetUserId!),
    enabled: !!targetUserId,
  });

  const activityQuery = useQuery({
    queryKey: ['user-social-activity', targetUserId],
    queryFn: () => getUserSocialActivity(targetUserId!),
    enabled: !!targetUserId,
  });

  const myBookingsQuery = useQuery({
    queryKey: ['bookings-me'],
    queryFn: getMyBookings,
    enabled: isPrivateMode && !!targetUserId,
  });

  const eventDetailQuery = useQuery({
    queryKey: ['event-detail', selectedEventId],
    queryFn: () => getEvent(selectedEventId),
    enabled: Number.isFinite(selectedEventId) && selectedEventId > 0,
  });

  const sharingDetailQuery = useQuery({
    queryKey: ['sharing-detail', selectedSharingId],
    queryFn: () => getSharingRequest(selectedSharingId),
    enabled: Number.isFinite(selectedSharingId) && selectedSharingId > 0,
  });

  const updateProfileMutation = useMutation({
    mutationFn: (payload: UserProfileUpdatePayload) =>
      updateUserProfile(targetUserId!, payload),
    onSuccess: async (updatedProfile) => {
      if (currentUser?.id === updatedProfile.id) {
        updateCurrentUser({
          full_name: updatedProfile.display_name,
          photo: updatedProfile.photo,
        });
      }
      await queryClient.invalidateQueries({
        queryKey: ['user-profile', targetUserId],
      });
    },
    onError: (error) => setActionError(normalizeError(error)),
  });

  const cancelBookingMutation = useMutation({
    mutationFn: cancelBooking,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['bookings-me'] });
    },
    onError: (error) => setActionError(normalizeError(error)),
  });

  const joinMutation = useMutation({
    mutationFn: joinEvent,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['event-detail'] });
      await queryClient.invalidateQueries({
        queryKey: ['user-social-activity', targetUserId],
      });
    },
    onError: (error) => setActionError(normalizeError(error)),
  });

  const leaveMutation = useMutation({
    mutationFn: leaveEvent,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['event-detail'] });
      await queryClient.invalidateQueries({
        queryKey: ['user-social-activity', targetUserId],
      });
    },
    onError: (error) => setActionError(normalizeError(error)),
  });

  const deleteEventMutation = useMutation({
    mutationFn: deleteEvent,
    onSuccess: async () => {
      closeDetailsModal();
      await queryClient.invalidateQueries({
        queryKey: ['user-social-activity', targetUserId],
      });
    },
    onError: (error) => setActionError(normalizeError(error)),
  });

  const deleteSharingMutation = useMutation({
    mutationFn: deleteSharingRequest,
    onSuccess: async () => {
      closeDetailsModal();
      await queryClient.invalidateQueries({
        queryKey: ['user-social-activity', targetUserId],
      });
    },
    onError: (error) => setActionError(normalizeError(error)),
  });

  const profile = profileQuery.data;

  const activeBookings = useMemo(
    () =>
      (myBookingsQuery.data ?? [])
        .filter((booking) => booking.status === 'ACTIVE')
        .sort(
          (a, b) =>
            new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
        ),
    [myBookingsQuery.data]
  );

  const hostedItems = useMemo(() => {
    const activity = activityQuery.data;
    if (!activity) return [];
    return [...activity.created_events, ...activity.sharing_requests].sort(
      (a, b) => {
        const aTime = isEventItem(a) ? a.start_time : a.created_at;
        const bTime = isEventItem(b) ? b.start_time : b.created_at;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      }
    );
  }, [activityQuery.data]);

  function openEvent(eventId: number) {
    const next = new URLSearchParams(searchParams);
    next.delete('sharingId');
    next.set('eventId', String(eventId));
    setSearchParams(next);
    setActionError(null);
  }

  function openSharing(requestId: number) {
    const next = new URLSearchParams(searchParams);
    next.delete('eventId');
    next.set('sharingId', String(requestId));
    setSearchParams(next);
    setActionError(null);
  }

  function closeDetailsModal() {
    const next = new URLSearchParams(searchParams);
    next.delete('eventId');
    next.delete('sharingId');
    setSearchParams(next, { replace: true });
    setActionError(null);
  }

  if (isPrivateMode && !currentUser?.id) {
    return <ProfileShell title="Завантажуємо профіль…" />;
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-6">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold text-gray-900">
            <Link to="/">{APP_TITLE}</Link>
          </h1>
          <nav className="flex items-center gap-2 text-sm">
            <Link
              className="rounded-md px-3 py-1.5 text-gray-600 hover:bg-gray-50"
              to="/"
            >
              Мапа
            </Link>
            <Link
              className="rounded-md px-3 py-1.5 text-gray-600 hover:bg-gray-50"
              to="/feed"
            >
              Стрічка
            </Link>
          </nav>
        </div>
        {currentUser && <ProfileMenu user={currentUser} onLogout={logout} />}
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-5 px-6 py-6">
        {profileQuery.isLoading && (
          <ProfilePageMessage title="Завантажуємо профіль…" />
        )}

        {profileQuery.isError && (
          <ProfilePageMessage
            title="Профіль не знайдено"
            text="Користувач міг бути деактивований або посилання некоректне."
          />
        )}

        {profile && (
          <>
            <ProfileHeader
              profile={profile}
              isPrivateMode={isPrivateMode}
              canEdit={canEditProfile}
              saving={updateProfileMutation.isPending}
              onSave={(payload) => updateProfileMutation.mutateAsync(payload)}
            />

            {actionError && (
              <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                {actionError}
              </p>
            )}

            {isPrivateMode && (
              <MyBookingsWidget
                bookings={activeBookings}
                loading={myBookingsQuery.isLoading}
                cancellingId={
                  cancelBookingMutation.variables as number | undefined
                }
                isCancelling={cancelBookingMutation.isPending}
                onOpen={(booking) =>
                  navigate(
                    `/resources/${booking.resource_id}?bookingId=${booking.id}`
                  )
                }
                onCancel={(bookingId) =>
                  cancelBookingMutation.mutate(bookingId)
                }
              />
            )}

            <ActivityWidget
              activeTab={activeTab}
              hostedItems={hostedItems}
              goingEvents={activityQuery.data?.participating_events ?? []}
              loading={activityQuery.isLoading}
              onTabChange={setActiveTab}
              onOpenEvent={openEvent}
              onOpenSharing={openSharing}
            />
          </>
        )}
      </main>

      {(eventDetailQuery.data ||
        sharingDetailQuery.data ||
        eventDetailQuery.isLoading ||
        sharingDetailQuery.isLoading) && (
        <ProfileDetailsModal
          event={eventDetailQuery.data}
          sharing={sharingDetailQuery.data}
          loading={eventDetailQuery.isLoading || sharingDetailQuery.isLoading}
          currentUserId={currentUser?.id ?? null}
          currentRole={currentUser?.role ?? null}
          actionError={actionError}
          onClose={closeDetailsModal}
          onJoin={(eventId) => joinMutation.mutate(eventId)}
          onLeave={(eventId) => leaveMutation.mutate(eventId)}
          onDeleteEvent={(eventId) => deleteEventMutation.mutate(eventId)}
          onDeleteSharing={(requestId) =>
            deleteSharingMutation.mutate(requestId)
          }
        />
      )}
    </div>
  );
}

function ProfileShell({ title }: { title: string }) {
  return (
    <div className="min-h-screen bg-gray-50 p-6 text-gray-900">
      <main className="mx-auto max-w-6xl">
        <ProfilePageMessage title={title} />
      </main>
    </div>
  );
}

function ProfileHeader({
  profile,
  isPrivateMode,
  canEdit,
  saving,
  onSave,
}: {
  profile: UserProfile;
  isPrivateMode: boolean;
  canEdit: boolean;
  saving: boolean;
  onSave: (payload: UserProfileUpdatePayload) => Promise<UserProfile>;
}) {
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(profile.display_name);

  async function saveName() {
    const nextName = nameDraft.trim();
    if (!nextName) return;
    await onSave({ full_name: nextName });
    setEditingName(false);
  }

  async function uploadPhoto(file: File | undefined) {
    if (!file) return;
    await onSave({ photo: file });
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 gap-4">
          <div className="relative h-24 w-24 shrink-0">
            <UserAvatar
              name={profile.display_name}
              photo={profile.photo}
              size={96}
            />
            {canEdit && (
              <label
                className={
                  'absolute right-0 bottom-0 flex h-8 w-8 cursor-pointer ' +
                  'items-center justify-center rounded-full border ' +
                  'border-gray-200 bg-white text-sm font-semibold ' +
                  'text-gray-700 shadow-sm hover:bg-blue-50 hover:text-blue-700'
                }
                title="Змінити аватар"
                aria-label="Змінити аватар"
              >
                ✎
                <input
                  type="file"
                  accept="image/*"
                  disabled={saving}
                  onChange={(event) =>
                    void uploadPhoto(event.target.files?.[0])
                  }
                  className="hidden"
                />
              </label>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {editingName ? (
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <input
                    value={nameDraft}
                    onChange={(event) => setNameDraft(event.target.value)}
                    className={
                      'min-w-0 rounded-md border border-gray-300 px-3 py-2 ' +
                      'text-xl font-semibold text-gray-950 outline-none ' +
                      'focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                    }
                  />
                  <button
                    type="button"
                    onClick={() => void saveName()}
                    disabled={saving || !nameDraft.trim()}
                    className={
                      'rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold ' +
                      'text-white hover:bg-blue-700 disabled:bg-gray-300'
                    }
                  >
                    Зберегти
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNameDraft(profile.display_name);
                      setEditingName(false);
                    }}
                    disabled={saving}
                    className={
                      'rounded-md border border-gray-200 px-3 py-2 text-sm ' +
                      'font-medium text-gray-700 hover:bg-gray-50'
                    }
                  >
                    Скасувати
                  </button>
                </div>
              ) : (
                <h1 className="truncate text-2xl font-semibold text-gray-950">
                  {profile.display_name}
                </h1>
              )}
              {canEdit && !editingName && (
                <button
                  type="button"
                  onClick={() => {
                    setNameDraft(profile.display_name);
                    setEditingName(true);
                  }}
                  className="rounded p-1 text-gray-400 hover:bg-gray-50 hover:text-blue-700"
                  aria-label="Редагувати ім'я"
                  title="Редагувати ім'я"
                >
                  ✎
                </button>
              )}
              {isPrivateMode && (
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                  Мій профіль
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-gray-500">{profile.email}</p>
            <p className="mt-2 text-sm font-medium text-gray-700">
              {studyLine(profile)}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {locationLine(profile)}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge>{formatRole(profile.role_name)}</Badge>
            </div>
          </div>
        </div>

        <div className="grid gap-2 text-sm md:min-w-72">
          <InfoLine label="Кімната" value={profile.room_name ?? 'Не вказано'} />
          <InfoLine
            label="Факультет"
            value={profile.faculty_name ?? 'Не вказано'}
          />
          <InfoLine
            label="Спеціальність"
            value={profile.major_name ?? 'Не вказано'}
          />
        </div>
      </div>

      <div className="mt-5 grid gap-4 border-t border-gray-100 pt-4">
        <EditableProfileField
          label="Статус"
          value={profile.status}
          placeholder="Статус ще не вказано."
          canEdit={canEdit}
          saving={saving}
          onSave={(value) => onSave({ status: value })}
        />
        <EditableProfileField
          label="Біо"
          value={profile.bio}
          placeholder="Користувач ще не додав опис профілю."
          canEdit={canEdit}
          multiline
          saving={saving}
          onSave={(value) => onSave({ bio: value })}
        />
      </div>
    </section>
  );
}

function EditableProfileField({
  label,
  value,
  placeholder,
  canEdit,
  multiline = false,
  saving,
  onSave,
}: {
  label: string;
  value: string | null;
  placeholder: string;
  canEdit: boolean;
  multiline?: boolean;
  saving: boolean;
  onSave: (value: string) => Promise<unknown>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');

  async function save() {
    await onSave(draft.trim());
    setEditing(false);
  }

  return (
    <section className="min-w-0 overflow-hidden rounded-md bg-gray-50 p-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-medium tracking-wide text-gray-400 uppercase">
          {label}
        </h2>
        {canEdit && !editing && (
          <button
            type="button"
            onClick={() => {
              setDraft(value ?? '');
              setEditing(true);
            }}
            className="rounded p-1 text-gray-400 hover:bg-white hover:text-blue-700"
            aria-label={`Редагувати ${label.toLowerCase()}`}
            title={`Редагувати ${label.toLowerCase()}`}
          >
            ✎
          </button>
        )}
      </div>

      {!editing ? (
        <p className="mt-2 overflow-hidden text-sm leading-6 break-words whitespace-pre-wrap text-gray-700">
          {value || placeholder}
        </p>
      ) : (
        <div className="mt-2 space-y-2">
          {multiline ? (
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              className={
                'min-h-24 w-full rounded-md border border-gray-300 px-3 py-2 ' +
                'resize-y text-sm break-words outline-none focus:border-blue-500 focus:ring-1 ' +
                'focus:ring-blue-500'
              }
            />
          ) : (
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              className={
                'w-full rounded-md border border-gray-300 px-3 py-2 text-sm ' +
                'min-w-0 outline-none focus:border-blue-500 focus:ring-1 ' +
                'focus:ring-blue-500'
              }
            />
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={saving}
              className={
                'rounded-md border border-gray-200 px-3 py-1.5 text-sm ' +
                'text-gray-700 hover:bg-white disabled:opacity-60'
              }
            >
              Скасувати
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className={
                'rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold ' +
                'text-white hover:bg-blue-700 disabled:bg-gray-300'
              }
            >
              {saving ? 'Зберігаємо…' : 'Зберегти'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function MyBookingsWidget({
  bookings,
  loading,
  cancellingId,
  isCancelling,
  onOpen,
  onCancel,
}: {
  bookings: Booking[];
  loading: boolean;
  cancellingId?: number;
  isCancelling: boolean;
  onOpen: (booking: Booking) => void;
  onCancel: (bookingId: number) => void;
}) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-gray-950">
          Мої бронювання
        </h2>
        <span className="text-xs font-medium text-gray-400">
          Приватний віджет
        </span>
      </div>

      {loading && (
        <p className="mt-4 text-sm text-gray-500">Завантажуємо бронювання…</p>
      )}

      {!loading && bookings.length === 0 && (
        <p className="mt-4 rounded-md bg-gray-50 px-3 py-4 text-sm text-gray-500">
          Активних бронювань немає.
        </p>
      )}

      {bookings.length > 0 && (
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {bookings.map((booking) => (
            <article
              key={booking.id}
              role="button"
              tabIndex={0}
              onClick={() => onOpen(booking)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') onOpen(booking);
              }}
              className={
                'cursor-pointer rounded-lg border border-gray-200 p-3 ' +
                'transition hover:border-blue-200 hover:bg-blue-50'
              }
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-gray-950">
                    {booking.resource_name}
                  </h3>
                  <p className="mt-1 text-xs text-gray-500">
                    {booking.room_name}, {booking.floor_id} поверх
                  </p>
                  <p className="mt-2 text-sm font-medium text-blue-700">
                    {formatBookingTime(booking.start_time, booking.end_time)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isCancelling && cancellingId === booking.id}
                  onClick={(event) => {
                    event.stopPropagation();
                    onCancel(booking.id);
                  }}
                  className={
                    'rounded-md border border-red-200 px-2 py-1 text-xs ' +
                    'font-semibold text-red-700 hover:bg-red-50 ' +
                    'disabled:opacity-60'
                  }
                >
                  Скасувати
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function ActivityWidget({
  activeTab,
  hostedItems,
  goingEvents,
  loading,
  onTabChange,
  onOpenEvent,
  onOpenSharing,
}: {
  activeTab: ActivityTab;
  hostedItems: HostedItem[];
  goingEvents: UserProfileEvent[];
  loading: boolean;
  onTabChange: (tab: ActivityTab) => void;
  onOpenEvent: (eventId: number) => void;
  onOpenSharing: (requestId: number) => void;
}) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-base font-semibold text-gray-950">Активність</h2>
        <div className="flex rounded-md border border-gray-200 bg-gray-50 p-1 text-sm">
          {[
            ['hosted', 'Створені'],
            ['going', 'Відвідую'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => onTabChange(value as ActivityTab)}
              className={
                'rounded px-3 py-1.5 font-medium ' +
                (activeTab === value
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-gray-600')
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <p className="mt-4 text-sm text-gray-500">Завантажуємо активність…</p>
      )}

      {!loading && activeTab === 'hosted' && (
        <ActivityGrid>
          {hostedItems.length > 0 ? (
            hostedItems.map((item) =>
              isEventItem(item) ? (
                <EventActivityCard
                  key={`event-${item.id}`}
                  event={item}
                  onOpen={() => onOpenEvent(item.id)}
                />
              ) : (
                <SharingActivityCard
                  key={`sharing-${item.id}`}
                  request={item}
                  onOpen={() => onOpenSharing(item.id)}
                />
              )
            )
          ) : (
            <EmptyActivity text="Створених подій або запитів ще немає." />
          )}
        </ActivityGrid>
      )}

      {!loading && activeTab === 'going' && (
        <ActivityGrid>
          {goingEvents.length > 0 ? (
            goingEvents.map((event) => (
              <EventActivityCard
                key={event.id}
                event={event}
                onOpen={() => onOpenEvent(event.id)}
              />
            ))
          ) : (
            <EmptyActivity text="Немає майбутніх подій з участю." />
          )}
        </ActivityGrid>
      )}
    </section>
  );
}

function ProfileDetailsModal({
  event,
  sharing,
  loading,
  currentUserId,
  currentRole,
  actionError,
  onClose,
  onJoin,
  onLeave,
  onDeleteEvent,
  onDeleteSharing,
}: {
  event?: SocialEvent;
  sharing?: SocialSharingRequest;
  loading: boolean;
  currentUserId: string | null;
  currentRole: string | null;
  actionError: string | null;
  onClose: () => void;
  onJoin: (eventId: number) => void;
  onLeave: (eventId: number) => void;
  onDeleteEvent: (eventId: number) => void;
  onDeleteSharing: (requestId: number) => void;
}) {
  const item = event ?? sharing;
  const joined =
    event?.participants?.some(
      (participant) => participant.id === currentUserId
    ) ?? false;
  const canManage = item
    ? canManageItem(currentUserId, currentRole, item)
    : false;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
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
          <div className="mt-5 space-y-5">
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
                    label="Початок"
                    value={formatDateTime(event.start_time)}
                  />
                  <InfoItem
                    label="Кінець"
                    value={formatDateTime(event.end_time)}
                  />
                  <InfoItem
                    label="Локація"
                    value={event.room_name ?? event.custom_location ?? 'Поверх'}
                  />
                  <InfoItem
                    label="Учасники"
                    value={
                      event.max_person > 0
                        ? `${event.participants?.length ?? 0} / ${event.max_person}`
                        : `${event.participants?.length ?? 0} · необмежено`
                    }
                  />
                </dl>
              </>
            )}

            {sharing && (
              <dl className="grid gap-3 rounded-md border border-gray-200 p-3 text-sm sm:grid-cols-2">
                <InfoItem
                  label="Статус"
                  value={formatSharingStatus(sharing.status)}
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

            <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 pt-4">
              {event && (
                <button
                  type="button"
                  onClick={() =>
                    joined ? onLeave(event.id) : onJoin(event.id)
                  }
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  {joined ? 'Відмовитися' : 'Приєднатися'}
                </button>
              )}
              {canManage && event && (
                <button
                  type="button"
                  onClick={() => onDeleteEvent(event.id)}
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                >
                  Видалити
                </button>
              )}
              {canManage && sharing && (
                <button
                  type="button"
                  onClick={() => onDeleteSharing(sharing.id)}
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                >
                  Видалити
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ProfilePageMessage({ title, text }: { title: string; text?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-10 text-center shadow-sm">
      <p className="text-sm font-medium text-gray-700">{title}</p>
      {text && <p className="mt-2 text-sm text-gray-500">{text}</p>}
    </div>
  );
}

function Badge({ children }: { children: string }) {
  return (
    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
      {children}
    </span>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-gray-50 px-3 py-2">
      <p className="text-xs font-medium tracking-wide text-gray-400 uppercase">
        {label}
      </p>
      <p className="mt-1 font-medium text-gray-800">{value}</p>
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

function ActivityGrid({ children }: { children: ReactNode }) {
  return <div className="mt-4 grid gap-3 md:grid-cols-2">{children}</div>;
}

function EventActivityCard({
  event,
  onOpen,
}: {
  event: UserProfileEvent;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="rounded-md border border-gray-100 p-3 text-left transition hover:border-blue-200 hover:bg-blue-50"
    >
      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-800">
        Івент
      </span>
      <p className="mt-2 line-clamp-2 text-sm font-semibold text-gray-900">
        {event.title}
      </p>
      <p className="mt-1 text-xs text-gray-500">
        {formatDateTime(event.start_time)}
      </p>
      {(event.is_faculty_only || event.is_major_only) && (
        <p className="mt-2 text-xs font-medium text-blue-700">
          {event.is_major_only ? 'Для спеціальності' : 'Для факультету'}
        </p>
      )}
    </button>
  );
}

function SharingActivityCard({
  request,
  onOpen,
}: {
  request: UserProfileSharingRequest;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={
        'rounded-md border border-gray-100 p-3 text-left transition ' +
        'hover:border-emerald-200 hover:bg-emerald-50'
      }
    >
      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
        Шеринг
      </span>
      <p className="mt-2 line-clamp-2 text-sm font-semibold text-gray-900">
        {request.title}
      </p>
      <div className="mt-2 flex items-center justify-between gap-2 text-xs">
        <span className="font-medium text-emerald-700">
          {formatSharingStatus(request.status)}
        </span>
        <span className="text-gray-500">
          {formatDateTime(request.created_at)}
        </span>
      </div>
    </button>
  );
}

function EmptyActivity({ text }: { text: string }) {
  return (
    <p className="rounded-md bg-gray-50 px-3 py-4 text-sm text-gray-500">
      {text}
    </p>
  );
}
