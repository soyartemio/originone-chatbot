const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();
const configTxtPath = path.join(__dirname, '../CONFIGURACION_CLAVES.txt');
if (fs.existsSync(configTxtPath)) {
  dotenv.config({ path: configTxtPath, override: true });
}

const { processUserMessage } = require('../src/geminiEngine');
const { getAppointments, scheduleAppointment } = require('../src/agendaService');

async function runAutoTest() {
  console.log(`\n===============================================================`);
  console.log(`🧪 PRUEBA AUTOMÁTICA DE COMPONENTES DEL CHATBOT ORIGIN ONE`);
  console.log(`===============================================================\n`);

  console.log('1. Probando el servicio de agendamiento y notificaciones a WhatsApp...');
  const appointmentResult = await scheduleAppointment({
    nombre_cliente: 'Artemio Test',
    email: 'artemio@originone.com.mx',
    telefono_whatsapp: '+52 81 1234 5678',
    empresa_o_proyecto: 'Origin One Demo Project',
    fecha_propuesta: '2026-07-28',
    hora_propuesta: '11:00 AM',
    resumen_necesidad: 'Prueba del sistema de agendamiento automático con notificación a 8110653947 y 8120989813',
    canal_origen: 'Prueba Automática de Sistema'
  });

  console.log('Resultado del agendamiento:', JSON.stringify(appointmentResult, null, 2));

  console.log('\n2. Verificando lecturas de base de datos local...');
  const citas = await getAppointments();
  console.log(`Total de citas guardadas en data/appointments.json: ${citas.length}`);

  console.log('\n✅ Prueba terminada con éxito.');
}

runAutoTest();
