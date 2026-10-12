import { calculateDistance } from '../../core/utils/response';
import { ChargingStation, NearbyEVQuery } from './evcharging.types';

export class EVService {
  private readonly stations: ChargingStation[] = [
    {
      id: 'ev_tata_cyberhub',
      name: 'Tata Power EZ Charge - Cyber Hub',
      operator: 'Tata Power EZ',
      address: 'DLF Cyber Hub, NH-48, Gurugram, Haryana 122002',
      location: { latitude: 28.495, longitude: 77.089 },
      cost_per_kwh_inr: 18.5,
      is_24x7: true,
      has_restroom: true,
      has_food_dining: true,
      last_updated: new Date().toISOString(),
      connectors: [
        {
          type: 'CCS2',
          power_kw: 60.0,
          total_ports: 4,
          available_ports: 2,
          status: 'AVAILABLE',
        },
        {
          type: 'TYPE_2',
          power_kw: 22.0,
          total_ports: 2,
          available_ports: 1,
          status: 'AVAILABLE',
        },
      ],
    },
    {
      id: 'ev_jiobp_delhimumbai_exp',
      name: 'Jio-bp pulse - Delhi-Mumbai Expressway Rest Area',
      operator: 'Jio-bp pulse',
      address: 'Wayside Amenity KM 42, NE-4 Expressway, Haryana',
      location: { latitude: 28.18, longitude: 77.12 },
      cost_per_kwh_inr: 21.0,
      is_24x7: true,
      has_restroom: true,
      has_food_dining: true,
      last_updated: new Date().toISOString(),
      connectors: [
        {
          type: 'CCS2',
          power_kw: 120.0,
          total_ports: 6,
          available_ports: 4,
          status: 'AVAILABLE',
        },
        {
          type: 'CCS2',
          power_kw: 60.0,
          total_ports: 4,
          available_ports: 3,
          status: 'AVAILABLE',
        },
      ],
    },
    {
      id: 'ev_ather_indiranagar',
      name: 'Ather Grid - Indiranagar 100ft Rd',
      operator: 'Ather Grid',
      address: '100 Feet Rd, Indiranagar, Bengaluru, Karnataka 560038',
      location: { latitude: 12.9719, longitude: 77.6412 },
      cost_per_kwh_inr: 15.0,
      is_24x7: true,
      has_restroom: false,
      has_food_dining: true,
      last_updated: new Date().toISOString(),
      connectors: [
        {
          type: 'ATHER_GRID',
          power_kw: 3.3,
          total_ports: 3,
          available_ports: 2,
          status: 'AVAILABLE',
        },
        {
          type: 'BHARAT_AC001',
          power_kw: 3.3,
          total_ports: 2,
          available_ports: 1,
          status: 'AVAILABLE',
        },
      ],
    },
    {
      id: 'ev_statiq_bandra',
      name: 'Statiq EV Fast Hub - Bandra Kurla Complex',
      operator: 'Statiq',
      address: 'G Block, BKC, Bandra East, Mumbai, Maharashtra 400051',
      location: { latitude: 19.0657, longitude: 72.8688 },
      cost_per_kwh_inr: 19.0,
      is_24x7: true,
      has_restroom: true,
      has_food_dining: true,
      last_updated: new Date().toISOString(),
      connectors: [
        {
          type: 'CCS2',
          power_kw: 60.0,
          total_ports: 4,
          available_ports: 1,
          status: 'AVAILABLE',
        },
        {
          type: 'TYPE_2',
          power_kw: 7.4,
          total_ports: 4,
          available_ports: 3,
          status: 'AVAILABLE',
        },
      ],
    },
  ];

  public getNearbyStations(query: NearbyEVQuery): ChargingStation[] {
    const lat = query.latitude ?? 28.6129;
    const lng = query.longitude ?? 77.2295;
    const radius = query.radius_km ?? 50.0;

    const matched: ChargingStation[] = [];
    for (const st of this.stations) {
      const dKm =
        calculateDistance(lat, lng, st.location.latitude, st.location.longitude) /
        1000.0;
      if (dKm <= radius) {
        if (query.connector_filter) {
          const has = st.connectors.some(
            (c) => c.type.toUpperCase() === query.connector_filter!.toUpperCase()
          );
          if (!has) continue;
        }
        matched.push({
          ...st,
          distance_km: Math.round(dKm * 10) / 10,
        });
      }
    }

    return matched.length > 0 ? matched : [this.stations[0]];
  }

  public getStationById(id: string): ChargingStation | null {
    return this.stations.find((s) => s.id === id) ?? null;
  }
}

export const evService = new EVService();
