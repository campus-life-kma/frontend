/** Область дії статистичної вибірки (гуртожиток чи конкретний поверх). */
export interface StatisticsScope {
  type: 'DORMITORY' | 'FLOOR';
  dormitory_name: string | null;
  floor_id: number | null;
  floor_number: number | null;
  role: string | null;
}

/** Статистика мешканців. */
export interface ResidentsStatistics {
  total: number;
  activated: number;
  not_activated: number;
  moderators: number;
}

/** Статистика кімнат. */
export interface RoomsStatistics {
  total: number;
  living: number;
  blocked: number;
  full: number;
}

/** Статистика загальних ресурсів. */
export interface ResourcesStatistics {
  total: number;
  blocked: number;
}

/** Статистика найпопулярнішого ресурсу за кількістю бронювань. */
export interface TopResourceStatistics {
  resource_id: number;
  resource_name: string;
  room_name: string;
  floor_number: number;
  bookings_count: number;
}

/** Статистика бронювань. */
export interface BookingsStatistics {
  active: number;
  today: number;
  cancelled: number;
  cancelled_by_residents: number;
  cancelled_by_moderators: number;
  cancelled_by_admins: number;
  top_resources: TopResourceStatistics[];
}

/** Статистика активності на конкретному поверсі. */
export interface FloorActivityStatistics {
  floor_id: number;
  floor_number: number;
  residents_count: number;
  active_events_count: number;
  active_sharing_requests_count: number;
  active_presence_count: number;
}

/** Статистика соціальної активності. */
export interface SocialStatistics {
  active_events: number;
  cancelled_events: number;
  active_sharing_requests: number;
  completed_sharing_requests: number;
  cancelled_sharing_requests: number;
  floor_activity: FloorActivityStatistics[];
}

/** Статистика оголошень. */
export interface AnnouncementsStatistics {
  active: number;
  pinned: number;
  total: number;
}

/** Статистика поточної присутності користувачів у кімнатах. */
export interface PresenceStatistics {
  active: number;
}

export interface ModeratorAction {
  moderator_id: number;
  moderator_name: string;
  cancelled_events: number;
  cancelled_sharings: number;
  cancelled_bookings: number;
}

export interface StatisticsSummary {
  scope: StatisticsScope;
  residents: ResidentsStatistics;
  rooms: RoomsStatistics;
  resources: ResourcesStatistics;
  bookings: BookingsStatistics;
  social: SocialStatistics;
  announcements: AnnouncementsStatistics;
  presence: PresenceStatistics;
  moderator_actions?: ModeratorAction[];
}
