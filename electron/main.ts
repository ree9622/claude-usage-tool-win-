import { app, BrowserWindow, ipcMain, Tray, nativeImage, Menu, screen, dialog } from 'electron';
import * as path from 'path';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import Store from 'electron-store';
import { scrapeClaudeUsage, scrapeBillingInfo, openLoginWindow, openPlatformLoginWindow, isAuthenticated, isPlatformAuthenticated, logout } from './scraper';
import { getUsageReport, getCostReport, getCreditBalance, ApiData } from './adminApi';

// Settings store
interface AppSettings {
  refreshInterval: number;
  autoStart: boolean;
  notificationThreshold: number;
}

const store = new Store<AppSettings>({
  defaults: {
    refreshInterval: 60,
    autoStart: false,
    notificationThreshold: 80, // Default: notify at 80%
  },
});

// Disable default error dialogs in production
if (app.isPackaged) {
  dialog.showErrorBox = () => {};
}

// Handle uncaught exceptions to prevent crashes from EPIPE errors
process.on('uncaughtException', (error) => {
  // Ignore EPIPE errors which occur when writing to closed pipes
  if (error.message?.includes('EPIPE')) {
    return;
  }
  // In dev mode, log to console; in prod, silently ignore non-critical errors
  if (!app.isPackaged) {
    console.error('Uncaught exception:', error);
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  if (message?.includes('EPIPE')) {
    return;
  }
  if (!app.isPackaged) {
    console.error('Unhandled rejection:', reason);
  }
});

// Load environment variables - try multiple paths
const envPaths = [
  path.join(__dirname, '..', '.env.local'),
  path.join(app.getAppPath(), '.env.local'),
  path.join(process.cwd(), '.env.local'),
];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    console.log('Loading .env.local from:', envPath);
    dotenv.config({ path: envPath });
    break;
  }
}

console.log('Admin key configured:', !!process.env.ANTHROPIC_ADMIN_KEY);

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let refreshInterval: NodeJS.Timeout | null = null;
let lastClickTime = 0;
const CLICK_DEBOUNCE = 200; // 200ms debounce

const isDev = !app.isPackaged;

// Activity log system - keep last 20 entries
interface LogEntry {
  timestamp: string;
  message: string;
}
const activityLogs: LogEntry[] = [];
const MAX_LOGS = 20;

function addLog(message: string) {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    message
  };
  activityLogs.push(entry);
  if (activityLogs.length > MAX_LOGS) {
    activityLogs.shift();
  }
  console.log(`[${entry.timestamp}] ${message}`);
}

function getRecentLogs(count: number = 6): LogEntry[] {
  return activityLogs.slice(-count);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 320,
    height: 480,
    show: false,
    frame: false,
    resizable: false,
    skipTaskbar: true,
    transparent: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    // mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    // In production, __dirname is inside app.asar/dist-electron
    // So we need to go up one level to get to dist/index.html
    const htmlPath = path.join(__dirname, '..', 'dist', 'index.html');
    console.log('Loading HTML from:', htmlPath);
    mainWindow.loadFile(htmlPath);
  }

  mainWindow.on('blur', () => {
    // When window loses focus, hide it after a short delay
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) {
        console.log('Window blurred, hiding');
        mainWindow.hide();
      }
    }, 100);
  });
}

