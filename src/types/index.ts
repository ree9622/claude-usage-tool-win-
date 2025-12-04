export interface UsageBar {
  used: number;
  limit: number;
  percentage: number;
  label?: string;
  context?: string;
}

export interface ClaudeMaxUsage {
  standard: UsageBar;
  advanced: UsageBar;
  bars?: UsageBar[];
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

export interface LogEntry {
  timestamp: string;
  message: string;
}

export interface RefreshData {
  claudeUsage: ClaudeMaxUsage | null;
  billingInfo: BillingInfo | null;
  timestamp: string;
  logs?: LogEntry[];
}

export interface AppSettings {
  refreshInterval: number;
  autoStart: boolean;
  notificationThreshold: number; // Percentage threshold for notifications (0 = disabled)
}

// 2025-12-04: Window type augmentation for Electron API - electronAPI를 optional로 수정
declare global {
  interface Window {
    electronAPI?: {
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
    };
  }
}

export {};
