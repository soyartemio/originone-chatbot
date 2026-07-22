const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { GoogleGenAI } = require('@google/genai');

dotenv.config();
const configTxtPath = path.join(__dirname, '../CONFIGURACION_CLAVES.txt');
if (fs.existsSync(configTxtPath)) {
  dotenv.config({ path: configTxtPath, override: true });
}

async function testGenAISdk() {
  const apiKey = process.env.GEMINI_API_KEY;
  console.log('Testing @google/genai with key:', apiKey);

  const ai = new GoogleGenAI({ apiKey: apiKey });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: 'Hola, explicame que hace Origin One en 1 frase',
    });




    console.log('\n✅ RESPUESTA EXITOSA DE GEMINI CON @google/genai:');
    console.log(response.text);
  } catch (err) {
    console.error('❌ Error con @google/genai:', err);
  }
}

testGenAISdk();
