const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const axios = require('axios');

dotenv.config();
const configTxtPath = path.join(__dirname, '../CONFIGURACION_CLAVES.txt');
if (fs.existsSync(configTxtPath)) {
  dotenv.config({ path: configTxtPath, override: true });
}

async function sendDirectTest() {
  const token = process.env.META_PAGE_ACCESS_TOKEN;
  const psid = '1832770497687819'; // Real IGSID from live webhook


  console.log(`Enviando mensaje directo a PSID de conversación ${psid}...`);
  try {
    const res = await axios.post(
      `https://graph.facebook.com/v21.0/1287784707740447/messages?access_token=${token}`,
      {
        recipient: { id: psid },
        message: { text: '¡Hola Artemio! Saludos desde Origin One Chatbot con Groq Llama 3.3 🚀' }
      }
    );


    console.log('🎉 ¡¡¡MENSAJE ENVIADO CON ÉXITO A MESSENGER!!! 🎉', res.data);
  } catch (err) {
    console.error('❌ Error enviando mensaje:', err.response?.data || err.message);
  }
}

sendDirectTest();
