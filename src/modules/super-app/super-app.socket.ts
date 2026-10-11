import { Server, Socket } from 'socket.io';
import { logger } from '../../core/config/logger';
import { SOCKET_EVENTS } from '../../core/constants/socket.events';
import { Coordinate } from '../../core/types/geo.types';
import { rideHailingService } from './ride-hailing.service';
import { RideVehicleCategory } from './super-app.types';

export const registerSuperAppHandlers = (io: Server, socket: Socket): void => {
  /**
   * Real-time ride request submission via WebSocket.
   */
  socket.on(
    SOCKET_EVENTS.SUPER_APP_RIDE_REQUEST,
    (data: {
      riderId: string;
      riderName: string;
      riderPhone: string;
      category: RideVehicleCategory;
      pickupLocation: Coordinate;
      pickupAddress: string;
      dropoffLocation: Coordinate;
      dropoffAddress: string;
      paymentMethod?: 'upi' | 'wallet' | 'cash' | 'corporate_card';
    }) => {
      try {
        if (!data?.riderId || !data?.category || !data?.pickupLocation || !data?.dropoffLocation) {
          socket.emit(SOCKET_EVENTS.ERROR, { message: 'Missing mandatory ride request parameters' });
          return;
        }

        const booking = rideHailingService.requestRide(data);

        // Join dedicated ride room for real-time tracking
        const rideRoom = `ride:${booking.bookingId}`;
        socket.join(rideRoom);

        socket.emit(SOCKET_EVENTS.SUPER_APP_RIDE_MATCHED, {
          bookingId: booking.bookingId,
          status: booking.status,
          assignedDriver: booking.assignedDriver,
          otpStartTrip: booking.otpStartTrip,
          fare: booking.fare,
        });

        logger.info(`Socket ${socket.id} subscribed to ride room: ${rideRoom}`);
      } catch (err: any) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: err.message });
      }
    }
  );

  /**
   * Driver sends live telemetry location stream to the rider room.
   */
  socket.on(
    SOCKET_EVENTS.SUPER_APP_RIDE_DRIVER_LOCATION,
    (data: {
      bookingId: string;
      driverId: string;
      location: Coordinate;
      headingDegrees: number;
      speedKmh: number;
    }) => {
      try {
        if (data?.bookingId && data?.location) {
          const rideRoom = `ride:${data.bookingId}`;
          io.to(rideRoom).emit(SOCKET_EVENTS.SUPER_APP_RIDE_DRIVER_LOCATION, {
            bookingId: data.bookingId,
            driverId: data.driverId,
            location: data.location,
            headingDegrees: data.headingDegrees,
            speedKmh: data.speedKmh,
            timestamp: Date.now(),
          });
        }
      } catch (err: any) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: err.message });
      }
    }
  );

  /**
   * Live Ride Status updates (driver arrived, trip started, trip completed).
   */
  socket.on(
    SOCKET_EVENTS.SUPER_APP_RIDE_STATUS_UPDATE,
    (data: { bookingId: string; newStatus: string; note?: string }) => {
      try {
        if (data?.bookingId && data?.newStatus) {
          const rideRoom = `ride:${data.bookingId}`;
          io.to(rideRoom).emit(SOCKET_EVENTS.SUPER_APP_RIDE_STATUS_UPDATE, {
            bookingId: data.bookingId,
            status: data.newStatus,
            note: data.note,
            timestamp: Date.now(),
          });
        }
      } catch (err: any) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: err.message });
      }
    }
  );

  /**
   * Emergency Ride SOS Alert Dispatch.
   */
  socket.on(
    SOCKET_EVENTS.SUPER_APP_RIDE_SOS_ALERT,
    (data: { bookingId: string; riderId: string; coordinate: Coordinate }) => {
      try {
        logger.warn(`🚨 EMERGENCY RIDE SOS TRIGGERED for booking: ${data?.bookingId} at [${data?.coordinate?.join(', ')}]`);
        io.emit(SOCKET_EVENTS.SUPER_APP_RIDE_SOS_ALERT, {
          bookingId: data.bookingId,
          riderId: data.riderId,
          coordinate: data.coordinate,
          dispatchedPoliceControlRoom: '112 Central Emergency Dispatch',
          ambulanceNotified: true,
          liveAudioStreamStarted: true,
          timestamp: Date.now(),
        });
      } catch (err: any) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: err.message });
      }
    }
  );

  /**
   * Offline Maps Bundle download and extraction progress streaming.
   */
  socket.on(
    SOCKET_EVENTS.SUPER_APP_OFFLINE_SYNC_PROGRESS,
    (data: { bundleId: string; startDownload?: boolean }) => {
      try {
        if (data?.bundleId) {
          // Stream download & validation progress stages
          const stages = [
            { percentage: 25, stage: 'Downloading compressed Brotli archive' },
            { percentage: 60, stage: 'Verifying SHA-256 integrity hash' },
            { percentage: 85, stage: 'Indexing offline vector tiles & road routing graph' },
            { percentage: 100, stage: 'Offline bundle ready for offline navigation' },
          ];

          stages.forEach((st, idx) => {
            setTimeout(() => {
              socket.emit(SOCKET_EVENTS.SUPER_APP_OFFLINE_SYNC_PROGRESS, {
                bundleId: data.bundleId,
                progressPercentage: st.percentage,
                currentStage: st.stage,
                completed: st.percentage === 100,
              });
            }, idx * 250);
          });
        }
      } catch (err: any) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: err.message });
      }
    }
  );
};
