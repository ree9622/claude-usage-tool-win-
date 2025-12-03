export type Language = 'en' | 'ko';

export interface Translations {
  // Header
  planUsage: string;
  refresh: string;
  autoRefresh: string;
  
  // Claude Usage
  loginToClaudePrompt: string;
  loginToClaudeButton: string;
  noUsageData: string;
  
  // API Credit
  apiCredit: string;
  loginToPlatformPrompt: string;
  loginToPlatformButton: string;
  remainingBalance: string;
  
  // Settings
  settings: string;
  language: string;
  refreshInterval: string;
  seconds: string;
  autoStart: string;
  autoStartEnabled: string;
  autoStartDisabled: string;
  
  // Common
  loading: string;
  close: string;
  save: string;
}

export const translations: Record<Language, Translations> = {
  en: {
    planUsage: 'Plan Usage',
    refresh: 'Refresh',
    autoRefresh: 'Auto-refreshes every',
    
    loginToClaudePrompt: 'Login to Claude to see your subscription usage',
    loginToClaudeButton: 'Login to Claude',
    noUsageData: 'No usage data available',
    
    apiCredit: 'API Credit',
    loginToPlatformPrompt: 'Login to Claude Platform to see your API credit balance',
    loginToPlatformButton: 'Login to Platform',
    remainingBalance: 'Remaining Balance',
    
    settings: 'Settings',
    language: 'Language',
    refreshInterval: 'Refresh Interval',
    seconds: 'seconds',
    autoStart: 'Auto Start',
    autoStartEnabled: 'Enabled',
    autoStartDisabled: 'Disabled',
    
    loading: 'Loading...',
    close: 'Close',
    save: 'Save',
  },
  ko: {
    planUsage: '사용량',
    refresh: '새로고침',
    autoRefresh: '자동 새로고침',
    
    loginToClaudePrompt: 'Claude 로그인이 필요합니다',
    loginToClaudeButton: 'Claude 로그인',
    noUsageData: '사용량 데이터 없음',
    
    apiCredit: 'API 크레딧',
    loginToPlatformPrompt: 'Platform 로그인이 필요합니다',
    loginToPlatformButton: 'Platform 로그인',
    remainingBalance: '잔여 크레딧',
    
    settings: '설정',
    language: '언어',
    refreshInterval: '새로고침 간격',
    seconds: '초',
    autoStart: '자동 시작',
    autoStartEnabled: '활성화',
    autoStartDisabled: '비활성화',
    
    loading: '로딩 중...',
    close: '닫기',
    save: '저장',
  },
};
