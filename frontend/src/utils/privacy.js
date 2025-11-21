/**
 * Privacy utility functions for the frontend to ensure only public information is displayed
 */

/**
 * Get a safe display name that doesn't expose sensitive information
 * @param {Object} user - User object
 * @param {string} fallback - Fallback name
 * @returns {string} Safe display name
 */
export const getSafeDisplayName = (user, fallback = 'Utente') => {
  if (!user) return fallback;
  
  // Use the name field if available (should already be sanitized by backend)
  if (user.name?.trim()) {
    return user.name.trim();
  }
  
  // Use display_name if available
  if (user.display_name?.trim()) {
    return user.display_name.trim();
  }
  
  // Fallback to first_name + last_name if available
  const firstName = user.first_name?.trim();
  const lastName = user.last_name?.trim();
  if (firstName || lastName) {
    return [firstName, lastName].filter(Boolean).join(' ');
  }
  
  return fallback;
};

/**
 * Sanitize user object for display, ensuring no sensitive data is shown
 * @param {Object} user - User object
 * @param {string} role - Role context ('master' or 'client')
 * @returns {Object} Sanitized user object
 */
export const sanitizeUserForDisplay = (user, role = 'client') => {
  if (!user) return null;
  
  return {
    id: user.id || user._id,
    name: getSafeDisplayName(user, role === 'master' ? 'Master' : 'Cliente'),
    avatar: user.avatar_url || user.avatarUrl || null
  };
};