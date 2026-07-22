const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();
const configTxtPath = path.join(__dirname, '../CONFIGURACION_CLAVES.txt');
if (fs.existsSync(configTxtPath)) {
  dotenv.config({ path: configTxtPath, override: true });
}

const readline = require('readline');
const { processUserMessage } = require('../src/geminiEngine');
const { getAppointments } = require('../src/agendaService');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log(`\n===============================================================`);
console.log(`🤖 SIMULADOR INTERACTIVO CHATBOT ORIGIN ONE (GEMINI + AGENDA)`);
console.log(`===============================================================`);
console.log(`Prueba cómo responde Gemini con la base de conocimiento de originone.com.mx`);
console.log(`e intenta agendar una cita para ver las notificaciones a WhatsApp.`);
console.log(`Escribe 'exit' o 'salir' para terminar.\n`);

function askQuestion() {
  rl.question('👤 Usuario > ', async (input) => {
    const trimmed = input.trim();
    if (trimmed.toLowerCase() === 'exit' || trimmed.toLowerCase() === 'salir') {
      console.log('\n📌 Citas registradas hasta el momento en la base de datos:');
      console.log(JSON.stringify(await getAppointments(), null, 2));
      console.log('\n👋 ¡Hasta luego!');
      rl.close();
      return;
    }

    if (!trimmed) {
      askQuestion();
      return;
    }

    console.log('🤖 Gemini está pensando...');
    const reply = await processUserMessage('user_test_cli', trimmed, 'Terminal CLI Test');
    console.log(`\n🤖 Bot Origin One >\n${reply}\n`);
    askQuestion();
  });
}

askQuestion();
