import { useState, useEffect, useCallback } from 'react';
import { ClaudeMaxUsage } from './components/ClaudeMaxUsage';
import { ApiCosts } from './components/ApiCosts';
import type { ClaudeMaxUsage as ClaudeMaxUsageType, BillingInfo, RefreshData } from './types';

// Check if running inside Electron
const isElectron = typeof window !== 'undefined' && window.electronAPI !== undefined;

function App() {
  const [claudeUsage, setClaudeUsage] = useState<ClaudeMaxUsageType | null>(null);
  const [billingInfo, setBillingInfo] = useState<BillingInfo | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

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
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isElectron) {
      setLoading(false);
      return;
    }

    // Initial data load
    refreshData();

    // Listen for auto-refresh updates
    const unsubscribe = window.electronAPI.onDataRefresh((data: RefreshData) => {
      setClaudeUsage(data.claudeUsage);
      setBillingInfo(data.billingInfo);
      setLastUpdated(new Date(data.timestamp));
      setLoading(false);
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

  // Build header title
  const planName = claudeUsage?.plan ? `${claudeUsage.plan} Plan` : 'Claude';
  const email = claudeUsage?.email;
  const headerTitle = email ? `${planName} - ${email}` : planName;

  return (
    <div className="panel" style={{ width: 320, maxHeight: 480, overflowY: 'auto' }}>
      {/* Header */}
      <div className="section" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'var(--bg-secondary)',
        padding: '10px 12px'
      }}>
        <span style={{
          fontWeight: 600,
          fontSize: email ? 11 : 14,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: '180px'
        }}>
          {headerTitle}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {lastUpdated && (
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            className="btn btn-secondary"
            onClick={refreshData}
            disabled={loading}
            style={{ padding: '4px 8px', fontSize: 11 }}
          >
            {loading ? '...' : 'Refresh'}
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

      {/* Footer */}
      <div style={{
        padding: '8px 12px',
        fontSize: 10,
        color: 'var(--text-muted)',
        textAlign: 'center',
        borderTop: '1px solid var(--border)'
      }}>
        Auto-refreshes every 60s
      </div>
    </div>
  );
}

export default App;
