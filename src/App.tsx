/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { Sparkles, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { ThoughtNode, Project } from './types';
import { geminiService } from './services/gemini';
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
  const [isSidebarOpen, setIsSidebarOpen]         = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);

  // ── Socket ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    socket.on('init_projects', (data: Project[]) => setProjects(data));
    socket.on('project_created', (proj: Project) => setProjects(prev => [...prev, proj]));
    socket.on('project_deleted', (id: string) => {
      setProjects(prev => prev.filter(p => p.id !== id));
      if (activeProjectId === id) setActiveProjectId('default');
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
      setNodes(prev => prev.filter(n => n.id !== id));
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
    socket.emit('switch_project', id);
    setFocusedNodeId(null);
  }, []);

  const handleCreateProject = useCallback((name: string, emoji?: string) => {
    socket.emit('project_create', { name, emoji });
  }, []);

  const handleDeleteProject = useCallback((id: string) => {
    if (!window.confirm('Delete this project and all its nodes?')) return;
    socket.emit('project_delete', id);
  }, []);

  // ── Node actions ───────────────────────────────────────────────────────────
  const handleExpand = (id: string) => {
    setFocusedNodeId(id === focusedNodeId ? null : id);
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const handleDeleteNode = useCallback((id: string) => {
    socket.emit('node_delete', id);
  }, []);

  const handleToggleComplete = useCallback((id: string) => {
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

  // ── Node interactions ────────────────────────────────────────────────────────
  const [linkingSourceId, setLinkingSourceId] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const handleNodeMove = useCallback((id: string, x: number, y: number) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, x, y } : n));
  }, []);

  const handleUpdateNode = useCallback((id: string, updates: Partial<ThoughtNode>) => {
    socket.emit('node_update', { id, updates });
    setNodes(prev => prev.map(n => n.id === id ? { ...n, ...updates } : n));
  }, []);

  const handleStartLink = useCallback((id: string) => setLinkingSourceId(id), []);
  const handleCancelLink = useCallback(() => setLinkingSourceId(null), []);
  const handleCompleteLink = useCallback((targetId: string) => {
    if (linkingSourceId && linkingSourceId !== targetId) {
      socket.emit('node_connect', { sourceId: linkingSourceId, targetId });
    }
    setLinkingSourceId(null);
  }, [linkingSourceId]);

  // ── Pan/Link handlers ────────────────────────────────────────────────────────
  const handleCanvasPointerDown = useCallback((e: React.PointerEvent) => {
    // If linking, clicking canvas cancels link
    if (linkingSourceId) {
      setLinkingSourceId(null);
      return;
    }
    if (!isPanMode) return;
    if ((e.target as HTMLElement).closest('[class*="absolute group"]')) return;
    setIsPanning(true);
    panStart.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, [isPanMode, panOffset, linkingSourceId]);

  const handleCanvasPointerMove = useCallback((e: React.PointerEvent) => {
    if (linkingSourceId && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
    if (!isPanning || !panStart.current) return;
    setPanOffset({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y });
  }, [isPanning, linkingSourceId]);

  const handleCanvasPointerUp = useCallback(() => {
    setIsPanning(false);
    panStart.current = null;
  }, []);

  // ── Derived data ───────────────────────────────────────────────────────────
  const activeNodes = nodes.filter(n => !n.projectId || n.projectId === activeProjectId);

  // When sideView is 'archives', show only completed nodes in canvas
  const canvasNodes = sideView === 'archives'
    ? activeNodes.filter(n => n.isComplete || n.status === 'archived')
    : activeNodes;

  // ── Non-canvas view detection ─────────────────────────────────────────────
  const showCanvas   = topView === 'dashboard' && sideView === 'nodes';

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-background">
      {/* Background  – only show on canvas */}
      {showCanvas && <NeuralCanvas nodes={activeNodes} linkingSourceId={linkingSourceId} mousePos={mousePos} />}

      {/* TopNav */}
      <TopNav
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
        "md:pl-72"
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
              />
            </motion.div>
          )}

          {/* ── CONNECTIONS (side nav) ───────────────────────────────────────── */}
          {topView === 'dashboard' && sideView === 'connections' && (
            <motion.div key="connections" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full">
              <ConnectionsPanel nodes={activeNodes} />
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
              <HistoryPanel nodes={activeNodes} />
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
                      linkingSourceId ? "crosshair" : ""
                    )}
                    onDragOver={e => e.preventDefault()}
                    onDrop={handleDrop}
                    onPointerDown={handleCanvasPointerDown}
                    onPointerMove={handleCanvasPointerMove}
                    onPointerUp={handleCanvasPointerUp}
                  >
                    <div
                      ref={canvasRef}
                      className="min-w-[1200px] min-h-[800px] relative h-full will-change-transform"
                      style={{
                        transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${scale})`,
                        transformOrigin: 'top left',
                      }}
                    >
                      {canvasNodes.map(node => {
                        const commonProps = {
                          key: node.id,
                          node,
                          onExpand: handleExpand,
                          onDelete: handleDeleteNode,
                          onToggleComplete: handleToggleComplete,
                          isPanMode,
                          containerRef: canvasRef,
                          linkingSourceId,
                          onStartLink: handleStartLink,
                          onCancelLink: handleCancelLink,
                          onCompleteLink: handleCompleteLink,
                          onNodeMove: handleNodeMove,
                          onUpdateNode: handleUpdateNode
                        };
                        if (node.type === 'concept') return <ConceptNode {...commonProps} />;
                        if (node.type === 'sphere')  return <SphereNode  {...commonProps} />;
                        if (node.type === 'image' || node.imageUrl) return <VisualNode {...commonProps} />;
                        return null;
                      })}
                    </div>
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
                        <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest">AI_COORDINATOR_v1</span>
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
          <ThoughtInput activeProjectId={activeProjectId} />
          <MiniMap scale={scale} setScale={setScale} />
          <InteractionPalette
            onResetZoom={() => { setScale(1); setPanOffset({ x: 0, y: 0 }); }}
            isPanMode={isPanMode}
            onTogglePan={() => setIsPanMode(v => !v)}
          />
        </>
      )}

      {/* Ambient grain */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] mix-blend-overlay bg-[url('https://www.transparenttextures.com/patterns/pinstriped-suit.png')]" />
    </div>
  );
}
