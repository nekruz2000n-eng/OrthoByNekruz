"use client";

import React from 'react';
import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const PREVIEW_AWAITING_CONFIRM_KEY = 'preview_awaiting_confirm';

interface AccessWelcomeOverlayProps {
  onContinue: () => void;
}

export const AccessWelcomeOverlay: React.FC<AccessWelcomeOverlayProps> = ({ onContinue }) => (
  <div
    className="dark fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-xl animate-in fade-in zoom-in duration-300"
    style={{ background: 'rgba(10,14,12,0.88)' }}
  >
    <div className="w-full max-w-sm bg-[#121815] border border-white/10 p-8 rounded-[32px] shadow-2xl text-center space-y-5">
      <div className="inline-flex p-3 bg-primary/10 rounded-full text-primary">
        <Heart className="w-8 h-8 fill-primary/20" />
      </div>
      <div className="space-y-3">
        <h2 className="text-2xl font-bold tracking-tight text-white">Доступ открыт!</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Учись, развивайся — и пользуйся мини-приложением по полной.
        </p>
        <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.72)' }}>
          Дальше всё зависит от тебя: заходи, решай, закрепляй. Если оплатил, но не будешь
          пользоваться приложением — деньги уйдут впустую, а прогресс встанет.
        </p>
      </div>
      <Button
        onClick={onContinue}
        className="w-full h-14 rounded-2xl text-lg font-bold"
      >
        Погнали!
      </Button>
    </div>
  </div>
);
