import nodemailer from 'nodemailer';

let transporter;

const ensureTransporter = () => {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST) {
    console.warn('SMTP_HOST not configured, email delivery disabled');
    return null;
  }
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      : undefined
  });
  return transporter;
};

export const sendMail = async options => {
  const tx = ensureTransporter();
  if (!tx) {
    console.info('Email not sent (no SMTP configuration). Requested payload:', options?.subject);
    return null;
  }
  const from = process.env.MAIL_FROM || 'Rivelya <no-reply@rivelya.com>';
  return tx.sendMail({ from, ...options });
};
