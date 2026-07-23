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
const { isR2Configured } = require('./crmStorage');
const {
  createAuthRouter,
  requireApiAuth,
  requirePageAuth
} = require('./authService');

const PORT = process.env.PORT || 3000;

async function syncInstagramOnStartup() {
  if (!process.env.INSTAGRAM_PAGE_ACCESS_TOKEN) {
    console.warn('⚠️  Instagram no está configurado: se omite la recuperación inicial de conversaciones.');
    return;
  }

  try {
    const { syncInstagramInteractions } = require('./instagramSyncService');
    const result = await syncInstagramInteractions();
    console.log(
      `📥 Instagram sincronizado: ${result.conversationsFound} conversaciones, ` +
      `${result.importedMessages} mensajes nuevos, ${result.skippedMessages} ya registrados.`
    );
  } catch (error) {
    const metaError = error.response?.data?.error;
    console.error('[InstagramSync] No fue posible recuperar las conversaciones al iniciar:', metaError?.message || error.message);
  }
}

// Middleware para procesar JSON y URL encoded
app.set('trust proxy', 1);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'no-referrer');
  res.set('X-Frame-Options', 'DENY');
  next();
});

const authAssetsPath = path.join(__dirname, '../public/auth');
const authPageHeaders = (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  res.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  next();
};

app.get('/auth/webauthn.js', authPageHeaders, (req, res) => {
  res.sendFile(path.join(__dirname, '../node_modules/@simplewebauthn/browser/dist/bundle/index.umd.min.js'));
});
app.use('/auth', authPageHeaders, express.static(authAssetsPath, { index: 'index.html' }));
app.use('/api/auth', createAuthRouter());

// Subdominio crm.originone.com.mx y rutas de archivos estáticos
app.use((req, res, next) => {
  const host = req.headers.host || '';
  if (host.startsWith('crm.') && (req.path === '/' || req.path === '/index.html')) {
    return requirePageAuth(req, res, () => res.sendFile(path.join(__dirname, '../public/crm/index.html')));
  }
  next();
});

const crmAssetsPath = path.join(__dirname, '../public/crm');
const crmStaticOptions = {
  setHeaders(res, filePath) {
    if (filePath.endsWith(`${path.sep}sw.js`)) {
      res.set('Service-Worker-Allowed', '/');
      res.set('Cache-Control', 'no-cache');
    }
    if (filePath.endsWith(`${path.sep}manifest.webmanifest`)) {
      res.type('application/manifest+json');
    }
  }
};

app.use('/admin', requirePageAuth, express.static(crmAssetsPath, crmStaticOptions));
app.use('/crm', requirePageAuth, express.static(crmAssetsPath, crmStaticOptions));

app.use([
  '/api/crm',
  '/api/facturacion',
  '/api/contabilidad',
  '/api/bancos',
  '/api/socios'
], requireApiAuth);

const facturacionModule = require('./modules/facturacion');
const contabilidadModule = require('./modules/contabilidad');
const bancosModule = require('./modules/bancos');
const sociosModule = require('./modules/socios');

// Ruta principal de salud
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    empresa: 'Origin One — Sistemas e IA a la Medida',
    statement: 'Deja de usar la IA como un juguete. Empieza a usarla estratégicamente.',
    servicio: 'Origin One OS — Plataforma ERP Modular Empresarial',

    modulos: ['CRM & Citas', 'Facturación & Cotizaciones', 'Contabilidad & P&L', 'Bancos & Tesorería', 'Transparencia de Socios'],
    canales: ['Facebook Messenger', 'Instagram Direct', 'WhatsApp Cloud API', 'S1GNAL Web Chat'],
    almacenamiento_crm: isR2Configured() ? 'cloudflare_r2_privado' : 'archivo_local_no_persistente',
    notificacion_whatsapp: process.env.ADMIN_WHATSAPP_NUMBERS || '528110653947, 528120989813',
    crm_url: `/admin`,
    webhook_url: `/webhook`
  });
});

// Montar endpoints de Módulos ERP y Webhooks
app.use('/', crmRoutes);
app.use('/', facturacionModule);
app.use('/', contabilidadModule);
app.use('/', bancosModule);
app.use('/', sociosModule);
app.use('/', metaWebhookRouter);




app.listen(PORT, () => {
  if (process.env.NODE_ENV === 'production' && !isR2Configured()) {
    console.warn('⚠️  Cloudflare R2 no está configurado: las interacciones pueden perderse al reiniciar o desplegar el servicio.');
  } else if (isR2Configured()) {
    console.log('☁️  CRM conectado a Cloudflare R2 (bucket privado).');
  }
  console.log(`\n===============================================================`);
  console.log(`🚀 ORIGIN ONE CHATBOT ENGINE — SERVIDOR ACTIVO EN PUERTO ${PORT}`);
  console.log(`===============================================================`);
  console.log(`🌐 Base URL: http://localhost:${PORT}`);
  console.log(`🔗 Webhook URL para Meta (FB/IG/WhatsApp): http://localhost:${PORT}/webhook`);
  console.log(`📱 Notificaciones de citas dirigidas a WhatsApp: ${process.env.ADMIN_WHATSAPP_NUMBERS || '528110653947, 528120989813'}`);
  console.log(`💡 Para simular el chatbot localmente ejecuta: npm run test:bot`);
  console.log(`===============================================================\n`);

  if (process.env.NODE_ENV === 'production') {
    setImmediate(syncInstagramOnStartup);
  }
});
