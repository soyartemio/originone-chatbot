const { GoogleGenerativeAI } = require('@google/generative-ai');
const { ORIGIN_ONE_KNOWLEDGE_BASE } = require('./knowledgeBase');
const { scheduleAppointment } = require('./agendaService');

// Almacenamiento en memoria de las sesiones de chat por usuario
const chatSessions = new Map();

// Definición del Schema del Tool (Function Calling) para agendar la Cita de Diagnóstico de 30 minutos
const scheduleTool = {
  functionDeclarations: [
    {
      name: 'agendarCitaDiagnostico',
      description: 'Registra una cita de diagnóstico inicial de 30 minutos sin costo con el equipo senior de Origin One y notifica los detalles inmediatamente por WhatsApp a los ejecutivos.',
      parameters: {
        type: 'OBJECT',
        properties: {
          nombre_cliente: {
            type: 'STRING',
            description: 'Nombre completo del cliente o prospecto'
          },
          email: {
            type: 'STRING',
            description: 'Correo electrónico de contacto'
          },
          telefono_whatsapp: {
            type: 'STRING',
            description: 'Número de WhatsApp o teléfono celular del cliente'
          },
          empresa_o_proyecto: {
            type: 'STRING',
            description: 'Nombre de la empresa, startup o proyecto del cliente'
          },
          fecha_propuesta: {
            type: 'STRING',
            description: 'Fecha acordada o preferida para la llamada (ej. "2026-07-25", "Este Viernes")'
          },
          hora_propuesta: {
            type: 'STRING',
            description: 'Hora acordada o preferida (ej. "10:00 AM", "16:00 hrs")'
          },
          resumen_necesidad: {
            type: 'STRING',
            description: 'Breve resumen de la necesidad, proceso a automatizar o proyecto que desea tratar en la reunión'
          }
        },
        required: ['nombre_cliente', 'email', 'telefono_whatsapp', 'fecha_propuesta', 'hora_propuesta']
      }
    }
  ]
};

/**
 * Obtener o crear una sesión de chat activa para un usuario especifico
 */
function getOrCreateChatSession(userId, apiKey, channel = 'Chatbot Conversacional') {
  if (chatSessions.has(userId)) {
    return chatSessions.get(userId);
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  
  // Lista de modelos activos comprobados
  const candidateModels = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash'];



  let model;

  for (const modelName of candidateModels) {
    try {
      model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: `Eres S1GNAL, el Agente Conversacional y Motor de IA Oficial de Origin One ("Intelligence that transforms").
Al saludar o presentarte por primera vez o ante un saludo (como "Hola"), preséntate explícitamente como S1GNAL (ej. "¡Hola! Soy S1GNAL, el agente conversacional de Origin One. ¿En qué proceso de tu empresa te gustaría aplicar IA hoy?").
Tu misión es atender a clientes e interesados a través de Facebook, Instagram, WhatsApp y Web con un tono senior, profesional, perspicaz, empático y directo.

A continuación se presenta toda la base de conocimiento oficial de la empresa:
${ORIGIN_ONE_KNOWLEDGE_BASE}

REGLAS DE CONDUCTA:
1. Responde de forma clara, concisa y atractiva sin inventar información fuera de la base de conocimiento.
2. Si el usuario pregunta por servicios, casos de éxito, Origin Studio o la metodología, explícalo brevemente con entusiasmo profesional.
3. TU OBJETIVO PRINCIPAL: Invitar al usuario a agendar una sesión de Diagnóstico Inicial de 30 minutos sin costo con el equipo senior.
4. Cuando el usuario muestre interés en agendar o tratar su proyecto en llamada, solicita amable y fluidamente los siguientes datos requeridos:
   - Nombre completo
   - Email
   - WhatsApp / Celular
   - Nombre de su empresa o proyecto
   - Día y hora preferida para la sesión
5. Tan pronto como tengas los datos necesarios, DEBES invocar la herramienta 'agendarCitaDiagnostico' enviando los parámetros recolectados.
6. Una vez ejecutada la herramienta, confirma educadamente al usuario que la cita ha sido agendada y que recibirá la confirmación directa del equipo.`,
        tools: [scheduleTool]
      });
      break;
    } catch (e) {
      console.warn(`[GeminiEngine] Error cargando modelo ${modelName}, intentando siguiente...`);
    }
  }


  const chatSession = model.startChat({
    history: []
  });

  chatSessions.set(userId, {
    session: chatSession,
    channel: channel,
    lastActive: Date.now()
  });

  return chatSessions.get(userId);
}

/**
 * Procesar un mensaje entrante de un usuario con Gemini
 */
async function processUserMessage(userId, messageText, channel = 'Chatbot Conversacional') {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return "💡 El sistema de IA Gemini está listo pero requiere configurar la clave `GEMINI_API_KEY` en el archivo `.env`. Para soporte o agendar directamente, puedes escribir a info@originone.com.mx.";
  }

  try {
    let userSessionObj = getOrCreateChatSession(userId, apiKey, channel);
    let chat = userSessionObj.session;

    console.log(`[GeminiEngine] 📩 Procesando mensaje de usuario (${userId} via ${channel}): "${messageText}"`);

    let result;
    try {
      result = await chat.sendMessage(messageText);
    } catch (sendErr) {
      console.warn(`[GeminiEngine] Error en modelo inicial (${sendErr.message}), reintentando con sesión limpia...`);
      chatSessions.delete(userId); // Limpiar sesión con modelo fallido
      userSessionObj = getOrCreateChatSession(userId, apiKey, channel);
      chat = userSessionObj.session;
      result = await chat.sendMessage(messageText);
    }

    let response = result.response;


    // Verificar si Gemini quiere invocar una Función / Tool (ej. agendarCitaDiagnostico)
    const functionCalls = response.functionCalls();
    
    if (functionCalls && functionCalls.length > 0) {
      for (const call of functionCalls) {
        if (call.name === 'agendarCitaDiagnostico') {
          console.log('[GeminiEngine] 🛠️ Gemini detectó intención de cita e invocó agendarCitaDiagnostico con argumentos:', call.args);
          
          const args = call.args;
          args.canal_origen = channel;

          // Ejecutar el servicio de agendamiento y envío de notificaciones por WhatsApp
          const agendaResult = await scheduleAppointment(args);

          // Retornar la respuesta de la función a Gemini para que continúe la conversación
          const functionResponseResult = await chat.sendMessage([
            {
              functionResponse: {
                name: 'agendarCitaDiagnostico',
                response: {
                  exito: agendaResult.success,
                  idCita: agendaResult.appointmentId,
                  mensaje: 'La cita ha sido registrada exitosamente en la base de datos y los ejecutivos de Origin One han sido notificados inmediatamente por WhatsApp.'
                }
              }
            }
          ]);

          return functionResponseResult.response.text();
        }
      }
    }

    return response.text();
  } catch (error) {
    console.error(`[GeminiEngine] ❌ Error al procesar mensaje con Gemini:`, error);
    return "Disculpa, tuve un inconveniente temporal procesando tu mensaje. Si deseas agendar directamente tu diagnóstico de 30 minutos, puedes dejarnos tu correo y número de teléfono por aquí o escribirnos a info@originone.com.mx.";
  }
}

module.exports = {
  processUserMessage
};
