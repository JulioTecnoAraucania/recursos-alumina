import { GoogleGenAI, Type, Schema } from "@google/genai";
import { CVProfile } from "../types";

const API_KEY = process.env.API_KEY || '';

// Schema definition for structured output
// Added 'required' fields to ensure the model completes the structure
const cvSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    fullName: { type: Type.STRING },
    email: { type: Type.STRING },
    phone: { type: Type.STRING },
    location: { type: Type.STRING },
    linkedin: { type: Type.STRING },
    summary: { type: Type.STRING },
    experience: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          role: { type: Type.STRING },
          company: { type: Type.STRING },
          startDate: { type: Type.STRING },
          endDate: { type: Type.STRING },
          description: { type: Type.STRING },
        },
        required: ["role", "company", "description"]
      }
    },
    education: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          degree: { type: Type.STRING },
          school: { type: Type.STRING },
          year: { type: Type.STRING },
        },
        required: ["degree", "school"]
      }
    },
    skills: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    },
    certifications: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          name: { type: Type.STRING },
          issuer: { type: Type.STRING },
          year: { type: Type.STRING },
        },
        required: ["name"]
      }
    }
  },
  required: ["fullName", "experience", "education", "skills", "certifications", "summary"]
};

interface FileInput {
  mimeType: string;
  data: string; // Base64 string
}

const cleanAndParseJSON = (responseText: string): any => {
  // 1. Remove markdown code blocks if present
  let cleanJson = responseText.replace(/```json\n?|\n?```/g, "");
  
  // 2. Find the first '{' and the last '}'
  const startIndex = cleanJson.indexOf('{');
  const endIndex = cleanJson.lastIndexOf('}');
  
  if (startIndex !== -1 && endIndex !== -1) {
    cleanJson = cleanJson.substring(startIndex, endIndex + 1);
  }

  // 3. Attempt parsing
  return JSON.parse(cleanJson);
};

export const analyzeDocuments = async (files: FileInput[], targetJob: string): Promise<CVProfile> => {
  if (!API_KEY) throw new Error("API Key is missing");

  const ai = new GoogleGenAI({ apiKey: API_KEY });
  
  const parts = [
    {
      text: `
      Analiza los documentos adjuntos (CV y Certificados) y el 'Cargo Objetivo': "${targetJob}".
      Tu misión es extraer los datos y RECONSTRUIR el perfil para garantizar un puntaje del 100% en sistemas ATS (Applicant Tracking Systems).

      INSTRUCCIONES DE EJECUCIÓN ESTRICTA:
      
      1. ESTRATEGIA DE REDACCIÓN (Keyword Matching):
         - Alineación Total: Ignora la redacción original del usuario si es débil. Reescribe cada descripción de experiencia laboral utilizando el vocabulario, las palabras clave y el tono propios del cargo: "${targetJob}".
         - Verbos de Acción: Inicia cada viñeta con verbos fuertes (Lideré, Optimicé, Desarrollé, Gestioné). Elimina frases pasivas.
         - Cuantificación: Donde sea posible, infiere o resalta logros (eficiencia, ahorro de tiempo, gestión de volumen).
      
      2. ORDEN CRONOLÓGICO INVERSO (Requisito ATS Crítico):
         - Organiza las secciones experience, education y certifications estrictamente por fecha descendente.
         - Regla de Oro: Lo que diga 'Presente', 'Actualidad' o el año en curso VA PRIMERO. Luego el año anterior, y así sucesivamente.
      
      3. GENERACIÓN AUTOMÁTICA DEL PERFIL (Summary):
         - Genera un nuevo 'Resumen Profesional' de alto impacto.
         - Integración de Evidencia: No uses frases genéricas. Debes mencionar explícitamente las certificaciones más potentes encontradas en los archivos (ej: '...con certificación avanzada en [Nombre del Curso] otorgada por [Institución]').
         - Cierre: Enfoca el párrafo en cómo estas habilidades aportan valor inmediato al cargo objetivo: "${targetJob}".
      
      4. EXTRACCIÓN DE CERTIFICADOS:
         - Analiza las imágenes/PDFs de diplomas. Extrae: Nombre exacto, Institución y Año.
         - Si el certificado es relevante para el cargo (ej: Excel, IA, Gestión), dale prioridad en el Resumen.
      
      FORMATO DE SALIDA:
      Devuelve SOLO un objeto JSON válido según el esquema proporcionado. 
      Asegúrate de que la estructura sea plana para la información personal (fullName, email, etc.) y contenga los arrays para experience, education, skills y certifications.
      `
    },
    ...files.map(file => ({
      inlineData: {
        mimeType: file.mimeType,
        data: file.data
      }
    }))
  ];

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: parts
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: cvSchema,
        systemInstruction: "Eres CV-Architect AI, experto en algoritmos ATS y redacción ejecutiva. Genera siempre un JSON válido y completo.",
        // Removed maxOutputTokens to prevent truncation of large responses
      }
    });

    const responseText = response.text || "";
    
    try {
      return cleanAndParseJSON(responseText) as CVProfile;
    } catch (e) {
      console.error("JSON Parse Error. Raw text snippet:", responseText.substring(0, 200));
      throw new Error("Error de formato en la respuesta de la IA. Por favor intenta procesar menos archivos o una versión más limpia del CV.");
    }
  } catch (error) {
    console.error("Error analyzing documents:", error);
    if (error instanceof Error) {
      if (error.message.includes("JSON")) {
         throw new Error(`Error de interpretación de datos. La IA no devolvió un JSON válido.`);
      }
      throw new Error(`Fallo en análisis IA: ${error.message}`);
    }
    throw error;
  }
};

