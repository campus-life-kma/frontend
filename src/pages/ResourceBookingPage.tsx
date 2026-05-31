import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import {
  blockResource,
  cancelBooking,
  createBooking,
  getMyBookings,
  getResourceSchedule,
  unblockResource,
} from '../api/bookings';
import { getFloorMapData, getFloors } from '../api/locations';
import UserAvatar from '../components/UserAvatar';
import ResourceTypeIcon from '../components/ResourceTypeIcon';
import ProfileMenu from '../components/ProfileMenu';
import { useAuthStore } from '../store/authStore';
import type { Booking, ResourceScheduleBooking } from '../types/bookings';
import type { ResourceOnMap, RoomOnMap, UserOnMap } from '../types/locations';

const DAYS_AHEAD = 30;
const MINUTES_IN_DAY = 24 * 60;
const PX_PER_MINUTE = 1;
const SLOT_MINUTES = 30;
const MAX_BOOKING_MINUTES = 3 * 60;

interface ResourceLocationState {
  resource?: ResourceOnMap;
  room?: RoomOnMap;
  floorId?: number | null;
  floorNumber?: number | null;
  dormitoryName?: string | null;
}

interface ResourceContext {
  resource: ResourceOnMap;
  room: RoomOnMap;
  floorId: number;
  floorNumber: number;
  dormitoryName: string;
}

interface TimelineBooking {
  id: number;
  start: Date;
  end: Date;
  status: string;
  user: UserOnMap | null;
  lane: number;
  source: ResourceScheduleBooking | Booking;
}

