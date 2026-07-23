const { sendWhatsAppNotification } = require('./whatsappService');
const {
  isPreconditionFailure,
  isTransientStorageError,
  readAppointmentsSnapshot,
  writeAppointmentsSnapshot
} = require('./crmStorage');

let mutationQueue = Promise.resolve();

async function mutateAppointments(mutator) {
  const execute = async () => {
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        const snapshot = await readAppointmentsSnapshot();
        const appointments = structuredClone(snapshot.appointments);
        const result = mutator(appointments);
        await writeAppointmentsSnapshot(appointments, snapshot.etag);
        return result;
      } catch (error) {
        const rootError = error.cause || error;
        const retryable = isPreconditionFailure(rootError) || isTransientStorageError(rootError);
        if (!retryable || attempt === 4) throw error;
        await new Promise(resolve => setTimeout(resolve, attempt * 300));
      }
    }
  };

  const operation = mutationQueue.then(execute, execute);
  mutationQueue = operation.then(() => undefined, () => undefined);
  return operation;
}

/**
 * Obtener todas las citas guardadas
 */
async function getAppointments() {
  await mutationQueue;
  const snapshot = await readAppointmentsSnapshot();
  return snapshot.appointments;
}



/**
 * Guardar la lista de citas / leads en el archivo JSON
 */
async function saveAppointments(appointments) {
  return mutateAppointments(current => {
    current.splice(0, current.length, ...structuredClone(appointments));
    return current;
  });
}

/**
 * Agendar una nueva cita de diagnóstico de 30 minutos y notificar por WhatsApp
 */
async function scheduleAppointment(params) {
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

  await mutateAppointments(appointments => {
    appointments.unshift(newAppointment);
    return newAppointment;
  });

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
async function updateLead(id, updateData) {
  return mutateAppointments(appointments => {
    const index = appointments.findIndex(item => item.id === id);
    if (index === -1) return null;

    appointments[index] = {
      ...appointments[index],
      ...updateData,
      actualizado_el: new Date().toISOString()
    };
    return appointments[index];
  });
}

/**
 * Agregar nota interna a un Lead
 */
async function addLeadNote(id, noteText, author = 'Ejecutivo Origin One') {
  const newNote = {
    id: 'NOTA-' + Date.now().toString(36).toUpperCase(),
    texto: noteText,
    autor: author,
    fecha: new Date().toISOString()
  };

  return mutateAppointments(appointments => {
    const index = appointments.findIndex(item => item.id === id);
    if (index === -1) return null;
    if (!appointments[index].notas_internas) appointments[index].notas_internas = [];

    appointments[index].notas_internas.unshift(newNote);
    appointments[index].actualizado_el = new Date().toISOString();
    return appointments[index];
  });
}

/**
 * Eliminar un Lead / Cita
 */
async function deleteLead(id) {
  return mutateAppointments(appointments => {
    const index = appointments.findIndex(item => item.id === id);
    if (index === -1) return false;
    appointments.splice(index, 1);
    return true;
  });
}

/**
 * Guardar un mensaje en el historial de conversaciones del Lead / Cita
 */
function appendChatMessageToAppointments(appointments, {
  userId,
  role,
  messageText,
  channelName = 'Omnicanal',
  userName = null,
  eventId = null,
  createdAt = null
}) {
  const normalizedUserId = String(userId || '').trim();
  const normalizedText = String(messageText || '').trim();
  if (!normalizedUserId || !normalizedText) {
    throw new Error('userId y messageText son requeridos para registrar una interacción');
  }

  const isTest = normalizedUserId.toLowerCase().includes('test') || normalizedUserId.toLowerCase().includes('verify');
  const isWhatsApp = channelName.toLowerCase().includes('whatsapp');
  const parsedDate = createdAt ? new Date(createdAt) : new Date();
  const now = Number.isNaN(parsedDate.getTime()) ? new Date().toISOString() : parsedDate.toISOString();

  let lead = appointments.find(item =>
    item.external_id === normalizedUserId ||
    item.id === normalizedUserId ||
    item.id === `LEAD-${normalizedUserId}` ||
    item.telefono_whatsapp === normalizedUserId ||
    item.email === normalizedUserId
  );

  if (!lead) {
    const defaultName = userName || (isTest ? `🧪 Lead de Prueba (${channelName})` : `Usuario (${channelName})`);
    lead = {
      id: normalizedUserId.startsWith('CITA-') ? normalizedUserId : 'LEAD-' + normalizedUserId,
      external_id: normalizedUserId,
      nombre_cliente: defaultName,
      email: 'Por consultar',
      telefono_whatsapp: isWhatsApp ? normalizedUserId : 'Por consultar',
      empresa_o_proyecto: isTest ? 'Entorno de Pruebas' : 'Interacción en Vivo',
      fecha_propuesta: now.split('T')[0],
      hora_propuesta: new Date(now).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
      resumen_necesidad: isTest ? `Interacción de prueba vía ${channelName}` : `Contacto en vivo vía ${channelName}`,
      canal_origen: channelName,
      etapa: isTest ? 'Prueba / Test' : 'Cita Agendada',
      es_prueba: isTest,
      notas_internas: [],
      historial_mensajes: [],
      creado_el: now,
      estatus: 'En Conversación con IA'
    };
    appointments.unshift(lead);
  } else if (userName && (lead.nombre_cliente?.startsWith('Usuario') || lead.nombre_cliente?.startsWith('🧪') || !lead.nombre_cliente)) {
    lead.nombre_cliente = userName;
  }

  if (!lead.historial_mensajes) lead.historial_mensajes = [];
  if (eventId && lead.historial_mensajes.some(message => message.evento_id === eventId)) {
    return { lead, added: false };
  }

  lead.historial_mensajes.push({
    rol: role,
    texto: normalizedText,
    ...(eventId ? { evento_id: eventId } : {}),
    fecha: now
  });
  lead.historial_mensajes.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
  lead.actualizado_el = lead.historial_mensajes.at(-1)?.fecha || now;
  return { lead, added: true };
}

async function appendChatMessage(userId, role, messageText, channelName = 'Omnicanal', userName = null, eventId = null, createdAt = null) {
  return mutateAppointments(appointments => appendChatMessageToAppointments(appointments, {
    userId,
    role,
    messageText,
    channelName,
    userName,
    eventId,
    createdAt
  }).lead);
}

async function importChatMessages(interactions) {
  if (!Array.isArray(interactions)) throw new Error('interactions debe ser una lista');

  return mutateAppointments(appointments => {
    let importedMessages = 0;
    const leadIds = new Set();

    const ordered = [...interactions].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
    for (const interaction of ordered) {
      const result = appendChatMessageToAppointments(appointments, interaction);
      leadIds.add(result.lead.id);
      if (result.added) importedMessages++;
    }

    return {
      importedMessages,
      skippedMessages: interactions.length - importedMessages,
      affectedLeads: leadIds.size
    };
  });
}


module.exports = {
  getAppointments,
  scheduleAppointment,
  saveAppointments,
  updateLead,
  addLeadNote,
  deleteLead,
  appendChatMessage,
  importChatMessages
};
