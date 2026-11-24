// Instrucciones auxiliares del coach: variantes de refinamiento (sección 6.7).

export const COACH_SYSTEM_PREFIX_ACTIONS = ""; // reservado: el sistema vive en lib/ai/coachInstructions

export function buildVariantInstruction(variant?: string): string | null {
  switch (variant) {
    case "mas_corto":
      return "Reescribe tu respuesta anterior con un [MENSAJE] MÁS CORTO: una sola línea, sin perder el objetivo.";
    case "mas_suave":
      return "Reescribe tu respuesta anterior con un [MENSAJE] MÁS SUAVE: mismo objetivo, menos intensidad, cero presión.";
    case "mas_directo":
      return "Reescribe tu respuesta anterior con un [MENSAJE] MÁS DIRECTO: mismo objetivo, sin rodeos, respetando las reglas de longitud.";
    case "otra":
      return "Dame OTRA versión completamente distinta de tu respuesta anterior: nuevo enfoque, nuevo mensaje, mismo contexto.";
    default:
      return null;
  }
}
