const fs = require('fs');
const path = require('path');
const { sendWhatsAppNotification } = require('./whatsappService');

const DB_PATH = path.join(__dirname, '../data/appointments.json');

const DEFAULT_LEADS = [
  {
    "id": "CITA-MRVEDMBX",
    "nombre_cliente": "Artemio Gonzalez",
    "email": "artemio@originone.com.mx",
    "telefono_whatsapp": "+52 81 1065 3947",
    "empresa_o_proyecto": "Origin One — AI Enterprise OS",
    "fecha_propuesta": "2026-07-28",
    "hora_propuesta": "11:00 AM",
    "resumen_necesidad": "Implementación de arquitectura Agentic AI para automatización omnicanal de diagnósticos y citas.",
    "canal_origen": "Facebook Messenger",
    "creado_el": "2026-07-22T01:22:14.733Z",
    "estatus": "Confirmada (Notificada por WhatsApp)",
    "etapa": "Diagnóstico Realizado",
    "notas_internas": [
      {
        "id": "NOTA-MRWHNKXJ",
        "texto": "Excelente reunión inicial de diagnóstico. Se revisó la integración omnicanal y el CRM transparente entre socios.",
        "autor": "Artemio Gonzalez",
        "fecha": "2026-07-22T19:41:44.503Z"
      }
    ],
    "historial_mensajes": [
      { "rol": "user", "texto": "Hola, me gustaría agendar una cita de diagnóstico para Origin One.", "fecha": "2026-07-22T01:21:00.000Z" },
      { "rol": "assistant", "texto": "¡Hola, Artemio! Con gusto agendamos tu sesión de diagnóstico de 30 minutos sin costo. ¿Cuál es tu correo y fecha de preferencia?", "fecha": "2026-07-22T01:21:05.000Z" },
      { "rol": "user", "texto": "Mi correo es artemio@originone.com.mx y prefiero el 28 de Julio a las 11:00 AM.", "fecha": "2026-07-22T01:21:40.000Z" },
      { "rol": "assistant", "texto": "¡Excelente! He agendado tu cita para el 28 de Julio a las 11:00 AM. En breve te enviamos la confirmación por WhatsApp a tu celular. ¡Nos vemos pronto!", "fecha": "2026-07-22T01:22:14.000Z" }
    ]
  },
  {
    "id": "LEAD-27280354771665378",
    "nombre_cliente": "Artemio (Facebook Messenger)",
    "email": "artemio@originone.com.mx",
    "telefono_whatsapp": "528110653947",
    "empresa_o_proyecto": "Interacción Messenger Live",
    "fecha_propuesta": "2026-07-25",
    "hora_propuesta": "10:00 AM",
    "resumen_necesidad": "Consulta de servicios de IA aplicada a procesos en Messenger",
    "canal_origen": "Facebook Messenger",
    "etapa": "Cita Agendada",
    "creado_el": "2026-07-22T02:10:00.000Z",
    "estatus": "En Conversación con IA",
    "notas_internas": [],
    "historial_mensajes": [
      { "rol": "user", "texto": "Hola, probando conexión de Messenger con la IA de Origin One.", "fecha": "2026-07-22T02:10:01.000Z" },
      { "rol": "assistant", "texto": "¡Hola! Bienvenido a Origin One. Soy el asistente de IA. ¿En qué proceso de tu empresa te gustaría implementar inteligencia artificial hoy?", "fecha": "2026-07-22T02:10:04.000Z" },
      { "rol": "user", "texto": "Quiero automatizar el seguimiento de prospectos y agendamiento.", "fecha": "2026-07-22T02:11:15.000Z" },
      { "rol": "assistant", "texto": "Perfecto. Diseñamos agentes e IA a la medida para conectar tus canales (WhatsApp, Messenger, Instagram y Web) con tu CRM. ¿Te gustaría agendar una llamada de 30 min?", "fecha": "2026-07-22T02:11:20.000Z" }
    ]
  }
];

// Asegurar que exista el directorio data/
function ensureDbExists() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_LEADS, null, 2));
  } else {
    try {
      const content = fs.readFileSync(DB_PATH, 'utf8').trim();
      if (!content || content === '[]') {
        fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_LEADS, null, 2));
      }
    } catch (e) {
      fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_LEADS, null, 2));
    }
  }
}

/**
 * Obtener todas las citas guardadas
 */
function getAppointments() {
  ensureDbExists();
  try {
    const data = fs.readFileSync(DB_PATH, 'utf8');
    const parsed = JSON.parse(data);
    return (parsed && parsed.length > 0) ? parsed : DEFAULT_LEADS;
  } catch (error) {
    console.error('[AgendaService] Error al leer la base de datos:', error);
    return DEFAULT_LEADS;
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
function appendChatMessage(userId, role, messageText, channelName = 'Omnicanal') {
  const appointments = getAppointments();
  
  // Buscar lead por ID, teléfono o canal
  let lead = appointments.find(item => item.id === userId || item.telefono_whatsapp === userId || item.email === userId);

  if (!lead) {
    // Si aún no existe el lead en la agenda, creamos un registro preliminar de interacción
    lead = {
      id: userId.startsWith('CITA-') ? userId : 'LEAD-' + userId,
      nombre_cliente: `Usuario (${channelName})`,
      email: 'No especificado',
      telefono_whatsapp: userId.length > 8 && !userId.includes(' ') ? userId : 'Por consultar',
      empresa_o_proyecto: 'Interacción en Vivo',
      fecha_propuesta: 'En conversación',
      hora_propuesta: 'En conversación',
      resumen_necesidad: `Contacto en vivo vía ${channelName}`,
      canal_origen: channelName,
      etapa: 'Nuevo Prospecto',
      notas_internas: [],
      historial_mensajes: [],
      creado_el: new Date().toISOString(),
      estatus: 'En Conversación con IA'
    };
    appointments.unshift(lead);
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


