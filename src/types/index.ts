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
  bars?: UsageBar[];  // For dynamic number of bars
  resetDate: string | null;
  lastUpdated: string;
  isAuthenticated: boolean;
}

export interface UsageResult {
  uncached_input_tokens: number;
  cache_read_input_tokens: number;
  output_tokens: number;
  cache_creation?: {
    ephemeral_1h_input_tokens: number;
    ephemeral_5m_input_tokens: number;
  };
  server_tool_use?: {
    web_search_requests: number;
  };
  model?: string;
  workspace_id?: string;
}

export interface TimeBucket {
  starting_at: string;
  ending_at: string;
  results: UsageResult[];
}

export interface UsageReportResponse {
  data: TimeBucket[];
  has_more: boolean;
  next_page?: string;
}

export interface CostResult {
  amount: string;
  currency: 'USD';
  model: string | null;
  cost_type: 'tokens' | 'web_search' | 'code_execution' | null;
  service_tier: 'standard' | 'batch' | null;
  workspace_id: string | null;
}

export interface CostTimeBucket {
  starting_at: string;
  ending_at: string;
  results: CostResult[];
}

export interface CostReportResponse {
  data: CostTimeBucket[];
  has_more: boolean;
  next_page?: string;
}

export interface CreditBalance {
  available_credit: string;
  currency: 'USD';
}

export interface ApiData {
  usageReport: UsageReportResponse | null;
  costReport: CostReportResponse | null;
  creditBalance: CreditBalance | null;
}

export interface RefreshData {
  claudeUsage: ClaudeMaxUsage | null;
  apiData: ApiData | null;
  timestamp: string;
}

export interface ModelUsage {
  model: string;
  input: number;
  output: number;
  cached: number;
  total: number;
  cost: number;
}

// Window type augmentation for Electron API
declare global {
  interface Window {
    electronAPI: {
      getClaudeMaxUsage: () => Promise<ClaudeMaxUsage | null>;
      isClaudeAuthenticated: () => Promise<boolean>;
      openClaudeLogin: () => Promise<boolean>;
      getApiData: () => Promise<ApiData | null>;
      refreshAll: () => Promise<void>;
      getAdminKeyStatus: () => Promise<{ configured: boolean; hint: string | null }>;
      onDataRefresh: (callback: (data: RefreshData) => void) => () => void;
    };
  }
}

export {};