async function updateTrayMenu() {
  if (!tray) return;
  
  const authenticated = await isAuthenticated();
  const platformAuthenticated = await isPlatformAuthenticated();
  
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Refresh', click: () => refreshAllData() },
    { type: 'separator' },
    authenticated 
      ? { 
          label: 'Logout from Claude', 
          click: async () => {
            await logout();
            refreshAllData();
            updateTrayMenu();
          }
        }
      : { label: 'Login to Claude', click: () => openLoginWindow().then(() => updateTrayMenu()) },
    platformAuthenticated
      ? {
          label: 'Logout from Platform',
          click: async () => {
            await logout();
            refreshAllData();
            updateTrayMenu();
          }
        }
      : { label: 'Login to Platform', click: () => openPlatformLoginWindow().then(() => updateTrayMenu()) },
    { type: 'separator' },
    {
      label: 'About',
      click: () => {
        const aboutWindow = new BrowserWindow({
          width: 300,
          height: 200,
          resizable: false,
          minimizable: false,
          maximizable: false,
          title: 'About Claude Usage Tool',
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
          },
        });

        const iconPath = path.join(__dirname, '..', 'assets', 'icon.png');
        const iconBase64 = fs.existsSync(iconPath)
          ? 'data:image/png;base64,' + fs.readFileSync(iconPath).toString('base64')
          : '';

        const html = `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100vh;
                margin: 0;
                background: #1a1a1a;
                color: #fff;
                text-align: center;
                -webkit-user-select: none;
              }
              img { width: 64px; height: 64px; margin-bottom: 12px; }
              h1 { font-size: 16px; margin: 0 0 4px 0; font-weight: 600; }
              .version { font-size: 12px; color: #888; margin-bottom: 8px; }
              .author { font-size: 12px; color: #aaa; }
              a { color: #d97706; text-decoration: none; }
              a:hover { text-decoration: underline; }
            </style>
          </head>
          <body>
            <img src="${iconBase64}" alt="icon" />
            <h1>Claude Usage Tool</h1>
            <div class="version">ver 0.10</div>
            <div class="author">by <a href="mailto:kingi@kingigilbert.com">Kingi Gilbert</a></div>
          </body>
          </html>
        `;

        aboutWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
        aboutWindow.setMenu(null);
      }
    },
    { label: 'Quit', click: () => app.quit() },
  ]);
  
  tray.setContextMenu(contextMenu);
}

function createTray() {
  // Create a simple icon - in production, use a proper icon file
  const iconPath = path.join(__dirname, '..', 'assets', 'trayIconTemplate.png');
  let icon: Electron.NativeImage;

  try {
    icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) {
      // Fallback: create a simple 16x16 icon
      icon = nativeImage.createEmpty();
    }
  } catch {
    icon = nativeImage.createEmpty();
  }

  // If icon is empty, create a basic one programmatically
  if (icon.isEmpty()) {
    // Create a 16x16 basic icon
    const size = 16;
    const canvas = Buffer.alloc(size * size * 4);
    for (let i = 0; i < size * size; i++) {
      canvas[i * 4] = 100;     // R
      canvas[i * 4 + 1] = 100; // G
      canvas[i * 4 + 2] = 100; // B
      canvas[i * 4 + 3] = 255; // A
    }
    icon = nativeImage.createFromBuffer(canvas, { width: size, height: size });
  }

  tray = new Tray(icon);
  tray.setToolTip('Claude Usage Tool');

  // Initial menu
  updateTrayMenu();

  tray.on('click', () => {
    if (!mainWindow) return;
    
    // Debounce clicks to prevent rapid toggling
    const now = Date.now();
    if (now - lastClickTime < CLICK_DEBOUNCE) {
      console.log('Click debounced');
      return;
    }
    lastClickTime = now;
    
    // Use setImmediate to ensure state is consistent
    setImmediate(() => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      
      const isVisible = mainWindow.isVisible();
      const isFocused = mainWindow.isFocused();
      console.log('Tray clicked - visible:', isVisible, 'focused:', isFocused);
      
      // Simple logic: if visible (regardless of focus), hide it. Otherwise show it.
      if (isVisible) {
        console.log('Hiding window');
        mainWindow.hide();
      } else {
        console.log('Showing window');
        showWindow();
      }
    });
  });

  tray.on('right-click', () => {
    updateTrayMenu();
  });
}

