const allowedModules = new Set(['dashboard', 'crm']);
const initialUrlParams = new URLSearchParams(window.location.search);
const requestedModule = initialUrlParams.get('module');
let currentModule = allowedModules.has(requestedModule) ? requestedModule : 'dashboard';
let allLeads = [];
let currentFilterChannel = initialUrlParams.get('channel') || 'todos';
let currentFilterStage = initialUrlParams.get('stage');
let currentAttentionFilter = initialUrlParams.get('attention');
let currentCrmView = initialUrlParams.get('view') === 'list' ? 'list' : 'kanban';
let currentActiveLeadId = null;
let currentUserDisplayName = 'Usuario';
let deferredInstallPrompt = null;
let toastTimer = null;
let instagramSyncPromise = null;
let lastInstagramSyncAt = 0;

document.addEventListener('DOMContentLoaded', () => {
  initializeShell();
  initializePwa();
  loadCurrentUser();
  switchModule(currentModule, { updateUrl: false, preserveFilters: true }).then(() => {
    const leadId = new URLSearchParams(window.location.search).get('lead');
    if (leadId) openModal(leadId, { updateUrl: false });
  });
});

function initializeShell() {
  document.getElementById('dashboardDate').innerText = new Intl.DateTimeFormat('es-MX', {
    weekday: 'short', day: 'numeric', month: 'short'
  }).format(new Date()).replace('.', '').toUpperCase();

  document.addEventListener('keydown', event => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      switchModule('crm').then(() => document.getElementById('searchInput')?.focus());
    }
    if (event.key === 'Escape') {
      if (!document.getElementById('recordModal').classList.contains('hidden')) closeRecordModal();
      else if (!document.getElementById('installModal').classList.contains('hidden')) closeInstallModal();
      else if (!document.getElementById('leadModal').classList.contains('hidden')) closeModal();
      else toggleSidebar(false);
    }
  });

  document.getElementById('leadModal').addEventListener('click', event => {
    if (event.target.id === 'leadModal') closeModal();
  });
  document.getElementById('installModal').addEventListener('click', event => {
    if (event.target.id === 'installModal') closeInstallModal();
  });
  document.getElementById('recordModal').addEventListener('click', event => {
    if (event.target.id === 'recordModal') closeRecordModal();
  });
  document.getElementById('invoiceForm').addEventListener('submit', submitInvoiceForm);
  document.getElementById('transactionForm').addEventListener('submit', submitTransactionForm);

  window.addEventListener('popstate', restoreNavigationFromUrl);
}

async function initializePwa() {
  updateInstallUi();
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('/crm/sw.js', { scope: '/' });
    } catch (error) {
      console.warn('No fue posible registrar la app instalable:', error.message);
    }
  }
}

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  deferredInstallPrompt = event;
  updateInstallUi();
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  updateInstallUi(true);
  showToast('Origin One OS quedó guardada como app.');
});

function isStandaloneMode() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function updateInstallUi(installed = isStandaloneMode()) {
  const sidebarLabel = document.getElementById('sidebarInstallLabel');
  const installButton = document.getElementById('installAppButton');
  if (sidebarLabel) sidebarLabel.innerText = installed ? 'App instalada' : 'Guardar como app';
  if (installButton) {
    installButton.querySelector('span').innerText = installed ? 'App instalada' : 'Guardar como app';
    installButton.disabled = installed;
  }
}

async function installApp() {
  if (isStandaloneMode()) {
    showToast('Ya estás usando Origin One OS como app.');
    return;
  }

  if (deferredInstallPrompt) {
    const prompt = deferredInstallPrompt;
    deferredInstallPrompt = null;
    await prompt.prompt();
    const result = await prompt.userChoice;
    if (result.outcome === 'accepted') updateInstallUi(true);
    return;
  }

  const userAgent = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(userAgent);
  const isSafari = /^((?!chrome|android).)*safari/i.test(userAgent);
  const instructions = document.getElementById('installInstructions');
  if (isIOS) {
    instructions.innerHTML = 'En Safari, toca <strong>Compartir</strong> y después <strong>Agregar a pantalla de inicio</strong>.';
  } else if (isSafari) {
    instructions.innerHTML = 'En Safari, abre el menú <strong>Archivo</strong> y elige <strong>Agregar al Dock</strong>.';
  } else {
    instructions.innerHTML = 'Abre el menú de tu navegador y elige <strong>Instalar Origin One OS</strong> o <strong>Crear acceso directo</strong>.';
  }
  document.getElementById('installModal').classList.remove('hidden');
}

function closeInstallModal() {
  document.getElementById('installModal').classList.add('hidden');
}

function closeRecordModal() {
  document.getElementById('recordModal').classList.add('hidden');
  document.getElementById('invoiceForm').classList.add('hidden');
  document.getElementById('transactionForm').classList.add('hidden');
}

function toggleSidebar(open) {
  document.body.classList.toggle('sidebar-open', Boolean(open));
}

