import { S3Client, DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

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
const publicBase = process.env.AWS_S3_PUBLIC_URL_BASE;

export const getPublicUrlForKey = key => {
  if (!key) return null;
  if (publicBase) return `${publicBase.replace(/\/$/, '')}/${key}`;
  if (!process.env.AWS_REGION || !bucket) return null;
  return `https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
};

export const uploadToS3 = async ({ key, body, contentType, acl = process.env.AWS_S3_ACL || 'public-read' }) => {
  if (!bucket) throw new Error('Missing AWS_S3_BUCKET configuration');
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      ACL: acl
    })
  );
  return { key, url: getPublicUrlForKey(key) };
};

export const deleteFromS3 = async key => {
  if (!bucket || !key) return;
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
};