function showWindow() {
  if (!mainWindow || !tray) return;

  const trayBounds = tray.getBounds();
  const windowBounds = mainWindow.getBounds();
  const display = screen.getDisplayNearestPoint({ x: trayBounds.x, y: trayBounds.y });

  let x: number, y: number;

  if (process.platform === 'win32') {
    // Windows: Position above tray icon (taskbar is usually at bottom)
    x = Math.round(trayBounds.x + trayBounds.width / 2 - windowBounds.width / 2);
    y = Math.round(trayBounds.y - windowBounds.height - 4);
    
    // If taskbar is at top, position below
    if (trayBounds.y < display.bounds.height / 2) {
      y = Math.round(trayBounds.y + trayBounds.height + 4);
    }
  } else {
    // macOS: Position below tray icon
    x = Math.round(trayBounds.x + trayBounds.width / 2 - windowBounds.width / 2);
    y = Math.round(trayBounds.y + trayBounds.height + 4);
  }

  // Ensure window is within display bounds
  if (x + windowBounds.width > display.bounds.x + display.bounds.width) {
    x = display.bounds.x + display.bounds.width - windowBounds.width;
  }
  if (x < display.bounds.x) {
    x = display.bounds.x;
  }
  if (y + windowBounds.height > display.bounds.y + display.bounds.height) {
    y = display.bounds.y + display.bounds.height - windowBounds.height;
  }
  if (y < display.bounds.y) {
    y = display.bounds.y;
  }

  mainWindow.setPosition(x, y, false);
  mainWindow.show();
}

let lastNotifiedPercentages: Map<string, number> = new Map();

function checkAndNotify(claudeUsage: any) {
  const threshold = store.get('notificationThreshold', 80);
  if (threshold === 0 || !claudeUsage?.bars) return;

  claudeUsage.bars.forEach((bar: any) => {
    const label = bar.label || 'Usage';
    const percentage = bar.percentage || 0;
    const lastNotified = lastNotifiedPercentages.get(label) || 0;

    // Notify if crossed threshold and haven't notified for this level yet
    if (percentage >= threshold && lastNotified < threshold) {
      const { Notification } = require('electron');
      const notification = new Notification({
        title: 'Claude Usage Alert',
        body: `${label}: ${percentage}% used (threshold: ${threshold}%)`,
        icon: path.join(__dirname, '..', 'assets', 'icon.png'),
      });
      notification.show();
      lastNotifiedPercentages.set(label, percentage);
      addLog(`Notification: ${label} at ${percentage}%`);
    }

    // Reset notification if usage dropped below threshold
    if (percentage < threshold - 10) {
      lastNotifiedPercentages.set(label, 0);
    }
  });
}

