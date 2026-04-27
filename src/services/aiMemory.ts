/**
 * AI Memory Layer — persists user context across sessions.
 * Tracks domain, level, and behavior for adaptive AI responses.
 */

const MEMORY_KEY = 'thought_canvas_ai_memory';

export type UserDomain = 'school' | 'engineering' | 'medical' | 'business' | 'research' | 'general';
export type UserLevel = 'beginner' | 'intermediate' | 'advanced';

export interface AIMemory {
  domain: UserDomain;
  userLevel: UserLevel;
  sessionTopics: string[];
  expandedNodes: string[];
  lastInsightTime: number;
  totalInteractions: number;
  preferredDomains: Record<UserDomain, number>;
}

const DEFAULT_MEMORY: AIMemory = {
  domain: 'general',
  userLevel: 'intermediate',
  sessionTopics: [],
  expandedNodes: [],
  lastInsightTime: 0,
  totalInteractions: 0,
  preferredDomains: {
    general: 0, school: 0, engineering: 0,
    medical: 0, business: 0, research: 0
  }
};

export const aiMemory = {
  get(): AIMemory {
    try {
      const stored = localStorage.getItem(MEMORY_KEY);
      if (stored) return { ...DEFAULT_MEMORY, ...JSON.parse(stored) };
    } catch { /* noop */ }
    return { ...DEFAULT_MEMORY };
  },

  set(updates: Partial<AIMemory>): void {
    try {
      const current = this.get();
      localStorage.setItem(MEMORY_KEY, JSON.stringify({ ...current, ...updates }));
    } catch { /* noop */ }
  },

  recordNodeExpansion(nodeTitle: string, domain: UserDomain): void {
    const mem = this.get();
    mem.expandedNodes = [...new Set([...mem.expandedNodes, nodeTitle])].slice(-20);
    mem.sessionTopics = [...new Set([...mem.sessionTopics, nodeTitle])].slice(-30);
    mem.totalInteractions++;
    if (mem.preferredDomains[domain] !== undefined) {
      mem.preferredDomains[domain]++;
      const topDomain = Object.entries(mem.preferredDomains)
        .sort(([, a], [, b]) => (b as number) - (a as number))[0][0] as UserDomain;
      mem.domain = topDomain;
    }
    this.set(mem);
  },

  recordAIInteraction(): void {
    const mem = this.get();
    mem.totalInteractions++;
    // Auto-upgrade user level based on interactions
    if (mem.totalInteractions > 50) mem.userLevel = 'advanced';
    else if (mem.totalInteractions > 15) mem.userLevel = 'intermediate';
    this.set(mem);
  },

  setUserLevel(level: UserLevel): void {
    this.set({ userLevel: level });
  },

  shouldShowInsights(): boolean {
    const mem = this.get();
    return Date.now() - mem.lastInsightTime > 60_000; // max once per minute
  },

  markInsightShown(): void {
    this.set({ lastInsightTime: Date.now() });
  },

  reset(): void {
    localStorage.removeItem(MEMORY_KEY);
  }
};