export const optimizeCVContent = async (currentData: CVProfile, targetJob: string): Promise<CVProfile> => {
  if (!API_KEY) throw new Error("API Key is missing");

  const ai = new GoogleGenAI({ apiKey: API_KEY });

  const prompt = `
    CARGO OBJETIVO: ${targetJob}
    DATOS ACTUALES: ${JSON.stringify(currentData)}
    
    ROL: Eres un Consultor de Carrera de élite (Top 1% mundial) y experto en ATS.
    OBJETIVO: Reescribir este CV para garantizar una entrevista en el cargo objetivo.

    INSTRUCCIONES DE REDACCIÓN (ESTRICTAS):
    1. ALINEACIÓN TOTAL: Usa palabras clave, terminología técnica y tono específicos para "${targetJob}".
    2. DESCRIPCIONES DE IMPACTO (Experiencia):
       - Usa entre 4 y 6 bullets detallados por cada rol relevante.
       - Estructura: Verbo de Acción fuerte + Tarea/Contexto + Resultado Cuantificable (Método STAR).
       - Ejemplo: "Lideré la migración de base de datos reduciendo tiempos de carga en 40%..."
    3. PERFIL PROFESIONAL: Redacta un párrafo persuasivo de 4-5 líneas que venda al candidato como la solución ideal para el cargo. Incluye certificaciones relevantes.
    4. ORDEN: Asegura orden cronológico inverso en experiencia y educación.
    5. CERTIFICADOS: Mantén solo los 5 más relevantes para el cargo.
    
    Salida: JSON válido.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: cvSchema,
        systemInstruction: "Eres CV-Architect AI. Genera JSON válido optimizado para ATS.",
      }
    });

    const responseText = response.text || "";

    if (responseText) {
      try {
         return cleanAndParseJSON(responseText) as CVProfile;
      } catch (e) {
        console.error("JSON Parse Error in optimization:", responseText.substring(0, 100));
        throw new Error("La IA no pudo generar un formato válido para la optimización.");
      }
    }
    throw new Error("No response text generated");
  } catch (error) {
    console.error("Error optimizing CV:", error);
    if (error instanceof Error) {
      throw new Error(`Fallo en optimización IA: ${error.message}`);
    }
    throw error;
  }
};

export const improveWriting = async (text: string, targetJob: string, type: 'experience' | 'summary'): Promise<string> => {
  if (!API_KEY) throw new Error("API Key is missing");

  const ai = new GoogleGenAI({ apiKey: API_KEY });
  
  const instruction = type === 'experience' 
    ? "Mejora esta descripción de tareas para ATS. Usa verbos de acción fuertes, formato de logros cuantificables (STAR) y tono ejecutivo alineado con el cargo."
    : "Reescribe este perfil profesional para que sea persuasivo, directo y venda el valor del candidato para el cargo, mencionando palabras clave.";

  const prompt = `
    CONTEXTO: El candidato postula al cargo de "${targetJob}".
    TAREA: ${instruction}
    TEXTO ORIGINAL: "${text}"
    
    REGLA: Devuelve SOLO el texto mejorado. Sin introducciones, sin comillas, sin formato markdown innecesario.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "text/plain",
        systemInstruction: "Eres un editor experto de CVs y ATS. Tu único objetivo es mejorar la redacción.",
      }
    });

    return response.text?.trim() || text;
  } catch (error) {
    console.error("Error improving text:", error);
    throw error;
  }
};

export const regenerateSummary = async (data: CVProfile, targetJob: string): Promise<string> => {
  if (!API_KEY) throw new Error("API Key is missing");

  const ai = new GoogleGenAI({ apiKey: API_KEY });

  // Prepare simplified data to save tokens but keep context
  const expContext = data.experience.map(e => ({ role: e.role, company: e.company, desc: e.description, dates: `${e.startDate}-${e.endDate}` }));
  const certContext = data.certifications.map(c => ({ name: c.name, issuer: c.issuer, year: c.year }));
  const eduContext = data.education.map(e => ({ degree: e.degree, school: e.school }));

  const prompt = `
    Actúa como un experto consultor de carrera y ATS. El candidato postula al cargo de "${targetJob}".
    
    Basándote en su Experiencia Laboral: ${JSON.stringify(expContext)}
    Y sus Certificaciones Clave: ${JSON.stringify(certContext)}
    Y su Formación: ${JSON.stringify(eduContext)}
    
    Redacta un 'Perfil Profesional' (Resumen) de un solo párrafo (máximo 6 líneas).
    
    REGLAS CLAVE:
    1. Integra explícitamente las certificaciones más relevantes para el cargo (ej: 'Especialista certificado en... por...').
    2. Enfoca el texto en el valor que el candidato aporta al rol de "${targetJob}".
    3. Usa lenguaje de alto impacto y palabras clave de la industria.
    
    REGLA: Devuelve SOLO el texto del párrafo. Sin títulos, sin comillas, sin markdown.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "text/plain",
        systemInstruction: "Eres CV-Architect AI. Tu objetivo es sintetizar todo el perfil en un resumen ganador optimizado para ATS.",
      }
    });

    return response.text?.trim() || "";
  } catch (error) {
    console.error("Error regenerating summary:", error);
    throw error;
  }
};
