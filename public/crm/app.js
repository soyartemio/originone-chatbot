let currentModule = 'crm';
let allLeads = [];
let currentFilterChannel = 'todos';
let currentActiveLeadId = null;

document.addEventListener('DOMContentLoaded', () => {
  loadModuleData();
});

/**
 * Conmutar entre módulos del ERP
 */
function switchModule(moduleName, btnEl) {
  currentModule = moduleName;
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  btnEl.classList.add('active');

  const sections = {
    crm: document.getElementById('moduleCrmSection'),
    facturacion: document.getElementById('moduleFacturacionSection'),
    contabilidad: document.getElementById('moduleContabilidadSection'),
    bancos: document.getElementById('moduleBancosSection'),
    socios: document.getElementById('moduleSociosSection')
  };

  Object.keys(sections).forEach(key => {
    if (key === moduleName) {
      sections[key].classList.remove('hidden');
    } else {
      sections[key].classList.add('hidden');
    }
  });

  const titles = {
    crm: { title: 'CRM & Agenda de Prospectos', sub: 'Gestión omnicanal de leads capturados por S1GNAL Web, IG y Messenger' },
    facturacion: { title: 'Facturación & Cotizaciones', sub: 'Control de cotizaciones emitidas, cobranza y comprobantes fiscales' },
    contabilidad: { title: 'Contabilidad & Estado de Resultados (P&L)', sub: 'Visibilidad transparente de ingresos, egresos y utilidad neta' },
    bancos: { title: 'Bancos & Tesorería', sub: 'Control de saldos en cuentas corporativas y flujo de efectivo' },
    socios: { title: 'Transparencia de Socios & Utilidades', sub: 'Auditoría de participaciones accionarias y distribución de beneficios' }
  };

  if (titles[moduleName]) {
    document.getElementById('moduleTitle').innerText = titles[moduleName].title;
    document.getElementById('moduleSubtitle').innerText = titles[moduleName].sub;
  }

  loadModuleData();
}

/**
 * Cargar datos según el módulo activo
 */
async function loadModuleData() {
  const refreshIcon = document.getElementById('refreshIcon');
  if (refreshIcon) refreshIcon.classList.add('fa-spin');

  try {
    if (currentModule === 'crm') {
      await loadCrmModule();
    } else if (currentModule === 'facturacion') {
      await loadFacturacionModule();
    } else if (currentModule === 'contabilidad') {
      await loadContabilidadModule();
    } else if (currentModule === 'bancos') {
      await loadBancosModule();
    } else if (currentModule === 'socios') {
      await loadSociosModule();
    }
  } catch (error) {
    console.error('Error cargando módulo:', error);
  } finally {
    if (refreshIcon) refreshIcon.classList.remove('fa-spin');
  }
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
    return matchesChannel && matchesSearch;
  });
}

