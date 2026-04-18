import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { NodeModel, ProjectModel } from './models';
import { extractInsights, findSimilarNodesAndConnect } from './ai';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

const PORT = 3005;

// ── Seed Data ─────────────────────────────────────────────────────────────────
const DEFAULT_PROJECT = {
  id: 'default',
  name: 'My Workspace',
  description: 'Default project space',
  emoji: '🧠',
};

const INITIAL_NODES = [
  { id: 'node-1', type: 'concept', title: 'Quantum Entanglement', description: 'Exploring the boundaries between local realism and particle interconnectivity in multi-dimensional space.', tags: ['physics', 'research'], x: 35, y: 35, featured: true, status: 'active', isComplete: false, projectId: 'default' },
  { id: 'node-2', type: 'sphere',  title: 'Neural Synapse Mapping', x: 60, y: 15, status: 'active', isComplete: false, projectId: 'default' },
  { id: 'node-3', type: 'image',   title: 'Structural Synthesis', description: 'Visualizing the hierarchical data structures within the neural matrix.', imageUrl: 'https://picsum.photos/seed/neural/800/600', tags: ['visual', 'data'], x: 58, y: 58, isComplete: false, projectId: 'default' },
  { id: 'node-4', type: 'concept', title: 'Sustainable Urban Mobility', description: 'Synthesizing multimodal transport networks with decentralized energy grids to reduce carbon footprint by 40%.', tags: ['infrastructure', 'iot'], x: 15, y: 60, status: 'latent', isComplete: false, projectId: 'default' },
];

// ── DB Bootstrap ──────────────────────────────────────────────────────────────
import { MongoMemoryServer } from 'mongodb-memory-server';

async function startDb() {
  let uri = process.env.MONGODB_URI;
  if (!uri) {
    console.log('No MONGODB_URI found, starting in-memory DB…');
    const mongoServer = await MongoMemoryServer.create();
    uri = mongoServer.getUri();
  }
  try {
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');

    // Seed project
    const projectCount = await ProjectModel.countDocuments();
    if (projectCount === 0) { await ProjectModel.create(DEFAULT_PROJECT); }

    // Seed nodes
    const nodeCount = await NodeModel.countDocuments();
    if (nodeCount === 0) {
      console.log('Seeding initial nodes…');
      await NodeModel.insertMany(INITIAL_NODES);
    }
  } catch (err) {
    console.error('MongoDB Connection Error:', err);
  }

  // Start listening AFTER DB is ready so first connection gets seeded data
  httpServer.listen(PORT, () => {
    console.log(`Socket.IO Server running on port ${PORT}`);
  });
}

startDb();

// ── Socket Events ─────────────────────────────────────────────────────────────
io.on('connection', async (socket) => {
  console.log('Client connected:', socket.id);

  // ── Init: send all projects + nodes for 'default' project ──────────────────
  const projects = await ProjectModel.find({}).sort({ createdAt: 1 });
  socket.emit('init_projects', projects);

  const nodes = await NodeModel.find({ projectId: 'default' });
  socket.emit('init', nodes);

  // ── Projects ───────────────────────────────────────────────────────────────
  socket.on('project_create', async (data: { name: string; description?: string; emoji?: string }) => {
    const proj = await ProjectModel.create({
      id: `proj-${Date.now()}`,
      name: data.name,
      description: data.description || '',
      emoji: data.emoji || '📁',
    });
    io.emit('project_created', proj);
  });

  socket.on('project_delete', async (id: string) => {
    await ProjectModel.deleteOne({ id });
    await NodeModel.deleteMany({ projectId: id });
    io.emit('project_deleted', id);
  });

  socket.on('switch_project', async (projectId: string) => {
    const nodes = await NodeModel.find({ projectId });
    socket.emit('init', nodes);
  });

  // ── Nodes ──────────────────────────────────────────────────────────────────
  socket.on('search_nodes', async (query: string) => {
    if (!query) {
      const all = await NodeModel.find({});
      return socket.emit('search_results', all);
    }
    const results = await NodeModel.find({ $text: { $search: query } });
    socket.emit('search_results', results);
  });

  socket.on('node_create', async (data) => {
    const { title, x, y, imageUrl, projectId = 'default' } = data;
    let description = data.description || '';
    let tags: string[] = [];

    if (!imageUrl) {
      try {
        const insights = await extractInsights(title);
        tags = insights.tags;
        description = insights.description || description;
      } catch (_) { /* no AI key – silently skip */ }
    }

    const type = imageUrl ? 'image' : 'concept';

    const newNode = new NodeModel({
      id: `node-${Date.now()}`,
      type,
      title,
      description,
      tags,
      x: x ?? 50,
      y: y ?? 50,
      status: 'active',
      imageUrl,
      isComplete: false,
      projectId,
    });

    await newNode.save();
    io.emit('node_created', newNode);

    if (!imageUrl) {
      const connections = await findSimilarNodesAndConnect(newNode);
      if (connections.length > 0) {
        const updatedNode = await NodeModel.findOne({ id: newNode.id });
        io.emit('node_updated', updatedNode);
        for (const conn of connections) {
          const targetNode = await NodeModel.findOne({ id: conn.targetId });
          io.emit('node_updated', targetNode);
        }
      }
    }
  });

  socket.on('node_drag', async ({ id, x, y }) => {
    io.emit('node_moved', { id, x, y });
    await NodeModel.updateOne({ id }, { x, y });
  });

  socket.on('node_connect', async ({ sourceId, targetId }) => {
    const sourceNode = await NodeModel.findOne({ id: sourceId });
    if (sourceNode) {
      if (!sourceNode.connections) sourceNode.connections = [];
      if (!sourceNode.connections.find(c => c.targetId === targetId)) {
        const newConnection = { sourceId, targetId };
        sourceNode.connections.push(newConnection);
        await NodeModel.updateOne({ id: sourceId }, { $push: { connections: newConnection } });
        io.emit('node_updated', await NodeModel.findOne({ id: sourceId }));
      }
    }
  });

  socket.on('node_update', async ({ id, updates }) => {
    await NodeModel.updateOne({ id }, { $set: updates });
    const updatedNode = await NodeModel.findOne({ id });
    io.emit('node_updated', updatedNode);
  });

  socket.on('node_delete', async (id: string) => {
    await NodeModel.deleteOne({ id });
    io.emit('node_deleted', id);
  });

  socket.on('node_toggle_complete', async (id: string) => {
    const node = await NodeModel.findOne({ id });
    if (!node) return;
    node.isComplete = !node.isComplete;
    await node.save();
    io.emit('node_updated', node);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});
