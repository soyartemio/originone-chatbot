const crypto = require('crypto');
const { readPublicationsSnapshot, writePublicationsSnapshot } = require('./publicationStorage');

const VALID_STATUSES = new Set(['idea', 'borrador', 'revision', 'aprobada', 'programada', 'publicada', 'cambios']);
const APPROVERS = ['artemio', 'edgar'];

function normalizeVoiceName(value) {
  const name = String(value || '');
  return name.includes('Neural2') ? 'es-US-Chirp3-HD-Charon' : (name || 'es-US-Chirp3-HD-Charon');
}

const DEFAULT_PUBLICATIONS = [
  {
    id: 'pub-signal-voz-a-voz',
    title: 'El chatbot que no te obliga a jugar “presiona 1”',
    industry: 'Servicios y ventas B2B',
    ownerPain: 'El dueño pierde prospectos porque los formularios y menús se sienten impersonales.',
    situation: 'Un prospecto quiere explicar su problema en 30 segundos. El bot tradicional le contesta con seis botones y una crisis existencial.',
    humor: '“Para hablar como humano, presiona 9… y espera sentado.”',
    solution: 'S1GNAL conversa de voz a voz desde la web, entiende contexto y convierte la conversación en seguimiento comercial.',
    evidence: 'Demo S1GNAL disponible en originone.com.mx.',
    visualBrief: 'Dueño hablando con naturalidad frente a una onda de voz dorada; al lado, un laberinto absurdo de menús “presiona 1”. Estilo editorial premium, fondo oscuro Origin One.',
    assetProvider: 'pomelli',
    assetStatus: 'listo',
    assetUrl: 'https://labs.google.com/pomelli/campaigns/biYih_QX4BqcCvLQSi_OwI',
    voiceoverScript: 'Tu cliente no quiere jugar a presiona uno. Quiere explicar lo que necesita. S1GNAL convierte tu página en una conversación de voz a voz, entiende el contexto y prepara el seguimiento. ¿Hablarías con tu propia página?',
    copies: {
      instagram: 'Tu cliente no quiere llenar otro formulario. Quiere explicar lo que necesita. S1GNAL conversa de voz a voz, entiende el contexto y convierte esa conversación en una oportunidad real. ¿Hablarías con tu propia página?',
      facebook: 'Hay chatbots que contestan. Y hay experiencias que conversan. S1GNAL permite que un prospecto hable con tu sitio de voz a voz, sin navegar un laberinto de botones. Pruébalo en Origin One.',
      linkedin: 'La fricción comercial comienza antes de la primera llamada. S1GNAL convierte la página web en una conversación de voz a voz, captura contexto y prepara el seguimiento. Menos formularios; más conversaciones útiles.'
    },
    platforms: ['instagram', 'facebook', 'linkedin'],
    status: 'revision'
  },
  {
    id: 'pub-seguros-reporte',
    title: 'El cierre mensual no debería ser una búsqueda del tesoro',
    industry: 'Seguros',
    ownerPain: 'Información dispersa entre hojas, correos y mensajes retrasa decisiones y reportes.',
    situation: 'Es fin de mes. El reporte depende de tres Excels, dos WhatsApps y de la persona que “sí sabe dónde quedó el dato”.',
    humor: 'El KPI más importante termina siendo: “¿quién tiene la versión final_final_ahora_sí.xlsx?”',
    solution: 'Origin One integra fuentes, automatiza reportes y muestra indicadores en un tablero operativo hecho a la medida.',
    evidence: 'Proyecto de dashboard para seguros presentado en originone.com.mx.',
    visualBrief: 'Dueño de aseguradora detective, siguiendo pistas entre archivos Excel y chats; al fondo un dashboard limpio resuelve el caso. Humor elegante, paleta negra y dorada.',
    voiceoverScript: 'Si tu cierre mensual depende de tres Excels, dos chats y de la persona que sabe dónde quedó el dato, no tienes un reporte: tienes una búsqueda del tesoro. Origin One integra la información y la convierte en un tablero claro y automático.',
    copies: {
      instagram: 'Si tu cierre mensual parece búsqueda del tesoro, el problema no es tu equipo: es la información dispersa. Integramos datos y automatizamos reportes para que el dueño vea el negocio, no veinte archivos.',
      facebook: 'Tres hojas, dos chats y una persona que conoce “el archivo bueno”. Así no debería cerrarse el mes. Origin One convierte información dispersa en un tablero claro y automático.',
      linkedin: 'Cuando el reporte depende de consolidación manual, la dirección decide tarde. Integramos fuentes y automatizamos indicadores para crear una sola lectura operativa del negocio.'
    },
    platforms: ['instagram', 'facebook', 'linkedin'],
    status: 'revision'
  },
  {
    id: 'pub-dental-sistema',
    title: 'Tu clínica creció; tu sistema sigue pidiendo favores',
    industry: 'Clínicas dentales',
    ownerPain: 'Agenda, expedientes, cobros e inventario viven en herramientas separadas.',
    situation: 'La recepción conoce la agenda, el doctor conoce el tratamiento y una libreta misteriosa conoce los pagos.',
    humor: 'El verdadero ERP es preguntarle a tres personas y esperar que coincidan.',
    solution: 'Un sistema a la medida conecta operación clínica, administración y seguimiento sin obligar al negocio a adaptarse a software genérico.',
    evidence: 'Proyecto ERP dental mostrado en originone.com.mx.',
    visualBrief: 'Consultorio moderno con tres islas desconectadas: agenda, expediente y pagos; una línea dorada Origin One las integra en una sola interfaz.',
    voiceoverScript: 'La recepción conoce la agenda, el doctor conoce el tratamiento y una libreta misteriosa conoce los pagos. Cuando tu clínica crece, preguntar a tres personas deja de ser un sistema. Origin One conecta la operación en un ERP hecho a la medida.',
    copies: {
      instagram: 'Si para saber qué pasa en tu clínica necesitas preguntarle a tres personas, tu operación ya superó a tus herramientas. Un ERP a la medida conecta agenda, expedientes, cobros y seguimiento.',
      facebook: 'Tu clínica no debería adaptarse a cinco sistemas distintos. Diseñamos una operación conectada alrededor de la manera real en que trabaja tu equipo.',
      linkedin: 'El crecimiento vuelve visibles las costuras entre agenda, expediente y administración. Un sistema a la medida elimina dobles capturas y crea trazabilidad para la dirección.'
    },
    platforms: ['instagram', 'facebook', 'linkedin'],
    status: 'revision'
  }
];

