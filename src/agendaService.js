const fs = require('fs');
const path = require('path');
const { sendWhatsAppNotification } = require('./whatsappService');

const DB_PATH = path.join(__dirname, '../data/appointments.json');

// Asegurar que exista el directorio data/
function ensureDbExists() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify([], null, 2));
  }
}

/**
 * Obtener todas las citas guardadas
 */
function getAppointments() {
  ensureDbExists();
  try {
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data) || [];
  } catch (error) {
    console.error('[AgendaService] Error al leer la base de datos:', error);
    return [];
  }
}



/**
 * Guardar la lista de citas / leads en el archivo JSON
 */
function saveAppointments(appointments) {
  ensureDbExists();
  fs.writeFileSync(DB_PATH, JSON.stringify(appointments, null, 2));
}

/**
 * Agendar una nueva cita de diagnóstico de 30 minutos y notificar por WhatsApp
 */
async function scheduleAppointment(params) {
  ensureDbExists();
  const appointments = getAppointments();

  const newAppointment = {
    id: 'CITA-' + Date.now().toString(36).toUpperCase(),
    nombre_cliente: params.nombre_cliente || 'No especificado',
    email: params.email || 'No especificado',
    telefono_whatsapp: params.telefono_whatsapp || 'No especificado',
    empresa_o_proyecto: params.empresa_o_proyecto || 'Origin One Prospect',
    fecha_propuesta: params.fecha_propuesta || 'Por confirmar',
    hora_propuesta: params.hora_propuesta || 'Por confirmar',
    resumen_necesidad: params.resumen_necesidad || 'Consulta sobre soluciones de IA / automatización',
    canal_origen: params.canal_origen || 'Chatbot Conversacional',
    etapa: params.etapa || 'Cita Agendada',
    notas_internas: [],
    creado_el: new Date().toISOString(),
    estatus: 'Confirmada (Notificada por WhatsApp)'
  };

  appointments.unshift(newAppointment);
  saveAppointments(appointments);

  console.log(`[AgendaService] ✅ Cita registrada exitosamente (${newAppointment.id}):`, newAppointment);

  // Formatear mensaje para los números de WhatsApp administradores
  const notificationText = 
`📌 *NUEVA CITA DE DIAGNÓSTICO AGENDADA — ORIGIN ONE*

👤 *Cliente:* ${newAppointment.nombre_cliente}
🏢 *Empresa / Proyecto:* ${newAppointment.empresa_o_proyecto}
📧 *Email:* ${newAppointment.email}
📱 *WhatsApp Cliente:* ${newAppointment.telefono_whatsapp}
📅 *Fecha Propuesta:* ${newAppointment.fecha_propuesta}
⏰ *Hora Propuesta:* ${newAppointment.hora_propuesta}
💬 *Canal de Origen:* ${newAppointment.canal_origen}
📝 *Necesidad:* ${newAppointment.resumen_necesidad}

🆔 *ID Cita:* ${newAppointment.id}`;

  const adminNumbers = (process.env.ADMIN_WHATSAPP_NUMBERS || '528110653947,528120989813')
    .split(',')
    .map(n => n.trim())
    .filter(Boolean);

  console.log(`[AgendaService] Enviando notificaciones de cita a WhatsApp a:`, adminNumbers);

  const dispatchResults = await Promise.all(
    adminNumbers.map(number => sendWhatsAppNotification(number, notificationText))
  );

  return {
    success: true,
    appointmentId: newAppointment.id,
    appointment: newAppointment,
    notificationStatus: dispatchResults
  };
}

/**
 * Actualizar datos de un Lead / Cita por ID
 */
function updateLead(id, updateData) {
  const appointments = getAppointments();
  const index = appointments.findIndex(item => item.id === id);
  if (index === -1) return null;

  appointments[index] = {
    ...appointments[index],
    ...updateData,
    actualizado_el: new Date().toISOString()
  };

  saveAppointments(appointments);
  return appointments[index];
}

/**
 * Agregar nota interna a un Lead
 */
function addLeadNote(id, noteText, author = 'Ejecutivo Origin One') {
  const appointments = getAppointments();
  const index = appointments.findIndex(item => item.id === id);
  if (index === -1) return null;

  if (!appointments[index].notas_internas) {
    appointments[index].notas_internas = [];
  }

  const newNote = {
    id: 'NOTA-' + Date.now().toString(36).toUpperCase(),
    texto: noteText,
    autor: author,
    fecha: new Date().toISOString()
  };

  appointments[index].notas_internas.unshift(newNote);
  appointments[index].actualizado_el = new Date().toISOString();

  saveAppointments(appointments);
  return appointments[index];
}

/**
 * Eliminar un Lead / Cita
 */
function deleteLead(id) {
  let appointments = getAppointments();
  const initialLength = appointments.length;
  appointments = appointments.filter(item => item.id !== id);
  if (appointments.length === initialLength) return false;

  saveAppointments(appointments);
  return true;
}

/**
 * Guardar un mensaje en el historial de conversaciones del Lead / Cita
 */
function appendChatMessage(userId, role, messageText, channelName = 'Omnicanal', userName = null) {
  // Ignorar pruebas sintéticas internas para mantener el CRM limpio para prospectos reales
  if (!userId || userId.toLowerCase().includes('test') || userId.toLowerCase().includes('verify')) {
    return null;
  }

  const appointments = getAppointments();

  
  // Buscar lead por ID, teléfono o canal
  let lead = appointments.find(item => item.id === userId || item.telefono_whatsapp === userId || item.email === userId);

  if (!lead) {
    // Si aún no existe el lead en la agenda, creamos un registro preliminar con datos reales
    lead = {
      id: userId.startsWith('CITA-') ? userId : 'LEAD-' + userId,
      nombre_cliente: userName || `Usuario (${channelName})`,
      email: 'Por consultar',
      telefono_whatsapp: userId.length > 8 && !userId.includes(' ') ? userId : 'Por consultar',
      empresa_o_proyecto: 'Interacción en Vivo',
      fecha_propuesta: new Date().toISOString().split('T')[0],
      hora_propuesta: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
      resumen_necesidad: `Contacto en vivo vía ${channelName}`,
      canal_origen: channelName,
      etapa: 'Cita Agendada',
      notas_internas: [],
      historial_mensajes: [],
      creado_el: new Date().toISOString(),
      estatus: 'En Conversación con IA'
    };
    appointments.unshift(lead);
  } else if (userName && (lead.nombre_cliente.startsWith('Usuario') || !lead.nombre_cliente)) {
    lead.nombre_cliente = userName;
  }

  if (!lead.historial_mensajes) {
    lead.historial_mensajes = [];
  }

  lead.historial_mensajes.push({
    rol: role, // 'user' o 'assistant'
    texto: messageText,
    fecha: new Date().toISOString()
  });

  lead.actualizado_el = new Date().toISOString();
  saveAppointments(appointments);
  return lead;
}


module.exports = {
  getAppointments,
  scheduleAppointment,
  saveAppointments,
  updateLead,
  addLeadNote,
  deleteLead,
  appendChatMessage
};


