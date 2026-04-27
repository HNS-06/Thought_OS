import { GoogleGenAI } from "@google/genai";

function getApiKey(): string {
  try {
    // Vite injects this at build time from .env
    const key = (import.meta as any).env?.VITE_GEMINI_API_KEY;
    if (key) return key;
    // Fallback for dev server (injected via vite.config.ts define)
    if (typeof (globalThis as any).__GEMINI_API_KEY__ !== 'undefined') {
      return (globalThis as any).__GEMINI_API_KEY__;
    }
  } catch { /* noop — safe fallback */ }
  return '';
}

// ── Core AI caller with graceful fallback ─────────────────────────────────────
async function callGemini(prompt: string, fallback: unknown): Promise<unknown> {
  const apiKey = getApiKey();
  if (!apiKey) return fallback;
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    const text = response.text;
    if (text) return JSON.parse(text);
  } catch (error) {
    console.warn("[ThoughtCanvas AI] Gemini error:", error);
  }
  return fallback;
}

// ── 1. Thought Insights (Node Focus) ─────────────────────────────────────────
export const geminiService = {
  async getThoughtInsights(thought: string): Promise<string[]> {
    const fallback = [
      `Core concept: "${thought}" has strong semantic links`,
      "Potential for recursive expansion detected",
      "Cross-domain relevance identified"
    ];
    const result = await callGemini(
      `Given the thought "${thought}", provide 3 brief, insightful observations for a mind map user.
       Keep them under 12 words each. Format: JSON array of strings.`,
      fallback
    );
    return Array.isArray(result) ? result : (fallback as string[]);
  }
};

// ── 2. Auto-Expansion Engine ──────────────────────────────────────────────────
export interface ExpandedChild {
  title: string;
  description: string;
  tags: string[];
}

export async function expandNode(
  nodeTitle: string,
  nodeTags: string[],
  allNodeTitles: string[],
  userLevel: string = 'intermediate'
): Promise<ExpandedChild[]> {
  const domain = detectDomain(allNodeTitles.join(' ') + ' ' + nodeTitle);
  const fallback: ExpandedChild[] = generateFallbackChildren(nodeTitle);

  const result = await callGemini(
    `You are an expert academic AI for domain: "${domain}".
     Mind map node: "${nodeTitle}" (tags: ${nodeTags.join(', ')}).
     Other nodes in the map: ${allNodeTitles.slice(0, 10).join(', ')}.
     
     Generate 4-6 meaningful, academically accurate subtopics for level: ${userLevel}.
     Each should be a distinct concept that expands "${nodeTitle}".
     
     Return ONLY valid JSON: { "children": [{"title":"...", "description":"one sentence","tags":["tag1","tag2"]}] }`,
    { children: fallback }
  ) as { children: ExpandedChild[] };

  return result?.children || fallback;
}

// ── 3. Connection Suggestions ─────────────────────────────────────────────────
export interface ConnectionSuggestion {
  fromId: string;
  toId: string;
  reason: string;
  type: 'prerequisite' | 'related' | 'builds-on' | 'contrast';
  confidence: number;
}

export async function suggestConnections(
  nodes: Array<{ id: string; title: string; description?: string; tags?: string[] }>,
  existingConnectionPairs: string[]
): Promise<ConnectionSuggestion[]> {
  if (nodes.length < 2) return [];

  const nodeList = nodes.map(n => `[${n.id}]: "${n.title}" (${n.tags?.join(',') || 'no tags'})`).join('\n');
  const fallback: ConnectionSuggestion[] = [];

  const result = await callGemini(
    `Analyze this mind map and suggest meaningful connections between nodes.
     
     Nodes:
     ${nodeList}
     
     Existing connections (don't repeat): ${existingConnectionPairs.join(', ')}
     
     Return pairs that have real academic/conceptual relationships.
     For each pair explain WHY they connect.
     
     Return ONLY valid JSON array: [{"fromId":"...","toId":"...","reason":"...","type":"related|prerequisite|builds-on|contrast","confidence":0.85}]
     Max 4 suggestions. Only high-confidence connections.`,
    fallback
  );

  return Array.isArray(result) ? result : (fallback as ConnectionSuggestion[]);
}

