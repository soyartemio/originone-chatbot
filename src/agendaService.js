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
    return JSON.parse(data);
  } catch (error) {
    console.error('[AgendaService] Error al leer la base de datos:', error);
    return [];
  }
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
    creado_el: new Date().toISOString(),
    estatus: 'Confirmada (Notificada por WhatsApp)'
  };

  appointments.push(newAppointment);
  fs.writeFileSync(DB_PATH, JSON.stringify(appointments, null, 2));

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

  // Obtener números administradores de las variables de entorno
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

module.exports = {
  getAppointments,
  scheduleAppointment
};
