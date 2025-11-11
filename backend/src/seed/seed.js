#!/usr/bin/env node
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Always load .env from backend root
const envPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });

console.log("✅ Loaded .env from:", envPath);
console.log("MONGO_URI =>", process.env.MONGO_URI);

// Validate
if (!process.env.MONGO_URI) {
  console.error("❌ MONGO_URI missing. Check .env file.");
  process.exit(1);
}

// ✅ IMPORT DB *AFTER* dotenv is loaded
await import('../config/db.js');

// ✅ Now import models
import { Master } from '../models/master.model.js';
import { User } from '../models/user.model.js';
import { Wallet } from '../models/wallet.model.js';
import { Transaction } from '../models/transaction.model.js';
import { Session } from '../models/session.model.js';
import { Review } from '../models/review.model.js';


// --- Seeder logic starts here ---
const PASSWORD = process.env.SEED_USER_PASSWORD || 'Rivelya!2024';

const createAccount = async (userPayload, walletPayload = {}) => {
  const wallet = await Wallet.create({ currency: 'EUR', balance_cents: 0, ...walletPayload });
  const user = await User.create({
    ...userPayload,
    wallet_id: wallet._id,
    is_email_verified: true,
    email_verification_token: undefined,
    email_verification_expires: undefined
  });
  wallet.owner_id = user._id;
  await wallet.save();
  return { user, wallet };
};

