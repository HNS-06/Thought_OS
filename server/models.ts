import mongoose from 'mongoose';
import { Schema, Document } from 'mongoose';

// ── Project ──────────────────────────────────────────────────────────────────
export interface IProject extends Document {
  id: string;
  name: string;
  description?: string;
  emoji?: string;
  createdAt: Date;
}

const ProjectSchema: Schema = new Schema({
  id:          { type: String, required: true, unique: true },
  name:        { type: String, required: true },
  description: { type: String, default: '' },
  emoji:       { type: String, default: '📁' },
}, { timestamps: true });

export const ProjectModel = mongoose.models.Project || mongoose.model<IProject>('Project', ProjectSchema);

// ── Node ─────────────────────────────────────────────────────────────────────
export interface IConnection {
  sourceId: string;
  targetId: string;
}

export interface INode extends Document {
  id: string;
  type: 'concept' | 'sphere' | 'image' | 'cluster';
  title: string;
  description?: string;
  tags?: string[];
  x: number;
  y: number;
  featured?: boolean;
  status?: 'active' | 'latent' | 'archived';
  imageUrl?: string;
  connections: IConnection[];
  isComplete: boolean;
  projectId: string;
}

const ConnectionSchema: Schema = new Schema({
  sourceId: { type: String, required: true },
  targetId: { type: String, required: true }
}, { _id: false });

const NodeSchema: Schema = new Schema({
  id:          { type: String, required: true, unique: true },
  type:        { type: String, required: true, enum: ['concept', 'sphere', 'image', 'cluster'] },
  title:       { type: String, required: true },
  description: { type: String },
  tags:        { type: [String], default: [] },
  x:           { type: Number, required: true },
  y:           { type: Number, required: true },
  featured:    { type: Boolean, default: false },
  status:      { type: String, enum: ['active', 'latent', 'archived'], default: 'active' },
  imageUrl:    { type: String },
  connections: { type: [ConnectionSchema], default: [] },
  isComplete:  { type: Boolean, default: false },
  projectId:   { type: String, default: 'default' },
}, { timestamps: true });

NodeSchema.index({ title: 'text', description: 'text', tags: 'text' });

export const NodeModel = mongoose.models.Node || mongoose.model<INode>('Node', NodeSchema);
