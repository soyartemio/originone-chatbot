const Groq = require('groq-sdk');
const { ORIGIN_ONE_KNOWLEDGE_BASE } = require('./knowledgeBase');
const { scheduleAppointment } = require('./agendaService');

// Almacenamiento en memoria de las conversaciones por usuario
const groqChatHistories = new Map();

// Definición de la herramienta (Tool Calling / Function Calling) para Groq
const groqTools = [
  {
    type: 'function',
    function: {
      name: 'agendarCitaDiagnostico',
      description: 'Registra una cita de diagnóstico inicial de 30 minutos sin costo con el equipo senior de Origin One y notifica los detalles inmediatamente por WhatsApp a los ejecutivos.',
      parameters: {
        type: 'object',
        properties: {
          nombre_cliente: {
            type: 'string',
            description: 'Nombre completo del cliente o prospecto'
          },
          email: {
            type: 'string',
            description: 'Correo electrónico de contacto'
          },
          telefono_whatsapp: {
            type: 'string',
            description: 'Número de WhatsApp o teléfono celular del cliente'
          },
          empresa_o_proyecto: {
            type: 'string',
            description: 'Nombre de la empresa, startup o proyecto del cliente'
          },
          fecha_propuesta: {
            type: 'string',
            description: 'Fecha acordada o preferida para la llamada (ej. "2026-07-28", "Este Viernes")'
          },
          hora_propuesta: {
            type: 'string',
            description: 'Hora acordada o preferida (ej. "10:00 AM", "16:00 hrs")'
          },
          resumen_necesidad: {
            type: 'string',
            description: 'Breve resumen de la necesidad, proceso a automatizar o proyecto que desea tratar en la reunión'
          }
        },
        required: ['nombre_cliente', 'email', 'telefono_whatsapp', 'fecha_propuesta', 'hora_propuesta']
      }
    }
  }
];

/**
 * Procesar mensaje de usuario con Groq API (Llama-3.3-70b-versatile)
 */
