import chalk from 'chalk';

const BOX_WIDTH = 62;

/**
 * Logger utility with chalk styling for consistent CLI output
 */
export const logger = {
    /**
     * Log an info message with a cyan prefix
     */
    info(message: string): void {
        console.log(chalk.cyan('ℹ'), message);
    },

    /**
     * Log a success message with a green checkmark
     */
    success(message: string): void {
        console.log(chalk.green('✓'), chalk.green(message));
    },

    /**
     * Log a warning message with a yellow prefix
     */
    warn(message: string): void {
        console.log(chalk.yellow('⚠'), chalk.yellow(message));
    },

    /**
     * Log an error message with a red prefix
     */
    error(message: string, error?: unknown): void {
        console.error(chalk.red('✗'), chalk.red(message));
        if (error) {
            console.error(chalk.dim('  '), error);
        }
    },

    /**
     * Log a waiting/loading message with a yellow spinner
     */
    waiting(message: string): void {
        console.log(chalk.yellow('⏳'), chalk.yellow(message));
    },

    /**
     * Log a debug message (dimmed)
     */
    debug(prefix: string, message: string): void {
        console.log(chalk.dim(`[${prefix}]`), chalk.dim(message));
    },

    /**
     * Create a styled box with title and content lines
     */
    box(options: {
        title?: string;
        lines: Array<{ text: string; type?: 'success' | 'info' | 'warning' | 'dim' }>;
        footer?: { text: string; type?: 'success' | 'info' | 'warning' | 'dim' };
    }): void {
        const { title, lines, footer } = options;
        const horizontal = '═'.repeat(BOX_WIDTH - 2);

        console.log('');
        console.log(chalk.cyan(`╔${horizontal}╗`));

        if (title) {
            const paddedTitle = title.padStart((BOX_WIDTH - 2 + title.length) / 2).padEnd(BOX_WIDTH - 2);
            console.log(chalk.cyan('║') + chalk.bold.white(paddedTitle) + chalk.cyan('║'));
            console.log(chalk.cyan(`╠${horizontal}╣`));
        }

        for (const line of lines) {
            const content = formatLine(line.text, line.type);
            const paddedContent = line.text.padEnd(BOX_WIDTH - 4);
            console.log(chalk.cyan('║  ') + formatLine(paddedContent, line.type) + chalk.cyan('║'));
        }

        if (footer) {
            console.log(chalk.cyan(`╠${horizontal}╣`));
            const paddedFooter = footer.text.padEnd(BOX_WIDTH - 4);
            console.log(chalk.cyan('║  ') + formatLine(paddedFooter, footer.type) + chalk.cyan('║'));
        }

        console.log(chalk.cyan(`╚${horizontal}╝`));
        console.log('');
    },

    /**
     * Log a simple separator line
     */
    separator(): void {
        console.log(chalk.dim('─'.repeat(60)));
    },

    /**
     * Format a URL for display
     */
    url(url: string): string {
        return chalk.underline.cyan(url);
    },

    /**
     * Format a path for display
     */
    path(path: string): string {
        return chalk.yellow(path);
    },

    /**
     * Format a number/count for display
     */
    count(num: number): string {
        return chalk.bold.magenta(num.toString());
    },

    /**
     * Format a label for display
     */
    label(text: string): string {
        return chalk.dim(text);
    },

    /**
     * Format a value for display
     */
    value(text: string): string {
        return chalk.white(text);
    },

    /**
     * Brand header for the CLI
     */
    brandHeader(): void {
        const horizontal = '═'.repeat(BOX_WIDTH - 2);
        const title = 'Cognito CLI Bridge';
        const paddedTitle = title.padStart((BOX_WIDTH - 2 + title.length) / 2).padEnd(BOX_WIDTH - 2);

        console.log('');
        console.log(chalk.cyan(`╔${horizontal}╗`));
        console.log(chalk.cyan('║') + chalk.bold.cyan(paddedTitle) + chalk.cyan('║'));
        console.log(chalk.cyan(`╚${horizontal}╝`));
    },
};

/**
 * Format line content based on type
 */
function formatLine(text: string, type?: 'success' | 'info' | 'warning' | 'dim'): string {
    switch (type) {
        case 'success':
            return chalk.green(text);
        case 'info':
            return chalk.cyan(text);
        case 'warning':
            return chalk.yellow(text);
        case 'dim':
            return chalk.dim(text);
        default:
            return chalk.white(text);
    }
}

export default logger;
