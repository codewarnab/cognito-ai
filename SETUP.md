# Setup Guide

This guide will help you set up the Chrome AI extension development environment.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **pnpm** (v8 or higher)
- **Google Chrome** browser

## Installation Steps

### 1. Clone the Repository

```bash
git clone https://github.com/codewarnab/cognito-ai.git
cd cognito-ai
```

### 2. Install Dependencies

```bash
pnpm install
```

This will install all the necessary dependencies for the project and its workspaces.

### 3. Development Setup

#### Start the Development Server

```bash
pnpm dev
```

This command will:
- Start the development server with hot reload
- Build the extension in development mode
- Watch for file changes

#### Load the Extension in Chrome

1. Open Google Chrome
2. Navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in the top-right corner)
4. Click **Load unpacked**
5. Select the `build/chrome-mv3-dev` directory from the project root

The extension should now be loaded and ready for development!

### 4. Making Changes

- **Sidepanel**: Edit `src/sidepanel.tsx`
- **Options Page**: Edit `src/options.tsx`
- **Background Script**: Edit `src/background.ts`
- **Content Scripts**: Edit files in `src/content/` or `src/contents/`

The extension will auto-reload when you make changes to the source files.

## Building for Production

To create a production build:

```bash
pnpm build
```

The production-ready extension will be available in the `build/chrome-mv3-prod` directory.

## Project Structure

```
chrome-ai/
├── src/                    # Source code
│   ├── sidepanel.tsx      # Main sidepanel UI
│   ├── background.ts      # Background service worker
│   ├── options.tsx        # Options page
│   ├── components/        # React components
│   ├── ai/                # AI integration
│   ├── actions/           # Browser actions
│   └── ...
├── public/                # Static assets
├── build/                 # Build output (gitignored)
└── assets/                # Icons and images
```

## Environment Variables

Create a `.env` file in the root directory if you need to configure environment-specific variables:

```env
# Add your environment variables here
```

## Troubleshooting

### Extension Not Loading

- Make sure you've run `pnpm dev` first
- Check that the `build/chrome-mv3-dev` directory exists
- Try disabling and re-enabling the extension in Chrome

### Build Errors

- Clear the build cache: `rm -rf build/ .plasmo/`
- Reinstall dependencies: `pnpm install`
- Check for TypeScript errors: `pnpm type-check` (if available)

### Hot Reload Not Working

- Reload the extension manually in `chrome://extensions/`
- Restart the development server

## Additional Resources

- [Plasmo Documentation](https://docs.plasmo.com/)
- [Chrome Extension Documentation](https://developer.chrome.com/docs/extensions/)
- [Project README](./README.md)
- [Contributing Guidelines](./CONTRIBUTING.md)

## Support

If you encounter any issues during setup, please:
1. Check the [existing issues](https://github.com/codewarnab/cognito-ai/issues)
2. Create a new issue with details about your problem
3. Include your environment information (OS, Node version, etc.)
