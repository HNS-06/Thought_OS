import { Brain, Mic, Plus, Minus, Search, Maximize2, Share2, Target, Hand, MousePointer2 } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useState, useRef, useEffect } from 'react';
import { socket } from '../lib/socket';

// ── ThoughtInput ──────────────────────────────────────────────────────────────
export function ThoughtInput({ activeProjectId = 'default' }: { activeProjectId?: string }) {
  const [text, setText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setText(prev => (prev ? prev + ' ' + transcript : transcript));
        setIsListening(false);
      };
      recognitionRef.current.onerror = () => setIsListening(false);
      recognitionRef.current.onend = () => setIsListening(false);
    }
  }, []);

  const toggleListen = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const handleSync = () => {
    if (!text.trim()) return;
    socket.emit('node_create', {
      title: text.trim(),
      x: 30 + Math.random() * 40,
      y: 20 + Math.random() * 40,
      projectId: activeProjectId,
    });
    setText('');
  };

  return (
    /* z-[200] guarantees nothing overlaps the input bar */
    <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[200] w-full max-w-2xl px-4 md:px-6">
      <div className="relative flex items-center bg-surface border-2 border-outline rounded-xl p-1.5 md:p-2 shadow-[4px_4px_0px_0px_var(--color-outline)] transition-colors duration-300">
        <div className="pl-2 md:pl-4 text-on-surface flex items-center pointer-events-none">
          <Brain className="w-4 md:w-5 h-4 md:h-5" />
        </div>
        <input
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSync(); }}
          placeholder="New memory…"
          className="w-full bg-transparent border-none py-3 md:py-4 pl-3 md:pl-4 pr-28 md:pr-32 text-on-surface focus:ring-0 font-bold uppercase text-[10px] md:text-xs placeholder:text-on-surface-variant/40"
        />
        <div className="absolute right-2 md:right-4 flex items-center gap-1 md:gap-2">
          <button
            onClick={toggleListen}
            className={cn(
              "p-1.5 md:p-2 border border-outline rounded-lg transition-all hidden sm:block",
              isListening ? "bg-error text-white animate-pulse" : "hover:bg-surface-container-high text-on-surface"
            )}
          >
            <Mic className="w-3.5 md:w-4 h-3.5 md:h-4" />
          </button>
          <button
            onClick={handleSync}
            className="px-4 md:px-6 py-2 md:py-2.5 bg-on-surface text-surface border border-outline rounded-lg font-black text-[9px] md:text-[10px] uppercase tracking-widest hover:bg-primary hover:text-white hover:border-primary transition-all"
          >
            Sync
          </button>
        </div>
      </div>
    </div>
  );
}