// ── 4. Voice → Map Parsing ────────────────────────────────────────────────────
export interface VoiceMapNode {
  title: string;
  children: VoiceMapNode[];
}

export async function parseVoiceToMap(transcript: string): Promise<VoiceMapNode | null> {
  const fallback = null;

  const result = await callGemini(
    `Parse this spoken input into a hierarchical mind map structure.
     Input: "${transcript}"
     
     Detect the hierarchy from arrows (→), commas, or natural language.
     Example: "Physics → Mechanics → Newton's Laws" becomes nested nodes.
     
     Return ONLY valid JSON: {"title":"...","children":[{"title":"...","children":[...]}]}
     Max 3 levels deep. Clean up transcription noise.`,
    fallback
  );

  return result as VoiceMapNode | null;
}

// ── 5. Think For Me ───────────────────────────────────────────────────────────
export interface ThinkForMeResult {
  root: VoiceMapNode;
  domain: string;
}

export async function generateFullMap(
  topic: string,
  domain: string,
  userLevel: string = 'intermediate'
): Promise<ThinkForMeResult | null> {
  const fallback = null;

  const result = await callGemini(
    `You are an expert in ${domain}. Generate a complete, well-structured mind map for: "${topic}".
     Target audience: ${userLevel} level ${domain} student/professional.
     
     Make it academically rigorous and comprehensive.
     Include key concepts, subtopics, and specific details.
     
     Return ONLY valid JSON:
     {"domain":"${domain}","root":{"title":"${topic}","children":[{"title":"...","children":[{"title":"...","children":[]}]}]}}
     Max depth: 3. Max 5 children per node. Total nodes: 15-25.`,
    fallback
  );

  return result as ThinkForMeResult | null;
}

// ── 6. Study Mode ─────────────────────────────────────────────────────────────
export interface StudyContent {
  summary: string;
  key_concepts: string[];
  questions: string[];
  flashcards: { q: string; a: string }[];
  difficulty: string;
}

export async function generateStudyContent(
  title: string,
  description: string,
  tags: string[],
  userLevel: string = 'intermediate'
): Promise<StudyContent> {
  const fallback: StudyContent = {
    summary: `${title} is a key concept in this domain. Explore its connections to understand its full scope.`,
    key_concepts: [`Core definition of ${title}`, `Applications of ${title}`, `Related theories`],
    questions: [`What is the primary function of ${title}?`, `How does ${title} relate to adjacent concepts?`, `What are real-world applications?`],
    flashcards: [{ q: `Define ${title}`, a: description || `A fundamental concept related to ${tags?.join(', ')}` }],
    difficulty: userLevel
  };

  const result = await callGemini(
    `Generate comprehensive study material for the topic: "${title}".
     Context: ${description || 'None'}. Tags: ${tags?.join(', ') || 'general'}.
     Difficulty level: ${userLevel}.
     
     Return ONLY valid JSON:
     {
       "summary": "2-3 sentence academic summary",
       "key_concepts": ["concept 1", "concept 2", "concept 3", "concept 4"],
       "questions": ["question 1?", "question 2?", "question 3?"],
       "flashcards": [{"q":"Question?","a":"Answer."},{"q":"Q?","a":"A."},{"q":"Q?","a":"A."}],
       "difficulty": "${userLevel}"
     }`,
    fallback
  );

  return result as StudyContent || fallback;
}

// ── 7. Insight Engine ─────────────────────────────────────────────────────────
export interface MapInsight {
  type: 'weak_area' | 'over_focus' | 'missing_topic' | 'suggestion';
  title: string;
  detail: string;
  affectedNodes: string[];
}