interface BookingDraft {
  day: string;
  start: string;
  end: string;
  lane: number;
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toTimeValue(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes()
  ).padStart(2, '0')}`;
}

function parseLocalDateTime(day: string, time: string): Date {
  const [year, month, date] = day.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  return new Date(year, month - 1, date, hours, minutes);
}

function minuteToDate(day: Date, minute: number): Date {
  const date = startOfLocalDay(day);
  date.setMinutes(minute);
  return date;
}

function minutesFromStart(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function minutesBetween(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / 60000);
}

function roundSlotMinute(minute: number): number {
  return Math.max(
    0,
    Math.min(
      MINUTES_IN_DAY - SLOT_MINUTES,
      Math.round(minute / SLOT_MINUTES) * SLOT_MINUTES
    )
  );
}

function ceilSlotMinute(minute: number): number {
  return Math.min(
    MINUTES_IN_DAY,
    Math.ceil(minute / SLOT_MINUTES) * SLOT_MINUTES
  );
}

function formatDayLabel(date: Date): string {
  return new Intl.DateTimeFormat('uk-UA', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(date);
}

function formatLongDay(date: Date): string {
  return new Intl.DateTimeFormat('uk-UA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
}

function formatTimeRange(start: Date, end: Date): string {
  return `${toTimeValue(start)} - ${toTimeValue(end)}`;
}

function overlaps(startA: Date, endA: Date, startB: Date, endB: Date): boolean {
  return startA < endB && endA > startB;
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
  return 'Не вдалося виконати дію. Спробуйте ще раз.';
}

function isAdmin(role: string | null | undefined): boolean {
  return role === 'ADMIN';
}

function isModerator(role: string | null | undefined): boolean {
  return role === 'MODERATOR' || role === 'ADMIN';
}

function mapScheduleBooking(
  booking: ResourceScheduleBooking,
  currentUserBooking?: Booking
): TimelineBooking {
  const user = currentUserBooking?.user ?? booking.user ?? null;
  return {
    id: booking.booking_id,
    start: new Date(booking.start_time),
    end: new Date(booking.end_time),
    status: booking.status,
    user,
    lane: 0,
    source: currentUserBooking ?? booking,
  };
}

function assignLanes(
  bookings: TimelineBooking[],
  capacity: number
): TimelineBooking[] {
  const laneEnds: Date[] = [];
  return [...bookings]
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .map((booking) => {
      let lane = laneEnds.findIndex((end) => end <= booking.start);
      if (lane === -1) lane = Math.min(laneEnds.length, capacity - 1);
      laneEnds[lane] = booking.end;
      return { ...booking, lane };
    });
}

function useResourceContext(resourceId: number | null) {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const state = location.state as ResourceLocationState | null;

  const stateContext = useMemo<ResourceContext | null>(() => {
    if (
      !resourceId ||
      !state?.resource ||
      !state.room ||
      state.resource.id !== resourceId ||
      !state.floorId ||
      !state.floorNumber
    ) {
      return null;
    }

    return {
      resource: state.resource,
      room: state.room,
      floorId: state.floorId,
      floorNumber: state.floorNumber,
      dormitoryName: state.dormitoryName ?? 'Campus Life',
    };
  }, [resourceId, state]);

  const floorsQuery = useQuery({
    queryKey: ['resource-page-floors', user?.dormitory_id],
    queryFn: () => getFloors(user!.dormitory_id!),
    enabled: !!resourceId && !stateContext && !!user?.dormitory_id,
  });

  const contextQuery = useQuery({
    queryKey: ['resource-context', user?.dormitory_id, resourceId],
    queryFn: async () => {
      const floors = floorsQuery.data ?? [];
      const maps = await Promise.all(
        floors.map((floor) => getFloorMapData(floor.id))
      );
      for (const mapData of maps) {
        for (const room of mapData.rooms) {
          const resource = room.resources.find(
            (item) => item.id === resourceId
          );
          if (resource) {
            return {
              resource,
              room,
              floorId: mapData.id,
              floorNumber: mapData.number,
              dormitoryName: mapData.dormitory_name,
            };
          }
        }
      }
      throw new Error('Ресурс не знайдено');
    },
    enabled: !!resourceId && !stateContext && !!floorsQuery.data,
  });

  return {
    context: stateContext ?? contextQuery.data ?? null,
    isLoading:
      !stateContext && (floorsQuery.isLoading || contextQuery.isLoading),
    isError: floorsQuery.isError || contextQuery.isError,
  };
}

function buildBookingDraft(params: URLSearchParams): BookingDraft | null {
  const day = params.get('bookingDate');
  const start = params.get('start');
  const end = params.get('end');
  const lane = Number(params.get('lane') ?? '1');
  if (!day || !start || !end) return null;
  return { day, start, end, lane: Number.isFinite(lane) ? lane : 1 };
}

export default function ResourceBookingPage() {
  const { resourceId } = useParams();
  const numericResourceId = Number(resourceId);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const dayRefs = useRef<Record<string, HTMLElement | null>>({});
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const [localBlocked, setLocalBlocked] = useState<boolean | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const resourceContext = useResourceContext(
    Number.isFinite(numericResourceId) ? numericResourceId : null
  );
  const context = resourceContext.context;
  const resource = context?.resource;
  const isResourceBlocked = localBlocked ?? resource?.is_blocked ?? false;

  const now = new Date();
  const today = useMemo(() => startOfLocalDay(new Date()), []);
  const days = useMemo(
    () =>
      Array.from({ length: DAYS_AHEAD }, (_, index) => addDays(today, index)),
    [today]
  );

  const scheduleQuery = useQuery({
    queryKey: ['resource-schedule', numericResourceId],
    queryFn: () => getResourceSchedule(numericResourceId),
    enabled: !!context && Number.isFinite(numericResourceId),
    refetchInterval: 60 * 1000,
  });

  const myBookingsQuery = useQuery({
    queryKey: ['bookings-me'],
    queryFn: getMyBookings,
    enabled: !!context,
  });

  const myBookingsById = useMemo(() => {
    const map = new Map<number, Booking>();
    for (const booking of myBookingsQuery.data ?? []) {
      if (booking.resource_id === numericResourceId)
        map.set(booking.id, booking);
    }
    return map;
  }, [myBookingsQuery.data, numericResourceId]);

  const bookings = useMemo(() => {
    const activeSchedule =
      scheduleQuery.data?.filter((booking) => booking.status === 'ACTIVE') ??
      [];
    const scheduled = activeSchedule.map((booking) =>
      mapScheduleBooking(booking, myBookingsById.get(booking.booking_id))
    );

    for (const booking of myBookingsById.values()) {
      if (booking.status !== 'ACTIVE') continue;
      if (scheduled.some((item) => item.id === booking.id)) continue;
      scheduled.push({
        id: booking.id,
        start: new Date(booking.start_time),
        end: new Date(booking.end_time),
        status: booking.status,
        user: booking.user,
        lane: 0,
        source: booking,
      });
    }

    return assignLanes(scheduled, resource?.max_person ?? 1);
  }, [myBookingsById, resource?.max_person, scheduleQuery.data]);

  const bookingsByDay = useMemo(() => {
    const grouped = new Map<string, TimelineBooking[]>();
    for (const booking of bookings) {
      const key = toDateKey(booking.start);
      grouped.set(key, [...(grouped.get(key) ?? []), booking]);
    }
    return grouped;
  }, [bookings]);

  const bookingDraft = buildBookingDraft(searchParams);
  const selectedBookingId = Number(searchParams.get('bookingId'));
  const selectedBooking = Number.isFinite(selectedBookingId)
    ? (bookings.find((booking) => booking.id === selectedBookingId) ?? null)
    : null;

  const createMutation = useMutation({
    mutationFn: createBooking,
    onSuccess: async () => {
      closeModal();
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['resource-schedule', numericResourceId],
        }),
        queryClient.invalidateQueries({ queryKey: ['bookings-me'] }),
      ]);
    },
    onError: (error) => setFormError(normalizeError(error)),
  });

  const cancelMutation = useMutation({
    mutationFn: cancelBooking,
    onSuccess: async () => {
      closeModal();
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['resource-schedule', numericResourceId],
        }),
        queryClient.invalidateQueries({ queryKey: ['bookings-me'] }),
      ]);
    },
  });

  const blockMutation = useMutation({
    mutationFn: async (blocked: boolean) => {
      if (blocked) {
        await blockResource(numericResourceId);
        return true;
      }
      await unblockResource(numericResourceId);
      return false;
    },
    onSuccess: async (blocked) => {
      setLocalBlocked(blocked);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['resource-schedule', numericResourceId],
        }),
        queryClient.invalidateQueries({ queryKey: ['bookings-me'] }),
      ]);
    },
  });

  function closeModal() {
    setFormError(null);
    setSearchParams({}, { replace: true });
  }

  function openDraft(day: Date, lane: number, minute: number) {
    if (isResourceBlocked) return;
    const rounded = roundSlotMinute(minute);
    const start = new Date(day);
    start.setMinutes(rounded);
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + SLOT_MINUTES);
    setFormError(null);
    setSearchParams({
      bookingDate: toDateKey(day),
      start: toTimeValue(start),
      end: toTimeValue(end),
      lane: String(lane + 1),
    });
  }

  function openBooking(bookingId: number) {
    setFormError(null);
    setSearchParams({ bookingId: String(bookingId) });
  }

  function scrollToDay(day: Date) {
    dayRefs.current[toDateKey(day)]?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }

  function canCancel(booking: TimelineBooking): boolean {
    if (!user) return false;
    if (booking.user?.id === user.id) return true;
    if (isAdmin(user.role)) return true;
    return Boolean(
      isModerator(user.role) &&
      context?.floorId &&
      String(context.floorId) === String(user.floor_id)
    );
  }

  async function handleCancel(booking: TimelineBooking) {
    const name = booking.user?.display_name ?? 'користувача';
    if (
      !window.confirm(`Ви впевнені, що хочете скасувати бронювання ${name}?`)
    ) {
      return;
    }
    await cancelMutation.mutateAsync(booking.id);
  }

  async function handleCreate(draft: BookingDraft) {
    if (!resource) return;
    const start = parseLocalDateTime(draft.day, draft.start);
    const end = parseLocalDateTime(draft.day, draft.end);
    const error = validateDraft(draft, bookings);
    if (error) {
      setFormError(error);
      return;
    }
    await createMutation.mutateAsync({
      resource: resource.id,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
    });
  }

  function validateDraft(
    draft: BookingDraft | null,
    existingBookings: TimelineBooking[]
  ): string | null {
    if (!draft) return null;
    const start = parseLocalDateTime(draft.day, draft.start);
    const end = parseLocalDateTime(draft.day, draft.end);
    if (start <= new Date()) {
      return 'Не можна створити бронювання в минулому.';
    }
    if (end <= start) return 'Час завершення має бути пізніше часу початку.';
    if (minutesBetween(start, end) > MAX_BOOKING_MINUTES) {
      return 'Бронювання не може тривати довше 3 годин.';
    }
    const lane = draft.lane - 1;
    const hasOverlap = existingBookings.some(
      (booking) =>
        booking.lane === lane &&
        overlaps(start, end, booking.start, booking.end)
    );
    return hasOverlap
      ? 'Обраний час перетинається з існуючим бронюванням у цьому місці.'
      : null;
  }

  const draftValidationError = validateDraft(bookingDraft, bookings);

  if (!Number.isFinite(numericResourceId)) {
    return <ResourcePageMessage title="Некоректний ресурс" />;
  }

  if (resourceContext.isLoading) {
    return <ResourcePageMessage title="Завантажуємо ресурс…" />;
  }

  if (resourceContext.isError || !context || !resource) {
    return (
      <ResourcePageMessage
        title="Ресурс не знайдено"
        action={<Link to="/map">Повернутися до мапи</Link>}
      />
    );
  }

  return (
    <div className="flex h-screen flex-col bg-gray-50 text-gray-900">
      <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className={
            'rounded-md border border-gray-200 px-3 py-1.5 text-sm ' +
            'font-medium text-gray-700 transition hover:bg-gray-50'
          }
        >
          Назад
        </button>
        {user && <ProfileMenu user={user} onLogout={logout} />}
      </header>

      <main className="flex min-h-0 flex-1 flex-col">
        <section className="border-b border-gray-200 bg-white px-6 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <div
                className={
                  'mt-1 flex h-12 w-12 shrink-0 items-center justify-center ' +
                  'rounded-lg border border-gray-200 bg-gray-50'
                }
              >
                <ResourceTypeIcon resource={resource} size={28} />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-semibold tracking-normal text-gray-950">
                  {resource.name}
                </h1>
                <p className="mt-1 text-sm text-gray-500">
                  {context.room.name} • {context.floorNumber} поверх
                </p>
                <p className="mt-2 text-xs text-gray-400">
                  {context.dormitoryName} · до {resource.max_person} паралельних
                  місць
                </p>
              </div>
            </div>

            {isAdmin(user?.role) && (
              <label
                className={
                  'flex items-center gap-3 rounded-lg border border-red-200 ' +
                  'bg-red-50 px-3 py-2 shadow-sm'
                }
              >
                <span className="text-sm font-semibold text-red-800">
                  Заблокувати ресурс
                </span>
                <input
                  type="checkbox"
                  checked={isResourceBlocked}
                  disabled={blockMutation.isPending}
                  onChange={(event) =>
                    blockMutation.mutate(event.target.checked)
                  }
                  className="h-5 w-5 accent-red-600"
                />
              </label>
            )}
          </div>
        </section>

        <section className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 px-6 py-3 backdrop-blur">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {days.map((day) => (
              <button
                type="button"
                key={toDateKey(day)}
                onClick={() => scrollToDay(day)}
                className={
                  'min-w-28 rounded-md border border-gray-200 bg-white px-3 py-2 ' +
                  'text-left text-sm transition hover:border-blue-300 hover:bg-blue-50'
                }
              >
                <span className="block font-medium text-gray-800">
                  {formatDayLabel(day)}
                </span>
                <span className="text-xs text-gray-400">{toDateKey(day)}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="relative min-h-0 flex-1 overflow-hidden">
          {isResourceBlocked && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-red-50/80 backdrop-blur-[1px]">
              <div className="rounded-lg border border-red-200 bg-white px-6 py-4 text-center shadow-lg">
                <p className="text-base font-semibold text-red-800">
                  Ресурс тимчасово недоступний
                </p>
                <p className="mt-1 text-sm text-red-500">
                  Створення нових бронювань вимкнено.
                </p>
              </div>
            </div>
          )}

          <div ref={scrollRef} className="h-full overflow-auto">
            <div className="min-w-[760px]">
              {days.map((day) => (
                <TimelineDay
                  key={toDateKey(day)}
                  day={day}
                  capacity={resource.max_person}
                  bookings={bookingsByDay.get(toDateKey(day)) ?? []}
                  disabled={isResourceBlocked}
                  visibleStartMinute={
                    toDateKey(day) === toDateKey(today)
                      ? ceilSlotMinute(minutesFromStart(now))
                      : 0
                  }
                  setDayElement={(element) => {
                    dayRefs.current[toDateKey(day)] = element;
                  }}
                  onEmptyClick={openDraft}
                  onBookingClick={openBooking}
                  onCancel={handleCancel}
                  canCancel={canCancel}
                />
              ))}
            </div>
          </div>
        </section>
      </main>

      {(bookingDraft || selectedBooking) && (
        <BookingModal
          resource={resource}
          draft={bookingDraft}
          selectedBooking={selectedBooking}
          validationError={draftValidationError ?? formError}
          isSubmitting={createMutation.isPending}
          isCancelling={cancelMutation.isPending}
          canCancel={selectedBooking ? canCancel(selectedBooking) : false}
          onChangeDraft={(draft) => {
            setFormError(null);
            setSearchParams({
              bookingDate: draft.day,
              start: draft.start,
              end: draft.end,
              lane: String(draft.lane),
            });
          }}
          onSubmitDraft={handleCreate}
          onCancelBooking={
            selectedBooking ? () => handleCancel(selectedBooking) : undefined
          }
          onClose={closeModal}
        />
      )}
    </div>
  );
}

function ResourcePageMessage({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="rounded-lg border border-gray-200 bg-white p-6 text-center shadow-sm">
        <p className="text-sm font-medium text-gray-700">{title}</p>
        {action && <div className="mt-4 text-sm text-blue-600">{action}</div>}
      </div>
    </div>
  );
}

function TimelineDay({
  day,
  capacity,
  bookings,
  disabled,
  visibleStartMinute,
  setDayElement,
  onEmptyClick,
  onBookingClick,
  onCancel,
  canCancel,
}: {
  day: Date;
  capacity: number;
  bookings: TimelineBooking[];
  disabled: boolean;
  visibleStartMinute: number;
  setDayElement: (element: HTMLElement | null) => void;
  onEmptyClick: (day: Date, lane: number, minute: number) => void;
  onBookingClick: (bookingId: number) => void;
  onCancel: (booking: TimelineBooking) => void;
  canCancel: (booking: TimelineBooking) => boolean;
}) {
  const [hoveredSlot, setHoveredSlot] = useState<{
    lane: number;
    minute: number;
  } | null>(null);
  const laneCount = Math.max(1, capacity);
  const hours = Array.from({ length: 24 }, (_, hour) => hour).filter(
    (hour) => hour * 60 >= visibleStartMinute
  );
  const visibleStart = minuteToDate(day, visibleStartMinute);
  const visibleEnd = addDays(startOfLocalDay(day), 1);
  const visibleHeight = Math.max(
    SLOT_MINUTES * PX_PER_MINUTE,
    (MINUTES_IN_DAY - visibleStartMinute) * PX_PER_MINUTE
  );
  const visibleBookings = bookings.filter(
    (booking) => booking.end > visibleStart && booking.start < visibleEnd
  );
  const hasAvailableTime = visibleStartMinute < MINUTES_IN_DAY;

  return (
    <section ref={setDayElement} className="border-b border-gray-200 bg-white">
      <div
        className={
          'sticky top-0 z-10 grid grid-cols-[72px_1fr] border-b ' +
          'border-gray-200 bg-gray-50/95 backdrop-blur'
        }
      >
        <div className="px-3 py-2 text-xs font-medium text-gray-500">
          {formatLongDay(day)}
        </div>
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${laneCount}, minmax(160px, 1fr))`,
          }}
        >
          {Array.from({ length: laneCount }, (_, lane) => (
            <div
              key={lane}
              className="border-l border-gray-200 px-3 py-2 text-xs font-medium text-gray-500"
            >
              Місце {lane + 1}
            </div>
          ))}
        </div>
      </div>

      {!hasAvailableTime && (
        <div className="border-t border-gray-100 px-6 py-8 text-sm text-gray-500">
          Сьогодні вже немає доступного часу для нового бронювання.
        </div>
      )}

      {hasAvailableTime && (
        <div
          className="grid grid-cols-[72px_1fr]"
          style={{ height: visibleHeight }}
        >
          <div className="relative border-r border-gray-200 bg-gray-50">
            {visibleStartMinute > 0 && (
              <div className="absolute top-1 right-3 text-xs font-semibold text-blue-600">
                зараз
              </div>
            )}
            {hours.map((hour) => (
              <div
                key={hour}
                className="absolute right-3 text-xs text-gray-400"
                style={{
                  top: (hour * 60 - visibleStartMinute) * PX_PER_MINUTE - 7,
                }}
              >
                {String(hour).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          <div
            className="relative grid"
            style={{
              gridTemplateColumns: `repeat(${laneCount}, minmax(160px, 1fr))`,
            }}
          >
            {Array.from({ length: laneCount }, (_, lane) => (
              <button
                type="button"
                key={lane}
                disabled={disabled}
                onClick={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  const y = event.clientY - rect.top;
                  onEmptyClick(
                    day,
                    lane,
                    visibleStartMinute + y / PX_PER_MINUTE
                  );
                }}
                onMouseMove={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  const y = event.clientY - rect.top;
                  setHoveredSlot({
                    lane,
                    minute: roundSlotMinute(
                      visibleStartMinute + y / PX_PER_MINUTE
                    ),
                  });
                }}
                onMouseLeave={() => {
                  setHoveredSlot((slot) => (slot?.lane === lane ? null : slot));
                }}
                className={
                  'relative border-l border-gray-200 text-left transition ' +
                  'hover:bg-blue-50/50 disabled:cursor-not-allowed disabled:hover:bg-transparent'
                }
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(to bottom, transparent 0, transparent 29px, rgba(209,213,219,.75) 30px)',
                }}
                aria-label={`Створити бронювання, місце ${lane + 1}`}
              />
            ))}

            {hoveredSlot && !disabled && (
              <div
                className={
                  'pointer-events-none absolute z-10 rounded-md border-2 ' +
                  'border-blue-500 bg-blue-100/70 shadow-sm'
                }
                style={{
                  top:
                    (hoveredSlot.minute - visibleStartMinute) * PX_PER_MINUTE,
                  height: SLOT_MINUTES * PX_PER_MINUTE,
                  left: `${(hoveredSlot.lane / laneCount) * 100}%`,
                  width: `${100 / laneCount}%`,
                }}
              >
                <span className="absolute top-1 left-2 text-[11px] font-semibold text-blue-800">
                  {formatTimeRange(
                    minuteToDate(day, hoveredSlot.minute),
                    minuteToDate(day, hoveredSlot.minute + SLOT_MINUTES)
                  )}
                </span>
              </div>
            )}

            {visibleBookings.map((booking) => (
              <BookingBlock
                key={booking.id}
                booking={booking}
                day={day}
                laneCount={laneCount}
                visibleStartMinute={visibleStartMinute}
                onOpen={() => onBookingClick(booking.id)}
                onCancel={() => onCancel(booking)}
                canCancel={canCancel(booking)}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function BookingBlock({
  booking,
  day,
  laneCount,
  visibleStartMinute,
  canCancel,
  onOpen,
  onCancel,
}: {
  booking: TimelineBooking;
  day: Date;
  laneCount: number;
  visibleStartMinute: number;
  canCancel: boolean;
  onOpen: () => void;
  onCancel: () => void;
}) {
  const user = useAuthStore((state) => state.user);
  const isOwn = booking.user?.id === user?.id;
  const visibleStart = minuteToDate(day, visibleStartMinute);
  const visibleEnd = addDays(startOfLocalDay(day), 1);
  const displayStart =
    booking.start > visibleStart ? booking.start : visibleStart;
  const displayEnd = booking.end < visibleEnd ? booking.end : visibleEnd;
  const top = minutesBetween(visibleStart, displayStart) * PX_PER_MINUTE;
  const height = Math.max(
    22,
    minutesBetween(displayStart, displayEnd) * PX_PER_MINUTE
  );
  const left = `${(booking.lane / laneCount) * 100}%`;
  const width = `${100 / laneCount}%`;
  const displayName = booking.user?.display_name ?? 'Зайнято';

  return (
    <div
      className="absolute px-1"
      style={{ top, height, left, width }}
      title={`${displayName}, ${formatTimeRange(booking.start, booking.end)}`}
    >
      <div
        className={
          'group flex h-full min-h-0 items-center gap-2 overflow-hidden rounded-md border px-2 py-1 shadow-sm ' +
          (isOwn
            ? 'border-blue-300 bg-blue-100 text-blue-950'
            : 'border-gray-300 bg-gray-100 text-gray-800')
        }
      >
        <button
          type="button"
          onClick={onOpen}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <UserAvatar
            name={displayName}
            photo={booking.user?.photo ?? null}
            size={24}
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-semibold">
              {displayName}
            </span>
            <span className="block truncate text-[11px] text-gray-500">
              {formatTimeRange(booking.start, booking.end)}
            </span>
          </span>
        </button>
        {booking.user?.id && (
          <Link
            to={`/users/${booking.user.id}`}
            className={
              'hidden shrink-0 rounded px-1.5 py-1 text-[11px] font-medium ' +
              'text-gray-600 group-hover:block hover:bg-white/70'
            }
          >
            Профіль
          </Link>
        )}
        {canCancel && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onCancel();
            }}
            className={
              'hidden shrink-0 rounded px-1.5 py-1 text-[11px] font-medium ' +
              'text-red-700 group-hover:block hover:bg-red-50'
            }
          >
            Скасувати
          </button>
        )}
      </div>
    </div>
  );
}

function BookingModal({
  resource,
  draft,
  selectedBooking,
  validationError,
  isSubmitting,
  isCancelling,
  canCancel,
  onChangeDraft,
  onSubmitDraft,
  onCancelBooking,
  onClose,
}: {
  resource: ResourceOnMap;
  draft: BookingDraft | null;
  selectedBooking: TimelineBooking | null;
  validationError: string | null;
  isSubmitting: boolean;
  isCancelling: boolean;
  canCancel: boolean;
  onChangeDraft: (draft: BookingDraft) => void;
  onSubmitDraft: (draft: BookingDraft) => void;
  onCancelBooking?: () => void;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg bg-white p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-950">
              {selectedBooking ? 'Деталі бронювання' : 'Нове бронювання'}
            </h2>
            <p className="mt-1 text-sm text-gray-500">{resource.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрити"
            className={
              'flex h-8 w-8 items-center justify-center rounded-full ' +
              'text-gray-400 hover:bg-gray-100 hover:text-gray-700'
            }
          >
            ×
          </button>
        </div>

        {draft && (
          <div className="mt-5 space-y-4">
            <div className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-600">
              {draft.day} · місце {draft.lane}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm font-medium text-gray-700">
                Початок
                <input
                  type="time"
                  value={draft.start}
                  onChange={(event) =>
                    onChangeDraft({ ...draft, start: event.target.value })
                  }
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm font-medium text-gray-700">
                Кінець
                <input
                  type="time"
                  value={draft.end}
                  onChange={(event) =>
                    onChangeDraft({ ...draft, end: event.target.value })
                  }
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
            </div>
            {validationError && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {validationError}
              </p>
            )}
            <div className="flex justify-end gap-2">
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
                disabled={Boolean(validationError) || isSubmitting}
                onClick={() => onSubmitDraft(draft)}
                className={
                  'rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold ' +
                  'text-white hover:bg-blue-700 disabled:cursor-not-allowed ' +
                  'disabled:bg-gray-300'
                }
              >
                Забронювати
              </button>
            </div>
          </div>
        )}

        {selectedBooking && (
          <div className="mt-5 space-y-4">
            <div className="flex items-center gap-3 rounded-md bg-gray-50 p-3">
              <UserAvatar
                name={selectedBooking.user?.display_name ?? 'Зайнято'}
                photo={selectedBooking.user?.photo ?? null}
                size={36}
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-900">
                  {selectedBooking.user?.display_name ?? 'Зайнято'}
                </p>
                <p className="text-sm text-gray-500">
                  {formatTimeRange(selectedBooking.start, selectedBooking.end)}
                </p>
              </div>
            </div>
            <div className="flex justify-between gap-2">
              {selectedBooking.user?.id ? (
                <Link
                  to={`/users/${selectedBooking.user.id}`}
                  className={
                    'rounded-md border border-gray-200 px-4 py-2 text-sm ' +
                    'font-medium text-gray-700 hover:bg-gray-50'
                  }
                >
                  Перейти в профіль
                </Link>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className={
                    'rounded-md border border-gray-200 px-4 py-2 text-sm ' +
                    'font-medium text-gray-700 hover:bg-gray-50'
                  }
                >
                  Закрити
                </button>
                {canCancel && (
                  <button
                    type="button"
                    disabled={isCancelling}
                    onClick={onCancelBooking}
                    className={
                      'rounded-md bg-red-600 px-4 py-2 text-sm font-semibold ' +
                      'text-white hover:bg-red-700 disabled:bg-gray-300'
                    }
                  >
                    Скасувати бронь
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