// ── MiniMap ───────────────────────────────────────────────────────────────────
export function MiniMap({ scale = 1, setScale }: { scale?: number; setScale?: (s: number) => void }) {
  return (
    /* z-[100] sits above canvas but below input bar */
    <div className="fixed bottom-28 right-6 z-[100] group hidden lg:block">
      <div className="relative w-44 h-28 bg-surface border border-outline rounded-xl overflow-hidden shadow-[4px_4px_0px_0px_var(--color-outline)] transition-colors duration-300">
        <div className="absolute inset-0 p-2 opacity-10 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]">
          <div className="absolute top-4 left-4 w-1.5 h-1.5 bg-on-surface rounded-full" />
          <div className="absolute top-10 left-12 w-2 h-2 bg-primary rounded-full" />
          <div className="absolute top-20 left-6 w-1 h-1 bg-on-surface rounded-full" />
        </div>
        <div className="absolute inset-0 flex items-end p-3">
          <div className="flex justify-between w-full items-center">
            <span className="text-[9px] font-black text-on-surface uppercase tracking-widest">Map_v2.0</span>
            <span className="text-[9px] text-primary font-black uppercase">Stable</span>
          </div>
        </div>
      </div>

      <div className="absolute -top-[44px] left-0 flex gap-2">
        <button
          onClick={() => setScale?.(Math.min(scale + 0.15, 2.5))}
          className="w-10 h-10 bg-surface border border-outline rounded-lg flex items-center justify-center text-on-surface hover:bg-primary hover:text-white transition-all shadow-[2px_2px_0px_0px_var(--color-outline)]"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          onClick={() => setScale?.(Math.max(scale - 0.15, 0.4))}
          className="w-10 h-10 bg-surface border border-outline rounded-lg flex items-center justify-center text-on-surface hover:bg-primary hover:text-white transition-all shadow-[2px_2px_0px_0px_var(--color-outline)]"
        >
          <Minus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ── InteractionPalette ────────────────────────────────────────────────────────
export function InteractionPalette({
  onResetZoom,
  isPanMode,
  onTogglePan,
}: {
  onResetZoom?: () => void;
  isPanMode?: boolean;
  onTogglePan?: () => void;
}) {
  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({ title: 'Thought.OS', url: window.location.href });
    } else {
      await navigator.clipboard.writeText(window.location.href);
      // brief toast — just use alert for now
    }
  };

  return (
    <div className={cn(
      "fixed z-[100] flex gap-3 md:gap-4 transition-all duration-300",
      "bottom-28 left-4 md:bottom-auto md:top-1/2 md:-translate-y-1/2 md:right-6 md:flex-col md:left-auto"
    )}>
      <button
        onClick={onTogglePan}
        title={isPanMode ? "Switch to select mode" : "Switch to pan mode"}
        className={cn(
          "w-10 h-10 md:w-12 md:h-12 border rounded-xl flex items-center justify-center transition-all shadow-[4px_4px_0px_0px_var(--color-outline)]",
          isPanMode
            ? "bg-primary border-primary text-white"
            : "bg-surface border-outline text-on-surface hover:bg-primary hover:text-white hover:border-primary"
        )}
      >
        {isPanMode ? <Hand className="w-4 md:w-5 h-4 md:h-5" /> : <MousePointer2 className="w-4 md:w-5 h-4 md:h-5" />}
      </button>
      <button
        onClick={handleFullscreen}
        className="w-10 h-10 md:w-12 md:h-12 bg-surface border border-outline rounded-xl flex items-center justify-center text-on-surface hover:bg-primary hover:text-white hover:border-primary transition-all shadow-[4px_4px_0px_0px_var(--color-outline)]"
      >
        <Maximize2 className="w-4 md:w-5 h-4 md:h-5" />
      </button>
      <button
        onClick={handleShare}
        className="w-10 h-10 md:w-12 md:h-12 bg-surface border border-outline rounded-xl flex items-center justify-center text-on-surface hover:bg-primary hover:text-white hover:border-primary transition-all shadow-[4px_4px_0px_0px_var(--color-outline)]"
      >
        <Share2 className="w-4 md:w-5 h-4 md:h-5" />
      </button>
      <button
        onClick={onResetZoom}
        className="w-10 h-10 md:w-12 md:h-12 bg-surface border border-outline rounded-xl flex items-center justify-center text-on-surface hover:bg-primary hover:text-white hover:border-primary transition-all shadow-[4px_4px_0px_0px_var(--color-outline)]"
      >
        <Target className="w-4 md:w-5 h-4 md:h-5" />
      </button>
      <div className="hidden md:block h-[1px] w-8 mx-auto bg-on-surface/10" />
      <button
        onClick={() => document.querySelector<HTMLInputElement>("input[placeholder='Search...']")?.focus()}
        className="w-10 h-10 md:w-12 md:h-12 bg-surface border border-outline rounded-xl flex items-center justify-center text-error hover:bg-error hover:text-white transition-all shadow-[4px_4px_0px_0px_var(--color-outline)]"
      >
        <Search className="w-4 md:w-5 h-4 md:h-5" />
      </button>
    </div>
  );
}
