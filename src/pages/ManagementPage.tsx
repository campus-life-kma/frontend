import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Users, BarChart2, Download, Search, Settings } from 'lucide-react';
import AppHeader from '../components/AppHeader';
import DormitoryTab from '../components/DormitoryTab';
import { getStatisticsSummary } from '../api/statistics';
import { getAnnouncementRecipients } from '../api/announcements';
import { useAuthStore } from '../store/authStore';
import UserAvatar from '../components/UserAvatar';
import { getAllFloors } from '../api/locations';
import { Filter } from 'lucide-react';
import type {
  FloorActivityStatistics,
  StatisticsSummary,
  TopResourceStatistics,
} from '../types/statistics';

/**
 * Перекладає системну роль користувача на українську мову.
 */
function formatRole(role: string | null): string {
  const labels: Record<string, string> = {
    ADMIN: 'Адміністратор',
    MODERATOR: 'Модератор поверху',
    RESIDENT: 'Мешканець',
  };
  return role ? (labels[role] ?? role) : 'Роль не вказана';
}

/**
 * Будує заголовок для поточної області статистики
 * (наприклад, "5 поверх" або назва гуртожитку).
 */
function scopeTitle(data: StatisticsSummary): string {
  if (data.scope.type === 'FLOOR') {
    return `${data.scope.floor_number} поверх`;
  }
  return data.scope.dormitory_name ?? 'Гуртожиток';
}

/**
 * Обчислює відсоток частини від цілого, повертаючи ціле число.
 */
