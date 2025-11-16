export const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export const DAY_LABELS = {
  monday: { short: 'Lun', full: 'Lunedì' },
  tuesday: { short: 'Mar', full: 'Martedì' },
  wednesday: { short: 'Mer', full: 'Mercoledì' },
  thursday: { short: 'Gio', full: 'Giovedì' },
  friday: { short: 'Ven', full: 'Venerdì' },
  saturday: { short: 'Sab', full: 'Sabato' },
  sunday: { short: 'Dom', full: 'Domenica' }
};

export const sortSlots = (slots = []) =>
  [...slots].sort((a, b) => {
    const dayDiff = DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day);
    if (dayDiff !== 0) return dayDiff;
    return a.start.localeCompare(b.start);
  });

export const summarizeWorkingHours = workingHours => {
  const slots = sortSlots(workingHours?.slots || []);
  if (slots.length === 0) return 'Disponibile 24/7';
  const preview = slots.slice(0, 3).map(slot => `${DAY_LABELS[slot.day]?.short || slot.day} ${slot.start}-${slot.end}`);
  let summary = preview.join(' · ');
  if (slots.length > 3) summary += ' · …';
  return summary;
};

export const buildDailySchedule = workingHours => {
  const slots = workingHours?.slots || [];
  return DAY_ORDER.map(day => ({
    day,
    label: DAY_LABELS[day]?.full || day,
    slots: slots
      .filter(slot => slot.day === day)
      .sort((a, b) => a.start.localeCompare(b.start))
  }));
};

export const resolveTimezoneLabel = workingHours => workingHours?.timezone || 'Europe/Rome';
