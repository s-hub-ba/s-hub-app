import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import net from 'net';
import paypalRoutes from './server/paypal.js';
import agencyRoutes from './server/routes/agency.js';
import nannyRoutes from './server/routes/nanny.js';
import familyRoutes from './server/routes/family.js';
import schedulingRoutes from './server/routes/scheduling.js';
import adminRoutes from './server/routes/admin.js';
import notificationsRoutes from './server/routes/notifications.js';
import { startNotificationWorker } from './server/services/notificationWorker.ts';

dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local', override: true });

async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const tester = net
      .createServer()
      .once('error', () => resolve(false))
      .once('listening', () => {
        tester.close(() => resolve(true));
      })
      .listen(port, '0.0.0.0');
  });
}

async function findAvailablePort(preferredPort: number, range = 50): Promise<number> {
  for (let offset = 0; offset <= range; offset += 1) {
    const candidate = preferredPort + offset;
    if (await isPortAvailable(candidate)) {
      return candidate;
    }
  }
  throw new Error(`No available port found between ${preferredPort} and ${preferredPort + range}`);
}

async function startServer() {
  const app = express();
  const preferredPort = Number(process.env.PORT || 3000);
  const port = await findAvailablePort(preferredPort);
  startNotificationWorker();

  const configuredOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const defaultOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://s-hub-ba.github.io'
  ];

  const allowedOrigins = configuredOrigins.length > 0 ? configuredOrigins : defaultOrigins;

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (process.env.NODE_ENV !== 'production' && origin.startsWith('http://localhost')) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'x-agency-id'],
    credentials: true,
  }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // PayPal Webhooks & Routes
  app.use('/api/paypal', paypalRoutes);
  
  // Agency & Nanny Routes
  app.use('/api/agency', agencyRoutes);
  app.use('/api/nanny', nannyRoutes);
  app.use('/api/family', familyRoutes);
  app.use('/api/scheduling', schedulingRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/notifications', notificationsRoutes);

  // Vite middleware for development and SPA fallback
  if (process.env.NODE_ENV !== 'production' && process.env.DISABLE_VITE !== 'true') {
    // Keep HMR off by default to avoid websocket port collisions (can be enabled explicitly).
    if (process.env.ENABLE_HMR !== 'true') {
      process.env.DISABLE_HMR = 'true';
    }

    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production: frontend is on GitHub Pages, this server is API-only.
    app.get('/', (req, res) => {
      res.json({ status: 'ok', service: 'Shift Me Up API', timestamp: new Date().toISOString() });
    });
    app.use((req: any, res: any) => {
      res.status(404).json({ error: 'Not found' });
    });
  }

  app.listen(port, '0.0.0.0', () => {
    const suffix = port !== preferredPort ? ` (preferred ${preferredPort} was busy)` : '';
    console.log(`Server running on http://0.0.0.0:${port}${suffix}`);
  });
}

startServer();
