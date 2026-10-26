import {
  FareBreakdown,
  FareEstimateRequest,
  FareEstimateResponse,
} from './fares.types';

export class FareService {
  public estimateFares(req: FareEstimateRequest): FareEstimateResponse {
    const city = String(req.city ?? 'Delhi').toUpperCase();
    let dist = Number(req.distance_km ?? req.distanceKm ?? 10.0);
    if (dist < 0.5) dist = 0.5;

    let isNight = Boolean(req.is_night_time ?? req.isNightTime ?? false);
    // Auto check IST night hours (11 PM - 5 AM)
    const istOffset = 5.5 * 3600 * 1000;
    const istNow = new Date(Date.now() + istOffset);
    const istHour = istNow.getUTCHours();
    if (istHour >= 23 || istHour < 5) {
      isNight = true;
    }

    const fares: FareBreakdown[] = [];

    switch (city) {
      case 'MUMBAI': {
        const autoBase = 23.0;
        const extraKm = Math.max(0, dist - 1.5);
        let autoTotal = autoBase + extraKm * 15.33;
        let nightExtra = 0.0;
        if (isNight) {
          nightExtra = autoTotal * 0.25;
          autoTotal += nightExtra;
        }

        const taxiBase = 28.0;
        let taxiTotal = taxiBase + extraKm * 18.66;
        if (isNight) {
          taxiTotal += taxiTotal * 0.25;
        }

        fares.push(
          {
            vehicle_category: 'Metered Auto-Rickshaw',
            base_fare_inr: 23.0,
            per_km_rate_inr: 15.33,
            night_surcharge_inr: Math.round(nightExtra * 100) / 100,
            total_estimated_inr: Math.round(autoTotal),
            notes: 'Official Mumbai RTO Meter Fare (Zero Surge Pricing)',
          },
          {
            vehicle_category: 'Kaali-Peeli Taxi (Non-AC)',
            base_fare_inr: 28.0,
            per_km_rate_inr: 18.66,
            night_surcharge_inr: Math.round(nightExtra * 100) / 100,
            total_estimated_inr: Math.round(taxiTotal),
            notes: 'Official Mumbai Taxi Meter Fare',
          },
          {
            vehicle_category: 'App Cab Prime (AC)',
            base_fare_inr: 50.0,
            per_km_rate_inr: 18.0,
            night_surcharge_inr: 0,
            total_estimated_inr: Math.round(60.0 + dist * 17.5),
            notes: 'Includes AC, Dynamic demand pricing applies',
          }
        );
        break;
      }

      case 'BENGALURU': {
        const autoBase = 30.0;
        const extraKm = Math.max(0, dist - 2.0);
        let autoTotal = autoBase + extraKm * 15.0;
        let nightExtra = 0.0;
        if (isNight) {
          nightExtra = autoTotal * 0.5;
          autoTotal += nightExtra;
        }

        fares.push(
          {
            vehicle_category: 'Metered Auto-Rickshaw',
            base_fare_inr: 30.0,
            per_km_rate_inr: 15.0,
            night_surcharge_inr: Math.round(nightExtra * 100) / 100,
            total_estimated_inr: Math.round(autoTotal),
            notes: 'Official Bengaluru RTO Meter Fare (+50% between 10PM-5AM)',
          },
          {
            vehicle_category: 'App Cab Economy',
            base_fare_inr: 60.0,
            per_km_rate_inr: 16.0,
            night_surcharge_inr: 0,
            total_estimated_inr: Math.round(70.0 + dist * 16.5),
            notes: 'App-based dynamic cab',
          }
        );
        break;
      }

      default: {
        // Delhi NCR
        const autoBase = 30.0;
        const extraKm = Math.max(0, dist - 1.5);
        let autoTotal = autoBase + extraKm * 11.0;
        let nightExtra = 0.0;
        if (isNight) {
          nightExtra = autoTotal * 0.25;
          autoTotal += nightExtra;
        }

        fares.push(
          {
            vehicle_category: 'Metered Auto-Rickshaw',
            base_fare_inr: 30.0,
            per_km_rate_inr: 11.0,
            night_surcharge_inr: Math.round(nightExtra * 100) / 100,
            total_estimated_inr: Math.round(autoTotal),
            notes: 'Official Delhi Transport Department Meter Tariff',
          },
          {
            vehicle_category: 'App Cab Mini (AC)',
            base_fare_inr: 50.0,
            per_km_rate_inr: 14.5,
            night_surcharge_inr: 0,
            total_estimated_inr: Math.round(55.0 + dist * 14.5),
            notes: 'Standard Cab Tier',
          },
          {
            vehicle_category: 'App Bike Taxi',
            base_fare_inr: 20.0,
            per_km_rate_inr: 6.5,
            night_surcharge_inr: 0,
            total_estimated_inr: Math.round(25.0 + dist * 7.0),
            notes: 'Fastest navigation through congested gullies',
          }
        );
        break;
      }
    }

    return {
      city,
      distance_km: dist,
      duration_minutes: req.duration_minutes ?? req.durationMinutes ?? Math.round(dist * 3.5),
      is_night_surcharge_active: isNight,
      fare_options: fares,
    };
  }
}

export const fareService = new FareService();
export const fareEstimationEngineService = fareService;
