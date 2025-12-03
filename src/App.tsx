import { useState, useEffect, useCallback } from 'react';
import { ClaudeMaxUsage } from './components/ClaudeMaxUsage';
import { ApiCosts } from './components/ApiCosts';
import { ModelBreakdown } from './components/ModelBreakdown';
import type { ClaudeMaxUsage as ClaudeMaxUsageType, ApiData, RefreshData } from './types';

// Check if running inside Electron
const isElectron = typeof window !== 'undefined' && window.electronAPI !== undefined;

function App() {
  const [claudeUsage, setClaudeUsage] = useState<ClaudeMaxUsageType | null>(null);
  const [apiData, setApiData] = useState<ApiData | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [adminKeyConfigured, setAdminKeyConfigured] = useState(false);

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

    // Check admin key status
    window.electronAPI.getAdminKeyStatus().then((status) => {
      setAdminKeyConfigured(status.configured);
    });

    // Initial data load
    refreshData();

    // Listen for auto-refresh updates
    const unsubscribe = window.electronAPI.onDataRefresh((data: RefreshData) => {
      setClaudeUsage(data.claudeUsage);
      setApiData(data.apiData);
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
        <span style={{ fontWeight: 600, fontSize: 14 }}>Claude Usage</span>
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

      {/* API Costs Section */}
      <ApiCosts
        apiData={apiData}
        configured={adminKeyConfigured}
        loading={loading}
      />

      {/* Model Breakdown Section */}
      {apiData?.usageReport && apiData?.costReport && (
        <ModelBreakdown
          usageReport={apiData.usageReport}
          costReport={apiData.costReport}
        />
      )}

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
