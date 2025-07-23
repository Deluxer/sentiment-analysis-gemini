// app/api/analyze/route.ts
import { GoogleGenerativeAI, Part } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { GeminiResponseSchema } from "@/lib/squemas";

export async function POST(req: NextRequest) {
  if (req.method !== "POST") {
    return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
    }

    if (file.type !== "audio/mpeg") {
      return NextResponse.json(
        { error: "Invalid file type. Only MP3 files are accepted." },
        { status: 400 }
      );
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-pro-latest",
      generationConfig: {
        responseMimeType: "text/plain", // más seguro para controlar el parsing
      },
    });

    const prompt = `
    Tu tarea es procesar el audio proporcionado de una llamada de servicio al cliente.
    
    1. **Transcripción con Diarización de Hablantes:**
       - Identifica a los dos interlocutores principales y asígnales los roles 'Agente' y 'Cliente'.
       - Transcribe la conversación completa.
       - Formatea la transcripción como un diálogo. El turno de cada interlocutor debe estar en una nueva línea, con el prefijo de su rol seguido de dos puntos.
       - **Ejemplo de formato:**
         Agente: Hola, ¿cómo puedo ayudarte?
         Cliente: Tengo una pregunta sobre mis puntos Doter.
    
    2. **Análisis de Sentimiento:**
       - Proporciona un análisis de sentimiento detallado del discurso.
       - El análisis debe identificar el sentimiento general (positivo, negativo, neutral) y cualquier emoción específica detectada, con evidencia del texto.
    
    3. **Análisis Específico:**
       - **puntosDoterSolved**: Evalúa si la duda principal del cliente sobre los 'puntos Doter' fue resuelta por el agente. El valor debe ser un booleano ('true' si fue resuelta, 'false' si no).
    
    4. **Resumen de la Conversación:**
       - **reasonForCall**: Proporciona un resumen detallado que incluya:
         * El motivo principal de la llamada del cliente (qué problema o consulta específica tenía).
         * La situación del cliente al momento de la llamada (por ejemplo: dificultad técnica, falta de información, edad, desconocimiento del proceso, etc.).
         * Los obstáculos que impidieron resolver el problema (por ejemplo: el cliente no tiene número de socio, no puede usar la web, no tiene ayuda disponible).
         * Las acciones del agente para intentar resolver el problema y si hubo seguimiento o promesas.
         * Indica claramente si el problema fue resuelto o no, y por qué.
    
         - Sé claro, conciso y usa lenguaje natural.
         - Evita repeticiones innecesarias.
    
         **Ejemplo**:  
         "El cliente llamó para consultar el saldo de sus puntos Doters y cómo usarlos. No contaba con su número de socio, lo cual es necesario para acceder a su cuenta. El agente intentó guiarlo paso a paso a través del sitio web desde un celular, pero el cliente tuvo dificultades técnicas y de comprensión. Finalmente, se sugirió que volviera a llamar con ayuda de su hijo o desde una computadora. El problema no fue resuelto durante la llamada."
    
       - **puntosDoterSolved**: Evalúa si la duda principal fue resuelta. Considera como resuelto si:
         * El agente brindó una respuesta clara y completa.
         * El cliente expresó satisfacción.
         * No quedaron dudas ni acciones pendientes.
         * Se entregó una solución concreta o guía que el cliente entendió y aceptó.
    
       - **keyInteractions**: Extrae los pares de pregunta y respuesta clave. Incluye:
         * La consulta específica del cliente.
         * La respuesta más relevante del agente.
         * Aclaraciones o pasos útiles que aportaron al intento de solución.
    
    5. **Salida Final:**
       Devuelve un único objeto JSON con esta estructura exacta:
    
       {
         "transcription": string,
         "sentimentAnalysis": {
           "overallSentiment": "Neutral",
           "specificEmotions": [
             {
               "emotion": string,
               "evidence": string
             }
           ]
         },
         "puntosDoterSolved": boolean,
         "reasonForCall": string,
         "keyInteractions": [
           {
             "question": string,
             "response": string
           }
         ]
       }
    
    IMPORTANTE:
    - No incluyas ningún encabezado, explicación ni formato adicional. Devuelve exclusivamente un objeto JSON válido que cumpla con la estructura especificada, sin texto antes o después.
    `.trim();    

    const audioBytes = await file.arrayBuffer();
    const buffer = Buffer.from(audioBytes);

    const audioPart: Part = {
      inlineData: {
        data: buffer.toString("base64"),
        mimeType: file.type,
      },
    };

    const result = await model.generateContent([prompt, audioPart]);
    const response = await result.response;
    const text = response.text().trim();

    try {

      const cleanText = text
        .replace(/^```json\s*/i, '')  // elimina apertura tipo ```json
        .replace(/```$/, '')          // elimina cierre ```
        .trim();

      const parsed = JSON.parse(cleanText);
      const validation = GeminiResponseSchema.safeParse(parsed);
      console.log("parsed", validation.data);


      if (!validation.success) {
        console.error("❌ Zod validation failed:", validation.error.format());
        return NextResponse.json(
          {
            error: "La respuesta de Gemini no cumple con el esquema esperado.",
            issues: validation.error.format(),
            raw: parsed,
          },
          { status: 500 }
        );
      }

      return NextResponse.json(validation.data, { status: 200 });
    } catch (err) {
      console.error("❌ Error al parsear JSON:", text);
      return NextResponse.json(
        {
          error: "No se pudo parsear la respuesta de Gemini.",
          rawResponse: text,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("❌ Error general:", error);
    return NextResponse.json(
      { error: "Ocurrió un error durante el análisis." },
      { status: 500 }
    );
  }
}
