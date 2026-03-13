import express from 'express';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import paypalRoutes from './server/paypal.js';
import agencyRoutes from './server/routes/agency.js';
import nannyRoutes from './server/routes/nanny.js';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // PayPal Webhooks & Routes
  app.use('/api/paypal', paypalRoutes);
  
  // Agency & Nanny Routes
  app.use('/api/agency', agencyRoutes);
  app.use('/api/nanny', nannyRoutes);

  // Vite middleware for development and SPA fallback
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve static files from dist
    app.use(express.static('dist'));
    app.get('*', (req, res) => {
      res.sendFile('dist/index.html', { root: '.' });
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
