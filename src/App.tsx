/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { TopNav, SideNav } from './components/Navigation';
import type { TopNavView, SideNavView } from './components/Navigation';
import { NeuralCanvas } from './components/NeuralCanvas';
import { ConceptNode, SphereNode, VisualNode } from './components/ThoughtNode';
import { ThoughtInput, MiniMap, InteractionPalette } from './components/FloatingUI';
import {
  AnalyticsPanel,
  ProjectsPanel,
  ConnectionsPanel,
  ArchivesPanel,
  HistoryPanel,
} from './components/ViewPanels';
import { AIAssistantPanel } from './components/AIAssistantPanel';
import { ThinkForMeModal } from './components/AIThinkForMeModal';
import { AIStudyModePanel } from './components/AIStudyModePanel';
import { Sparkles, Loader2, Brain } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { ThoughtNode, Project, AnchorConnection, NodeType } from './types';
import {
  geminiService,
  expandNode,
  suggestConnections,
  computeAutoLayout,
  generateMapInsights,
  generateStructuredNotes,
  parseVoiceToMap,
  type ConnectionSuggestion,
  type MapInsight,
} from './services/gemini';
import { aiMemory } from './services/aiMemory';
import { cn } from './lib/utils';
import { socket } from './lib/socket';

export default function App() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [nodes, setNodes]                     = useState<ThoughtNode[]>([]);
  const [projects, setProjects]               = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState('default');

  const [topView, setTopView]   = useState<TopNavView>('dashboard');
  const [sideView, setSideView] = useState<SideNavView>('nodes');

  const [scale, setScale]         = useState(1);
  const [isPanMode, setIsPanMode] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart                  = useRef<{ x: number; y: number } | null>(null);

  const [focusedNodeId, setFocusedNodeId]         = useState<string | null>(null);
  const [insights, setInsights]                   = useState<string[]>([]);
  const [loadingInsights, setLoadingInsights]     = useState(false);
  const [isSidebarOpen, setIsSidebarOpen]         = useState(true);
  const [isConnected, setIsConnected]             = useState(false);

  const [isAssistantOpen, setIsAssistantOpen]     = useState(false);
  const [isThinkForMeOpen, setIsThinkForMeOpen]   = useState(false);
  const [ghostConnections, setGhostConnections]   = useState<ConnectionSuggestion[]>([]);
  const [mapInsights, setMapInsights]             = useState<MapInsight[]>([]);
  const [isExpandingNode, setIsExpandingNode]     = useState<string | null>(null);
  const [showStudyMode, setShowStudyMode]         = useState(false);
  const [exportedNotes, setExportedNotes]         = useState<string | null>(null);
  const suggestionTimerRef                        = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Anchor Connection State (must be declared before AI effects use it) ────
  const [anchorConnections, setAnchorConnections] = useState<AnchorConnection[]>([]);
  const [linkingSourceAnchor, setLinkingSourceAnchor] = useState<string | null>(null);
  const [mousePos, setMousePos]                   = useState({ x: 0, y: 0 });
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId]       = useState<string | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const activeNodesRef = useRef<ThoughtNode[]>([]);
  const lastSyncedProjectIdRef = useRef<string | null>(null);

  // ── Socket ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    socket.on('init_projects', (data: Project[]) => {
      // If we already have local projects, we might want to merge, 
      // but the user wants local storage to be primary now.
      // So we only set if empty.
      if (projects.length === 0) setProjects(data);
    });

    socket.on('init', (data: ThoughtNode[]) => setNodes(data));
    socket.on('node_created', (node: ThoughtNode) => {
      setNodes(prev => prev.find(n => n.id === node.id) ? prev : [...prev, node]);
    });
    socket.on('node_updated', (node: ThoughtNode) => {
      setNodes(prev => prev.map(n => n.id === node.id ? node : n));
    });
    socket.on('node_moved', ({ id, x, y }: { id: string; x: number; y: number }) => {
      setNodes(prev => prev.map(n => n.id === id ? { ...n, x, y } : n));
    });
    socket.on('node_deleted', (id: string) => {
      setNodes(prev => prev
        .filter(n => n.id !== id)
        .map(n => ({
          ...n,
          connections: n.connections?.filter(c => c.targetId !== id)
        }))
      );
      if (focusedNodeId === id) setFocusedNodeId(null);
    });

    return () => {
      socket.off('init_projects');
      socket.off('project_created');
      socket.off('project_deleted');
      socket.off('init');
      socket.off('node_created');
      socket.off('node_updated');
      socket.off('node_moved');
      socket.off('node_deleted');
    };
  }, [activeProjectId, focusedNodeId]);

  // ── Projects ───────────────────────────────────────────────────────────────
  const handleSwitchProject = useCallback((id: string) => {
    setActiveProjectId(id);
    localStorage.setItem('thought_canvas_active_project_id', id);
    setFocusedNodeId(null);
  }, []);

  const handleCreateProject = useCallback((name: string, emoji?: string) => {
    if (!name.trim()) return;
    
    const projectId = `proj-${Date.now()}`;
    const newProject: Project = {
      id: projectId,
      name: name.trim(),
      emoji: emoji || '📁',
      createdAt: new Date().toISOString(),
      files: [],
    };

    setProjects(prev => {
      // Prevent duplicates if by some chance the ID is the same
      if (prev.find(p => p.id === projectId)) return prev;
      const next = [...prev, newProject];
      localStorage.setItem('thought_canvas_projects', JSON.stringify(next));
      return next;
    });

    handleSwitchProject(projectId);
  }, [handleSwitchProject]);

  const handleAddFileToProject = useCallback((projectId: string, fileName: string, content: string) => {
    setProjects(prev => {
      const next = prev.map(p => {
        if (p.id === projectId) {
          const newFile = {
            id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: fileName,
            content: content,
            createdAt: new Date().toISOString(),
          };
          return { ...p, files: [...(p.files || []), newFile] };
        }
        return p;
      });
      localStorage.setItem('thought_canvas_projects', JSON.stringify(next));
      return next;
    });
  }, []);

  const handleDeleteFileFromProject = useCallback((projectId: string, fileId: string) => {
    setProjects(prev => {
      const next = prev.map(p => {
        if (p.id === projectId) {
          return { ...p, files: (p.files || []).filter(f => f.id !== fileId) };
        }
        return p;
      });
      localStorage.setItem('thought_canvas_projects', JSON.stringify(next));
      return next;
    });
  }, []);

  const handleCreateNode = useCallback((title: string, type: NodeType = 'concept') => {
    let finalTitle = title;
    
    // Calculate center of current viewport relative to canvas
    const rect = canvasRef.current?.getBoundingClientRect() || { width: 1200, height: 800, left: 0, top: 0 };
    
    // We want the center of the screen in canvas coordinates
    // (windowCenter - panOffset) / scale
    const centerX = (window.innerWidth / 2 - panOffset.x) / scale;
    const centerY = (window.innerHeight / 2 - panOffset.y) / scale;
    
    // Convert to percentage of the min-w/min-h container
    const x = Math.max(5, Math.min(95, (centerX / 1200) * 100));
    const y = Math.max(5, Math.min(95, (centerY / 800) * 100));

    const newNode: ThoughtNode = {
      id: `node-temp-${Date.now()}`,
      type,
      title: finalTitle,
      description: 'Auto-generating details...',
      x,
      y,
      status: 'active',
      projectId: activeProjectId,
      isComplete: false,
    };

    // Optimistic update
    setNodes(prev => [...prev, newNode]);

    socket.emit('node_create', {
      title: finalTitle,
      type,
      x,
      y,
      projectId: activeProjectId
    });
  }, [activeProjectId, panOffset, scale]);

  // ── Local Persistence ──────────────────────────────────────────────────────
  useEffect(() => {
    // Load projects on mount
    const savedProjects = localStorage.getItem('thought_canvas_projects');
    if (savedProjects) {
      try {
        const parsed = JSON.parse(savedProjects);
        setProjects(parsed);
      } catch (e) {
        console.error("Failed to load local projects", e);
        localStorage.removeItem('thought_canvas_projects');
      }
    }

    // Load active project ID
    const savedActiveId = localStorage.getItem('thought_canvas_active_project_id');
    if (savedActiveId) {
      setActiveProjectId(savedActiveId);
    }

    // Load nodes on mount
    const savedNodes = localStorage.getItem('thought_canvas_nodes');
    if (savedNodes) {
      try {
        const parsed = JSON.parse(savedNodes);
        if (Array.isArray(parsed)) setNodes(parsed);
      } catch (e) { 
        console.error("Failed to load local nodes", e);
        localStorage.removeItem('thought_canvas_nodes');
      }
    }

    // Load anchor connections
    const savedConns = localStorage.getItem('thought_canvas_anchor_connections');
    if (savedConns) {
      try {
        const parsed = JSON.parse(savedConns);
        if (Array.isArray(parsed)) setAnchorConnections(parsed);
      } catch (e) { 
        console.error("Failed to load local connections", e);
        localStorage.removeItem('thought_canvas_anchor_connections');
      }
    }
  }, []);

  useEffect(() => {
    // Save on change
    localStorage.setItem('thought_canvas_nodes', JSON.stringify(nodes));
    localStorage.setItem('thought_canvas_projects', JSON.stringify(projects));
    localStorage.setItem('thought_canvas_anchor_connections', JSON.stringify(anchorConnections));
  }, [nodes, projects, anchorConnections]);

  const handleDeleteProject = useCallback((id: string) => {
    if (id === 'default') return;
    if (!window.confirm('Delete this project and all its nodes?')) return;
    
    setProjects(prev => {
      const next = prev.filter(p => p.id !== id);
      localStorage.setItem('thought_canvas_projects', JSON.stringify(next));
      return next;
    });

    // Delete associated nodes
    setNodes(prev => {
      const next = prev.filter(n => n.projectId !== id);
      localStorage.setItem('thought_canvas_nodes', JSON.stringify(next));
      return next;
    });

    if (activeProjectId === id) {
      handleSwitchProject('default');
    }
  }, [activeProjectId, handleSwitchProject]);

  const handleDeleteHistory = useCallback(() => {
    if (!window.confirm('Are you sure you want to delete ALL projects and data? This cannot be undone.')) return;
    
    localStorage.removeItem('thought_canvas_projects');
    localStorage.removeItem('thought_canvas_nodes');
    localStorage.removeItem('thought_canvas_anchor_connections');
    localStorage.removeItem('thought_canvas_active_project_id');
    
    setProjects([]);
    setNodes([]);
    setAnchorConnections([]);
    setActiveProjectId('default');
  }, []);

  // ── Node actions ──────────────────────────────────────────────────────────────────
  const handleExpand = async (id: string) => {
    if (id === focusedNodeId) {
      setFocusedNodeId(null);
      return;
    }

    // ── AI AUTO-EXPANSION ───────────────────────────────────
    const sourceNode = nodes.find(n => n.id === id);
    if (sourceNode) {
      setIsExpandingNode(id);
      const mem = aiMemory.get();
      const allTitles = nodes.map(n => n.title);
      const children = await expandNode(
        sourceNode.title,
        sourceNode.tags || [],
        allTitles,
        mem.userLevel
      );

      if (children.length > 0) {
        // Place children in a fan around parent
        const newNodes: ThoughtNode[] = children.map((child, i) => {
          const angle = (2 * Math.PI * i) / children.length - Math.PI / 2;
          const radius = 20;
          const x = Math.max(5, Math.min(90, sourceNode.x + radius * Math.cos(angle)));
          const y = Math.max(5, Math.min(88, sourceNode.y + radius * Math.sin(angle)));
          const nodeId = `ai-exp-${Date.now()}-${i}`;
          return {
            id: nodeId,
            type: 'concept' as NodeType,
            title: child.title,
            description: child.description,
            tags: child.tags,
            x, y,
            status: 'active',
            projectId: activeProjectId,
          } as ThoughtNode;
        });

        setNodes(prev => [...prev, ...newNodes]);

        // Auto-connect children to parent
        const newConns: AnchorConnection[] = newNodes.map((n, i) => ({
          id: `${id}::${id}-right->${n.id}::${n.id}-left-${i}`,
          fromNodeId: id,
          fromAnchorId: `${id}-right`,
          toNodeId: n.id,
          toAnchorId: `${n.id}-left`,
        }));
        setAnchorConnections(prev => [...prev, ...newConns]);

        aiMemory.recordNodeExpansion(sourceNode.title, aiMemory.get().domain);
      }
      setIsExpandingNode(null);
    }

    // Also open Study Mode for the focused node
    setFocusedNodeId(id);
    setShowStudyMode(true);
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const handleThinkForMe = useCallback(async (prompt: string) => {
    setIsThinkForMeOpen(false);
    // Logic for generating structure via prompt...
  }, []);

  const handleDeleteNode = useCallback((id: string) => {
    setNodes(prev => prev.filter(n => n.id !== id));
    socket.emit('node_delete', id);
  }, []);

  const handleToggleComplete = useCallback((id: string) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, isComplete: !n.isComplete } : n));
    socket.emit('node_toggle_complete', id);
  }, []);

  // ── AI Insights ────────────────────────────────────────────────────────────
  const focusedNode = nodes.find(n => n.id === focusedNodeId);
  useEffect(() => {
    if (focusedNodeId && focusedNode) {
      setLoadingInsights(true);
      geminiService.getThoughtInsights(focusedNode.title).then(res => {
        setInsights(res);
        setLoadingInsights(false);
      });
    } else {
      setInsights([]);
    }
  }, [focusedNodeId]);

  // ── AI Connection Suggestions (debounced background) ───────────────────
  const activeNodes = nodes.filter(n => !n.projectId || n.projectId === activeProjectId);
  useEffect(() => {
    if (suggestionTimerRef.current) clearTimeout(suggestionTimerRef.current);
    if (activeNodes.length < 3) { setGhostConnections([]); return; }
    suggestionTimerRef.current = setTimeout(async () => {
      const existingPairs = anchorConnections.map(c => `${c.fromNodeId}-${c.toNodeId}`);
      const nodeData = activeNodes.map(n => ({ id: n.id, title: n.title, description: n.description, tags: n.tags }));
      const suggestions = await suggestConnections(nodeData, existingPairs);
      setGhostConnections(suggestions);
    }, 4000);
    return () => { if (suggestionTimerRef.current) clearTimeout(suggestionTimerRef.current); };
  }, [activeNodes.length, anchorConnections.length]);

  // ── Map Insights Engine (background) ────────────────────────────────
  useEffect(() => {
    if (activeNodes.length < 4 || !aiMemory.shouldShowInsights()) return;
    const nodeData = activeNodes.map(n => ({
      id: n.id, title: n.title,
      connectionCount: anchorConnections.filter(c => c.fromNodeId === n.id || c.toNodeId === n.id).length,
      tags: n.tags
    }));
    generateMapInsights(nodeData, anchorConnections.length).then(ins => {
      if (ins.length > 0) { setMapInsights(ins); aiMemory.markInsightShown(); }
    });
  }, [activeNodes.length]);

  // ── Think-For-Me handler ────────────────────────────────────────────
  const handleThinkForMeResult = useCallback((newNodes: ThoughtNode[], newConns: { fromId: string; toId: string }[]) => {
    setNodes(prev => [...prev, ...newNodes]);
    const anchorConns: AnchorConnection[] = newConns.map((c, i) => ({
      id: `tfm-conn-${Date.now()}-${i}`,
      fromNodeId: c.fromId, fromAnchorId: `${c.fromId}-right`,
      toNodeId: c.toId,  toAnchorId: `${c.toId}-left`,
    }));
    setAnchorConnections(prev => [...prev, ...anchorConns]);
  }, []);

  // ── Auto-Organize ───────────────────────────────────────────────────
  const handleAutoOrganize = useCallback(() => {
    if (activeNodes.length < 2) return;
    const layout = computeAutoLayout(
      activeNodes.map(n => ({ id: n.id, title: n.title, tags: n.tags })),
      anchorConnections.map(c => ({ fromNodeId: c.fromNodeId, toNodeId: c.toNodeId }))
    );
    setNodes(prev => prev.map(n => { const p = layout.find(l => l.id === n.id); return p ? { ...n, x: p.x, y: p.y } : n; }));
  }, [activeNodes, anchorConnections]);

  // ── Accept Ghost Connection ──────────────────────────────────────────
  const handleAcceptSuggestion = useCallback((sugg: ConnectionSuggestion) => {
    const newConn: AnchorConnection = {
      id: `sugg-${Date.now()}`,
      fromNodeId: sugg.fromId, fromAnchorId: `${sugg.fromId}-right`,
      toNodeId: sugg.toId,  toAnchorId: `${sugg.toId}-left`,
    };
    setAnchorConnections(prev => [...prev, newConn]);
    setGhostConnections(prev => prev.filter(s => s.fromId !== sugg.fromId || s.toId !== sugg.toId));
  }, []);

  // ── Export Notes ───────────────────────────────────────────────────
  const handleExportNotes = useCallback(async () => {
    const conns = anchorConnections.map(c => ({
      from: nodes.find(n => n.id === c.fromNodeId)?.title || '',
      to: nodes.find(n => n.id === c.toNodeId)?.title || '',
    }));
    const notes = await generateStructuredNotes(activeNodes, conns);
    const blob = new Blob([notes], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `thought-map-notes-${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  }, [activeNodes, anchorConnections, nodes]);

  // ── File Drop ─────────────────────────────────────────────────────────────
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!e.dataTransfer.files?.length) return;
    const file = e.dataTransfer.files[0];
    const bounds = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = ((e.clientX - bounds.left) / bounds.width) * 100;
    const y = ((e.clientY - bounds.top) / bounds.height) * 100;

    const reader = new FileReader();
    reader.onload = ev => {
      const result = ev.target?.result as string;
      if (file.type.startsWith('image/')) {
        socket.emit('node_create', { title: file.name, imageUrl: result, x, y, projectId: activeProjectId });
      } else {
        socket.emit('node_create', { title: file.name, description: result.slice(0, 300), x, y, projectId: activeProjectId });
      }
    };
    file.type.startsWith('image/') ? reader.readAsDataURL(file) : reader.readAsText(file);
  }, [activeProjectId]);

  // ── Anchor Connection System ─────────────────────────────────────────────────
  // (anchorConnections and linking state are declared at top of component)

  // Derive which anchors are used as sources
  const usedSourceAnchors = useMemo(() =>
    new Set(anchorConnections.map(c => c.fromAnchorId)),
    [anchorConnections]
  );

  // Derive which nodes already have an INCOMING connection (one-in rule)
  const usedTargetNodes = useMemo(() =>
    new Set(anchorConnections.map(c => c.toNodeId)),
    [anchorConnections]
  );

  // Sync legacy connections from server into anchorConnections on project change
  useEffect(() => {
    if (lastSyncedProjectIdRef.current === activeProjectId) return;
    
    const legacy: AnchorConnection[] = [];
    const seen = new Set<string>();
    
    for (const node of nodes) {
      if (node.projectId !== activeProjectId && activeProjectId !== 'default') continue;
      
      for (const conn of node.connections || []) {
        const id = `${conn.sourceId}::default->${conn.targetId}::default`;
        if (!seen.has(id)) {
          seen.add(id);
          legacy.push({
            id,
            fromNodeId: conn.sourceId,
            fromAnchorId: `${conn.sourceId}-top`,
            toNodeId: conn.targetId,
            toAnchorId: `${conn.targetId}-top`,
          });
        }
      }
    }

    if (legacy.length > 0) {
      setAnchorConnections(prev => {
        const next = [...prev];
        legacy.forEach(l => {
          if (!next.find(n => n.fromNodeId === l.fromNodeId && n.toNodeId === l.toNodeId)) {
            next.push(l);
          }
        });
        return next;
      });
      lastSyncedProjectIdRef.current = activeProjectId;
    }
  }, [nodes, activeProjectId]);



  const handleStartLink = useCallback((anchorId: string) => {
    setLinkingSourceAnchor(anchorId);
  }, []);

  const handleCancelLink = useCallback(() => {
    setLinkingSourceAnchor(null);
  }, []);

  const handleCompleteLink = useCallback((toAnchorId: string) => {
    if (!linkingSourceAnchor) return;

    const fromAnchorId = linkingSourceAnchor;
    const fromNodeId = fromAnchorId.slice(0, fromAnchorId.lastIndexOf('-'));
    const toNodeId = toAnchorId.slice(0, toAnchorId.lastIndexOf('-'));

    // Validation
    if (fromNodeId === toNodeId) { setLinkingSourceAnchor(null); return; } // no self
    
    // Allow many-to-many connections
    // (Removed strict one-in and one-out-per-anchor rules)

    // Duplicate check
    const connId = `${fromNodeId}::${fromAnchorId}->${toNodeId}::${toAnchorId}`;
    if (anchorConnections.some(c => c.id === connId)) { setLinkingSourceAnchor(null); return; }

    const newConn: AnchorConnection = { id: connId, fromNodeId, fromAnchorId, toNodeId, toAnchorId };
    setAnchorConnections(prev => [...prev, newConn]);

    // Also persist to server with legacy model
    socket.emit('node_connect', { sourceId: fromNodeId, targetId: toNodeId });

    setLinkingSourceAnchor(null);
  }, [linkingSourceAnchor, usedSourceAnchors, usedTargetNodes, anchorConnections]);

  // ── Global Linking Interaction ──────────────────────────────────────────────
  useEffect(() => {
    if (!linkingSourceAnchor) return;

    const handleGlobalPointerMove = (e: PointerEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };

    const handleGlobalPointerUp = (e: PointerEvent) => {
      // Detection using elementFromPoint
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const targetAnchor = el?.closest('[data-anchor-id]');
      const snapAnchorId = targetAnchor?.getAttribute('data-anchor-id');

      if (snapAnchorId) {
        handleCompleteLink(snapAnchorId);
      } else {
        handleCancelLink();
      }
    };

    window.addEventListener('pointermove', handleGlobalPointerMove);
    window.addEventListener('pointerup', handleGlobalPointerUp);
    return () => {
      window.removeEventListener('pointermove', handleGlobalPointerMove);
      window.removeEventListener('pointerup', handleGlobalPointerUp);
    };
  }, [linkingSourceAnchor, handleCompleteLink, handleCancelLink]);

  const handleDeleteConnection = useCallback((connId: string) => {
    const conn = anchorConnections.find(c => c.id === connId);
    if (!conn) return;
    setAnchorConnections(prev => prev.filter(c => c.id !== connId));
    setSelectedConnectionId(null);
    // Persist removal
    socket.emit('node_disconnect', { sourceId: conn.fromNodeId, targetId: conn.toNodeId });
  }, [anchorConnections]);

  const handleDisconnect = handleDeleteConnection;

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (document.activeElement?.tagName === 'INPUT' || (document.activeElement as HTMLElement)?.isContentEditable) return;
        if (selectedConnectionId) {
          handleDeleteConnection(selectedConnectionId);
        } else if (selectedNodeId) {
          handleDeleteNode(selectedNodeId);
        }
      }
      if (e.key === 'Escape') {
        setLinkingSourceAnchor(null);
        setSelectedConnectionId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedConnectionId, selectedNodeId, handleDeleteConnection, handleDeleteNode]);

  // ── Pan/Link handlers ────────────────────────────────────────────────────────
  const handleCanvasPointerDown = useCallback((e: React.PointerEvent) => {
    setSelectedNodeId(null);
    if (!isPanMode) return;
    if ((e.target as HTMLElement).closest('[class*="absolute group"]')) return;
    setIsPanning(true);
    panStart.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, [isPanMode, panOffset]);

  const handleCanvasPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isPanning || !panStart.current) return;
    setPanOffset({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y });
  }, [isPanning]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setScale(s => Math.min(Math.max(0.2, s - e.deltaY * 0.002), 2));
    } else {
      setPanOffset(prev => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY
      }));
    }
  }, []);

  const handleCanvasPointerUp = useCallback((e: React.PointerEvent) => {
    setIsPanning(false);
    panStart.current = null;

    if (linkingSourceAnchor) {
      // Professional Hit Detection: use elementFromPoint to find exactly what's under the cursor
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const targetAnchor = el?.closest('[data-anchor-id]');
      const snapAnchorId = targetAnchor?.getAttribute('data-anchor-id');

      if (snapAnchorId) {
        handleCompleteLink(snapAnchorId);
      } else {
        handleCancelLink();
      }
    }
  }, [linkingSourceAnchor, handleCompleteLink, handleCancelLink]);

  // ── Data Export/Import ─────────────────────────────────────────────────────
  const handleExportData = useCallback(() => {
    const data = { nodes, anchorConnections, projects };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `thought-map-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [nodes, anchorConnections, projects]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportData = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        
        let targetProjectId = activeProjectId;
        
        if (data.projects && Array.isArray(data.projects)) {
          setProjects(data.projects);
          if (data.projects.length > 0) {
            targetProjectId = data.projects[0].id;
            handleSwitchProject(targetProjectId);
          }
        }

        if (data.nodes && Array.isArray(data.nodes)) {
          const validNodes = data.nodes.map((n: any, idx: number) => {
            if (!n || typeof n !== 'object') return null;
            
            const id = n.id || `imported-node-${Date.now()}-${idx}`;
            const x = typeof n.x === 'number' ? n.x : (n.position?.x || 50 + Math.random() * 20);
            const y = typeof n.y === 'number' ? n.y : (n.position?.y || 50 + Math.random() * 20);
            const title = n.title || n.label || n.data?.label || n.data?.content || 'Untitled Node';
            const type = ['concept', 'sphere', 'image', 'cluster'].includes(n.type) ? n.type : 'concept';
            
            const nodeProjectId = (data.projects && n.projectId) ? n.projectId : targetProjectId;

            return {
              ...n,
              id,
              x,
              y,
              title,
              type,
              projectId: nodeProjectId
            };
          }).filter(Boolean);
          
          if (validNodes.length > 0) {
            setNodes(validNodes as ThoughtNode[]);
          } else {
            console.warn("Import contained no valid nodes.");
          }
        }
        
        if (data.anchorConnections && Array.isArray(data.anchorConnections)) {
          setAnchorConnections(data.anchorConnections);
        }
        
        alert('Map data loaded successfully!');
      } catch (err) {
        console.error("Failed to parse map data", err);
        alert('Failed to parse map data.');
      }
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  }, [activeProjectId, handleSwitchProject]);

  const handleShareData = useCallback(() => {
    const data = { nodes, anchorConnections, projects };
    navigator.clipboard.writeText(JSON.stringify(data)).then(() => {
      alert('Map data copied to clipboard! You can paste this JSON to share.');
    }).catch(() => {
      alert('Failed to copy to clipboard.');
    });
  }, [nodes, anchorConnections, projects]);

  // ── Derived data ───────────────────────────────────────────────────────────
  // (activeNodes is declared above with the AI connection suggestions effect)

  // Node actions
  const handleNodeMove = useCallback((id: string, x: number, y: number) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, x, y } : n));
  }, []);

  const handleUpdateNode = useCallback((id: string, updates: Partial<ThoughtNode>) => {
    // Optimistic update
    setNodes(prev => prev.map(n => n.id === id ? { ...n, ...updates } : n));
    socket.emit('node_update', { id, updates });
  }, []);

  const canvasNodes = sideView === 'archives'
    ? activeNodes.filter(n => n.isComplete || n.status === 'archived')
    : activeNodes;

  const showCanvas = topView === 'dashboard' && sideView === 'nodes';

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-background">
      {/* Background  – only show on canvas */}
      {showCanvas && (
        <NeuralCanvas
          nodes={activeNodes}
          anchorConnections={anchorConnections}
          linkingSourceAnchor={linkingSourceAnchor}
          mousePos={mousePos}
          onDeleteConnection={handleDeleteConnection}
        />
      )}

      {/* TopNav */}
      <TopNav
        isConnected={isConnected}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen(v => !v)}
        topView={topView}
        onTopViewChange={v => { setTopView(v); setFocusedNodeId(null); }}
        nodeCount={activeNodes.length}
        activeProjectId={activeProjectId}
        projects={projects}
      />

      {/* SideNav */}
      <SideNav
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen(v => !v)}
        projects={projects}
        activeProjectId={activeProjectId}
        onSwitchProject={handleSwitchProject}
        onCreateProject={handleCreateProject}
        onDeleteProject={handleDeleteProject}
        nodeCount={activeNodes.length}
        sideView={sideView}
        onSideViewChange={v => { setSideView(v); setFocusedNodeId(null); }}
      />

      {/* Main content */}
      <main className={cn(
        "relative z-10 w-full h-full pt-[64px] md:pt-[72px] transition-all duration-300 ease-in-out",
        isSidebarOpen ? "md:pl-72" : "md:pl-0"
      )}>
        <AnimatePresence mode="wait">

          {/* ── ANALYTICS (top nav) ─────────────────────────────────────────── */}
          {topView === 'analytics' && (
            <motion.div key="analytics" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full">
              <AnalyticsPanel nodes={activeNodes} projects={projects} />
            </motion.div>
          )}

          {/* ── PROJECTS PAGE (top nav) ──────────────────────────────────────── */}
          {topView === 'projects' && (
            <motion.div key="projects-page" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full">
              <ProjectsPanel
                projects={projects}
                nodes={nodes}
                activeProjectId={activeProjectId}
                onSwitchProject={id => { handleSwitchProject(id); setTopView('dashboard'); }}
                onCreateProject={handleCreateProject}
                onDeleteProject={handleDeleteProject}
                onDeleteHistory={handleDeleteHistory}
              />
            </motion.div>
          )}

          {/* ── CONNECTIONS (side nav) ───────────────────────────────────────── */}
          {topView === 'dashboard' && sideView === 'connections' && (
            <motion.div key="connections" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full">
              <ConnectionsPanel nodes={activeNodes} anchorConnections={anchorConnections} />
            </motion.div>
          )}

          {/* ── ARCHIVES (side nav) ─────────────────────────────────────────── */}
          {topView === 'dashboard' && sideView === 'archives' && (
            <motion.div key="archives" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full">
              <ArchivesPanel nodes={activeNodes} onDelete={handleDeleteNode} onToggleComplete={handleToggleComplete} />
            </motion.div>
          )}

          {/* ── HISTORY (side nav) ──────────────────────────────────────────── */}
          {topView === 'dashboard' && sideView === 'history' && (
            <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full">
              <HistoryPanel nodes={activeNodes} onDeleteHistory={handleDeleteHistory} />
            </motion.div>
          )}

          {/* ── DASHBOARD CANVAS (main node view) ───────────────────────────── */}
          {topView === 'dashboard' && sideView === 'nodes' && (
            <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full">
              <AnimatePresence>
                {!focusedNodeId ? (
                  /* ── Node Canvas ─────────────────────────────────────── */
                  <motion.div
                    key="canvas"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className={cn(
                      "relative w-full h-full overflow-hidden touch-pan-x touch-pan-y select-none",
                      isPanMode ? (isPanning ? "cursor-grabbing" : "cursor-grab") : "cursor-default",
                      linkingSourceAnchor ? "cursor-crosshair" : ""
                    )}
                    onDragOver={e => e.preventDefault()}
                    onDrop={handleDrop}
                    onPointerDown={handleCanvasPointerDown}
                    onPointerMove={handleCanvasPointerMove}
                    onPointerUp={handleCanvasPointerUp}
                    onWheel={handleWheel}
                  >
                    <motion.div
                      ref={canvasRef}
                      className="min-w-[1200px] min-h-[800px] relative h-full will-change-transform"
                      animate={{ x: panOffset.x, y: panOffset.y, scale }}
                      transition={isPanning ? { duration: 0 } : { type: 'spring', damping: 25, stiffness: 120 }}
                      style={{
                        transformOrigin: 'top left',
                      }}
                    >
                      {canvasNodes.map(node => {
                        const commonProps = {
                          node,
                          onExpand: handleExpand,
                          onDelete: handleDeleteNode,
                          onToggleComplete: handleToggleComplete,
                          isPanMode,
                          containerRef: canvasRef,
                          linkingSourceAnchor,
                          onStartLink: handleStartLink,
                          onCancelLink: handleCancelLink,
                          onCompleteLink: handleCompleteLink,
                          onNodeMove: handleNodeMove,
                          onUpdateNode: handleUpdateNode,
                          selectedNodeId,
                          onSelectNode: setSelectedNodeId,
                          usedSourceAnchors,
                          usedTargetNodes,
                        };
                        if (node.type === 'concept') return <ConceptNode key={node.id} {...commonProps} />;
                        if (node.type === 'sphere')  return <SphereNode  key={node.id} {...commonProps} />;
                        if (node.type === 'image' || node.imageUrl) return <VisualNode key={node.id} {...commonProps} />;
                        return null;
                      })}
                    </motion.div>
                  </motion.div>
                ) : (
                  /* ── Focused Node Modal ───────────────────────────────── */
                  <motion.div
                    key="focused"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.05 }}
                    className="absolute inset-0 z-50 flex items-center justify-center p-4 md:p-10 lg:p-20 bg-background/50 backdrop-blur-sm overflow-y-auto"
                  >
                    <div className="relative group max-w-4xl w-full my-auto">
                      <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="absolute -top-12 md:-top-16 left-0 bg-primary text-white px-3 md:px-4 py-1.5 md:py-2 border border-black rounded-lg shadow-[4px_4px_0px_#000] flex items-center gap-2 z-20"
                      >
                        <Sparkles className="w-3 md:w-4 h-3 md:h-4" />
                        <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest">AI Study Mode</span>
                        {focusedNode && (
                          <button
                            onClick={() => setShowStudyMode(v => !v)}
                            className="ml-2 text-[7px] font-black uppercase tracking-wider bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded transition-colors"
                          >
                            {showStudyMode ? 'Node Details' : 'Study Mode'}
                          </button>
                        )}
                      </motion.div>

                      <div className="bg-surface rounded-2xl p-6 md:p-12 border-2 border-outline shadow-[4px_4px_0px_0px_var(--color-outline)] md:shadow-[8px_8px_0px_0px_var(--color-outline)] relative overflow-hidden transition-colors duration-300">
                        <div className="absolute top-4 md:top-6 right-4 md:right-6 px-2 md:px-3 py-0.5 md:py-1 bg-surface-container-high border border-outline rounded text-[8px] md:text-[10px] font-black uppercase tracking-widest hidden sm:block">Live Matrix</div>

                        <div className="flex items-start justify-between mb-6 md:mb-10">
                          <div>
                            <div className="flex gap-2 mb-4 md:mb-6 flex-wrap">
                              <span className="bg-primary text-white text-[8px] md:text-[10px] font-black px-2 md:px-3 py-0.5 md:py-1 border border-black rounded uppercase tracking-widest">Core</span>
                              {focusedNode?.status === 'active' && (
                                <span className="bg-secondary text-black text-[8px] md:text-[10px] font-black px-2 md:px-3 py-0.5 md:py-1 border border-black rounded uppercase tracking-widest">Active</span>
                              )}
                              {focusedNode?.isComplete && (
                                <span className="bg-primary text-white text-[8px] md:text-[10px] font-black px-2 md:px-3 py-0.5 md:py-1 border border-black rounded uppercase tracking-widest">✓ Complete</span>
                              )}
                            </div>
                            <h1 className={cn(
                              "text-3xl md:text-5xl font-black text-on-surface mb-4 md:mb-6 uppercase tracking-tight leading-[0.9]",
                              focusedNode?.isComplete && "line-through opacity-60"
                            )}>
                              {focusedNode?.title}
                            </h1>
                            <p 
                              contentEditable 
                              suppressContentEditableWarning
                              onBlur={e => {
                                const text = e.currentTarget.textContent || '';
                                if (text !== focusedNode?.description) {
                                  handleUpdateNode(focusedNodeId!, { description: text });
                                }
                              }}
                              className="text-on-surface-variant text-base md:text-xl font-medium leading-relaxed max-w-2xl outline-none focus:bg-surface-container-low focus:ring-1 focus:ring-outline rounded px-2 -mx-2 transition-colors"
                            >
                              {focusedNode?.description || 'Add a description...'}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 mb-6 md:mb-10">
                          <div className="space-y-4 p-4 md:p-6 bg-surface-container-low border border-outline rounded-xl shadow-[4px_4px_0px_0px_var(--color-outline)]">
                            <h3 className="text-[8px] md:text-[10px] font-black text-on-surface tracking-[2px] uppercase">Data Tags</h3>
                            <div className="flex flex-wrap gap-2 text-on-surface">
                              {focusedNode?.tags?.map(tag => (
                                <span key={tag} className="px-2 py-0.5 md:px-3 md:py-1 bg-surface border border-outline text-[10px] md:text-xs font-bold rounded">#{tag.toLowerCase()}</span>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-4 p-4 md:p-6 bg-primary/5 border border-outline rounded-xl shadow-[4px_4px_0px_rgba(37,99,235,0.2)]">
                            <h3 className="text-[8px] md:text-[10px] font-black text-primary tracking-[2px] uppercase">Neural Insights</h3>
                            <div className="space-y-2 md:space-y-3">
                              {loadingInsights ? (
                                <div className="flex items-center gap-2 text-[10px] text-on-surface font-bold">
                                  <Loader2 className="w-3 h-3 animate-spin" /> CALCULATING…
                                </div>
                              ) : (
                                insights.map((insight, idx) => (
                                  <motion.div
                                    key={idx}
                                    initial={{ opacity: 0, x: -5 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="flex items-center gap-2 text-[10px] md:text-xs text-on-surface font-bold border-b border-on-surface/5 pb-1.5 md:pb-2"
                                  >
                                    <div className="w-1 md:w-1.5 h-1 md:h-1.5 bg-primary rounded-full shrink-0" />
                                    <span className="line-clamp-2">{insight}</span>
                                  </motion.div>
                                ))
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 md:gap-4 pt-6 md:pt-8 border-t border-outline">
                          <button
                            onClick={() => handleToggleComplete(focusedNodeId!)}
                            className="w-full sm:w-auto px-6 md:px-8 py-2.5 md:py-3 bg-primary text-white font-black text-xs md:text-sm uppercase tracking-widest hover:bg-blue-700 transition-all shadow-[4px_4px_0px_rgba(37,99,235,0.3)]"
                          >
                            {focusedNode?.isComplete ? 'Mark Incomplete' : '✓ Mark Complete'}
                          </button>
                          <button
                            onClick={() => { handleDeleteNode(focusedNodeId!); setFocusedNodeId(null); }}
                            className="w-full sm:w-auto px-6 md:px-8 py-2.5 md:py-3 bg-on-surface text-surface font-black text-xs md:text-sm uppercase tracking-widest hover:bg-error transition-all"
                          >
                            Delete Node
                          </button>
                          <button
                            onClick={() => setFocusedNodeId(null)}
                            className="w-full sm:w-auto px-6 md:px-8 py-2.5 md:py-3 bg-transparent text-on-surface font-black text-xs md:text-sm uppercase tracking-widest hover:underline"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Floating UI — only show on canvas view */}
      {showCanvas && !focusedNodeId && (
        <>
          <ThoughtInput 
            activeProjectId={activeProjectId} 
            onAddNode={(title) => handleCreateNode(title)}
          />
          <MiniMap scale={scale} setScale={setScale} />
          <InteractionPalette
            onResetZoom={() => { setScale(1); setPanOffset({ x: 0, y: 0 }); }}
            isPanMode={isPanMode}
            onTogglePan={() => setIsPanMode(v => !v)}
            onToggleSidebar={() => setIsSidebarOpen(v => !v)}
            onAddNode={() => handleCreateNode("New Concept")}
            onExportData={handleExportData}
            onImportData={handleImportData}
            onShareData={handleShareData}
          />
          {/* AI: Think For Me Button */}
          <div className="fixed z-[100] bottom-28 right-16 md:bottom-auto md:top-1/2 md:-translate-y-1/2 md:right-[5.5rem] flex flex-col gap-3">
            <button
              onClick={() => setIsThinkForMeOpen(true)}
              title="Think For Me — AI Full Map Generator"
              className="w-10 h-10 md:w-12 md:h-12 bg-primary border-2 border-outline rounded-xl flex items-center justify-center text-white hover:scale-110 transition-all shadow-[4px_4px_0px_0px_var(--color-outline)]"
            >
              <Sparkles className="w-4 md:w-5 h-4 md:h-5" />
            </button>
            <button
              onClick={() => setIsAssistantOpen(v => !v)}
              title="AI Assistant"
              className={cn(
                "w-10 h-10 md:w-12 md:h-12 border-2 border-outline rounded-xl flex items-center justify-center transition-all shadow-[4px_4px_0px_0px_var(--color-outline)]",
                isAssistantOpen
                  ? "bg-on-surface text-surface"
                  : "bg-surface text-primary hover:bg-primary hover:text-white"
              )}
            >
              <Brain className="w-4 md:w-5 h-4 md:h-5" />
            </button>
            <button
              onClick={handleAutoOrganize}
              title="Auto-Organize Layout"
              className="w-10 h-10 md:w-12 md:h-12 bg-surface border-2 border-outline rounded-xl flex items-center justify-center text-on-surface hover:bg-primary hover:text-white transition-all shadow-[4px_4px_0px_0px_var(--color-outline)]"
            >
              <span className="text-[9px] font-black">⊞</span>
            </button>
            <button
              onClick={handleExportNotes}
              title="Export AI Study Notes"
              className="w-10 h-10 md:w-12 md:h-12 bg-surface border-2 border-outline rounded-xl flex items-center justify-center text-on-surface hover:bg-primary hover:text-white transition-all shadow-[4px_4px_0px_0px_var(--color-outline)]"
            >
              <span className="text-[9px] font-black">📄</span>
            </button>
          </div>
        </>
      )}

      {/* AI: Map Insights Bar */}
      <AnimatePresence>
        {showCanvas && !focusedNodeId && mapInsights.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="fixed bottom-36 left-1/2 -translate-x-1/2 z-[150] flex gap-2 max-w-xl overflow-x-auto pb-1"
          >
            {mapInsights.slice(0, 3).map((insight, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.08 }}
                className="shrink-0 flex items-center gap-2 px-3 py-2 bg-surface border border-outline rounded-xl shadow-[2px_2px_0px_0px_var(--color-outline)] text-[9px] font-bold text-on-surface"
              >
                <span className={cn(
                  "w-1.5 h-1.5 rounded-full shrink-0",
                  insight.type === 'weak_area' ? 'bg-yellow-400' :
                  insight.type === 'over_focus' ? 'bg-red-400' :
                  insight.type === 'missing_topic' ? 'bg-blue-400' : 'bg-primary'
                )} />
                <span>{insight.title}: {insight.detail}</span>
                <button
                  onClick={() => setMapInsights(prev => prev.filter((_, idx) => idx !== i))}
                  className="text-on-surface-variant hover:text-error ml-1"
                >
                  ×
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI: Ghost Connection Suggestions */}
      <AnimatePresence>
        {showCanvas && !focusedNodeId && ghostConnections.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[150] flex gap-2"
          >
            {ghostConnections.slice(0, 2).map((sugg, i) => {
              const from = nodes.find(n => n.id === sugg.fromId);
              const to = nodes.find(n => n.id === sugg.toId);
              if (!from || !to) return null;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-2 px-3 py-2 bg-surface/90 backdrop-blur-sm border border-primary/40 rounded-xl shadow-[2px_2px_0px_0px_rgba(37,99,235,0.2)] text-[9px] font-bold text-on-surface"
                >
                  <Sparkles className="w-3 h-3 text-primary shrink-0" />
                  <span className="text-primary">Suggested:</span>
                  <span>{from.title}</span>
                  <span className="text-on-surface-variant">→</span>
                  <span>{to.title}</span>
                  <button
                    onClick={() => handleAcceptSuggestion(sugg)}
                    className="ml-1 px-2 py-0.5 bg-primary text-white rounded-md hover:bg-primary/80 transition-colors text-[8px] font-black uppercase"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => setGhostConnections(prev => prev.filter((_, idx) => idx !== i))}
                    className="text-on-surface-variant hover:text-error"
                  >
                    ×
                  </button>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI: Node Expanding Spinner */}
      <AnimatePresence>
        {isExpandingNode && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[250] flex flex-col items-center gap-3 px-6 py-4 bg-surface border-2 border-outline rounded-2xl shadow-[6px_6px_0px_0px_var(--color-outline)]"
          >
            <div className="relative w-10 h-10">
              <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
              <div className="absolute inset-0 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <Sparkles className="absolute inset-0 m-auto w-4 h-4 text-primary" />
            </div>
            <p className="text-[9px] font-black uppercase tracking-widest text-on-surface">AI Expanding Node...</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI: Think For Me Modal */}
      <ThinkForMeModal
        isOpen={isThinkForMeOpen}
        onClose={() => setIsThinkForMeOpen(false)}
        onMapGenerated={handleThinkForMeResult}
        activeProjectId={activeProjectId}
      />

      {/* AI: Floating Assistant */}
      <AnimatePresence>
        {isAssistantOpen && (
          <AIAssistantPanel
            nodes={activeNodes}
            anchorConnections={anchorConnections}
            isOpen={isAssistantOpen}
            onClose={() => setIsAssistantOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Ambient grain */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] mix-blend-overlay bg-[url('https://www.transparenttextures.com/patterns/pinstriped-suit.png')]" />
      
      {/* Hidden File Input for Data Import */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="application/json"
        style={{ display: 'none' }}
      />
    </div>
  );
}
