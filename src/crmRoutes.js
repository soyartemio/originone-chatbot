const express = require('express');
const router = express.Router();
const { getAppointments, updateLead, addLeadNote, deleteLead } = require('./agendaService');
const { syncInstagramInteractions } = require('./instagramSyncService');

router.post('/api/crm/sync/instagram', async (req, res) => {
  try {
    const result = await syncInstagramInteractions();
    res.json({ success: true, ...result });
  } catch (error) {
    const metaError = error.response?.data?.error;
    console.error('[CRMRoutes] Error sincronizando Instagram:', metaError?.message || error.message);
    res.status(502).json({
      success: false,
      error: metaError?.message || error.message
    });
  }
});

/**
  * GET /api/crm/leads
  * Obtener todos los leads/citas con filtros y búsqueda
  */
router.get('/api/crm/leads', async (req, res) => {
  try {
    let leads = await getAppointments();
    const { etapa, canal, q } = req.query;

    if (etapa) {
      leads = leads.filter(l => (l.etapa || 'Nuevo contacto').toLowerCase() === etapa.toLowerCase());
    }

    if (canal) {
      leads = leads.filter(l => (l.canal_origen || '').toLowerCase().includes(canal.toLowerCase()));
    }

    if (q) {
      const queryStr = q.toLowerCase();
      leads = leads.filter(l =>
        (l.nombre_cliente || '').toLowerCase().includes(queryStr) ||
        (l.empresa_o_proyecto || '').toLowerCase().includes(queryStr) ||
        (l.email || '').toLowerCase().includes(queryStr) ||
        (l.telefono_whatsapp || '').toLowerCase().includes(queryStr)
      );
    }

    res.json({
      success: true,
      total: leads.length,
      leads: leads
    });
  } catch (error) {
    console.error('[CRMRoutes] Error obteniendo leads:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
  * GET /api/crm/kpis
  * Obtener métricas y KPIs ejecutivos en tiempo real
  */
router.get('/api/crm/kpis', async (req, res) => {
  try {
    const leads = await getAppointments();
    const totalLeads = leads.length;

    const etapasCount = {
      nuevo: 0,
      cita: 0,
      diagnostico: 0,
      propuesta: 0,
      ganado: 0,
      perdido: 0
    };

    const canalesCount = {
      signal_web: 0,
      instagram: 0,
      facebook: 0,
      whatsapp: 0,
      otro: 0
    };

    leads.forEach(lead => {
      const etapa = (lead.etapa || 'Nuevo contacto').toLowerCase();
      if (etapa.includes('nuevo')) etapasCount.nuevo++;
      else if (etapa.includes('cita')) etapasCount.cita++;
      else if (etapa.includes('diag')) etapasCount.diagnostico++;
      else if (etapa.includes('propuesta')) etapasCount.propuesta++;
      else if (etapa.includes('ganado') || etapa.includes('cliente')) etapasCount.ganado++;
      else etapasCount.perdido++;

      const canal = (lead.canal_origen || '').toLowerCase();
      if (canal.includes('signal')) canalesCount.signal_web++;
      else if (canal.includes('instagram')) canalesCount.instagram++;
      else if (canal.includes('facebook')) canalesCount.facebook++;
      else if (canal.includes('whatsapp')) canalesCount.whatsapp++;
      else canalesCount.otro++;
    });

    const tasaConversion = totalLeads > 0 ? ((etapasCount.ganado / totalLeads) * 100).toFixed(1) : '0.0';

    res.json({
      success: true,
      kpis: {
        totalLeads,
        citasAgendadas: etapasCount.cita,
        clientesGanados: etapasCount.ganado,
        tasaConversion: `${tasaConversion}%`,
        porEtapa: etapasCount,
        porCanal: canalesCount
      }
    });
  } catch (error) {
    console.error('[CRMRoutes] Error obteniendo KPIs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
  * PATCH /api/crm/leads/:id
  * Actualizar datos de un lead (etapa, fecha, empresa, etc.)
  */
router.patch('/api/crm/leads/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await updateLead(id, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Lead no encontrado' });
    }
    res.json({ success: true, lead: updated });
  } catch (error) {
    console.error('[CRMRoutes] Error actualizando lead:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
  * POST /api/crm/leads/:id/notes
  * Agregar nota interna de seguimiento
  */
router.post('/api/crm/leads/:id/notes', async (req, res) => {
  try {
    const { id } = req.params;
    const { texto } = req.body;
    if (!texto) {
      return res.status(400).json({ success: false, error: 'El texto de la nota es requerido' });
    }

    const updated = await addLeadNote(id, texto, req.auth?.displayName || 'Ejecutivo Origin One');
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Lead no encontrado' });
    }
    res.json({ success: true, lead: updated });
  } catch (error) {
    console.error('[CRMRoutes] Error agregando nota a lead:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
  * DELETE /api/crm/leads/:id
  * Eliminar un lead individual manualmente desde el CRM
  */
router.delete('/api/crm/leads/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await deleteLead(id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Lead no encontrado' });
    }
    res.json({ success: true, message: `Lead ${id} eliminado correctamente.` });
  } catch (error) {
    console.error('[CRMRoutes] Error eliminando lead:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
  * DELETE /api/crm/reset-all
  * Limpiar por completo todos los leads de prueba en producción
  */
router.delete('/api/crm/reset-all', async (req, res) => {
  try {
    const { saveAppointments } = require('./agendaService');
    await saveAppointments([]);
    res.json({ success: true, message: 'Base de datos de leads limpiada completamente.' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
