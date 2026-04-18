export type NodeType = 'concept' | 'sphere' | 'image' | 'cluster';

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

export interface Project {
  id: string;
  name: string;
  description?: string;
  emoji?: string;
  createdAt?: string;
}
