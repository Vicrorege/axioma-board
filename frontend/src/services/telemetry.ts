export interface TelemetryPayload {
  level: 'error' | 'warn' | 'info';
  message: string;
  stack?: string;
  component_stack?: string;
  url?: string;
  context?: Record<string, any>;
}

// In-memory ring buffer of recent logs for debugging on window.__axiomaLogs
const LOG_BUFFER_LIMIT = 50;
const logBuffer: Array<TelemetryPayload & { timestamp: string }> = [];

declare global {
  interface Window {
    __axiomaLogs?: Array<TelemetryPayload & { timestamp: string }>;
  }
}

function formatArg(a: any): string {
  if (a == null) return String(a);
  if (typeof a === 'string') return a;

  // Handles native Errors, Custom Errors, and Error-like objects
  if (a instanceof Error || (typeof a === 'object' && ('message' in a || 'stack' in a))) {
    const name = a.name || 'Error';
    const msg = a.message || String(a);
    const stack = a.stack || '';
    const cause = a.cause ? `\nCause: ${formatArg(a.cause)}` : '';
    return `${name}: ${msg}\n${stack}${cause}`.trim();
  }

  if (typeof a === 'object') {
    try {
      const plain: Record<string, any> = {};
      const propNames = Object.getOwnPropertyNames(a);
      for (const k of propNames) {
        plain[k] = a[k];
      }
      return JSON.stringify(plain, null, 2);
    } catch {
      return String(a);
    }
  }

  return String(a);
}

export async function sendClientLog(payload: TelemetryPayload) {
  try {
    const entry = {
      ...payload,
      timestamp: new Date().toISOString(),
      url: window.location.href,
    };

    // Save into ring buffer
    logBuffer.push(entry);
    if (logBuffer.length > LOG_BUFFER_LIMIT) {
      logBuffer.shift();
    }
    window.__axiomaLogs = logBuffer;

    await fetch('/api/telemetry/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
      keepalive: true,
    });
  } catch {
    // avoid recursive error reporting
  }
}

export function initClientTelemetry() {
  window.__axiomaLogs = logBuffer;

  // Send startup heartbeat
  sendClientLog({
    level: 'info',
    message: `AxiomaBoard client session started on ${window.location.host}`,
    context: { userAgent: navigator.userAgent },
  });

  // 1. Global uncaught exceptions
  window.addEventListener('error', (event) => {
    if (event.message && event.message.includes('ResizeObserver')) return;

    let errorDetail = '';
    if (event.error) {
      errorDetail = formatArg(event.error);
    } else {
      errorDetail = `${event.message} (${event.filename}:${event.lineno}:${event.colno})`;
    }

    sendClientLog({
      level: 'error',
      message: errorDetail,
      stack: event.error?.stack || `${event.filename}:${event.lineno}:${event.colno}`,
      context: { type: 'window.onerror' },
    });
  });

  // 2. Unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    if (reason && typeof reason === 'object' && reason.message?.includes('ResizeObserver')) return;

    const formatted = formatArg(reason);
    sendClientLog({
      level: 'error',
      message: formatted || 'Unhandled Promise Rejection',
      stack: reason?.stack,
      context: { type: 'unhandledrejection' },
    });
  });

  // 3. Intercept console.error with deep formatting & React component stack extraction
  const origConsoleError = console.error;
  console.error = (...args: any[]) => {
    origConsoleError.apply(console, args);
    try {
      const combined = args.map(formatArg).join('\n');
      if (combined.includes('ResizeObserver')) return;
      if (combined.includes('/api/telemetry/log')) return;

      let compStack = '';
      for (const arg of args) {
        if (typeof arg === 'string' && arg.includes('\n    in ')) {
          compStack = arg;
        } else if (arg && typeof arg === 'object' && arg.componentStack) {
          compStack = arg.componentStack;
        }
      }

      sendClientLog({
        level: 'error',
        message: combined || 'Empty error object logged',
        stack: new Error().stack,
        component_stack: compStack || undefined,
        context: { type: 'console.error' },
      });
    } catch {
      // ignore
    }
  };
}
