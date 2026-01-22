import React from 'react';
import { X, Download, Eye, FileText } from 'lucide-react';
import { CVProfile } from '../types';

interface PreviewModalProps {
  data: CVProfile;
  onClose: () => void;
  onDownloadPDF: () => void;
  onDownloadDOCX: () => void;
}

export const PreviewModal: React.FC<PreviewModalProps> = ({ data, onClose, onDownloadPDF, onDownloadDOCX }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-5xl h-[90vh] flex flex-col">
        
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-4 rounded-t-xl border-b shadow-md gap-4">
          <div className="flex items-center space-x-2 text-slate-800">
            <Eye className="text-indigo-600" />
            <span className="font-bold text-lg">Vista Previa</span>
          </div>
          <div className="flex items-center space-x-4">
             <button 
              onClick={onDownloadDOCX}
              className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow hover:shadow-lg transform active:scale-95 text-sm sm:text-base"
            >
              <FileText size={18} />
              <span>Descargar Word</span>
            </button>
             <button 
              onClick={onDownloadPDF}
              className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow hover:shadow-lg transform active:scale-95 text-sm sm:text-base"
            >
              <Download size={18} />
              <span>Descargar PDF</span>
            </button>
            <button 
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-full transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Scrollable Preview Area */}
        <div className="flex-1 overflow-y-auto bg-slate-200 p-8 rounded-b-xl">
          {/* A4 Page Simulation */}
          <div className="a4-paper text-slate-900 leading-relaxed">
            
            {/* Header */}
            <div className="border-b-2 border-slate-800 pb-6 mb-8">
              <h1 className="text-4xl font-bold tracking-tight text-slate-900 uppercase mb-2 break-words">{data.fullName || "Tu Nombre"}</h1>
              <div className="flex flex-wrap text-sm text-slate-600 font-medium gap-3">
                 {[data.email, data.phone, data.location, data.linkedin].filter(Boolean).join(" | ")}
              </div>
            </div>

            {/* Summary */}
            {data.summary && (
              <div className="mb-8">
                <h3 className="text-lg font-bold uppercase border-b border-slate-300 pb-1 mb-3 tracking-wide">Perfil Profesional</h3>
                <p className="text-sm text-justify text-slate-700 whitespace-pre-wrap break-words">{data.summary}</p>
              </div>
            )}

            {/* Experience */}
            {data.experience.length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-bold uppercase border-b border-slate-300 pb-1 mb-4 tracking-wide">Experiencia Laboral</h3>
                <div className="space-y-5">
                  {data.experience.map((exp, i) => (
                    <div key={i}>
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-baseline mb-1">
                        <h4 className="font-bold text-slate-800">{exp.role}</h4>
                        <span className="text-sm font-bold text-slate-900 whitespace-nowrap">{exp.startDate} - {exp.endDate}</span>
                      </div>
                      <div className="text-sm font-medium text-slate-600 italic mb-2">{exp.company}</div>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap break-words">{exp.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Education */}
            {data.education.length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-bold uppercase border-b border-slate-300 pb-1 mb-4 tracking-wide">Educación</h3>
                <div className="space-y-4">
                  {data.education.map((edu, i) => (
                    <div key={i} className="flex justify-between">
                      <div>
                        <h4 className="font-bold text-slate-800">{edu.degree}</h4>
                        <div className="text-sm text-slate-600">{edu.school}</div>
                      </div>
                      <div className="text-sm font-medium text-slate-900">{edu.year}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Skills */}
            {data.skills.length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-bold uppercase border-b border-slate-300 pb-1 mb-3 tracking-wide">Habilidades</h3>
                <p className="text-sm text-slate-700 whitespace-pre-wrap break-words">
                  {data.skills.join(" • ")}
                </p>
              </div>
            )}

             {/* Certifications */}
             {data.certifications.length > 0 && (
              <div>
                <h3 className="text-lg font-bold uppercase border-b border-slate-300 pb-1 mb-4 tracking-wide">Certificaciones</h3>
                <div className="space-y-3">
                  {data.certifications.map((cert, i) => (
                    <div key={i} className="flex justify-between">
                      <div>
                        <h4 className="font-bold text-sm text-slate-800">{cert.name}</h4>
                        <div className="text-xs text-slate-600">{cert.issuer}</div>
                      </div>
                      <div className="text-sm font-medium text-slate-900">{cert.year}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};