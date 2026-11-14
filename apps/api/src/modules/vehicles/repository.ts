import type { Sql, Row } from "../../database/db.js";
import { rows, one, json } from "../../database/db.js";
import { ensure } from "../../lib/errors.js";
export const vehicleSelect = `SELECT v.*,u.nickname AS host_nickname,
 (SELECT COALESCE(AVG(r.rating),0) FROM reviews r JOIN bookings b ON b.id=r.booking_id WHERE b.vehicle_id=v.id AND r.author_id=b.guest_id) AS rating,
 (SELECT COUNT(*) FROM reviews r JOIN bookings b ON b.id=r.booking_id WHERE b.vehicle_id=v.id AND r.author_id=b.guest_id) AS review_count
 FROM vehicles v JOIN users u ON u.id=v.host_id`;
export async function vehicleView(db: Sql, vehicle: Row, owner = false) {
  const photos = await rows(
    db,
    "SELECT p.upload_id AS id,p.angle FROM vehicle_photos p WHERE p.vehicle_id=? ORDER BY p.sort_order",
    [vehicle.id],
  );
  const keys = [
    "id",
    "hostId",
    "name",
    "year",
    "area",
    "size",
    "bodyType",
    "fuel",
    "seats",
    "transmission",
    "efficiency",
    "efficiencyUnit",
    "dailyPrice",
    "status",
    "grade",
    "latitude",
    "longitude",
    "description",
    "version",
    "hostNickname",
    "rating",
    "reviewCount",
  ];
  return {
    ...Object.fromEntries(keys.map((key) => [key, vehicle[key]])),
    latitude: owner
      ? vehicle.latitude
      : Math.round(vehicle.latitude * 1000) / 1000,
    longitude: owner
      ? vehicle.longitude
      : Math.round(vehicle.longitude * 1000) / 1000,
    options: json(vehicle.optionsJson, []),
    photos: photos.map((p) => ({ ...p, url: `/api/uploads/${p.id}` })),
    ...(owner
      ? {
          registrationPlate: vehicle.registrationPlate,
          pickupAddress: vehicle.pickupAddress,
          pickupInstructions: vehicle.pickupInstructions,
          detailsSavedAt: vehicle.detailsSavedAt,
          verificationStatus: vehicle.verificationStatus,
        }
      : {}),
  };
}
export async function ownedVehicle(
  db: Sql,
  id: string,
  userId: string,
  lock = false,
) {
  const vehicle = await one(
    db,
    `SELECT * FROM vehicles WHERE id=? AND host_id=? AND deleted_at IS NULL${lock ? " FOR UPDATE" : ""}`,
    [id, userId],
  );
  ensure(vehicle, 404, "VEHICLE_NOT_FOUND", "차량을 찾을 수 없습니다.");
  return vehicle;
}
export const occupancySql =
  "(b.status IN ('CONFIRMED','IN_USE') OR (b.status IN ('REQUESTED','APPROVED') AND b.expires_at>UTC_TIMESTAMP(3)))";
