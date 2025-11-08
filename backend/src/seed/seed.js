import '../config/db.js';
import { Master } from '../models/master.model.js';

await Master.deleteMany({});
await Master.create([
  { categories: ['cartomanzia'], rate_phone_cpm: 199, rate_chat_cpm: 149, availability: 'online', bio: 'Tarocchi e veggenza', languages: ['it'] },
  { categories: ['legale'], rate_phone_cpm: 299, rate_chat_cpm: 249, availability: 'offline', bio: 'Consulenze legali', languages: ['it'] },
  { categories: ['coaching'], rate_phone_cpm: 249, rate_chat_cpm: 199, availability: 'online', bio: 'Life coach', languages: ['it', 'en'] }
]);
console.log('Seeded masters');
process.exit(0);
