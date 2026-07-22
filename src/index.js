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


const crmRoutes = require('./crmRoutes');

const PORT = process.env.PORT || 3000;

// Middleware para procesar JSON y URL encoded
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Subdominio crm.originone.com.mx y rutas de archivos estáticos
app.use((req, res, next) => {
  const host = req.headers.host || '';
  if (host.startsWith('crm.') && (req.path === '/' || req.path === '/index.html')) {
    return res.sendFile(path.join(__dirname, '../public/crm/index.html'));
  }
  next();
});

app.use('/admin', express.static(path.join(__dirname, '../public/crm')));
app.use('/crm', express.static(path.join(__dirname, '../public/crm')));

// Ruta principal de salud
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    empresa: 'Origin One — Intelligence that transforms',
    servicio: 'Chatbot Conversacional & CRM Dashboard Omnicanal',
    canales: ['Facebook Messenger', 'Instagram Direct', 'WhatsApp Cloud API', 'S1GNAL Web Chat'],
    notificacion_whatsapp: process.env.ADMIN_WHATSAPP_NUMBERS || '528110653947, 528120989813',
    crm_url: `/admin`,
    webhook_url: `/webhook`,
    citas_url: `/api/citas`
  });
});

// Montar endpoints de CRM API y Webhooks
app.use('/', crmRoutes);
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
