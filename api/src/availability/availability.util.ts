const CAIRO_TZ = 'Africa/Cairo';
const SLOT_MINUTES = 60; // BR-1: sessions are always exactly 60 minutes

export interface WorkingHourBlock {
  day_of_week: number; // 0 = Sunday ... 6 = Saturday
  start_hour: number;
  end_hour: number;
}

export interface TimeOffBlock {
  starts_at: Date;
  ends_at: Date;
}

export interface AvailabilityInput {
  from: string; // "YYYY-MM-DD", inclusive, Cairo calendar date
  to: string; // "YYYY-MM-DD", inclusive, Cairo calendar date
  now: Date; // current instant, so callers can pass a fixed time in tests
  workingHours: WorkingHourBlock[];
  timeOff: TimeOffBlock[];
  confirmedAppointmentStarts: Set<number>; // epoch ms of each confirmed appointment's starts_at
}

export interface AvailableSlot {
  starts_at: Date;
  ends_at: Date;
}

/**
 * Gets Africa/Cairo's UTC offset, in minutes, at a given instant. Reads it
 * from the platform's own IANA tzdata via Intl instead of hardcoding
 * UTC+2/+3 - Egypt's DST rules have been toggled on and off by decree
 * several times in recent years, so a hardcoded offset would silently go
 * stale.
 */
function cairoUtcOffsetMinutes(instant: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: CAIRO_TZ,
    timeZoneName: 'longOffset',
  }).formatToParts(instant);

  const offset = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+00:00';
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(offset);
  if (!match) return 0;

  const sign = match[1] === '-' ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
}

/**
 * Converts a Cairo wall-clock date + hour (e.g. "2026-09-01", 9) into the
 * UTC instant it actually refers to. Two passes: the first guess treats
 * the wall-clock numbers as if they were UTC, then corrects by Cairo's
 * offset at that guess - a second pass re-reads the offset at the
 * corrected instant in case the guess landed on the wrong side of a DST
 * transition (only matters within a couple of hours of the switchover).
 */
export function cairoWallTimeToUtc(dateStr: string, hour: number): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  let instant = new Date(Date.UTC(year, month - 1, day, hour, 0, 0));

  for (let i = 0; i < 2; i++) {
    const offsetMinutes = cairoUtcOffsetMinutes(instant);
    instant = new Date(Date.UTC(year, month - 1, day, hour, 0, 0) - offsetMinutes * 60_000);
  }

  return instant;
}

/**
 * The inverse of cairoWallTimeToUtc: given a UTC instant, what Cairo
 * calendar date does it fall on? Used to ask "is this the slot the client
 * thinks it is" - the appointments module reuses computeAvailableSlots for
 * a single day rather than re-implementing the same working-hours/time-off
 * logic a second time.
 */
export function cairoDateStringOf(instant: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: CAIRO_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

function dayOfWeekOf(dateStr: string): number {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function nextDateStr(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return next.toISOString().slice(0, 10);
}

/**
 * BR-3: available = working_hours - time_off - confirmed_appointments -
 * past_slots. Walks each Cairo calendar date in [from, to], generates every
 * on-the-hour candidate slot from that day's working-hour blocks (BR-2),
 * then removes anything that fails one of the four subtractions. day 6 to
 * day 0 (a week boundary) needs no special handling, since day_of_week is
 * computed independently per date rather than carried between iterations.
 */
export function computeAvailableSlots(input: AvailabilityInput): AvailableSlot[] {
  const slots: AvailableSlot[] = [];

  for (let date = input.from; date <= input.to; date = nextDateStr(date)) {
    const dayOfWeek = dayOfWeekOf(date);
    const blocksForDay = input.workingHours.filter((b) => b.day_of_week === dayOfWeek);

    for (const block of blocksForDay) {
      for (let hour = block.start_hour; hour < block.end_hour; hour++) {
        const starts_at = cairoWallTimeToUtc(date, hour);
        const ends_at = new Date(starts_at.getTime() + SLOT_MINUTES * 60_000);

        if (starts_at < input.now) continue; // past_slots

        if (input.confirmedAppointmentStarts.has(starts_at.getTime())) continue; // confirmed_appointments

        const blockedByTimeOff = input.timeOff.some(
          (t) => starts_at < t.ends_at && ends_at > t.starts_at, // interval overlap
        );
        if (blockedByTimeOff) continue; // time_off

        slots.push({ starts_at, ends_at });
      }
    }
  }

  slots.sort((a, b) => a.starts_at.getTime() - b.starts_at.getTime());
  return slots;
}
