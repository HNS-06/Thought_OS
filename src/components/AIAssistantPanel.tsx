import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Brain, Send, X, Minimize2, Maximize2, Sparkles, Loader2, User, Trash2, BookOpen } from 'lucide-react';
import { askAIAssistant } from '../services/gemini';
import { aiMemory } from '../services/aiMemory';
import { cn } from '../lib/utils';
import type { ThoughtNode, AnchorConnection } from '../types';

interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: number;
}

interface AIAssistantPanelProps {
  nodes: ThoughtNode[];
  anchorConnections: AnchorConnection[];
  isOpen: boolean;
  onClose: () => void;
}

export function AIAssistantPanel({ nodes, anchorConnections, isOpen, onClose }: AIAssistantPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'ai',
      content: `Hi! I'm your AI thinking assistant. I can see your entire mind map and help you:\n• Explore connections between concepts\n• Find missing topics\n• Explain any node in depth\n• Suggest improvements\n\nWhat would you like to explore?`,
      timestamp: Date.now()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Build map context string for AI
  const buildMapContext = useCallback(() => {
    const nodeList = nodes.map(n =>
      `- "${n.title}" [${n.type}]${n.description ? `: ${n.description}` : ''}${n.tags?.length ? ` (tags: ${n.tags.join(', ')})` : ''}`
    ).join('\n');

    const connList = anchorConnections.map(c => {
      const from = nodes.find(n => n.id === c.fromNodeId)?.title || c.fromNodeId;
      const to = nodes.find(n => n.id === c.toNodeId)?.title || c.toNodeId;
      return `${from} → ${to}`;
    }).join(', ');

    return `Nodes (${nodes.length} total):\n${nodeList || 'No nodes yet'}\n\nConnections: ${connList || 'None yet'}`;
  }, [nodes, anchorConnections]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    aiMemory.recordAIInteraction();

    const history = messages.slice(-6).map(m => ({ role: m.role, content: m.content }));
    const mapContext = buildMapContext();

    const response = await askAIAssistant(input.trim(), mapContext, history);

    const aiMsg: Message = {
      id: `ai-${Date.now()}`,
      role: 'ai',
      content: response,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, aiMsg]);
    setIsLoading(false);
  }, [input, isLoading, messages, buildMapContext]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const quickPrompts = [
    "What topics am I missing?",
    "How are my nodes connected?",
    "Suggest 3 improvements",
    "Summarize my map"
  ];

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 50, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 50, scale: 0.95 }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className={cn(
        "fixed right-24 md:right-28 z-[200] flex flex-col bg-surface border-2 border-outline shadow-[6px_6px_0px_0px_var(--color-outline)]",
        "rounded-2xl overflow-hidden transition-all duration-300",
        isMinimized ? "bottom-6 w-72 h-14" : "bottom-6 w-80 md:w-96 h-[520px]"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-primary border-b-2 border-outline shrink-0">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Brain className="w-4 h-4 text-white" />
            <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          </div>
          <span className="text-[10px] text-white font-black uppercase tracking-widest">AI Assistant</span>
          <span className="text-[8px] text-white/60 font-bold uppercase bg-white/10 px-1.5 py-0.5 rounded">
            {nodes.length} nodes in context
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(v => !v)}
            className="w-6 h-6 rounded flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            {isMinimized ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
          </button>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin">
            {messages.map(msg => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn("flex gap-2", msg.role === 'user' ? "flex-row-reverse" : "flex-row")}
              >
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                  msg.role === 'ai' ? "bg-primary/10 border border-primary/30" : "bg-on-surface/10 border border-outline"
                )}>
                  {msg.role === 'ai'
                    ? <Sparkles className="w-3 h-3 text-primary" />
                    : <User className="w-3 h-3 text-on-surface-variant" />
                  }
                </div>
                <div className={cn(
                  "max-w-[85%] p-2.5 rounded-xl text-xs font-medium leading-relaxed",
                  msg.role === 'ai'
                    ? "bg-surface-container-low border border-outline text-on-surface"
                    : "bg-primary text-white"
                )}>
                  {msg.content.split('\n').map((line, i) => (
                    <span key={i}>{line}{i < msg.content.split('\n').length - 1 && <br />}</span>
                  ))}
                </div>
              </motion.div>
            ))}

            {isLoading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2">
                <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 bg-primary/10 border border-primary/30">
                  <Sparkles className="w-3 h-3 text-primary" />
                </div>
                <div className="bg-surface-container-low border border-outline rounded-xl px-3 py-2 flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 text-primary animate-spin" />
                  <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Thinking...</span>
                </div>
              </motion.div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts */}
          {messages.length <= 2 && (
            <div className="px-3 pb-2 flex flex-wrap gap-1.5 shrink-0">
              {quickPrompts.map(prompt => (
                <button
                  key={prompt}
                  onClick={() => { setInput(prompt); inputRef.current?.focus(); }}
                  className="text-[9px] px-2 py-1 bg-primary/5 border border-primary/20 rounded-full text-primary font-bold hover:bg-primary/10 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="p-3 border-t border-outline shrink-0">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your map..."
                className="flex-1 text-xs bg-surface-container-low border border-outline rounded-lg px-3 py-2 text-on-surface outline-none focus:border-primary transition-colors placeholder:text-on-surface-variant/50"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="w-8 h-8 bg-primary text-white rounded-lg flex items-center justify-center hover:bg-primary/80 transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
}
