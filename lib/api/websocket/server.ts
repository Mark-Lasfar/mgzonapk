import { Server as WebSocketServer } from 'ws';
import { Server as HTTPServer } from 'http';
import { parse } from 'url';
import { validateApiKey } from '../middleware/auth';
import { logger } from '../services/logging';

export class TrackingWebSocketServer {
  private wss: WebSocketServer;
  private clients: Map<string, Set<WebSocket>> = new Map();

  constructor(server: HTTPServer) {
    this.wss = new WebSocketServer({ noServer: true });
    
    server.on('upgrade', async (request, socket, head) => {
      try {
        const { pathname, query } = parse(request.url!, true);
        
        if (pathname === '/api/v1/tracking') {
          const authError = await validateApiKey({
            headers: new Headers({ 'x-api-key': query.apiKey as string }),
            url: request.url!,
            method: request.method!,
          } as any);

          if (authError) {
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
            return;
          }

          this.wss.handleUpgrade(request, socket, head, (ws) => {
            this.wss.emit('connection', ws, request);
          });
        }
      } catch (error) {
        logger.error('WebSocket upgrade error:', error);
        socket.destroy();
      }
    });

    this.wss.on('connection', (ws, request) => {
      const { query } = parse(request.url!, true);
      const userId = query.userId as string;

      if (!this.clients.has(userId)) {
        this.clients.set(userId, new Set());
      }
      this.clients.get(userId)!.add(ws);

      ws.on('close', () => {
        this.clients.get(userId)?.delete(ws);
        if (this.clients.get(userId)?.size === 0) {
          this.clients.delete(userId);
        }
      });

      ws.send(JSON.stringify({
        type: 'connection',
        status: 'connected',
        timestamp: new Date().toISOString()
      }));
    });
  }

  public broadcastToUser(userId: string, data: any) {
    const userClients = this.clients.get(userId);
    if (userClients) {
      const message = JSON.stringify(data);
      userClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    }
  }
}