import { contextBridge, ipcRenderer } from 'electron';

export interface ClaudeMaxUsage {
  standard: { used: number; limit: number; percentage: number };
  advanced: { used: number; limit: number; percentage: number };
  resetDate: string | null;
  lastUpdated: string;
  isAuthenticated: boolean;
}

export interface ApiData {
  usageReport: {
    data: Array<{
      starting_at: string;
      ending_at: string;
      results: Array<{
        uncached_input_tokens: number;
        cache_read_input_tokens: number;
        output_tokens: number;
        model?: string;
      }>;
    }>;
  } | null;
  costReport: {
    data: Array<{
      starting_at: string;
      ending_at: string;
      results: Array<{
        amount: string;
        currency: string;
        model: string | null;
        cost_type: string | null;
      }>;
    }>;
  } | null;
}

export interface RefreshData {
  claudeUsage: ClaudeMaxUsage | null;
  apiData: ApiData | null;
  timestamp: string;
}

export interface ElectronAPI {
  getClaudeMaxUsage: () => Promise<ClaudeMaxUsage | null>;
  isClaudeAuthenticated: () => Promise<boolean>;
  openClaudeLogin: () => Promise<boolean>;
  getApiData: () => Promise<ApiData | null>;
  refreshAll: () => Promise<void>;
  getAdminKeyStatus: () => Promise<{ configured: boolean; hint: string | null }>;
  onDataRefresh: (callback: (data: RefreshData) => void) => () => void;
}

const electronAPI: ElectronAPI = {
  getClaudeMaxUsage: () => ipcRenderer.invoke('claude-max:get-usage'),
  isClaudeAuthenticated: () => ipcRenderer.invoke('claude-max:is-authenticated'),
  openClaudeLogin: () => ipcRenderer.invoke('claude-max:login'),
  getApiData: () => ipcRenderer.invoke('api:get-data'),
  refreshAll: () => ipcRenderer.invoke('app:refresh-all'),
  getAdminKeyStatus: () => ipcRenderer.invoke('app:get-admin-key-status'),
  onDataRefresh: (callback: (data: RefreshData) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: RefreshData) => callback(data);
    ipcRenderer.on('app:data-updated', listener);
    return () => {
      ipcRenderer.removeListener('app:data-updated', listener);
    };
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
