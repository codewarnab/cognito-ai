/**
 * Tool UI Context for AI SDK v5
 * Provides a way for tools to register their UI rendering components
 */

import  { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { createLogger } from '~logger';

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

// Optional custom renderers for tool-specific input/output UI
export interface CustomInputOutputRenderers {
  renderInput?: (input: any) => ReactNode;
  renderOutput?: (output: any) => ReactNode;
}

interface ToolUIContextType {
  registerToolUI: (toolName: string, renderer: ToolUIRenderer, customRenderers?: CustomInputOutputRenderers) => void;
  unregisterToolUI: (toolName: string) => void;
  renderTool: (state: ToolUIState) => ReactNode;
  hasRenderer: (toolName: string) => boolean;
  getCustomRenderers: (toolName: string) => CustomInputOutputRenderers | undefined;
}

const ToolUIContext = createContext<ToolUIContextType | undefined>(undefined);

export function ToolUIProvider({ children }: { children: ReactNode }) {
  const [renderers, setRenderers] = useState<Map<string, ToolUIRenderer>>(new Map());
  const [customRenderers, setCustomRenderers] = useState<Map<string, CustomInputOutputRenderers>>(new Map());

  const registerToolUI = useCallback((toolName: string, renderer: ToolUIRenderer, customRenderersArg?: CustomInputOutputRenderers) => {
    setRenderers(prev => {
      const newMap = new Map(prev);
      newMap.set(toolName, renderer);
      log.info('Registered tool UI renderer:', toolName);
      return newMap;
    });

    if (customRenderersArg) {
      setCustomRenderers(prev => {
        const newMap = new Map(prev);
        newMap.set(toolName, customRenderersArg);
        log.info('Registered custom input/output renderers:', toolName);
        return newMap;
      });
    }
  }, []);

  const unregisterToolUI = useCallback((toolName: string) => {
    setRenderers(prev => {
      const newMap = new Map(prev);
      newMap.delete(toolName);
      log.info('Unregistered tool UI renderer:', toolName);
      return newMap;
    });
    setCustomRenderers(prev => {
      const newMap = new Map(prev);
      newMap.delete(toolName);
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

  const getCustomRenderers = useCallback((toolName: string): CustomInputOutputRenderers | undefined => {
    return customRenderers.get(toolName);
  }, [customRenderers]);

  return (
    <ToolUIContext.Provider value={{ registerToolUI, unregisterToolUI, renderTool, hasRenderer, getCustomRenderers }}>
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

