import defaultComponents from 'fumadocs-ui/mdx';
import { Callout } from 'fumadocs-ui/components/callout';
import { ImageZoom } from 'fumadocs-ui/components/image-zoom';
import { Tab, Tabs } from 'fumadocs-ui/components/tabs';
import type { MDXComponents } from 'mdx/types';
import { ServerToolsSequence } from '@/components/diagrams/ServerToolsSequence';
import { StdioMcpSequence } from '@/components/diagrams/StdioMcpSequence';

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultComponents,
    Callout,
    ImageZoom,
    Tab,
    Tabs,
    ServerToolsSequence,
    StdioMcpSequence,
    ...components,
  };
}
