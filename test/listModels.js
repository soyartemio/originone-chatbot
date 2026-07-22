const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { GoogleGenerativeAI } = require('@google/generative-ai');

dotenv.config();
const configTxtPath = path.join(__dirname, '../CONFIGURACION_CLAVES.txt');
if (fs.existsSync(configTxtPath)) {
  dotenv.config({ path: configTxtPath, override: true });
}

async function testModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  const genAI = new GoogleGenerativeAI(apiKey);
  const modelsToTest = ['gemini-1.5-flash-latest', 'gemini-1.5-pro-latest', 'gemini-1.0-pro', 'gemini-2.0-flash-exp'];

  for (const m of modelsToTest) {
    try {
      console.log(`Probando modelo: ${m}...`);
      const model = genAI.getGenerativeModel({ model: m });
      const res = await model.generateContent('Hola');
      console.log(`✅ EXITO con ${m}:`, res.response.text());
      break;
    } catch (err) {
      console.error(`❌ Falló con ${m}:`, err.message);
    }
  }
}

testModels();
