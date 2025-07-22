import { GoogleGenerativeAI, Part } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  if (req.method !== "POST") {
    return NextResponse.json(
      { error: "Method not allowed" },
      { status: 405 }
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file uploaded." },
        { status: 400 }
      );
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
        responseMimeType: "application/json",
      },
    });

    const prompt = `
    Tu tarea es procesar el audio proporcionado de una llamada de servicio al cliente.

    1.  **Transcripción con Diarización de Hablantes:**
        - Identifica a los dos interlocutores principales y asígnales los roles 'Agente' y 'Cliente'.
        - Transcribe la conversación completa.
        - Formatea la transcripción como un diálogo. El turno de cada interlocutor debe estar en una nueva línea, con el prefijo de su rol seguido de dos puntos.
        - **Formato de ejemplo:**
          Agente: Hola, ¿cómo puedo ayudarte?
          Cliente: Tengo una pregunta sobre mi factura.

    2.  **Análisis de Sentimiento:**
        - Proporciona un análisis de sentimiento detallado del discurso.
        - El análisis debe identificar el sentimiento general (positivo, negativo, neutral) y cualquier emoción específica detectada, con evidencia del texto.

    3.  **Resumen de la Conversación:**
        - **reasonForCall**: Resume el propósito principal de la llamada del cliente en una oración concisa.
        - **keyInteractions**: Extrae los pares de pregunta y respuesta clave del diálogo. Debe ser un arreglo de objetos, donde cada objeto tiene una clave "question" (la consulta del cliente) y una clave "response" (la respuesta directa del agente).

    4.  **Estructura de Salida Final:**
        - La salida completa debe ser un único objeto JSON válido.
        - El objeto JSON debe tener cuatro claves de nivel superior: "transcription", "sentimentAnalysis", "reasonForCall" y "keyInteractions".
  `;

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
    const text = response.text();

    try {
      const jsonResponse = JSON.parse(text);
      return NextResponse.json(jsonResponse, { status: 200 });
    } catch (e) {
      console.error("Failed to parse Gemini response as JSON:", text);
      return NextResponse.json(
        {
          error: "Failed to parse the analysis from Gemini.",
          rawResponse: text,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "An error occurred during analysis." },
      { status: 500 }
    );
  }
}