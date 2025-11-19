import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

const defaultCacheDir = path.resolve(projectRoot, process.env.MEDIA_CACHE_DIR || 'media-cache');
const cacheTtl = Number(process.env.MEDIA_CACHE_TTL_MS ?? 1000 * 60 * 60 * 24);

const normalizeKey = key => key?.replace(/^\/+/, '') || '';

export const getCachePathForKey = key => path.resolve(defaultCacheDir, normalizeKey(key));

const ensureDirForPath = async filePath => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
};

export const readCachedMedia = async key => {
  if (!key) return null;
  const filePath = getCachePathForKey(key);
  try {
    const stats = await fs.stat(filePath);
    if (cacheTtl > 0 && Date.now() - stats.mtimeMs > cacheTtl) {
      await fs.unlink(filePath).catch(() => {});
      return null;
    }
    const buffer = await fs.readFile(filePath);
    return { buffer, filePath };
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
};

export const cacheMediaBuffer = async (key, buffer) => {
  if (!key || !buffer) return null;
  const filePath = getCachePathForKey(key);
  await ensureDirForPath(filePath);
  await fs.writeFile(filePath, buffer);
  return filePath;
};

export const purgeCachedMedia = async key => {
  if (!key) return;
  const filePath = getCachePathForKey(key);
  await fs.unlink(filePath).catch(error => {
    if (error.code !== 'ENOENT') throw error;
  });
};
