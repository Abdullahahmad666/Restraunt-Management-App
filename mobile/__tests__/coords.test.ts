import {COORDINATE_DECIMALS, roundCoordinate} from '../src/utils/coords';

describe('roundCoordinate', () => {
  it('trims a real GPS reading to what the backend stores', () => {
    // The exact shape that used to be rejected with "no more than 6 decimal
    // places" and stopped a staff member clocking in.
    expect(roundCoordinate(24.8607343212)).toBe(24.860734);
    expect(roundCoordinate(67.0011364987)).toBe(67.001136);
  });

  it('leaves a coordinate that is already short enough alone', () => {
    expect(roundCoordinate(51.5074)).toBe(51.5074);
    expect(roundCoordinate(0)).toBe(0);
  });

  it('handles negatives, which is most of the western hemisphere', () => {
    expect(roundCoordinate(-0.12775987654321)).toBe(-0.12776);
  });

  it('matches the precision the columns hold', () => {
    expect(COORDINATE_DECIMALS).toBe(6);
  });
});
