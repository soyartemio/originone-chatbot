let allLeads = [];
let currentFilterChannel = 'todos';
let currentActiveLeadId = null;

document.addEventListener('DOMContentLoaded', () => {
  loadCrmData();
});

/**
  * Cargar datos desde la API REST del CRM
  */
async function loadCrmData() {
  const refreshIcon = document.getElementById('refreshIcon');
  if (refreshIcon) refreshIcon.classList.add('fa-spin');

  try {
    const resLeads = await fetch('/api/crm/leads');
    const dataLeads = await resLeads.json();

    if (dataLeads.success) {
      allLeads = dataLeads.leads || [];
    }

    const resKpis = await fetch('/api/crm/kpis');
    const dataKpis = await resKpis.json();

    if (dataKpis.success) {
      renderKpis(dataKpis.kpis);
    }

    renderBoard();
    renderTable();
  } catch (error) {
    console.error('Error cargando datos del CRM:', error);
  } finally {
    if (refreshIcon) refreshIcon.classList.remove('fa-spin');
  }
}

/**
  * Renderizar tarjetas de KPIs
  */
function renderKpis(kpis) {
  document.getElementById('kpiTotalLeads').innerText = kpis.totalLeads || 0;
  document.getElementById('kpiCitasAgendadas').innerText = kpis.citasAgendadas || 0;
  document.getElementById('kpiClientesGanados').innerText = kpis.clientesGanados || 0;
  document.getElementById('kpiTasaConversion').innerText = kpis.tasaConversion || '0.0%';
}

/**
  * Filtrar leads según canal y término de búsqueda
  */
function getFilteredLeads() {
  const searchVal = document.getElementById('searchInput').value.toLowerCase().trim();

  return allLeads.filter(lead => {
    // Filtro por canal
    const canal = (lead.canal_origen || '').toLowerCase();
    let matchesChannel = true;
    if (currentFilterChannel === 'signal') matchesChannel = canal.includes('signal');
    else if (currentFilterChannel === 'instagram') matchesChannel = canal.includes('instagram');
    else if (currentFilterChannel === 'facebook') matchesChannel = canal.includes('facebook');

    // Filtro por búsqueda
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

/**
  * Renderizar Tablero Kanban
  */
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
    let targetColKey = 'cita';

    if (etapa.includes('diag')) targetColKey = 'diagnostico';
    else if (etapa.includes('propuesta')) targetColKey = 'propuesta';
    else if (etapa.includes('ganado') || etapa.includes('cliente')) targetColKey = 'ganado';

    counts[targetColKey]++;
    const cardEl = createLeadCard(lead);
    cols[targetColKey].appendChild(cardEl);
  });

  document.getElementById('countCita').innerText = counts.cita;
  document.getElementById('countDiagnostico').innerText = counts.diagnostico;
  document.getElementById('countPropuesta').innerText = counts.propuesta;
  document.getElementById('countGanado').innerText = counts.ganado;
}

/**
  * Crear elemento de tarjeta individual de Lead
  */
function createLeadCard(lead) {
  const div = document.createElement('div');
  div.className = 'lead-card';
  div.onclick = () => openModal(lead.id);

  const canalName = lead.canal_origen || 'Chatbot';
  let tagClass = 'tag-signal';
  let iconClass = 'fa-solid fa-microphone';

  if (canalName.toLowerCase().includes('instagram')) {
    tagClass = 'tag-instagram';
    iconClass = 'fa-brands fa-instagram';
  } else if (canalName.toLowerCase().includes('facebook')) {
    tagClass = 'tag-facebook';
    iconClass = 'fa-brands fa-facebook';
  }

  const cleanPhone = (lead.telefono_whatsapp || '').replace(/\D/g, '');
  const waMsg = encodeURIComponent(`Hola ${lead.nombre_cliente}, te escribo del equipo ejecutivo de Origin One respecto a tu cita de diagnóstico.`);
  const waUrl = cleanPhone ? `https://wa.me/${cleanPhone.startsWith('52') ? cleanPhone : '52' + cleanPhone}?text=${waMsg}` : '#';

  div.innerHTML = `
    <div class="card-top">
      <span class="channel-tag ${tagClass}"><i class="${iconClass}"></i> ${canalName}</span>
      <span class="date-badge">${lead.fecha_propuesta || 'Sin fecha'}</span>
    </div>
    <h4 class="lead-name">${lead.nombre_cliente || 'Prospecto sin nombre'}</h4>
    <p class="lead-company"><i class="fa-solid fa-building"></i> ${lead.empresa_o_proyecto || 'Origin One Prospect'}</p>
    
    <div class="card-info-row">
      <i class="fa-solid fa-clock"></i> <span>${lead.hora_propuesta || 'Por confirmar'}</span>
    </div>
    <div class="card-info-row">
      <i class="fa-solid fa-phone"></i> <span>${lead.telefono_whatsapp || 'No especificado'}</span>
    </div>

    <div class="card-footer">
      <span style="font-size:11px; color:#9ca3af;">ID: ${lead.id}</span>
      <a href="${waUrl}" target="_blank" onclick="event.stopPropagation()" class="btn-card-action">
        <i class="fa-brands fa-whatsapp"></i> Chat
      </a>
    </div>
  `;

  return div;
}

