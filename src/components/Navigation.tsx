import React, { useState } from 'react';
import { Search, Settings, Network, Activity, Archive, History, HelpCircle, Menu, X, Plus, Trash2, ChevronRight, BarChart2, LayoutDashboard, FolderKanban } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import type { Project, ThoughtNode } from '@/src/types';

export type TopNavView = 'dashboard' | 'projects' | 'analytics';
export type SideNavView = 'nodes' | 'connections' | 'archives' | 'history';

interface NavProps {
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  projects?: Project[];
  activeProjectId?: string;
  onSwitchProject?: (id: string) => void;
  onCreateProject?: (name: string, emoji?: string) => void;
  onDeleteProject?: (id: string) => void;
  nodeCount?: number;
  // Top nav
  topView?: TopNavView;
  onTopViewChange?: (v: TopNavView) => void;
  // Side nav
  sideView?: SideNavView;
  onSideViewChange?: (v: SideNavView) => void;
}

// ── TopNav ────────────────────────────────────────────────────────────────────
export function TopNav({
  onToggleSidebar,
  topView = 'dashboard',
  onTopViewChange,
  nodeCount = 0,
  activeProjectId = 'default',
  projects = [],
}: Pick<NavProps, 'onToggleSidebar' | 'topView' | 'onTopViewChange' | 'nodeCount' | 'activeProjectId' | 'projects'>) {

  const activeProject = projects.find(p => p.id === activeProjectId);
  const completePercent = Math.min(100, nodeCount * 5);

  return (
    <header className="fixed top-0 left-0 w-full z-[65] h-[64px] md:h-[72px] flex justify-between items-center px-4 md:px-10 bg-surface border-b border-outline transition-colors duration-300">
      <div className="flex items-center gap-4 md:gap-10">
        <button
          onClick={onToggleSidebar}
          className="p-2 border border-outline rounded-lg md:hidden hover:bg-surface-container-low transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-lg md:text-xl font-extrabold tracking-tighter text-on-surface uppercase font-headline">Thought.OS</h1>

        {/* Main nav tabs */}
        <nav className="hidden md:flex items-center gap-1">
          {([
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'projects',  label: 'Projects',  icon: FolderKanban },
            { id: 'analytics', label: 'Analytics', icon: BarChart2 },
          ] as { id: TopNavView; label: string; icon: any }[]).map(item => (
            <button
              key={item.id}
              onClick={() => onTopViewChange?.(item.id)}
              className={cn(
                "px-4 py-1.5 rounded-lg text-sm font-semibold font-headline uppercase leading-none transition-all",
                topView === item.id
                  ? "bg-primary text-white"
                  : "text-on-surface opacity-60 hover:opacity-100 hover:bg-surface-container-low"
              )}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Right — Status + Neural Load + search */}
      <div className="flex items-center gap-3 md:gap-4">
        {/* Status: Nominal pill */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-background border border-outline rounded-full shadow-[2px_2px_0px_0px_var(--color-outline)] whitespace-nowrap">
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse border border-outline" />
          <span className="text-[9px] font-black text-on-surface uppercase tracking-widest">Status: Nominal</span>
        </div>

        {/* Neural Load mini bar */}
        <div className="hidden xl:flex items-center gap-2 bg-background px-3 py-1.5 border border-outline rounded-xl shadow-[2px_2px_0px_0px_var(--color-outline)] w-44">
          <Activity className="w-3.5 h-3.5 text-on-surface shrink-0" />
          <div className="flex-grow">
            <div className="flex justify-between items-center mb-0.5">
              <span className="text-[8px] font-black uppercase tracking-wider text-on-surface">Neural Load</span>
              <span className="text-[8px] font-black text-primary">{completePercent}%</span>
            </div>
            <div className="w-full h-1 bg-surface-container-high border border-outline rounded-full overflow-hidden">
              <motion.div animate={{ width: `${completePercent}%` }} className="h-full bg-primary" />
            </div>
          </div>
        </div>

        {/* Project badge */}
        {activeProject && (
          <div className="hidden md:flex items-center gap-1.5 px-2 py-1 bg-primary/10 border border-primary/30 rounded-lg">
            <span className="text-sm">{activeProject.emoji}</span>
            <span className="text-[9px] font-black text-primary uppercase tracking-wider truncate max-w-[80px]">{activeProject.name}</span>
          </div>
        )}

        <div className="h-4 w-[1px] bg-on-surface opacity-10 hidden sm:block" />

        {/* Search */}
        <div className="relative group hidden sm:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant w-4 h-4" />
          <input
            type="text"
            placeholder="Search..."
            className="bg-background border border-outline rounded-lg py-1.5 pl-10 pr-4 text-xs w-28 md:w-40 focus:ring-0 focus:border-primary transition-all duration-300 text-on-surface"
          />
        </div>

        <div className="text-[10px] md:text-sm font-semibold text-on-surface uppercase">
          {new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit' })}
        </div>
      </div>
    </header>
  );
}

// ── SideNav ───────────────────────────────────────────────────────────────────
export function SideNav({
  isSidebarOpen,
  onToggleSidebar,
  projects = [],
  activeProjectId = 'default',
  onSwitchProject,
  onCreateProject,
  onDeleteProject,
  nodeCount = 0,
  sideView = 'nodes',
  onSideViewChange,
}: NavProps) {
  const [sidebarTab, setSidebarTab] = useState<'nav' | 'projects'>('nav');
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectEmoji, setNewProjectEmoji] = useState('📁');
  const [showForm, setShowForm] = useState(false);

  const navItems: { id: SideNavView; label: string; icon: any }[] = [
    { id: 'nodes',       label: 'Nodes',       icon: Network },
    { id: 'connections', label: 'Connections',  icon: Activity },
    { id: 'archives',    label: 'Archives',     icon: Archive },
    { id: 'history',     label: 'History',      icon: History },
  ];

  const handleCreateProject = () => {
    if (!newProjectName.trim()) return;
    onCreateProject?.(newProjectName.trim(), newProjectEmoji);
    setNewProjectName('');
    setNewProjectEmoji('📁');
    setShowForm(false);
  };

  const activeProject = projects.find(p => p.id === activeProjectId);

  return (
    <>
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onToggleSidebar}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[55] md:hidden"
          />
        )}
      </AnimatePresence>

      <aside className={cn(
        "fixed left-0 top-0 h-full z-[60] w-72 bg-surface border-r border-outline pt-[64px] md:pt-[72px] flex flex-col pb-6 transition-all duration-300 ease-in-out md:translate-x-0",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Mobile close */}
        <div className="flex justify-between items-center md:hidden px-6 pt-4 pb-2">
          <h2 className="text-sm font-black uppercase text-on-surface">Menu</h2>
          <button onClick={onToggleSidebar} className="p-2 border border-outline rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col gap-5 flex-1 overflow-y-auto min-h-0 px-6 pt-6">
          {/* System Core */}
          <div className="p-4 border border-outline rounded-xl bg-background shadow-[4px_4px_0px_0px_var(--color-outline)]">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-black text-on-surface uppercase tracking-[2px] font-headline">System Core</h2>
              {activeProject && (
                <span className="text-[9px] font-black text-primary uppercase">{activeProject.emoji}</span>
              )}
            </div>
            <div className="h-1 w-full bg-surface-container-high border border-outline rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-primary"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, (nodeCount / 20) * 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-on-surface-variant font-bold mt-2 uppercase">{nodeCount} nodes active</p>
          </div>

          {/* Tab Toggle */}
          <div className="flex gap-2">
            {(['nav', 'projects'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setSidebarTab(tab)}
                className={cn("flex-1 py-1.5 text-[10px] font-black uppercase border rounded-lg transition-all",
                  sidebarTab === tab ? "bg-primary text-white border-primary" : "bg-transparent text-on-surface border-outline hover:bg-surface-container-low")}
              >
                {tab === 'nav' ? 'Navigate' : 'Projects'}
              </button>
            ))}
          </div>

          {/* Navigation View */}
          {sidebarTab === 'nav' && (
            <nav className="space-y-1.5">
              <p className="text-[10px] font-black text-on-surface-variant tracking-[1px] uppercase px-2 mb-2">Navigation</p>
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onSideViewChange?.(item.id)}
                  className={cn(
                    "w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all duration-200",
                    sideView === item.id
                      ? "bg-primary text-white border-primary shadow-[4px_4px_0px_rgba(37,99,235,0.3)]"
                      : "bg-transparent text-on-surface border-transparent hover:border-outline hover:bg-surface-container-low"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <item.icon className="w-4 h-4" />
                    <span className="text-sm font-bold uppercase">{item.label}</span>
                  </div>
                  {sideView === item.id && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                </button>
              ))}
            </nav>
          )}

          {/* Projects View */}
          {sidebarTab === 'projects' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <p className="text-[10px] font-black text-on-surface-variant tracking-[1px] uppercase">Projects</p>
                <button
                  onClick={() => setShowForm(v => !v)}
                  className="w-6 h-6 border border-outline rounded-md flex items-center justify-center text-on-surface hover:bg-primary hover:text-white hover:border-primary transition-all"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>

              <AnimatePresence>
                {showForm && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-3 border border-outline rounded-xl bg-surface-container-low space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newProjectEmoji}
                          onChange={e => setNewProjectEmoji(e.target.value)}
                          className="w-10 text-center bg-background border border-outline rounded-lg py-1 text-sm focus:ring-0 focus:border-primary"
                          placeholder="📁"
                          maxLength={2}
                        />
                        <input
                          type="text"
                          value={newProjectName}
                          onChange={e => setNewProjectName(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleCreateProject()}
                          className="flex-1 bg-background border border-outline rounded-lg py-1 px-3 text-xs font-bold uppercase focus:ring-0 focus:border-primary text-on-surface"
                          placeholder="Project name..."
                        />
                      </div>
                      <button
                        onClick={handleCreateProject}
                        className="w-full py-1.5 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-blue-700 transition-all"
                      >
                        Create Project
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-1.5 overflow-y-auto max-h-56">
                {projects.map(project => (
                  <div
                    key={project.id}
                    onClick={() => onSwitchProject?.(project.id)}
                    className={cn(
                      "group flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all duration-200 cursor-pointer",
                      project.id === activeProjectId
                        ? "bg-primary/10 border-primary text-primary"
                        : "border-transparent hover:border-outline hover:bg-surface-container-low text-on-surface"
                    )}
                  >
                    <span className="text-lg">{project.emoji || '📁'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-black uppercase truncate">{project.name}</p>
                    </div>
                    {project.id === activeProjectId && <ChevronRight className="w-3 h-3 shrink-0" />}
                    {project.id !== 'default' && (
                      <button
                        onClick={e => { e.stopPropagation(); onDeleteProject?.(project.id); }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-error transition-all"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
                {projects.length === 0 && (
                  <p className="text-[10px] text-on-surface-variant text-center py-4 uppercase">No projects yet</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Actions */}
        <div className="border-t border-outline px-6 pt-4 space-y-1">
          <button
            onClick={() => document.documentElement.classList.toggle('dark')}
            className="w-full flex items-center gap-4 px-4 py-2 text-on-surface font-bold uppercase text-[11px] hover:text-primary transition-all"
          >
            <Settings className="w-4 h-4" />
            <span>Theme Configuration</span>
          </button>
          <button className="w-full flex items-center gap-4 px-4 py-2 text-on-surface font-bold uppercase text-[11px] hover:underline transition-all">
            <HelpCircle className="w-4 h-4" />
            <span>Documentation</span>
          </button>
        </div>
      </aside>
    </>
  );
}