try {
  console.log('🔄 Resetting collections...');
  await Promise.all([
    Master.deleteMany({}),
    User.deleteMany({}),
    Wallet.deleteMany({}),
    Transaction.deleteMany({}),
    Session.deleteMany({}),
    Review.deleteMany({})
  ]);


  console.log('✨ Creating demo users and masters...');

  const mastersSeed = [
    {
      account: { email: 'luna@rivelya.com', phone: '+39 339 124 5687', roles: ['master'] },
      profile: {
        display_name: 'Luna Armonia',
        headline: 'Cartomante empatica e guida spirituale',
        bio: 'Accompagno le persone verso nuove consapevolezze utilizzando tarocchi evolutivi, cristalli e rituali di armonizzazione.',
        categories: ['cartomanzia', 'spiritualità'],
        specialties: ['Tarocchi evolutivi', 'Cristalloterapia', 'Meditazione guidata'],
        experience_years: 12,
        languages: ['it'],
        rate_phone_cpm: 249,
        rate_chat_cpm: 199,
        availability: 'online',
        media: { avatar_url: 'https://images.unsplash.com/photo-1545239351-1141bd82e8a6?auto=format&fit=crop&w=640&q=80' },
        kpis: { lifetime_calls: 1824, lifetime_chats: 932, avg_rating: 4.9, review_count: 318 }
      }
    },
    {
      account: { email: 'matteo.rinaldi@rivelya.com', phone: '+39 02 8723 4456', roles: ['master'] },
      profile: {
        display_name: 'Avv. Matteo Rinaldi',
        headline: 'Consulente legale per famiglie e PMI',
        bio: 'Offro supporto rapido su diritto di famiglia, contrattualistica e tutela del patrimonio aziendale con un approccio chiaro e concreto.',
        categories: ['legale', 'aziendale'],
        specialties: ['Diritto di famiglia', 'Contrattualistica', 'Startup e PMI'],
        experience_years: 15,
        languages: ['it', 'en'],
        rate_phone_cpm: 349,
        rate_chat_cpm: 299,
        availability: 'online',
        media: { avatar_url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=640&q=80' },
        kpis: { lifetime_calls: 956, lifetime_chats: 1204, avg_rating: 4.8, review_count: 276 }
      }
    },
    {
      account: { email: 'elisa.moretti@rivelya.com', phone: '+39 345 778 2091', roles: ['master'] },
      profile: {
        display_name: 'Coach Elisa Moretti',
        headline: 'Mindset coach e trainer certificata',
        bio: 'Aiuto professionisti e imprenditori a ritrovare focus, energia e chiarezza con percorsi personalizzati e tecniche di mindfulness.',
        categories: ['coaching', 'mindfulness'],
        specialties: ['Executive coaching', 'Gestione dello stress', 'Performance personale'],
        experience_years: 10,
        languages: ['it', 'en'],
        rate_phone_cpm: 299,
        rate_chat_cpm: 249,
        availability: 'busy',
        media: { avatar_url: 'https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=640&q=80' },
        kpis: { lifetime_calls: 1432, lifetime_chats: 2011, avg_rating: 4.7, review_count: 412 }
      }
    },
    {
      account: { email: 'sara.venturi@rivelya.com', phone: '+39 328 556 2103', roles: ['master'] },
      profile: {
        display_name: 'Dott.ssa Sara Venturi',
        headline: 'Psicologa del benessere e terapeuta EMDR',
        bio: 'Specializzata in percorsi brevi e mirati per gestire ansia, burnout e blocchi emotivi. Sessioni in italiano e inglese.',
        categories: ['benessere', 'psicologia'],
        specialties: ['Ansia e stress', 'Tecniche EMDR', 'Mind-body balance'],
        experience_years: 9,
        languages: ['it', 'en'],
        rate_phone_cpm: 329,
        rate_chat_cpm: 289,
        availability: 'online',
        media: { avatar_url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=640&q=80' },
        kpis: { lifetime_calls: 764, lifetime_chats: 1689, avg_rating: 4.95, review_count: 502 }
      }
    },
    {
      account: { email: 'omar.lux@rivelya.com', phone: '+39 327 618 0045', roles: ['master'] },
      profile: {
        display_name: 'Maestro Omar Lux',
        headline: 'Esperto di energie sottili e ritualistica',
        bio: 'Da oltre 20 anni accompagno le persone a ritrovare equilibrio energetico con rituali mirati, reiki e percorsi di protezione.',
        categories: ['cartomanzia', 'energia'],
        specialties: ['Pulizia energetica', 'Rituali personalizzati', 'Reiki avanzato'],
        experience_years: 20,
        languages: ['it', 'fr'],
        rate_phone_cpm: 279,
        rate_chat_cpm: 229,
        availability: 'offline',
        media: { avatar_url: 'https://images.unsplash.com/photo-1545243424-0ce743321e11?auto=format&fit=crop&w=640&q=80' },
        kpis: { lifetime_calls: 2210, lifetime_chats: 1408, avg_rating: 4.6, review_count: 268 }
      }
    },
    {
      account: { email: 'federica.rossi@rivelya.com', phone: '+39 331 442 0987', roles: ['master'] },
      profile: {
        display_name: 'Consulente Federica Rossi',
        headline: 'Financial coach per liberi professionisti',
        bio: 'Supporto freelance e microimprese nella pianificazione economica, analisi dei margini e gestione del cashflow quotidiano.',
        categories: ['business', 'coaching'],
        specialties: ['Gestione cashflow', 'Pianificazione fiscale', 'Strategie di pricing'],
        experience_years: 8,
        languages: ['it'],
        rate_phone_cpm: 309,
        rate_chat_cpm: 259,
        availability: 'online',
        media: { avatar_url: 'https://images.unsplash.com/photo-1545239351-ef35f43d514b?auto=format&fit=crop&w=640&q=80' },
        kpis: { lifetime_calls: 542, lifetime_chats: 873, avg_rating: 4.85, review_count: 189 }
      }
    }
  ];

  // Create master accounts in parallel
  const masterAccounts = await Promise.all(
    mastersSeed.map(async (entry) => {
      const { account, profile } = entry;
      const [firstName = '', ...rest] = (profile.display_name || '').split(' ');
      const { user, wallet } = await createAccount({
        email: account.email,
        password: PASSWORD,
        phone: account.phone,
        roles: account.roles,
        locale: 'it-IT',
        first_name: firstName,
        last_name: rest.join(' '),
        display_name: profile.display_name
      });

      const master = await Master.create({
        user_id: user._id,
        status: 'active',
        kyc_level: 'verified',
        ...profile
      });

      return { master, user, wallet };
    })
  );

  const consumerAccount = await createAccount({
    email: 'client@rivelya.com',
    password: PASSWORD,
    phone: '+39 333 987 6543',
    roles: ['consumer'],
    locale: 'it-IT',
    first_name: 'Giulia',
    last_name: 'Conti',
    display_name: 'Giulia Conti'
  });

  console.log('🧾 Generating sessions and reviews...');
  const sessions = await Session.create([
    {
      user_id: consumerAccount.user._id,
      master_id: masterAccounts[0].master._id,
      channel: 'phone',
      start_ts: new Date(Date.now() - 1000 * 60 * 60 * 24 * 6),
      end_ts: new Date(Date.now() - 1000 * 60 * 60 * 24 * 6 + 1000 * 60 * 24),
      duration_s: 24 * 60,
      price_cpm: masterAccounts[0].master.rate_phone_cpm,
      cost_cents: 5976,
      status: 'ended'
    },
    {
      user_id: consumerAccount.user._id,
      master_id: masterAccounts[1].master._id,
      channel: 'chat',
      start_ts: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
      end_ts: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3 + 1000 * 60 * 32),
      duration_s: 32 * 60,
      price_cpm: masterAccounts[1].master.rate_chat_cpm,
      cost_cents: 9568,
      status: 'ended'
    },
    {
      user_id: consumerAccount.user._id,
      master_id: masterAccounts[2].master._id,
      channel: 'phone',
      start_ts: new Date(Date.now() - 1000 * 60 * 60 * 24),
      end_ts: new Date(Date.now() - 1000 * 60 * 60 * 24 + 1000 * 60 * 18),
      duration_s: 18 * 60,
      price_cpm: masterAccounts[2].master.rate_phone_cpm,
      cost_cents: 5382,
      status: 'ended'
    }
  ]);

  await Review.create([
    { session_id: sessions[0]._id, rating: 5, text: 'Sessione illuminante, mi ha aiutato a trovare chiarezza immediata.' },
    { session_id: sessions[1]._id, rating: 4, text: 'Risposte puntuali e concrete, ottima esperienza di consulenza.' },
    { session_id: sessions[2]._id, rating: 5, text: 'Un boost di energia e motivazione, consigli pratici da applicare subito.' }
  ]);

  const ledger = [
    { type: 'topup', amount: 20000, meta: { description: 'Ricarica Stripe', reference: 'STR12345' } },
    { type: 'topup', amount: 10000, meta: { description: 'Promo di benvenuto', reference: 'PR-BONUS' } },
    { type: 'spend', amount: -5976, meta: { master: masterAccounts[0].master.display_name, channel: 'phone', session: sessions[0]._id } },
    { type: 'spend', amount: -9568, meta: { master: masterAccounts[1].master.display_name, channel: 'chat', session: sessions[1]._id } },
    { type: 'spend', amount: -5382, meta: { master: masterAccounts[2].master.display_name, channel: 'phone', session: sessions[2]._id } }
  ];

  await Transaction.insertMany(ledger.map(entry => ({ ...entry, wallet_id: consumerAccount.wallet._id })));

  const finalBalance = ledger.reduce((acc, txn) => acc + txn.amount, 0);
  consumerAccount.wallet.balance_cents = finalBalance;
  await consumerAccount.wallet.save();

  // Double ensure all users are email verified
  await User.updateMany({}, { $set: { is_email_verified: true } });

  console.log('✅ Seed completed successfully.');
  console.log('👤 Demo consumer -> email: client@rivelya.com | password:', PASSWORD);
  console.log('👤 Demo master -> email: luna@rivelya.com | password:', PASSWORD);

  setTimeout(() => process.exit(0), 100);
} catch (error) {
  console.error('❌ Seed failed:', error);
  setTimeout(() => process.exit(1), 100);
}