async function processUserMessageGroq(userId, messageText, channel = 'Chatbot Conversacional') {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return "💡 Configura la clave `GROQ_API_KEY` en CONFIGURACION_CLAVES.txt para activar Groq.";
  }

  const groq = new Groq({ apiKey });

  // Obtener historial del usuario o inicializarlo
  if (!groqChatHistories.has(userId)) {
    groqChatHistories.set(userId, [
      {
        role: 'system',
        content: `Eres S1GNAL, el Agente Conversacional y Motor de IA Oficial de Origin One.
Al saludar o presentarte por primera vez ante un saludo (como "Hola"), preséntate de forma suave, empática y fresca. Ejemplo:
"¡Hola! Soy S1GNAL, el agente conversacional de Origin One. ¿Cómo te podemos ayudar hoy a dejar de ver la IA como un simple juguete y empezar a sacarle provecho real en la operación de tu empresa?"

PERSONALIDAD Y TONO:
- Sé conversacional, perspicaz, ágil y consultivo, con chispas de humor sutil y sarcasmo elegante sobre los dolores de la operación manual (como las hojas de Excel infinitas o la IA usada para tareas triviales).
- Manten respuestas vivas y concisas (2 a 4 oraciones). Cero discursos aburridos o "choro" mareador.

OBJETIVO PRINCIPAL #1:
Guiar al usuario para concretar una Cita de Diagnóstico Inicial de 30 minutos sin costo con nuestro equipo senior.

INVITACIÓN COMPLEMENTARIA A LA WEB:
Puedes invitar cordialmente al usuario a consultar más proyectos e información en https://originone.com.mx/, recordando siempre que el siguiente paso más útil es agendar el diagnóstico de 30 minutos.



REGLAS CLAVE DE PERSONALIDAD Y FORMATO:
1. SÉ CORTO Y CONCISO: Tus respuestas deben ser breves (1 a 3 frases máximo por mensaje). Cero discursos largos o "choro" acartonado.
2. PRODUCTOS CLAVE QUE OFRECES:
   - S1GNAL: La suite/plataforma de Origin One para Agentes de IA y workflows autónomos de respuesta inmediata.
   - Origin Studio: Creación de contenido, video generativo y avatares de marca.
   - Diagnóstico Inicial: Sesión de 30 minutos sin costo con nuestro equipo senior para revisar la operación del cliente.
3. REGLA DE ORO DE AGENDAMIENTO DE CITAS:
   - NUNCA invoques ni ejecutes la función 'agendarCitaDiagnostico' si el usuario se despide, o dice cosas como "te busco después", "luego hablo con ustedes", "no gracias". Si dice "Te busco después", respóndele con estilo e ingenio, por ejemplo: "¡Trato hecho! Por aquí andamos para cuando los procesos manuales vuelvan a doler 😉. ¡Excelente día!"
   - ÚNICAMENTE invoca 'agendarCitaDiagnostico' si el usuario responde que SÍ quiere agendar y te proporciona sus datos (Nombre, Email, WhatsApp, Fecha y Hora).
4. LÍMITE DE PROPÓSITO ÚNICO (CERO CHATBOT GRATIS / CHISTES / ENTRETENIMIENTO):
   - Tu ÚNICA función es informar sobre Origin One, S1GNAL, Origin Studio y agendar diagnósticos de automatización para empresas.
   - Si te piden chistes (ej. "cuéntame un chiste de papá"), tareas, código genérico, recetas, o usar la IA como chatbot gratuito para cualquier otro tema, RECHAZA con amabilidad e ingenio.
   - Ejemplo de rechazo: "Jaja buena intentona, pero mis circuitos están 100% dedicados a librar a las empresas del trabajo manual repetitivo con Origin One y S1GNAL 😉. Si tienes un proceso que quieras automatizar o agendar un diagnóstico, ¡con gusto lo revisamos!"

Base de conocimiento oficial:
${ORIGIN_ONE_KNOWLEDGE_BASE}`


      }
    ]);
  }

  const history = groqChatHistories.get(userId);
  history.push({ role: 'user', content: messageText });

  try {
    console.log(`[GroqEngine] ⚡ Procesando mensaje con Llama 3.3 70B (${userId} via ${channel}): "${messageText}"`);

  let response;
  const candidateModels = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'];

  for (const modelName of candidateModels) {
    try {
      response = await groq.chat.completions.create({
        model: modelName,
        messages: history,
        tools: groqTools,
        tool_choice: 'auto',
        temperature: 0.5,
        max_completion_tokens: 1024
      });
      if (response && response.choices?.[0]?.message) {
        break;
      }
    } catch (err) {
      console.warn(`[GroqEngine] ⚠️ Modelo ${modelName} no disponible (${err.message}). Intentando siguiente candidato...`);
    }
  }

  if (!response || !response.choices?.[0]?.message) {
    throw new Error('Todos los modelos de Groq excedieron su límite diario temporal.');
  }

  let responseMessage = response.choices[0].message;


    // Verificar si Groq quiere invocar Tool Calling (agendarCitaDiagnostico)
    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
      for (const toolCall of responseMessage.tool_calls) {
        if (toolCall.function.name === 'agendarCitaDiagnostico') {
          const args = JSON.parse(toolCall.function.arguments);
          args.canal_origen = channel;

          console.log('[GroqEngine] 🛠️ Tool Calling detectado en Groq! Agendando cita con args:', args);

          // Ejecutar agenda y notificar a WhatsApp
          const agendaResult = await scheduleAppointment(args);

          // Agregar respuesta de función al historial de mensajes de Groq
          history.push(responseMessage);
          history.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            name: 'agendarCitaDiagnostico',
            content: JSON.stringify({
              exito: agendaResult.success,
              idCita: agendaResult.appointmentId,
              mensaje: 'La cita ha sido registrada exitosamente y se envió la notificación inmediata por WhatsApp a los ejecutivos de Origin One.'
            })
          });

          // Pedir a Groq la respuesta final de confirmación para el cliente
          const followUp = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: history
          });

          const finalReply = followUp.choices[0].message.content;
          history.push({ role: 'assistant', content: finalReply });
          return finalReply;
        }
      }
    }

    const replyText = responseMessage.content;
    history.push({ role: 'assistant', content: replyText });
    return replyText;
  } catch (error) {
    console.error(`[GroqEngine] ❌ Error con Groq API:`, error.message);
    return "Disculpa, tuve un inconveniente procesando tu mensaje. Si deseas agendar directamente tu diagnóstico de 30 minutos, puedes escribirnos a info@originone.com.mx o dejarnos tus datos por aquí.";
  }
}

module.exports = {
  processUserMessageGroq
};
