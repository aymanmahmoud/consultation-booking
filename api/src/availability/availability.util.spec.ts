import { cairoWallTimeToUtc, computeAvailableSlots } from './availability.util';

// Reference week used throughout: Mon 2026-09-07 .. Sun 2026-09-13.
// September falls in Egypt's DST period (UTC+3), so Cairo 09:00 == 06:00Z.
// Verified independently against the live server before writing these.
const FAR_PAST = new Date('2020-01-01T00:00:00.000Z');

function isoTimes(slots: { starts_at: Date }[]): string[] {
  return slots.map((s) => s.starts_at.toISOString());
}

describe('cairoWallTimeToUtc', () => {
  it('applies UTC+2 in winter (standard time)', () => {
    expect(cairoWallTimeToUtc('2027-01-15', 9).toISOString()).toBe('2027-01-15T07:00:00.000Z');
  });

  it('applies UTC+3 in summer (DST)', () => {
    expect(cairoWallTimeToUtc('2027-07-15', 9).toISOString()).toBe('2027-07-15T06:00:00.000Z');
  });

  it('rolls hour 24 into the next calendar day', () => {
    // Midnight at the start of 2026-09-02 Cairo time, i.e. the exclusive
    // upper bound the service uses for a range ending on 2026-09-01.
    expect(cairoWallTimeToUtc('2026-09-01', 24).toISOString()).toBe('2026-09-01T21:00:00.000Z');
  });
});

describe('computeAvailableSlots', () => {
  it('returns nothing when the consultant has no working hours at all', () => {
    const slots = computeAvailableSlots({
      from: '2026-09-07',
      to: '2026-09-13',
      now: FAR_PAST,
      workingHours: [],
      timeOff: [],
      confirmedAppointmentStarts: new Set(),
    });
    expect(slots).toEqual([]);
  });

  it('produces no slots on days outside the working-hours schedule', () => {
    // Mon-Fri 9-17 only; querying the full week should skip Sat/Sun (day 6, 0).
    const slots = computeAvailableSlots({
      from: '2026-09-07',
      to: '2026-09-13',
      now: FAR_PAST,
      workingHours: [1, 2, 3, 4, 5].map((day_of_week) => ({ day_of_week, start_hour: 9, end_hour: 17 })),
      timeOff: [],
      confirmedAppointmentStarts: new Set(),
    });

    expect(slots).toHaveLength(40); // 5 days * 8 one-hour slots (9..16 start hours)
    const datesWithSlots = new Set(slots.map((s) => s.starts_at.toISOString().slice(0, 10)));
    expect(datesWithSlots).toEqual(new Set(['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11']));
  });

  it('removes every slot on a day fully blocked by time off, leaving other days untouched', () => {
    const slots = computeAvailableSlots({
      from: '2026-09-07',
      to: '2026-09-11',
      now: FAR_PAST,
      workingHours: [1, 2, 3, 4, 5].map((day_of_week) => ({ day_of_week, start_hour: 9, end_hour: 17 })),
      timeOff: [
        {
          // Cairo midnight-to-midnight for Wednesday 2026-09-09.
          starts_at: new Date('2026-09-08T21:00:00.000Z'),
          ends_at: new Date('2026-09-09T21:00:00.000Z'),
        },
      ],
      confirmedAppointmentStarts: new Set(),
    });

    expect(slots).toHaveLength(32); // 4 remaining days * 8 slots
    const datesWithSlots = new Set(slots.map((s) => s.starts_at.toISOString().slice(0, 10)));
    expect(datesWithSlots).not.toContain('2026-09-09');
  });

  it('removes only the booked slot on a partially booked day', () => {
    const bookedStart = new Date('2026-09-07T09:00:00.000Z'); // 12pm Cairo
    const slots = computeAvailableSlots({
      from: '2026-09-07',
      to: '2026-09-07',
      now: FAR_PAST,
      workingHours: [{ day_of_week: 1, start_hour: 9, end_hour: 17 }],
      timeOff: [],
      confirmedAppointmentStarts: new Set([bookedStart.getTime()]),
    });

    expect(slots).toHaveLength(7); // 8 candidates minus the 1 booked
    expect(isoTimes(slots)).not.toContain(bookedStart.toISOString());
  });

  it('handles a range crossing the week boundary (Saturday -> Sunday)', () => {
    // Deliberately different hours per day so it's unambiguous which
    // day_of_week's block produced which slot.
    const slots = computeAvailableSlots({
      from: '2026-09-12', // Saturday, day_of_week 6
      to: '2026-09-13', // Sunday, day_of_week 0
      now: FAR_PAST,
      workingHours: [
        { day_of_week: 6, start_hour: 10, end_hour: 12 },
        { day_of_week: 0, start_hour: 14, end_hour: 16 },
      ],
      timeOff: [],
      confirmedAppointmentStarts: new Set(),
    });

    expect(isoTimes(slots)).toEqual([
      '2026-09-12T07:00:00.000Z', // Sat 10am Cairo
      '2026-09-12T08:00:00.000Z', // Sat 11am Cairo
      '2026-09-13T11:00:00.000Z', // Sun 2pm Cairo
      '2026-09-13T12:00:00.000Z', // Sun 3pm Cairo
    ]);
  });

  it('excludes slots that start before "now"', () => {
    const slots = computeAvailableSlots({
      from: '2026-09-07',
      to: '2026-09-07',
      now: new Date('2026-09-07T10:00:00.000Z'), // 1pm Cairo
      workingHours: [{ day_of_week: 1, start_hour: 9, end_hour: 17 }],
      timeOff: [],
      confirmedAppointmentStarts: new Set(),
    });

    // Candidates are 06:00Z..13:00Z; only 10:00Z onward should survive.
    expect(isoTimes(slots)).toEqual([
      '2026-09-07T10:00:00.000Z',
      '2026-09-07T11:00:00.000Z',
      '2026-09-07T12:00:00.000Z',
      '2026-09-07T13:00:00.000Z',
    ]);
  });

  it('supports a split shift (multiple working-hour blocks on the same day)', () => {
    const slots = computeAvailableSlots({
      from: '2026-09-07',
      to: '2026-09-07',
      now: FAR_PAST,
      workingHours: [
        { day_of_week: 1, start_hour: 9, end_hour: 12 },
        { day_of_week: 1, start_hour: 14, end_hour: 17 },
      ],
      timeOff: [],
      confirmedAppointmentStarts: new Set(),
    });

    expect(isoTimes(slots)).toEqual([
      '2026-09-07T06:00:00.000Z',
      '2026-09-07T07:00:00.000Z',
      '2026-09-07T08:00:00.000Z',
      '2026-09-07T11:00:00.000Z',
      '2026-09-07T12:00:00.000Z',
      '2026-09-07T13:00:00.000Z',
    ]);
  });

  it('always returns slots sorted ascending, regardless of input order', () => {
    const slots = computeAvailableSlots({
      from: '2026-09-07',
      to: '2026-09-11',
      now: FAR_PAST,
      // Friday's block listed before Monday's - output order shouldn't
      // depend on this.
      workingHours: [
        { day_of_week: 5, start_hour: 9, end_hour: 10 },
        { day_of_week: 1, start_hour: 9, end_hour: 10 },
      ],
      timeOff: [],
      confirmedAppointmentStarts: new Set(),
    });

    const times = isoTimes(slots);
    const sorted = [...times].sort();
    expect(times).toEqual(sorted);
    expect(times).toEqual(['2026-09-07T06:00:00.000Z', '2026-09-11T06:00:00.000Z']);
  });
});
