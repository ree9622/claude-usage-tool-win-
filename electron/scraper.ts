import { BrowserWindow, session } from 'electron';

export interface UsageBar {
  used: number;
  limit: number;
  percentage: number;
  label?: string;
  context?: string;
}

export interface ClaudeMaxUsage {
  standard: UsageBar;
  advanced: UsageBar;
  bars?: UsageBar[];
  resetDate: string | null;
  lastUpdated: string;
  isAuthenticated: boolean;
}

let scraperWindow: BrowserWindow | null = null;
let loginWindow: BrowserWindow | null = null;
const CLAUDE_USAGE_URL = 'https://claude.ai/settings/usage';
const CLAUDE_SESSION_NAME = 'claude-session';

function getSession() {
  return session.fromPartition(`persist:${CLAUDE_SESSION_NAME}`);
}

export async function isAuthenticated(): Promise<boolean> {
  const ses = getSession();
  const cookies = await ses.cookies.get({ domain: '.claude.ai' });
  // Check for various session cookies that indicate authentication
  const hasSession = cookies.some(c =>
    c.name === 'sessionKey' ||
    c.name === '__Secure-next-auth.session-token' ||
    c.name === 'lastActiveOrg' ||
    (c.name.includes('session') && c.value.length > 20)
  );
  console.log('Auth check - cookies found:', cookies.map(c => c.name).join(', '));
  console.log('Auth check - has session:', hasSession);
  return hasSession;
}

