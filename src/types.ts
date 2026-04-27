export type NodeType = 'concept' | 'sphere' | 'image' | 'cluster';

// Anchor positions on each node
export type AnchorPosition = 'top' | 'right' | 'bottom' | 'left';

// NEW: fine-grained anchor connection model
export interface AnchorConnection {
  id: string;               // unique: `${fromNodeId}::${fromAnchorId}->${toNodeId}::${toAnchorId}`
  fromNodeId: string;
  fromAnchorId: string;     // e.g. `${nodeId}-top`
  toNodeId: string;
  toAnchorId: string;       // e.g. `${nodeId}-left`
}

export interface ThoughtNode {
  id: string;
  type: NodeType;
  title: string;
  description?: string;
  tags?: string[];
  x: number;
  y: number;
  featured?: boolean;
  status?: 'active' | 'latent' | 'archived';
  imageUrl?: string;
  connections?: { sourceId: string; targetId: string; }[];
  isComplete?: boolean;
  projectId?: string;
}

export interface Connection {
  id: string;
  sourceId: string;
  targetId: string;
}

export interface ProjectFile {
  id: string;
  name: string;
  content: string;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  emoji?: string;
  createdAt?: string;
  files?: ProjectFile[];
}
