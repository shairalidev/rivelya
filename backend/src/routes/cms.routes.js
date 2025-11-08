import { Router } from 'express';

const router = Router();

router.get('/pages/:slug', async (req, res) => {
  // Placeholder for FAQ/Terms/Privacy/Horoscope CMS
  res.json({ slug: req.params.slug, html: `<h1>${req.params.slug}</h1>` });
});

export default router;
