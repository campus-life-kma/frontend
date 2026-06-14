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
import { getFaculties, getMajors, getRoles } from '../api/dictionaries';
import { getRooms } from '../api/locations';
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
  evictUser,
} from '../api/users';
import AppHeader from '../components/AppHeader';
import UserAvatar from '../components/UserAvatar';
import ConfirmDialog from '../components/UI/ConfirmDialog';
import { useAuthStore } from '../store/authStore';
import type { Booking } from '../types/bookings';
import type {
  FacultyListItem,
  MajorListItem,
  RoleListItem,
} from '../types/dictionaries';
import type { RoomListItem } from '../types/locations';
import type {
  FeedItem,
  SocialEvent,
  SocialSharingRequest,
} from '../types/social';
import type {
  EducationLevel,
  Position,
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

function formatPosition(position: string): string {
  const labels: Record<string, string> = {
    STUDENT: 'Студент',
    TEACHER: 'Викладач',
    EMPLOYEE: 'Працівник',
  };
  return labels[position] ?? 'Студент';
}

function formatEducationLevel(
  level: EducationLevel | null | undefined
): string {
  if (!level) return '';
  const labels: Record<EducationLevel, string> = {
    BACHELOR: 'Бакалавр',
    MASTER: 'Магістр',
    PHD: 'Аспірант',
  };
  return labels[level] ?? '';
}

function formatStudyYear(
  educationLevel: EducationLevel | null | undefined,
  year: string | number | null | undefined
): string | null {
  if (!hasValue(year)) return null;
  const numericYear = Number(year);
  if (educationLevel === 'PHD') {
    return `${numericYear} ${formatYearWord(numericYear)}`;
  }
  return `${numericYear} курс`;
}

function formatYearWord(year: number): string {
  if (year === 1) return 'рік';
  if (year >= 2 && year <= 4) return 'рік';
  return 'рік';
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
  if (profile.position === 'EMPLOYEE') {
    return 'Працівник університету';
  }
  if (profile.position === 'TEACHER') {
    const parts = [profile.faculty_name, 'Викладач'].filter(hasValue);
    return parts.length > 0 ? parts.join(' • ') : 'Викладач';
  }

  const parts = [
    profile.faculty_name,
    profile.major_name,
    formatEducationLevel(profile.education_level),
    formatStudyYear(profile.education_level, profile.year),
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
    if (typeof data === 'object' && data !== null) {
      const firstValue = Object.values(data)[0];
      if (Array.isArray(firstValue)) {
        return String(firstValue[0]);
      }
      if (typeof firstValue === 'string') {
        return firstValue;
      }
    }
  }
  return 'Не вдалося виконати дію.';
}

function canManageItem(
  currentUserId: string | null | undefined,
  currentRole: string | null | undefined,
  currentFloorId: string | null | undefined,
  item: FeedItem
): boolean {
  if (item.creator.id === currentUserId || currentRole === 'ADMIN') {
    return true;
  }

  if (currentRole !== 'MODERATOR') return false;
  return Boolean(
    item.floor_id && currentFloorId && String(item.floor_id) === currentFloorId
  );
}

function canCancelSocialItem(item: FeedItem): boolean {
  return item.status === 'ACTIVE';
}

export default function UserProfilePage() {
  const { userId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.user);
  const updateCurrentUser = useAuthStore((state) => state.updateUser);
  const [activeTab, setActiveTab] = useState<ActivityTab>('hosted');
  const [actionError, setActionError] = useState<string | null>(null);
  const [evictionDialogOpen, setEvictionDialogOpen] = useState(false);

  const isPrivateMode = !userId || userId === 'me';
  const targetUserId = isPrivateMode ? currentUser?.id : userId;
  const canEditIdentity =
    Boolean(targetUserId) &&
    (isPrivateMode ||
      currentUser?.id === targetUserId ||
      currentUser?.role === 'ADMIN');
  const isAdmin = currentUser?.role === 'ADMIN';

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

  const rolesQuery = useQuery({
    queryKey: ['roles'],
    queryFn: getRoles,
    enabled: isAdmin && !!targetUserId,
  });

  const facultiesQuery = useQuery({
    queryKey: ['faculties'],
    queryFn: getFaculties,
    enabled: isAdmin && !!targetUserId,
  });

  const majorsQuery = useQuery({
    queryKey: ['majors'],
    queryFn: getMajors,
    enabled: isAdmin && !!targetUserId,
  });

  const roomsQuery = useQuery({
    queryKey: ['rooms'],
    queryFn: getRooms,
    enabled: isAdmin && !!targetUserId,
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

  const evictUserMutation = useMutation({
    mutationFn: evictUser,
    onSuccess: () => {
      setEvictionDialogOpen(false);
      setActionError(null);
      if (profileQuery.data?.floor_id) {
        navigate(`/?floorId=${profileQuery.data.floor_id}`, { replace: true });
      } else {
        navigate('/', { replace: true });
      }
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      void queryClient.invalidateQueries({ queryKey: ['user-profile'] });
    },
    onError: (error) => setActionError(normalizeError(error)),
  });

  const profile = profileQuery.data;
  const canModerateTargetProfile = Boolean(
    profile &&
    currentUser?.role === 'MODERATOR' &&
    currentUser.id !== profile.id &&
    currentUser.floor_id &&
    profile.floor_id &&
    currentUser.floor_id === String(profile.floor_id)
  );
  const canEditStatusBio = canEditIdentity || canModerateTargetProfile;
  const canEvictProfile = Boolean(
    profile && isAdmin && currentUser?.id !== profile.id
  );

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
      <AppHeader />

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
              isAdmin={isAdmin}
              canEditIdentity={canEditIdentity}
              canEditStatusBio={canEditStatusBio}
              roles={rolesQuery.data ?? []}
              faculties={facultiesQuery.data ?? []}
              majors={majorsQuery.data ?? []}
              rooms={roomsQuery.data ?? []}
              dictionariesLoading={
                rolesQuery.isLoading ||
                facultiesQuery.isLoading ||
                majorsQuery.isLoading ||
                roomsQuery.isLoading
              }
              saving={updateProfileMutation.isPending}
              canEvict={canEvictProfile}
              evicting={evictUserMutation.isPending}
              onRequestEvict={() => setEvictionDialogOpen(true)}
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
          currentFloorId={currentUser?.floor_id ?? null}
          actionError={actionError}
          onClose={closeDetailsModal}
          onJoin={(eventId) => joinMutation.mutate(eventId)}
          onLeave={(eventId) => leaveMutation.mutate(eventId)}
          onDeleteEvent={(eventId) => {
            if (window.confirm('Ви впевнені, що хочете видалити цю подію?')) {
              deleteEventMutation.mutate(eventId);
            }
          }}
          onDeleteSharing={(requestId) => {
            if (
              window.confirm(
                'Ви впевнені, що хочете видалити цей запит на взаємодопомогу?'
              )
            ) {
              deleteSharingMutation.mutate(requestId);
            }
          }}
        />
      )}

      {evictionDialogOpen && profile && (
        <ConfirmDialog
          title="Виселити користувача?"
          description={
            `Профіль «${profile.display_name}» буде видалено з бази ` +
            'мешканців Campus Life. Перед видаленням користувач отримає ' +
            'email-сповіщення, а якщо лист не вдасться надіслати, ' +
            'виселення буде скасовано.'
          }
          confirmLabel="Виселити"
          variant="danger"
          isPending={evictUserMutation.isPending}
          onClose={() => setEvictionDialogOpen(false)}
          onConfirm={() => evictUserMutation.mutate(profile.id)}
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
  isAdmin,
  canEditIdentity,
  canEditStatusBio,
  roles,
  faculties,
  majors,
  rooms,
  dictionariesLoading,
  saving,
  canEvict,
  evicting,
  onRequestEvict,
  onSave,
}: {
  profile: UserProfile;
  isPrivateMode: boolean;
  isAdmin: boolean;
  canEditIdentity: boolean;
  canEditStatusBio: boolean;
  roles: RoleListItem[];
  faculties: FacultyListItem[];
  majors: MajorListItem[];
  rooms: RoomListItem[];
  dictionariesLoading: boolean;
  saving: boolean;
  canEvict: boolean;
  evicting: boolean;
  onRequestEvict: () => void;
  onSave: (payload: UserProfileUpdatePayload) => Promise<UserProfile>;
}) {
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(profile.display_name);
  const sortedRooms = useMemo(
    () =>
      [...rooms].sort((a, b) => {
        const floorDiff =
          (a.floor_number ?? a.floor) - (b.floor_number ?? b.floor);
        if (floorDiff !== 0) return floorDiff;
        return a.name.localeCompare(b.name, 'uk');
      }),
    [rooms]
  );
  const sortedFaculties = useMemo(
    () => [...faculties].sort((a, b) => a.name.localeCompare(b.name, 'uk')),
    [faculties]
  );

  const canEditAdminField = isAdmin && !dictionariesLoading;

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
            {canEditIdentity && (
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
              {canEditIdentity && !editingName && (
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
            <InlineEditableText
              value={profile.email}
              placeholder="Пошту не вказано"
              canEdit={isAdmin}
              saving={saving}
              className="mt-1 text-sm text-gray-500"
              inputType="email"
              onSave={(value) => onSave({ email: value })}
            />
            <p className="mt-2 text-sm font-medium text-gray-700">
              {studyLine(profile)}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {locationLine(profile)}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <EditableBadgeSelect
                value={formatRole(profile.role_name)}
                editValue={profile.role_id ? String(profile.role_id) : ''}
                canEdit={canEditAdminField}
                saving={saving}
                onSave={(value) =>
                  onSave({ role: value ? Number(value) : null })
                }
              >
                <option value="">Без ролі</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {formatRole(role.name)}
                  </option>
                ))}
              </EditableBadgeSelect>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 md:min-w-72">
          {canEvict && (
            <button
              type="button"
              onClick={onRequestEvict}
              disabled={evicting}
              className={
                'self-start rounded-md border border-red-200 bg-red-50 ' +
                'px-3 py-2 text-sm font-semibold text-red-700 ' +
                'hover:bg-red-100 disabled:opacity-60 md:self-end'
              }
            >
              {evicting ? 'Виселяємо…' : 'Виселити'}
            </button>
          )}
          <div className="grid gap-2 text-sm">
            <EditableInfoLine
              label="Кімната"
              value={profile.room_name ?? 'Не вказано'}
              editValue={profile.room_id ? String(profile.room_id) : ''}
              canEdit={canEditAdminField}
              saving={saving}
              onSave={(value) => onSave({ room: value ? Number(value) : null })}
            >
              <option value="">Без кімнати</option>
              {sortedRooms.map((room) => (
                <option
                  key={room.id}
                  value={room.id}
                  disabled={roomDisabled(room, profile.room_id)}
                >
                  {roomLabel(room)}
                </option>
              ))}
            </EditableInfoLine>
            <EditableInfoLine
              label="Позиція у ВНЗ"
              value={formatPosition(profile.position)}
              editValue={profile.position}
              canEdit={canEditAdminField}
              saving={saving}
              onSave={(value) => onSave({ position: value as Position })}
            >
              <option value="STUDENT">Студент</option>
              <option value="TEACHER">Викладач</option>
              <option value="EMPLOYEE">Працівник</option>
            </EditableInfoLine>

            {profile.position === 'TEACHER' && (
              <EditableInfoLine
                label="Факультет"
                value={profile.faculty_name ?? 'Не вказано'}
                editValue={profile.faculty_id ? String(profile.faculty_id) : ''}
                canEdit={canEditAdminField}
                saving={saving}
                onSave={(value) =>
                  onSave({ faculty: value ? Number(value) : null })
                }
              >
                <option value="">Без факультету</option>
                {sortedFaculties.map((faculty) => (
                  <option key={faculty.id} value={faculty.id}>
                    {faculty.name}
                  </option>
                ))}
              </EditableInfoLine>
            )}
            {profile.position === 'STUDENT' && (
              <div className="rounded-md bg-gray-50 px-3 py-2">
                <p className="text-xs font-medium tracking-wide text-gray-400 uppercase">
                  Факультет
                </p>
                <p className="mt-1 font-medium break-words text-gray-800">
                  {profile.faculty_name ?? 'Не вказано'}
                </p>
              </div>
            )}
            {profile.position === 'STUDENT' && (
              <>
                <EditableInfoLine
                  label="Спеціальність"
                  value={profile.major_name ?? 'Не вказано'}
                  editValue={profile.major_id ? String(profile.major_id) : ''}
                  canEdit={canEditAdminField}
                  saving={saving}
                  onSave={(value) =>
                    onSave({ major: value ? Number(value) : null })
                  }
                >
                  <option value="">Без спеціальності</option>
                  {majors.map((major) => (
                    <option key={major.id} value={major.id}>
                      {major.name}
                    </option>
                  ))}
                </EditableInfoLine>
                <EditableInfoLine
                  label="Рівень навчання"
                  value={formatEducationLevel(profile.education_level)}
                  editValue={profile.education_level ?? ''}
                  canEdit={canEditAdminField}
                  saving={saving}
                  onSave={(value) => {
                    const educationLevel = value as EducationLevel;
                    const currentYear = profile.year
                      ? Number(profile.year)
                      : null;
                    return onSave({
                      education_level: educationLevel,
                      year:
                        educationLevel === 'MASTER' &&
                        currentYear !== null &&
                        currentYear > 2
                          ? 2
                          : currentYear,
                    });
                  }}
                >
                  <option value="BACHELOR">Бакалавр</option>
                  <option value="MASTER">Магістр</option>
                  <option value="PHD">Аспірант</option>
                </EditableInfoLine>
                <EditableInfoLine
                  label="Курс"
                  value={
                    formatStudyYear(profile.education_level, profile.year) ??
                    'Не вказано'
                  }
                  editValue={profile.year ? String(profile.year) : ''}
                  canEdit={canEditAdminField}
                  saving={saving}
                  onSave={(value) =>
                    onSave({ year: value ? Number(value) : null })
                  }
                >
                  <option value="">Не вказано</option>
                  <option value="1">1 курс</option>
                  <option value="2">2 курс</option>
                  {profile.education_level !== 'MASTER' && (
                    <>
                      <option value="3">3 курс</option>
                      <option value="4">4 курс</option>
                    </>
                  )}
                </EditableInfoLine>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 border-t border-gray-100 pt-4">
        <EditableProfileField
          label="Статус"
          value={profile.status}
          placeholder="Статус ще не вказано."
          canEdit={canEditStatusBio}
          saving={saving}
          onSave={(value) => onSave({ status: value })}
        />
        <EditableProfileField
          label="Біо"
          value={profile.bio}
          placeholder="Користувач ще не додав опис профілю."
          canEdit={canEditStatusBio}
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

function InlineEditableText({
  value,
  placeholder,
  canEdit,
  saving,
  className,
  inputType = 'text',
  onSave,
}: {
  value: string | null;
  placeholder: string;
  canEdit: boolean;
  saving: boolean;
  className: string;
  inputType?: string;
  onSave: (value: string) => Promise<unknown>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');

  async function save() {
    const nextValue = draft.trim();
    if (!nextValue) return;
    await onSave(nextValue);
    setEditing(false);
  }

  if (!editing) {
    return (
      <div className="flex min-w-0 items-center gap-1">
        <p className={`${className} min-w-0 truncate`}>
          {value || placeholder}
        </p>
        {canEdit && (
          <EditIconButton
            label="Редагувати поле"
            onClick={() => {
              setDraft(value ?? '');
              setEditing(true);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
      <input
        type={inputType}
        value={draft}
        disabled={saving}
        onChange={(event) => setDraft(event.target.value)}
        className={
          'min-w-0 rounded-md border border-gray-300 px-3 py-2 text-sm ' +
          'outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
        }
      />
      <InlineSaveCancel
        saving={saving}
        disabled={!draft.trim()}
        onSave={() => void save()}
        onCancel={() => setEditing(false)}
      />
    </div>
  );
}

function EditableBadgeSelect({
  value,
  editValue,
  canEdit,
  saving,
  children,
  onSave,
}: {
  value: string;
  editValue: string;
  canEdit: boolean;
  saving: boolean;
  children: ReactNode;
  onSave: (value: string) => Promise<unknown>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(editValue);

  async function save() {
    await onSave(draft);
    setEditing(false);
  }

  if (!editing) {
    return (
      <span className="flex items-center gap-1">
        <Badge>{value}</Badge>
        {canEdit && (
          <EditIconButton
            label="Редагувати роль"
            onClick={() => {
              setDraft(editValue);
              setEditing(true);
            }}
          />
        )}
      </span>
    );
  }

  return (
    <span className="flex flex-wrap items-center gap-2">
      <select
        value={draft}
        disabled={saving}
        onChange={(event) => setDraft(event.target.value)}
        className={
          'rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm ' +
          'outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
        }
      >
        {children}
      </select>
      <InlineSaveCancel
        saving={saving}
        onSave={() => void save()}
        onCancel={() => setEditing(false)}
      />
    </span>
  );
}

function EditableInfoLine({
  label,
  value,
  editValue,
  canEdit,
  saving,
  children,
  onSave,
}: {
  label: string;
  value: string;
  editValue: string;
  canEdit: boolean;
  saving: boolean;
  children: ReactNode;
  onSave: (value: string) => Promise<unknown>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(editValue);

  async function save() {
    await onSave(draft);
    setEditing(false);
  }

  return (
    <div className="rounded-md bg-gray-50 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium tracking-wide text-gray-400 uppercase">
          {label}
        </p>
        {canEdit && !editing && (
          <EditIconButton
            label={`Редагувати ${label.toLowerCase()}`}
            onClick={() => {
              setDraft(editValue);
              setEditing(true);
            }}
          />
        )}
      </div>

      {!editing ? (
        <p className="mt-1 font-medium break-words text-gray-800">{value}</p>
      ) : (
        <div className="mt-2 space-y-2">
          <select
            value={draft}
            disabled={saving}
            onChange={(event) => setDraft(event.target.value)}
            className={
              'w-full rounded-md border border-gray-300 bg-white px-3 py-2 ' +
              'text-sm outline-none focus:border-blue-500 focus:ring-1 ' +
              'focus:ring-blue-500 disabled:bg-gray-50'
            }
          >
            {children}
          </select>
          <InlineSaveCancel
            saving={saving}
            onSave={() => void save()}
            onCancel={() => setEditing(false)}
          />
        </div>
      )}
    </div>
  );
}

function EditIconButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded p-1 text-gray-400 hover:bg-white hover:text-blue-700"
      aria-label={label}
      title={label}
    >
      ✎
    </button>
  );
}

function InlineSaveCancel({
  saving,
  disabled = false,
  onSave,
  onCancel,
}: {
  saving: boolean;
  disabled?: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex justify-end gap-2">
      <button
        type="button"
        onClick={onCancel}
        disabled={saving}
        className={
          'rounded-md border border-gray-200 px-2.5 py-1.5 text-xs ' +
          'font-medium text-gray-700 hover:bg-white disabled:opacity-60'
        }
      >
        Скасувати
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={saving || disabled}
        className={
          'rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-semibold ' +
          'text-white hover:bg-blue-700 disabled:bg-gray-300'
        }
      >
        {saving ? 'Зберігаємо…' : 'Зберегти'}
      </button>
    </div>
  );
}

function roomDisabled(
  room: RoomListItem,
  currentRoomId: number | null
): boolean {
  const currentRoom = room.id === currentRoomId;
  const residents = room.current_residents_count ?? 0;
  const capacity = room.max_person ?? Number.POSITIVE_INFINITY;
  const nonLivingRoom = room.room_type ? room.room_type !== 'LIVING' : false;
  return (
    !currentRoom &&
    (nonLivingRoom || Boolean(room.is_blocked) || residents >= capacity)
  );
}

function roomLabel(room: RoomListItem): string {
  const floor = room.floor_number ?? room.floor;
  const residents = room.current_residents_count;
  const capacity = room.max_person;
  const occupancy =
    typeof residents === 'number' && typeof capacity === 'number'
      ? ` · ${residents}/${capacity}`
      : '';
  const state = room.is_blocked
    ? ' · заблоковано'
    : room.room_type && room.room_type !== 'LIVING'
      ? ' · не житлова'
      : '';
  return `${floor} поверх · ${room.name}${occupancy}${state}`;
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
  currentFloorId,
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
  currentFloorId: string | null;
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
    ? canManageItem(currentUserId, currentRole, currentFloorId, item)
    : false;
  const canCancel = item ? canManage && canCancelSocialItem(item) : false;
  const canEdit = item
    ? item.creator.id === currentUserId && canCancelSocialItem(item)
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

            <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 pt-4">
              {event && event.status === 'ACTIVE' && (
                <button
                  type="button"
                  onClick={() =>
                    joined ? onLeave(event.id) : onJoin(event.id)
                  }
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  {joined ? "Від'єднатися" : 'Приєднатися'}
                </button>
              )}
              {canCancel && event && (
                <button
                  type="button"
                  onClick={() => onDeleteEvent(event.id)}
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                >
                  Скасувати
                </button>
              )}
              {canCancel && sharing && (
                <button
                  type="button"
                  onClick={() => onDeleteSharing(sharing.id)}
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
      <p className="mt-2 text-xs font-medium text-violet-700">
        {formatSocialStatus(event.status)}
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
          {formatSocialStatus(request.status)}
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