function normalizePublication(input, existing = {}) {
  const now = new Date().toISOString();
  const status = VALID_STATUSES.has(input.status) ? input.status : (existing.status || 'borrador');
  return {
    ...existing,
    id: existing.id || input.id || `pub-${crypto.randomUUID()}`,
    title: String(input.title ?? existing.title ?? '').trim().slice(0, 300),
    industry: String(input.industry ?? existing.industry ?? 'Negocios').trim().slice(0, 120),
    ownerPain: String(input.ownerPain ?? existing.ownerPain ?? '').trim().slice(0, 1200),
    situation: String(input.situation ?? existing.situation ?? '').trim().slice(0, 2000),
    humor: String(input.humor ?? existing.humor ?? '').trim().slice(0, 1000),
    solution: String(input.solution ?? existing.solution ?? '').trim().slice(0, 2000),
    evidence: String(input.evidence ?? existing.evidence ?? '').trim().slice(0, 1000),
    visualBrief: String(input.visualBrief ?? existing.visualBrief ?? '').trim().slice(0, 3000),
    assetProvider: String(input.assetProvider ?? existing.assetProvider ?? 'pomelli').trim().slice(0, 80),
    assetStatus: String(input.assetStatus ?? existing.assetStatus ?? 'pendiente').trim().slice(0, 80),
    assetUrl: String(input.assetUrl ?? existing.assetUrl ?? '').trim().slice(0, 1000),
    voiceoverScript: String(input.voiceoverScript ?? existing.voiceoverScript ?? '').trim().slice(0, 5000),
    voiceConfig: {
      languageCode: String(input.voiceConfig?.languageCode ?? existing.voiceConfig?.languageCode ?? 'es-US').slice(0, 20),
      name: normalizeVoiceName(input.voiceConfig?.name ?? existing.voiceConfig?.name).slice(0, 100),
      speakingRate: Number(input.voiceConfig?.speakingRate ?? existing.voiceConfig?.speakingRate ?? 1.03)
    },
    voiceUsage: Array.isArray(input.voiceUsage)
      ? input.voiceUsage.slice(-500)
      : (Array.isArray(existing.voiceUsage) ? existing.voiceUsage : []),
    copies: {
      instagram: String(input.copies?.instagram ?? existing.copies?.instagram ?? '').trim().slice(0, 5000),
      facebook: String(input.copies?.facebook ?? existing.copies?.facebook ?? '').trim().slice(0, 5000),
      linkedin: String(input.copies?.linkedin ?? existing.copies?.linkedin ?? '').trim().slice(0, 5000)
    },
    platforms: Array.from(new Set((input.platforms ?? existing.platforms ?? []).filter(value => ['instagram', 'facebook', 'linkedin'].includes(value)))),
    scheduledFor: input.scheduledFor ?? existing.scheduledFor ?? null,
    publishedUrls: input.publishedUrls ?? existing.publishedUrls ?? {},
    status,
    approvals: existing.approvals || {},
    notes: existing.notes || [],
    createdBy: existing.createdBy || input.createdBy || 'origin-one-marketing',
    createdAt: existing.createdAt || now,
    updatedAt: now
  };
}

