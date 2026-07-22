const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { processUserMessage } = require('../src/geminiEngine');

dotenv.config();
const configTxtPath = path.join(__dirname, '../CONFIGURACION_CLAVES.txt');
if (fs.existsSync(configTxtPath)) {
  dotenv.config({ path: configTxtPath, override: true });
}

async function testLive() {
  console.log('Enviando mensaje de prueba a Gemini...');
  const res = await processUserMessage('test_user_live', 'Hola que servicios ofrece Origin One?', 'Test script');
  console.log('\n--- Respuesta de Gemini ---');
  console.log(res);
}

testLive();
