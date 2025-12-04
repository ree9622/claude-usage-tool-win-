import { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import type { Language } from '../i18n/translations';

interface SettingsProps {
  onClose: () => void;
}

export function Settings({ onClose }: SettingsProps) {
  const { language, setLanguage, t } = useLanguage();
  const [refreshInterval, setRefreshInterval] = useState(60);
  const [autoStartEnabled, setAutoStartEnabled] = useState(false);
  const [notificationThreshold, setNotificationThreshold] = useState(80);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      if (window.electronAPI?.getSettings) {
        const settings = await window.electronAPI.getSettings();
        setRefreshInterval(settings.refreshInterval || 60);
        setAutoStartEnabled(settings.autoStart || false);
        setNotificationThreshold(settings.notificationThreshold || 80);
      }
      setLoading(false);
    };
    loadSettings();
  }, []);

  const handleSave = async () => {
    if (window.electronAPI?.saveSettings) {
      await window.electronAPI.saveSettings({
        refreshInterval,
        autoStart: autoStartEnabled,
        notificationThreshold,
      });
    }
    onClose();
  };

  const handleAutoStartToggle = async () => {
    const newValue = !autoStartEnabled;
    setAutoStartEnabled(newValue);
    if (window.electronAPI?.setAutoStart) {
      await window.electronAPI.setAutoStart(newValue);
    }
  };

  if (loading) {
    return (
      <div className="settings-overlay">
        <div className="settings-panel">
          <div style={{ textAlign: 'center', padding: 20 }}>
            {t.loading}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          paddingBottom: 12,
          borderBottom: '1px solid var(--border)'
        }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
            {t.settings}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 18,
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              padding: 0,
              width: 24,
              height: 24,
            }}
          >
            ×
          </button>
        </div>

        <div className="settings-item">
          <label>{t.language}</label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            className="settings-select"
          >
            <option value="en">English</option>
            <option value="ko">한국어</option>
          </select>
        </div>

        <div className="settings-item">
          <label>{t.refreshInterval}</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="number"
              min="10"
              max="600"
              step="10"
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              className="settings-input"
              style={{ width: 80 }}
            />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {t.seconds}
            </span>
          </div>
        </div>

        <div className="settings-item">
          <label>{t.autoStart}</label>
          <button
            onClick={handleAutoStartToggle}
            className={`toggle-button ${autoStartEnabled ? 'active' : ''}`}
          >
            <span className="toggle-label">
              {autoStartEnabled ? t.autoStartEnabled : t.autoStartDisabled}
            </span>
            <span className="toggle-switch" />
          </button>
        </div>

        <div className="settings-item">
          <label>{t.notificationThreshold}</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="number"
              min="0"
              max="100"
              step="5"
              value={notificationThreshold}
              onChange={(e) => setNotificationThreshold(Number(e.target.value))}
              className="settings-input"
              style={{ width: 80 }}
            />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              % ({notificationThreshold === 0 ? t.notificationDisabled : `${notificationThreshold}%`})
            </span>
          </div>
        </div>

        <div style={{ marginTop: 20, textAlign: 'right' }}>
          <button onClick={handleSave} className="btn btn-primary">
            {t.save}
          </button>
        </div>
      </div>
    </div>
  );
}
