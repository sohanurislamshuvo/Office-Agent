import { create } from 'zustand';
import { getAllAgents } from '../../data/agents';
import { AgentState, CharacterState } from '../../types';
import { useTeamStore, getActiveAgentSet } from './teamStore';
import { DEFAULT_MODELS } from '../../core/llm/constants';

const getInitialTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'light';
  try {
    const saved = localStorage.getItem('app-theme');
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {}
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const applyThemeToDom = (theme: 'light' | 'dark') => {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', theme === 'dark');
};

// Apply once at module load so the initial paint matches the persisted theme
applyThemeToDom(getInitialTheme());

export const useUiStore = create<CharacterState>()(
  (set) => ({
    isThinking: false,
    instanceCount: getAllAgents(getActiveAgentSet()).length + 1, // +1 for user

    selectedNpcIndex: null,
    selectedPosition: null,
    hoveredNpcIndex: null,
    hoveredPoiId: null,
    hoveredPoiLabel: null,
    hoverPosition: null,
    npcScreenPositions: {},
    isChatting: false,
    isTyping: false,
    chatMessages: [],
    inspectorTab: 'info',
    agentStatuses: {},
    setAgentStatus: (index: number, status: AgentState) => set((s) => ({
      agentStatuses: { ...s.agentStatuses, [index]: status }
    })),

    isBYOKOpen: false,
    byokError: null,
    setBYOKOpen: (open: boolean, error: string | null = null) =>
      set({ isBYOKOpen: open, byokError: error }),

    activeAuditTaskId: null,
    setActiveAuditTaskId: (taskId: string | null) => set({ activeAuditTaskId: taskId }),

    llmConfig: (() => {
      try {
        const saved = localStorage.getItem('byok-config');
        if (saved) {
          const parsed = JSON.parse(saved);
          // Migration: copy legacy apiKey into providerKeys.gemini
          if (parsed.apiKey && !parsed.providerKeys) {
            parsed.providerKeys = { gemini: parsed.apiKey };
          }
          if (!parsed.providerKeys) parsed.providerKeys = {};
          return parsed;
        }
      } catch { }
      return {
        apiKey: '',
        model: DEFAULT_MODELS.text,
        providerKeys: {}
      };
    })(),

    githubConfig: (() => {
      try {
        const saved = localStorage.getItem('github-config');
        if (saved) return JSON.parse(saved);
      } catch { }
      return { pat: '', username: '' };
    })(),
    isGitHubModalOpen: false,
    githubError: null,
    setGitHubModalOpen: (open: boolean, error: string | null = null) =>
      set({ isGitHubModalOpen: open, githubError: error }),
    setGithubConfig: (config) => set((s) => ({ githubConfig: { ...s.githubConfig, ...config } })),

    theme: getInitialTheme(),
    setTheme: (theme: 'light' | 'dark') => {
      try { localStorage.setItem('app-theme', theme); } catch {}
      applyThemeToDom(theme);
      set({ theme });
    },
    toggleTheme: () => set((s) => {
      const next: 'light' | 'dark' = s.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('app-theme', next); } catch {}
      applyThemeToDom(next);
      return { theme: next };
    }),

    setThinking: (isThinking: boolean) => set({ isThinking }),
    setIsTyping: (isTyping: boolean) => set({ isTyping }),
    setInspectorTab: (tab: 'info' | 'chat') => set({ inspectorTab: tab }),
    setInstanceCount: (count: number) => set({ instanceCount: count }),

    setSelectedNpc: (index: number | null) => set({
      selectedNpcIndex: index,
      selectedPosition: null,
    }),
    setSelectedPosition: (pos: { x: number; y: number } | null) => set({ selectedPosition: pos }),
    setHoveredNpc: (index: number | null, pos: { x: number; y: number } | null) => set({
      hoveredNpcIndex: index,
      hoverPosition: pos,
      hoveredPoiId: null,
      hoveredPoiLabel: null,
    }),
    setHoveredPoi: (id: string | null, label: string | null, pos: { x: number; y: number } | null) => set({
      hoveredPoiId: id,
      hoveredPoiLabel: label,
      hoverPosition: pos,
      hoveredNpcIndex: null,
    }),
    setLlmConfig: (config) => set((s) => ({ llmConfig: { ...s.llmConfig, ...config } })),
    setChatting: (isChatting: boolean) => set((s) => ({ 
      isChatting, 
      isTyping: isChatting ? s.isTyping : false,
      isThinking: isChatting ? s.isThinking : false,
      chatMessages: isChatting ? s.chatMessages : []
    })),
  })
);

// Keep instanceCount in sync whenever the active agent set changes
useTeamStore.subscribe((state, prevState) => {
  if (state.selectedAgentSetId !== prevState.selectedAgentSetId) {
    const system = getActiveAgentSet();
    useUiStore.getState().setInstanceCount(getAllAgents(system).length + 1);
  }
});
