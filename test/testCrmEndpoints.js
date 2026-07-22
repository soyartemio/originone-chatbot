const { getAppointments, updateLead, addLeadNote } = require('../src/agendaService');

async function testCrm() {
  console.log('Probando servicios CRM...');
  const appointments = await getAppointments();
  console.log(`Leads encontrados: ${appointments.length}`);

  if (appointments.length > 0) {
    const firstId = appointments[0].id;
    console.log(`Actualizando etapa de lead ${firstId}...`);
    const updated = await updateLead(firstId, { etapa: 'Diagnóstico Realizado' });
    console.log('Lead actualizado:', updated.etapa);

    console.log(`Agregando nota interna a ${firstId}...`);
    const withNote = await addLeadNote(firstId, 'Excelente reunión inicial. Acordamos enviar propuesta técnica este Viernes.', 'Artemio Gonzalez');
    console.log('Notas del lead:', withNote.notas_internas);
  }
}

testCrm();
