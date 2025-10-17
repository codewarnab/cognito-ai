/**
 * Tool UI Context for AI SDK v5
 * Provides a way for tools to register their UI rendering components
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { createLogger } from '../logger';

const log = createLogger('ToolUIContext');

export interface ToolUIState {
  toolCallId: string;
  toolName: string;
  state: 'input-streaming' | 'input-available' | 'output-available' | 'output-error';
  input?: any;
  output?: any;
  errorText?: string;
}

export interface ToolUIRenderer {
  (state: ToolUIState): ReactNode;
}

interface ToolUIContextType {
  registerToolUI: (toolName: string, renderer: ToolUIRenderer) => void;
  unregisterToolUI: (toolName: string) => void;
  renderTool: (state: ToolUIState) => ReactNode;
  hasRenderer: (toolName: string) => boolean;
}

const ToolUIContext = createContext<ToolUIContextType | undefined>(undefined);

export function ToolUIProvider({ children }: { children: ReactNode }) {
  const [renderers, setRenderers] = useState<Map<string, ToolUIRenderer>>(new Map());

  const registerToolUI = useCallback((toolName: string, renderer: ToolUIRenderer) => {
    setRenderers(prev => {
      const newMap = new Map(prev);
      newMap.set(toolName, renderer);
      log.info('Registered tool UI renderer:', toolName);
      return newMap;
    });
  }, []);

  const unregisterToolUI = useCallback((toolName: string) => {
    setRenderers(prev => {
      const newMap = new Map(prev);
      newMap.delete(toolName);
      log.info('Unregistered tool UI renderer:', toolName);
      return newMap;
    });
  }, []);

  const renderTool = useCallback((state: ToolUIState): ReactNode => {
    const renderer = renderers.get(state.toolName);
    if (renderer) {
      return renderer(state);
    }
    return null;
  }, [renderers]);

  const hasRenderer = useCallback((toolName: string): boolean => {
    return renderers.has(toolName);
  }, [renderers]);

  return (
    <ToolUIContext.Provider value={{ registerToolUI, unregisterToolUI, renderTool, hasRenderer }}>
      {children}
    </ToolUIContext.Provider>
  );
}

export function useToolUI() {
  const context = useContext(ToolUIContext);
  if (!context) {
    throw new Error('useToolUI must be used within ToolUIProvider');
  }
  return context;
}
