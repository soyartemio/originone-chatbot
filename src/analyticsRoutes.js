const express = require('express');
const { getGrowthSummary, recordEvent } = require('./growthAnalyticsService');

const router = express.Router();
const ALLOWED_ORIGINS = new Set(['https://originone.com.mx', 'https://www.originone.com.mx']);

router.post('/api/analytics/events', async (req, res) => {
  try {
    const origin = req.get('origin');
    if (process.env.NODE_ENV === 'production' && origin && !ALLOWED_ORIGINS.has(origin)) {
      return res.status(403).json({ success: false, error: 'Origen no permitido' });
    }
    await recordEvent(req.body || {});
    res.status(202).json({ success: true });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/api/analytics/summary', async (req, res) => {
  try {
    res.json({ success: true, ...(await getGrowthSummary(req.query.days)) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
