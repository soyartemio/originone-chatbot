const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { generateBotResponse } = require('../src/metaWebhook');

dotenv.config();
const configTxtPath = path.join(__dirname, '../CONFIGURACION_CLAVES.txt');
if (fs.existsSync(configTxtPath)) {
  dotenv.config({ path: configTxtPath, override: true });
}

async function testFallback() {
  console.log('Probando respuesta con sistema de respaldo automático (Groq -> Gemini 2.5 Flash)...');
  const res = await generateBotResponse('user_test_fallback', 'Como me pueden ayudar si no se que es lo que quiero?', 'Instagram Direct');
  console.log('\n🎉 RESULTADO FINAL RESPONDIDO AL USUARIO:');
  console.log(res);
}

testFallback();