/**
  * Renderizar Tabla de Vista Lista
  */
function renderTable() {
  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = '';
  const filtered = getFilteredLeads();

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#9ca3af; padding:30px;">No se encontraron registros de citas o prospectos.</td></tr>`;
    return;
  }

  filtered.forEach(lead => {
    const tr = document.createElement('tr');
    const cleanPhone = (lead.telefono_whatsapp || '').replace(/\D/g, '');
    const waMsg = encodeURIComponent(`Hola ${lead.nombre_cliente}, te escribo de Origin One.`);
    const waUrl = cleanPhone ? `https://wa.me/${cleanPhone.startsWith('52') ? cleanPhone : '52' + cleanPhone}?text=${waMsg}` : '#';

    tr.innerHTML = `
      <td><strong>${lead.id}</strong></td>
      <td>
        <div style="font-weight:700;">${lead.nombre_cliente}</div>
        <div style="font-size:12px; color:#9ca3af;">${lead.empresa_o_proyecto}</div>
      </td>
      <td>
        <div>${lead.telefono_whatsapp}</div>
        <div style="font-size:11px; color:#9ca3af;">${lead.email}</div>
      </td>
      <td>${lead.fecha_propuesta} - ${lead.hora_propuesta}</td>
      <td><span class="channel-tag tag-signal">${lead.canal_origen}</span></td>
      <td><span class="badge-count" style="background:rgba(139,92,246,0.2); color:#c084fc;">${lead.etapa || 'Cita Agendada'}</span></td>
      <td>
        <button class="glass-btn" style="padding:4px 10px; font-size:11px;" onclick="openModal('${lead.id}')">
          <i class="fa-solid fa-eye"></i> Detalle
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/**
  * Abrir Modal de Detalle de Lead y Notas
  */
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

  // Configurar botón directo de WhatsApp
  const cleanPhone = (lead.telefono_whatsapp || '').replace(/\D/g, '');
  const waMsg = encodeURIComponent(`Hola ${lead.nombre_cliente}, te escribo de Origin One para dar seguimiento a tu cita de diagnóstico.`);
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

/**
  * Cerrar Modal
  */
function closeModal() {
  document.getElementById('leadModal').classList.add('hidden');
  currentActiveLeadId = null;
}

/**
  * Actualizar Etapa del Embudo
  */
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
    if (data.success) {
      loadCrmData();
    }
  } catch (e) {
    console.error('Error actualizando etapa:', e);
  }
}

/**
  * Agregar Nota Interna de Seguimiento
  */
async function addNote() {
  if (!currentActiveLeadId) return;

  const noteInput = document.getElementById('noteInput');
  const authorInput = document.getElementById('noteAuthor');
  const text = noteInput.value.trim();
  const author = authorInput.value.trim() || 'Artemio Gonzalez';

  if (!text) return;

  try {
    const res = await fetch(`/api/crm/leads/${currentActiveLeadId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto: text, autor: author })
    });
    const data = await res.json();
    if (data.success) {
      noteInput.value = '';
      const leadIndex = allLeads.findIndex(l => l.id === currentActiveLeadId);
      if (leadIndex !== -1) {
        allLeads[leadIndex] = data.lead;
        renderNotesTimeline(data.lead.notas_internas || []);
      }
    }
  } catch (e) {
    console.error('Error guardando nota:', e);
  }
}

/**
  * Renderizar lista de notas de seguimiento
  */
function renderNotesTimeline(notes) {
  const container = document.getElementById('notesTimeline');
  container.innerHTML = '';

  if (notes.length === 0) {
    container.innerHTML = `<p style="font-size:12px; color:#9ca3af; text-align:center; padding:10px;">Aún no hay notas registradas para este prospecto.</p>`;
    return;
  }

  notes.forEach(n => {
    const div = document.createElement('div');
    div.className = 'note-item';
    const dateFormatted = new Date(n.fecha).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
    div.innerHTML = `
      <div class="note-meta">
        <strong>${n.autor}</strong>
        <span>${dateFormatted}</span>
      </div>
      <div class="note-text">${n.texto}</div>
    `;
    container.appendChild(div);
  });
}

/**
  * Alternar entre vistas Kanban y Lista
  */
function switchView(viewName) {
  const kanban = document.getElementById('viewKanban');
  const list = document.getElementById('viewList');
  const tabK = document.getElementById('tabKanban');
  const tabL = document.getElementById('tabList');

  if (viewName === 'kanban') {
    kanban.classList.remove('hidden');
    list.classList.add('hidden');
    tabK.classList.add('active');
    tabL.classList.remove('active');
  } else {
    kanban.classList.add('hidden');
    list.classList.remove('hidden');
    tabK.classList.remove('active');
    tabL.classList.add('active');
  }
}

/**
  * Filtrar por canal
  */
function filterChannel(channel, btn) {
  currentFilterChannel = channel;
  document.querySelectorAll('.chip-filter').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderBoard();
  renderTable();
}

/**
  * Búsqueda en vivo
  */
function handleSearch() {
  renderBoard();
  renderTable();
}
