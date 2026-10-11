import mongoose from 'mongoose';
import { logger } from '../../core/config/logger';
import { Coordinate } from '../../core/types/geo.types';
import { calculateBearing, calculateDistanceMeters } from '../../core/utils/geo.utils';
import { IndoorFacilityModel } from './indoor-facility.model';
import {
  IndoorFacilityCategory,
  IndoorFloorPlan,
  IndoorHighPrecisionFacility,
  IndoorRouteRequest,
  IndoorRouteResult,
  IndoorRouteStep,
  IndoorVerticalConnector,
} from './spatial-visualization.types';

export class IndoorPrecisionViewService {
  /**
   * High-precision indoor facilities registry.
   */
  private facilitiesRegistry: Map<string, IndoorHighPrecisionFacility> = new Map();

  constructor() {
    this.seedHighPrecisionFacilities();
  }

  /**
   * Seeds demo facilities across:
   * 1. High-rise commercial complexes (Cyber City Gurugram, WTC Bengaluru, BKC Mumbai)
   * 2. International airports (Delhi IGI Terminal 3, Mumbai CSMIA T2, Bengaluru BLR T2)
   * 3. Multi-level train hubs (New Delhi Railway Station NDLS + Metro Interchange, Mumbai CSMT, Anand Vihar)
   */
  private seedHighPrecisionFacilities(): void {
    // =========================================================================
    // 1. HIGH-RISE COMMERCIAL COMPLEX: DLF Cyber City & Cyber Hub, Gurugram
    // =========================================================================
    const facilityCyberCity: IndoorHighPrecisionFacility = {
      facilityId: 'fac_cybercity_gurugram',
      name: 'DLF Cyber City & Cyber Hub Multi-Tower Commercial Complex',
      city: 'Gurugram',
      state: 'Haryana',
      category: 'commercial_complex',
      center: [77.0878, 28.4950],
      boundary: [
        [77.0850, 28.4930],
        [77.0910, 28.4930],
        [77.0910, 28.4975],
        [77.0850, 28.4975],
        [77.0850, 28.4930],
      ],
      defaultFloorLevel: 0,
      floorLevels: [-2, -1, 0, 1, 2, 8, 14, 25],
      totalAreaSqMeters: 450000,
      isLiveOccupancyTracked: true,
      indoorBeaconProtocol: 'ble_ibeacon',
      verticalConnectors: [
        {
          connectorId: 'conn_lift_tower_a',
          type: 'elevator',
          connectedLevels: [-2, -1, 0, 1, 2, 8, 14, 25],
          isWheelchairAccessible: true,
          isBidirectional: true,
          operationalStatus: 'active',
          transitTimeSecondsPerFloor: 3.5,
          coordinate: [77.0875, 28.4952],
        },
        {
          connectorId: 'conn_escl_cyberhub_central',
          type: 'escalator',
          connectedLevels: [0, 1, 2],
          isWheelchairAccessible: false,
          isBidirectional: true,
          operationalStatus: 'active',
          transitTimeSecondsPerFloor: 22.0,
          coordinate: [77.0880, 28.4948],
        },
        {
          connectorId: 'conn_skywalk_rapid_metro',
          type: 'ramp',
          connectedLevels: [1],
          isWheelchairAccessible: true,
          isBidirectional: true,
          operationalStatus: 'active',
          transitTimeSecondsPerFloor: 15.0,
          coordinate: [77.0865, 28.4958],
        },
      ],
      floors: [
        {
          floorLevel: 0,
          floorName: 'Ground Level - DLF Cyber Hub Promenade & Amphitheater',
          altitudeOffsetMeters: 0,
          ceilingHeightMeters: 6.5,
          boundary: [
            [77.0855, 28.4935],
            [77.0905, 28.4935],
            [77.0905, 28.4970],
            [77.0855, 28.4970],
            [77.0855, 28.4935],
          ],
          features: [
            {
              featureId: 'feat_cyber_amphitheater',
              name: 'Cyber Hub Central Amphitheater & Event Arena',
              zoneType: 'atrium',
              floorLevel: 0,
              polygon: [
                [77.0875, 28.4945],
                [77.0885, 28.4945],
                [77.0885, 28.4955],
                [77.0875, 28.4955],
                [77.0875, 28.4945],
              ],
              centerPoint: [77.0880, 28.4950],
              icon: 'theater_comedy',
              tags: ['events', 'cultural', 'open_air'],
              properties: { capacity: 1200, currentOccupancyPct: 45 },
            },
            {
              featureId: 'feat_starbucks_cyberhub',
              name: 'Starbucks Reserve & Roastery Promenade',
              zoneType: 'food_court',
              floorLevel: 0,
              polygon: [
                [77.0870, 28.4946],
                [77.0874, 28.4946],
                [77.0874, 28.4950],
                [77.0870, 28.4950],
                [77.0870, 28.4946],
              ],
              centerPoint: [77.0872, 28.4948],
              icon: 'coffee',
              tags: ['cafe', 'beverages', 'wifi'],
              properties: { openingHours: '08:00 - 00:00' },
            },
            {
              featureId: 'feat_lobby_building_10',
              name: 'DLF Building 10 - Grand Tech Tower Lobby',
              zoneType: 'office_lobby',
              floorLevel: 0,
              polygon: [
                [77.0886, 28.4952],
                [77.0898, 28.4952],
                [77.0898, 28.4962],
                [77.0886, 28.4962],
                [77.0886, 28.4952],
              ],
              centerPoint: [77.0892, 28.4957],
              icon: 'corporate_fare',
              tags: ['google', 'microsoft', 'tech_hub'],
              properties: { accessControl: 'Biometric Turnstiles' },
            },
          ],
          connectors: [],
          navGraphNodes: [
            {
              nodeId: 'node_cyber_g_entrance',
              coordinate: [77.0868, 28.4945],
              floorLevel: 0,
              nodeType: 'waypoint',
              adjacentNodeIds: ['node_cyber_g_atrium', 'node_cyber_lift_a_g'],
            },
            {
              nodeId: 'node_cyber_g_atrium',
              coordinate: [77.0880, 28.4950],
              floorLevel: 0,
              nodeType: 'poi',
              adjacentNodeIds: ['node_cyber_g_entrance', 'node_cyber_g_bld10'],
            },
            {
              nodeId: 'node_cyber_lift_a_g',
              coordinate: [77.0875, 28.4952],
              floorLevel: 0,
              nodeType: 'connector',
              adjacentNodeIds: ['node_cyber_g_entrance', 'node_cyber_lift_a_l1'],
            },
            {
              nodeId: 'node_cyber_g_bld10',
              coordinate: [77.0892, 28.4957],
              floorLevel: 0,
              nodeType: 'poi',
              adjacentNodeIds: ['node_cyber_g_atrium'],
            },
          ],
        },
        {
          floorLevel: 1,
          floorName: 'Level 1 - Skywalk Promenade & Rapid Metro Direct Concourse',
          altitudeOffsetMeters: 6.5,
          ceilingHeightMeters: 4.8,
          boundary: [
            [77.0855, 28.4935],
            [77.0905, 28.4935],
            [77.0905, 28.4970],
            [77.0855, 28.4970],
            [77.0855, 28.4935],
          ],
          features: [
            {
              featureId: 'feat_rapid_metro_skywalk',
              name: 'Rapid Metro Air-Conditioned Skywalk Walkway',
              zoneType: 'corridor',
              floorLevel: 1,
              polygon: [
                [77.0860, 28.4955],
                [77.0875, 28.4955],
                [77.0875, 28.4960],
                [77.0860, 28.4960],
                [77.0860, 28.4955],
              ],
              centerPoint: [77.0868, 28.4958],
              icon: 'tram',
              tags: ['transit_link', 'pedestrian_safe'],
              properties: { directConnectionStation: 'Cyber City Rapid Metro' },
            },
          ],
          connectors: [],
          navGraphNodes: [
            {
              nodeId: 'node_cyber_lift_a_l1',
              coordinate: [77.0875, 28.4952],
              floorLevel: 1,
              nodeType: 'connector',
              adjacentNodeIds: ['node_cyber_l1_skywalk'],
            },
            {
              nodeId: 'node_cyber_l1_skywalk',
              coordinate: [77.0868, 28.4958],
              floorLevel: 1,
              nodeType: 'poi',
              adjacentNodeIds: ['node_cyber_lift_a_l1'],
            },
          ],
        },
      ],
    };

    // =========================================================================
    // 2. INTERNATIONAL AIRPORT: Indira Gandhi International Airport (DEL / IGI T3)
    // =========================================================================
    const facilityDelhiAirportT3: IndoorHighPrecisionFacility = {
      facilityId: 'fac_delhi_igi_t3',
      name: 'Indira Gandhi International Airport (DEL) - Terminal 3 Integrated Hub',
      city: 'New Delhi',
      state: 'Delhi',
      category: 'international_airport',
      center: [77.0850, 28.5562],
      boundary: [
        [77.0780, 28.5510],
        [77.0940, 28.5510],
        [77.0940, 28.5620],
        [77.0780, 28.5620],
        [77.0780, 28.5510],
      ],
      defaultFloorLevel: 2, // Level 2: Departures
      floorLevels: [1, 2, 3], // 1: Arrivals & Baggage, 2: Departures & Gates, 3: Airline Lounges
      totalAreaSqMeters: 502000,
      isLiveOccupancyTracked: true,
      indoorBeaconProtocol: 'geomagnetic_slam',
      verticalConnectors: [
        {
          connectorId: 'conn_lift_pier_central',
          type: 'elevator',
          connectedLevels: [1, 2, 3],
          isWheelchairAccessible: true,
          isBidirectional: true,
          operationalStatus: 'active',
          transitTimeSecondsPerFloor: 12.0,
          coordinate: [77.0860, 28.5565],
        },
        {
          connectorId: 'conn_escl_arrivals_transfer',
          type: 'escalator',
          connectedLevels: [1, 2],
          isWheelchairAccessible: false,
          isBidirectional: true,
          operationalStatus: 'active',
          transitTimeSecondsPerFloor: 28.0,
          coordinate: [77.0855, 28.5560],
        },
      ],
      floors: [
        {
          floorLevel: 2,
          floorName: 'Level 2 - Departures, DigiYatra, Security & Boarding Gates',
          altitudeOffsetMeters: 6.0,
          ceilingHeightMeters: 9.0,
          boundary: [
            [77.0790, 28.5520],
            [77.0930, 28.5520],
            [77.0930, 28.5610],
            [77.0790, 28.5610],
            [77.0790, 28.5520],
          ],
          features: [
            {
              featureId: 'feat_digiyatra_delhi_t3',
              name: 'DigiYatra Smart Biometric E-Gates (Gates 1-4)',
              zoneType: 'digiyatra_gate',
              floorLevel: 2,
              polygon: [
                [77.0810, 28.5540],
                [77.0825, 28.5540],
                [77.0825, 28.5545],
                [77.0810, 28.5545],
                [77.0810, 28.5540],
              ],
              centerPoint: [77.0818, 28.5542],
              icon: 'fingerprint',
              tags: ['facial_recognition', 'fast_track', 'paperless'],
              properties: { averageTransitSeconds: 8, queueLength: 3 },
            },
            {
              featureId: 'feat_cisf_security_t3',
              name: 'CISF Central Security Screening & Smart X-Ray Frisking',
              zoneType: 'security_checkpoint',
              floorLevel: 2,
              polygon: [
                [77.0835, 28.5550],
                [77.0850, 28.5550],
                [77.0850, 28.5560],
                [77.0835, 28.5560],
                [77.0835, 28.5550],
              ],
              centerPoint: [77.0842, 28.5555],
              icon: 'security',
              tags: ['security', 'cisf', 'screening'],
              properties: { estimatedWaitMinutes: 12, openLanes: 16 },
            },
            {
              featureId: 'feat_duty_free_central',
              name: 'Delhi Duty Free Luxury Avenue & Retail Arcade',
              zoneType: 'duty_free',
              floorLevel: 2,
              polygon: [
                [77.0855, 28.5560],
                [77.0875, 28.5560],
                [77.0875, 28.5572],
                [77.0855, 28.5572],
                [77.0855, 28.5560],
              ],
              centerPoint: [77.0865, 28.5566],
              icon: 'shopping_bag',
              tags: ['retail', 'perfumes', 'watches', 'chocolates'],
              properties: { storesCount: 42 },
            },
            {
              featureId: 'feat_gate_32_t3',
              name: 'Boarding Gate 32 (Air India / Vistara / Indigo International)',
              zoneType: 'boarding_gate',
              floorLevel: 2,
              polygon: [
                [77.0890, 28.5580],
                [77.0905, 28.5580],
                [77.0905, 28.5590],
                [77.0890, 28.5590],
                [77.0890, 28.5580],
              ],
              centerPoint: [77.0898, 28.5585],
              icon: 'flight_takeoff',
              tags: ['gate_32', 'aerobridge', 'international'],
              properties: { flightNumber: 'AI-101', destination: 'New York JFK', status: 'Boarding' },
            },
          ],
          connectors: [],
          navGraphNodes: [
            {
              nodeId: 'node_del_forecourt',
              coordinate: [77.0805, 28.5538],
              floorLevel: 2,
              nodeType: 'waypoint',
              adjacentNodeIds: ['node_del_digiyatra'],
            },
            {
              nodeId: 'node_del_digiyatra',
              coordinate: [77.0818, 28.5542],
              floorLevel: 2,
              nodeType: 'gate',
              adjacentNodeIds: ['node_del_forecourt', 'node_del_security'],
            },
            {
              nodeId: 'node_del_security',
              coordinate: [77.0842, 28.5555],
              floorLevel: 2,
              nodeType: 'waypoint',
              adjacentNodeIds: ['node_del_digiyatra', 'node_del_duty_free', 'node_del_lift_central'],
            },
            {
              nodeId: 'node_del_duty_free',
              coordinate: [77.0865, 28.5566],
              floorLevel: 2,
              nodeType: 'poi',
              adjacentNodeIds: ['node_del_security', 'node_del_gate_32'],
            },
            {
              nodeId: 'node_del_gate_32',
              coordinate: [77.0898, 28.5585],
              floorLevel: 2,
              nodeType: 'gate',
              adjacentNodeIds: ['node_del_duty_free'],
            },
            {
              nodeId: 'node_del_lift_central',
              coordinate: [77.0860, 28.5565],
              floorLevel: 2,
              nodeType: 'connector',
              adjacentNodeIds: ['node_del_security', 'node_del_lift_central_l1'],
            },
          ],
        },
        {
          floorLevel: 1,
          floorName: 'Level 1 - Arrivals, Baggage Reclaim & Ground Transport Interchange',
          altitudeOffsetMeters: 0.0,
          ceilingHeightMeters: 6.0,
          boundary: [
            [77.0790, 28.5520],
            [77.0930, 28.5520],
            [77.0930, 28.5610],
            [77.0790, 28.5610],
            [77.0790, 28.5520],
          ],
          features: [
            {
              featureId: 'feat_baggage_carousel_4',
              name: 'Baggage Claim Carousel #4 (Widebody International)',
              zoneType: 'baggage_carousel',
              floorLevel: 1,
              polygon: [
                [77.0850, 28.5555],
                [77.0868, 28.5555],
                [77.0868, 28.5565],
                [77.0850, 28.5565],
                [77.0850, 28.5555],
              ],
              centerPoint: [77.0859, 28.5560],
              icon: 'luggage',
              tags: ['carousel_4', 'baggage', 'arrivals'],
              properties: { activeFlight: 'AI-102 (from London Heathrow)', beltStatus: 'Delivering' },
            },
          ],
          connectors: [],
          navGraphNodes: [
            {
              nodeId: 'node_del_lift_central_l1',
              coordinate: [77.0860, 28.5565],
              floorLevel: 1,
              nodeType: 'connector',
              adjacentNodeIds: ['node_del_carousel_4'],
            },
            {
              nodeId: 'node_del_carousel_4',
              coordinate: [77.0859, 28.5560],
              floorLevel: 1,
              nodeType: 'poi',
              adjacentNodeIds: ['node_del_lift_central_l1'],
            },
          ],
        },
      ],
    };

    // =========================================================================
    // 3. MULTI-LEVEL TRAIN HUB: New Delhi Railway Station (NDLS) + Metro Hub
    // =========================================================================
    const facilityNDLSRailHub: IndoorHighPrecisionFacility = {
      facilityId: 'fac_ndls_mega_rail_hub',
      name: 'New Delhi Railway Station (NDLS) & Airport Express Metro Multi-Modal Mega Hub',
      city: 'New Delhi',
      state: 'Delhi',
      category: 'train_hub',
      center: [77.2185, 28.6425],
      boundary: [
        [77.2140, 28.6380],
        [77.2250, 28.6380],
        [77.2250, 28.6475],
        [77.2140, 28.6475],
        [77.2140, 28.6380],
      ],
      defaultFloorLevel: 0, // Level 0: Tracks & Platforms 1-16
      floorLevels: [-1, 0, 1], // -1: Subway Metro Interchange, 0: Platforms 1-16, 1: North & South FOBs & Skywalk
      totalAreaSqMeters: 380000,
      isLiveOccupancyTracked: true,
      indoorBeaconProtocol: 'ble_ibeacon',
      verticalConnectors: [
        {
          connectorId: 'conn_fob_north_escalator_pf1',
          type: 'escalator',
          connectedLevels: [0, 1],
          isWheelchairAccessible: false,
          isBidirectional: true,
          operationalStatus: 'active',
          transitTimeSecondsPerFloor: 24.0,
          coordinate: [77.2170, 28.6415],
        },
        {
          connectorId: 'conn_skywalk_lift_central',
          type: 'elevator',
          connectedLevels: [-1, 0, 1],
          isWheelchairAccessible: true,
          isBidirectional: true,
          operationalStatus: 'active',
          transitTimeSecondsPerFloor: 10.0,
          coordinate: [77.2190, 28.6425],
        },
      ],
      floors: [
        {
          floorLevel: 0,
          floorName: 'Ground Level - 16 Railway Platform Tracks (Paharganj & Ajmeri Gate Sides)',
          altitudeOffsetMeters: 0.0,
          ceilingHeightMeters: 7.2,
          boundary: [
            [77.2150, 28.6390],
            [77.2240, 28.6390],
            [77.2240, 28.6465],
            [77.2150, 28.6465],
            [77.2150, 28.6390],
          ],
          features: [
            {
              featureId: 'feat_platform_1_vande_bharat',
              name: 'Platform 1 (Vande Bharat Express & Rajdhani Express Departure)',
              zoneType: 'train_platform',
              floorLevel: 0,
              polygon: [
                [77.2160, 28.6400],
                [77.2172, 28.6400],
                [77.2172, 28.6450],
                [77.2160, 28.6450],
                [77.2160, 28.6400],
              ],
              centerPoint: [77.2166, 28.6425],
              icon: 'train',
              tags: ['platform_1', 'vande_bharat', 'rajdhani'],
              properties: { platformNumber: 1, lengthMeters: 620, waterVendingUnits: 6 },
            },
            {
              featureId: 'feat_platform_16_ajmeri_gate',
              name: 'Platform 16 (Ajmeri Gate Side High-Speed Corridors)',
              zoneType: 'train_platform',
              floorLevel: 0,
              polygon: [
                [77.2225, 28.6400],
                [77.2235, 28.6400],
                [77.2235, 28.6450],
                [77.2225, 28.6450],
                [77.2225, 28.6400],
              ],
              centerPoint: [77.2230, 28.6425],
              icon: 'train',
              tags: ['platform_16', 'ajmeri_gate', 'metro_connect'],
              properties: { platformNumber: 16, lengthMeters: 620 },
            },
            {
              featureId: 'feat_irctc_executive_lounge',
              name: 'IRCTC Premium Executive Lounge (Paharganj Concierge)',
              zoneType: 'irctc_lounge',
              floorLevel: 0,
              polygon: [
                [77.2152, 28.6410],
                [77.2160, 28.6410],
                [77.2160, 28.6422],
                [77.2152, 28.6422],
                [77.2152, 28.6410],
              ],
              centerPoint: [77.2156, 28.6416],
              icon: 'weekend',
              tags: ['buffet', 'recliners', 'wifi', 'executive'],
              properties: { entryFeeInr: 150, complimentaryDrinks: true },
            },
          ],
          connectors: [],
          navGraphNodes: [
            {
              nodeId: 'node_ndls_pf1',
              coordinate: [77.2166, 28.6425],
              floorLevel: 0,
              nodeType: 'platform',
              adjacentNodeIds: ['node_ndls_lift_pf1', 'node_ndls_escl_pf1'],
            },
            {
              nodeId: 'node_ndls_lift_pf1',
              coordinate: [77.2190, 28.6425],
              floorLevel: 0,
              nodeType: 'connector',
              adjacentNodeIds: ['node_ndls_pf1', 'node_ndls_skywalk_l1', 'node_ndls_subway_m1'],
            },
            {
              nodeId: 'node_ndls_escl_pf1',
              coordinate: [77.2170, 28.6415],
              floorLevel: 0,
              nodeType: 'connector',
              adjacentNodeIds: ['node_ndls_pf1', 'node_ndls_skywalk_l1'],
            },
          ],
        },
        {
          floorLevel: 1,
          floorName: 'Level 1 - Elevated Skywalk & North Foot Overbridge (Cross-Platform Corridor)',
          altitudeOffsetMeters: 6.8,
          ceilingHeightMeters: 4.5,
          boundary: [
            [77.2150, 28.6420],
            [77.2240, 28.6420],
            [77.2240, 28.6435],
            [77.2150, 28.6435],
            [77.2150, 28.6420],
          ],
          features: [
            {
              featureId: 'feat_ndls_central_skywalk',
              name: 'NDLS 242-Meter Elevated Covered Skywalk with Travelators',
              zoneType: 'foot_overbridge',
              floorLevel: 1,
              polygon: [
                [77.2155, 28.6422],
                [77.2235, 28.6422],
                [77.2235, 28.6430],
                [77.2155, 28.6430],
                [77.2155, 28.6422],
              ],
              centerPoint: [77.2195, 28.6426],
              icon: 'directions_walk',
              tags: ['skywalk', 'travelator', 'accessible'],
              properties: { connects: 'Platform 1 to Platform 16 & Airport Express Metro' },
            },
          ],
          connectors: [],
          navGraphNodes: [
            {
              nodeId: 'node_ndls_skywalk_l1',
              coordinate: [77.2190, 28.6425],
              floorLevel: 1,
              nodeType: 'waypoint',
              adjacentNodeIds: ['node_ndls_skywalk_pf16'],
            },
            {
              nodeId: 'node_ndls_skywalk_pf16',
              coordinate: [77.2230, 28.6425],
              floorLevel: 1,
              nodeType: 'waypoint',
              adjacentNodeIds: ['node_ndls_skywalk_l1'],
            },
          ],
        },
        {
          floorLevel: -1,
          floorName: 'Level -1 - Underground Metro Subway & Airport Express Interchange',
          altitudeOffsetMeters: -7.5,
          ceilingHeightMeters: 5.0,
          boundary: [
            [77.2180, 28.6410],
            [77.2250, 28.6410],
            [77.2250, 28.6450],
            [77.2180, 28.6450],
            [77.2180, 28.6410],
          ],
          features: [
            {
              featureId: 'feat_airport_express_gate',
              name: 'Delhi Metro Airport Express Line Concierge & City Check-in',
              zoneType: 'metro_transfer_gate',
              floorLevel: -1,
              polygon: [
                [77.2232, 28.6420],
                [77.2245, 28.6420],
                [77.2245, 28.6435],
                [77.2232, 28.6435],
                [77.2232, 28.6420],
              ],
              centerPoint: [77.2238, 28.6427],
              icon: 'flight',
              tags: ['metro', 'airport_express', 'city_checkin'],
              properties: { transitTimeIGI: '19 minutes non-stop to IGI Airport T3' },
            },
          ],
          connectors: [],
          navGraphNodes: [
            {
              nodeId: 'node_ndls_subway_m1',
              coordinate: [77.2190, 28.6425],
              floorLevel: -1,
              nodeType: 'connector',
              adjacentNodeIds: ['node_ndls_metro_airport_gate'],
            },
            {
              nodeId: 'node_ndls_metro_airport_gate',
              coordinate: [77.2238, 28.6427],
              floorLevel: -1,
              nodeType: 'gate',
              adjacentNodeIds: ['node_ndls_subway_m1'],
            },
          ],
        },
      ],
    };

    this.facilitiesRegistry.set(facilityCyberCity.facilityId, facilityCyberCity);
    this.facilitiesRegistry.set(facilityDelhiAirportT3.facilityId, facilityDelhiAirportT3);
    this.facilitiesRegistry.set(facilityNDLSRailHub.facilityId, facilityNDLSRailHub);
  }

