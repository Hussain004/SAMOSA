import { create } from 'zustand';
import { decodeShare, encodeShare } from '../core/share.ts';
import type { Explanation, Report } from '../core/index.ts';
import type { WorkerRequest, WorkerResponse } from '../worker.ts';
import { PRESETS } from '../core/index.ts';

/**
 * The state of the checker.
 *
 * The derivation, the declarations and the settings live here. The engine
 * runs in a worker; the answers that come back with an old generation number
 * are dropped.
 */

export interface Settings {
  decls: string;
  preset: string;
  seed: number;
  trials: number;
  layout: 'denominator' | 'numerator';
  snackMode: boolean;
}

export interface AppState {
  source: string;
  settings: Settings;
  report: Report | null;
  selectedStep: string | null;
  /** the spot the bug game: the verdicts are hidden until the user guesses */
  spotTheBug: boolean;
  /** the row the user thinks is wrong */
  guess: string | null;
  /** the row that really is wrong */
  revealed: string | null;
  explanations: Record<string, Explanation>;
  busy: boolean;
  error: string | null;
  shareHash: string | null;
  gen: number;
  setSource: (source: string) => void;
  setSettings: (patch: Partial<Settings>) => void;
  select: (id: string | null) => void;
  startSpotTheBug: (source: string, decls: string) => void;
  makeGuess: (id: string) => void;
  reroll: () => void;
  loadShare: () => void;
  applyShare: (hash: string) => void;
  setExplanation: (stepId: string, explanation: Explanation) => void;
}

const DEFAULT_SOURCE = String.raw`% Paste a derivation, or pick one from the menu.
\begin{align*}
J_t &:= \tfrac12 (z_t - C_t x_t)^\top Q_t^{-1} (z_t - C_t x_t) + \tfrac12 (x_t - \bar\mu_t)^\top \bar\Sigma_t^{-1} (x_t - \bar\mu_t) \\
\frac{\partial J_t}{\partial x_t} &= -C_t^\top Q_t^{-1}(z_t - C_t x_t) + \bar\Sigma_t^{-1}(x_t - \bar\mu_t) \\
\frac{\partial^2 J_t}{\partial x_t^2} &= C_t^\top Q_t^{-1} C_t + \bar\Sigma_t^{-1} \\
\Sigma_t &:= \left(C_t^\top Q_t^{-1} C_t + \bar\Sigma_t^{-1}\right)^{-1} \\
\frac{\partial J_t}{\partial x_t} = 0 &\implies x_t = \bar\mu_t + \Sigma_t C_t^\top Q_t^{-1}(z_t - C_t \bar\mu_t) \\
K_t &:= \Sigma_t C_t^\top Q_t^{-1} \\
K_t &= \bar\Sigma_t C_t^\top \left(C_t \bar\Sigma_t C_t^\top + Q_t\right)^{-1} \\
\Sigma_t &= (I - K_t C_t)\, \bar\Sigma_t
\end{align*}
`;

const DEFAULT_SETTINGS: Settings = {
  decls: 'x_t, \\bar\\mu_t: n; z_t: m; C_t: m×n; Q_t: spd m; \\bar\\Sigma_t: spd n',
  preset: '',
  seed: 0x5a305a,
  trials: 3,
  layout: 'denominator',
  snackMode: false,
};

let worker: Worker | null = null;
let pending = 0;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('../worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const response = event.data;
      if (response.gen < pending) return;
      const state = useApp.getState();
      if (response.type === 'report') {
        useApp.setState({ report: response.report, busy: false, error: null });
      } else if (response.type === 'explain') {
        useApp.setState({
          explanations: { ...state.explanations, [response.stepId]: response.explanation },
        });
      } else {
        useApp.setState({ error: response.message, busy: false });
      }
    };
  }
  return worker;
}