export async function scrapeClaudeUsage(): Promise<ClaudeMaxUsage | null> {
  console.log('Starting Claude usage scrape...');

  return new Promise((resolve) => {
    if (scraperWindow && !scraperWindow.isDestroyed()) {
      scraperWindow.close();
    }

    scraperWindow = new BrowserWindow({
      width: 1000,
      height: 800,
      show: false, // Set to true to debug
      webPreferences: {
        session: getSession(),
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        console.log('Scraper timeout reached');
        resolved = true;
        scraperWindow?.close();
        scraperWindow = null;
        resolve(null);
      }
    }, 30000);

    // Check for redirects to login page
    scraperWindow.webContents.on('did-navigate', (_, url) => {
      console.log('Navigation to:', url);
      if (url.includes('/login') || url.includes('/signup')) {
        console.log('Redirected to login - not authenticated');
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          scraperWindow?.close();
          scraperWindow = null;
          resolve({
            standard: { used: 0, limit: 0, percentage: 0 },
            advanced: { used: 0, limit: 0, percentage: 0 },
            resetDate: null,
            lastUpdated: new Date().toISOString(),
            isAuthenticated: false,
          });
        }
      }
    });

    scraperWindow.webContents.on('did-finish-load', async () => {
      if (resolved) return;
      if (!scraperWindow || scraperWindow.isDestroyed()) return;

      const currentUrl = scraperWindow.webContents.getURL() || '';
      console.log('Page loaded:', currentUrl);

      // If we're on login page, user is not authenticated
      if (currentUrl.includes('/login') || currentUrl.includes('/signup')) {
        resolved = true;
        clearTimeout(timeout);
        scraperWindow?.close();
        scraperWindow = null;
        resolve({
          standard: { used: 0, limit: 0, percentage: 0 },
          advanced: { used: 0, limit: 0, percentage: 0 },
          resetDate: null,
          lastUpdated: new Date().toISOString(),
          isAuthenticated: false,
        });
        return;
      }

      // Wait for JavaScript to render the usage data
      await new Promise(r => setTimeout(r, 3000));

      // Check again after waiting
      if (resolved || !scraperWindow || scraperWindow.isDestroyed()) return;

      try {
        const result = await scraperWindow.webContents.executeJavaScript(`
          (function() {
            // Note: avoid console.log here as it can cause EPIPE errors when window closes

            const usage = {
              bars: [],
              resetDate: null,
              isAuthenticated: true,
              rawText: ''
            };

            // Check if on login page
            if (window.location.href.includes('/login') ||
                window.location.href.includes('/signup') ||
                document.body.innerText.includes('Welcome back') && document.body.innerText.includes('Continue with')) {
              usage.isAuthenticated = false;
              return JSON.stringify(usage);
            }

            const text = document.body.innerText;
            usage.rawText = text.substring(0, 2000);

            // Parse the structured usage sections from Claude's settings page
            // The page structure is:
            // - Current session / Resets in X hr Y min / X% used
            // - All models / Resets Day Time / X% used
            // - Sonnet only / Resets Day Time / X% used
            // - Extra usage / Resets Month Day / X% used

            const lines = text.split('\\n').map(l => l.trim()).filter(l => l);

            // Define the section labels we're looking for
            const sectionLabels = [
              'Current session',
              'All models',
              'Sonnet only',
              'Extra usage',
              'Weekly limit',
              'Weekly limits',
              'Daily limit',
              'Monthly limit',
              'Standard',
              'Advanced'
            ];

            for (let i = 0; i < lines.length; i++) {
              const line = lines[i];

              // Check if this line matches a section label (case insensitive)
              const isLabel = sectionLabels.some(label =>
                line.toLowerCase() === label.toLowerCase()
              );

              if (isLabel) {
                const label = line;
                let percentage = 0;
                let resetInfo = '';

                // Look at next few lines for reset info and percentage
                for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
                  const nextLine = lines[j];

                  // Look for "Resets ..." pattern
                  if (nextLine.toLowerCase().startsWith('reset')) {
                    resetInfo = nextLine;
                  }

                  // Look for "X% used" pattern
                  const pctMatch = nextLine.match(/(\\d+)%\\s*used/i);
                  if (pctMatch) {
                    percentage = parseInt(pctMatch[1], 10);
                    break; // Found the percentage, stop looking
                  }
                }

                // Only add if we found meaningful data
                if (percentage >= 0 || resetInfo) {
                  // Skip "Weekly limits" header if we have individual models
                  if (line.toLowerCase() === 'weekly limits') continue;

                  usage.bars.push({
                    value: percentage,
                    max: 100,
                    label: label,
                    resetInfo: resetInfo,
                    percentage: percentage
                  });
                }
              }
            }

            // Fallback: if no bars found, try to find percentages
            if (usage.bars.length === 0) {
              const percentMatches = text.matchAll(/(\\d+)\\s*%\\s*used/gi);
              let idx = 0;
              const defaultLabels = ['Current Session', 'All models', 'Sonnet only', 'Extra usage'];

              for (const match of percentMatches) {
                const pct = parseInt(match[1], 10);
                if (pct >= 0 && pct <= 100) {
                  const exists = usage.bars.some(b => Math.abs(b.percentage - pct) < 1);
                  if (!exists) {
                    const matchIndex = match.index || 0;
                    const contextStart = Math.max(0, matchIndex - 100);
                    const contextEnd = Math.min(text.length, matchIndex + 100);
                    const context = text.substring(contextStart, contextEnd);

                    const resetMatch = context.match(/Resets?[^\\n]*/i);

                    usage.bars.push({
                      value: pct,
                      max: 100,
                      label: defaultLabels[idx] || 'Usage ' + (idx + 1),
                      resetInfo: resetMatch ? resetMatch[0].trim() : '',
                      percentage: pct
                    });
                    idx++;
                  }
                }
              }
            }

            // Find general reset date as fallback
            const resetPatterns = [
              /Resets\\s+in\\s+(\\d+\\s*hr?\\s*\\d*\\s*min[^\\n]*)/i,
              /Resets\\s+(Mon|Tue|Wed|Thu|Fri|Sat|Sun)[^\\n]*/i,
              /resets?\\s*(?:on|in|:)?\\s*([A-Za-z]+\\s+\\d+)/i,
              /in\\s+(\\d+)\\s*days?/i
            ];

            for (const pattern of resetPatterns) {
              const match = text.match(pattern);
              if (match) {
                usage.resetDate = match[0].trim();
                break;
              }
            }

            return JSON.stringify(usage);
          })();
        `);

        if (resolved) return;

        if (result) {
          const parsed = JSON.parse(result);
          resolved = true;
          clearTimeout(timeout);

          // Safely close window
          if (scraperWindow && !scraperWindow.isDestroyed()) {
            scraperWindow.close();
          }
          scraperWindow = null;

          // Convert bars array to our format
          const bars: UsageBar[] = parsed.bars.map((bar: { value: number; max: number; percentage: number; label?: string; context?: string; resetInfo?: string }) => ({
            used: bar.value,
            limit: bar.max,
            percentage: bar.percentage,
            label: bar.label,
            context: bar.resetInfo || bar.context  // Use resetInfo as context for display
          }));

          const standardBar = bars[0] || { used: 0, limit: 0, percentage: 0 };
          const advancedBar = bars[1] || { used: 0, limit: 0, percentage: 0 };

          resolve({
            standard: standardBar,
            advanced: advancedBar,
            bars: bars,  // Pass all bars for dynamic display
            resetDate: parsed.resetDate,
            lastUpdated: new Date().toISOString(),
            isAuthenticated: parsed.isAuthenticated,
          });
        }
      } catch (error) {
        // Ignore EPIPE errors that occur when window is destroyed during scraping
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (!errorMessage.includes('EPIPE')) {
          console.error('Scraping error:', error);
        }
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          if (scraperWindow && !scraperWindow.isDestroyed()) {
            scraperWindow.close();
          }
          scraperWindow = null;
          resolve(null);
        }
      }
    });

    scraperWindow.loadURL(CLAUDE_USAGE_URL);
  });
}

export function openLoginWindow(): Promise<boolean> {
  return new Promise((resolve) => {
    if (loginWindow && !loginWindow.isDestroyed()) {
      loginWindow.focus();
      resolve(false);
      return;
    }

    loginWindow = new BrowserWindow({
      width: 500,
      height: 700,
      title: 'Login to Claude',
      webPreferences: {
        session: getSession(),
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    loginWindow.on('closed', async () => {
      loginWindow = null;
      const auth = await isAuthenticated();
      resolve(auth);
    });

    // Watch for successful login by detecting navigation to dashboard
    loginWindow.webContents.on('did-navigate', async (_, url) => {
      if (url.includes('claude.ai') && !url.includes('login') && !url.includes('signup')) {
        // User successfully logged in
        setTimeout(() => {
          loginWindow?.close();
        }, 1000);
      }
    });

    loginWindow.loadURL('https://claude.ai/login');
  });
}
