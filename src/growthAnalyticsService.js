const crypto = require('crypto');
const { readAnalyticsSnapshot, writeAnalyticsSnapshot } = require('./analyticsStorage');
const { getAppointments } = require('./agendaService');
const { getPublications } = require('./publicationService');

const ALLOWED_EVENTS = new Set(['page_view', 'cta_diagnostic', 'project_view', 'signal_open', 'signal_start', 'signal_appointment_proposed']);
let queue = Promise.resolve();

function clean(value, limit = 300) {
  return String(value || '').trim().slice(0, limit);
}

async function recordEvent(input) {
  if (!ALLOWED_EVENTS.has(input.name)) throw new Error('Evento no válido');
  const event = {
    id: crypto.randomUUID(),
    name: input.name,
    sessionId: clean(input.sessionId, 100),
    path: clean(input.path || '/', 300),
    source: clean(input.source || 'direct', 80),
    campaign: clean(input.campaign, 120),
    referrer: clean(input.referrer, 500),
    createdAt: new Date().toISOString()
  };
  const execute = async () => {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const snapshot = await readAnalyticsSnapshot();
      const events = [...snapshot.events, event].slice(-20000);
      try {
        await writeAnalyticsSnapshot(events, snapshot.etag, snapshot.backend);
        return event;
      } catch (error) {
        if ((error?.name !== 'PreconditionFailed' && error?.$metadata?.httpStatusCode !== 412) || attempt === 3) throw error;
      }
    }
  };
  const operation = queue.then(execute, execute);
  queue = operation.then(() => undefined, () => undefined);
  return operation;
}

async function getGrowthSummary(days = 30) {
  await queue;
  const [snapshot, appointments, publications] = await Promise.all([
    readAnalyticsSnapshot(),
    getAppointments(),
    getPublications()
  ]);
  const periodDays = Math.min(Math.max(Number(days) || 30, 1), 365);
  const cutoff = Date.now() - periodDays * 86400000;
  const events = snapshot.events.filter(event => new Date(event.createdAt).getTime() >= cutoff);
  const count = name => events.filter(event => event.name === name).length;
  const sessions = new Set(events.filter(event => event.name === 'page_view').map(event => event.sessionId).filter(Boolean)).size;
  const sources = {};
  events.filter(event => event.name === 'page_view').forEach(event => {
    sources[event.source || 'direct'] = (sources[event.source || 'direct'] || 0) + 1;
  });
  return {
    periodDays,
    web: {
      visitors: sessions,
      pageViews: count('page_view'),
      diagnosticClicks: count('cta_diagnostic'),
      signalOpens: count('signal_open'),
      signalStarts: count('signal_start'),
      appointmentProposals: count('signal_appointment_proposed'),
      visitorToConversationRate: sessions ? Number((count('signal_start') / sessions * 100).toFixed(1)) : 0,
      sources
    },
    social: {
      meta: { connected: Boolean(process.env.META_PAGE_ACCESS_TOKEN && process.env.INSTAGRAM_ACCOUNT_ID) },
      linkedin: { connected: Boolean(process.env.LINKEDIN_ACCESS_TOKEN && process.env.LINKEDIN_ORGANIZATION_ID) }
    },
    content: {
      total: publications.length,
      approved: publications.filter(item => ['aprobada', 'programada'].includes(item.status)).length,
      published: publications.filter(item => item.status === 'publicada').length
    },
    appointments: appointments.filter(item => item.appointment_status === 'proposed')
  };
}

module.exports = { getGrowthSummary, recordEvent };
