'use client';
import { useState } from 'react';

export default function GlossaryTerm({ term, definition }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Кликабельный термин в тексте */}
      <span 
        onClick={() => setIsOpen(true)}
        className="text-blue-500 underline cursor-pointer hover:text-blue-700 transition-colors"
      >
        {term}
      </span>

      {/* Окно глоссария, которое ВСЕГДА в пределах экрана */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4"
          onClick={() => setIsOpen(false)} // Закрытие при клике на фон
        >
          <div 
            className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md p-6 relative flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()} // Предотвращаем закрытие при клике на само окно
          >
            {/* Кнопка закрытия (крестик) */}
            <button 
              onClick={() => setIsOpen(false)}
              className="absolute top-3 right-4 text-gray-500 hover:text-gray-800 dark:hover:text-white text-2xl font-bold"
            >
              &times;
            </button>

            {/* Контент глоссария с авто-скроллом, если текст длинный */}
            <div className="overflow-y-auto pr-2">
              <h3 className="text-xl font-bold mb-3 text-gray-900 dark:text-white border-b pb-2">
                {term}
              </h3>
              <div className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                {definition}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}