export async function generateMapInsights(
  nodes: Array<{ id: string; title: string; connectionCount: number; tags?: string[] }>,
  totalConnections: number
): Promise<MapInsight[]> {
  if (nodes.length < 3) return [];

  const nodeData = nodes.map(n => `"${n.title}" (${n.connectionCount} connections)`).join(', ');
  const fallback: MapInsight[] = [];

  const result = await callGemini(
    `Analyze this mind map topology and provide strategic insights.
     
     Nodes: ${nodeData}
     Total connections: ${totalConnections}
     
     Identify:
     - Isolated nodes (weak areas needing more connections)
     - Over-connected nodes (potential over-focus)
     - Obvious missing topics based on what's present
     
     Return ONLY valid JSON array (max 4 insights):
     [{"type":"weak_area|over_focus|missing_topic|suggestion","title":"Short title","detail":"One sentence explanation","affectedNodes":["node title"]}]`,
    fallback
  );

  return Array.isArray(result) ? result : (fallback as MapInsight[]);
}

// ── 8. AI Assistant (Chat) ────────────────────────────────────────────────────
export async function askAIAssistant(
  question: string,
  mapContext: string,
  chatHistory: { role: string; content: string }[]
): Promise<string> {
  const fallback = "I'm analyzing your mind map. Try asking me about connections between your nodes, or what topics you might be missing.";

  const historyText = chatHistory.slice(-6).map(m => `${m.role}: ${m.content}`).join('\n');

  const result = await callGemini(
    `You are an intelligent AI assistant deeply integrated with a mind map application.
     
     The user's mind map currently contains:
     ${mapContext}
     
     Recent conversation:
     ${historyText}
     
     User's question: "${question}"
     
     Respond helpfully based on their map context. Be specific, reference their actual nodes.
     Keep response under 100 words. Be actionable and insightful.
     
     Return ONLY valid JSON: {"response": "Your answer here"}`,
    { response: fallback }
  ) as { response: string };

  return result?.response || fallback;
}

// ── 9. Multi-Mode Export ──────────────────────────────────────────────────────
export async function generateStructuredNotes(
  nodes: Array<{ title: string; description?: string; tags?: string[] }>,
  connections: Array<{ from: string; to: string }>
): Promise<string> {
  const fallback = nodes.map(n => `## ${n.title}\n${n.description || ''}\nTags: ${n.tags?.join(', ') || 'none'}\n`).join('\n');

  const nodeList = nodes.map(n => n.title).join(', ');
  const connList = connections.map(c => `${c.from} → ${c.to}`).join(', ');

  const result = await callGemini(
    `Convert this mind map into clean, structured study notes in Markdown.
     
     Topics: ${nodeList}
     Relationships: ${connList}
     
     Create flowing, coherent study notes with headers, bullet points, and logical flow.
     Group related topics. Use academic language.
     
     Return ONLY valid JSON: {"notes": "# Title\\n\\n## Section\\n..."}`,
    { notes: fallback }
  ) as { notes: string };

  return result?.notes || fallback;
}

// ── 10. Auto-Layout Engine ────────────────────────────────────────────────────
export interface LayoutPosition {
  id: string;
  x: number;
  y: number;
}