function showToast(message) {
  const toast = document.getElementById('appToast');
  document.getElementById('toastMessage').innerText = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.innerText = value;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatCurrency(value) {
  return `$${Number(value || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function updateDashboardGreeting() {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
  setText('dashboardGreeting', `${greeting}, ${currentUserDisplayName}`);
}

async function openLeadFromDashboard(id) {
  await switchModule('crm');
  openModal(id);
}

async function openCrmSource(stageKey = null) {
  currentFilterStage = stageKey;
  currentAttentionFilter = null;
  currentFilterChannel = 'todos';
  currentCrmView = 'list';
  await switchModule('crm', { updateUrl: false, preserveFilters: true });
  updateCrmFilterUi();
  switchCrmSubView(currentCrmView, { updateUrl: false });
  renderBoard();
  renderTable();
  updateNavigationUrl();
}

async function openCrmAttention() {
  currentFilterStage = null;
  currentAttentionFilter = 'today';
  currentFilterChannel = 'todos';
  currentCrmView = 'list';
  await switchModule('crm', { updateUrl: false, preserveFilters: true });
  updateCrmFilterUi();
  switchCrmSubView('list', { updateUrl: false });
  renderBoard();
  renderTable();
  updateNavigationUrl();
}

async function openChannelSource(channel) {
  currentFilterStage = null;
  currentAttentionFilter = null;
  currentFilterChannel = channel;
  await switchModule('crm', { updateUrl: false, preserveFilters: true });
  const button = document.querySelector(`.chip-filter[data-channel="${channel}"]`);
  filterChannel(channel, button, { updateUrl: true });
}

function updateNavigationUrl({ replace = false, leadId = currentActiveLeadId } = {}) {
  const url = new URL(window.location.href);
  ['module', 'stage', 'attention', 'channel', 'view', 'lead'].forEach(key => url.searchParams.delete(key));
  if (currentModule === 'crm') {
    url.searchParams.set('module', 'crm');
    if (currentFilterStage) url.searchParams.set('stage', currentFilterStage);
    if (currentAttentionFilter) url.searchParams.set('attention', currentAttentionFilter);
    if (currentFilterChannel !== 'todos') url.searchParams.set('channel', currentFilterChannel);
    if (currentCrmView === 'list') url.searchParams.set('view', 'list');
    if (leadId) url.searchParams.set('lead', leadId);
  }
  window.history[replace ? 'replaceState' : 'pushState']({}, '', url);
}

async function restoreNavigationFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get('module');
  const moduleName = allowedModules.has(requested) ? requested : 'dashboard';
  currentFilterStage = params.get('stage');
  currentAttentionFilter = params.get('attention');
  currentFilterChannel = params.get('channel') || 'todos';
  currentCrmView = params.get('view') === 'list' ? 'list' : 'kanban';
  hideLeadModal();
  await switchModule(moduleName, { updateUrl: false, preserveFilters: true });
  const leadId = params.get('lead');
  if (leadId) openModal(leadId, { updateUrl: false });
}

async function refreshCurrentModule() {
  loadModuleData();
}

async function loadCurrentUser() {
  const response = await fetch('/api/auth/session', { credentials: 'same-origin' });
  const data = await response.json();
  if (!data.authenticated) {
    window.location.replace(`/auth?next=${encodeURIComponent(window.location.pathname)}`);
    return;
  }
  const nameElement = document.getElementById('currentUserName');
  currentUserDisplayName = data.user.displayName;
  if (nameElement) nameElement.innerText = currentUserDisplayName;
  updateDashboardGreeting();
  const noteAuthor = document.getElementById('noteAuthor');
  if (noteAuthor) {
    noteAuthor.value = data.user.displayName;
    noteAuthor.readOnly = true;
  }
}

async function logout() {
  await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: '{}'
  });
  if (navigator.serviceWorker?.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_PRIVATE_CACHE' });
  }
  window.location.replace('/auth');
}

/**
 * Conmutar entre las dos vistas del CRM.
 */
async function switchModule(moduleName, options = {}) {
  if (!allowedModules.has(moduleName)) moduleName = 'dashboard';
  if (moduleName === 'crm' && !options.preserveFilters) {
    currentFilterStage = null;
    currentAttentionFilter = null;
    currentFilterChannel = 'todos';
    currentCrmView = 'kanban';
  }
  if (moduleName === 'dashboard') hideLeadModal();
  currentModule = moduleName;
  document.querySelectorAll('[data-module]').forEach(button => {
    button.classList.toggle('active', button.dataset.module === moduleName);
  });
  toggleSidebar(false);

  const sections = {
    dashboard: document.getElementById('moduleDashboardSection'),
    crm: document.getElementById('moduleCrmSection')
  };

  Object.keys(sections).forEach(key => {
    if (key === moduleName) {
      sections[key].classList.remove('hidden');
    } else {
      sections[key].classList.add('hidden');
    }
  });

  const titles = {
    dashboard: { eyebrow: 'CENTRO DE CONTROL', title: 'Resumen operativo', sub: 'Lo importante de Origin One en un solo lugar.' },
    crm: { eyebrow: 'RELACIONES COMERCIALES', title: 'Prospectos y seguimiento', sub: 'Contactos, próximos pasos y citas confirmadas.' }
  };

  if (titles[moduleName]) {
    document.getElementById('moduleEyebrow').innerText = titles[moduleName].eyebrow;
    document.getElementById('moduleTitle').innerText = titles[moduleName].title;
    document.getElementById('moduleSubtitle').innerText = titles[moduleName].sub;
  }

  document.getElementById('globalSearchBox').classList.toggle('hidden', moduleName !== 'crm');
  document.getElementById('backToDashboardButton').classList.toggle('hidden', moduleName === 'dashboard');

  if (options.updateUrl !== false) {
    updateNavigationUrl();
  }

  await loadModuleData();
  if (moduleName === 'crm') {
    updateCrmFilterUi();
    switchCrmSubView(currentCrmView, { updateUrl: false });
  }
}

/**
 * Cargar datos según el módulo activo
 */
async function loadModuleData() {
  try {
    if (currentModule === 'dashboard') {
      await loadDashboardModule();
    } else if (currentModule === 'crm') await loadCrmModule();
  } catch (error) {
    console.error('Error cargando módulo:', error);
    showToast(`No fue posible cargar esta sección: ${error.message}`);
  }

  if ((currentModule === 'dashboard' || currentModule === 'crm') && Date.now() - lastInstagramSyncAt > 60000) {
    syncInstagramInBackground(false);
  }
}

async function syncInstagramInBackground(showCompletion = false) {
  if (instagramSyncPromise) {
    if (showCompletion) showToast('La sincronización ya está en curso.');
    return instagramSyncPromise;
  }

  const refreshIcon = document.getElementById('refreshIcon');
  refreshIcon?.classList.add('fa-spin');
  setText('syncStatusText', 'Sincronizando en segundo plano…');

  instagramSyncPromise = (async () => {
    try {
      const response = await fetch('/api/crm/sync/instagram', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'No fue posible sincronizar Instagram');

      lastInstagramSyncAt = Date.now();
      setText('syncStatusText', result.importedMessages
        ? `${result.importedMessages} mensajes nuevos`
        : 'Todo está actualizado');

      if (currentModule === 'dashboard') await loadDashboardModule();
      else if (currentModule === 'crm') await loadCrmModule();
      if (showCompletion) showToast(result.importedMessages ? 'Se agregaron mensajes nuevos.' : 'Instagram ya estaba actualizado.');
      return result;
    } catch (error) {
      console.warn('Sincronización de Instagram pendiente:', error.message);
      setText('syncStatusText', 'Últimos datos guardados');
      if (showCompletion) showToast(`No se pudo sincronizar: ${error.message}`);
      return null;
    } finally {
      refreshIcon?.classList.remove('fa-spin');
      instagramSyncPromise = null;
    }
  })();

  return instagramSyncPromise;
}

/* ==================== RESUMEN OPERATIVO ==================== */
async function loadDashboardModule() {
  const [leadsResponse, kpisResponse] = await Promise.all([
    fetch('/api/crm/leads'),
    fetch('/api/crm/kpis')
  ]);

  const [leadsData, kpisData] = await Promise.all([
    leadsResponse.json(),
    kpisResponse.json()
  ]);

  if (leadsData.success) allLeads = leadsData.leads || [];
  const kpis = kpisData.kpis || {};
  const stages = kpis.porEtapa || {};

  setText('dashNewContacts', stages.nuevo || 0);
  setText('dashConfirmed', kpis.citasAgendadas || 0);
  setText('dashActionsToday', allLeads.filter(isActionDueToday).length);
  setText('dashConversion', kpis.tasaConversion || '0.0%');
  setText('dashPipelineTotal', `${kpis.totalLeads || 0} prospectos`);
  setText('navLeadCount', kpis.totalLeads || 0);

  renderDashboardRecentContacts();
  renderDashboardPipeline(stages, kpis.totalLeads || 0);
}

function renderDashboardRecentContacts() {
  const container = document.getElementById('dashRecentContacts');
  container.innerHTML = '';
  const recent = [...allLeads]
    .filter(lead => !['ganado', 'archivado'].includes(getStageKey(lead)))
    .sort((a, b) => getAttentionPriority(a) - getAttentionPriority(b) || new Date(a.siguiente_accion_fecha || a.actualizado_el || 0) - new Date(b.siguiente_accion_fecha || b.actualizado_el || 0))
    .slice(0, 5);

  if (!recent.length) {
    container.innerHTML = '<p class="empty-state">No hay seguimientos pendientes.</p>';
    return;
  }

  recent.forEach(lead => {
    const channel = (lead.canal_origen || '').toLowerCase();
    const icon = channel.includes('instagram') ? 'fa-brands fa-instagram' : channel.includes('facebook') ? 'fa-brands fa-facebook-messenger' : 'fa-solid fa-wave-square';
    const actionMeta = getNextActionMeta(lead);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'recent-contact';
    button.innerHTML = `
      <span class="recent-channel"><i class="${icon}"></i></span>
      <span class="recent-copy"><span class="recent-name"></span><span class="recent-meta"></span></span>
      <span class="recent-time"></span>
    `;
    button.querySelector('.recent-name').innerText = lead.nombre_cliente || 'Prospecto sin nombre';
    button.querySelector('.recent-meta').innerText = actionMeta.label;
    button.querySelector('.recent-time').innerText = actionMeta.when;
    button.addEventListener('click', () => openLeadFromDashboard(lead.id));
    container.appendChild(button);
  });
}

function renderDashboardPipeline(stages, total) {
  const container = document.getElementById('dashPipeline');
  const items = [
    ['Nuevo contacto', stages.nuevo || 0, 'nuevo'],
    ['Cita confirmada', stages.cita || 0, 'cita'],
    ['Diagnóstico', stages.diagnostico || 0, 'diagnostico'],
    ['Propuesta', stages.propuesta || 0, 'propuesta'],
    ['Ganado', stages.ganado || 0, 'ganado']
  ];
  container.innerHTML = '';

  items.forEach(([label, count, stageKey]) => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'pipeline-row';
    const width = total ? Math.max((count / total) * 100, count ? 4 : 0) : 0;
    row.innerHTML = `<span></span><div class="pipeline-track"><div class="pipeline-fill"></div></div><b></b>`;
    row.querySelector('span').innerText = label;
    row.querySelector('.pipeline-fill').style.width = `${width}%`;
    row.querySelector('b').innerText = count;
    row.addEventListener('click', () => openCrmSource(stageKey));
    container.appendChild(row);
  });
}

/* ==================== MÓDULO 1: CRM ==================== */
async function loadCrmModule() {
  const resLeads = await fetch('/api/crm/leads');
  const dataLeads = await resLeads.json();
  if (dataLeads.success) allLeads = dataLeads.leads || [];

  const resKpis = await fetch('/api/crm/kpis');
  const dataKpis = await resKpis.json();
  if (dataKpis.success) {
    document.getElementById('kpiTotalLeads').innerText = dataKpis.kpis.totalLeads || 0;
    document.getElementById('kpiCitasAgendadas').innerText = dataKpis.kpis.citasAgendadas || 0;
    document.getElementById('kpiClientesGanados').innerText = dataKpis.kpis.clientesGanados || 0;
    document.getElementById('kpiTasaConversion').innerText = dataKpis.kpis.tasaConversion || '0.0%';
    setText('navLeadCount', dataKpis.kpis.totalLeads || 0);
  }

  renderBoard();
  renderTable();
}

function getFilteredLeads() {
  const searchVal = document.getElementById('searchInput').value.toLowerCase().trim();
  return allLeads.filter(lead => {
    const canal = (lead.canal_origen || '').toLowerCase();
    let matchesChannel = true;
    if (currentFilterChannel === 'signal') matchesChannel = canal.includes('signal');
    else if (currentFilterChannel === 'instagram') matchesChannel = canal.includes('instagram');
    else if (currentFilterChannel === 'facebook') matchesChannel = canal.includes('facebook');

    let matchesSearch = true;
    if (searchVal) {
      matchesSearch = (
        (lead.nombre_cliente || '').toLowerCase().includes(searchVal) ||
        (lead.empresa_o_proyecto || '').toLowerCase().includes(searchVal) ||
        (lead.email || '').toLowerCase().includes(searchVal) ||
        (lead.telefono_whatsapp || '').toLowerCase().includes(searchVal)
      );
    }
    const matchesStage = !currentFilterStage || getStageKey(lead) === currentFilterStage;
    const matchesAttention = currentAttentionFilter !== 'today' || isActionDueToday(lead);
    return matchesChannel && matchesSearch && matchesStage && matchesAttention;
  });
}

function getStageKey(lead) {
  const etapa = (lead.etapa || 'Nuevo contacto').toLowerCase();
  if (etapa.includes('perdido') || etapa.includes('archivado')) return 'archivado';
  if (etapa.includes('ganado') || etapa.includes('cliente')) return 'ganado';
  if (etapa.includes('propuesta')) return 'propuesta';
  if (etapa.includes('diag')) return 'diagnostico';
  if (etapa.includes('cita') || etapa.includes('confirmada') || etapa.includes('agendada')) return 'cita';
  return 'nuevo';
}

function getStageLabel(lead) {
  const key = getStageKey(lead);
  if (key === 'cita') return 'Cita Confirmada';
  if (key === 'nuevo' && !(lead.etapa || '').toLowerCase().includes('prueba')) return 'Nuevo contacto';
  return lead.etapa || 'Nuevo contacto';
}

function parseActionDate(lead) {
  if (!lead.siguiente_accion_fecha) return null;
  const date = new Date(lead.siguiente_accion_fecha);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isActionDueToday(lead) {
  if (!lead.siguiente_accion || lead.siguiente_accion_estado === 'completada') return false;
  const dueDate = parseActionDate(lead);
  if (!dueDate) return false;
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  return dueDate <= endOfToday;
}

function getAttentionPriority(lead) {
  if (isActionDueToday(lead)) return 0;
  if (!lead.siguiente_accion) return 1;
  return 2;
}

function getNextActionMeta(lead) {
  if (!lead.siguiente_accion) return { label: 'Sin próximo paso', when: 'Definir hoy' };
  const dueDate = parseActionDate(lead);
  if (!dueDate) return { label: lead.siguiente_accion, when: 'Sin fecha' };
  const overdue = dueDate < new Date() && lead.siguiente_accion_estado !== 'completada';
  return {
    label: `${lead.siguiente_accion}${lead.responsable ? ` · ${lead.responsable}` : ''}`,
    when: overdue
      ? 'Vencida'
      : dueDate.toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  };
}

function updateCrmFilterUi() {
  const banner = document.getElementById('activeCrmFilter');
  const label = document.getElementById('activeCrmFilterLabel');
  const stageLabels = {
    nuevo: 'Etapa: Nuevo contacto',
    cita: 'Etapa: Cita confirmada',
    diagnostico: 'Etapa: Diagnóstico',
    propuesta: 'Etapa: Propuesta',
    ganado: 'Etapa: Ganado',
    archivado: 'Etapa: Archivado'
  };
  let filterLabel = currentFilterStage ? stageLabels[currentFilterStage] : '';
  if (currentAttentionFilter === 'today') filterLabel = 'Acciones vencidas o para hoy';
  if (currentFilterChannel !== 'todos') filterLabel += `${filterLabel ? ' · ' : ''}Canal: ${currentFilterChannel}`;
  banner.classList.toggle('hidden', !filterLabel);
  label.innerText = filterLabel || 'Filtro activo';

  document.querySelectorAll('.chip-filter').forEach(button => {
    button.classList.toggle('active', button.dataset.channel === currentFilterChannel);
  });
}

function clearCrmFilters() {
  currentFilterStage = null;
  currentAttentionFilter = null;
  currentFilterChannel = 'todos';
  updateCrmFilterUi();
  renderBoard();
  renderTable();
  updateNavigationUrl();
}

function getLeadActivity(lead) {
  const isNewContact = getStageKey(lead) === 'nuevo';
  if (isNewContact) {
    const createdAt = lead.creado_el ? new Date(lead.creado_el) : null;
    const fallbackDate = createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt.toISOString().split('T')[0] : 'Sin fecha';
    const fallbackTime = createdAt && !Number.isNaN(createdAt.getTime())
      ? createdAt.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
      : 'Sin hora';
    return {
      label: 'Primer contacto',
      date: lead.fecha_primer_contacto || fallbackDate,
      time: lead.hora_primer_contacto || fallbackTime
    };
  }

  return {
    label: 'Cita de diagnóstico',
    date: lead.fecha_propuesta || 'Por confirmar',
    time: lead.hora_propuesta || 'Por confirmar'
  };
}

function getWhatsAppMessage(lead) {
  if (getStageKey(lead) === 'cita') {
    return `Hola ${lead.nombre_cliente}, te escribo de Origin One sobre tu cita de diagnóstico confirmada.`;
  }
  return `Hola ${lead.nombre_cliente}, te escribo de Origin One para dar seguimiento a nuestra conversación.`;
}

function renderBoard() {
  const filtered = getFilteredLeads();
  const cols = {
    nuevo: document.getElementById('colNuevo'),
    cita: document.getElementById('colCita'),
    diagnostico: document.getElementById('colDiagnostico'),
    propuesta: document.getElementById('colPropuesta'),
    ganado: document.getElementById('colGanado')
  };

  Object.values(cols).forEach(col => col.innerHTML = '');
  const counts = { nuevo: 0, cita: 0, diagnostico: 0, propuesta: 0, ganado: 0 };

  filtered.forEach(lead => {
    const key = getStageKey(lead);
    if (!cols[key]) return;

    counts[key]++;
    cols[key].appendChild(createLeadCard(lead));
  });

  document.getElementById('countNuevo').innerText = counts.nuevo;
  document.getElementById('countCita').innerText = counts.cita;
  document.getElementById('countDiagnostico').innerText = counts.diagnostico;
  document.getElementById('countPropuesta').innerText = counts.propuesta;
  document.getElementById('countGanado').innerText = counts.ganado;
}

function createLeadCard(lead) {
  const div = document.createElement('div');
  div.className = 'lead-card';
  div.onclick = () => openModal(lead.id);

  const canalName = lead.canal_origen || 'Chatbot';
  let tagClass = 'tag-signal';
  let iconClass = 'fa-solid fa-microphone';
  if (canalName.toLowerCase().includes('instagram')) { tagClass = 'tag-instagram'; iconClass = 'fa-brands fa-instagram'; }
  else if (canalName.toLowerCase().includes('facebook')) { tagClass = 'tag-facebook'; iconClass = 'fa-brands fa-facebook'; }

  const isTestBadge = (lead.es_prueba || (lead.etapa && lead.etapa.includes('Prueba')) || (lead.nombre_cliente && lead.nombre_cliente.includes('🧪')))
    ? `<span class="channel-tag" style="background:rgba(239,68,68,0.2); color:#f87171; border:1px solid rgba(239,68,68,0.4);"><i class="fa-solid fa-vial"></i> PRUEBA</span>`
    : '';

  const cleanPhone = (lead.telefono_whatsapp || '').replace(/\D/g, '');
  const waMsg = encodeURIComponent(getWhatsAppMessage(lead));
  const waUrl = cleanPhone ? `https://wa.me/${cleanPhone.startsWith('52') ? cleanPhone : '52' + cleanPhone}?text=${waMsg}` : '#';
  const activity = getLeadActivity(lead);
  const nextAction = getNextActionMeta(lead);

  div.innerHTML = `
    <div class="card-top">
      <span class="channel-tag ${tagClass}"><i class="${iconClass}"></i> ${escapeHtml(canalName)}</span>
      ${isTestBadge}
      <span class="date-badge" title="${escapeHtml(activity.label)}">${escapeHtml(activity.date)}</span>
    </div>
    <h4 class="lead-name">${escapeHtml(lead.nombre_cliente || 'Prospecto sin nombre')}</h4>
    <p class="lead-company"><i class="fa-solid fa-building"></i> ${escapeHtml(lead.empresa_o_proyecto || 'Origin One Prospect')}</p>
    <div class="card-info-row"><i class="fa-solid fa-list-check"></i> <span>${escapeHtml(nextAction.label)}</span></div>
    <div class="card-info-row"><i class="fa-solid fa-clock"></i> <span>${escapeHtml(nextAction.when)}</span></div>
    <div class="card-footer">
      <span>${escapeHtml(lead.responsable || 'Sin responsable')}</span>
      <span class="card-actions">
        <button type="button" class="btn-card-secondary" aria-label="Agregar nota"><i class="fa-solid fa-note-sticky"></i> Nota</button>
        ${cleanPhone ? `<a href="${waUrl}" target="_blank" class="btn-card-action"><i class="fa-brands fa-whatsapp"></i> Chat</a>` : ''}
      </span>
    </div>
  `;
  div.querySelector('.btn-card-secondary').addEventListener('click', event => {
    event.stopPropagation();
    openNotes(lead.id);
  });
  div.querySelector('.btn-card-action')?.addEventListener('click', event => event.stopPropagation());
  return div;
}


function renderTable() {
  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = '';
  const filtered = getFilteredLeads();

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#9ca3af; padding:30px;">No hay registros encontrados.</td></tr>`;
    return;
  }

  filtered.forEach(lead => {
    const activity = getLeadActivity(lead);
    const nextAction = getNextActionMeta(lead);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${escapeHtml(lead.id)}</strong></td>
      <td><div style="font-weight:700;">${escapeHtml(lead.nombre_cliente || 'Prospecto sin nombre')}</div><div style="font-size:12px; color:#9ca3af;">${escapeHtml(lead.empresa_o_proyecto || '—')}</div></td>
      <td><div>${escapeHtml(lead.telefono_whatsapp || '—')}</div><div style="font-size:11px; color:#9ca3af;">${escapeHtml(lead.email || '—')}</div></td>
      <td><strong>${escapeHtml(nextAction.label)}</strong><div style="font-size:11px; color:#9ca3af;">${escapeHtml(nextAction.when)}</div></td>
      <td><span class="channel-tag tag-signal">${escapeHtml(lead.canal_origen || '—')}</span></td>
      <td><span class="badge-count">${escapeHtml(getStageLabel(lead))}</span></td>
      <td><button class="glass-btn" style="padding:4px 10px; font-size:11px;"><i class="fa-solid fa-eye"></i> Detalle</button></td>
    `;
    tr.querySelector('button').addEventListener('click', () => openModal(lead.id));
    tbody.appendChild(tr);
  });
}

function openModal(id, options = {}) {
  const lead = allLeads.find(l => l.id === id);
  if (!lead) return;

  currentActiveLeadId = id;
  document.getElementById('modalName').innerText = lead.nombre_cliente || 'Prospecto sin nombre';
  document.getElementById('modalCompany').innerText = lead.empresa_o_proyecto || 'Proyecto no especificado';
  document.getElementById('modalEmail').innerText = lead.email || 'No especificado';
  document.getElementById('modalPhone').innerText = lead.telefono_whatsapp || 'No especificado';
  const activity = getLeadActivity(lead);
  document.getElementById('modalDateTimeLabel').innerText = `${activity.label.toUpperCase()}:`;
  document.getElementById('modalDateTime').innerText = `${activity.date} a las ${activity.time}`;
  document.getElementById('modalNeed').innerText = lead.resumen_necesidad || 'Sin detalles especificados';
  document.getElementById('modalChannel').innerText = lead.canal_origen || 'Canal General';
  document.getElementById('stageSelect').value = getStageLabel(lead);
  document.getElementById('appointmentDateInput').value = lead.fecha_propuesta && lead.fecha_propuesta !== 'Por confirmar' ? lead.fecha_propuesta : '';
  document.getElementById('appointmentTimeInput').value = lead.hora_propuesta && lead.hora_propuesta !== 'Por confirmar' ? lead.hora_propuesta : '';
  document.getElementById('leadOwnerSelect').value = lead.responsable === 'Edgar' ? 'Edgar' : 'Artemio';
  document.getElementById('nextActionInput').value = lead.siguiente_accion || '';
  document.getElementById('nextActionStatusSelect').value = lead.siguiente_accion_estado === 'completada' ? 'completada' : 'pendiente';
  const nextActionDate = parseActionDate(lead);
  document.getElementById('nextActionDateInput').value = nextActionDate
    ? new Date(nextActionDate.getTime() - nextActionDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
    : '';
  document.getElementById('noteInput').value = '';
  document.getElementById('modalArchiveBtn').classList.toggle('hidden', getStageKey(lead) === 'archivado');
  toggleAppointmentFields();

  const cleanPhone = (lead.telefono_whatsapp || '').replace(/\D/g, '');
  const waMsg = encodeURIComponent(getWhatsAppMessage(lead));
  const waBtn = document.getElementById('modalWaBtn');
  if (cleanPhone) {
    waBtn.href = `https://wa.me/${cleanPhone.startsWith('52') ? cleanPhone : '52' + cleanPhone}?text=${waMsg}`;
    waBtn.style.display = 'flex';
  } else {
    waBtn.style.display = 'none';
  }

  renderNotesTimeline(lead.notas_internas || []);
  renderChatTranscript(lead.historial_mensajes || []);
  document.getElementById('leadModal').classList.remove('hidden');
  if (options.updateUrl !== false) updateNavigationUrl({ leadId: id });
}

function openNotes(id) {
  openModal(id);
  setTimeout(() => document.getElementById('noteInput')?.focus(), 50);
}

/**
 * Renderizar la transcripción completa del chat entre el usuario y la IA
 */
function renderChatTranscript(messages) {
  const container = document.getElementById('chatTranscriptBox');
  if (!container) return;
  container.innerHTML = '';

  if (!messages || messages.length === 0) {
    container.innerHTML = `<p style="font-size:11px; color:#8F909A; text-align:center; padding:12px;">No hay mensajes registrados aún en la conversación.</p>`;
    return;
  }

  messages.forEach(msg => {
    const isUser = msg.rol === 'user';
    const div = document.createElement('div');
    div.className = `chat-bubble ${isUser ? 'chat-bubble-user' : 'chat-bubble-ai'}`;

    const dateFormatted = msg.fecha ? new Date(msg.fecha).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '';

    const role = document.createElement('span');
    role.className = 'bubble-role font-mono';
    role.innerText = `${isUser ? 'Cliente' : 'Origin One AI'} · ${dateFormatted}`;
    const text = document.createElement('div');
    text.className = 'bubble-text';
    text.innerText = msg.texto || '';
    div.append(role, text);
    container.appendChild(div);
  });

  // Auto-scroll al final del chat
  container.scrollTop = container.scrollHeight;
}


function hideLeadModal() {
  document.getElementById('leadModal').classList.add('hidden');
  currentActiveLeadId = null;
}

function closeModal(options = {}) {
  hideLeadModal();
  if (options.updateUrl !== false) updateNavigationUrl({ replace: true, leadId: null });
}

function toggleAppointmentFields() {
  const selectedStage = (document.getElementById('stageSelect').value || '').toLowerCase();
  const requiresSlot = selectedStage.includes('cita') || selectedStage.includes('diag');
  document.getElementById('appointmentFields').classList.toggle('hidden', !requiresSlot);
}

async function updateLeadStage() {
  if (!currentActiveLeadId) return;
  const newStage = document.getElementById('stageSelect').value;
  const requestedStage = newStage.toLowerCase();
  const requiresSlot = requestedStage.includes('cita') || requestedStage.includes('diag');
  const appointmentDate = document.getElementById('appointmentDateInput').value.trim();
  const appointmentTime = document.getElementById('appointmentTimeInput').value.trim();

  if (requiresSlot && (!appointmentDate || !appointmentTime)) {
    showToast('Para confirmar la cita, captura la fecha y la hora acordadas.');
    return;
  }

  try {
    const res = await fetch(`/api/crm/leads/${currentActiveLeadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        etapa: newStage,
        ...(requiresSlot ? { fecha_propuesta: appointmentDate, hora_propuesta: appointmentTime } : {})
      })
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'No fue posible guardar la etapa');
    closeModal();
    await loadCrmModule();
    showToast('Etapa actualizada.');
  } catch (e) {
    console.error(e);
    showToast(e.message);
  }
}

async function saveNextAction() {
  if (!currentActiveLeadId) return;
  const action = document.getElementById('nextActionInput').value.trim();
  const dueValue = document.getElementById('nextActionDateInput').value;
  if (action && !dueValue) {
    showToast('Agrega una fecha límite para el próximo paso.');
    return;
  }

  const button = document.getElementById('saveNextActionButton');
  button.disabled = true;
  try {
    const response = await fetch(`/api/crm/leads/${currentActiveLeadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        responsable: document.getElementById('leadOwnerSelect').value,
        siguiente_accion: action,
        siguiente_accion_fecha: dueValue ? new Date(dueValue).toISOString() : null,
        siguiente_accion_estado: action ? document.getElementById('nextActionStatusSelect').value : null
      })
    });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || 'No fue posible guardar el próximo paso');
    const index = allLeads.findIndex(lead => lead.id === currentActiveLeadId);
    if (index !== -1) allLeads[index] = data.lead;
    renderBoard();
    renderTable();
    showToast('Próximo paso guardado.');
  } catch (error) {
    console.error(error);
    showToast(`No se guardó: ${error.message}`);
  } finally {
    button.disabled = false;
  }
}

