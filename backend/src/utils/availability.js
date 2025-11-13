const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const START_MINUTES = 8 * 60; // 08:00
const END_MINUTES = 22 * 60; // 22:00
const STEP_MINUTES = 30;

export const timeToMinutes = value => {
  if (!/^\d{2}:\d{2}$/.test(value)) return 0;
  const [hours, minutes] = value.split(':').map(Number);
  return (hours * 60) + minutes;
};

export const minutesToTime = value => {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const generateBaseSegments = () => {
  const segments = [];
  for (let current = START_MINUTES; current < END_MINUTES; current += STEP_MINUTES) {
    segments.push(current);
  }
  return segments;
};

const sliceSegments = (segments, startMinutes, endMinutes) => segments.filter(minute => minute < startMinutes || minute >= endMinutes);

const toRange = (start, end) => ({ start: minutesToTime(start), end: minutesToTime(end) });

const buildRangesFromSegments = segments => {
  if (!segments.length) return [];
  const sorted = [...segments].sort((a, b) => a - b);
  const ranges = [];
  let rangeStart = sorted[0];
  let prev = sorted[0];

  for (let i = 1; i < sorted.length; i += 1) {
    const value = sorted[i];
    if (value === prev + STEP_MINUTES) {
      prev = value;
      continue;
    }
    ranges.push(toRange(rangeStart, prev + STEP_MINUTES));
    rangeStart = value;
    prev = value;
  }

  ranges.push(toRange(rangeStart, prev + STEP_MINUTES));
  return ranges;
};

const overlaps = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && bStart < aEnd;

export const checkAvailability = ({ blocks = [], bookings = [], start, end }) => {
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);
  if (Number.isNaN(startMinutes) || Number.isNaN(endMinutes)) return false;
  if (startMinutes < START_MINUTES || endMinutes > END_MINUTES) return false;
  if (endMinutes <= startMinutes) return false;
  if ((endMinutes - startMinutes) % STEP_MINUTES !== 0) return false;

  const dayHasFullBlock = blocks.some(block => block.full_day);
  if (dayHasFullBlock) return false;

  const hasBlockedOverlap = blocks.some(block => {
    if (block.full_day) return true;
    const blockStart = timeToMinutes(block.start);
    const blockEnd = timeToMinutes(block.end);
    return overlaps(startMinutes, endMinutes, blockStart, blockEnd);
  });
  if (hasBlockedOverlap) return false;

  const hasBookingOverlap = bookings.some(booking => {
    const bookingStart = timeToMinutes(booking.start_time);
    const bookingEnd = timeToMinutes(booking.end_time);
    return overlaps(startMinutes, endMinutes, bookingStart, bookingEnd);
  });

  return !hasBookingOverlap;
};

const normalizeBlocks = (blocks = []) => blocks.map(block => ({
  _id: block._id,
  date: block.date,
  full_day: block.full_day,
  start: block.start,
  end: block.end
}));

export const computeMonthAvailability = ({ year, month, blocks = [], bookings = [] }) => {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const blockByDate = blocks.reduce((acc, block) => {
    if (!acc[block.date]) acc[block.date] = [];
    acc[block.date].push(block);
    return acc;
  }, {});

  const bookingsByDate = bookings.reduce((acc, booking) => {
    if (!acc[booking.date]) acc[booking.date] = [];
    acc[booking.date].push(booking);
    return acc;
  }, {});

  const days = [];

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dayStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayBlocks = blockByDate[dayStr] || [];
    const dayBookings = bookingsByDate[dayStr] || [];

    const segments = dayBlocks.some(block => block.full_day) ? [] : generateBaseSegments();

    let availableSegments = segments;
    dayBlocks.forEach(block => {
      if (block.full_day) {
        availableSegments = [];
        return;
      }
      const blockStart = timeToMinutes(block.start);
      const blockEnd = timeToMinutes(block.end);
      availableSegments = sliceSegments(availableSegments, blockStart, blockEnd);
    });

    dayBookings.forEach(booking => {
      const bookingStart = timeToMinutes(booking.start_time);
      const bookingEnd = timeToMinutes(booking.end_time);
      availableSegments = sliceSegments(availableSegments, bookingStart, bookingEnd);
    });

    const availableRanges = buildRangesFromSegments(availableSegments);
    const fullDayBlocked = dayBlocks.some(block => block.full_day);

    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();

    days.push({
      date: dayStr,
      weekday: DAY_NAMES[weekday],
      availableRanges,
      fullDayBlocked,
      blocks: normalizeBlocks(dayBlocks),
      bookings: dayBookings.map(entry => ({
        _id: entry._id,
        start: entry.start_time,
        end: entry.end_time,
        status: entry.status,
        channel: entry.channel,
        customer_id: entry.customer_id,
        amount_cents: entry.amount_cents
      }))
    });
  }

  return { year, month, days, blocks: normalizeBlocks(blocks) };
};

export const formatMonthKey = (year, month) => `${year}-${String(month).padStart(2, '0')}`;
