const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { getAppointments, updateLead, addLeadNote, deleteLead, reviewAppointment, importExternalLead } = require('./agendaService');
const { syncInstagramInteractions } = require('./instagramSyncService');
const { recordEvent } = require('./growthAnalyticsService');

function molarIntegrationKey() {
  const sourceSecret = process.env.MOLAR_LEADS_WEBHOOK_SECRET
    || process.env.CRM_GATEWAY_SOURCE_SECRET
    || process.env.META_PAGE_ACCESS_TOKEN
    || process.env.R2_SECRET_ACCESS_KEY
    || '';
  return sourceSecret
    ? crypto.createHmac('sha256', sourceSecret).update('originone-molar-leads-v1').digest('hex')
    : null;
}

function hasMolarIntegrationAccess(req) {
  const expected = molarIntegrationKey();
  const supplied = String(req.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!expected || !supplied) return false;
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length && crypto.timingSafeEqual(expectedBuffer, suppliedBuffer);
}

/**
 * POST /api/integrations/molar/leads
 * Entrada servidor-a-servidor para que MOLAR alimente el CRM de Origin One.
 */
router.post('/api/integrations/molar/leads', async (req, res) => {
  if (!hasMolarIntegrationAccess(req)) return res.status(401).json({ success: false, error: 'Unauthorized' });

  try {
    const lead = await importExternalLead(req.body?.lead || {});
    res.status(lead.created ? 201 : 200).json({ success: true, ...lead });
  } catch (error) {
    console.error('[CRMRoutes] Error importando lead desde MOLAR:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

function attributionEventForStage(previous, updated) {
  if ((previous?.etapa || '').toLowerCase() === (updated?.etapa || '').toLowerCase()) return null;
  const stage = String(updated?.etapa || '').toLowerCase();
  if (stage.includes('propuesta')) return 'proposal_created';
  if (stage.includes('diag')) return 'lead_qualified';
  return null;
}

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
    const previous = (await getAppointments()).find(lead => lead.id === id);
    const updated = await updateLead(id, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Lead no encontrado' });
    }
    const eventName = attributionEventForStage(previous, updated);
    if (eventName && updated.attribution) {
      try {
        await recordEvent({
          name: eventName,
          sessionId: `lead:${updated.id}`,
          path: '/crm',
          ...updated.attribution
        });
      } catch (error) {
        console.error('[CRMRoutes] No fue posible registrar atribución del lead:', error.message);
      }
    }
    res.json({ success: true, lead: updated });
  } catch (error) {
    console.error('[CRMRoutes] Error actualizando lead:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/api/crm/leads/:id/appointment-review', async (req, res) => {
  try {
    const lead = await reviewAppointment(req.params.id, req.body.decision, req.auth?.displayName);
    if (!lead) return res.status(404).json({ success: false, error: 'Cita no encontrada' });
    res.json({ success: true, lead });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
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
