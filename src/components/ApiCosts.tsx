import { useLanguage } from '../i18n/LanguageContext';
import type { BillingInfo } from '../types';

interface Props {
  billingInfo: BillingInfo | null;
  loading: boolean;
  onPlatformLogin: () => void;
}

export function ApiCosts({ billingInfo, loading, onPlatformLogin }: Props) {
  const { t } = useLanguage();
  
  if (loading && !billingInfo) {
    return (
      <div className="section">
        <div className="section-title">{t.apiCredit}</div>
        <div className="loading">{t.loading}</div>
      </div>
    );
  }

  // Show login prompt if no billing info
  if (!billingInfo || billingInfo.creditBalance === null) {
    return (
      <div className="section" style={{ paddingTop: 8, paddingBottom: 8 }}>
        <div className="section-title">{t.apiCredit}</div>
        <div style={{
          background: 'var(--bg-tertiary)',
          borderRadius: 10,
          padding: 12,
          textAlign: 'center'
        }}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 10, fontSize: 11 }}>
            {t.loginToPlatformPrompt}
          </p>
          <button className="btn btn-primary" onClick={onPlatformLogin} style={{ fontSize: 11, padding: '5px 10px' }}>
            {t.loginToPlatformButton}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="section" style={{ paddingTop: 8, paddingBottom: 8 }}>
      <div className="section-title">{t.apiCredit}</div>

      {/* Credit Balance Card */}
      <div style={{
        background: 'var(--bg-tertiary)',
        borderRadius: 10,
        padding: 14,
        textAlign: 'center'
      }}>
        <div style={{
          fontSize: 26,
          fontWeight: 400,
          color: 'var(--text-primary)',
          marginBottom: 4,
          letterSpacing: '-0.5px'
        }}>
          US${billingInfo.creditBalance.toFixed(2)}
        </div>
        <div style={{
          fontSize: 11,
          color: 'var(--text-muted)'
        }}>
          {t.remainingBalance}
        </div>
      </div>
    </div>
  );
}
