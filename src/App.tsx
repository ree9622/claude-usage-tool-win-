import { useState, useEffect, useCallback } from 'react';
import { ClaudeMaxUsage } from './components/ClaudeMaxUsage';
import { ApiCosts } from './components/ApiCosts';
import { Settings } from './components/Settings';
import { useLanguage } from './i18n/LanguageContext';
import type { ClaudeMaxUsage as ClaudeMaxUsageType, BillingInfo, RefreshData, LogEntry } from './types';

// Check if running inside Electron
const isElectron = typeof window !== 'undefined' && window.electronAPI !== undefined;

function App() {
  const { language, t } = useLanguage();
  
  // Load cached data from localStorage
  const [claudeUsage, setClaudeUsage] = useState<ClaudeMaxUsageType | null>(() => {
    try {
      const cached = localStorage.getItem('claudeUsage');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  
  const [billingInfo, setBillingInfo] = useState<BillingInfo | null>(() => {
    try {
      const cached = localStorage.getItem('billingInfo');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  
  const [lastUpdated, setLastUpdated] = useState<Date | null>(() => {
    try {
      const cached = localStorage.getItem('lastUpdated');
      return cached ? new Date(cached) : null;
    } catch {
      return null;
    }
  });
  
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(60);

  const refreshData = useCallback(async () => {
    if (!isElectron) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      await window.electronAPI.refreshAll();
    } catch (error) {
      console.error('Failed to refresh:', error);
      setLoading(false);
    }
    // Don't set loading to false here - let the data update event do it
  }, []);

  useEffect(() => {
    if (!isElectron) {
      setLoading(false);
      return;
    }

    // Load settings
    const loadSettings = async () => {
      if (window.electronAPI?.getSettings) {
        const settings = await window.electronAPI.getSettings();
        setRefreshInterval(settings.refreshInterval || 60);
      }
    };
    loadSettings();

    // Initial data load
    refreshData();

    // Listen for auto-refresh updates
    const unsubscribe = window.electronAPI.onDataRefresh((data: RefreshData) => {
      setClaudeUsage(data.claudeUsage);
      setBillingInfo(data.billingInfo);
      setLastUpdated(new Date(data.timestamp));
      if (data.logs) {
        setLogs(data.logs);
      }
      setLoading(false);
      
      // Cache data to localStorage
      try {
        if (data.claudeUsage) {
          localStorage.setItem('claudeUsage', JSON.stringify(data.claudeUsage));
        }
        if (data.billingInfo) {
          localStorage.setItem('billingInfo', JSON.stringify(data.billingInfo));
        }
        localStorage.setItem('lastUpdated', data.timestamp);
      } catch (error) {
        console.error('Failed to cache data:', error);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [refreshData]);

  const handleLogin = async () => {
    if (!isElectron) return;
    const success = await window.electronAPI.openClaudeLogin();
    if (success) {
      refreshData();
    }
  };

  const handlePlatformLogin = async () => {
    if (!isElectron) return;
    const success = await window.electronAPI.openPlatformLogin();
    if (success) {
      refreshData();
    }
  };

  // Show message if not running in Electron
  if (!isElectron) {
    return (
      <div className="panel" style={{ width: 320, padding: 20, textAlign: 'center' }}>
        <h3 style={{ marginBottom: 12 }}>Claude Usage Tool</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
          This app must be run inside Electron.
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 8 }}>
          Run: <code>npm run electron:dev</code>
        </p>
      </div>
    );
  }

  // Build header title - Claude "Plan" Plan Usage
  const planName = claudeUsage?.plan || 'Max';
  const headerTitle = language === 'ko' 
    ? `Claude ${planName} ${t.planUsage}` 
    : `Claude "${planName}" ${t.planUsage}`;

  return (
    <>
      <div className="panel" style={{ width: 320, maxHeight: 480, overflowY: 'auto' }}>
        {/* Header */}
        <div className="section" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--bg-secondary)',
          padding: '8px 10px'
        }}>
          <span style={{
            fontWeight: 600,
            fontSize: 12,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            flex: 1
          }}>
            {headerTitle}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {lastUpdated && (
              <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <button
              className="btn btn-icon"
              onClick={() => setShowSettings(true)}
              title={t.settings}
              style={{ padding: '3px 5px', fontSize: 13 }}
            >
              ⚙️
            </button>
            <button
              className="btn btn-secondary"
              onClick={refreshData}
              disabled={loading}
              style={{ padding: '4px 8px', fontSize: 10 }}
            >
              {loading ? '...' : t.refresh}
            </button>
          </div>
        </div>

      {/* Claude Max Usage Section */}
      <ClaudeMaxUsage
        usage={claudeUsage}
        onLogin={handleLogin}
        loading={loading}
      />

      {/* Credit Balance Section */}
      <ApiCosts
        billingInfo={billingInfo}
        loading={loading}
        onPlatformLogin={handlePlatformLogin}
      />

      {/* Footer with logs */}
      <div style={{
        padding: '6px 10px',
        fontSize: 9,
        color: 'var(--text-muted)',
        borderTop: '1px solid var(--border)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: logs.length > 0 ? 4 : 0 }}>
          {language === 'ko' ? `${refreshInterval}초마다 갱신` : `Auto-refresh every ${refreshInterval}s`}
        </div>
        {logs.length > 0 && (
          <div style={{
            fontFamily: 'monospace',
            fontSize: 8,
            lineHeight: 1.3,
            maxHeight: 60,
            overflowY: 'auto',
            background: 'var(--bg-tertiary)',
            borderRadius: 4,
            padding: '4px 6px'
          }}>
            {logs.map((log, i) => {
              const time = new Date(log.timestamp).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
              });
              return (
                <div key={i} style={{ opacity: 0.6 + (i / logs.length) * 0.4 }}>
                  {time} {log.message}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
    
    {showSettings && <Settings onClose={() => setShowSettings(false)} />}
    </>
  );
}

export default App;
