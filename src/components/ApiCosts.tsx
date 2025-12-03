import type { BillingInfo } from '../types';

interface Props {
  billingInfo: BillingInfo | null;
  loading: boolean;
  onPlatformLogin: () => void;
}

export function ApiCosts({ billingInfo, loading, onPlatformLogin }: Props) {
  if (loading && !billingInfo) {
    return (
      <div className="section">
        <div className="section-title">API Credit</div>
        <div className="loading">Loading...</div>
      </div>
    );
  }

  // Show login prompt if no billing info
  if (!billingInfo || billingInfo.creditBalance === null) {
    return (
      <div className="section">
        <div className="section-title">API Credit</div>
        <div style={{
          background: 'var(--bg-tertiary)',
          borderRadius: 12,
          padding: 16,
          textAlign: 'center'
        }}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 12, fontSize: 12 }}>
            Login to Claude Platform to see your API credit balance
          </p>
          <button className="btn btn-primary" onClick={onPlatformLogin}>
            Login to Platform
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="section">
      <div className="section-title">API Credit</div>

      {/* Credit Balance Card */}
      <div style={{
        background: 'var(--bg-tertiary)',
        borderRadius: 12,
        padding: 20,
        textAlign: 'center'
      }}>
        <div style={{
          fontSize: 32,
          fontWeight: 400,
          color: 'var(--text-primary)',
          marginBottom: 6,
          letterSpacing: '-0.5px'
        }}>
          US${billingInfo.creditBalance.toFixed(2)}
        </div>
        <div style={{
          fontSize: 13,
          color: 'var(--text-muted)'
        }}>
          Remaining Balance
        </div>
      </div>
    </div>
  );
}
