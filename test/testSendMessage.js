const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const axios = require('axios');

dotenv.config();
const configTxtPath = path.join(__dirname, '../CONFIGURACION_CLAVES.txt');
if (fs.existsSync(configTxtPath)) {
  dotenv.config({ path: configTxtPath, override: true });
}

async function checkToken() {
  const token = process.env.META_PAGE_ACCESS_TOKEN;
  console.log('Verificando token de Facebook Page con Meta API...');
  try {
    const res = await axios.get(`https://graph.facebook.com/v21.0/me?access_token=${token}`);
    console.log('✅ Token de Facebook válido para la Página:', res.data);
  } catch (error) {
    console.error('❌ Error con el token de Facebook:', error.response?.data || error.message);
  }
}

checkToken();