async function mutate(mutator) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const snapshot = await readPublicationsSnapshot();
    const publications = snapshot.exists ? snapshot.publications : DEFAULT_PUBLICATIONS.map(item => normalizePublication(item));
    const result = mutator(publications);
    try {
      await writePublicationsSnapshot(publications, snapshot.etag, snapshot.backend);
      return result;
    } catch (error) {
      if (error.name !== 'PreconditionFailed' || attempt === 3) throw error;
    }
  }
}

async function getPublications() {
  const snapshot = await readPublicationsSnapshot();
  return snapshot.exists ? snapshot.publications : DEFAULT_PUBLICATIONS.map(item => normalizePublication(item));
}

async function createPublication(input, username) {
  if (!String(input.title || '').trim()) throw new Error('El título es obligatorio');
  return mutate(items => {
    const publication = normalizePublication({ ...input, createdBy: username });
    items.unshift(publication);
    return publication;
  });
}

async function updatePublication(id, changes) {
  return mutate(items => {
    const index = items.findIndex(item => item.id === id);
    if (index < 0) return null;
    items[index] = normalizePublication(changes, items[index]);
    return items[index];
  });
}

async function addPublicationNote(id, text, username, displayName) {
  if (!String(text || '').trim()) throw new Error('La nota no puede estar vacía');
  return mutate(items => {
    const publication = items.find(item => item.id === id);
    if (!publication) return null;
    publication.notes.unshift({
      id: crypto.randomUUID(),
      text: String(text).trim().slice(0, 3000),
      username,
      author: displayName,
      createdAt: new Date().toISOString()
    });
    publication.updatedAt = new Date().toISOString();
    return publication;
  });
}

async function setPublicationApproval(id, decision, username, displayName, note) {
  if (!APPROVERS.includes(username)) throw new Error('Sólo Artemio y Edgar pueden aprobar');
  if (!['approved', 'changes_requested'].includes(decision)) throw new Error('Decisión no válida');
  return mutate(items => {
    const publication = items.find(item => item.id === id);
    if (!publication) return null;
    publication.approvals[username] = { decision, displayName, decidedAt: new Date().toISOString() };
    if (note) publication.notes.unshift({
      id: crypto.randomUUID(), text: String(note).trim().slice(0, 3000), username,
      author: displayName, createdAt: new Date().toISOString()
    });
    const decisions = APPROVERS.map(approver => publication.approvals[approver]?.decision);
    publication.status = decisions.every(value => value === 'approved')
      ? 'aprobada'
      : decisions.includes('changes_requested') ? 'cambios' : 'revision';
    publication.updatedAt = new Date().toISOString();
    return publication;
  });
}

module.exports = {
  addPublicationNote,
  createPublication,
  getPublications,
  setPublicationApproval,
  updatePublication
};
