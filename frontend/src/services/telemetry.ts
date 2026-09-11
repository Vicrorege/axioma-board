export interface TelemetryPayload {
  level: 'error' | 'warn' | 'info';
  message: string;
  stack?: string;
  component_stack?: string;
  url?: string;
  context?: Record<string, any>;
}

export async function sendClientLog(payload: TelemetryPayload) {
  try {
    const data = {
      ...payload,
      url: window.location.href,
    };
    await fetch('/api/telemetry/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      keepalive: true,
    });
  } catch (e) {
    // avoid error loop
  }
}

export function initClientTelemetry() {
  // Send startup heartbeat so we know client telemetry is alive
  sendClientLog({
    level: 'info',
    message: `AxiomaBoard client session started on ${window.location.host}`,
    context: { userAgent: navigator.userAgent },
  });

  // 1. Global uncaught exceptions
  window.addEventListener('error', (event) => {
    sendClientLog({
      level: 'error',
      message: event.message || 'Uncaught Error',
      stack: event.error?.stack || `${event.filename}:${event.lineno}:${event.colno}`,
      context: { type: 'window.onerror' },
    });
  });

  // 2. Unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    sendClientLog({
      level: 'error',
      message: reason?.message || String(reason) || 'Unhandled Promise Rejection',
      stack: reason?.stack,
      context: { type: 'unhandledrejection' },
    });
  });

  // 3. Intercept console.error
  const origConsoleError = console.error;
  console.error = (...args: any[]) => {
    origConsoleError.apply(console, args);
    try {
      const msg = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
      if (msg.includes('/api/telemetry/log')) return;
      const stack = new Error().stack;
      sendClientLog({
        level: 'error',
        message: msg,
        stack,
        context: { type: 'console.error' },
      });
    } catch {
      // ignore
    }
  };
}
