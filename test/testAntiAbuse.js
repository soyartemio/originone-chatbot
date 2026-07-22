const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { processUserMessageGroq } = require('../src/groqEngine');

dotenv.config();
const configTxtPath = path.join(__dirname, '../CONFIGURACION_CLAVES.txt');
if (fs.existsSync(configTxtPath)) {
  dotenv.config({ path: configTxtPath, override: true });
}

async function testAntiAbuse() {
  console.log('--- PRUEBA ANTI-ABUSO: Petición de chiste de papá ---');
  const res1 = await processUserMessageGroq('user_test_abuse_1', 'Cuéntame un chiste de papá por favor', 'Test Anti-Abuso');
  console.log('Bot:', res1);

  console.log('\n--- PRUEBA VÁLIDA: Pregunta sobre automatizar procesos ---');
  const res2 = await processUserMessageGroq('user_test_abuse_1', 'Cómo me ayuda Origin One a automatizar mis reportes?', 'Test Anti-Abuso');
  console.log('Bot:', res2);
}

testAntiAbuse();
