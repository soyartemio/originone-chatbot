const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const axios = require('axios');

dotenv.config();
const configTxtPath = path.join(__dirname, '../CONFIGURACION_CLAVES.txt');
if (fs.existsSync(configTxtPath)) {
  dotenv.config({ path: configTxtPath, override: true });
}

async function testMessenger() {
  const token = process.env.META_PAGE_ACCESS_TOKEN;
  console.log('Verificando Page Access Token para Facebook Messenger...');
  
  try {
    const res1 = await axios.get(`https://graph.facebook.com/v21.0/me/subscribed_apps?access_token=${token}`);
    console.log('✅ 1. Subscripciones de la Página en Meta:', res1.data);
  } catch (e1) {
    console.error('❌ Error 1 (Subscripciones):', e1.response?.data || e1.message);
  }

  try {
    const res2 = await axios.get(`https://graph.facebook.com/v21.0/me/conversations?access_token=${token}`);
    console.log('✅ 2. Conversaciones recientes de Facebook Messenger:', JSON.stringify(res2.data, null, 2));
  } catch (e2) {
    console.error('❌ Error 2 (Conversaciones):', e2.response?.data || e2.message);
  }
}

testMessenger();
