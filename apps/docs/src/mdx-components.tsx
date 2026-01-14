import defaultComponents from 'fumadocs-ui/mdx';
import { Callout } from 'fumadocs-ui/components/callout';
import { ImageZoom } from 'fumadocs-ui/components/image-zoom';
import { Tab, Tabs } from 'fumadocs-ui/components/tabs';
import { Accordion, Accordions } from 'fumadocs-ui/components/accordion';
import type { MDXComponents } from 'mdx/types';
import { ServerToolsSequence } from '@/components/diagrams/ServerToolsSequence';
import { StdioMcpSequence } from '@/components/diagrams/StdioMcpSequence';
import { OAuthFlowSequence } from '@/components/diagrams/OAuthFlowSequence';
import { McpOAuthSequence } from '@/components/diagrams/McpOAuthSequence';
import { McpToolApprovalSequence } from '@/components/diagrams/McpToolApprovalSequence';
import { McpToolExecutionSequence } from '@/components/diagrams/McpToolExecutionSequence';
import { McpConnectionStatesDiagram } from '@/components/diagrams/McpConnectionStatesDiagram';
import { CliBridgeConnectionSequence } from '@/components/diagrams/CliBridgeConnectionSequence';
import { CliBridgeToolRegistrationSequence } from '@/components/diagrams/CliBridgeToolRegistrationSequence';
import { CliBridgeChatSequence } from '@/components/diagrams/CliBridgeChatSequence';
import { CliBridgeToolApprovalSequence } from '@/components/diagrams/CliBridgeToolApprovalSequence';
import { CliBridgeArchitectureDiagram } from '@/components/diagrams/CliBridgeArchitectureDiagram';
import { ExtensionContextsDiagram } from '@/components/diagrams/ExtensionContextsDiagram';

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultComponents,
    Callout,
    ImageZoom,
    Tab,
    Tabs,
    Accordion,
    Accordions,
    ServerToolsSequence,
    StdioMcpSequence,
    OAuthFlowSequence,
    McpOAuthSequence,
    McpToolApprovalSequence,
    McpToolExecutionSequence,
    McpConnectionStatesDiagram,
    CliBridgeConnectionSequence,
    CliBridgeToolRegistrationSequence,
    CliBridgeChatSequence,
    CliBridgeToolApprovalSequence,
    CliBridgeArchitectureDiagram,
    ExtensionContextsDiagram,
    ...components,
  };
}
