const ORIGIN_ONE_SOLUTION_CATALOG = [
  {
    area: 'Dirección y gestión',
    problems: [
      'La información para decidir está repartida entre correos, hojas y sistemas.',
      'Las juntas generan acuerdos que después nadie sigue de forma consistente.',
      'La dirección recibe reportes tarde o necesita pedirlos manualmente.'
    ],
    patterns: [
      'Brief ejecutivo periódico con indicadores, excepciones y pendientes.',
      'Asistente para consultar información autorizada en lenguaje natural.',
      'Registro y seguimiento de acuerdos, responsables y fechas.',
      'Tableros y alertas diseñados alrededor de decisiones concretas.'
    ]
  },
  {
    area: 'Ventas y desarrollo de negocio',
    problems: [
      'Los leads tardan en recibir respuesta o se pierden entre canales.',
      'El CRM está incompleto y el seguimiento depende de memoria individual.',
      'Cotizaciones, propuestas y recapitulaciones consumen demasiado tiempo.'
    ],
    patterns: [
      'Captura y calificación inicial de leads con criterios definidos.',
      'Seguimientos y recordatorios conectados al CRM, con aprobación cuando corresponda.',
      'Borradores de propuestas, correos y resúmenes basados en información aprobada.',
      'Análisis de motivos de pérdida y señales de oportunidad.'
    ]
  },
  {
    area: 'Atención y experiencia del cliente',
    problems: [
      'Las mismas preguntas se contestan repetidamente por distintos canales.',
      'Los casos no llegan al responsable correcto o no existe trazabilidad.',
      'El cliente debe esperar para conocer el estado de una solicitud.'
    ],
    patterns: [
      'Atención omnicanal basada en una fuente de conocimiento aprobada.',
      'Clasificación, prioridad y enrutamiento de casos con traspaso a una persona.',
      'Consulta de estatus, citas, pedidos o solicitudes según permisos.',
      'Resúmenes de conversación y registro automático de interacciones.'
    ]
  },
  {
    area: 'Operaciones y cadena de suministro',
    problems: [
      'El equipo captura la misma información varias veces.',
      'Órdenes, solicitudes o documentos se procesan manualmente.',
      'Las excepciones se descubren tarde y el seguimiento vive en hojas.'
    ],
    patterns: [
      'Lectura, clasificación y extracción de datos de documentos.',
      'Flujos de órdenes, solicitudes y aprobaciones con reglas y trazabilidad.',
      'Alertas de excepciones, faltantes, vencimientos o bloqueos.',
      'Programación y seguimiento operativo conectados a sistemas existentes.'
    ]
  },
  {
    area: 'Finanzas y administración',
    problems: [
      'Facturas, conciliaciones, cobranza y reportes requieren trabajo repetitivo.',
      'La información financiera llega tarde o con formatos inconsistentes.',
      'Las aprobaciones no tienen suficiente evidencia o trazabilidad.'
    ],
    patterns: [
      'Captura y validación preliminar de facturas y comprobantes.',
      'Apoyo a conciliaciones y detección de diferencias para revisión humana.',
      'Recordatorios de cobranza y preparación de reportes periódicos.',
      'Flujos de aprobación con permisos, evidencia y bitácora.'
    ]
  },
  {
    area: 'Talento, capacitación y conocimiento',
    problems: [
      'El conocimiento crítico está disperso o depende de pocas personas.',
      'Onboarding, políticas y capacitación consumen tiempo del equipo.',
      'Las preguntas internas se repiten y no siempre reciben la misma respuesta.'
    ],
    patterns: [
      'Asistente interno basado en manuales, políticas y documentación autorizada.',
      'Onboarding guiado y rutas de capacitación por rol.',
      'Búsqueda con fuentes y control de acceso.',
      'Creación asistida de materiales, evaluaciones y guías operativas.'
    ]
  },
  {
    area: 'Datos, reportes y control',
    problems: [
      'Los datos viven en hojas, CRM, ERP, correo y herramientas desconectadas.',
      'Preparar un reporte requiere copiar, limpiar y reconciliar información.',
      'No hay alertas claras cuando la calidad del dato se deteriora.'
    ],
    patterns: [
      'Integración de fuentes y definición de una fuente de verdad útil.',
      'Reportes programados y consultas en lenguaje natural con permisos.',
      'Detección de datos faltantes, duplicados o fuera de rango.',
      'Tableros por rol con indicadores accionables, no sólo visualizaciones.'
    ]
  },
  {
    area: 'Tecnología, soporte y seguridad',
    problems: [
      'Soporte recibe solicitudes repetitivas y con poco contexto.',
      'La documentación técnica está desactualizada o es difícil de consultar.',
      'Altas, bajas y accesos requieren coordinación manual.'
    ],
    patterns: [
      'Mesa de ayuda interna para clasificar, enriquecer y enrutar tickets.',
      'Asistente técnico con documentación autorizada y referencias.',
      'Flujos de altas, bajas y solicitudes de acceso sujetos a aprobación.',
      'Resumen de incidentes y apoyo documental para análisis posterior.'
    ]
  },
  {
    area: 'Marketing, contenido y comunidad',
    problems: [
      'La producción de contenido es irregular o pierde la voz de la marca.',
      'Una misma pieza no se adapta correctamente a cada canal.',
      'Las interacciones y resultados no alimentan el siguiente ciclo creativo.'
    ],
    patterns: [
      'Investigación y planeación editorial basadas en audiencia, oferta y evidencia.',
      'Producción y adaptación on-brand para redes, campañas, ventas y capacitación.',
      'Publicación programada mediante APIs oficiales y flujos de aprobación.',
      'Clasificación de comentarios, seguimiento de conversaciones y reporte semanal.',
      'Experimentación por formato, tema, gancho y llamada a la acción.'
    ]
  },
  {
    area: 'Sistemas a la medida e integración',
    problems: [
      'El software genérico obliga a la empresa a trabajar alrededor de la herramienta.',
      'Un sistema heredado es lento, costoso o difícil de modificar.',
      'La operación necesita conectar portales, ERP, CRM, mensajería y datos.'
    ],
    patterns: [
      'Módulos, portales, tableros y ERP diseñados alrededor de la operación real.',
      'Reemplazo gradual de sistemas heredados, priorizando módulos de alto impacto.',
      'Integraciones y agentes que operan bajo permisos, reglas y supervisión.',
      'Arquitectura modular con criterios explícitos de seguridad y soporte.'
    ]
  },
  {
    area: 'Origin Studio',
    problems: [
      'Cada video o material requiere iniciar una producción desde cero.',
      'La marca necesita escalar contenido sin perder identidad ni aprobación.',
      'Ventas y capacitación requieren más demostraciones y materiales.'
    ],
    patterns: [
      'Avatares y portavoces digitales sujetos a identidad y consentimiento.',
      'Video generativo para demostraciones, campañas y capacitación.',
      'Versiones por audiencia, canal o idioma dentro de una guía aprobada.',
      'Bibliotecas de plantillas y flujos de revisión para producción consistente.'
    ]
  }
];

