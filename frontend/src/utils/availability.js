const labels = {
  online: 'Online',
  busy: 'Occupato', 
  offline: 'Offline'
};

export const resolveAvailabilityStatus = value => {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  const status = ['online', 'busy', 'offline'].includes(normalized) ? normalized : 'offline';
  return {
    status,
    label: labels[status] || labels.offline
  };
};
