const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { processUserMessageGroq } = require('../src/groqEngine');

dotenv.config();
const configTxtPath = path.join(__dirname, '../CONFIGURACION_CLAVES.txt');
if (fs.existsSync(configTxtPath)) {
  dotenv.config({ path: configTxtPath, override: true });
}

async function testPersonality() {
  console.log('--- PRUEBA 1: Pregunta sobre automatización y S1GNAL ---');
  const res1 = await processUserMessageGroq('user_test_p1', 'Qué es S1GNAL y cómo me ayuda a automatizar?', 'Test Personalidad');
  console.log('Bot:', res1);

  console.log('\n--- PRUEBA 2: Usuario dice "Te busco después" ---');
  const res2 = await processUserMessageGroq('user_test_p1', 'Te busco después', 'Test Personalidad');
  console.log('Bot:', res2);
}

testPersonality();
