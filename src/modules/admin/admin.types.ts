export interface OverviewMetrics {
  total_users: number;
  active_users_count: number;
  verified_users_count: number;
  admin_users_count: number;
  average_rating: number;
  total_ratings_count: number;
  total_active_minutes: number;
  top_feature: string;
  total_places_count: number;
  active_traffic_overrides_count: number;
  active_weather_overrides_count: number;
  active_hazards_count: number;
  active_sos_count: number;
  system_status: 'HEALTHY' | 'DEGRADED' | 'MAINTENANCE';
  redis_connected: boolean;
  mongo_connected: boolean;
}

export interface AdminTrafficOverride {
  segment_id: string;
  road_name?: string;
  congestion_level: 'GREEN' | 'YELLOW' | 'RED' | 'DARK_RED' | string;
  speed_factor: number;
  incident_description: string;
  location?: { latitude: number; longitude: number };
  duration_hours?: number;
  created_by?: string;
  updated_at: string;
}

export interface UserAnalyticsItem {
  date: string;
  active_users: number;
  new_signups: number;
}

export interface FeatureUsageItem {
  feature_name: string;
  usage_count: number;
  percentage: number;
}

export interface SystemHealthReport {
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  timestamp: string;
  uptime_seconds: number;
  uptime_formatted: string;
  node_version: string;
  memory: {
    rss_mb: number;
    heap_used_mb: number;
    heap_total_mb: number;
    external_mb: number;
  };
  cpu_usage: {
    user_ms: number;
    system_ms: number;
  };
  database: {
    status: string;
    readyState: number;
    host?: string;
    ping_ms?: number;
    collections: {
      users: number;
      places: number;
      audit_logs: number;
    };
  };
  cache: {
    status: string;
    is_connected: boolean;
    host?: string;
    prefix: string;
    total_keys?: number;
    route_cache_keys?: number;
  };
  osrm: {
    status: string;
    base_url: string;
    ping_ms?: number;
  };
  socket_io: {
    active_connections: number;
  };
}

export interface CacheStats {
  is_connected: boolean;
  total_keys: number;
  route_cache_keys: number;
  prefix: string;
  ttl_seconds: number;
}

export interface SystemConfigState {
  maintenance_mode: boolean;
  maintenance_message: string;
  navic_enhancement_enabled: boolean;
  ai_copilot_enabled: boolean;
  lane_routing_enabled: boolean;
  fastag_simulation_enabled: boolean;
  emergency_dispatch_mode: 'AUTOMATIC' | 'MANUAL';
  reroute_cooldown_seconds: number;
  off_route_threshold_meters: number;
  updated_at: string;
  updated_by: string;
}

export interface AdminUserItem {
  id: string;
  name: string;
  email: string;
  phoneNumber: string;
  age: number;
  role: 'user' | 'admin';
  isEmailVerified: boolean;
  status: 'active' | 'suspended' | 'inactive';
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUserListResult {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  users: AdminUserItem[];
}

export interface UserStatsSummary {
  total_users: number;
  verified_users: number;
  unverified_users: number;
  admin_users: number;
  new_signups_last_7_days: number;
  new_signups_last_30_days: number;
}

export interface AdminAuditLogEntry {
  id: string;
  admin_email: string;
  action: string;
  target_type: string;
  target_id?: string;
  details: Record<string, any>;
  ip_address?: string;
  timestamp: string;
}

export interface CreateAdminUserInput {
  name: string;
  email: string;
  phoneNumber: string;
  age: number;
  role?: 'user' | 'admin';
  isEmailVerified?: boolean;
}

export interface UpdateAdminUserInput {
  name?: string;
  phoneNumber?: string;
  age?: number;
  role?: 'user' | 'admin';
  isEmailVerified?: boolean;
}
