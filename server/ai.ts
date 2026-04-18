import { GoogleGenAI } from "@google/genai";
import { NodeModel, INode } from "./models";

const apiKey = process.env.GEMINI_API_KEY;

// Fallback to simple tags if no API key
export async function extractInsights(content: string): Promise<{ tags: string[], description: string }> {
  if (!apiKey) {
    const words = content.split(' ');
    return {
      tags: words.slice(0, 3).map(w => w.replace(/[^a-zA-Z]/g, '')),
      description: `Auto-generated description for "${content.substring(0, 20)}..."`
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze the following thought map node content: "${content}". 
      Return a JSON object containing:
      1. "tags": An array of 2-4 lowercase keyword strings.
      2. "description": A concise, slightly technical description (under 20 words).
      Only output the valid JSON.`,
      config: {
        responseMimeType: "application/json"
      }
    });

    const text = response.text;
    if (text) {
      return JSON.parse(text);
    }
  } catch (error) {
    console.error("Gemini context extraction error:", error);
  }

  return { tags: ['uncategorized'], description: "Data node established." };
}

export async function findSimilarNodesAndConnect(newNode: INode) {
  // Find all nodes in the same project to connect to
  const allProjectNodes = await NodeModel.find({ 
    id: { $ne: newNode.id },
    projectId: newNode.projectId || 'default'
  });
  
  const connectionsToCreate = [];
  const connectedIds = new Set<string>();
  
  // First, connect to nodes with shared tags
  for (const node of allProjectNodes) {
    const sharedTags = newNode.tags?.filter(t => node.tags?.includes(t)) || [];
    if (sharedTags.length > 0) {
      connectionsToCreate.push({ sourceId: newNode.id, targetId: node.id });
      connectedIds.add(node.id);
      await NodeModel.updateOne(
        { id: node.id },
        { $push: { connections: { sourceId: node.id, targetId: newNode.id } } }
      );
    }
  }

  // Ensure multiple connections: if we have fewer than 2 connections, connect to random nodes
  if (connectionsToCreate.length < 2 && allProjectNodes.length > 0) {
    const availableNodes = allProjectNodes.filter(n => !connectedIds.has(n.id));
    // shuffle available nodes
    const shuffled = [...availableNodes].sort(() => 0.5 - Math.random());
    const nodesNeeded = 2 - connectionsToCreate.length;
    const toConnect = shuffled.slice(0, nodesNeeded);
    
    for (const node of toConnect) {
      connectionsToCreate.push({ sourceId: newNode.id, targetId: node.id });
      await NodeModel.updateOne(
        { id: node.id },
        { $push: { connections: { sourceId: node.id, targetId: newNode.id } } }
      );
    }
  }

  // Save the outgoing connections to the new node
  if (connectionsToCreate.length > 0) {
    await NodeModel.updateOne(
      { id: newNode.id },
      { $push: { connections: { $each: connectionsToCreate } } }
    );
  }

  return connectionsToCreate;
}
