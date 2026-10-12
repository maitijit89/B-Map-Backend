import { TimeZoneResult } from './timezone.types';

export class TimeZoneService {
  public getTimeZone(lat: number, lng: number): TimeZoneResult {
    let zoneId = 'America/Los_Angeles';
    let zoneName = 'Pacific Standard Time';
    let rawOffset = -28800;
    let dstOffset = 3600;

    if (lng > 65 && lng <= 95) {
      zoneId = 'Asia/Kolkata';
      zoneName = 'India Standard Time';
      rawOffset = 19800;
      dstOffset = 0;
    } else if (lng > -105 && lng <= -85) {
      zoneId = 'America/Chicago';
      zoneName = 'Central Standard Time';
      rawOffset = -21600;
    } else if (lng > -85 && lng <= -65) {
      zoneId = 'America/New_York';
      zoneName = 'Eastern Standard Time';
      rawOffset = -18000;
    } else if (lng > -15 && lng <= 30) {
      zoneId = 'Europe/London';
      zoneName = 'Greenwich Mean Time';
      rawOffset = 0;
    }

    return {
      status: 'OK',
      timeZoneId: zoneId,
      timeZoneName: zoneName,
      rawOffset,
      dstOffset,
    };
  }
}

export const timezoneService = new TimeZoneService();
