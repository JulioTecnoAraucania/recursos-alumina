import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface CVSectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export const CVSection: React.FC<CVSectionProps> = ({ title, icon, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6 transition-all hover:shadow-md">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-5 bg-slate-50 border-b border-slate-100 hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center space-x-3 text-slate-800">
          <span className="text-indigo-600">{icon}</span>
          <h2 className="font-bold text-lg">{title}</h2>
        </div>
        <span className="text-slate-400">
          {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </span>
      </button>
      
      {isOpen && (
        <div className="p-6 animate-fadeIn">
          {children}
        </div>
      )}
    </div>
  );
};
