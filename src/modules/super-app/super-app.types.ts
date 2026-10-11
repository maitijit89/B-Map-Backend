import { Coordinate } from '../../core/types/geo.types';

// ============================================================================
// 1. ALL-IN-ONE RIDE-HAILING TYPES
// ============================================================================

export type RideVehicleCategory =
  | 'auto_rickshaw'     // 3-wheeler auto rickshaw (standard Indian urban transit)
  | 'moto_bike'         // 2-wheeler bike taxi (quick solo commute)
  | 'mini_hatchback'    // Compact 4-seater (budget city commute)
  | 'prime_sedan'       // Comfortable sedan (executive / airport commute)
  | 'ev_green'          // Zero-emission electric cab (Tata Tigor / Nexon EV)
  | 'suv_xl'            // 6-7 seater (family / luggage)
  | 'outstation_intercity'; // Intercity highway transit

export type RideStatus =
  | 'requested'
  | 'searching_driver'
  | 'accepted'
  | 'driver_arriving'
  | 'arrived_at_pickup'
  | 'in_transit'
  | 'completed'
  | 'cancelled';

export interface DriverVehicleInfo {
  driverId: string;
  name: string;
  phone: string;
  photoUrl: string;
  rating: number;
  totalTrips: number;
  vehicleModel: string;
  vehicleNumber: string; // Indian HSRP e.g. DL 1C AB 4920
  vehicleColor: string;
  vehicleCategory: RideVehicleCategory;
  currentLocation: Coordinate;
  headingDegrees: number;
}

export interface RideFareQuote {
  category: RideVehicleCategory;
  categoryDisplayName: string;
  iconName: string;
  capacityPax: number;
  baseFare: number;
  distanceKm: number;
  distanceFare: number;
  estimatedDurationMinutes: number;
  timeFare: number;
  surgeMultiplier: number; // 1.0 = normal, 1.4 = high demand surge
  nightSurcharge: number;   // 25% municipal night rate between 23:00 - 05:00
  taxesGst: number;         // 5% transport GST
  totalFare: number;
  currency: string;         // 'INR' (₹)
  etaPickupMinutes: number;
}

export interface RideBooking {
  bookingId: string;
  riderId: string;
  riderName: string;
  riderPhone: string;
  category: RideVehicleCategory;
  status: RideStatus;
  pickupLocation: Coordinate;
  pickupAddress: string;
  dropoffLocation: Coordinate;
  dropoffAddress: string;
  otpStartTrip: string;     // 4-digit security PIN given to driver
  assignedDriver?: DriverVehicleInfo;
  fare: RideFareQuote;
  paymentMethod: 'upi' | 'wallet' | 'cash' | 'corporate_card';
  paymentStatus: 'pending' | 'authorized' | 'completed' | 'refunded';
  requestedAt: number;
  acceptedAt?: number;
  pickupAt?: number;
  completedAt?: number;
  cancelledAt?: number;
  cancellationReason?: string;
  cancellationParty?: 'rider' | 'driver' | 'system_timeout';
  routePolyline?: Coordinate[];
  liveDistanceRemainingMeters?: number;
  liveEtaRemainingSeconds?: number;
}

export interface DriverMatchCandidate {
  driverId: string;
  name: string;
  rating: number;
  vehicleCategory: RideVehicleCategory;
  location: Coordinate;
  distanceMeters: number;
  etaMinutes: number;
}

// ============================================================================
// 2. POI DISCOVERY & LIFESTYLE BOOKING TYPES
// ============================================================================

export type LifestylePoiCategory =
  | 'dining_restaurant'
  | 'cafe_bistro'
  | 'nightlife_pub'
  | 'cinema_multiplex'
  | 'spa_wellness'
  | 'shopping_mall'
  | 'healthcare_247';

export type LifestyleBookingType =
  | 'table_reservation'
  | 'service_appointment'
  | 'event_movie_ticket'
  | 'shopping_deal';

export type LifestyleBookingStatus =
  | 'pending'
  | 'confirmed'
  | 'checked_in'
  | 'completed'
  | 'cancelled';

