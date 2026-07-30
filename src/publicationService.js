const crypto = require('crypto');
const { readPublicationsSnapshot, writePublicationsSnapshot } = require('./publicationStorage');

const VALID_STATUSES = new Set(['idea', 'borrador', 'revision', 'aprobada', 'programada', 'publicada', 'cambios']);
const APPROVERS = ['artemio', 'edgar'];

function normalizeVoiceName(value) {
  const name = String(value || '').split('-').at(-1);
  return name || 'Charon';
}

const DEFAULT_SCHEDULE = {
  instagram: { weekday: 4, hour: 18, minute: 30, label: 'Jueves · 6:30 p.m.' },
  facebook: { weekday: 4, hour: 9, minute: 0, label: 'Jueves · 9:00 a.m.' },
  linkedin: { weekday: 3, hour: 16, minute: 0, label: 'Miércoles · 4:00 p.m.' }
};

function recommendedSchedule(existing = {}, campaignOrder = 0) {
  return Object.fromEntries(Object.entries(DEFAULT_SCHEDULE).map(([platform, window]) => [
    platform,
    {
      localDateTime: String(existing?.[platform]?.localDateTime || ''),
      timezone: 'America/Monterrey',
      recommendation: window.label,
      basis: 'benchmark_2026_hypothesis',
      campaignOrder: Number.isInteger(campaignOrder) ? campaignOrder : 0
    }
  ]));
}

