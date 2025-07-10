// TODO: Future Slack gateway implementation
// import { App } from '@slack/bolt';
// import { BaseGateway, type GatewayConfig } from '../base-gateway.js';
// import { MessageRouter } from '../message-router.js';
// import { SlackExtractor } from './slack-extractor.js';
// import type { MessageProcessor } from '../types.js';

// export class SlackGateway extends BaseGateway {
//   private app: App;
//   private messageRouter: MessageRouter;
//   private status: 'starting' | 'running' | 'stopping' | 'stopped' = 'stopped';

//   constructor(config: GatewayConfig) {
//     super(config);
//     this.app = new App({
//       token: config.token,
//       signingSecret: config.signingSecret,
//     });
    
//     const slackExtractor = new SlackExtractor();
//     this.messageRouter = new MessageRouter(slackExtractor);
    
//     this.setupHandlers();
//   }

//   getGatewayType(): string {
//     return 'slack';
//   }

//   getStatus(): 'starting' | 'running' | 'stopping' | 'stopped' {
//     return this.status;
//   }

//   registerProcessor(type: string, processor: MessageProcessor): void {
//     this.messageRouter.registerProcessor(type, processor);
//   }

//   private setupHandlers() {
//     // Handle text messages
//     this.app.message(async ({ message, say }) => {
//       // Implementation for Slack message handling
//     });
//   }

//   start(): void {
//     this.status = 'starting';
//     this.app.start();
//     this.status = 'running';
//     console.log('Slack gateway started');
//   }

//   stop(): void {
//     this.status = 'stopping';
//     this.app.stop();
//     this.status = 'stopped';
//     console.log('Slack gateway stopped');
//   }
// }

// Template for future implementation
export const SlackGateway = null; 