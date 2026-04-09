import { Eye, EyeOff, Github, Trash2, X } from 'lucide-react';
import React, { useState } from 'react';
import { useUiStore } from '../integration/store/uiStore';
import { getAuthenticatedUser } from '../core/integrations/github';

interface GitHubModalProps {
  onClose: () => void;
}

const STORAGE_KEY = 'github-config';

const GitHubModal: React.FC<GitHubModalProps> = ({ onClose }) => {
  const { githubConfig, setGithubConfig, githubError, setGitHubModalOpen } = useUiStore();

  const [pat, setPat] = useState<string>(githubConfig.pat || '');
  const [showPat, setShowPat] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isErrorExpanded, setIsErrorExpanded] = useState(false);

  const handleSave = async () => {
    const trimmed = pat.trim();
    if (!trimmed) return;

    setIsValidating(true);
    try {
      const user = await getAuthenticatedUser(trimmed);
      const config = { pat: trimmed, username: user.login };
      setGithubConfig(config);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      } catch (e) {
        console.error('Failed to save GitHub config', e);
      }
      setGitHubModalOpen(false, null);
      onClose();
    } catch (e: any) {
      const msg = e?.message || 'Failed to validate GitHub token';
      setGitHubModalOpen(true, msg);
    } finally {
      setIsValidating(false);
    }
  };

  const handleClear = () => {
    const emptyConfig = { pat: '', username: '' };
    setPat('');
    setGithubConfig(emptyConfig);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(emptyConfig));
    } catch (e) {
      console.error('Failed to clear GitHub config', e);
    }
  };

  const isSaved = !!githubConfig.pat;

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-6 pointer-events-auto overflow-hidden">
      <div
        onClick={onClose}
        className="absolute inset-0 bg-white/60 backdrop-blur-xl"
      />
      <div
        className="relative w-full max-w-md bg-white rounded-[40px] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.1)] p-8 md:p-10 border border-zinc-100"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-zinc-300 hover:text-zinc-600 transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>

        <div className="max-w-md mx-auto">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <Github size={28} className="text-darkDelegation" />
              <h2 className="text-3xl font-black text-darkDelegation tracking-tight">
                GitHub Token
              </h2>
            </div>
            <a
              href="https://github.com/settings/tokens/new?scopes=repo&description=Office-Agent"
              target="_blank"
              rel="noopener"
              className="group inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 hover:border-emerald-200 rounded-full transition-all duration-200 mb-3"
            >
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600">Get a GitHub PAT</span>
              <svg className="text-emerald-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="7" y1="17" x2="17" y2="7"></line>
                <polyline points="7 7 17 7 17 17"></polyline>
              </svg>
            </a>
            <p className="text-zinc-400 text-sm font-medium leading-relaxed max-w-[280px]">
              Required for the Engineering Team to push code. Needs <code className="px-1 rounded bg-zinc-100 text-zinc-600">repo</code> scope. Stored locally only.
            </p>
            {isSaved && githubConfig.username && (
              <p className="mt-2 text-xs font-medium text-emerald-600">
                Connected as @{githubConfig.username}
              </p>
            )}
          </div>

          {/* Error Message */}
          {githubError && (() => {
            const isLongError = githubError.length > 120;
            const displayError = isErrorExpanded || !isLongError ? githubError : githubError.slice(0, 110) + '...';

            return (
              <div className="mb-6 p-3 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-2 animate-in fade-in slide-in-from-top-2">
                <div className="mt-0.5 text-red-500 shrink-0">
                  <X size={14} strokeWidth={3} className="rotate-45" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-wider text-red-500 mb-0.5">GitHub Error</p>
                  <div className={`${isErrorExpanded ? 'max-h-48' : 'max-h-24'} overflow-y-auto pr-1`}>
                    <p className="text-[11px] font-medium text-red-600 leading-tight break-words whitespace-pre-wrap">
                      {displayError}
                    </p>
                    {isLongError && (
                      <button
                        onClick={() => setIsErrorExpanded(!isErrorExpanded)}
                        className="mt-1 text-[9px] font-black uppercase tracking-widest text-red-500 hover:text-red-700 transition-colors cursor-pointer"
                      >
                        {isErrorExpanded ? 'Show Less' : 'Show More'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* PAT input */}
          <div className="mb-10">
            <label className="block text-[11px] font-black uppercase tracking-[0.2em] text-zinc-300 mb-4 ml-1">
              Personal Access Token
            </label>
            <div className="relative group">
              <input
                type={showPat ? 'text' : 'password'}
                value={pat}
                onChange={(e) => setPat(e.target.value)}
                placeholder="ghp_..."
                className="w-full bg-zinc-50 border border-zinc-100 rounded-3xl px-6 py-4 pr-14 text-sm text-darkDelegation font-mono placeholder:text-zinc-300 placeholder:font-sans focus:outline-none focus:border-zinc-200 transition-all shadow-sm group-hover:shadow-md"
              />
              <button
                type="button"
                onClick={() => setShowPat(v => !v)}
                className="absolute right-5 top-1/2 -translate-y-1/2 text-zinc-200 hover:text-zinc-400 transition-colors cursor-pointer"
              >
                {showPat ? <EyeOff size={20} strokeWidth={2.5} /> : <Eye size={20} strokeWidth={2.5} />}
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <button
              onClick={handleClear}
              disabled={!isSaved && !pat}
              className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-zinc-400 hover:text-red-400 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed group"
            >
              <div className="p-2 rounded-xl group-hover:bg-red-50 transition-colors">
                <Trash2 size={16} strokeWidth={2.5} />
              </div>
              Clear
            </button>

            <button
              onClick={handleSave}
              disabled={!pat.trim() || isValidating}
              className="px-12 py-4 bg-darkDelegation text-white rounded-[24px] text-xs font-black uppercase tracking-[0.2em] hover:bg-black transition-all active:scale-95 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100 shadow-xl shadow-black/10"
            >
              {isValidating ? 'Validating...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GitHubModal;
