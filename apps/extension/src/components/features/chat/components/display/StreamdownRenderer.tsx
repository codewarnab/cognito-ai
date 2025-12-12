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
      // Theme options - uncomment one to try:
      // shikiTheme={['github-light', 'tokyo-night']}        // Deep blue, vibrant - very popular
      // shikiTheme={['github-light', 'dracula']}            // Purple/pink accent, classic
      // shikiTheme={['github-light', 'one-dark-pro']}       // Atom-style, balanced colors
      // shikiTheme={['github-light', 'nord']}               // Arctic blue, soft pastel
      // shikiTheme={['github-light', 'ayu-dark']}           // Warm orange/golden accent
      // shikiTheme={['github-light', 'catppuccin-mocha']}   // Soothing pastel, modern
      // shikiTheme={['github-light', 'night-owl']}          // Optimized for low-light
       //shikiTheme={['github-light', 'slack-dark']}         // Clean, minimal
      // shikiTheme={['github-light', 'github-dark']}        // GitHub native dark
      shikiTheme={['github-light', 'tokyo-night']}           // CURRENT: Deep blue, vibrant
      controls={{
        code: true,
        table: true,
        mermaid: true,
      }}
      className="streamdown-content"
    >
      {children}
    </Streamdown>
  );
}
