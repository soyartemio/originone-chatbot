const axios = require('axios');

/**
 * Enviar mensaje / notificación por WhatsApp
 * @param {string} to - Número de destino (ej. "528110653947" o "+52 81 1065 3947")
 * @param {string} messageText - Contenido del mensaje
 */
async function sendWhatsAppNotification(to, messageText) {
  // Limpiar caracteres del número telefónico (solo dígitos)
  const cleanNumber = to.replace(/\D/g, '');
  
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  // Si no se han configurado credenciales reales de WhatsApp Cloud API, registramos en consola (Modo Simulación / Fallback)
  if (!token || !phoneNumberId) {
    console.log(`\n==================================================`);
    console.log(`📱 [SIMULACIÓN WHATSAPP DE NOTIFICACIÓN DE CITA]`);
    console.log(`➡️  Para: +${cleanNumber}`);
    console.log(`💬  Mensaje:\n${messageText}`);
    console.log(`==================================================\n`);
    return {
      success: true,
      mode: 'simulation',
      recipient: cleanNumber,
      message: 'Notificación registrada en consola (Configura WHATSAPP_TOKEN en .env para envío real)'
    };
  }

  try {
    const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;
    const response = await axios.post(
      url,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanNumber,
        type: 'text',
        text: {
          preview_url: false,
          body: messageText
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`[WhatsAppService] ✅ Mensaje enviado exitosamente a +${cleanNumber}:`, response.data);
    return {
      success: true,
      mode: 'cloud_api',
      data: response.data
    };
  } catch (error) {
    console.error(`[WhatsAppService] ❌ Error enviando mensaje a +${cleanNumber}:`, error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data || error.message
    };
  }
}

module.exports = {
  sendWhatsAppNotification
};