const QUALIFICATION_QUESTIONS = [
  '¿Qué tarea o fricción se repite cada semana?',
  '¿Quién la realiza y cuánto tiempo aproximado consume?',
  '¿En qué herramientas o documentos vive hoy la información?',
  '¿Qué error, retraso, costo o falta de control provoca?',
  '¿Qué parte puede automatizarse y cuál debe seguir aprobando una persona?',
  '¿Qué resultado permitiría considerar exitoso un primer piloto?'
];

function renderSolutionCatalogForPrompt() {
  const areas = ORIGIN_ONE_SOLUTION_CATALOG.map(({ area, problems, patterns }) => [
    `### ${area}`,
    'Señales de oportunidad:',
    ...problems.map(item => `- ${item}`),
    'Patrones que Origin One puede evaluar:',
    ...patterns.map(item => `- ${item}`)
  ].join('\n')).join('\n\n');

  return [
    areas,
    '## Preguntas para calificar una oportunidad',
    ...QUALIFICATION_QUESTIONS.map(item => `- ${item}`),
    '',
    'Estos son patrones de solución, no promesas de alcance o resultado. La viabilidad depende de procesos, datos, permisos, integraciones, seguridad y adopción. Si falta información, presenta la idea como hipótesis y recomienda validarla en el diagnóstico.'
  ].join('\n');
}

module.exports = {
  ORIGIN_ONE_SOLUTION_CATALOG,
  QUALIFICATION_QUESTIONS,
  renderSolutionCatalogForPrompt
};