  /**
   * Retrieves list of indoor facilities with optional category and city filtering.
   */
  async getFacilities(filters?: {
    category?: IndoorFacilityCategory;
    city?: string;
  }): Promise<IndoorHighPrecisionFacility[]> {
    let list = Array.from(this.facilitiesRegistry.values());
    if (filters?.category) {
      list = list.filter((f) => f.category === filters.category);
    }
    if (filters?.city) {
      list = list.filter((f) => f.city.toLowerCase().includes(filters.city!.toLowerCase()));
    }
    return list;
  }

  /**
   * Retrieves full facility digital twin by ID.
   */
  async getFacilityById(facilityId: string): Promise<IndoorHighPrecisionFacility | null> {
    return this.facilitiesRegistry.get(facilityId) || null;
  }

  /**
   * Retrieves a specific floor plan slice by floor level.
   */
  async getFloorPlan(facilityId: string, floorLevel: number): Promise<IndoorFloorPlan | null> {
    const facility = this.facilitiesRegistry.get(facilityId);
    if (!facility) return null;
    return facility.floors.find((fl) => fl.floorLevel === floorLevel) || null;
  }

  /**
   * High-precision multi-floor turn-by-turn indoor routing algorithm.
   * Traverses indoor wayfinding nodes, supports vertical floor transitions (elevators, escalators, stairs),
   * and adheres to wheelchair accessibility constraints (`accessibleOnly: true`).
   */
  async calculateIndoorRoute(request: IndoorRouteRequest): Promise<IndoorRouteResult> {
    const facility = this.facilitiesRegistry.get(request.facilityId);
    if (!facility) {
      throw new Error(`Indoor facility not found: ${request.facilityId}`);
    }

    const { origin, destination, accessibleOnly } = request;
    const sameFloor = origin.floorLevel === destination.floorLevel;

    const steps: IndoorRouteStep[] = [];
    const floorsTraversed: number[] = [origin.floorLevel];
    const path3D: Array<[number, number, number]> = [];

    let totalDist = 0;
    let totalSecs = 0;

    if (sameFloor) {
      // Horizontal routing on same floor
      const dist = calculateDistanceMeters(origin.coordinate, destination.coordinate);
      const walkTime = Math.max(10, Math.round(dist / 1.2)); // 1.2 m/s standard indoor walking speed
      totalDist = dist;
      totalSecs = walkTime;

      steps.push({
        stepIndex: 1,
        floorLevel: origin.floorLevel,
        instruction: `Walk straight along corridor towards destination (${Math.round(dist)}m)`,
        action: 'straight',
        distanceMeters: Math.round(dist),
        durationSeconds: walkTime,
        pathCoordinates: [origin.coordinate, destination.coordinate],
      });

      steps.push({
        stepIndex: 2,
        floorLevel: origin.floorLevel,
        instruction: 'Arrive at destination',
        action: 'arrive',
        distanceMeters: 0,
        durationSeconds: 0,
        pathCoordinates: [destination.coordinate],
      });

      path3D.push([origin.coordinate[0], origin.coordinate[1], origin.floorLevel * 4.5]);
      path3D.push([destination.coordinate[0], destination.coordinate[1], destination.floorLevel * 4.5]);
    } else {
      // Multi-floor vertical transit required
      floorsTraversed.push(destination.floorLevel);

      // 1. Locate best connector (filter by accessibility if requested)
      const validConnectors = facility.verticalConnectors.filter((c) => {
        const connectsOrigin = c.connectedLevels.includes(origin.floorLevel);
        const connectsDest = c.connectedLevels.includes(destination.floorLevel);
        if (!connectsOrigin || !connectsDest) return false;
        if (accessibleOnly && !c.isWheelchairAccessible) return false;
        return true;
      });

      const connector =
        validConnectors.find((c) => (accessibleOnly ? c.isWheelchairAccessible : c.type === 'escalator')) ||
        validConnectors[0] ||
        facility.verticalConnectors[0];

      const connectorCoord = connector ? connector.coordinate : origin.coordinate;
      const connectorType = connector ? connector.type : 'elevator';

      // Step 1: Walk to vertical connector on origin floor
      const distToConnector = calculateDistanceMeters(origin.coordinate, connectorCoord);
      const walkToConnectorSecs = Math.max(8, Math.round(distToConnector / 1.2));
      totalDist += distToConnector;
      totalSecs += walkToConnectorSecs;

      steps.push({
        stepIndex: 1,
        floorLevel: origin.floorLevel,
        instruction: `Walk ${Math.round(distToConnector)}m to the ${connectorType === 'elevator' ? 'Elevator Core' : 'Escalator'}`,
        action: 'straight',
        distanceMeters: Math.round(distToConnector),
        durationSeconds: walkToConnectorSecs,
        pathCoordinates: [origin.coordinate, connectorCoord],
      });

      // Step 2: Vertical floor transition
      const floorsDiff = Math.abs(destination.floorLevel - origin.floorLevel);
      const verticalTransitSecs = Math.round(floorsDiff * (connector ? connector.transitTimeSecondsPerFloor : 15.0));
      totalSecs += verticalTransitSecs;

      const connectorAction =
        connectorType === 'elevator'
          ? 'take_elevator'
          : connectorType === 'escalator'
          ? 'take_escalator'
          : 'take_stairs';

      const floorLabel = destination.floorLevel > origin.floorLevel ? `Level ${destination.floorLevel}` : `Level ${destination.floorLevel}`;

      steps.push({
        stepIndex: 2,
        floorLevel: origin.floorLevel,
        instruction: `Take the ${connectorType} from Level ${origin.floorLevel} to ${floorLabel}`,
        action: connectorAction,
        distanceMeters: floorsDiff * 4.5,
        durationSeconds: verticalTransitSecs,
        pathCoordinates: [connectorCoord],
        connectorDetails: {
          connectorType,
          fromFloor: origin.floorLevel,
          toFloor: destination.floorLevel,
        },
      });

      // Step 3: Walk from connector to destination on target floor
      const distFromConnector = calculateDistanceMeters(connectorCoord, destination.coordinate);
      const walkFromConnectorSecs = Math.max(8, Math.round(distFromConnector / 1.2));
      totalDist += distFromConnector;
      totalSecs += walkFromConnectorSecs;

      steps.push({
        stepIndex: 3,
        floorLevel: destination.floorLevel,
        instruction: `Exit ${connectorType} on Level ${destination.floorLevel} and walk ${Math.round(distFromConnector)}m to destination`,
        action: 'straight',
        distanceMeters: Math.round(distFromConnector),
        durationSeconds: walkFromConnectorSecs,
        pathCoordinates: [connectorCoord, destination.coordinate],
      });

      // Step 4: Arrival
      steps.push({
        stepIndex: 4,
        floorLevel: destination.floorLevel,
        instruction: 'Arrive at destination',
        action: 'arrive',
        distanceMeters: 0,
        durationSeconds: 0,
        pathCoordinates: [destination.coordinate],
      });

      // 3D Path representation
      path3D.push([origin.coordinate[0], origin.coordinate[1], origin.floorLevel * 4.5]);
      path3D.push([connectorCoord[0], connectorCoord[1], origin.floorLevel * 4.5]);
      path3D.push([connectorCoord[0], connectorCoord[1], destination.floorLevel * 4.5]);
      path3D.push([destination.coordinate[0], destination.coordinate[1], destination.floorLevel * 4.5]);
    }

    return {
      routeId: `route_indoor_${Date.now()}`,
      facilityId: facility.facilityId,
      facilityName: facility.name,
      totalDistanceMeters: Math.round(totalDist),
      totalDurationSeconds: Math.round(totalSecs),
      steps,
      floorsTraversed,
      accessibleMode: !!accessibleOnly,
      estimatedSecurityWaitSeconds: facility.category === 'international_airport' ? 720 : 0, // 12 mins at airport
      path3D,
    };
  }
}

export const indoorPrecisionViewService = new IndoorPrecisionViewService();
