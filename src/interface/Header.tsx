import { Github, KeyRound, Maximize2, Moon, Settings, Sun } from 'lucide-react';
import React from 'react';
import { useCoreStore } from '../integration/store/coreStore';
import { useUiStore } from '../integration/store/uiStore';
import BYOKModal from './BYOKModal';
import GitHubModal from './GitHubModal';

const Header: React.FC = () => {
  const { llmConfig, isBYOKOpen, setBYOKOpen, theme, toggleTheme, githubConfig, isGitHubModalOpen, setGitHubModalOpen } = useUiStore();
  const { setViewMode } = useCoreStore();
  const hasKey = !!llmConfig.apiKey;
  const hasGithubPat = !!githubConfig.pat;

  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  return (
    <header className="h-14 border-b border-zinc-100 flex items-center justify-between px-6 bg-white shrink-0 relative z-40">
      {/* Left: Brand + Author Link */}
      <div className="flex items-center gap-4 min-w-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-darkDelegation flex items-center justify-center shadow-sm">
            <span className="text-white text-xs font-black">OA</span>
          </div>
          <span className="text-sm font-black tracking-tight text-zinc-800">
            Office<span className="text-darkDelegation">-Agent</span>
          </span>
        </div>
        <div className="w-px h-4 bg-zinc-200" />
        <a
          href="https://github.com/sohanurislamshuvo"
          target="_blank"
          rel="noopener"
          className="flex items-center gap-1.5 text-[10px] font-medium text-zinc-400 hover:text-darkDelegation transition-colors"
          title="View on GitHub"
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path></svg>
          @sohanurislamshuvo
        </a>
      </div>

      {/* Right: Global Controls */}
      <div className="flex items-center gap-3">

        <button
          onClick={() => setViewMode('design')}
          className="flex items-center gap-2 px-3 py-1 bg-darkDelegation hover:bg-darkDelegation text-white rounded-lg transition-all shadow-lg shadow-black/10 active:scale-95 cursor-pointer h-9 shrink-0 ml-1"
          title="Manage Teams"
        >
          <Settings size={14} className="group-hover:rotate-45 transition-transform" />
          <span className="text-[10px] font-black uppercase tracking-wider ml-1 hidden sm:inline">Manage Teams</span>
        </button>

        <div className="w-px h-4 bg-zinc-200" />

        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="text-zinc-400 hover:text-darkDelegation transition-colors p-1"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button
            onClick={handleFullscreen}
            className="text-zinc-400 hover:text-darkDelegation transition-colors p-1"
            title="Fullscreen Browser"
          >
            <Maximize2 size={16} />
          </button>
          <button
            onClick={() => setBYOKOpen(true)}
            className="relative text-zinc-400 hover:text-darkDelegation transition-colors p-1"
            title="Gemini API Key (BYOK)"
          >
            <KeyRound size={16} className={hasKey ? 'text-emerald-500 hover:text-emerald-600' : ''} />
            {hasKey && (
              <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400" />
            )}
          </button>
          <button
            onClick={() => setGitHubModalOpen(true)}
            className="relative text-zinc-400 hover:text-darkDelegation transition-colors p-1"
            title={hasGithubPat ? `GitHub: connected as @${githubConfig.username}` : 'GitHub Token (for Engineering Team)'}
          >
            <Github size={16} className={hasGithubPat ? 'text-emerald-500 hover:text-emerald-600' : ''} />
            {hasGithubPat && (
              <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400" />
            )}
          </button>
        </div>
      </div>

      {isBYOKOpen && (
        <BYOKModal key="byok-modal" onClose={() => setBYOKOpen(false)} />
      )}
      {isGitHubModalOpen && (
        <GitHubModal key="github-modal" onClose={() => setGitHubModalOpen(false)} />
      )}
    </header>
  );
};

export default Header;
