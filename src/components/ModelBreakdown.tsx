import type { UsageReportResponse, CostReportResponse, ModelUsage } from '../types';

interface Props {
  usageReport: UsageReportResponse;
  costReport: CostReportResponse;
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

function getModelDisplayName(model: string): string {
  const lowerModel = model.toLowerCase();
  if (lowerModel.includes('opus')) return 'Opus';
  if (lowerModel.includes('sonnet')) return 'Sonnet';
  if (lowerModel.includes('haiku')) return 'Haiku';
  // Return shortened model name
  const parts = model.split('-');
  return parts.length > 2 ? parts.slice(0, 2).join('-') : model;
}

function getModelColor(model: string): string {
  const lowerModel = model.toLowerCase();
  if (lowerModel.includes('opus')) return '#8b5cf6'; // Purple
  if (lowerModel.includes('sonnet')) return '#d97706'; // Orange
  if (lowerModel.includes('haiku')) return '#22c55e'; // Green
  return '#6b7280'; // Gray
}

function calculateModelBreakdown(
  usageReport: UsageReportResponse,
  costReport: CostReportResponse
): ModelUsage[] {
  const modelMap = new Map<string, ModelUsage>();

  // Aggregate usage by model
  for (const bucket of usageReport.data) {
    for (const result of bucket.results) {
      const model = result.model || 'unknown';
      const existing = modelMap.get(model) || {
        model,
        input: 0,
        output: 0,
        cached: 0,
        total: 0,
        cost: 0,
      };

      existing.input += result.uncached_input_tokens || 0;
      existing.output += result.output_tokens || 0;
      existing.cached += result.cache_read_input_tokens || 0;
      existing.total = existing.input + existing.output + existing.cached;

      modelMap.set(model, existing);
    }
  }

  // Aggregate costs by model
  for (const bucket of costReport.data) {
    for (const result of bucket.results) {
      const model = result.model || 'unknown';
      const existing = modelMap.get(model);
      if (existing) {
        existing.cost += parseFloat(result.amount) || 0;
      } else {
        modelMap.set(model, {
          model,
          input: 0,
          output: 0,
          cached: 0,
          total: 0,
          cost: parseFloat(result.amount) || 0,
        });
      }
    }
  }

  // Sort by cost (highest first)
  return Array.from(modelMap.values())
    .filter(m => m.total > 0 || m.cost > 0)
    .sort((a, b) => b.cost - a.cost);
}

export function ModelBreakdown({ usageReport, costReport }: Props) {
  const models = calculateModelBreakdown(usageReport, costReport);

  if (models.length === 0) {
    return null;
  }

  const totalCost = models.reduce((sum, m) => sum + m.cost, 0);

  return (
    <div className="section">
      <div className="section-title">By Model</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {models.map((model) => {
          const costPercentage = totalCost > 0 ? (model.cost / totalCost) * 100 : 0;

          return (
            <div
              key={model.model}
              style={{
                background: 'var(--bg-tertiary)',
                borderRadius: 6,
                padding: 10,
                borderLeft: `3px solid ${getModelColor(model.model)}`,
              }}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 6
              }}>
                <span style={{ fontWeight: 600, fontSize: 12 }}>
                  {getModelDisplayName(model.model)}
                </span>
                <span style={{
                  fontWeight: 600,
                  fontSize: 12,
                  color: getModelColor(model.model)
                }}>
                  {formatCost(model.cost)}
                </span>
              </div>

              {/* Cost bar */}
              <div className="progress-bar" style={{ marginBottom: 6 }}>
                <div
                  className="progress-fill"
                  style={{
                    width: `${costPercentage}%`,
                    background: getModelColor(model.model),
                  }}
                />
              </div>

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 10,
                color: 'var(--text-muted)'
              }}>
                <span>In: {formatNumber(model.input)}</span>
                <span>Out: {formatNumber(model.output)}</span>
                <span>Cache: {formatNumber(model.cached)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
