'use client';

import { useCallback, useEffect, useState } from 'react';

const PRIORITIES = ['normal', 'high', 'urgent', 'low'];

async function api(url, options) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function DomainInput({ value, onChange, placeholder }) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open || value.trim().length < 2) return setSuggestions([]);
    const t = setTimeout(() => {
      api(`/api/vnoc/domains?q=${encodeURIComponent(value)}`).then((d) => setSuggestions(d.domains)).catch(() => {});
    }, 200);
    return () => clearTimeout(t);
  }, [value, open]);

  return (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-base md:text-sm focus:outline-none focus:border-[#00b894]"
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-gray-700 bg-gray-900 shadow-xl">
          {suggestions.map((d) => (
            <li key={d.domain_id}>
              <button
                type="button"
                onMouseDown={() => { onChange(d.domain_name); setOpen(false); }}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-800"
              >
                {d.domain_name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TaskForm({ domain, sprint, channelId, onCreated }) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('normal');
  const [assignee, setAssignee] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    if (!title.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const { task } = await api('/api/vnoc/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain, sprintId: sprint?.sprint_id, title, priority, assignee, description, channelId }),
      });
      setTitle('');
      setAssignee('');
      setDescription('');
      onCreated?.(task);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={sprint ? `New task in "${sprint.title}"` : `New task for ${domain || 'domain'} (latest sprint)`}
        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-base md:text-sm focus:outline-none focus:border-[#00b894]"
      />
      <div className="flex gap-2">
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="px-2 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm"
        >
          {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <input
          value={assignee}
          onChange={(e) => setAssignee(e.target.value)}
          placeholder="Assignee (name or email)"
          className="flex-1 min-w-0 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-base md:text-sm focus:outline-none focus:border-[#00b894]"
        />
      </div>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Details (optional)"
        rows={2}
        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-base md:text-sm focus:outline-none focus:border-[#00b894] resize-none"
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={!title.trim() || !domain || busy}
        className="w-full py-2 rounded-lg bg-[#00b894] hover:bg-[#00a383] disabled:opacity-40 text-sm font-medium text-white"
      >
        {busy ? 'Adding…' : 'Add task'}
      </button>
    </form>
  );
}

function SprintRow({ sprint, channelId, onTaskAdded }) {
  const [open, setOpen] = useState(false);
  const [tasks, setTasks] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api(`/api/vnoc/sprints/${sprint.sprint_id}/tasks?domain=${encodeURIComponent(sprint.domain_name)}`)
      .then((d) => setTasks(d.tasks))
      .catch((err) => setError(err.message));
  }, [sprint.sprint_id, sprint.domain_name]);

  useEffect(() => { if (open && !tasks) load(); }, [open, tasks, load]);

  const pct = sprint.total_tasks ? Math.round((sprint.closed_tasks / sprint.total_tasks) * 100) : 0;

  return (
    <li className="rounded-xl border border-gray-800 bg-gray-900/60">
      <button onClick={() => setOpen((o) => !o)} className="w-full text-left p-3">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-gray-100">{sprint.title || `Sprint #${sprint.sprint_id}`}</p>
          <span className="text-[10px] text-gray-500 shrink-0">{sprint.closed_tasks}/{sprint.total_tasks}</span>
        </div>
        <p className="text-xs text-gray-500">{sprint.domain_name}{sprint.goal_date ? ` · due ${sprint.goal_date}` : ''}</p>
        <div className="mt-2 h-1 rounded-full bg-gray-800 overflow-hidden">
          <div className="h-full bg-[#00b894]" style={{ width: `${pct}%` }} />
        </div>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-3 border-t border-gray-800 pt-3">
          {error && <p className="text-xs text-red-400">{error}</p>}
          {!tasks && !error && <p className="text-xs text-gray-500">Loading tasks…</p>}
          {tasks?.length === 0 && <p className="text-xs text-gray-500">No tasks yet.</p>}
          {tasks?.length > 0 && (
            <ul className="space-y-1 max-h-60 overflow-y-auto">
              {tasks.map((t) => (
                <li key={t.task_id}>
                  <a href={t.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm hover:text-white text-gray-300">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${t.status === 'done' ? 'bg-[#00b894]' : t.status === 'in_progress' ? 'bg-[#fdcb6e]' : 'bg-gray-600'}`} />
                    <span className="truncate">{t.title}</span>
                    {t.assignee_name && <span className="ml-auto text-[10px] text-gray-500 shrink-0">{t.assignee_name}</span>}
                  </a>
                </li>
              ))}
            </ul>
          )}
          <TaskForm
            domain={sprint.domain_name}
            sprint={sprint}
            channelId={channelId}
            onCreated={(task) => { setTasks(null); onTaskAdded?.(task); }}
          />
        </div>
      )}
    </li>
  );
}

export default function SprintPanel({ open, onClose, defaultDomain, channelId, initialQuery = '' }) {
  const [domain, setDomain] = useState(defaultDomain || '');
  const [query, setQuery] = useState(initialQuery);
  const [sprints, setSprints] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showNewSprint, setShowNewSprint] = useState(false);
  const [newSprintTitle, setNewSprintTitle] = useState('');
  const [newSprintGoal, setNewSprintGoal] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => { if (open) setQuery(initialQuery); }, [open, initialQuery]);

  const search = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ q: query, domain: domain.trim() });
      const data = await api(`/api/vnoc/sprints?${params}`);
      setSprints(data.sprints);
      setIsAdmin(data.isAdmin);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [query, domain]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(search, 250);
    return () => clearTimeout(t);
  }, [open, search]);

  async function createSprint(e) {
    e.preventDefault();
    try {
      await api('/api/vnoc/sprints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain, title: newSprintTitle, goalDate: newSprintGoal, channelId }),
      });
      setNewSprintTitle('');
      setNewSprintGoal('');
      setShowNewSprint(false);
      setNotice('Sprint created.');
      search();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={onClose} />
      <aside
        className="fixed inset-y-0 right-0 z-50 w-full md:w-[420px] flex flex-col bg-gray-950 border-l border-gray-800 shadow-2xl"
        style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <header className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <div>
            <h2 className="font-semibold text-sm">Sprints &amp; tasks</h2>
            <p className="text-[11px] text-gray-500">{isAdmin ? 'Admin: every VNOC domain' : 'Domains you own or are on the team of'}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none px-2" aria-label="Close">×</button>
        </header>

        <div className="p-4 space-y-2 border-b border-gray-800">
          <DomainInput value={domain} onChange={setDomain} placeholder="Domain (blank = all your domains)" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sprints…"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-base md:text-sm focus:outline-none focus:border-[#00b894]"
          />
          <div className="flex gap-2 text-xs">
            <button
              onClick={() => setShowNewSprint((v) => !v)}
              disabled={!domain.trim()}
              className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-40"
              title={domain.trim() ? '' : 'Pick a domain first'}
            >
              + New sprint
            </button>
          </div>
          {showNewSprint && (
            <form onSubmit={createSprint} className="flex gap-2">
              <input
                value={newSprintTitle}
                onChange={(e) => setNewSprintTitle(e.target.value)}
                placeholder={`Sprint title for ${domain}`}
                className="flex-1 min-w-0 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-base md:text-sm"
              />
              <input
                type="date"
                value={newSprintGoal}
                onChange={(e) => setNewSprintGoal(e.target.value)}
                className="px-2 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm"
              />
              <button disabled={!newSprintTitle.trim()} className="px-3 rounded-lg bg-[#00b894] disabled:opacity-40 text-sm">Create</button>
            </form>
          )}
          {notice && <p className="text-xs text-[#00b894]">{notice}</p>}
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {domain.trim() && (
            <section className="rounded-xl border border-gray-800 p-3">
              <p className="text-xs text-gray-400 mb-2">Quick add to {domain.trim()}</p>
              <TaskForm domain={domain.trim()} channelId={channelId} onCreated={() => { setNotice('Task added and posted to the channel.'); search(); }} />
            </section>
          )}
          {loading && sprints.length === 0 && <p className="text-xs text-gray-500">Searching…</p>}
          {!loading && sprints.length === 0 && !error && <p className="text-xs text-gray-500">No sprints found.</p>}
          <ul className="space-y-2">
            {sprints.map((s) => (
              <SprintRow key={s.sprint_id} sprint={s} channelId={channelId} onTaskAdded={() => { setNotice('Task added and posted to the channel.'); search(); }} />
            ))}
          </ul>
        </div>
      </aside>
    </>
  );
}