export interface LifestyleServiceItem {
  itemId: string;
  name: string;
  description: string;
  priceInr: number;
  durationMinutes?: number;
  categoryName: string;
}

export interface LifestylePoiItem {
  poiId: string;
  name: string;
  category: LifestylePoiCategory;
  subCategories: string[];
  rating: number;
  reviewCount: number;
  priceTier: '₹' | '₹₹' | '₹₹₹' | '₹₹₹₹';
  avgCostForTwoInr: number;
  location: Coordinate;
  address: string;
  city: string;
  contactPhone: string;
  openingHours: string;
  isOpenNow: boolean;
  photos: string[];
  tags: string[];          // e.g. 'Pure Veg', 'Valet Parking', 'Rooftop', 'Pet Friendly', 'Live Music'
  cuisines?: string[];     // e.g. 'North Indian', 'Mughlai', 'Pan-Asian', 'Italian'
  serviceCatalog?: LifestyleServiceItem[];
  availableTimeSlots?: string[]; // e.g. ['12:30 PM', '01:00 PM', '07:30 PM', '08:00 PM']
  bookingEnabled: boolean;
}

export interface LifestyleBooking {
  bookingId: string;
  userId: string;
  userName: string;
  userPhone: string;
  poiId: string;
  poiName: string;
  category: LifestylePoiCategory;
  bookingType: LifestyleBookingType;
  status: LifestyleBookingStatus;
  bookingDate: string;     // YYYY-MM-DD
  timeSlot: string;        // e.g. '08:00 PM'
  partySize?: number;      // For dining reservations
  selectedItems?: LifestyleServiceItem[]; // For salon/spa or tickets
  seatNumbers?: string[];  // For cinema / event
  specialRequests?: string;
  confirmationCode: string; // 6-digit alphanumeric confirmation voucher
  totalAmountInr: number;
  depositPaidInr: number;
  createdAt: number;
}

// ============================================================================
// 3. OFFLINE MAPS UTILITIES & STORAGE OPTIMIZATION TYPES
// ============================================================================

export type OfflineLayerType =
  | 'vector_tiles'
  | 'road_network_routing_graph'
  | 'poi_search_index'
  | '3d_landmark_wireframes';

export interface OfflineMapBundle {
  bundleId: string;
  regionName: string;
  state: string;
  bounds: [number, number, number, number]; // [west, south, east, north]
  version: string;                         // e.g. 'v2.4.0'
  totalSizeBytes: number;                  // Uncompressed size
  compressedSizeBytes: number;              // Gzip/Brotli download footprint
  sha256Checksum: string;
  layersIncluded: OfflineLayerType[];
  roadNetworkNodesCount: number;
  poiEntriesCount: number;
  downloadUrl: string;
  lastUpdatedAt: string;
  isMandatorySecurityUpdate: boolean;
}

export interface OfflineDeltaPatch {
  patchId: string;
  bundleId: string;
  fromVersion: string;
  toVersion: string;
  patchSizeBytes: number;
  downloadUrl: string;
  byteSavingsPercentage: number;
  changedTileCount: number;
  updatedPoiCount: number;
}

export interface OfflineRoutingQuery {
  origin: Coordinate;
  destination: Coordinate;
  vehicleType?: 'car' | 'two_wheeler' | 'pedestrian';
  offlineBundleId: string;
}

export interface OfflineRouteStep {
  stepIndex: number;
  instruction: string;
  distanceMeters: number;
  durationSeconds: number;
  roadName: string;
  turnDirection: 'straight' | 'left' | 'right' | 'slight_left' | 'slight_right' | 'u_turn' | 'arrive';
}

export interface OfflineRoutingResult {
  routeId: string;
  bundleId: string;
  isOfflineResolved: boolean;
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  pathCoordinates: Coordinate[];
  steps: OfflineRouteStep[];
  fallbackReason?: string;
}

export interface OfflineStorageQuotaReport {
  totalDeviceStorageBytes: number;
  availableStorageBytes: number;
  bmapStorageUsageBytes: number;
  installedBundles: Array<{
    bundleId: string;
    regionName: string;
    version: string;
    sizeBytes: number;
    lastAccessedAt: string;
  }>;
  recommendedPruneList: string[];
}