async function archiveCurrentLead() {
  if (!currentActiveLeadId) return;
  const leadId = currentActiveLeadId;
  try {
    const response = await fetch(`/api/crm/leads/${leadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ etapa: 'Perdido / Archivado' })
    });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || 'No fue posible archivar');
    closeModal();
    await loadCrmModule();
    showToast('Prospecto archivado.');
  } catch (error) {
    showToast(`No se archivó: ${error.message}`);
  }
}

async function addNote() {
  if (!currentActiveLeadId) return;
  const text = document.getElementById('noteInput').value.trim();
  const author = document.getElementById('noteAuthor').value.trim() || 'Artemio Gonzalez';
  if (!text) return;

  const button = document.getElementById('saveNoteButton');
  button.disabled = true;
  try {
    const res = await fetch(`/api/crm/leads/${currentActiveLeadId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto: text, autor: author })
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'No fue posible guardar la nota');
    document.getElementById('noteInput').value = '';
    const idx = allLeads.findIndex(l => l.id === currentActiveLeadId);
    if (idx !== -1) {
      allLeads[idx] = data.lead;
      renderNotesTimeline(data.lead.notas_internas || []);
    }
    showToast('Nota guardada.');
  } catch (e) {
    console.error(e);
    showToast(`La nota sigue en el campo. No se guardó: ${e.message}`);
  } finally {
    button.disabled = false;
  }
}

