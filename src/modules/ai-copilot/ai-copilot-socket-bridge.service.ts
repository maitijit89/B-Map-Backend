import { io as createClientSocket, Socket as ClientSocket } from 'socket.io-client';
import { env } from '../../core/config/env.config';
import { logger } from '../../core/config/logger';

export interface CopilotStreamBridgePayload {
  sessionId?: string;
  driverId?: string;
  prompt: string;
  telemetry?: any;
}

export interface CopilotSocketBridgeStatus {
  isConnected: boolean;
  gatewayUrl: string;
  transport?: string;
  lastConnectedAt?: string;
  lastDisconnectedAt?: string;
  lastError?: string;
}

export class AICopilotSocketBridge {
  private clientSocket: ClientSocket | null = null;
  private isConnected: boolean = false;
  private lastConnectedAt?: string;
  private lastDisconnectedAt?: string;
  private lastError?: string;
  private responseCallbacks = new Map<
    string,
    {
      onStatus?: (status: any) => void;
      onResponse: (response: any) => void;
      onError: (err: any) => void;
      timeout: NodeJS.Timeout;
    }
  >();

  /**
   * Initializes and maintains the persistent WebSocket gateway connection to b_map_ai
   */
  public connect(): void {
    if (this.clientSocket?.connected) {
      return;
    }

    try {
      logger.info(`🔌 [AICopilotSocketBridge] Connecting to AI WebSocket Gateway: ${env.AI_BACKEND_WS_URL}`);

      this.clientSocket = createClientSocket(env.AI_BACKEND_WS_URL, {
        auth: {
          token: env.AI_BACKEND_API_KEY,
        },
        extraHeaders: {
          'x-api-key': env.AI_BACKEND_API_KEY,
        },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 2000,
        reconnectionDelayMax: 10000,
        timeout: 10000,
      });

      this.clientSocket.on('connect', () => {
        this.isConnected = true;
        this.lastConnectedAt = new Date().toISOString();
        this.lastError = undefined;
        logger.info(
          `⚡ [AICopilotSocketBridge] Connected to AI WebSocket Gateway at ${env.AI_BACKEND_WS_URL} (id: ${this.clientSocket?.id})`
        );
      });

      this.clientSocket.on('disconnect', (reason: string) => {
        this.isConnected = false;
        this.lastDisconnectedAt = new Date().toISOString();
        logger.warn(`⚠️ [AICopilotSocketBridge] Disconnected from AI WebSocket Gateway (reason: ${reason})`);
      });

      this.clientSocket.on('connect_error', (err: Error) => {
        this.isConnected = false;
        this.lastError = err.message;
        logger.warn(`⚠️ [AICopilotSocketBridge] Connection error to ${env.AI_BACKEND_WS_URL}: ${err.message}`);
      });

      // Listen for real-time processing status events from AI microservice
      this.clientSocket.on('copilot_processing_status', (data: any) => {
        // Forward status to active streams
        for (const [, handlers] of this.responseCallbacks) {
          if (handlers.onStatus) {
            try {
              handlers.onStatus(data);
            } catch {
              // ignore callback error
            }
          }
        }
      });

      // Listen for structured responses from AI microservice
      this.clientSocket.on('copilot_message_response', (data: any) => {
        const sessionId = data?.sessionId || data?.data?.sessionId;
        if (sessionId && this.responseCallbacks.has(sessionId)) {
          const handlers = this.responseCallbacks.get(sessionId)!;
          clearTimeout(handlers.timeout);
          this.responseCallbacks.delete(sessionId);
          handlers.onResponse(data);
          return;
        }

        // If no explicit sessionId match, resolve the oldest pending stream
        const firstEntry = this.responseCallbacks.entries().next().value;
        if (firstEntry) {
          const [id, handlers] = firstEntry;
          clearTimeout(handlers.timeout);
          this.responseCallbacks.delete(id);
          handlers.onResponse(data);
        }
      });

      // Listen for error events from AI microservice
      this.clientSocket.on('copilot_error', (errData: any) => {
        for (const [id, handlers] of this.responseCallbacks) {
          clearTimeout(handlers.timeout);
          this.responseCallbacks.delete(id);
          handlers.onError(errData);
          break;
        }
      });
    } catch (err: any) {
      this.isConnected = false;
      this.lastError = err.message;
      logger.error(`❌ [AICopilotSocketBridge] Failed to initialize socket bridge: ${err.message}`);
    }
  }

  /**
   * Streams a voice or text message to the AI WebSocket Gateway.
   * Returns true if sent over WebSocket, false if not connected (caller should use HTTP fallback).
   */
  public streamToGateway(
    payload: CopilotStreamBridgePayload,
    onStatus?: (status: any) => void,
    onResponse?: (response: any) => void,
    onError?: (err: any) => void
  ): boolean {
    if (!this.isConnected || !this.clientSocket?.connected) {
      return false;
    }

    const sessionId = payload.sessionId || `stream_${Date.now()}`;

    // Register callback with 15s timeout
    if (onResponse && onError) {
      const timeout = setTimeout(() => {
        if (this.responseCallbacks.has(sessionId)) {
          this.responseCallbacks.delete(sessionId);
          onError({ message: 'AI WebSocket Gateway response timed out' });
        }
      }, 15000);

      this.responseCallbacks.set(sessionId, {
        onStatus,
        onResponse,
        onError,
        timeout,
      });
    }

    const sanitizedTelemetry = {
      coordinates: payload.telemetry?.coordinates || [77.5946, 12.9716],
      speedKmH: payload.telemetry?.speedKmH ?? 50,
      headingDeg: payload.telemetry?.headingDeg ?? 90,
      remainingDistanceMeters: payload.telemetry?.remainingDistanceMeters ?? 5000,
      etaMinutes: payload.telemetry?.etaMinutes ?? 10,
      batteryOrFuelSoC: payload.telemetry?.batteryOrFuelSoC ?? 80,
      activeRouteId: payload.telemetry?.activeRouteId || 'active_route_live',
      destinationMetadata: {
        name: payload.telemetry?.destinationMetadata?.name || 'Destination Hub',
        coordinates: payload.telemetry?.destinationMetadata?.coordinates || [77.6046, 12.9816],
        address: payload.telemetry?.destinationMetadata?.address || '',
        category: payload.telemetry?.destinationMetadata?.category || 'general',
      },
    };

    this.clientSocket.emit('copilot_message_stream', {
      sessionId,
      driverId: payload.driverId || 'bmap_driver',
      prompt: payload.prompt,
      telemetry: sanitizedTelemetry,
    });

    return true;
  }

  /**
   * Diagnostic health information of the AI WebSocket Gateway connection
   */
  public getStatus(): CopilotSocketBridgeStatus {
    return {
      isConnected: this.isConnected && Boolean(this.clientSocket?.connected),
      gatewayUrl: env.AI_BACKEND_WS_URL,
      transport: this.clientSocket?.io?.engine?.transport?.name,
      lastConnectedAt: this.lastConnectedAt,
      lastDisconnectedAt: this.lastDisconnectedAt,
      lastError: this.lastError,
    };
  }

  /**
   * Disconnects the socket bridge
   */
  public disconnect(): void {
    if (this.clientSocket) {
      this.clientSocket.disconnect();
      this.clientSocket = null;
      this.isConnected = false;
    }
  }
}

export const aiCopilotSocketBridge = new AICopilotSocketBridge();
