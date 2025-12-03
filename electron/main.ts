import { app, BrowserWindow, ipcMain, Tray, nativeImage, Menu, screen, dialog } from 'electron';
import * as path from 'path';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import { scrapeClaudeUsage, openLoginWindow, isAuthenticated } from './scraper';
import { getUsageReport, getCostReport, getCreditBalance, ApiData } from './adminApi';

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

const isDev = process.env.NODE_ENV !== 'production' || !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 320,
    height: 480,
    show: false,
    frame: false,
    resizable: false,
    skipTaskbar: true,
    transparent: true,
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
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.on('blur', () => {
    mainWindow?.hide();
  });
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

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Refresh', click: () => refreshAllData() },
    { label: 'Login to Claude', click: () => openLoginWindow() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);

  tray.on('click', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide();
    } else {
      showWindow();
    }
  });

  tray.on('right-click', () => {
    tray?.popUpContextMenu(contextMenu);
  });
}

function showWindow() {
  if (!mainWindow || !tray) return;

  const trayBounds = tray.getBounds();
  const windowBounds = mainWindow.getBounds();
  const display = screen.getDisplayNearestPoint({ x: trayBounds.x, y: trayBounds.y });

  // Position window below tray icon (macOS style)
  let x = Math.round(trayBounds.x + trayBounds.width / 2 - windowBounds.width / 2);
  let y = Math.round(trayBounds.y + trayBounds.height + 4);

  // Ensure window is within display bounds
  if (x + windowBounds.width > display.bounds.x + display.bounds.width) {
    x = display.bounds.x + display.bounds.width - windowBounds.width;
  }
  if (x < display.bounds.x) {
    x = display.bounds.x;
  }

  mainWindow.setPosition(x, y, false);
  mainWindow.show();
  mainWindow.focus();
}

async function refreshAllData() {
  if (!mainWindow) return;

  try {
    const [claudeUsage, apiData] = await Promise.all([
      scrapeClaudeUsage().catch(err => {
        console.error('Failed to scrape Claude usage:', err);
        return null;
      }),
      getApiData().catch(err => {
        console.error('Failed to get API data:', err);
        return null;
      }),
    ]);

    mainWindow.webContents.send('app:data-updated', {
      claudeUsage,
      apiData,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to refresh data:', error);
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
  // Refresh every 60 seconds
  refreshInterval = setInterval(refreshAllData, 60000);
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

ipcMain.handle('api:get-data', async () => {
  try {
    return await getApiData();
  } catch (error) {
    console.error('Failed to get API data:', error);
    return null;
  }
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
