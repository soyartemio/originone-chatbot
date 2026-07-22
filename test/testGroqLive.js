const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { processUserMessageGroq } = require('../src/groqEngine');

dotenv.config();
const configTxtPath = path.join(__dirname, '../CONFIGURACION_CLAVES.txt');
if (fs.existsSync(configTxtPath)) {
  dotenv.config({ path: configTxtPath, override: true });
}

async function testGroq() {
  console.log('Enviando consulta a Groq API (Llama 3.3 70B)...');
  const res = await processUserMessageGroq('user_test_groq', 'Hola, me interesa agendar una cita de diagnostico de 30 min', 'Test Groq');
  console.log('\n--- Respuesta de Groq (Llama 3.3 70B) ---');
  console.log(res);
}

testGroq();
