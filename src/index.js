const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const express = require('express');
const cors = require('cors');
const metaWebhookRouter = require('./metaWebhook');

// Cargar variables desde .env y desde CONFIGURACION_CLAVES.txt (visible en Finder)
dotenv.config();
const configTxtPath = path.join(__dirname, '../CONFIGURACION_CLAVES.txt');
if (fs.existsSync(configTxtPath)) {
  dotenv.config({ path: configTxtPath, override: true });
}

const app = express();
app.use(cors()); // Habilitar CORS para S1GNAL en originone.com.mx


const PORT = process.env.PORT || 3000;

// Middleware para procesar JSON y URL encoded
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ruta principal de salud
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    empresa: 'Origin One — Intelligence that transforms',
    servicio: 'Chatbot Conversacional Gemini con Agenda Omnicanal',
    canales: ['Facebook Messenger', 'Instagram Direct', 'WhatsApp Cloud API'],
    notificacion_whatsapp: process.env.ADMIN_WHATSAPP_NUMBERS || '528110653947, 528120989813',
    webhook_url: `/webhook`,
    citas_url: `/api/citas`
  });
});

// Montar endpoints de Webhook y API
app.use('/', metaWebhookRouter);

app.listen(PORT, () => {
  console.log(`\n===============================================================`);
  console.log(`🚀 ORIGIN ONE CHATBOT ENGINE — SERVIDOR ACTIVO EN PUERTO ${PORT}`);
  console.log(`===============================================================`);
  console.log(`🌐 Base URL: http://localhost:${PORT}`);
  console.log(`🔗 Webhook URL para Meta (FB/IG/WhatsApp): http://localhost:${PORT}/webhook`);
  console.log(`📱 Notificaciones de citas dirigidas a WhatsApp: ${process.env.ADMIN_WHATSAPP_NUMBERS || '528110653947, 528120989813'}`);
  console.log(`💡 Para simular el chatbot localmente ejecuta: npm run test:bot`);
  console.log(`===============================================================\n`);
});
