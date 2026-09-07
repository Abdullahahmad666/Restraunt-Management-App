/**
 * GPS coordinates carry far more precision than anything downstream uses.
 *
 * The backend columns hold six decimal places - about 11 cm, well below what
 * GPS itself is accurate to - so the remaining digits of a
 * `getCurrentPositionAsync` reading are noise. The server rounds them anyway,
 * but sending pre-rounded values keeps the payload honest about how much is
 * actually known, and keeps what the app displays identical to what was stored.
 */
export const COORDINATE_DECIMALS = 6;

export function roundCoordinate(value: number): number {
  return Number(value.toFixed(COORDINATE_DECIMALS));
}
