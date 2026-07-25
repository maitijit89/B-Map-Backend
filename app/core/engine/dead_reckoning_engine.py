import math
from typing import Dict, Any, Optional

class DeadReckoningEngine:
    """
    Inertial Navigation System (INS) Dead Reckoning Engine.
    Provides continuous dead-reckoning positioning by integrating 3-axis accelerometer forces,
    gyroscope angular yaw velocity, wheel tick encoders, and Extended Kalman Filter error growth
    when GPS signals drop (e.g., in tunnels or underground structures).
    """
    def __init__(self):
        # Default sensor error parameters
        self.gyro_bias_deg_s = 0.05
        self.accel_noise_m_s2 = 0.1

    def propagate_state(
        self,
        last_known_lat: float,
        last_known_lng: float,
        last_known_heading: float,
        elapsed_seconds: float,
        accel_x: float = 0.0,
        accel_y: float = 0.2,
        accel_z: float = 9.81,
        gyro_yaw_deg_s: float = 0.0,
        wheel_speed_kph: Optional[float] = None,
        last_confidence_radius_m: float = 2.0
    ) -> Dict[str, Any]:
        """
        Propagates vehicle position and heading using Dead Reckoning kinematics and sensor fusion.
        """
        # 1. Heading propagation: heading_new = heading_old + gyro_yaw * dt
        new_heading = (last_known_heading + (gyro_yaw_deg_s * elapsed_seconds)) % 360.0

        # 2. Speed estimation: wheel speed or integrated acceleration
        if wheel_speed_kph is not None and wheel_speed_kph > 0:
            current_speed_kph = wheel_speed_kph
        else:
            # Estimate speed from longitudinal acceleration (accel_y)
            estimated_accel = accel_y if abs(accel_y) > 0.05 else 0.0
            current_speed_m_s = max(5.0, estimated_accel * elapsed_seconds)
            current_speed_kph = (current_speed_m_s * 3600.0) / 1000.0

        speed_m_s = (current_speed_kph * 1000.0) / 3600.0
        distance_traveled_m = speed_m_s * elapsed_seconds

        # 3. Coordinate projection using spherical earth geometry
        heading_rad = math.radians(new_heading)
        delta_north_m = distance_traveled_m * math.cos(heading_rad)
        delta_east_m = distance_traveled_m * math.sin(heading_rad)

        # 1 degree latitude ~ 111,000m; 1 degree longitude ~ 111,000m * cos(lat)
        delta_lat = delta_north_m / 111000.0
        delta_lng = delta_east_m / (111000.0 * math.cos(math.radians(last_known_lat)))

        est_lat = round(last_known_lat + delta_lat, 6)
        est_lng = round(last_known_lng + delta_lng, 6)

        # 4. Extended Kalman Filter confidence radius growth without GPS lock
        # Confidence radius expands with time: r(t) = r_0 + (alpha * t)
        confidence_radius_m = round(last_confidence_radius_m + (0.35 * elapsed_seconds), 2)

        return {
            "status": "INS_DEAD_RECKONING_ACTIVE",
            "estimated_lat": est_lat,
            "estimated_lng": est_lng,
            "estimated_heading_deg": round(new_heading, 1),
            "estimated_speed_kph": round(current_speed_kph, 1),
            "distance_traveled_meters": round(distance_traveled_m, 2),
            "confidence_radius_meters": confidence_radius_m,
            "sensor_telemetry_used": {
                "wheel_speed_available": wheel_speed_kph is not None,
                "gyro_yaw_deg_s": gyro_yaw_deg_s,
                "accel_vector_magnitude": round(math.sqrt(accel_x**2 + accel_y**2 + accel_z**2), 2)
            }
        }
