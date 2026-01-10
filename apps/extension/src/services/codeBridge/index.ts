export { streamCodeBridgeChat, checkBridgeHealth, connectToEventStream } from './codeBridgeClient';
export { registerToolsWithBridge, connectToToolEvents } from './toolBridgeClient';
export type {
  CliBridgeChatParams,
  BridgeEvent,
  BridgeTextEvent,
  BridgeToolCallEvent,
  BridgeToolResultEvent,
  BridgeErrorEvent,
  BridgeDoneEvent,
  BridgeSSEEvent,
  BridgeSSEConnectedEvent,
  BridgeSSEHeartbeatEvent,
  BridgeSSEClosingEvent,
} from './types';

