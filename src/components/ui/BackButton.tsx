import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface BackButtonProps {
  fallbackPath?: string;
  onClick?: () => void;
  className?: string;
}

export default function BackButton({ fallbackPath = '/', onClick, className }: BackButtonProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onClick) {
      onClick();
    } else {
      // Check if there is history to go back to within our app router session
      if (typeof window !== 'undefined' && window.history && window.history.state && window.history.state.idx > 0) {
        navigate(-1);
      } else {
        navigate(fallbackPath);
      }
    }
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      className={`group flex items-center gap-2 px-4 py-2 text-xs font-black text-[#1457D9] bg-white hover:bg-blue-50 border border-blue-200 hover:border-[#1457D9] rounded-xl shadow-sm hover:shadow transition-all duration-200 shrink-0 select-none ${className || ''}`}
    >
      <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-0.5 text-[#1457D9]" />
      <span className="uppercase tracking-wider">← QUAY LẠI</span>
    </button>
  );
}
