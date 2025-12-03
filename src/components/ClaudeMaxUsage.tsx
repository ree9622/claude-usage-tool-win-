import { useLanguage } from '../i18n/LanguageContext';
import type { ClaudeMaxUsage as ClaudeMaxUsageType, UsageBar as UsageBarType } from '../types';

interface Props {
  usage: ClaudeMaxUsageType | null;
  onLogin: () => void;
  loading: boolean;
}

function UsageBarComponent({
  bar,
  label,
  resetInfo
}: {
  bar: UsageBarType;
  label: string;
  resetInfo?: string;
}) {
  const displayLabel = bar.label || label;
  const percentage = Math.round(bar.percentage);

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: 4
      }}>
        <span style={{
          fontSize: 12,
          color: 'var(--text-primary)',
          fontWeight: 400
        }}>
          {displayLabel}
        </span>
        <span style={{
          fontSize: 12,
          fontWeight: 500,
          color: 'var(--accent)'
        }}>
          {percentage}%
        </span>
      </div>
      <div className="progress-bar" style={{ height: 4, borderRadius: 2 }}>
        <div
          className="progress-fill"
          style={{
            width: `${Math.min(bar.percentage, 100)}%`,
            background: 'var(--accent)',
            height: '100%',
            borderRadius: 2,
          }}
        />
      </div>
      {resetInfo && (
        <div style={{
          fontSize: 10,
          color: 'var(--text-muted)',
          marginTop: 2
        }}>
          {resetInfo}
        </div>
      )}
    </div>
  );
}

export function ClaudeMaxUsage({ usage, onLogin, loading }: Props) {
  const { t } = useLanguage();
  
  // Show loading first if we don't have data yet
  if (loading && !usage) {
    return (
      <div className="section">
        <div className="loading">{t.loading}</div>
      </div>
    );
  }
  
  if (!usage?.isAuthenticated) {
    return (
      <div className="section">
        <div style={{
          textAlign: 'center',
          padding: '12px 0'
        }}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 12, fontSize: 12 }}>
            {t.loginToClaudePrompt}
          </p>
          <button className="btn btn-primary" onClick={onLogin}>
            {t.loginToClaudeButton}
          </button>
        </div>
      </div>
    );
  }

  // Use the bars array if available, otherwise fall back to standard/advanced
  const bars = usage.bars && usage.bars.length > 0
    ? usage.bars
    : [usage.standard, usage.advanced].filter(b => b.percentage > 0 || b.limit > 0);

  // Get reset info from bar context
  const getResetInfo = (bar: UsageBarType): string | undefined => {
    if (bar.context) {
      return bar.context;
    }
    return undefined;
  };

  // Get the display label - use bar.label if available
  const getLabel = (bar: UsageBarType, index: number): string => {
    if (bar.label) {
      return bar.label;
    }
    const defaultLabels = ['Current Session', 'All models', 'Sonnet only', 'Extra usage'];
    return defaultLabels[index] || `Usage ${index + 1}`;
  };

  return (
    <div className="section" style={{ paddingTop: 8 }}>
      {bars.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: '8px 0' }}>
          {t.noUsageData}
        </div>
      ) : (
        bars.map((bar, index) => (
          <UsageBarComponent
            key={index}
            bar={bar}
            label={getLabel(bar, index)}
            resetInfo={getResetInfo(bar)}
          />
        ))
      )}
    </div>
  );
}
