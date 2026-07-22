const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const axios = require('axios');

dotenv.config();
const configTxtPath = path.join(__dirname, '../CONFIGURACION_CLAVES.txt');
if (fs.existsSync(configTxtPath)) {
  dotenv.config({ path: configTxtPath, override: true });
}

async function testIgSend() {
  const igToken = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN;
  const fbToken = process.env.META_PAGE_ACCESS_TOKEN;
  const recipientId = '1832770497687819'; // Artemio's Instagram IGSID from log

  console.log('3. Intentando responder con IG Token a me/messages...');
  try {
    const res3 = await axios.post(
      `https://graph.facebook.com/v21.0/me/messages?access_token=${igToken}`,
      {
        recipient: { id: recipientId },
        message: { text: '¡Hola Artemio! Prueba de conexión directa de Instagram con Groq Llama 3.3.' }
      }
    );
    console.log('✅ EXITO CON IG TOKEN A ME/MESSAGES:', res3.data);
    return;
  } catch (err3) {
    console.error('❌ Error con IG Token a me/messages:', err3.response?.data || err3.message);
  }


  console.log('\n2. Intentando responder con Facebook Page Token a 17841415151197450/messages...');
  try {
    const res2 = await axios.post(
      `https://graph.facebook.com/v21.0/17841415151197450/messages?access_token=${fbToken}`,
      {
        recipient: { id: recipientId },
        message: { text: '¡Hola Artemio! Prueba de conexión directa de Instagram con Groq Llama 3.3.' }
      }
    );
    console.log('✅ EXITO CON FB TOKEN A IG ID:', res2.data);
    return;
  } catch (err2) {
    console.error('❌ Error con FB Token a IG ID:', err2.response?.data || err2.message);
  }
}

testIgSend();
