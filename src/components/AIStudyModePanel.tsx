import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, X, Loader2, Sparkles, ChevronDown, ChevronUp, HelpCircle, Lightbulb, CreditCard } from 'lucide-react';
import { generateStudyContent, type StudyContent } from '../services/gemini';
import type { ThoughtNode } from '../types';
import { aiMemory, type UserLevel } from '../services/aiMemory';
import { cn } from '../lib/utils';

interface AIStudyModePanelProps {
  node: ThoughtNode;
  isOpen: boolean;
  onClose: () => void;
}

export function AIStudyModePanel({ node, isOpen, onClose }: AIStudyModePanelProps) {
  const [content, setContent] = useState<StudyContent | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'summary' | 'concepts' | 'questions' | 'flashcards'>('summary');
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [userLevel, setUserLevel] = useState<UserLevel>(aiMemory.get().userLevel);

  const handleLoad = async (level: UserLevel = userLevel) => {
    setIsLoading(true);
    setContent(null);
    const result = await generateStudyContent(
      node.title,
      node.description || '',
      node.tags || [],
      level
    );
    setContent(result);
    setIsLoading(false);
    aiMemory.setUserLevel(level);
    aiMemory.recordAIInteraction();
  };

  // Auto-load when opened
  React.useEffect(() => {
    if (isOpen && !content && !isLoading) {
      handleLoad();
    }
  }, [isOpen, node.id]);

  if (!isOpen) return null;

  const tabs = [
    { id: 'summary', label: 'Summary', icon: Lightbulb },
    { id: 'concepts', label: 'Concepts', icon: Sparkles },
    { id: 'questions', label: 'Questions', icon: HelpCircle },
    { id: 'flashcards', label: 'Flashcards', icon: CreditCard },
  ] as const;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="w-full h-full overflow-y-auto"
    >
      <div className="p-6 md:p-10 max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-black uppercase tracking-tight text-on-surface">{node.title}</h2>
              <p className="text-[9px] text-on-surface-variant uppercase font-bold tracking-widest">AI Study Mode</p>
            </div>
          </div>
          <button onClick={onClose} className="text-on-surface-variant hover:text-error transition-colors p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Level Selector */}
        <div className="flex gap-2 mb-6">
          {(['beginner', 'intermediate', 'advanced'] as UserLevel[]).map(level => (
            <button
              key={level}
              onClick={() => { setUserLevel(level); handleLoad(level); }}
              className={cn(
                "flex-1 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg border transition-all",
                userLevel === level
                  ? "bg-primary border-primary text-white"
                  : "bg-surface border-outline text-on-surface-variant hover:border-primary"
              )}
            >
              {level}
            </button>
          ))}
        </div>

        {isLoading && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-2 border-primary/20 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-primary animate-pulse" />
              </div>
              <div className="absolute inset-0 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
            <p className="text-xs font-black uppercase tracking-widest text-on-surface-variant">Generating Study Content...</p>
          </div>
        )}

        {content && !isLoading && (
          <>
            {/* Tabs */}
            <div className="flex gap-1 mb-6 bg-surface-container-low border border-outline p-1 rounded-xl">
              {tabs.map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all",
                      activeTab === tab.id
                        ? "bg-primary text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,0.1)]"
                        : "text-on-surface-variant hover:text-on-surface"
                    )}
                  >
                    <Icon className="w-3 h-3" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            <AnimatePresence mode="wait">
              {/* Summary Tab */}
              {activeTab === 'summary' && (
                <motion.div key="summary" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
                  <div className="p-5 bg-primary/5 border border-primary/20 rounded-xl">
                    <p className="text-sm text-on-surface leading-relaxed font-medium">{content.summary}</p>
                  </div>
                </motion.div>
              )}

              {/* Key Concepts Tab */}
              {activeTab === 'concepts' && (
                <motion.div key="concepts" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-3">
                  {content.key_concepts.map((concept, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.07 }}
                      className="flex items-start gap-3 p-4 bg-surface border border-outline rounded-xl shadow-[2px_2px_0px_0px_var(--color-outline)]"
                    >
                      <div className="w-6 h-6 rounded-full bg-primary text-white text-[9px] font-black flex items-center justify-center shrink-0 mt-0.5">
                        {i + 1}
                      </div>
                      <p className="text-sm text-on-surface font-medium leading-relaxed">{concept}</p>
                    </motion.div>
                  ))}
                </motion.div>
              )}

              {/* Questions Tab */}
              {activeTab === 'questions' && (
                <motion.div key="questions" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-3">
                  {content.questions.map((q, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.07 }}
                      className="flex items-start gap-3 p-4 bg-surface border border-outline rounded-xl shadow-[2px_2px_0px_0px_var(--color-outline)]"
                    >
                      <HelpCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <p className="text-sm text-on-surface font-medium">{q}</p>
                    </motion.div>
                  ))}
                </motion.div>
              )}

              {/* Flashcards Tab */}
              {activeTab === 'flashcards' && content.flashcards.length > 0 && (
                <motion.div key="flashcards" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
                  <div className="text-center mb-4">
                    <span className="text-[9px] text-on-surface-variant font-black uppercase tracking-widest">
                      Card {flashcardIndex + 1} of {content.flashcards.length}
                    </span>
                  </div>
                  <div
                    className="relative h-48 cursor-pointer"
                    onClick={() => setShowAnswer(v => !v)}
                  >
                    <motion.div
                      key={`${flashcardIndex}-${showAnswer}`}
                      initial={{ opacity: 0, rotateY: -90 }}
                      animate={{ opacity: 1, rotateY: 0 }}
                      transition={{ duration: 0.25 }}
                      className={cn(
                        "absolute inset-0 rounded-xl border-2 border-outline p-6 flex flex-col items-center justify-center text-center shadow-[4px_4px_0px_0px_var(--color-outline)]",
                        showAnswer ? "bg-primary/5 border-primary/30" : "bg-surface"
                      )}
                    >
                      <p className="text-[8px] font-black uppercase tracking-widest text-on-surface-variant mb-4">
                        {showAnswer ? 'Answer' : 'Question — tap to reveal'}
                      </p>
                      <p className="text-base font-bold text-on-surface">
                        {showAnswer ? content.flashcards[flashcardIndex].a : content.flashcards[flashcardIndex].q}
                      </p>
                    </motion.div>
                  </div>
                  <div className="flex gap-3 mt-4">
                    <button
                      onClick={() => { setFlashcardIndex(i => Math.max(0, i - 1)); setShowAnswer(false); }}
                      disabled={flashcardIndex === 0}
                      className="flex-1 py-2 bg-surface border border-outline rounded-lg text-[9px] font-black uppercase tracking-wider disabled:opacity-40"
                    >
                      ← Previous
                    </button>
                    <button
                      onClick={() => { setFlashcardIndex(i => Math.min(content.flashcards.length - 1, i + 1)); setShowAnswer(false); }}
                      disabled={flashcardIndex === content.flashcards.length - 1}
                      className="flex-1 py-2 bg-primary text-white rounded-lg text-[9px] font-black uppercase tracking-wider disabled:opacity-40"
                    >
                      Next →
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>
    </motion.div>
  );
}
