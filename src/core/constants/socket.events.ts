export const SOCKET_EVENTS = {
  // Connection & Auth
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  ERROR: 'error',

  // Real-time location tracking (Drivers/Users/Fleet)
  LOCATION_UPDATE: 'location:update',
  LOCATION_BROADCAST: 'location:broadcast',
  LOCATION_SUBSCRIBE: 'location:subscribe',
  LOCATION_UNSUBSCRIBE: 'location:unsubscribe',

  // Proximity & Fleet queries
  NEARBY_DRIVERS_REQUEST: 'nearby:drivers:request',
  NEARBY_DRIVERS_RESPONSE: 'nearby:drivers:response',

  // Navigation & Turn-by-Turn
  NAV_JOIN: 'nav:join',
  NAV_LEAVE: 'nav:leave',
  NAV_UPDATE_PROGRESS: 'nav:update_progress',
  NAV_PROGRESS_STATE: 'nav:progress_state',
  NAV_OFF_ROUTE_ALERT: 'nav:off_route_alert',
  NAV_REROUTE_SUCCESS: 'nav:reroute_success',
  NAV_REROUTE_ERROR: 'nav:reroute_error',
  NAV_STEP_COMPLETED: 'nav:step_completed',
  NAV_DESTINATION_REACHED: 'nav:destination_reached',

  // High-Precision & Weak-Signal Real-Time Stream
  POSITIONING_STREAM_TELEMETRY: 'positioning:telemetry',
  POSITIONING_FUSED_BROADCAST: 'positioning:fused_state',
  POSITIONING_SUBSCRIBE: 'positioning:subscribe',

  // Lane-Level Real-Time Guidance & Veteran Alerts
  LANE_GUIDANCE_STREAM: 'lane:guidance_stream',
  LANE_GUIDANCE_BROADCAST: 'lane:guidance_broadcast',
  VETERAN_HAZARD_ALERT: 'veteran:hazard_alert',

  // Unified Underlying Engine & Dynamic Recommendations
  UNIFIED_TELEMETRY_TICK: 'unified:tick',
  UNIFIED_STATE_BROADCAST: 'unified:state_broadcast',
  DYNAMIC_RECOMMENDATION_POPUP: 'unified:recommendation_popup',

  // 1. Next-Gen Lane-Level Guidance (SR Navigation)
  SR_TELEMETRY_STREAM: 'sr:telemetry_stream',
  SR_HUD_BROADCAST: 'sr:hud_broadcast',
  SR_LANE_DRIFT_ALERT: 'sr:lane_drift_alert',
  SR_COLLISION_WARNING: 'sr:collision_warning',

  // 2. Automotive & Ecosystem Integration
  AUTO_CAN_STREAM: 'auto:can_stream',
  AUTO_ECO_SCORE_BROADCAST: 'auto:eco_score_broadcast',
  AUTO_HUD_FRAME_STREAM: 'auto:hud_frame_stream',
  AUTO_COCKPIT_SYNC: 'auto:cockpit_sync',

  // 3. Rider Mode (Motorcycle & Two-Wheeler)
  RIDER_DYNAMICS_STREAM: 'rider:dynamics_stream',
  RIDER_LEAN_BROADCAST: 'rider:lean_broadcast',
  RIDER_WEATHER_ALERT: 'rider:weather_alert',
  RIDER_CRASH_ALERT: 'rider:crash_alert',
  RIDER_CRASH_CANCEL: 'rider:crash_cancel',

  // 4. Parking Space-Level Navigation
  PARKING_ENTRANCE_DETECT: 'parking:entrance_detect',
  PARKING_INDOOR_GUIDANCE: 'parking:indoor_guidance',
  PARKING_BAY_STATUS_BROADCAST: 'parking:bay_status_broadcast',

  // 5. Multi-Mode Core Navigation
  CAR_CAMERA_ALERT_STREAM: 'car:camera_alerts',
  TRANSIT_LIVE_BOARD_STREAM: 'transit:live_board',
  AR_POSE_STREAM: 'ar:pose_stream',
  AR_HUD_PROJECTION_BROADCAST: 'ar:hud_projection',

  // 6. Comprehensive AI & LLM Copilot
  COPILOT_MESSAGE_STREAM: 'copilot:message_stream',
  COPILOT_PROCESSING_STATUS: 'copilot:processing_status',
  COPILOT_MESSAGE_RESPONSE: 'copilot:message_response',
  COPILOT_ERROR: 'copilot:error',

  // 7. Advanced Visualization & Spatial Mapping
  SPATIAL_HEATMAP_STREAM: 'spatial:heatmap_stream',
  SPATIAL_WEATHER_RADAR_STREAM: 'spatial:weather_radar_stream',
  SPATIAL_CAMERA_FLYBY_UPDATE: 'spatial:camera_flyby_update',
  SPATIAL_3D_SCENE_SUBSCRIBE: 'spatial:3d_scene_subscribe',

  // 8. 4D Dynamic Space Rendering & High-Precision Indoor
  DYNAMIC_4D_TIME_SLIDER_SYNC: 'dynamic_4d:time_slider_sync',
  DYNAMIC_4D_SCENE_STREAM: 'dynamic_4d:scene_stream',
  STREET_VIEW_DYNAMIC_HAZARD_STREAM: 'street_view:dynamic_hazard_stream',
  INDOOR_CROWD_DENSITY_STREAM: 'indoor:crowd_density_stream',
  INDOOR_AIRPORT_GATE_UPDATE: 'indoor:airport_gate_update',
  INDOOR_TRAIN_PLATFORM_UPDATE: 'indoor:train_platform_update',

  // 9. Unified Super-App Ecosystem (Rides, Lifestyle, Offline)
  SUPER_APP_RIDE_REQUEST: 'superapp:ride_request',
  SUPER_APP_RIDE_MATCHED: 'superapp:ride_matched',
  SUPER_APP_RIDE_DRIVER_LOCATION: 'superapp:ride_driver_location',
  SUPER_APP_RIDE_STATUS_UPDATE: 'superapp:ride_status_update',
  SUPER_APP_RIDE_SOS_ALERT: 'superapp:ride_sos_alert',
  SUPER_APP_LIFESTYLE_BOOKING_UPDATE: 'superapp:lifestyle_booking_update',
  SUPER_APP_OFFLINE_SYNC_PROGRESS: 'superapp:offline_sync_progress',
} as const;