function renderNotesTimeline(notes) {
  const container = document.getElementById('notesTimeline');
  container.innerHTML = '';
  if (notes.length === 0) {
    container.innerHTML = `<p style="font-size:12px; color:#9ca3af; text-align:center; padding:10px;">Aún no hay notas de seguimiento.</p>`;
    return;
  }
  notes.forEach(n => {
    const div = document.createElement('div');
    div.className = 'note-item';
    const dateFormatted = new Date(n.fecha).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
    div.innerHTML = '<div class="note-meta"><strong></strong><span></span></div><div class="note-text"></div>';
    div.querySelector('strong').innerText = n.autor || 'Origin One';
    div.querySelector('.note-meta span').innerText = dateFormatted;
    div.querySelector('.note-text').innerText = n.texto || '';
    container.appendChild(div);
  });
}

function switchCrmSubView(viewName, options = {}) {
  const kanban = document.getElementById('viewKanban');
  const list = document.getElementById('viewList');
  const tabK = document.getElementById('tabKanban');
  const tabL = document.getElementById('tabList');
  if (viewName === 'kanban') {
    kanban.classList.remove('hidden'); list.classList.add('hidden');
    tabK.classList.add('active'); tabL.classList.remove('active');
  } else {
    kanban.classList.add('hidden'); list.classList.remove('hidden');
    tabK.classList.remove('active'); tabL.classList.add('active');
  }
  currentCrmView = viewName;
  if (options.updateUrl !== false && currentModule === 'crm') updateNavigationUrl({ replace: true });
}