function percentage(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

// ==========================================
// Directory Tab
// ==========================================
function DirectoryTab() {
  const user = useAuthStore((state) => state.user);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [positionFilter, setPositionFilter] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [floorFilter, setFloorFilter] = useState<string>('');

  const { data: floors = [] } = useQuery({
    queryKey: ['floors'],
    queryFn: () => getAllFloors(),
    enabled: user?.role === 'ADMIN',
  });

  const { data: users = [], isLoading } = useQuery({
    queryKey: [
      'management-users',
      search,
      roleFilter,
      positionFilter,
      activeFilter,
      floorFilter,
    ],
    queryFn: () =>
      getAnnouncementRecipients({
        q: search,
        role: roleFilter || undefined,
        position: positionFilter || undefined,
        is_active: activeFilter === 'all' ? 'all' : activeFilter,
        floor_id: floorFilter || undefined,
      }),
  });

  const exportToCsv = () => {
    if (users.length === 0) return;
    const headers = [
      'ПІБ',
      'Email',
      'Роль',
      'Кімната',
      'Поверх',
      'Факультет',
      'Спеціальність',
      'Посада',
      'Активований',
    ];
    const rows = users.map((u) =>
      [
        u.display_name,
        u.email,
        u.role_name || '',
        u.room_name || '',
        u.floor_number?.toString() || '',
        u.faculty_name || '',
        u.major_name || '',
        u.position === 'TEACHER'
          ? 'Викладач'
          : u.position === 'EMPLOYEE'
            ? 'Співробітник'
            : 'Студент',
        u.is_activated ? 'Так' : 'Ні',
      ]
        .map((v) => '"' + v + '"')
        .join(',')
    );

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], {
      type: 'text/csv;charset=utf-8;',
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'directory.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Пошук мешканців..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={[
                'w-full rounded-md border border-gray-300 py-2 pr-4 pl-9',
                'text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none',
              ].join(' ')}
            />
          </div>
          <button
            onClick={exportToCsv}
            className={[
              'flex items-center gap-2 rounded-md bg-emerald-50 px-4 py-2 text-sm',
              'font-medium text-emerald-700 transition-colors hover:bg-emerald-100',
            ].join(' ')}
          >
            <Download className="h-4 w-4" />
            Експорт у CSV
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 pt-3">
          <Filter className="hidden h-4 w-4 shrink-0 text-gray-400 sm:block" />

          <select
            className={[
              'rounded-md border border-gray-300 bg-white py-1.5 pr-8 pl-3',
              'text-sm focus:border-blue-500 focus:ring-blue-500',
            ].join(' ')}
            value={positionFilter}
            onChange={(e) => setPositionFilter(e.target.value)}
          >
            <option value="">Всі посади</option>
            <option value="STUDENT">Студент</option>
            <option value="TEACHER">Викладач</option>
            <option value="EMPLOYEE">Співробітник</option>
          </select>

          <select
            className={[
              'rounded-md border border-gray-300 bg-white py-1.5 pr-8 pl-3',
              'text-sm focus:border-blue-500 focus:ring-blue-500',
            ].join(' ')}
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
          >
            <option value="all">Всі статуси</option>
            <option value="true">Активовані</option>
            <option value="false">Не активовані</option>
          </select>

          {user?.role === 'ADMIN' && (
            <>
              <select
                className={[
                  'rounded-md border border-gray-300 bg-white py-1.5 pr-8 pl-3',
                  'text-sm focus:border-blue-500 focus:ring-blue-500',
                ].join(' ')}
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="">Всі ролі</option>
                <option value="ADMIN">Адміністратор</option>
                <option value="MODERATOR">Модератор</option>
                <option value="RESIDENT">Мешканець</option>
              </select>

              <select
                className={[
                  'rounded-md border border-gray-300 bg-white py-1.5 pr-8 pl-3',
                  'text-sm focus:border-blue-500 focus:ring-blue-500',
                ].join(' ')}
                value={floorFilter}
                onChange={(e) => setFloorFilter(e.target.value)}
              >
                <option value="">Всі поверхи</option>
                {floors.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.number} поверх
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  Користувач
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  Роль
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  Кімната
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  Факультет
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase">
                  Дії
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {isLoading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-10 text-center text-sm text-gray-500"
                  >
                    Завантаження...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-10 text-center text-sm text-gray-500"
                  >
                    Користувачів не знайдено
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="transition-colors hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <UserAvatar
                          photo={u.photo}
                          name={u.display_name}
                          size={32}
                        />
                        <div>
                          <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                            {u.display_name}
                            {!u.is_activated && (
                              <span
                                className={[
                                  'rounded bg-gray-100 px-1.5 py-0.5 text-[10px]',
                                  'font-medium text-gray-600',
                                ].join(' ')}
                              >
                                НЕАКТИВНИЙ
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col items-start gap-1">
                        <span
                          className={[
                            'inline-flex w-fit rounded-full bg-blue-100 px-2',
                            'text-xs leading-5 font-semibold text-blue-800',
                          ].join(' ')}
                        >
                          {formatRole(u.role_name)}
                        </span>
                        {u.position !== 'STUDENT' && (
                          <span className="ml-1 text-xs text-gray-500">
                            {u.position === 'TEACHER'
                              ? 'Викладач'
                              : 'Співробітник'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
                      {u.room_name
                        ? `${u.room_name} (${u.floor_number} пов.)`
                        : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
                      {u.faculty_name || '-'}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium whitespace-nowrap">
                      <Link
                        to={`/profile/${u.id}`}
                        className="inline-block p-1 text-gray-400 transition-colors hover:text-blue-600"
                        title="Переглянути профіль"
                      >
                        <Settings className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatisticsTab({ data }: { data: StatisticsSummary }) {
  const residentActivation = percentage(
    data.residents.activated,
    data.residents.total
  );
  const blockedResources = percentage(
    data.resources.blocked,
    data.resources.total
  );
  const fullRooms = percentage(data.rooms.full, data.rooms.living);

  const mainMetrics = [
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

  return (
    <div className="flex flex-col gap-5">
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
              ['Скасовані загалом', data.bookings.cancelled],
              ['Скасували мешканці', data.bookings.cancelled_by_residents],
              ['Скасували модератори', data.bookings.cancelled_by_moderators],
              ['Скасували адміністратори', data.bookings.cancelled_by_admins],
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
              ['Активні запити на шеринг', data.social.active_sharing_requests],
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

      {/* Moderator Actions for Admins */}
      {data.moderator_actions && data.moderator_actions.length > 0 && (
        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-gray-950">
            Ефективність модераторів (Блокування)
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">
                    Модератор
                  </th>
                  <th className="px-4 py-2 text-right font-medium text-gray-500">
                    Заблоковано Івентів
                  </th>
                  <th className="px-4 py-2 text-right font-medium text-gray-500">
                    Заблоковано Шерингів
                  </th>
                  <th className="px-4 py-2 text-right font-medium text-gray-500">
                    Заблоковано Бронювань
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.moderator_actions.map((mod) => (
                  <tr key={mod.moderator_id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-900">
                      {mod.moderator_name}
                    </td>
                    <td className="px-4 py-2 text-right font-semibold text-red-600">
                      {mod.cancelled_events}
                    </td>
                    <td className="px-4 py-2 text-right font-semibold text-orange-600">
                      {mod.cancelled_sharings}
                    </td>
                    <td className="px-4 py-2 text-right font-semibold text-pink-600">
                      {mod.cancelled_bookings}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel title="Активність по поверхах">
          <FloorActivityList items={data.social.floor_activity} />
        </Panel>

        <Panel title="Популярні ресурси">
          <TopResourcesList items={data.bookings.top_resources} />
        </Panel>
      </section>
    </div>
  );
}

// ==========================================
// Main Page Component
// ==========================================
export default function ManagementPage() {
  const user = useAuthStore((state) => state.user);
  const canSeeStatistics = user?.role === 'ADMIN' || user?.role === 'MODERATOR';
  const [searchParams] = useSearchParams();
  const mapFloorId = searchParams.get('mapFloorId');
  const [activeTab, setActiveTab] = useState<
    'directory' | 'statistics' | 'dormitory'
  >('directory');

  const mapPath = mapFloorId ? `/?floorId=${mapFloorId}` : '/';
  const feedPath = mapFloorId ? `/feed?mapFloorId=${mapFloorId}` : '/feed';
  const statisticsPath = mapFloorId
    ? `/management?mapFloorId=${mapFloorId}`
    : '/management';

  const statisticsQuery = useQuery({
    queryKey: ['statistics-summary'],
    queryFn: getStatisticsSummary,
    enabled: canSeeStatistics,
  });

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <AppHeader
        active="management"
        mapPath={mapPath}
        feedPath={feedPath}
        statisticsPath={statisticsPath}
      />

      <main className="mx-auto flex max-w-[95rem] flex-col gap-5 px-4 py-5 sm:px-6">
        {!canSeeStatistics && (
          <StatePanel
            title="Доступ заборонено"
            text="Цей розділ відкритий лише для адміністраторів і модераторів."
          />
        )}

        {canSeeStatistics && (
          <>
            {/* Tabs Navigation */}
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setActiveTab('directory')}
                className={`flex items-center gap-2 border-b-2 px-6 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'directory'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                <Users className="h-4 w-4" />
                Мешканці
              </button>

              <button
                onClick={() => setActiveTab('dormitory')}
                className={`flex items-center gap-2 border-b-2 px-6 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'dormitory'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                Гуртожиток
              </button>
              <button
                onClick={() => setActiveTab('statistics')}
                className={`flex items-center gap-2 border-b-2 px-6 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'statistics'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                <BarChart2 className="h-4 w-4" />
                Статистика
              </button>
            </div>

            {/* Tab Content */}
            <div className="mt-2">
              {activeTab === 'directory' && <DirectoryTab />}

              {activeTab === 'dormitory' && user?.dormitory_id && (
                <DormitoryTab dormitoryId={Number(user.dormitory_id)} />
              )}

              {activeTab === 'statistics' && (
                <>
                  {statisticsQuery.isLoading && (
                    <StatePanel title="Завантажуємо статистику…" />
                  )}
                  {statisticsQuery.isError && (
                    <StatePanel
                      title="Не вдалося завантажити статистику"
                      text="Оновіть сторінку або спробуйте ще раз пізніше."
                    />
                  )}
                  {statisticsQuery.data && (
                    <StatisticsTab data={statisticsQuery.data} />
                  )}
                </>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

// ==========================================
// Helper Components
// ==========================================
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
