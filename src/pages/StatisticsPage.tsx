import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import AppHeader from '../components/AppHeader';
import { getStatisticsSummary } from '../api/statistics';
import { useAuthStore } from '../store/authStore';
import type {
  FloorActivityStatistics,
  StatisticsSummary,
  TopResourceStatistics,
} from '../types/statistics';

function formatRole(role: string | null): string {
  const labels: Record<string, string> = {
    ADMIN: 'Адміністратор',
    MODERATOR: 'Модератор поверху',
    RESIDENT: 'Мешканець',
  };
  return role ? (labels[role] ?? role) : 'Роль не вказана';
}

function scopeTitle(data: StatisticsSummary): string {
  if (data.scope.type === 'FLOOR') {
    return `${data.scope.floor_number} поверх`;
  }
  return data.scope.dormitory_name ?? 'Гуртожиток';
}

function percentage(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

export default function StatisticsPage() {
  const user = useAuthStore((state) => state.user);
  const canSeeStatistics = user?.role === 'ADMIN' || user?.role === 'MODERATOR';
  const [searchParams] = useSearchParams();
  const mapFloorId = searchParams.get('mapFloorId');

  const mapPath = mapFloorId ? `/?floorId=${mapFloorId}` : '/';
  const feedPath = mapFloorId ? `/feed?mapFloorId=${mapFloorId}` : '/feed';
  const statisticsPath = mapFloorId ? `/statistics?mapFloorId=${mapFloorId}` : '/statistics';

  const statisticsQuery = useQuery({
    queryKey: ['statistics-summary'],
    queryFn: getStatisticsSummary,
    enabled: canSeeStatistics,
  });

  const data = statisticsQuery.data;
  const residentActivation = data
    ? percentage(data.residents.activated, data.residents.total)
    : 0;
  const blockedResources = data
    ? percentage(data.resources.blocked, data.resources.total)
    : 0;
  const fullRooms = data ? percentage(data.rooms.full, data.rooms.living) : 0;

  const mainMetrics = useMemo(() => {
    if (!data) return [];
    return [
      {
        label: 'Мешканці',
        value: data.residents.activated,
        detail: `${data.residents.not_activated} ще не активували акаунт`,
        tone: 'blue',
      },
      {
        label: 'Бронювання сьогодні',
        value: data.bookings.today,
        detail: `${data.bookings.active} активних загалом`,
        tone: 'emerald',
      },
      {
        label: 'Активні івенти',
        value: data.social.active_events,
        detail: `${data.social.active_sharing_requests} активних запитів на шеринг`,
        tone: 'violet',
      },
      {
        label: 'Присутність',
        value: data.presence.active,
        detail: 'поточні позначки “Я тут”',
        tone: 'amber',
      },
    ];
  }, [data]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <AppHeader
        active="statistics"
        mapPath={mapPath}
        feedPath={feedPath}
        statisticsPath={statisticsPath}
      />

      <main className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6">
        {!canSeeStatistics && (
          <StatePanel
            title="Статистика недоступна"
            text="Цей розділ відкритий лише для адміністраторів і модераторів."
          />
        )}

        {canSeeStatistics && statisticsQuery.isLoading && (
          <StatePanel title="Завантажуємо статистику…" />
        )}

        {canSeeStatistics && statisticsQuery.isError && (
          <StatePanel
            title="Не вдалося завантажити статистику"
            text="Оновіть сторінку або спробуйте ще раз пізніше."
          />
        )}

        {data && (
          <>
            <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold tracking-wide text-blue-700 uppercase">
                    {formatRole(data.scope.role)}
                  </p>
                  <h1 className="mt-1 text-2xl font-semibold text-gray-950">
                    Статистика: {scopeTitle(data)}
                  </h1>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs sm:min-w-96">
                  <RatioCard label="Активація" value={residentActivation} />
                  <RatioCard label="Заповненість" value={fullRooms} />
                  <RatioCard label="Блокування" value={blockedResources} />
                </div>
              </div>
            </section>

            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {mainMetrics.map((metric) => (
                <MetricCard
                  key={metric.label}
                  label={metric.label}
                  value={metric.value}
                  detail={metric.detail}
                  tone={metric.tone}
                />
              ))}
            </section>

            <section className="grid gap-5 lg:grid-cols-[1fr_1fr]">
              <Panel title="Житловий фонд">
                <StatsRows
                  rows={[
                    ['Усі кімнати', data.rooms.total],
                    ['Житлові кімнати', data.rooms.living],
                    ['Заповнені кімнати', data.rooms.full],
                    ['Заблоковані кімнати', data.rooms.blocked],
                    ['Усі ресурси', data.resources.total],
                    ['Заблоковані ресурси', data.resources.blocked],
                  ]}
                />
              </Panel>

              <Panel title="Бронювання">
                <StatsRows
                  rows={[
                    ['Активні', data.bookings.active],
                    ['На сьогодні', data.bookings.today],
                    ['Скасовані', data.bookings.cancelled],
                    [
                      'Скасували мешканці',
                      data.bookings.cancelled_by_residents,
                    ],
                    [
                      'Скасували модератори',
                      data.bookings.cancelled_by_moderators,
                    ],
                    [
                      'Скасували адміністратори',
                      data.bookings.cancelled_by_admins,
                    ],
                  ]}
                />
              </Panel>
            </section>

            <section className="grid gap-5 lg:grid-cols-[1fr_1fr]">
              <Panel title="Соціальна активність">
                <StatsRows
                  rows={[
                    ['Активні івенти', data.social.active_events],
                    ['Скасовані івенти', data.social.cancelled_events],
                    [
                      'Активні запити на шеринг',
                      data.social.active_sharing_requests,
                    ],
                    [
                      'Виконані запити на шеринг',
                      data.social.completed_sharing_requests,
                    ],
                    [
                      'Скасовані запити на шеринг',
                      data.social.cancelled_sharing_requests,
                    ],
                  ]}
                />
              </Panel>

              <Panel title="Оголошення">
                <StatsRows
                  rows={[
                    ['Активні', data.announcements.active],
                    ['Закріплені', data.announcements.pinned],
                    ['Усього', data.announcements.total],
                  ]}
                />
              </Panel>
            </section>

            <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
              <Panel title="Активність по поверхах">
                <FloorActivityList items={data.social.floor_activity} />
              </Panel>

              <Panel title="Популярні ресурси">
                <TopResourcesList items={data.bookings.top_resources} />
              </Panel>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function StatePanel({ title, text }: { title: string; text?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-10 text-center shadow-sm">
      <p className="text-sm font-semibold text-gray-800">{title}</p>
      {text && <p className="mt-2 text-sm text-gray-500">{text}</p>}
    </div>
  );
}

function RatioCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-gray-50 px-2 py-2">
      <p className="text-[11px] font-medium text-gray-500">{label}</p>
      <p className="mt-0.5 text-base font-semibold text-gray-950">{value}%</p>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: number;
  detail: string;
  tone: string;
}) {
  const tones: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    violet: 'bg-violet-50 text-violet-700',
    amber: 'bg-amber-50 text-amber-700',
  };

  return (
    <article className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div
        className={
          'flex h-9 w-9 items-center justify-center rounded-md text-sm ' +
          `font-bold ${tones[tone]}`
        }
      >
        {value}
      </div>
      <h2 className="mt-3 text-sm font-semibold text-gray-950">{label}</h2>
      <p className="mt-1 text-sm text-gray-500">{detail}</p>
    </article>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold text-gray-950">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function StatsRows({ rows }: { rows: Array<[string, number]> }) {
  return (
    <div className="divide-y divide-gray-100">
      {rows.map(([label, value]) => (
        <div
          key={label}
          className="flex items-center justify-between gap-4 py-2"
        >
          <span className="text-sm text-gray-600">{label}</span>
          <span className="text-sm font-semibold text-gray-950">{value}</span>
        </div>
      ))}
    </div>
  );
}

function FloorActivityList({ items }: { items: FloorActivityStatistics[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-gray-500">Даних по поверхах ще немає.</p>;
  }

  const maxValue = Math.max(
    1,
    ...items.map(
      (item) =>
        item.active_events_count +
        item.active_sharing_requests_count +
        item.active_presence_count
    )
  );

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const activity =
          item.active_events_count +
          item.active_sharing_requests_count +
          item.active_presence_count;
        return (
          <div key={item.floor_id} className="rounded-md bg-gray-50 p-3">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold text-gray-900">
                {item.floor_number} поверх
              </span>
              <span className="text-gray-500">
                {item.residents_count} мешканців
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-blue-600"
                style={{
                  width: `${Math.max(6, (activity / maxValue) * 100)}%`,
                }}
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
              <span>Івенти: {item.active_events_count}</span>
              <span>Шеринг: {item.active_sharing_requests_count}</span>
              <span>Присутність: {item.active_presence_count}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TopResourcesList({ items }: { items: TopResourceStatistics[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-gray-500">Бронювань ресурсів ще немає.</p>
    );
  }

  const maxCount = Math.max(1, ...items.map((item) => item.bookings_count));

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.resource_id} className="rounded-md bg-gray-50 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-900">
                {item.resource_name}
              </p>
              <p className="mt-0.5 text-xs text-gray-500">
                {item.room_name} · {item.floor_number} поверх
              </p>
            </div>
            <span className="shrink-0 text-sm font-semibold text-blue-700">
              {item.bookings_count}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-emerald-600"
              style={{
                width: `${Math.max(8, (item.bookings_count / maxCount) * 100)}%`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
