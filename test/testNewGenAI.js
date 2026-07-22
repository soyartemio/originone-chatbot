const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();
const configTxtPath = path.join(__dirname, '../CONFIGURACION_CLAVES.txt');
if (fs.existsSync(configTxtPath)) {
  dotenv.config({ path: configTxtPath, override: true });
}

async function testSdk() {
  const apiKey = process.env.GEMINI_API_KEY;
  console.log('Testing key:', apiKey);

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await response.json();
    console.log('Respuesta de modelos de Google API:', JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Error enviando consulta:', e.message);
  }

}

testSdk();
