import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle } from "docx";
import saveAs from "file-saver";
import { CVProfile } from "../types";

export const generateDOCX = (data: CVProfile) => {
  const sections = [];

  // --- Styles & Helpers ---
  
  const createHeading = (text: string) => {
    return new Paragraph({
      text: text.toUpperCase(),
      heading: HeadingLevel.HEADING_2,
      spacing: {
        before: 400,
        after: 200,
      },
      border: {
        bottom: {
          color: "999999",
          space: 1,
          style: BorderStyle.SINGLE,
          size: 6,
        },
      },
    });
  };

  const createEntryTitle = (leftText: string, rightText: string) => {
    // In Word, strict left/right alignment on same line usually uses tabs, 
    // but for simplicity in robust generation, we can use a single text run or separate paragraphs.
    // Here we strictly format the Title in Bold.
    return new Paragraph({
      children: [
        new TextRun({
          text: leftText,
          bold: true,
          size: 24, // 12pt
        }),
        new TextRun({
          text: rightText ? `  |  ${rightText}` : "",
          bold: false,
          size: 20, // 10pt
          color: "666666"
        })
      ],
      spacing: { before: 200, after: 50 },
    });
  };

  const createBodyText = (text: string, italics = false) => {
    return new Paragraph({
      children: [
        new TextRun({
          text: text,
          italics: italics,
          size: 22, // 11pt
        }),
      ],
      spacing: { after: 100 },
    });
  };

  // --- Document Construction ---

  // 1. Header
  sections.push(
    new Paragraph({
      text: data.fullName.toUpperCase(),
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.LEFT,
    })
  );

  const contactText = [data.email, data.phone, data.location, data.linkedin].filter(Boolean).join(" | ");
  sections.push(
    new Paragraph({
      children: [new TextRun({ text: contactText, size: 20, color: "555555" })],
      spacing: { after: 400 },
    })
  );

  // 2. Summary
  if (data.summary) {
    sections.push(createHeading("Perfil Profesional"));
    sections.push(createBodyText(data.summary));
  }

  // 3. Experience
  if (data.experience.length > 0) {
    sections.push(createHeading("Experiencia Laboral"));
    data.experience.forEach(exp => {
      sections.push(
        new Paragraph({
          children: [
            new TextRun({ text: exp.role, bold: true, size: 24 }),
            new TextRun({ text: "\t" }), // Tab for spacing attempt, though tabs need stops
            new TextRun({ text: `${exp.startDate} - ${exp.endDate}`, size: 20, bold: true })
          ],
          tabStops: [
            { position: 9000, type: "right", leader: "none" } // Approximate right align
          ]
        })
      );
      sections.push(createBodyText(exp.company, true));
      sections.push(createBodyText(exp.description));
    });
  }

  // 4. Education
  if (data.education.length > 0) {
    sections.push(createHeading("Educación"));
    data.education.forEach(edu => {
      sections.push(
        new Paragraph({
          children: [
            new TextRun({ text: edu.degree, bold: true, size: 24 }),
            new TextRun({ text: `  (${edu.year})` })
          ]
        })
      );
      sections.push(createBodyText(edu.school));
    });
  }

  // 5. Skills
  if (data.skills.length > 0) {
    sections.push(createHeading("Habilidades"));
    sections.push(createBodyText(data.skills.join(" • ")));
  }

  // 6. Certifications
  if (data.certifications.length > 0) {
    sections.push(createHeading("Certificaciones"));
    data.certifications.forEach(cert => {
      sections.push(
        new Paragraph({
          children: [
            new TextRun({ text: cert.name, bold: true }),
            new TextRun({ text: ` - ${cert.year}` })
          ]
        })
      );
      sections.push(createBodyText(cert.issuer, true));
    });
  }

  // Generate Blob
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: sections,
      },
    ],
  });

  Packer.toBlob(doc).then((blob) => {
    const filename = `CV_${data.fullName.replace(/\s+/g, '_') || 'Candidato'}_Optimizado.docx`;
    saveAs(blob, filename);
  });
};