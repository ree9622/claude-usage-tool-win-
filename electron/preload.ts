import { contextBridge, ipcRenderer } from 'electron';

export interface ClaudeMaxUsage {
  standard: { used: number; limit: number; percentage: number };
  advanced: { used: number; limit: number; percentage: number };
  bars?: Array<{ used: number; limit: number; percentage: number; label?: string; context?: string }>;
  resetDate: string | null;
  lastUpdated: string;
  isAuthenticated: boolean;
  plan?: string;
  email?: string;
}

export interface BillingInfo {
  creditBalance: number | null;
  currency: string;
  lastUpdated: string;
}

export interface RefreshData {
  claudeUsage: ClaudeMaxUsage | null;
  billingInfo: BillingInfo | null;
  timestamp: string;
}

export interface AppSettings {
  refreshInterval: number;
  autoStart: boolean;
}

export interface ElectronAPI {
  getClaudeMaxUsage: () => Promise<ClaudeMaxUsage | null>;
  isClaudeAuthenticated: () => Promise<boolean>;
  openClaudeLogin: () => Promise<boolean>;
  openPlatformLogin: () => Promise<boolean>;
  refreshAll: () => Promise<void>;
  onDataRefresh: (callback: (data: RefreshData) => void) => () => void;
  getSettings: () => Promise<AppSettings>;
  saveSettings: (settings: AppSettings) => Promise<void>;
  setAutoStart: (enabled: boolean) => Promise<void>;
  hideWindow: () => void;
}

const electronAPI: ElectronAPI = {
  getClaudeMaxUsage: () => ipcRenderer.invoke('claude-max:get-usage'),
  isClaudeAuthenticated: () => ipcRenderer.invoke('claude-max:is-authenticated'),
  openClaudeLogin: () => ipcRenderer.invoke('claude-max:login'),
  openPlatformLogin: () => ipcRenderer.invoke('platform:login'),
  refreshAll: () => ipcRenderer.invoke('app:refresh-all'),
  onDataRefresh: (callback: (data: RefreshData) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: RefreshData) => callback(data);
    ipcRenderer.on('app:data-updated', listener);
    return () => {
      ipcRenderer.removeListener('app:data-updated', listener);
    };
  },
  getSettings: () => ipcRenderer.invoke('app:get-settings'),
  saveSettings: (settings: AppSettings) => ipcRenderer.invoke('app:save-settings', settings),
  setAutoStart: (enabled: boolean) => ipcRenderer.invoke('app:set-auto-start', enabled),
  hideWindow: () => ipcRenderer.send('window:hide'),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
