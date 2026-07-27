const express = require('express');
const {
  addPublicationNote,
  createPublication,
  getPublications,
  setPublicationApproval,
  updatePublication
} = require('./publicationService');
const { isGoogleTtsConfigured, synthesizeVoice } = require('./googleTtsService');

const router = express.Router();

router.get('/api/publicaciones', async (req, res) => {
  try {
    const publications = await getPublications();
    const month = new Date().toISOString().slice(0, 7);
    const voiceCharactersUsed = publications.reduce((total, publication) => (
      total + (publication.voiceUsage || [])
        .filter(item => String(item.createdAt || '').startsWith(month))
        .reduce((subtotal, item) => subtotal + Number(item.characters || 0), 0)
    ), 0);
    res.json({
      success: true,
      publications,
      capabilities: {
        googleTts: isGoogleTtsConfigured(),
        assetProvider: 'pomelli',
        voiceCharactersUsed,
        voiceCharacterLimit: Number(process.env.GOOGLE_TTS_MONTHLY_CHARACTER_LIMIT || 900000)
      }
    });
  } catch (error) {
    console.error('[PublicationRoutes] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/api/publicaciones/:id/voice', async (req, res) => {
  try {
    const publications = await getPublications();
    const publication = publications.find(item => item.id === req.params.id);
    if (!publication) return res.status(404).json({ success: false, error: 'Publicación no encontrada' });
    const month = new Date().toISOString().slice(0, 7);
    const monthlyLimit = Number(process.env.GOOGLE_TTS_MONTHLY_CHARACTER_LIMIT || 900000);
    const monthlyUsage = publications.reduce((total, item) => (
      total + (item.voiceUsage || [])
        .filter(usage => String(usage.createdAt || '').startsWith(month))
        .reduce((subtotal, usage) => subtotal + Number(usage.characters || 0), 0)
    ), 0);
    const requestedCharacters = publication.voiceoverScript.length;
    if (monthlyUsage + requestedCharacters > monthlyLimit) {
      return res.status(429).json({ success: false, error: 'Se alcanzó el límite interno mensual de voz gratuita' });
    }
    const audio = await synthesizeVoice(publication.voiceoverScript, publication.voiceConfig);
    await updatePublication(publication.id, {
      voiceUsage: [...(publication.voiceUsage || []), {
        characters: requestedCharacters,
        createdAt: new Date().toISOString(),
        model: publication.voiceConfig?.name || 'es-US-Neural2-A'
      }]
    });
    const safeName = publication.title.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 80) || 'origin-one';
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': audio.length,
      'Content-Disposition': `attachment; filename="${safeName}.mp3"`,
      'Cache-Control': 'no-store'
    });
    res.send(audio);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/api/publicaciones', async (req, res) => {
  try {
    const publication = await createPublication(req.body, req.auth.username);
    res.status(201).json({ success: true, publication });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.patch('/api/publicaciones/:id', async (req, res) => {
  try {
    const publication = await updatePublication(req.params.id, req.body);
    if (!publication) return res.status(404).json({ success: false, error: 'Publicación no encontrada' });
    res.json({ success: true, publication });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/api/publicaciones/:id/notes', async (req, res) => {
  try {
    const publication = await addPublicationNote(
      req.params.id, req.body.text, req.auth.username, req.auth.displayName
    );
    if (!publication) return res.status(404).json({ success: false, error: 'Publicación no encontrada' });
    res.json({ success: true, publication });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/api/publicaciones/:id/approval', async (req, res) => {
  try {
    const publication = await setPublicationApproval(
      req.params.id, req.body.decision, req.auth.username, req.auth.displayName, req.body.note
    );
    if (!publication) return res.status(404).json({ success: false, error: 'Publicación no encontrada' });
    res.json({ success: true, publication });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
