import { Wallet } from '../models/wallet.model.js';

const FREE_MIN_SECONDS = 5 * 60;

export const billing = {
  async resolvePriceCpm({ user, master, channel }) {
    // First paid recharge promo and free first call handled here as flags
    let price;
    if (channel === 'chat_voice') price = master.rate_chat_voice_cpm ?? master.rate_phone_cpm;
    else price = master.rate_chat_cpm;

    // Example: if user has promo flag 'first_recharge_price_lock_cpm'
    const promoPrice = user?.promo_price_lock_cpm;
    if (promoPrice != null) price = Math.min(price, promoPrice);

    return price;
  },

  async canStartCall({ user, price_cpm }) {
    // Allow one free call up to 5 minutes if not used
    if (!user.free_call_used) return { allowed: true, free_seconds: FREE_MIN_SECONDS };
    const wallet = await Wallet.findById(user.wallet_id);
    const perMinute = price_cpm;
    const secondsAffordable = Math.floor((wallet.balance_cents / perMinute) * 60);
    return { allowed: secondsAffordable > 0, free_seconds: 0, secondsAffordable };
  }
};