async function refreshAllData() {
  if (!mainWindow) return;

  addLog('Refreshing data...');

  try {
    const [claudeUsage, billingInfo] = await Promise.all([
      scrapeClaudeUsage().then(result => {
        if (result) {
          if (result.isAuthenticated) {
            addLog(`Usage: ${result.bars?.length || 0} bars fetched`);
            checkAndNotify(result);
          } else {
            addLog('Usage: Not authenticated');
          }
        } else {
          addLog('Usage: Skipped (in progress)');
        }
        return result;
      }).catch(err => {
        addLog(`Usage error: ${err.message}`);
        return null;
      }),
      scrapeBillingInfo().then(result => {
        if (result) {
          if (result.creditBalance !== null) {
            addLog(`Billing: $${result.creditBalance.toFixed(2)}`);
          } else {
            addLog('Billing: No balance data');
          }
        } else {
          addLog('Billing: Skipped (in progress)');
        }
        return result;
      }).catch(err => {
        addLog(`Billing error: ${err.message}`);
        return null;
      }),
    ]);

    mainWindow.webContents.send('app:data-updated', {
      claudeUsage,
      billingInfo,
      timestamp: new Date().toISOString(),
      logs: getRecentLogs(6),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    addLog(`Refresh failed: ${message}`);
  }
}

async function getApiData(): Promise<ApiData | null> {
  const adminKey = process.env.ANTHROPIC_ADMIN_KEY;
  console.log('getApiData called, key exists:', !!adminKey);
  console.log('Key starts with sk-ant-admin:', adminKey?.startsWith('sk-ant-admin'));
  console.log('Key prefix:', adminKey?.substring(0, 20));

  if (!adminKey) {
    console.log('Admin key not configured');
    return null;
  }

  // Accept both sk-ant-admin- and sk-ant-admin01- prefixes
  if (!adminKey.startsWith('sk-ant-admin')) {
    console.log('Invalid admin key format');
    return null;
  }

  const now = new Date();
  // Use a date from 30 days ago to now - using simple date strings
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const startDate = thirtyDaysAgo.toISOString().split('T')[0] + 'T00:00:00Z';
  const endDateStr = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0] + 'T00:00:00Z';

  try {
    console.log('Fetching API data from:', startDate, 'to:', endDateStr);

    const [usageReport, costReport, creditBalance] = await Promise.all([
      getUsageReport(adminKey, {
        starting_at: startDate,
        group_by: ['workspace_id', 'model'],
        limit: 31,
      }),
      getCostReport(adminKey, {
        starting_at: startDate,
        group_by: ['workspace_id'],
        limit: 31,
      }),
      getCreditBalance(adminKey).catch(err => {
        console.log('Credit balance not available:', err.message);
        return null;
      }),
    ]);

    console.log('API data fetched successfully');
    console.log('Usage buckets:', usageReport?.data?.length || 0);
    console.log('Cost buckets:', costReport?.data?.length || 0);
    console.log('Credit balance:', creditBalance?.available_credit || 'N/A');

    return { usageReport, costReport, creditBalance };
  } catch (error) {
    console.error('Error fetching API data:', error);
    throw error;
  }
}

function startAutoRefresh() {
  // Clear existing interval if any
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
  
  // Get refresh interval from settings (in seconds)
  const intervalSeconds = store.get('refreshInterval', 60);
  const intervalMs = intervalSeconds * 1000;
  
  // Refresh at specified interval
  refreshInterval = setInterval(refreshAllData, intervalMs);
  // Initial refresh
  refreshAllData();
}

// IPC Handlers
ipcMain.handle('claude-max:get-usage', async () => {
  try {
    return await scrapeClaudeUsage();
  } catch (error) {
    console.error('Failed to get Claude usage:', error);
    return null;
  }
});

ipcMain.handle('claude-max:is-authenticated', async () => {
  return isAuthenticated();
});

ipcMain.handle('claude-max:login', async () => {
  return openLoginWindow();
});

ipcMain.handle('platform:login', async () => {
  return openPlatformLoginWindow();
});

ipcMain.handle('app:refresh-all', async () => {
  await refreshAllData();
});

ipcMain.handle('app:get-admin-key-status', () => {
  const key = process.env.ANTHROPIC_ADMIN_KEY;
  return {
    configured: !!key && key.startsWith('sk-ant-admin'),
    hint: key ? `${key.substring(0, 15)}...` : null,
  };
});

ipcMain.handle('app:get-settings', () => {
  return {
    refreshInterval: store.get('refreshInterval', 60),
    autoStart: store.get('autoStart', false),
    notificationThreshold: store.get('notificationThreshold', 80),
  };
});

ipcMain.handle('app:save-settings', async (_event, settings: AppSettings) => {
  store.set('refreshInterval', settings.refreshInterval);
  store.set('autoStart', settings.autoStart);
  store.set('notificationThreshold', settings.notificationThreshold);
  
  // Restart auto-refresh with new interval
  startAutoRefresh();
  
  // Update auto-start setting
  app.setLoginItemSettings({
    openAtLogin: settings.autoStart,
    path: app.getPath('exe'),
  });
});

ipcMain.handle('app:set-auto-start', async (_event, enabled: boolean) => {
  store.set('autoStart', enabled);
  app.setLoginItemSettings({
    openAtLogin: enabled,
    path: app.getPath('exe'),
  });
});

ipcMain.on('window:hide', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.hide();
  }
});

// App lifecycle
app.whenReady().then(() => {
  createWindow();
  createTray();
  startAutoRefresh();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
});

// Hide dock icon on macOS (menu bar app)
if (process.platform === 'darwin') {
  app.dock?.hide();
}

// On Windows, prevent app from showing in taskbar
if (process.platform === 'win32') {
  app.setAppUserModelId('com.claude-usage-tool');
}
