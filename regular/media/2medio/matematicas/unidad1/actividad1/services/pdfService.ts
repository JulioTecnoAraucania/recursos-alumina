import { jsPDF } from "jspdf";
import { CVProfile } from "../types";

export const generatePDF = (data: CVProfile) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // --- Constants & Config ---
  const CONFIG = {
    PAGE_HEIGHT: 297, // Altura total A4
    MARGIN_TOP: 20,
    MARGIN_BOTTOM: 20,
    MARGIN_LEFT: 20,
    MARGIN_RIGHT: 20,
    LINE_HEIGHT_FACTOR: 1.2,
    FONT_SIZE: {
      HEADER: 22,
      SECTION: 14,
      ROLE: 11,
      BODY: 10,
      SMALL: 9
    },
    COLORS: {
      BLACK: [0, 0, 0] as [number, number, number],
      DARK_GRAY: [60, 60, 60] as [number, number, number],
      LIGHT_GRAY: [100, 100, 100] as [number, number, number]
    },
    // Estimaciones dinámicas ajustadas (Mm) para evitar saltos innecesarios
    ESTIMATES: {
      HEADING: 14,
      SUMMARY_BLOCK: 30,    // Título + Texto breve
      EXP_FIRST_ITEM: 35,   // Título + 1er Cargo (Titulo, Fechas, Empresa, ~2 bullets)
      EDU_FIRST_ITEM: 25,   // Título + 1er Item Educación (Compacto)
      CERT_FIRST_ITEM: 20   // Título + 1er Certificado (Muy compacto)
    }
  };

  const MAX_WIDTH = 210 - CONFIG.MARGIN_LEFT - CONFIG.MARGIN_RIGHT;
  const PAGE_LIMIT = CONFIG.PAGE_HEIGHT - CONFIG.MARGIN_BOTTOM;
  
  let cursorY = CONFIG.MARGIN_TOP;

  // --- Helper Functions ---

  /**
   * Formatea fechas ISO o texto crudo a formato ATS amigable.
   * Ej: "2023-05" -> "May 2023"
   * Ej: "Presente" -> "Presente"
   */
  const formatDate = (dateString: string): string => {
    if (!dateString) return "";
    
    const lower = dateString.toLowerCase().trim();
    if (lower.includes('present') || lower.includes('actual') || lower.includes('hoy') || lower.includes('current')) {
      return "Presente";
    }

    // Intenta parsear YYYY-MM o YYYY-MM-DD
    // Usamos Regex para evitar problemas de zona horaria con new Date()
    const match = dateString.match(/^(\d{4})[-/](\d{1,2})/);
    
    if (match) {
      const year = match[1];
      const monthIndex = parseInt(match[2], 10) - 1;
      const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      
      if (monthIndex >= 0 && monthIndex < 12) {
        return `${months[monthIndex]} ${year}`;
      }
    }

    // Si solo es año "2020" o formato desconocido, devolver original
    return dateString;
  };

  /**
   * Sistema de Predicción de Espacio.
   * Verifica si hay suficiente espacio vertical. Si no, añade página y resetea cursor.
   * @param heightNeeded Altura estimada requerida en mm.
   * @returns true si se creó una nueva página, false si no.
   */
  const checkPageBreak = (heightNeeded: number): boolean => {
    if (cursorY + heightNeeded > PAGE_LIMIT) {
      doc.addPage();
      cursorY = CONFIG.MARGIN_TOP;
      return true;
    }
    return false;
  };

  /**
   * Calcula la altura real que ocupará un texto.
   */
  const calculateTextHeight = (text: string, fontSize: number): number => {
    if (!text) return 0;
    const lineHeightMm = fontSize * 0.3527 * CONFIG.LINE_HEIGHT_FACTOR;
    const lines = doc.splitTextToSize(text, MAX_WIDTH);
    return lines.length * lineHeightMm;
  };

  /**
   * Imprime un bloque de texto con gestión automática de salto de página interno.
   */
  const printBlock = (
    text: string, 
    fontSize: number, 
    isBold: boolean, 
    color: [number, number, number],
    align: 'left' | 'right' | 'center' = 'left',
    marginBottom: number = 0
  ) => {
    if (!text) return;

    doc.setFont("helvetica", isBold ? "bold" : "normal");
    doc.setFontSize(fontSize);
    doc.setTextColor(color[0], color[1], color[2]);

    const lines = doc.splitTextToSize(text, MAX_WIDTH);
    const lineHeightMm = fontSize * 0.3527 * CONFIG.LINE_HEIGHT_FACTOR;
    const blockHeight = lines.length * lineHeightMm;

    // Si el bloque es masivo (mayor a una página), dejamos que fluya,
    // pero si es un párrafo normal y choca con el final, saltamos página antes.
    if (cursorY + blockHeight > PAGE_LIMIT && blockHeight < (PAGE_LIMIT - CONFIG.MARGIN_TOP)) {
       doc.addPage();
       cursorY = CONFIG.MARGIN_TOP;
    }

    doc.text(lines, CONFIG.MARGIN_LEFT, cursorY, { align: align === 'left' ? undefined : align });
    cursorY += blockHeight + marginBottom;
  };

  /**
   * Imprime título de sección con línea decorativa.
   * NOTA: No hace checkPageBreak internamente para permitir la lógica de predicción agrupada.
   */
  const printHeading = (title: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(CONFIG.FONT_SIZE.SECTION);
    doc.setTextColor(CONFIG.COLORS.BLACK[0], CONFIG.COLORS.BLACK[1], CONFIG.COLORS.BLACK[2]);
    
    doc.text(title.toUpperCase(), CONFIG.MARGIN_LEFT, cursorY);
    
    // Línea decorativa fina
    doc.setLineWidth(0.5);
    doc.setDrawColor(200, 200, 200);
    doc.line(CONFIG.MARGIN_LEFT, cursorY + 2, 210 - CONFIG.MARGIN_RIGHT, cursorY + 2);
    
    cursorY += CONFIG.ESTIMATES.HEADING;
  };

  // --- Document Construction ---

  // 1. Header Name
  printBlock(data.fullName.toUpperCase(), CONFIG.FONT_SIZE.HEADER, true, CONFIG.COLORS.BLACK, 'left', 5);

  // 2. Contact Info
  const contactInfo = [
    data.email,
    data.phone,
    data.location,
    data.linkedin
  ].filter(Boolean).join(" | ");
  
  printBlock(contactInfo, CONFIG.FONT_SIZE.BODY, false, CONFIG.COLORS.DARK_GRAY, 'left', 10);

  // 3. Summary
  if (data.summary) {
    const summaryHeight = calculateTextHeight(data.summary, CONFIG.FONT_SIZE.BODY);
    // Predicción: Título + Resumen. Si cabe, imprimir junto.
    checkPageBreak(CONFIG.ESTIMATES.HEADING + summaryHeight + 5);

    printHeading("Perfil Profesional");
    printBlock(data.summary, CONFIG.FONT_SIZE.BODY, false, CONFIG.COLORS.DARK_GRAY, 'left', 10);
  }

  // 4. Experience
  if (data.experience.length > 0) {
    // Predicción Dinámica: Título + Primer Item
    // Si hay poco espacio, salta página. Si hay ~40mm, se queda.
    checkPageBreak(CONFIG.ESTIMATES.EXP_FIRST_ITEM);
    
    printHeading("Experiencia Laboral");

    data.experience.forEach((exp) => {
      // 1. Calcular altura real de este item
      const roleH = calculateTextHeight(exp.role, CONFIG.FONT_SIZE.ROLE);
      const compH = calculateTextHeight(exp.company, CONFIG.FONT_SIZE.BODY);
      const descH = calculateTextHeight(exp.description, CONFIG.FONT_SIZE.BODY);
      const totalH = roleH + compH + descH + 10; // +10mm padding

      // 2. Verificar si este item específico cabe
      checkPageBreak(totalH);

      // 3. Renderizar Cargo y Fecha
      doc.setFont("helvetica", "bold");
      doc.setFontSize(CONFIG.FONT_SIZE.ROLE);
      doc.setTextColor(0, 0, 0);

      // Formatear fechas
      const startFmt = formatDate(exp.startDate);
      const endFmt = formatDate(exp.endDate);
      const dateText = `${startFmt} - ${endFmt}`;

      // Imprimir Cargo
      const roleLines = doc.splitTextToSize(exp.role, MAX_WIDTH - 45); // Espacio para fecha
      doc.text(roleLines, CONFIG.MARGIN_LEFT, cursorY);
      
      // Imprimir Fecha (Alineada derecha)
      doc.setFont("helvetica", "normal"); // Fecha normal, no bold
      doc.setFontSize(CONFIG.FONT_SIZE.SMALL);
      doc.setTextColor(CONFIG.COLORS.DARK_GRAY[0], CONFIG.COLORS.DARK_GRAY[1], CONFIG.COLORS.DARK_GRAY[2]);
      
      const dateWidth = doc.getTextWidth(dateText);
      doc.text(dateText, 210 - CONFIG.MARGIN_RIGHT - dateWidth, cursorY);

      cursorY += (roleLines.length * CONFIG.FONT_SIZE.ROLE * 0.3527 * 1.2) + 1;

      // 4. Empresa (Italic visual cue or gray)
      doc.setFont("helvetica", "normal");
      doc.setFontSize(CONFIG.FONT_SIZE.BODY);
      doc.text(exp.company, CONFIG.MARGIN_LEFT, cursorY);
      cursorY += 5; // Salto pequeño

      // 5. Descripción
      if (exp.description) {
         printBlock(exp.description, CONFIG.FONT_SIZE.BODY, false, CONFIG.COLORS.DARK_GRAY, 'left', 8);
      } else {
        cursorY += 5;
      }
    });
  }

  // 5. Education
  if (data.education.length > 0) {
    // Predicción optimizada: Título + 1 item educación (25mm)
    checkPageBreak(CONFIG.ESTIMATES.EDU_FIRST_ITEM);
    
    printHeading("Educación");
    
    data.education.forEach(edu => {
      // Item educación suele ser pequeño (~15-20mm)
      checkPageBreak(20);

      // Título
      doc.setFont("helvetica", "bold");
      doc.setFontSize(CONFIG.FONT_SIZE.ROLE);
      doc.setTextColor(0,0,0);
      doc.text(edu.degree, CONFIG.MARGIN_LEFT, cursorY);
      
      // Año (Si es fecha completa formatearla, si es solo año dejarla)
      const yearText = formatDate(edu.year);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(CONFIG.FONT_SIZE.SMALL);
      doc.setTextColor(CONFIG.COLORS.DARK_GRAY[0], CONFIG.COLORS.DARK_GRAY[1], CONFIG.COLORS.DARK_GRAY[2]);
      
      const yearWidth = doc.getTextWidth(yearText);
      doc.text(yearText, 210 - CONFIG.MARGIN_RIGHT - yearWidth, cursorY);
      
      cursorY += 5;
      
      // Escuela
      printBlock(edu.school, CONFIG.FONT_SIZE.BODY, false, CONFIG.COLORS.DARK_GRAY, 'left', 6);
    });
  }

  // 6. Skills
  if (data.skills.length > 0) {
    const skillsText = data.skills.join(" • ");
    const skillsHeight = calculateTextHeight(skillsText, CONFIG.FONT_SIZE.BODY);
    
    // Si cabe, imprime. Si no, salta.
    checkPageBreak(CONFIG.ESTIMATES.HEADING + skillsHeight + 5);

    printHeading("Habilidades");
    printBlock(skillsText, CONFIG.FONT_SIZE.BODY, false, CONFIG.COLORS.DARK_GRAY, 'left', 10);
  }

  // 7. Certifications
  if (data.certifications.length > 0) {
    // Predicción: Título + 1 Certificado (20mm)
    checkPageBreak(CONFIG.ESTIMATES.CERT_FIRST_ITEM);

    printHeading("Certificaciones");
    
    data.certifications.forEach(cert => {
      checkPageBreak(18); 
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(CONFIG.FONT_SIZE.BODY);
      doc.setTextColor(0,0,0);
      doc.text(cert.name, CONFIG.MARGIN_LEFT, cursorY);
      
      const yearText = formatDate(cert.year);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(CONFIG.FONT_SIZE.SMALL);
      const yearWidth = doc.getTextWidth(yearText);
      doc.text(yearText, 210 - CONFIG.MARGIN_RIGHT - yearWidth, cursorY);
      
      cursorY += 5;
      
      printBlock(cert.issuer, CONFIG.FONT_SIZE.SMALL, false, CONFIG.COLORS.DARK_GRAY, 'left', 6);
    });
  }

  // Save the PDF
  const filename = `CV_${data.fullName.replace(/\s+/g, '_') || 'Candidato'}_Optimizado.pdf`;
  doc.save(filename);
};