const DEFAULT_PUBLICATIONS = [
  {
    id: 'pub-signal-voz-a-voz',
    campaignOrder: 0,
    title: 'El chatbot que no te obliga a jugar “presiona 1”',
    industry: 'Servicios y ventas B2B',
    ownerPain: 'El dueño pierde prospectos porque los formularios y menús se sienten impersonales.',
    situation: 'Un prospecto quiere explicar su problema en 30 segundos. El bot tradicional le contesta con seis botones y una crisis existencial.',
    humor: '“Para hablar como humano, presiona 9… y espera sentado.”',
    solution: 'S1GNAL conversa de voz a voz desde la web, entiende contexto y convierte la conversación en seguimiento comercial.',
    evidence: 'Demo S1GNAL disponible en originone.com.mx.',
    visualBrief: 'Dueño hablando con naturalidad frente a una onda de voz dorada; al lado, un laberinto absurdo de menús “presiona 1”. Estilo editorial premium, fondo oscuro Origin One.',
    assetProvider: 'pomelli',
    assetStatus: 'en_revision_visual',
    assetUrl: 'https://labs.google.com/pomelli/campaigns/biYih_QX4BqcCvLQSi_OwI',
    creativeUrl: '/crm/assets/pub-signal-voz-a-voz-candidate-vertical.png',
    creativeAlt: 'Dueño de negocio frente a un laberinto de botones, conectado por una onda de voz ámbar a una conversación clara.',
    visualHeadline: 'Tu cliente no quiere “presionar 1”.',
    visualCaption: 'Quiere explicar qué necesita.',
    story: 'José dirige una empresa de servicios. Cada semana alguien llega a su sitio con un problema concreto, se topa con un formulario y desaparece. Su página todavía no le da una forma natural de explicarlo. No es falta de interés: es fricción.',
    narrative: {
      fictional: true,
      character: 'José',
      role: 'dueño de una empresa de servicios',
      premise: 'Los prospectos llegan con una duda concreta, ven un formulario o un menú y abandonan antes de hablar con alguien.'
    },
    voiceoverScript: 'Tu cliente no quiere jugar a presiona uno. Quiere explicar lo que necesita. S1GNAL convierte tu página en una conversación de voz a voz, entiende el contexto y prepara el seguimiento. ¿Hablarías con tu propia página?',
    copies: {
      instagram: 'José dirige una empresa de servicios. Sus prospectos llegan con una duda concreta, ven un formulario y desaparecen. Su página todavía no les da una forma natural de explicar lo que necesitan. No es falta de interés; es fricción. Con S1GNAL, Origin One puede convertir tu web en una conversación de voz a voz que entiende el contexto y prepara el seguimiento. ¿Tu página escucha o sólo pregunta?\n\nSituación hipotética basada en patrones operativos comunes.\n\n#VentasB2B #ExperienciaDelCliente #IAParaNegocios #S1GNAL',
      facebook: 'José, dueño de una empresa de servicios, veía el mismo patrón: alguien quería explicar su problema, encontraba un formulario y se iba. No era desinterés: su página todavía no tenía una forma natural de escuchar. S1GNAL permite que la persona hable con tu sitio de voz a voz; Origin One puede diseñar ese seguimiento con contexto.\n\nSituación hipotética basada en patrones operativos comunes.\n\n#VentasB2B #ExperienciaDelCliente',
      linkedin: 'José dirige una empresa de servicios B2B. Sus prospectos no llegan con una respuesta de opción múltiple: llegan con un problema. Sin embargo, su página sólo les pedía un formulario. La fricción ocurre antes de la primera llamada. S1GNAL permite una conversación de voz a voz desde la web, captura contexto y prepara el seguimiento comercial. Origin One puede implementarlo alrededor de la operación real del negocio.\n\nSituación hipotética basada en patrones operativos comunes.\n\n#VentasB2B #ExperienciaDelCliente #IAAplicada'
    },
    platforms: ['instagram', 'facebook', 'linkedin'],
    status: 'revision'
  },
  {
    id: 'pub-seguros-reporte',
    campaignOrder: 1,
    title: 'El cierre mensual no debería ser una búsqueda del tesoro',
    industry: 'Seguros',
    ownerPain: 'Información dispersa entre hojas, correos y mensajes retrasa decisiones y reportes.',
    situation: 'Es fin de mes. El reporte depende de tres Excels, dos WhatsApps y de la persona que “sí sabe dónde quedó el dato”.',
    humor: 'El KPI más importante termina siendo: “¿quién tiene la versión final_final_ahora_sí.xlsx?”',
    solution: 'Origin One integra fuentes, automatiza reportes y muestra indicadores en un tablero operativo hecho a la medida.',
    evidence: 'Proyecto de dashboard para seguros presentado en originone.com.mx.',
    visualBrief: 'Dueño de aseguradora detective, siguiendo pistas entre archivos Excel y chats; al fondo un dashboard limpio resuelve el caso. Humor elegante, paleta negra y dorada.',
    assetProvider: 'origin-one-imagegen',
    assetStatus: 'en_revision_visual',
    creativeUrl: '/crm/assets/pub-seguros-reporte-candidate-vertical.png',
    creativeAlt: 'Dueño de aseguradora rodeado de reportes dispersos, conectado a un tablero ámbar.',
    visualHeadline: 'El “archivo bueno” no debería ser un misterio.',
    visualCaption: 'Cerrar el mes no debería ser una búsqueda.',
    story: 'Luis dirige una agencia de seguros. Al cierre, una persona tiene las pólizas, otra los cobros y alguien guarda “el Excel bueno”. El equipo trabaja; el problema es que la información vive repartida.',
    narrative: {
      fictional: true,
      character: 'Luis',
      role: 'director de una agencia de seguros',
      premise: 'Cada cierre mensual depende de reunir versiones de hojas, mensajes y reportes que viven en lugares distintos.'
    },
    voiceoverScript: 'Si tu cierre mensual depende de tres Excels, dos chats y de la persona que sabe dónde quedó el dato, no tienes un reporte: tienes una búsqueda del tesoro. Origin One integra la información y la convierte en un tablero claro y automático.',
    copies: {
      instagram: 'Luis llega al cierre mensual con tres Excels, dos grupos de WhatsApp y la pregunta que nadie quiere escuchar: “¿cuál es la versión buena?”. Su equipo trabaja; el problema es que la información vive separada. Origin One puede integrar fuentes y diseñar un tablero operativo para que el cierre deje de ser una búsqueda del tesoro.\n\nSituación hipotética basada en patrones operativos comunes.\n\n#Seguros #CierreMensual #Automatización #DatosParaDecidir',
      facebook: 'Luis dirige una agencia de seguros. Al cierre, una persona tiene las pólizas, otra los cobros y alguien guarda “el Excel bueno”. El KPI termina siendo encontrar la versión final_final_ahora_sí.xlsx. Origin One puede conectar esas fuentes y convertirlas en una lectura operativa clara para dirección.\n\nSituación hipotética basada en patrones operativos comunes.\n\n#Seguros #CierreMensual',
      linkedin: 'Luis dirige una agencia de seguros y cada cierre depende de consolidar hojas, chats y reportes manualmente. El costo no es sólo tiempo: la dirección recibe una lectura tardía del negocio. Origin One puede integrar fuentes y construir un tablero hecho alrededor de los indicadores que sí usa el equipo. Menos cacería de archivos; más capacidad para decidir.\n\nSituación hipotética basada en patrones operativos comunes.\n\n#Seguros #Automatización #DatosParaDecidir'
    },
    platforms: ['instagram', 'facebook', 'linkedin'],
    status: 'revision'
  },
  {
    id: 'pub-dental-sistema',
    campaignOrder: 2,
    title: 'Tu clínica creció; tu sistema sigue pidiendo favores',
    industry: 'Clínicas dentales',
    ownerPain: 'Agenda, expedientes, cobros e inventario viven en herramientas separadas.',
    situation: 'La recepción conoce la agenda, el doctor conoce el tratamiento y una libreta misteriosa conoce los pagos.',
    humor: 'El verdadero ERP es preguntarle a tres personas y esperar que coincidan.',
    solution: 'Un sistema a la medida conecta operación clínica, administración y seguimiento sin obligar al negocio a adaptarse a software genérico.',
    evidence: 'Proyecto ERP dental mostrado en originone.com.mx.',
    visualBrief: 'Consultorio moderno con tres islas desconectadas: agenda, expediente y pagos; una línea dorada Origin One las integra en una sola interfaz.',
    assetProvider: 'origin-one-imagegen',
    assetStatus: 'en_revision_visual',
    creativeUrl: '/crm/assets/pub-dental-sistema-candidate-vertical.png',
    creativeAlt: 'Equipo de clínica dental conectado por una línea ámbar en una sola operación.',
    visualHeadline: 'Tu clínica no debería operar a base de favores.',
    visualCaption: 'Agenda, expediente y cobro: una sola operación.',
    story: 'Mariana dirige una clínica dental en crecimiento. Recepción conoce la agenda, el doctor conoce el tratamiento y una libreta misteriosa conoce los pagos. Para entender un caso, su equipo tiene que preguntarle a tres personas.',
    narrative: {
      fictional: true,
      character: 'Mariana',
      role: 'directora de una clínica dental en crecimiento',
      premise: 'La agenda, los tratamientos y los cobros están en manos y herramientas distintas, por lo que el equipo necesita preguntar para reconstruir la operación.'
    },
    voiceoverScript: 'La recepción conoce la agenda, el doctor conoce el tratamiento y una libreta misteriosa conoce los pagos. Cuando tu clínica crece, preguntar a tres personas deja de ser un sistema. Origin One conecta la operación en un ERP hecho a la medida.',
    copies: {
      instagram: 'La clínica de Mariana creció. También crecieron los favores: recepción sabe la agenda, el doctor el tratamiento y una libreta misteriosa los pagos. Para entender un caso hay que preguntarle a tres personas. Origin One puede diseñar un sistema a la medida que conecte operación clínica, administración y seguimiento sin obligar al equipo a trabajar como software genérico.\n\nSituación hipotética basada en patrones operativos comunes.\n\n#ClínicasDentales #GestiónClínica #Automatización #ERP',
      facebook: 'Mariana dirige una clínica dental en crecimiento. Para saber qué pasó con un paciente, recepción revisa la agenda, el doctor busca el tratamiento y administración persigue un pago. El verdadero ERP es esperar que las tres versiones coincidan. Origin One puede conectar la operación en una solución hecha para la forma real de trabajar de la clínica.\n\nSituación hipotética basada en patrones operativos comunes.\n\n#ClínicasDentales #GestiónClínica',
      linkedin: 'Mariana dirige una clínica dental que ya superó sus herramientas aisladas. La agenda está en un lugar, el expediente en otro y los cobros dependen de una libreta o conversación. El crecimiento vuelve visibles esas costuras operativas. Origin One puede construir un sistema a la medida que conecte la información y dé trazabilidad a dirección, sin forzar a la clínica a adoptar procesos ajenos.\n\nSituación hipotética basada en patrones operativos comunes.\n\n#ClínicasDentales #Automatización #ERP'
    },
    platforms: ['instagram', 'facebook', 'linkedin'],
    status: 'revision'
  },
];

