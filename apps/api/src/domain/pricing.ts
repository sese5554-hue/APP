import type {
  BookingStatus,
  Price,
} from "../../../../packages/contracts/index.js";
import { ensure } from "../lib/errors.js";
export function calculatePrice(
  dailyPrice: number,
  insuranceDaily: number,
  startsAt: string,
  endsAt: string,
): Price {
  const milliseconds = Date.parse(endsAt) - Date.parse(startsAt);
  ensure(
    Number.isFinite(milliseconds) &&
      milliseconds > 0 &&
      milliseconds <= 366 * 86400000,
    400,
    "INVALID_PERIOD",
    "대여 기간은 0일 초과 366일 이하여야 합니다.",
  );
  ensure(
    Number.isSafeInteger(dailyPrice) &&
      dailyPrice > 0 &&
      dailyPrice <= 1_000_000 &&
      Number.isSafeInteger(insuranceDaily) &&
      insuranceDaily >= 0 &&
      insuranceDaily <= 1_000_000,
    400,
    "INVALID_PRICE",
    "유효하지 않은 요금입니다.",
  );
  const days = Math.ceil(milliseconds / 86400000),
    rental = days * dailyPrice,
    insurance = days * insuranceDaily;
  const guestFee = Math.floor(rental / 10),
    hostCommission = Math.floor(rental / 10);
  return {
    days,
    rental,
    insurance,
    guestFee,
    hostCommission,
    total: rental + insurance + guestFee,
    hostNet: rental - hostCommission,
    includedKm: days * 130,
    extraKmPrice: 300,
  };
}
const transitions: Record<BookingStatus, BookingStatus[]> = {
  REQUESTED: ["APPROVED", "REJECTED", "CANCELLED", "EXPIRED"],
  APPROVED: ["CONFIRMED", "CANCELLED", "EXPIRED"],
  CONFIRMED: ["IN_USE", "CANCELLED"],
  IN_USE: ["RETURNED"],
  RETURNED: ["SETTLEMENT_PENDING"],
  SETTLEMENT_PENDING: ["COMPLETED"],
  COMPLETED: [],
  REJECTED: [],
  CANCELLED: [],
  EXPIRED: [],
};
export function assertTransition(from: BookingStatus, to: BookingStatus) {
  ensure(
    transitions[from]?.includes(to),
    409,
    "INVALID_STATE",
    "현재 예약 상태에서 진행할 수 없습니다.",
  );
}
export function distanceFee(
  pickup: number,
  returned: number,
  included: number,
  unit: number,
) {
  ensure(
    Number.isInteger(pickup) &&
      Number.isInteger(returned) &&
      returned >= pickup,
    400,
    "ODOMETER_DECREASE",
    "반납 주행거리는 인수 주행거리보다 작을 수 없습니다.",
  );
  return Math.max(0, returned - pickup - included) * unit;
}
