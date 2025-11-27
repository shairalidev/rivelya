import express from 'express';
import multer from 'multer';
import { sendMail } from '../lib/mailer.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

const router = express.Router();

const getRecipient = () => process.env.SUPPORT_EMAIL_RECIPIENT
  || process.env.SUPPORT_EMAIL
  || 'support@rivelya.com';

router.post('/', upload.single('screenshot'), async (req, res, next) => {
  const {
    target,
    name,
    email,
    issueType,
    description,
    consent
  } = req.body;

  if (!target || !name || !email || !issueType || !description || consent !== 'on') {
    return res.status(400).json({ message: 'Compila tutti i campi obbligatori e accetta la privacy.' });
  }

  const recipient = getRecipient();
  const emailSubject = `Richiesta di supporto Rivelya (${target})`;
  const htmlParts = [
    `<p><strong>Target:</strong> ${target}</p>`,
    `<p><strong>Nome:</strong> ${name}</p>`,
    `<p><strong>Email:</strong> ${email}</p>`,
    `<p><strong>Tipo di problema:</strong> ${issueType}</p>`,
    `<p><strong>Descrizione:</strong><br/>${description.replace(/\n/g, '<br/>')}</p>`,
    `<p><strong>Privacy accettata:</strong> Sì</p>`
  ];

  const attachments = [];
  if (req.file) {
    attachments.push({
      filename: req.file.originalname,
      content: req.file.buffer,
      contentType: req.file.mimetype
    });
    htmlParts.push(`<p><strong>Screenshot:</strong> allegato</p>`);
  }

  try {
    await sendMail({
      to: recipient,
      subject: emailSubject,
      text: `Richiesta di supporto da ${name} (${email}) per ${target} - ${issueType}`,
      html: `<div>${htmlParts.join('')}</div>`,
      attachments
    });
    return res.status(200).json({ message: 'Richiesta inviata con successo.' });
  } catch (error) {
    return next(error);
  }
});

export default router;
