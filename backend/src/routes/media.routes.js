import { Router } from 'express';
import mime from 'mime-types';
import { getObjectFromS3 } from '../lib/s3.js';
import { cacheMediaBuffer, readCachedMedia } from '../lib/media-cache.js';

const router = Router();

const streamToBuffer = async body => {
  if (!body) return null;
  if (Buffer.isBuffer(body)) return body;
  const chunks = [];
  for await (const chunk of body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};

const resolveKey = rawKey => {
  if (!rawKey) return '';
  const decoded = decodeURIComponent(rawKey);
  if (decoded.includes('..')) return '';
  return decoded.replace(/^\/+/, '');
};

router.get('/:key(*)', async (req, res, next) => {
  try {
    const key = resolveKey(req.params.key);
    if (!key) {
      return res.status(404).json({ message: 'Media non trovata' });
    }

    const cached = await readCachedMedia(key);
    if (cached?.buffer) {
      const type = mime.lookup(key) || 'application/octet-stream';
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.contentType(type);
      return res.send(cached.buffer);
    }

    const object = await getObjectFromS3(key);
    if (!object) {
      return res.status(404).json({ message: 'Media non trovata' });
    }

    const buffer = await streamToBuffer(object.Body);
    await cacheMediaBuffer(key, buffer);

    const type = object.ContentType || mime.lookup(key) || 'application/octet-stream';
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.contentType(type);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});

export default router;