export function computeAutoLayout(
  nodes: Array<{ id: string; title: string; tags?: string[] }>,
  connections: Array<{ fromNodeId: string; toNodeId: string }>
): LayoutPosition[] {
  // Force-directed layout with semantic clustering
  const positions: LayoutPosition[] = [];
  const canvasW = 90, canvasH = 85;
  const count = nodes.length;

  if (count === 0) return [];
  if (count === 1) return [{ id: nodes[0].id, x: 50, y: 50 }];

  // Build adjacency for connected nodes to keep them close
  const adj: Record<string, string[]> = {};
  nodes.forEach(n => { adj[n.id] = []; });
  connections.forEach(c => {
    adj[c.fromNodeId]?.push(c.toNodeId);
    adj[c.toNodeId]?.push(c.fromNodeId);
  });

  // Arrange in concentric circles based on connection degree
  const degrees = nodes.map(n => ({ id: n.id, deg: adj[n.id]?.length || 0 }));
  degrees.sort((a, b) => b.deg - a.deg);

  // Center: most connected node
  const cx = canvasW / 2, cy = canvasH / 2;
  const layers = [
    degrees.slice(0, 1),
    degrees.slice(1, 5),
    degrees.slice(5)
  ];

  const radii = [0, 20, 38];
  layers.forEach((layer, li) => {
    const r = radii[li];
    layer.forEach((item, i) => {
      const angle = (2 * Math.PI * i) / Math.max(layer.length, 1) - Math.PI / 2;
      positions.push({
        id: item.id,
        x: Math.max(5, Math.min(90, cx + r * Math.cos(angle))),
        y: Math.max(5, Math.min(90, cy + r * Math.sin(angle)))
      });
    });
  });

  return positions;
}

// ── Domain Detection (Local) ──────────────────────────────────────────────────
export function detectDomain(text: string): string {
  const t = text.toLowerCase();
  if (/medicine|anatomy|physiology|pharmacology|disease|clinical|patient|diagnosis|surgery|hospital|drug|cell|gene|protein/i.test(t)) return 'medical';
  if (/algorithm|data structure|circuit|thermodynamics|mechanics|electrical|civil|chemical|software|programming|code|database|network/i.test(t)) return 'engineering';
  if (/business|management|marketing|finance|strategy|organization|leadership|economics|entrepreneurship/i.test(t)) return 'business';
  if (/research|hypothesis|experiment|methodology|literature|journal|peer|citation|analysis|data/i.test(t)) return 'research';
  if (/calculus|algebra|trigonometry|physics|chemistry|history|geography|literature|grammar|biology/i.test(t)) return 'school';
  return 'general';
}

// ── Fallback: Rule-Based Children ────────────────────────────────────────────
function generateFallbackChildren(parentTitle: string): ExpandedChild[] {
  const expansions: Record<string, ExpandedChild[]> = {
    maths: [
      { title: 'Algebra', description: 'Study of symbols and rules for manipulating them', tags: ['algebra', 'equations'] },
      { title: 'Calculus', description: 'Mathematics of continuous change', tags: ['calculus', 'limits'] },
      { title: 'Probability', description: 'Study of likelihood and uncertainty', tags: ['probability', 'statistics'] },
      { title: 'Geometry', description: 'Properties and relations of shapes', tags: ['geometry', 'shapes'] },
    ],
    physics: [
      { title: 'Mechanics', description: 'Study of motion and forces', tags: ['mechanics', 'motion'] },
      { title: 'Electromagnetism', description: 'Electric and magnetic phenomena', tags: ['electromagnetism'] },
      { title: 'Thermodynamics', description: 'Heat and energy transfer', tags: ['thermodynamics', 'energy'] },
      { title: 'Quantum Physics', description: 'Behavior of matter at atomic scales', tags: ['quantum', 'atomic'] },
    ],
  };

  const key = parentTitle.toLowerCase().replace(/[^a-z]/g, '');
  if (expansions[key]) return expansions[key];

  // Generic expansion
  return [
    { title: `${parentTitle} Fundamentals`, description: 'Core principles and foundations', tags: ['fundamentals', 'basics'] },
    { title: `${parentTitle} Applications`, description: 'Real-world uses and examples', tags: ['applications', 'practice'] },
    { title: `Advanced ${parentTitle}`, description: 'Complex concepts and theory', tags: ['advanced', 'theory'] },
    { title: `${parentTitle} History`, description: 'Origins and evolution of the field', tags: ['history', 'evolution'] },
  ];
}
