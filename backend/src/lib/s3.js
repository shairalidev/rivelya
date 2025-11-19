import { S3Client, DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

const hasCredentials = Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);

export const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: hasCredentials
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    : undefined
});

const bucket = process.env.AWS_S3_BUCKET;
const proxyBase = process.env.MEDIA_PROXY_BASE_URL;
const publicBase = process.env.AWS_S3_PUBLIC_URL_BASE;

const encodeKey = key =>
  encodeURIComponent(key)
    .replace(/%2F/g, '/')
    .replace(/\+/g, '%20');

export const getPublicUrlForKey = key => {
  if (!key) return null;
  if (proxyBase) return `${proxyBase.replace(/\/$/, '')}/${encodeKey(key)}`;
  if (publicBase) return `${publicBase.replace(/\/$/, '')}/${key}`;
  if (!process.env.AWS_REGION || !bucket) return null;
  return `https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
};

export const uploadToS3 = async ({ key, body, contentType }) => {
  if (!bucket) {
    console.error('AWS_S3_BUCKET not configured:', { bucket, region: process.env.AWS_REGION });
    throw new Error('Missing AWS_S3_BUCKET configuration');
  }
  
  if (!hasCredentials) {
    console.error('AWS credentials not configured');
    throw new Error('Missing AWS credentials');
  }
  
  try {
    // Remove ACL parameter as it might cause issues with newer S3 buckets
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType
      })
    );
    return { key, url: getPublicUrlForKey(key) };
  } catch (error) {
    console.error('S3 upload error:', error);
    throw error;
  }
};

export const deleteFromS3 = async key => {
  if (!bucket || !key) return;
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
};

export const getObjectFromS3 = async key => {
  if (!bucket || !key) {
    const error = new Error('Missing AWS_S3_BUCKET configuration');
    error.statusCode = 500;
    throw error;
  }
  try {
    return await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  } catch (error) {
    if (error?.$metadata?.httpStatusCode === 404 || error?.name === 'NoSuchKey') {
      return null;
    }
    throw error;
  }
};
