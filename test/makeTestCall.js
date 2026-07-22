const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const axios = require('axios');

dotenv.config();
const configTxtPath = path.join(__dirname, '../CONFIGURACION_CLAVES.txt');
if (fs.existsSync(configTxtPath)) {
  dotenv.config({ path: configTxtPath, override: true });
}

async function makeTestCalls() {
  const pageToken = process.env.META_PAGE_ACCESS_TOKEN;
  console.log('Realizando llamada de prueba API para activar el permiso en Meta...');

  try {
    const res1 = await axios.get(`https://graph.facebook.com/v21.0/me?fields=id,name,category,tasks&access_token=${pageToken}`);
    console.log('✅ Llamada 1 exitosa (Page info):', res1.data);
  } catch (err) {
    console.error('❌ Error llamada 1:', err.response?.data || err.message);
  }

  try {
    const res2 = await axios.get(`https://graph.facebook.com/v21.0/me/conversations?access_token=${pageToken}`);
    console.log('✅ Llamada 2 exitosa (Conversaciones):', res2.data);
  } catch (err) {
    console.error('❌ Error llamada 2:', err.response?.data || err.message);
  }

  try {
    const res3 = await axios.get(`https://graph.facebook.com/v21.0/17841415151197450?fields=id,username&access_token=${pageToken}`);
    console.log('✅ Llamada 3 exitosa (Instagram Account Info):', res3.data);
  } catch (err) {
    console.error('❌ Error llamada 3:', err.response?.data || err.message);
  }
}

makeTestCalls();
