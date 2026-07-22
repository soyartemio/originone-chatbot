const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const axios = require('axios');

dotenv.config();
const configTxtPath = path.join(__dirname, '../CONFIGURACION_CLAVES.txt');
if (fs.existsSync(configTxtPath)) {
  dotenv.config({ path: configTxtPath, override: true });
}

async function testSendReal() {
  const token = process.env.META_PAGE_ACCESS_TOKEN;
  console.log('Probando envío directo a Facebook Messenger con el NUEVO Token...');

  // Probar responder a la última conversación de Facebook Messenger
  try {
    const resConv = await axios.get(`https://graph.facebook.com/v21.0/me/conversations?access_token=${token}`);
    console.log('Conversaciones de la página:', JSON.stringify(resConv.data, null, 2));

    const threadId = resConv.data.data?.[0]?.id;
    if (threadId) {
      console.log(`Leyendo mensajes del hilo ${threadId}...`);
      const resMessages = await axios.get(`https://graph.facebook.com/v21.0/${threadId}?fields=participants,messages{message,from}&access_token=${token}`);
      console.log('Detalles del hilo:', JSON.stringify(resMessages.data, null, 2));

      const participantId = resMessages.data.participants?.data?.find(p => p.id !== '1287784707740447')?.id;
      if (participantId) {
        console.log(`Intentando enviar respuesta directa al participante de Facebook Messenger PSID: ${participantId}...`);
        const resSend = await axios.post(
          `https://graph.facebook.com/v21.0/me/messages?access_token=${token}`,
          {
            messaging_type: 'RESPONSE',
            recipient: { id: participantId },
            message: { text: '¡Hola! Mensaje de prueba confirmado desde Origin One Chatbot en vivo 🚀' }
          }
        );
        console.log('🎉 ¡¡¡RESPUESTA ENTREGADA CON ÉXITO EN MESSENGER!!! 🎉', resSend.data);
      }
    }
  } catch (err) {
    console.error('❌ Error en prueba Messenger:', err.response?.data || err.message);
  }
}

testSendReal();