export function runCheck(source: string, settings: Settings): void {
  const gen = ++pending;
  useApp.setState({ busy: true });
  const request: WorkerRequest = {
    type: 'check',
    gen,
    src: source,
    options: {
      decls: settings.decls,
      preset: settings.preset || undefined,
      seed: settings.seed,
      trials: settings.trials,
      layout: settings.layout,
    },
  };
  getWorker().postMessage(request);
}

export function runExplain(source: string, stepId: string, settings: Settings): void {
  const gen = ++pending;
  const request: WorkerRequest = {
    type: 'explain',
    gen,
    src: source,
    stepId,
    options: {
      decls: settings.decls,
      preset: settings.preset || undefined,
      seed: settings.seed,
      trials: settings.trials,
      layout: settings.layout,
    },
  };
  getWorker().postMessage(request);
}

export const useApp = create<AppState>((set, get) => ({
  source: DEFAULT_SOURCE,
  settings: DEFAULT_SETTINGS,
  report: null,
  selectedStep: null,
  spotTheBug: false,
  guess: null,
  revealed: null,
  explanations: {},
  busy: false,
  error: null,
  shareHash: null,
  gen: 0,

  setSource: (source) => {
    set({ source });
    schedule(get());
  },

  setSettings: (patch) => {
    const settings = { ...get().settings, ...patch };
    set({ settings });
    schedule(get());
  },

  startSpotTheBug: (source, decls) => {
    set({
      source,
      settings: { ...get().settings, decls },
      spotTheBug: true,
      guess: null,
      revealed: null,
      selectedStep: null,
    });
    schedule(get());
  },

  makeGuess: (id) => {
    const report = get().report;
    if (!report) return;
    const wrong = report.steps.find((s) => s.verdict === 'wrong' || s.verdict === 'shape');
    set({ guess: id, revealed: wrong?.id ?? null, selectedStep: id });
    // the fixes of the row the user pointed at
    const { source, settings, explanations } = get();
    if (explanations[id]) return;
    const step = report.steps.find((s) => s.id === id);
    if (!step) return;
    if (step.verdict !== 'wrong' && step.verdict !== 'shape') return;
    runExplain(source, id, settings);
  },

  select: (id) => {
    if (get().spotTheBug) {
      if (id) get().makeGuess(id);
      return;
    }
    set({ selectedStep: id });
    const { report, source, settings, explanations } = get();
    if (!id || !report) return;
    if (explanations[id]) return;
    const step = report.steps.find((s) => s.id === id);
    if (!step) return;
    if (step.verdict !== 'wrong' && step.verdict !== 'shape') return;
    runExplain(source, id, settings);
  },

  reroll: () => {
    const settings = { ...get().settings, seed: (get().settings.seed + 1) >>> 0 };
    set({ settings });
    schedule(get());
  },

  loadShare: () => {
    const hash = window.location.hash.replace(/^#/, '');
    if (hash.startsWith('v1.')) get().applyShare(hash);
  },

  applyShare: (hash) => {
    try {
      const json = decodeShare(hash);
      const settings = { ...DEFAULT_SETTINGS, ...(json.settings ?? {}) } as Settings;
      // a link carries the declarations as well, so the derivation is checked
      // the way it was checked when the link was made
      if (json.decls) settings.decls = json.decls;
      set({
        source: json.src ?? '',
        settings,
        shareHash: hash,
      });
      schedule(get());
    } catch {
      // a broken link is not worth crashing over
    }
  },
  setExplanation: (stepId, explanation) =>
    set((state) => ({ explanations: { ...state.explanations, [stepId]: explanation } })),
}));

let timer: number | undefined;

function schedule(state: AppState): void {
  if (timer !== undefined) window.clearTimeout(timer);
  timer = window.setTimeout(() => runCheck(state.source, state.settings), 250);
}

/** The share link, with everything in the fragment so nothing is uploaded. */
export function shareUrl(source: string, settings: Settings): string {
  const hash = encodeShare({ src: source, settings: settings as unknown as Record<string, unknown> });
  return `${window.location.origin}${window.location.pathname}#v1.${hash}`;
}

export { PRESETS, DEFAULT_SOURCE, DEFAULT_SETTINGS };
