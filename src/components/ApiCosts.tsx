import type { ApiData, UsageReportResponse, CostReportResponse } from '../types';

interface Props {
  apiData: ApiData | null;
  configured: boolean;
  loading: boolean;
}

interface WorkspaceData {
  workspaceId: string;
  cost: number;
  tokens: {
    input: number;
    output: number;
    cached: number;
    total: number;
  };
}

function formatNumber(num: number): string {
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(2) + 'M';
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(1) + 'K';
  }
  return num.toLocaleString();
}

function formatCost(amount: number): string {
  return '$' + amount.toFixed(2);
}

function getWorkspaceDisplayName(workspaceId: string | null): string {
  if (!workspaceId) return 'Default Workspace';
  // Show first 8 chars of workspace ID for brevity
  return `Workspace ${workspaceId.substring(0, 8)}...`;
}

function calculateDataByWorkspace(
  usageReport: UsageReportResponse,
  costReport: CostReportResponse
): { workspaces: WorkspaceData[]; totalCost: number; totalTokens: { input: number; output: number; cached: number; total: number } } {
  const workspaceMap = new Map<string, WorkspaceData>();

  // Process usage data
  for (const bucket of usageReport.data) {
    for (const result of bucket.results) {
      const workspaceId = result.workspace_id || 'default';
      if (!workspaceMap.has(workspaceId)) {
        workspaceMap.set(workspaceId, {
          workspaceId,
          cost: 0,
          tokens: { input: 0, output: 0, cached: 0, total: 0 }
        });
      }
      const ws = workspaceMap.get(workspaceId)!;
      ws.tokens.input += result.uncached_input_tokens || 0;
      ws.tokens.output += result.output_tokens || 0;
      ws.tokens.cached += result.cache_read_input_tokens || 0;
      ws.tokens.total = ws.tokens.input + ws.tokens.output + ws.tokens.cached;
    }
  }

  // Process cost data
  for (const bucket of costReport.data) {
    for (const result of bucket.results) {
      const workspaceId = result.workspace_id || 'default';
      if (!workspaceMap.has(workspaceId)) {
        workspaceMap.set(workspaceId, {
          workspaceId,
          cost: 0,
          tokens: { input: 0, output: 0, cached: 0, total: 0 }
        });
      }
      const ws = workspaceMap.get(workspaceId)!;
      ws.cost += parseFloat(result.amount) || 0;
    }
  }

  const workspaces = Array.from(workspaceMap.values()).sort((a, b) => b.cost - a.cost);

  const totalCost = workspaces.reduce((sum, ws) => sum + ws.cost, 0);
  const totalTokens = workspaces.reduce(
    (acc, ws) => ({
      input: acc.input + ws.tokens.input,
      output: acc.output + ws.tokens.output,
      cached: acc.cached + ws.tokens.cached,
      total: acc.total + ws.tokens.total
    }),
    { input: 0, output: 0, cached: 0, total: 0 }
  );

  return { workspaces, totalCost, totalTokens };
}

export function ApiCosts({ apiData, configured, loading }: Props) {
  if (!configured) {
    return (
      <div className="section">
        <div className="section-title">API Usage & Costs</div>
        <div style={{
          background: 'var(--bg-tertiary)',
          borderRadius: 6,
          padding: 12,
          fontSize: 12
        }}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 8 }}>
            Add your Admin API key to <code>.env.local</code> to see API costs.
          </p>
          <code style={{
            display: 'block',
            background: 'var(--bg-primary)',
            padding: 8,
            borderRadius: 4,
            fontSize: 10,
            color: 'var(--text-muted)'
          }}>
            ANTHROPIC_ADMIN_KEY=sk-ant-admin-...
          </code>
        </div>
      </div>
    );
  }

  if (loading && !apiData) {
    return (
      <div className="section">
        <div className="section-title">API Usage & Costs</div>
        <div className="loading">Loading...</div>
      </div>
    );
  }

  if (!apiData?.usageReport || !apiData?.costReport) {
    return (
      <div className="section">
        <div className="section-title">API Usage & Costs</div>
        <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
          No API data available
        </div>
      </div>
    );
  }

  const { workspaces, totalCost, totalTokens } = calculateDataByWorkspace(
    apiData.usageReport,
    apiData.costReport
  );

  const creditBalance = apiData.creditBalance;

  return (
    <div className="section">
      <div className="section-title">API Keys</div>

      {/* Credit Balance Card */}
      {creditBalance && (
        <div style={{
          background: 'var(--bg-tertiary)',
          borderRadius: 8,
          padding: 16,
          marginBottom: 16,
          textAlign: 'center'
        }}>
          <div style={{
            fontSize: 28,
            fontWeight: 500,
            color: 'var(--text-primary)',
            marginBottom: 4
          }}>
            US${parseFloat(creditBalance.available_credit).toFixed(2)}
          </div>
          <div style={{
            fontSize: 12,
            color: 'var(--text-muted)'
          }}>
            Remaining Balance
          </div>
        </div>
      )}

      <div className="section-title" style={{ marginTop: 8 }}>Usage (Last 30 Days)</div>

      {/* Total Cost */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 8,
        marginBottom: 12
      }}>
        <span style={{ fontSize: 24, fontWeight: 600, color: 'var(--accent)' }}>
          {formatCost(totalCost)}
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>spent</span>
      </div>

      {/* Workspace breakdown */}
      {workspaces.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          {workspaces.map((ws) => (
            <div
              key={ws.workspaceId}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '6px 0',
                borderBottom: '1px solid var(--border)'
              }}
            >
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>
                  {getWorkspaceDisplayName(ws.workspaceId === 'default' ? null : ws.workspaceId)}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                  {formatNumber(ws.tokens.total)} tokens
                </div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--accent)' }}>
                {formatCost(ws.cost)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Token breakdown */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 8
      }}>
        <div style={{
          background: 'var(--bg-tertiary)',
          borderRadius: 6,
          padding: 8,
          textAlign: 'center'
        }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{formatNumber(totalTokens.input)}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Input</div>
        </div>
        <div style={{
          background: 'var(--bg-tertiary)',
          borderRadius: 6,
          padding: 8,
          textAlign: 'center'
        }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{formatNumber(totalTokens.output)}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Output</div>
        </div>
        <div style={{
          background: 'var(--bg-tertiary)',
          borderRadius: 6,
          padding: 8,
          textAlign: 'center'
        }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{formatNumber(totalTokens.cached)}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Cached</div>
        </div>
      </div>

      <div style={{
        marginTop: 8,
        fontSize: 11,
        color: 'var(--text-muted)'
      }}>
        Total: {formatNumber(totalTokens.total)} tokens
      </div>
    </div>
  );
}
