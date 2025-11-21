/**
 * Privacy utility functions to ensure only public information is shared between masters and clients
 */

/**
 * Get the public display name for a user, ensuring no sensitive information is exposed
 * @param {Object} user - User object
 * @param {string} fallback - Fallback name if no display name is available
 * @returns {string} Public display name
 */
export const getPublicDisplayName = (user, fallback = 'Utente') => {
  if (!user) return fallback;
  
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
  
  // Never expose email or other sensitive information
  return fallback;
};

/**
 * Sanitize user object to only include public information
 * @param {Object} user - User object
 * @param {string} role - Role context ('master' or 'client')
 * @returns {Object} Sanitized user object
 */
export const sanitizeUserForPublic = (user, role = 'client') => {
  if (!user) return null;
  
  const publicName = getPublicDisplayName(user, role === 'master' ? 'Master' : 'Cliente');
  
  return {
    id: user._id || user.id,
    name: publicName,
    avatar_url: user.avatar_url || null
  };
};

/**
 * Sanitize transaction metadata to ensure only public names are stored
 * @param {Object} meta - Transaction metadata
 * @param {Object} master - Master object
 * @param {Object} customer - Customer object
 * @returns {Object} Sanitized metadata
 */
export const sanitizeTransactionMeta = (meta, master = null, customer = null) => {
  const sanitized = { ...meta };
  
  if (master) {
    sanitized.master = getPublicDisplayName(master, 'Master');
  }
  
  if (customer) {
    sanitized.customer = getPublicDisplayName(customer, 'Cliente');
  }
  
  return sanitized;
};