const express = require('express');
const { createCost, getCosts, summarizeCosts, updateCost } = require('./costService');

const router = express.Router();

router.get('/api/costos', async (req, res) => {
  try {
    const costs = await getCosts();
    res.json({ success: true, costs, summary: summarizeCosts(costs) });
  } catch (error) {
    console.error('[CostRoutes] Error obteniendo costos:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/api/costos', async (req, res) => {
  try {
    const cost = await createCost(req.body);
    res.status(201).json({ success: true, cost });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.patch('/api/costos/:id', async (req, res) => {
  try {
    const cost = await updateCost(req.params.id, req.body);
    if (!cost) return res.status(404).json({ success: false, error: 'Costo no encontrado' });
    res.json({ success: true, cost });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
