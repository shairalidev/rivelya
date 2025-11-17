const decodeSegment = segment => {
  if (!segment) return null;
  const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 ? '='.repeat(4 - (normalized.length % 4)) : '';
  const base64 = normalized + padding;

  if (typeof atob === 'function') {
    return atob(base64);
  }

  if (typeof Buffer !== 'undefined') {
    return Buffer.from(base64, 'base64').toString('utf-8');
  }

  throw new Error('No base64 decoder available');
};

export const decodeTokenPayload = tokenString => {
  if (!tokenString) return null;
  const parts = tokenString.split('.');
  if (parts.length < 2) return null;

  try {
    const json = decodeSegment(parts[1]);
    return json ? JSON.parse(json) : null;
  } catch (error) {
    console.warn('Unable to decode auth token payload.', error);
    return null;
  }
};

export const decodeTokenSub = tokenString => {
  const payload = decodeTokenPayload(tokenString);
  return payload?.sub || null;
};
