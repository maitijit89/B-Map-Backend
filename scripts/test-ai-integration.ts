import { env } from '../src/core/config/env.config';
import { aiCopilotService, aiCopilotSocketBridge } from '../src/modules/ai-copilot';

async function main() {
  console.log('--- Testing AI Integration Config ---');
  console.log(`Server URL       : ${env.AI_BACKEND_URL}`);
  console.log(`WebSocket Gateway: ${env.AI_BACKEND_WS_URL}`);
  console.log(`Environment      : ${env.APP_ENV}`);
  console.log(`Gemma Model URL  : ${env.GEMMA_MODEL_URL}`);
  console.log(`Auto-start Model : ${env.AUTO_START_GEMMA}`);

  console.log('\n--- Initializing AI Connection ---');
  await aiCopilotService.initializeAIConnection();

  // Wait 1.5s for WebSocket connection handshake to complete
  await new Promise((resolve) => setTimeout(resolve, 1500));

  console.log('\n--- Fetching Comprehensive Diagnostics ---');
  const status = await aiCopilotService.getComprehensiveAIStatus();
  console.log(JSON.stringify(status, null, 2));

  console.log('\n--- Testing Socket Bridge Stream ---');
  const streamed = aiCopilotSocketBridge.streamToGateway(
    {
      sessionId: 'test_session_verification_1',
      driverId: 'test_driver_1',
      prompt: 'Find nearest coffee shop along the route',
      telemetry: {
        coordinates: [77.5946, 12.9716],
        speedKmH: 45,
        headingDeg: 90,
      },
    },
    (statusEv) => {
      console.log('Received WebSocket Status Event:', statusEv);
    },
    (respEv) => {
      console.log('Received WebSocket Response Event:', JSON.stringify(respEv).slice(0, 200) + '...');
    },
    (errEv) => {
      console.error('WebSocket Error Event:', errEv);
    }
  );
  console.log('Streamed over WebSocket bridge:', streamed);

  // Wait 4 seconds to observe WebSocket exchange
  await new Promise((resolve) => setTimeout(resolve, 4000));

  aiCopilotSocketBridge.disconnect();
  console.log('\n✅ Verification completed successfully!');
  process.exit(0);
}

main().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
