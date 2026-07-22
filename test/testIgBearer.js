const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const axios = require('axios');

dotenv.config();
const configTxtPath = path.join(__dirname, '../CONFIGURACION_CLAVES.txt');
if (fs.existsSync(configTxtPath)) {
  dotenv.config({ path: configTxtPath, override: true });
}

async function testIgBearer() {
  const igToken = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN;
  const psid = '1832770497687819';

  console.log('Testing Instagram Token with Bearer Header...');
  try {
    const res = await axios.post(
      'https://graph.instagram.com/v21.0/me/messages',
      {
        recipient: { id: psid },
        message: { text: 'Prueba de respuesta por Instagram Graph API!' }
      },
      {
        headers: {
          'Authorization': `Bearer ${igToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('🎉 ¡¡¡EXITO CON INSTAGRAM GRAPH API BEARER!!! 🎉', res.data);
  } catch (err) {
    console.error('❌ Error Instagram Graph API:', err.response?.data || err.message);
  }
}

testIgBearer();
