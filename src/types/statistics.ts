export interface StatisticsScope {
  type: 'DORMITORY' | 'FLOOR';
  dormitory_name: string | null;
  floor_id: number | null;
  floor_number: number | null;
  role: string | null;
}

export interface ResidentsStatistics {
  total: number;
  activated: number;
  not_activated: number;
  moderators: number;
}

export interface RoomsStatistics {
  total: number;
  living: number;
  blocked: number;
  full: number;
}

export interface ResourcesStatistics {
  total: number;
  blocked: number;
}

export interface TopResourceStatistics {
  resource_id: number;
  resource_name: string;
  room_name: string;
  floor_number: number;
  bookings_count: number;
}

export interface BookingsStatistics {
  active: number;
  today: number;
  cancelled: number;
  cancelled_by_residents: number;
  cancelled_by_moderators: number;
  cancelled_by_admins: number;
  top_resources: TopResourceStatistics[];
}

export interface FloorActivityStatistics {
  floor_id: number;
  floor_number: number;
  residents_count: number;
  active_events_count: number;
  active_sharing_requests_count: number;
  active_presence_count: number;
}

export interface SocialStatistics {
  active_events: number;
  cancelled_events: number;
  active_sharing_requests: number;
  completed_sharing_requests: number;
  cancelled_sharing_requests: number;
  floor_activity: FloorActivityStatistics[];
}

export interface AnnouncementsStatistics {
  active: number;
  pinned: number;
  total: number;
}

export interface PresenceStatistics {
  active: number;
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
}