function withMissingDefaults(publications) {
  const knownIds = new Set(publications.map(item => item.id));
  return [
    ...publications,
    ...DEFAULT_PUBLICATIONS
      .filter(item => !knownIds.has(item.id))
      .map(item => normalizePublication(item))
  ];
}

function normalizePublication(input, existing = {}) {
  const now = new Date().toISOString();
  const status = VALID_STATUSES.has(input.status) ? input.status : (existing.status || 'borrador');
  return {
    ...existing,
    id: existing.id || input.id || `pub-${crypto.randomUUID()}`,
    contentType: String(input.contentType ?? existing.contentType ?? 'social').slice(0, 40),
    campaignOrder: Math.max(0, Math.floor(Number(input.campaignOrder ?? existing.campaignOrder ?? 0) || 0)),
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
    creativeUrl: String(input.creativeUrl ?? existing.creativeUrl ?? '').trim().slice(0, 1000),
    creativeAlt: String(input.creativeAlt ?? existing.creativeAlt ?? input.title ?? existing.title ?? 'Visual de la publicación').trim().slice(0, 500),
    visualHeadline: String(input.visualHeadline ?? existing.visualHeadline ?? input.title ?? existing.title ?? '').trim().slice(0, 180),
    visualCaption: String(input.visualCaption ?? existing.visualCaption ?? input.situation ?? existing.situation ?? '').trim().slice(0, 180),
    story: String(input.story ?? existing.story ?? input.situation ?? existing.situation ?? '').trim().slice(0, 900),
    narrative: {
      fictional: input.narrative?.fictional ?? existing.narrative?.fictional ?? false,
      character: String(input.narrative?.character ?? existing.narrative?.character ?? '').trim().slice(0, 100),
      role: String(input.narrative?.role ?? existing.narrative?.role ?? '').trim().slice(0, 180),
      premise: String(input.narrative?.premise ?? existing.narrative?.premise ?? '').trim().slice(0, 800)
    },
    voiceoverScript: String(input.voiceoverScript ?? existing.voiceoverScript ?? '').trim().slice(0, 5000),
    voiceConfig: {
      languageCode: String(input.voiceConfig?.languageCode ?? existing.voiceConfig?.languageCode ?? 'es').slice(0, 20),
      name: normalizeVoiceName(input.voiceConfig?.name ?? existing.voiceConfig?.name).slice(0, 100),
      primaryVoice: normalizeVoiceName(input.voiceConfig?.primaryVoice ?? existing.voiceConfig?.primaryVoice ?? input.voiceConfig?.name ?? existing.voiceConfig?.name).slice(0, 100),
      secondaryVoice: normalizeVoiceName(input.voiceConfig?.secondaryVoice ?? existing.voiceConfig?.secondaryVoice ?? 'Kore').slice(0, 100),
      style: String(input.voiceConfig?.style ?? existing.voiceConfig?.style ?? '').trim().slice(0, 800),
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
    schedule: recommendedSchedule(input.schedule ?? existing.schedule, input.campaignOrder ?? existing.campaignOrder ?? 0),
    cta: {
      type: String(input.cta?.type ?? existing.cta?.type ?? 'website').slice(0, 40),
      url: String(input.cta?.url ?? existing.cta?.url ?? 'https://originone.com.mx/').trim().slice(0, 1000)
    },
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
    const publications = snapshot.exists
      ? withMissingDefaults(snapshot.publications)
      : DEFAULT_PUBLICATIONS.map(item => normalizePublication(item));
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
  return snapshot.exists
    ? withMissingDefaults(snapshot.publications).map(item => normalizePublication(item, item))
    : DEFAULT_PUBLICATIONS.map(item => normalizePublication(item));
}

async function createPublication(input, username) {
  if (!String(input.title || '').trim()) throw new Error('El título es obligatorio');
  if (!String(input.creativeUrl || '').trim()) throw new Error('La propuesta requiere una imagen generada antes de guardarse');
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
    if (!String(changes.creativeUrl ?? items[index].creativeUrl ?? '').trim()) {
      throw new Error('La propuesta requiere una imagen generada antes de guardarse');
    }
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
    if (decision === 'approved' && !String(publication.creativeUrl || '').trim()) {
      throw new Error('No se puede aprobar sin una imagen generada');
    }
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
