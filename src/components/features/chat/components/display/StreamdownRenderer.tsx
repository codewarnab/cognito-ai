import { Streamdown } from 'streamdown';

interface StreamdownRendererProps {
  children: string;
  isAnimating?: boolean;
}

/**
 * Wrapper component for Streamdown markdown renderer.
 * Optimized for AI streaming with proper handling of unterminated blocks.
 *
 * @param children - Markdown string to render
 * @param isAnimating - When true, disables copy/download buttons during streaming
 */
export function StreamdownRenderer({
  children,
  isAnimating = false,
}: StreamdownRendererProps) {
  return (
    <Streamdown
      mode={isAnimating ? 'streaming' : 'static'}
      isAnimating={isAnimating}
      parseIncompleteMarkdown={isAnimating}
      shikiTheme={['github-light', 'github-dark-dimmed']}
      controls={{
        code: true,
        table: true,
        mermaid: false,
      }}
      className="streamdown-content"
    >
      {children}
    </Streamdown>
  );
}