function filterChannel(channel, btn, options = {}) {
  currentFilterChannel = channel;
  document.querySelectorAll('.chip-filter').forEach(b => b.classList.remove('active'));
  btn?.classList.add('active');
  updateCrmFilterUi();
  renderBoard(); renderTable();
  if (options.updateUrl !== false) updateNavigationUrl({ replace: true });
}

function handleSearch() {
  if (currentModule === 'crm') { renderBoard(); renderTable(); }
}

/* ==================== MÓDULO 2: FACTURACIÓN ==================== */
async function loadFacturacionModule() {
  const res = await fetch('/api/facturacion/invoices');
  const data = await res.json();
  const tbody = document.getElementById('facturacionTableBody');
  tbody.innerHTML = '';

  if (!data.invoices || data.invoices.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:#9ca3af; padding:30px;">No hay facturas o cotizaciones registradas. Haz clic en "Nueva Factura".</td></tr>`;
    return;
  }

  data.invoices.forEach(inv => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${inv.folio}</strong></td>
      <td><div style="font-weight:700;">${inv.cliente}</div><div style="font-size:12px; color:#9ca3af;">${inv.empresa}</div></td>
      <td>${inv.concepto}</td>
      <td>$${inv.subtotal.toLocaleString('es-MX', {minimumFractionDigits:2})}</td>
      <td>$${inv.iva.toLocaleString('es-MX', {minimumFractionDigits:2})}</td>
      <td><strong style="color:#10b981;">$${inv.total.toLocaleString('es-MX', {minimumFractionDigits:2})} MXN</strong></td>
      <td><span class="badge-count" style="background:rgba(16,185,129,0.2); color:#34d399;">${inv.estado}</span></td>
      <td>${inv.fecha_emision}</td>
    `;
    tbody.appendChild(tr);
  });
}

function openNewInvoiceModal() {
  document.getElementById('recordModalKicker').innerText = 'FACTURACIÓN';
  document.getElementById('recordModalTitle').innerText = 'Nueva factura o cotización';
  document.getElementById('recordModalDescription').innerText = 'Registra los datos esenciales del documento.';
  document.getElementById('transactionForm').classList.add('hidden');
  document.getElementById('invoiceForm').classList.remove('hidden');
  document.getElementById('invoiceForm').reset();
  document.getElementById('recordModal').classList.remove('hidden');
  setTimeout(() => document.getElementById('invoiceClientInput').focus(), 50);
}

async function submitInvoiceForm(event) {
  event.preventDefault();
  const cliente = document.getElementById('invoiceClientInput').value.trim();
  const concepto = document.getElementById('invoiceConceptInput').value.trim();
  const subtotal = Number(document.getElementById('invoiceAmountInput').value);
  try {
    const response = await fetch('/api/facturacion/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cliente, empresa: cliente, concepto: concepto || 'Servicios Origin One', subtotal })
    });
    if (!response.ok) throw new Error('No fue posible guardar el documento');
    closeRecordModal();
    await loadFacturacionModule();
    showToast('Factura o cotización guardada.');
  } catch (error) {
    console.error(error);
    showToast(error.message);
  }
}

/* ==================== MÓDULO 3: CONTABILIDAD & PNL ==================== */
async function loadContabilidadModule() {
  const res = await fetch('/api/contabilidad/pnl');
  const data = await res.json();
  if (data.pnl) {
    document.getElementById('pnlIngresos').innerText = `$${data.pnl.totalIngresos.toLocaleString('es-MX', {minimumFractionDigits:2})} MXN`;
    document.getElementById('pnlEgresos').innerText = `$${data.pnl.totalEgresos.toLocaleString('es-MX', {minimumFractionDigits:2})} MXN`;
    document.getElementById('pnlUtilidad').innerText = `$${data.pnl.utilidadNeta.toLocaleString('es-MX', {minimumFractionDigits:2})} MXN`;
    document.getElementById('pnlMargen').innerText = data.pnl.margenUtilidad;
  }

  const tbody = document.getElementById('contabilidadTableBody');
  tbody.innerHTML = '';

  (data.transacciones || []).forEach(t => {
    const tr = document.createElement('tr');
    const isIngreso = t.tipo === 'ingreso';
    const colorClass = isIngreso ? 'col-green' : 'col-pink';
    const prefix = isIngreso ? '+' : '-';
    tr.innerHTML = `
      <td><strong>${t.id}</strong></td>
      <td><span class="badge-count" style="background:${isIngreso ? 'rgba(16,185,129,0.2)' : 'rgba(236,72,153,0.2)'}; color:${isIngreso ? '#34d399' : '#f472b6'};">${t.tipo.toUpperCase()}</span></td>
      <td>${t.categoria}</td>
      <td>${t.concepto}</td>
      <td><strong class="${colorClass}">${prefix}$${parseFloat(t.monto).toLocaleString('es-MX', {minimumFractionDigits:2})} MXN</strong></td>
      <td>${t.fecha}</td>
      <td>${t.socio || 'Artemio Gonzalez'}</td>
    `;
    tbody.appendChild(tr);
  });
}

function openNewTrxModal() {
  document.getElementById('recordModalKicker').innerText = 'CONTABILIDAD';
  document.getElementById('recordModalTitle').innerText = 'Registrar movimiento';
  document.getElementById('recordModalDescription').innerText = 'Agrega un ingreso o egreso al resultado del periodo.';
  document.getElementById('invoiceForm').classList.add('hidden');
  document.getElementById('transactionForm').classList.remove('hidden');
  document.getElementById('transactionForm').reset();
  document.getElementById('recordModal').classList.remove('hidden');
  setTimeout(() => document.getElementById('transactionConceptInput').focus(), 50);
}

async function submitTransactionForm(event) {
  event.preventDefault();
  const tipo = document.getElementById('transactionTypeInput').value;
  const concepto = document.getElementById('transactionConceptInput').value.trim();
  const monto = Number(document.getElementById('transactionAmountInput').value);
  try {
    const response = await fetch('/api/contabilidad/transaccion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo, concepto, monto, categoria: tipo === 'ingreso' ? 'Venta Proyecto IA' : 'Operación' })
    });
    if (!response.ok) throw new Error('No fue posible guardar el movimiento');
    closeRecordModal();
    await loadContabilidadModule();
    showToast('Movimiento guardado.');
  } catch (error) {
    console.error(error);
    showToast(error.message);
  }
}

/* ==================== MÓDULO 4: BANCOS ==================== */
async function loadBancosModule() {
  const res = await fetch('/api/bancos/cuentas');
  const data = await res.json();
  document.getElementById('bancosSaldoTotal').innerText = `$${(data.saldoTotalEstimadoMxn || 0).toLocaleString('es-MX', {minimumFractionDigits:2})} MXN`;

  const container = document.getElementById('bankCardsGrid');
  container.innerHTML = '';

  (data.cuentas || []).forEach(c => {
    const div = document.createElement('div');
    div.className = 'bank-card-item glass-card';
    div.innerHTML = `
      <div class="bank-icon-box"><i class="fa-solid fa-building-columns"></i></div>
      <h3>${c.banco}</h3>
      <p style="font-size:12px; color:#9ca3af; margin-top:2px;">${c.titular}</p>
      <div class="bank-balance">$${c.saldo.toLocaleString('es-MX', {minimumFractionDigits:2})} ${c.moneda}</div>
      <p style="font-size:11px; color:#6b7280; font-family:monospace; margin-top:8px;">CLABE/ID: ${c.clabe}</p>
    `;
    container.appendChild(div);
  });
}

/* ==================== MÓDULO 5: SOCIOS & TRANSPARENCIA ==================== */
async function loadSociosModule() {
  const res = await fetch('/api/socios/dashboard');
  const data = await res.json();

  if (data.transparencia) {
    document.getElementById('politicaReparto').innerText = `Política: ${data.transparencia.politicaReparto}`;

    const container = document.getElementById('partnersGrid');
    container.innerHTML = '';

    (data.transparencia.socios || []).forEach(s => {
      const div = document.createElement('div');
      div.className = 'partner-card-item glass-card';
      div.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div>
            <h3 style="font-size:18px; font-weight:800;">${s.nombre}</h3>
            <p style="font-size:12px; color:#9ca3af;">${s.rol}</p>
          </div>
          <span class="badge-count" style="background:rgba(139,92,246,0.3); color:#c084fc; font-size:14px;">${s.porcentaje}%</span>
        </div>

        <div style="margin-top:20px; padding-top:16px; border-top:1px dashed var(--card-border);">
          <span style="font-size:12px; color:#9ca3af;">Utilidad Neta Correspondiente:</span>
          <div style="font-size:24px; font-weight:800; color:#10b981; margin-top:4px;">
            $${s.utilidadCorrespondiente.toLocaleString('es-MX', {minimumFractionDigits:2})} MXN
          </div>
        </div>
      `;
      container.appendChild(div);
    });
  }
}

/**
 * Eliminar el lead activo de forma manual
 */
async function deleteCurrentLead() {
  if (!currentActiveLeadId) return;
  if (confirm(`¿Estás seguro de eliminar permanentemente el registro (${currentActiveLeadId}) del CRM?`)) {
    try {
      const res = await fetch(`/api/crm/leads/${encodeURIComponent(currentActiveLeadId)}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        closeModal();
        await loadCrmModule();
        showToast('Prospecto eliminado.');
      } else {
        showToast('No fue posible eliminar: ' + (data.error || 'Error desconocido'));
      }
    } catch (e) {
      showToast('Error de conexión: ' + e.message);
    }
  }
}
