export { streamCodeBridgeChat, applyPatch, checkBridgeHealth, connectToEventStream } from './codeBridgeClient';
export type {
  CodeModeChatParams,
  BridgeEvent,
  BridgeTextEvent,
  BridgePatchProposalEvent,
  BridgeToolCallEvent,
  BridgeToolResultEvent,
  BridgeErrorEvent,
  BridgeDoneEvent,
  ApplyPatchResult,
  BridgeSSEEvent,
  BridgeSSEConnectedEvent,
  BridgeSSEHeartbeatEvent,
  BridgeSSEClosingEvent,
} from './types';