function renderBoard() {
  const filtered = getFilteredLeads();
  const cols = {
    cita: document.getElementById('colCita'),
    diagnostico: document.getElementById('colDiagnostico'),
    propuesta: document.getElementById('colPropuesta'),
    ganado: document.getElementById('colGanado')
  };

  Object.values(cols).forEach(col => col.innerHTML = '');
  const counts = { cita: 0, diagnostico: 0, propuesta: 0, ganado: 0 };

  filtered.forEach(lead => {
    const etapa = (lead.etapa || 'Cita Agendada').toLowerCase();
    let key = 'cita';
    if (etapa.includes('diag')) key = 'diagnostico';
    else if (etapa.includes('propuesta')) key = 'propuesta';
    else if (etapa.includes('ganado') || etapa.includes('cliente')) key = 'ganado';

    counts[key]++;
    cols[key].appendChild(createLeadCard(lead));
  });

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

  const cleanPhone = (lead.telefono_whatsapp || '').replace(/\D/g, '');
  const waMsg = encodeURIComponent(`Hola ${lead.nombre_cliente}, te escribo de Origin One sobre tu cita de diagnóstico.`);
  const waUrl = cleanPhone ? `https://wa.me/${cleanPhone.startsWith('52') ? cleanPhone : '52' + cleanPhone}?text=${waMsg}` : '#';

  div.innerHTML = `
    <div class="card-top">
      <span class="channel-tag ${tagClass}"><i class="${iconClass}"></i> ${canalName}</span>
      <span class="date-badge">${lead.fecha_propuesta || 'Sin fecha'}</span>
    </div>
    <h4 class="lead-name">${lead.nombre_cliente || 'Prospecto sin nombre'}</h4>
    <p class="lead-company"><i class="fa-solid fa-building"></i> ${lead.empresa_o_proyecto || 'Origin One Prospect'}</p>
    <div class="card-info-row"><i class="fa-solid fa-clock"></i> <span>${lead.hora_propuesta || 'Por confirmar'}</span></div>
    <div class="card-info-row"><i class="fa-solid fa-phone"></i> <span>${lead.telefono_whatsapp || 'No especificado'}</span></div>
    <div class="card-footer">
      <span style="font-size:11px; color:#9ca3af;">ID: ${lead.id}</span>
      <a href="${waUrl}" target="_blank" onclick="event.stopPropagation()" class="btn-card-action"><i class="fa-brands fa-whatsapp"></i> Chat</a>
    </div>
  `;
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
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${lead.id}</strong></td>
      <td><div style="font-weight:700;">${lead.nombre_cliente}</div><div style="font-size:12px; color:#9ca3af;">${lead.empresa_o_proyecto}</div></td>
      <td><div>${lead.telefono_whatsapp}</div><div style="font-size:11px; color:#9ca3af;">${lead.email}</div></td>
      <td>${lead.fecha_propuesta} - ${lead.hora_propuesta}</td>
      <td><span class="channel-tag tag-signal">${lead.canal_origen}</span></td>
      <td><span class="badge-count" style="background:rgba(139,92,246,0.2); color:#c084fc;">${lead.etapa || 'Cita Agendada'}</span></td>
      <td><button class="glass-btn" style="padding:4px 10px; font-size:11px;" onclick="openModal('${lead.id}')"><i class="fa-solid fa-eye"></i> Detalle</button></td>
    `;
    tbody.appendChild(tr);
  });
}

function openModal(id) {
  const lead = allLeads.find(l => l.id === id);
  if (!lead) return;

  currentActiveLeadId = id;
  document.getElementById('modalName').innerText = lead.nombre_cliente || 'Prospecto sin nombre';
  document.getElementById('modalCompany').innerText = lead.empresa_o_proyecto || 'Proyecto no especificado';
  document.getElementById('modalEmail').innerText = lead.email || 'No especificado';
  document.getElementById('modalPhone').innerText = lead.telefono_whatsapp || 'No especificado';
  document.getElementById('modalDateTime').innerText = `${lead.fecha_propuesta || 'Por confirmar'} a las ${lead.hora_propuesta || 'Por confirmar'}`;
  document.getElementById('modalNeed').innerText = lead.resumen_necesidad || 'Sin detalles especificados';
  document.getElementById('modalChannel').innerText = lead.canal_origen || 'Canal General';
  document.getElementById('stageSelect').value = lead.etapa || 'Cita Agendada';

  const cleanPhone = (lead.telefono_whatsapp || '').replace(/\D/g, '');
  const waMsg = encodeURIComponent(`Hola ${lead.nombre_cliente}, te escribo de Origin One sobre tu cita de diagnóstico.`);
  const waBtn = document.getElementById('modalWaBtn');
  if (cleanPhone) {
    waBtn.href = `https://wa.me/${cleanPhone.startsWith('52') ? cleanPhone : '52' + cleanPhone}?text=${waMsg}`;
    waBtn.style.display = 'flex';
  } else {
    waBtn.style.display = 'none';
  }

  renderNotesTimeline(lead.notas_internas || []);
  document.getElementById('leadModal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('leadModal').classList.add('hidden');
  currentActiveLeadId = null;
}

async function updateLeadStage() {
  if (!currentActiveLeadId) return;
  const newStage = document.getElementById('stageSelect').value;
  try {
    const res = await fetch(`/api/crm/leads/${currentActiveLeadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ etapa: newStage })
    });
    const data = await res.json();
    if (data.success) loadCrmModule();
  } catch (e) { console.error(e); }
}

async function addNote() {
  if (!currentActiveLeadId) return;
  const text = document.getElementById('noteInput').value.trim();
  const author = document.getElementById('noteAuthor').value.trim() || 'Artemio Gonzalez';
  if (!text) return;

  try {
    const res = await fetch(`/api/crm/leads/${currentActiveLeadId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto: text, autor: author })
    });
    const data = await res.json();
    if (data.success) {
      document.getElementById('noteInput').value = '';
      const idx = allLeads.findIndex(l => l.id === currentActiveLeadId);
      if (idx !== -1) {
        allLeads[idx] = data.lead;
        renderNotesTimeline(data.lead.notas_internas || []);
      }
    }
  } catch (e) { console.error(e); }
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
    div.innerHTML = `<div class="note-meta"><strong>${n.autor}</strong><span>${dateFormatted}</span></div><div class="note-text">${n.texto}</div>`;
    container.appendChild(div);
  });
}

function switchCrmSubView(viewName) {
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
}

function filterChannel(channel, btn) {
  currentFilterChannel = channel;
  document.querySelectorAll('.chip-filter').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderBoard(); renderTable();
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

async function openNewInvoiceModal() {
  const cliente = prompt("Nombre del cliente o empresa:");
  if (!cliente) return;
  const montoStr = prompt("Monto Subtotal ($ MXN):", "50000");
  if (!montoStr) return;

  try {
    await fetch('/api/facturacion/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cliente, empresa: cliente, subtotal: parseFloat(montoStr) })
    });
    loadFacturacionModule();
  } catch (e) { console.error(e); }
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

async function openNewTrxModal() {
  const tipo = prompt("Tipo de movimiento ('ingreso' o 'egreso'):", "ingreso");
  if (!tipo) return;
  const concepto = prompt("Concepto o descripción:");
  if (!concepto) return;
  const monto = prompt("Monto ($ MXN):", "10000");
  if (!monto) return;

  try {
    await fetch('/api/contabilidad/transaccion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo, concepto, monto: parseFloat(monto), categoria: tipo === 'ingreso' ? 'Venta Proyecto IA' : 'Operación' })
    });
    loadContabilidadModule();
  } catch (e) { console.error(e); }
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
