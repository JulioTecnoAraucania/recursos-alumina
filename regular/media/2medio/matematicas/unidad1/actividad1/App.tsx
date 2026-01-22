import React, { useState } from 'react';
import { 
  Briefcase, 
  GraduationCap, 
  User, 
  Award, 
  Sparkles, 
  Zap, 
  Layout, 
  Loader2,
  Trash2,
  Plus,
  Search,
  Eye,
  Lock,
  CheckCircle,
  Download,
  RefreshCw
} from 'lucide-react';

import { FileUpload } from './components/FileUpload';
import { CVSection } from './components/CVSection';
import { Input, TextArea } from './components/FormFields';
import { PreviewModal } from './components/PreviewModal';
import { CVProfile, INITIAL_CV_DATA, Experience, Education, Certification } from './types';
import { analyzeDocuments, improveWriting, regenerateSummary } from './services/geminiService';
import { generatePDF } from './services/pdfService';
import { generateDOCX } from './services/wordService';

const App: React.FC = () => {
  const [cvData, setCvData] = useState<CVProfile>(INITIAL_CV_DATA);
  const [targetJob, setTargetJob] = useState('');
  
  // File state
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [certFiles, setCertFiles] = useState<File[]>([]); 

  const [status, setStatus] = useState<'idle' | 'analyzing'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // New state for individual field optimization
  // Stores the ID of the field being improved (e.g., 'summary' or 'exp-123')
  const [optimizingField, setOptimizingField] = useState<string | null>(null);

  // Derived state for UI flow
  const isStep1Complete = targetJob.trim().length > 0;

  // --- Helpers ---
  
  /**
   * Procesa archivos que no son imágenes (como PDF) de forma estándar.
   */
  const fileToGenerativePart = (file: File): Promise<{ mimeType: string; data: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = () => {
        const base64String = reader.result as string;
        if (!base64String) {
          reject(new Error(`Error al leer el archivo ${file.name}`));
          return;
        }
        const base64Data = base64String.split(',')[1];
        resolve({ mimeType: file.type, data: base64Data });
      };
      reader.onerror = (error) => reject(error);
    });
  };

  /**
   * Comprime imágenes usando Canvas para reducir el tamaño del payload.
   * Redimensiona a un máximo de 1024px de ancho y usa calidad JPEG 0.7.
   */
  const compressImage = (file: File): Promise<{ mimeType: string; data: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const MAX_WIDTH = 1024;

          // Calcular proporciones
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }

          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error("No se pudo obtener el contexto del canvas"));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          
          // Convertir a JPEG con calidad 0.7
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
          const base64Data = compressedBase64.split(',')[1];

          // Logs de depuración de tamaño
          const originalSize = (event.target?.result as string).length;
          const compressedSize = compressedBase64.length;
          const reduction = Math.round((1 - (compressedSize / originalSize)) * 100);
          
          console.log(`[Compresión] ${file.name}: ${Math.round(originalSize/1024)}KB -> ${Math.round(compressedSize/1024)}KB (${reduction}% menos)`);

          resolve({
            mimeType: 'image/jpeg',
            data: base64Data
          });
        };
        img.onerror = () => reject(new Error(`Error al cargar la imagen ${file.name}`));
      };
      reader.onerror = () => reject(new Error(`Error al leer el archivo ${file.name}`));
    });
  };

  // --- Actions ---
  const handleAnalyzeFiles = async () => {
    if (!cvFile && certFiles.length === 0) {
      setError("Por favor sube al menos un archivo para analizar.");
      return;
    }

    if (!isStep1Complete) {
      setError("Debes completar el Paso 1: Cargo Objetivo.");
      return;
    }

    setStatus('analyzing');
    setError(null);

    try {
      console.log('1. Archivos recibidos: Iniciando flujo de optimización...');

      const allFiles: File[] = [];
      if (cvFile) allFiles.push(cvFile);
      if (certFiles.length > 0) allFiles.push(...certFiles);

      // B. Procesamiento inteligente: Comprimir si es imagen, lectura normal si es PDF
      const processingPromises = allFiles.map(file => {
        if (file.type.startsWith('image/')) {
          return compressImage(file);
        } else {
          return fileToGenerativePart(file);
        }
      });

      console.log(`   -> Procesando ${allFiles.length} archivos en paralelo...`);

      // C. Esperar a que todos los archivos (comprimidos o no) estén listos
      const processedParts = await Promise.all(processingPromises);

      console.log('2. Conversión y compresión completadas. Payload optimizado listo.');
      console.log('3. Enviando a API de Gemini...');

      // D. Llamada a la API
      const parsedData = await analyzeDocuments(processedParts, targetJob);
      
      console.log('4. Análisis finalizado con éxito.');

      // E. Actualización del estado
      setCvData(prev => ({
        ...prev,
        ...parsedData,
        experience: parsedData.experience || [],
        education: parsedData.education || [],
        skills: parsedData.skills || [],
        certifications: parsedData.certifications || []
      }));
      
    } catch (err: any) {
      console.error("Error crítico en análisis:", err);
      setError(`Error: ${err.message || "Ocurrió un problema al procesar los archivos."}`);
    } finally {
      setStatus('idle');
    }
  };

  const handleImproveRedaction = async (type: 'summary' | 'experience', id: string, text: string) => {
    if (!targetJob.trim()) {
      setError("Ingresa un Cargo Objetivo (Paso 1) para que la IA sepa cómo optimizar el texto.");
      // Scroll to top or highlight step 1 could be added here
      return;
    }

    if (!text || text.trim().length < 5) {
      // Don't improve empty text
      return;
    }

    // Set loading state for specific field
    setOptimizingField(id);
    setError(null);

    try {
      const improvedText = await improveWriting(text, targetJob, type);
      
      if (type === 'summary') {
        updateField('summary', improvedText);
      } else {
        updateArrayItem('experience', id, 'description', improvedText);
      }
    } catch (err) {
      console.error("Failed to improve text", err);
      setError("No se pudo mejorar la redacción. Intenta nuevamente.");
    } finally {
      setOptimizingField(null);
    }
  };

  const handleRegenerateSummary = async () => {
    if (!targetJob.trim()) {
      setError("Ingresa un Cargo Objetivo (Paso 1) para sincronizar el resumen.");
      return;
    }

    if (cvData.experience.length === 0) {
      setError("Necesitas agregar Experiencia Laboral antes de sincronizar el resumen.");
      return;
    }

    setOptimizingField('summary-regen');
    setError(null);

    try {
      // Updated to pass the full cvData object
      const newSummary = await regenerateSummary(cvData, targetJob);
      updateField('summary', newSummary);
    } catch (err) {
      console.error("Failed to regenerate summary", err);
      setError("No se pudo sincronizar el resumen. Intenta nuevamente.");
    } finally {
      setOptimizingField(null);
    }
  };

  const handleDownloadPDF = () => {
    generatePDF(cvData);
  };

  const handleDownloadDOCX = () => {
    generateDOCX(cvData);
  };

  // --- Form Helpers ---
  const updateField = (section: keyof CVProfile, value: any) => {
    setCvData(prev => ({ ...prev, [section]: value }));
  };

  const updateArrayItem = <T extends { id: string }>(
    section: keyof Pick<CVProfile, 'experience' | 'education' | 'certifications'>,
    id: string,
    field: string,
    value: string
  ) => {
    setCvData(prev => ({
      ...prev,
      [section]: (prev[section] as any[]).map(item => 
        item.id === id ? { ...item, [field]: value } : item
      )
    }));
  };

  const addItem = (section: 'experience' | 'education' | 'certifications') => {
    const id = Date.now().toString();
    const newItems: any = {
      experience: { id, role: '', company: '', startDate: '', endDate: '', description: '' },
      education: { id, degree: '', school: '', year: '' },
      certifications: { id, name: '', issuer: '', year: '' }
    };
    
    setCvData(prev => ({
      ...prev,
      [section]: [...prev[section], newItems[section]]
    }));
  };

  const removeItem = (section: keyof CVProfile, id: string) => {
    setCvData(prev => ({
      ...prev,
      [section]: (prev[section] as any[]).filter((item: any) => item.id !== id)
    }));
  };

  const updateSkill = (index: number, value: string) => {
    const newSkills = [...cvData.skills];
    newSkills[index] = value;
    setCvData(prev => ({ ...prev, skills: newSkills }));
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Layout className="text-indigo-600 w-8 h-8" />
            <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
              CV-Architect SaaS
            </h1>
          </div>
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => setShowPreview(true)}
              className="flex items-center space-x-2 text-slate-600 hover:text-indigo-600 font-medium transition-colors bg-gray-50 hover:bg-gray-100 px-4 py-2 rounded-lg"
            >
              <Eye size={20} />
              <span className="hidden sm:inline">Vista Previa</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-r shadow-sm flex items-center animate-fadeIn">
            <span className="mr-2">⚠️</span> {error}
          </div>
        )}

        {/* STEP 1: TARGET JOB */}
        <div className="mb-10 bg-white rounded-2xl shadow-sm border border-indigo-100 p-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-2 h-full bg-indigo-600"></div>
          <div className="relative z-10">
            <label className="block text-indigo-900 font-bold text-lg mb-3 flex items-center">
              <span className="bg-indigo-600 text-white w-8 h-8 rounded-full flex items-center justify-center mr-3 text-sm">1</span>
              Paso 1: ¿A qué cargo quieres postular?
            </label>
            <div className="relative">
              <input 
                type="text"
                value={targetJob}
                onChange={(e) => setTargetJob(e.target.value)}
                placeholder="Ej. Gerente de Proyectos TI, Desarrollador Full Stack..."
                className="w-full text-xl md:text-2xl p-4 pl-6 bg-white text-gray-900 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 transition-all placeholder:text-gray-300 font-medium outline-none"
              />
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400">
                {isStep1Complete ? <CheckCircle className="text-green-500 w-6 h-6" /> : <Briefcase className="w-6 h-6" />}
              </div>
            </div>
            <p className="mt-3 text-slate-500 text-sm ml-11">
              La IA reescribirá tu CV para ajustarse a este cargo específico.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column */}
          <div className="lg:col-span-4 space-y-6">
            
            <div className={`relative transition-all duration-500 ${!isStep1Complete ? 'opacity-50 grayscale select-none' : 'opacity-100'}`}>
              {!isStep1Complete && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/50 backdrop-blur-[1px] rounded-xl border-2 border-gray-200 border-dashed">
                  <Lock className="w-10 h-10 text-gray-400 mb-2" />
                  <p className="text-gray-500 font-medium text-center px-4">Completa el Paso 1 para desbloquear</p>
                </div>
              )}

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h2 className="text-lg font-bold mb-4 flex items-center text-gray-800">
                  <span className="bg-slate-800 text-white w-8 h-8 rounded-full flex items-center justify-center mr-3 text-sm">2</span>
                  Sube tus documentos
                </h2>
                
                <div className="space-y-4">
                  <FileUpload 
                    label="CV (PDF/Word)" 
                    accept=".pdf,.doc,.docx"
                    onFileSelect={(files) => setCvFile(files[0] || null)}
                    isLoading={status !== 'idle' || !isStep1Complete}
                  />
                  
                  <FileUpload 
                    label="Certificados (Imágenes/PDF)" 
                    accept=".jpg,.png,.jpeg,.pdf"
                    onFileSelect={(files) => setCertFiles(files)}
                    multiple={true}
                    isLoading={status !== 'idle' || !isStep1Complete}
                  />

                  <button
                    onClick={handleAnalyzeFiles}
                    disabled={status !== 'idle' || (!cvFile && certFiles.length === 0) || !isStep1Complete}
                    className="w-full mt-4 bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 px-4 rounded-lg shadow transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed group"
                  >
                    {status === 'analyzing' ? (
                      <>
                        <Loader2 className="animate-spin mr-2" /> Analizando...
                      </>
                    ) : (
                      <>
                        <Search className="mr-2 w-5 h-5 group-hover:scale-110 transition-transform" /> 
                        Procesar con IA
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

          </div>

          {/* Right Column */}
          <div className="lg:col-span-8">
            <div className="space-y-2">
              
              <CVSection title="Información Personal" icon={<User className="w-5 h-5" />} defaultOpen={true}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input label="Nombre Completo" value={cvData.fullName} onChange={e => updateField('fullName', e.target.value)} />
                  <Input label="Email" value={cvData.email} onChange={e => updateField('email', e.target.value)} />
                  <Input label="Teléfono" value={cvData.phone} onChange={e => updateField('phone', e.target.value)} />
                  <Input label="LinkedIn" value={cvData.linkedin} onChange={e => updateField('linkedin', e.target.value)} />
                  <Input label="Ubicación" className="md:col-span-2" value={cvData.location} onChange={e => updateField('location', e.target.value)} />
                </div>
                
                <div className="mt-6">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-2 gap-2">
                    <label className="block text-sm font-medium text-gray-700">Resumen Profesional</label>
                    
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={handleRegenerateSummary}
                        disabled={optimizingField === 'summary-regen'}
                        title="Sincronizar resumen con experiencia actual"
                        className="text-xs font-semibold text-orange-600 hover:text-orange-800 bg-orange-50 hover:bg-orange-100 px-3 py-1 rounded-full transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed border border-orange-200"
                      >
                         {optimizingField === 'summary-regen' ? (
                          <Loader2 className="animate-spin w-3 h-3 mr-1" /> 
                        ) : (
                          <RefreshCw className="w-3 h-3 mr-1" />
                        )}
                        <span className="hidden sm:inline">Sincronizar con Experiencia</span>
                        <span className="sm:hidden">Sincronizar</span>
                      </button>

                      <button
                        onClick={() => handleImproveRedaction('summary', 'summary', cvData.summary)}
                        disabled={optimizingField === 'summary'}
                        title="Mejorar redacción del texto actual"
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1 rounded-full transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed border border-indigo-200"
                      >
                        {optimizingField === 'summary' ? (
                          <Loader2 className="animate-spin w-3 h-3 mr-1" />
                        ) : (
                          <Sparkles className="w-3 h-3 mr-1" />
                        )}
                         <span className="hidden sm:inline">Mejorar Redacción</span>
                         <span className="sm:hidden">Mejorar</span>
                      </button>
                    </div>
                  </div>
                  <textarea 
                    className="w-full px-4 py-2 bg-white text-gray-900 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all min-h-[128px]"
                    value={cvData.summary} 
                    onChange={e => updateField('summary', e.target.value)} 
                  />
                </div>
              </CVSection>

              <CVSection title="Experiencia Laboral" icon={<Briefcase className="w-5 h-5" />}>
                {cvData.experience.map((exp) => (
                  <div key={exp.id} className="relative p-4 mb-6 bg-white rounded-lg border border-gray-200 shadow-sm group">
                    <button 
                      onClick={() => removeItem('experience', exp.id)}
                      className="absolute top-2 right-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={18} />
                    </button>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                      <Input label="Cargo" value={exp.role} onChange={e => updateArrayItem<Experience>('experience', exp.id, 'role', e.target.value)} />
                      <Input label="Empresa" value={exp.company} onChange={e => updateArrayItem<Experience>('experience', exp.id, 'company', e.target.value)} />
                      <Input label="Inicio" value={exp.startDate} onChange={e => updateArrayItem<Experience>('experience', exp.id, 'startDate', e.target.value)} />
                      <Input label="Fin" value={exp.endDate} onChange={e => updateArrayItem<Experience>('experience', exp.id, 'endDate', e.target.value)} />
                    </div>
                    
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="block text-sm font-medium text-gray-700">Descripción</label>
                        <button
                          onClick={() => handleImproveRedaction('experience', exp.id, exp.description)}
                          disabled={optimizingField === exp.id}
                          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1 rounded-full transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {optimizingField === exp.id ? (
                            <>
                              <Loader2 className="animate-spin w-3 h-3 mr-1" /> Mejorando...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3 h-3 mr-1" /> Mejorar Redacción con IA
                            </>
                          )}
                        </button>
                      </div>
                      <textarea 
                        className="w-full px-4 py-2 bg-white text-gray-900 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all min-h-[112px] text-sm"
                        value={exp.description} 
                        onChange={e => updateArrayItem<Experience>('experience', exp.id, 'description', e.target.value)}
                      />
                    </div>
                  </div>
                ))}
                <button onClick={() => addItem('experience')} className="w-full py-2 border-2 border-dashed border-indigo-200 text-indigo-600 rounded-lg hover:bg-indigo-50 font-medium flex items-center justify-center">
                  <Plus size={18} className="mr-2" /> Agregar Experiencia
                </button>
              </CVSection>

              <CVSection title="Educación" icon={<GraduationCap className="w-5 h-5" />}>
                {cvData.education.map((edu) => (
                  <div key={edu.id} className="relative p-4 mb-4 bg-white rounded-lg border border-gray-200 shadow-sm group">
                    <button onClick={() => removeItem('education', edu.id)} className="absolute top-2 right-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 size={18} />
                    </button>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Input label="Título" value={edu.degree} onChange={e => updateArrayItem<Education>('education', edu.id, 'degree', e.target.value)} />
                      <Input label="Escuela" value={edu.school} onChange={e => updateArrayItem<Education>('education', edu.id, 'school', e.target.value)} />
                      <Input label="Año" value={edu.year} onChange={e => updateArrayItem<Education>('education', edu.id, 'year', e.target.value)} />
                    </div>
                  </div>
                ))}
                <button onClick={() => addItem('education')} className="w-full py-2 border-2 border-dashed border-indigo-200 text-indigo-600 rounded-lg hover:bg-indigo-50 font-medium flex items-center justify-center">
                  <Plus size={18} className="mr-2" /> Agregar Educación
                </button>
              </CVSection>

              <CVSection title="Habilidades" icon={<Zap className="w-5 h-5" />}>
                <div className="flex flex-wrap gap-2 mb-4">
                  {cvData.skills.map((skill, idx) => (
                    <div key={idx} className="flex items-center">
                      <input 
                        value={skill}
                        onChange={(e) => updateSkill(idx, e.target.value)}
                        className="bg-white border border-gray-300 text-gray-900 text-sm rounded-full px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[100px]"
                      />
                      <button onClick={() => setCvData(prev => ({...prev, skills: prev.skills.filter((_, i) => i !== idx)}))} className="ml-1 text-gray-400 hover:text-red-500">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <button onClick={() => setCvData(prev => ({...prev, skills: [...prev.skills, 'Nueva habilidad']}))} className="text-sm text-indigo-600 font-medium flex items-center">
                  <Plus size={14} className="mr-1" /> Agregar Habilidad
                </button>
              </CVSection>

              <CVSection title="Certificaciones" icon={<Award className="w-5 h-5" />}>
                {cvData.certifications.map((cert) => (
                  <div key={cert.id} className="relative p-4 mb-4 bg-white rounded-lg border border-gray-200 shadow-sm group">
                    <button onClick={() => removeItem('certifications', cert.id)} className="absolute top-2 right-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 size={18} />
                    </button>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Input label="Nombre" value={cert.name} onChange={e => updateArrayItem<Certification>('certifications', cert.id, 'name', e.target.value)} />
                      <Input label="Emisor" value={cert.issuer} onChange={e => updateArrayItem<Certification>('certifications', cert.id, 'issuer', e.target.value)} />
                      <Input label="Año" value={cert.year} onChange={e => updateArrayItem<Certification>('certifications', cert.id, 'year', e.target.value)} />
                    </div>
                  </div>
                ))}
                <button onClick={() => addItem('certifications')} className="w-full py-2 border-2 border-dashed border-indigo-200 text-indigo-600 rounded-lg hover:bg-indigo-50 font-medium flex items-center justify-center">
                  <Plus size={18} className="mr-2" /> Agregar Certificación
                </button>
              </CVSection>

              <div className="mt-8 p-6 bg-slate-800 rounded-xl text-white shadow-lg flex flex-col md:flex-row items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold">¿Listo para descargar?</h3>
                  <p className="text-slate-300 text-sm">Previsualiza el diseño final antes de exportar.</p>
                </div>
                <button 
                  onClick={() => setShowPreview(true)}
                  className="mt-4 md:mt-0 bg-white text-slate-900 hover:bg-indigo-50 font-bold py-3 px-6 rounded-lg shadow-lg flex items-center"
                >
                  <Eye className="mr-2 w-5 h-5 text-indigo-600" />
                  Vista Previa
                </button>
              </div>

            </div>
          </div>
        </div>
      </main>

      {showPreview && (
        <PreviewModal 
          data={cvData} 
          onClose={() => setShowPreview(false)} 
          onDownloadPDF={handleDownloadPDF} 
          onDownloadDOCX={handleDownloadDOCX}
        />
      )}
    </div>
  );
};

export default App;