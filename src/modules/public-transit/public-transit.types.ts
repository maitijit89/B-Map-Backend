import { Coordinate } from '../../core/types/geo.types';

export type TransitMode =
  | 'subway' // Metro / U-Bahn
  | 'commuter_rail' // S-Bahn / Regional train
  | 'tram' // Streetcar / Tram
  | 'bus' // City bus / Express bus
  | 'ferry'; // Passenger ferry

export interface TransitStation {
  stationId: string;
  name: string;
  code?: string;
  location: Coordinate;
  modes: TransitMode[];
  lines: string[];
  platforms: {
    platformNumber: string;
    direction: string;
  }[];
  entrances: {
    entranceId: string;
    name: string;
    coordinates: Coordinate;
    accessible: boolean;
  }[];
  zone: string;
}

export interface TransitDeparture {
  line: string;
  lineColor: string;
  mode: TransitMode;
  destination: string;
  scheduledDeparture: string;
  realTimeDeparture: string;
  delayMinutes: number;
  platform: string;
  crowding: 'low' | 'moderate' | 'high' | 'full';
  liveVehicleId?: string;
}

export interface TransitLeg {
  legType: 'walk' | 'transit' | 'transfer';
  mode?: TransitMode;
  line?: string;
  lineColor?: string;
  fromStation?: string;
  toStation?: string;
  departureTime?: string;
  arrivalTime?: string;
  durationSeconds: number;
  distanceMeters: number;
  numberOfStops?: number;
  intermediateStops?: string[];
  optimalCarriageRecommendation?: string;
  stationExitGuidance?: string;
  walkInstruction?: string;
  geometry: Coordinate[];
}

export interface PublicTransitItinerary {
  itineraryId: string;
  origin: Coordinate;
  destination: Coordinate;
  departureTime: string;
  arrivalTime: string;
  totalDurationMinutes: number;
  totalWalkingMinutes: number;
  transferCount: number;
  fareEstimated: {
    ticketName: string;
    zones: string;
    price: number;
    currency: string;
  };
  legs: TransitLeg[];
  co2SavedKg: number;
}
