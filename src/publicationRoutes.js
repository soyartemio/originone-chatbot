const express = require('express');
const {
  addPublicationNote,
  createPublication,
  getPublications,
  setPublicationApproval,
  updatePublication
} = require('./publicationService');

const router = express.Router();

router.get('/api/publicaciones', async (req, res) => {
  try {
    const publications = await getPublications();
    res.json({ success: true, publications });
  } catch (error) {
    console.error('[PublicationRoutes] Error:', error);
    res.status(500).json({ success: false, error: error.message });
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
