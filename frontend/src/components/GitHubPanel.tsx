import { useEffect, useState } from 'react';
import apiClient from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import GitHubAnalytics from '@/components/GitHubAnalytics';
import {
  GitBranch, Link2, Loader2, AlertCircle, CheckCircle2,
  GitPullRequest, GitCommit, Box, Download,
  Unlink, ExternalLink, Search, RefreshCw, Zap, BarChart2
} from 'lucide-react';

interface GitHubStatus {
  connected: boolean;
  repo_name?: string;
  repo_url?: string;
  is_active?: boolean;
  connected_at?: string;
  events?: GitHubEvent[];
}
interface GitHubEvent {
  type: string;
  author?: string;
  message?: string;
  branch?: string;
  pr_number?: number;
  sha?: string;
  created_at: string;
}
interface GHRepo {
  full_name: string;
  name: string;
  owner: string;
  private: boolean;
  url: string;
  description: string;
  open_issues_count: number;
}

function getEventIcon(type: string) {
  if (type === 'push')         return <GitCommit className="w-3.5 h-3.5 text-blue-500" />;
  if (type === 'pull_request') return <GitPullRequest className="w-3.5 h-3.5 text-purple-500" />;
  if (type === 'issues')       return <Box className="w-3.5 h-3.5 text-orange-500" />;
  return <GitBranch className="w-3.5 h-3.5 text-gray-400" />;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function GitHubPanel({ projectId }: { projectId: string }) {
  const [status, setStatus] = useState<GitHubStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [subTab, setSubTab] = useState<'overview' | 'analytics'>('overview');

  // Connect form
  const [connectOpen, setConnectOpen] = useState(false);
  const [pat, setPat] = useState('');
  const [repos, setRepos] = useState<GHRepo[]>([]);
  const [repoSearch, setRepoSearch] = useState('');
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<GHRepo | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState('');

  // Import
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  const fetchStatus = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await apiClient.get(`/github/status/${projectId}`);
      setStatus(res.data);
    } catch {}
    finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchStatus(); }, [projectId]);

  const fetchRepos = async () => {
    if (!pat.trim()) return;
    setLoadingRepos(true);
    setConnectError('');
    try {
      const res = await apiClient.get(`/github/repos?token=${encodeURIComponent(pat.trim())}`);
      setRepos(res.data);
    } catch (err: any) {
      setConnectError(err?.response?.data?.detail || 'Invalid token or no repos found');
    } finally {
      setLoadingRepos(false);
    }
  };

  const handleConnect = async () => {
    if (!selectedRepo) return;
    setConnecting(true);
    setConnectError('');
    try {
      await apiClient.post(`/github/connect/${projectId}`, {
        token: pat.trim(),
        repo_full_name: selectedRepo.full_name,
      });
      setConnectOpen(false);
      setPat('');
      setRepos([]);
      setSelectedRepo(null);
      fetchStatus();
    } catch (err: any) {
      setConnectError(err?.response?.data?.detail || 'Connection failed');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm(`Disconnect ${status?.repo_name}? This won't affect your GitHub repo.`)) return;
    try {
      await apiClient.delete(`/github/disconnect/${projectId}`);
      setStatus({ connected: false });
    } catch {}
  };

  const handleImport = async () => {
    setImporting(true);
    setImportResult(null);
    try {
      const res = await apiClient.post(`/github/import-issues/${projectId}`);
      setImportResult(res.data);
    } catch (err: any) {
      setImportResult({ error: err?.response?.data?.detail || 'Import failed' });
    } finally {
      setImporting(false);
    }
  };

  const filteredRepos = repos.filter(r =>
    r.full_name.toLowerCase().includes(repoSearch.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  // ── Not connected ────────────────────────────────────────────────────────────
  if (!status?.connected) {
    return (
      <div className="py-10 flex flex-col items-center text-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-gray-900 flex items-center justify-center">
          <GitBranch className="w-7 h-7 text-white" />
        </div>
        <div>
          <h3 className="text-base font-bold text-gray-900">Connect GitHub Repository</h3>
          <p className="text-sm text-gray-400 mt-1 max-w-sm">
            Link a GitHub repo to sync issues, PRs and commits with this project's tasks automatically.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 w-full max-w-md mt-2">
          {[
            { icon: <Box className="w-4 h-4 text-orange-500" />, label: 'Issues → Tasks', desc: 'Auto-creates tasks from GH issues' },
            { icon: <GitCommit className="w-4 h-4 text-blue-500" />, label: 'Commits', desc: '#42 in message → IN_PROGRESS' },
            { icon: <GitPullRequest className="w-4 h-4 text-purple-500" />, label: 'Pull Requests', desc: 'PR merged → task DONE' },
          ].map(f => (
            <div key={f.label} className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-left">
              {f.icon}
              <p className="text-xs font-bold text-gray-900 mt-2">{f.label}</p>
              <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">{f.desc}</p>
            </div>
          ))}
        </div>

        <Dialog open={connectOpen} onOpenChange={o => { setConnectOpen(o); if (!o) { setPat(''); setRepos([]); setSelectedRepo(null); setConnectError(''); }}}>
          <DialogTrigger asChild>
            <Button className="bg-gray-900 text-white gap-2 mt-2">
              <GitBranch className="w-4 h-4" /> Connect GitHub Repo
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[520px] bg-white flex flex-col max-h-[90vh] overflow-hidden p-0">
            <div className="p-6 pb-0 shrink-0">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <GitBranch className="w-5 h-5" /> Connect GitHub Repository
                </DialogTitle>
              </DialogHeader>
            </div>

            <div className="p-6 py-4 flex-1 overflow-y-auto custom-scrollbar space-y-5">
              {/* Step 1: PAT */}
              <div className="space-y-2">
                <Label>GitHub Personal Access Token (PAT)</Label>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    value={pat}
                    onChange={e => setPat(e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    className="sleek-input font-mono text-sm"
                    onKeyDown={e => e.key === 'Enter' && fetchRepos()}
                  />
                  <Button
                    variant="outline"
                    onClick={fetchRepos}
                    disabled={!pat.trim() || loadingRepos}
                    className="flex-shrink-0 gap-1.5"
                  >
                    {loadingRepos ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    Fetch
                  </Button>
                </div>
                <p className="text-[11px] text-gray-400">
                  Need a token?{' '}
                  <a href="https://github.com/settings/tokens/new?scopes=repo,write:repo_hook" target="_blank" rel="noreferrer" className="text-blue-600 underline">
                    Create one on GitHub
                  </a>{' '}
                  (needs <code className="bg-gray-100 px-1 rounded text-[10px]">repo</code> scope)
                </p>
              </div>

              {/* Step 2: Pick repo */}
              {repos.length > 0 && (
                <div className="space-y-2">
                  <Label>Select Repository</Label>
                  <Input
                    placeholder="Search repos..."
                    value={repoSearch}
                    onChange={e => setRepoSearch(e.target.value)}
                    className="sleek-input"
                  />
                  <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
                    {filteredRepos.map(r => (
                      <button
                        key={r.full_name}
                        onClick={() => setSelectedRepo(r)}
                        className={`w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors ${selectedRepo?.full_name === r.full_name ? 'bg-gray-50 ring-2 ring-inset ring-gray-900' : ''}`}
                      >
                        <GitBranch className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{r.full_name}</p>
                          {r.description && <p className="text-[11px] text-gray-400 truncate">{r.description}</p>}
                        </div>
                        <div className="text-right flex-shrink-0">
                          {r.private && <span className="text-[10px] font-semibold bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">Private</span>}
                          <p className="text-[10px] text-gray-400 mt-0.5">{r.open_issues_count} issues</p>
                        </div>
                      </button>
                    ))}
                    {filteredRepos.length === 0 && (
                      <div className="px-3 py-4 text-center text-sm text-gray-400">No repos match your search</div>
                    )}
                  </div>
                </div>
              )}

              {selectedRepo && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5 flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-900">{selectedRepo.full_name}</p>
                    <p className="text-[11px] text-emerald-700">{selectedRepo.open_issues_count} open issues will be importable</p>
                  </div>
                </div>
              )}

              {connectError && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <p className="text-sm text-red-700">{connectError}</p>
                </div>
              )}
            </div>

            <div className="p-6 pt-3 bg-gray-50 border-t border-gray-100 shrink-0">
              <Button
                onClick={handleConnect}
                disabled={!selectedRepo || connecting}
                className="w-full bg-gray-900 text-white gap-2"
              >
                {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                {connecting ? 'Connecting...' : `Connect ${selectedRepo?.full_name || 'Repository'}`}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ── Connected ────────────────────────────────────────────────────────────────
  const SUB = (tab: string) =>
    `px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
      subTab === tab ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
    }`;

  return (
    <div className="space-y-4">
      {/* Header card */}
      <Card className="sleek-card">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center flex-shrink-0">
                <GitBranch className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-gray-900 text-sm">{status.repo_name}</h3>
                  <a href={status.repo_url} target="_blank" rel="noreferrer"
                    className="text-gray-400 hover:text-gray-900 transition-colors">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                    Active
                  </span>
                  <span className="text-gray-300">•</span>
                  <span className="text-[11px] text-gray-400">
                    Connected {status.connected_at ? timeAgo(status.connected_at) : ''}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchStatus(true)}
                disabled={refreshing}
                className="h-8 w-8 p-0 border-gray-200"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
                className="h-8 gap-1.5 border-red-200 text-red-600 hover:bg-red-50 text-xs"
              >
                <Unlink className="w-3.5 h-3.5" /> Disconnect
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sub-tab switcher */}
      <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        <button className={SUB('overview')} onClick={() => setSubTab('overview')}>
          Overview
        </button>
        <button className={SUB('analytics')} onClick={() => setSubTab('analytics')}>
          <span className="flex items-center gap-1.5">
            <BarChart2 className="w-3 h-3" /> Analytics
          </span>
        </button>
      </div>

      {/* Analytics tab */}
      {subTab === 'analytics' && <GitHubAnalytics projectId={projectId} />}

      {/* Overview tab */}
      {subTab === 'overview' && (<>

      {/* Import issues */}
      <Card className="sleek-card">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-gray-900">Import Open Issues</h4>
              <p className="text-xs text-gray-400 mt-0.5">Pull all open GitHub issues as TODO tasks.</p>
            </div>
            <Button
              size="sm"
              onClick={handleImport}
              disabled={importing}
              className="gap-1.5 h-8 bg-gray-900 text-white"
            >
              {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              {importing ? 'Importing...' : 'Import Issues'}
            </Button>
          </div>
          {importResult && !importResult.error && (
            <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-sm text-emerald-700 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              Imported <strong>{importResult.imported}</strong> issues as tasks
              {importResult.skipped_existing > 0 && ` (${importResult.skipped_existing} already existed)`}
            </div>
          )}
          {importResult?.error && (
            <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
              {importResult.error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* How sync works */}
      <Card className="sleek-card">
        <CardContent className="p-4 space-y-2">
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Auto-Sync Rules</h4>
          {[
            { icon: <Box className="w-3.5 h-3.5 text-orange-500" />, rule: 'Issue opened', result: 'New task created (TODO)' },
            { icon: <Box className="w-3.5 h-3.5 text-orange-500" />, rule: 'Issue closed', result: 'Task → DONE' },
            { icon: <GitCommit className="w-3.5 h-3.5 text-blue-500" />, rule: 'Commit mentions #N', result: 'Task #N → IN_PROGRESS' },
            { icon: <GitPullRequest className="w-3.5 h-3.5 text-purple-500" />, rule: 'PR opened/references #N', result: 'Task #N → IN_REVIEW' },
            { icon: <GitPullRequest className="w-3.5 h-3.5 text-emerald-500" />, rule: 'PR merged', result: 'Task → DONE' },
          ].map(r => (
            <div key={r.rule} className="flex items-center gap-2.5 py-1 border-b border-gray-50 last:border-0">
              {r.icon}
              <span className="text-xs font-semibold text-gray-700 w-44 flex-shrink-0">{r.rule}</span>
              <Zap className="w-3 h-3 text-gray-300 flex-shrink-0" />
              <span className="text-xs text-gray-500">{r.result}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Event feed */}
      {status.events && status.events.length > 0 && (
        <Card className="sleek-card">
          <CardContent className="p-4">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Recent Activity</h4>
            <div className="space-y-2.5">
              {status.events.map((e, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <div className="mt-0.5 flex-shrink-0">{getEventIcon(e.type)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-700 truncate">
                      {e.type === 'push' && e.message && <span className="font-medium">{e.message.split('\n')[0]}</span>}
                      {e.type === 'pull_request' && <span className="font-medium">PR #{e.pr_number}</span>}
                      {e.type === 'issues' && <span className="font-medium">Issue activity</span>}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {e.author && <span className="font-semibold">{e.author}</span>}
                      {e.branch && <> · <GitBranch className="w-2.5 h-2.5 inline" /> {e.branch}</>}
                      {e.sha && <> · <code>{e.sha}</code></>}
                    </p>
                  </div>
                  <span className="text-[10px] text-gray-300 flex-shrink-0">{timeAgo(e.created_at)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {status.events?.length === 0 && (
        <div className="text-center py-6 text-sm text-gray-400">
          <GitBranch className="w-6 h-6 mx-auto mb-2 text-gray-200" />
          No webhook events yet. Push a commit or open an issue to see activity here.
        </div>
      )}
      </>)}
    </div>
  );
}
