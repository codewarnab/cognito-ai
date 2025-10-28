<div align="center">This is a [Plasmo extension](https://docs.plasmo.com/) project bootstrapped with [`plasmo init`](https://www.npmjs.com/package/plasmo).



# 🧠 Cognito: Your AI Browser Agent## Getting Started



<p align="center">First, run the development server:

  <img src="https://img.shields.io/badge/Cognito-AI%20Browser%20Agent-blue?style=for-the-badge&logo=google-chrome" alt="Cognito">

</p>```bash

pnpm dev

**Super powerful and private AI assistant directly in your browser**# or

npm run dev

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)```

[![Version](https://img.shields.io/badge/version-0.0.1-blue.svg)](./package.json)

[![Built with Plasmo](https://img.shields.io/badge/built%20with-Plasmo-blueviolet)](https://www.plasmo.com/)Open your browser and load the appropriate development build. For example, if you are developing for the chrome browser, using manifest v3, use: `build/chrome-mv3-dev`.



[Features](#-features) • [Installation](#-installation) • [Usage](#-usage) • [Development](#-development) • [Contributing](#-contributing) • [License](#-license)You can start editing the popup by modifying `popup.tsx`. It should auto-update as you make changes. To add an options page, simply add a `options.tsx` file to the root of the project, with a react component default exported. Likewise to add a content page, add a `content.ts` file to the root of the project, importing some module and do some logic, then reload the extension on your browser.



</div>For further guidance, [visit our Documentation](https://docs.plasmo.com/)



---## Making production build



## 🌟 FeaturesRun the following:



Cognito is an intelligent browser agent that brings the power of AI directly into your Chrome browser:```bash

pnpm build

- 🤖 **AI-Powered Assistance**: Integrated with Google's Generative AI and other AI models# or

- 🔒 **Privacy-First**: Your data stays in your browsernpm run build

- 🎯 **Smart Actions**: Automate browser tasks with AI-driven workflows```

- 💬 **Side Panel Chat**: Quick access to AI chat with `Ctrl+Shift+H` (or `Cmd+Shift+H` on Mac)

- 📚 **Memory System**: Remembers context across sessionsThis should create a production bundle for your extension, ready to be zipped and published to the stores.

- 🔌 **Model Context Protocol**: Extensible AI capabilities

- 🎨 **Beautiful UI**: Modern interface built with React and Tailwind CSS## Submit to the webstores

- ⚡ **Fast & Efficient**: Optimized performance with local AI processing

The easiest way to deploy your Plasmo extension is to use the built-in [bpp](https://bpp.browser.market) GitHub action. Prior to using this action however, make sure to build your extension and upload the first version to the store to establish the basic credentials. Then, simply follow [this setup instruction](https://docs.plasmo.com/framework/workflows/submit) and you should be on your way for automated submission!

## 🚀 Installation

### For Users

1. Download the latest release from [Releases](https://github.com/codewarnab/cognito-ai/releases)
2. Unzip the downloaded file
3. Open Chrome and navigate to `chrome://extensions/`
4. Enable **Developer mode** (toggle in top-right)
5. Click **Load unpacked** and select the unzipped folder
6. Start using Cognito! Press `Ctrl+Shift+H` to open the side panel

### For Developers

See [SETUP.md](./SETUP.md) for detailed development setup instructions.

## 💡 Usage

### Opening Cognito

- **Keyboard Shortcut**: Press `Ctrl+Shift+H` (Windows/Linux) or `Cmd+Shift+H` (Mac)
- **Extension Icon**: Click the Cognito icon in your Chrome toolbar
- **Side Panel**: Open from Chrome's side panel menu

### Basic Features

1. **AI Chat**: Ask questions and get intelligent responses
2. **Web Automation**: Automate repetitive browser tasks
3. **Content Analysis**: Analyze web pages and extract information
4. **Memory Management**: Save and retrieve important information
5. **Tab Management**: Organize and manage your browser tabs efficiently

## 🛠️ Development

This is a [Plasmo extension](https://docs.plasmo.com/) project.

### Prerequisites

- Node.js v18 or higher
- pnpm v8 or higher
- Google Chrome

### Quick Start

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Package the extension
pnpm package
```

### Development Build

1. Run `pnpm dev`
2. Load the extension from `build/chrome-mv3-dev` in Chrome
3. Make changes - the extension will auto-reload

### Production Build

```bash
pnpm build
```

The production bundle will be in `build/chrome-mv3-prod/`.

### Project Structure

```
chrome-ai/
├── src/
│   ├── sidepanel.tsx       # Main UI
│   ├── background.ts       # Service worker
│   ├── options.tsx         # Options page
│   ├── ai/                 # AI integration
│   ├── actions/            # Browser actions
│   ├── components/         # React components
│   ├── mcp/                # Model Context Protocol
│   ├── memory/             # Memory system
│   └── workflows/          # Automation workflows
├── public/                 # Static assets
├── assets/                 # Icons and graphics
└── build/                  # Build output
```

## 🔧 Configuration

### Permissions

Cognito requires the following permissions:

- `storage`, `unlimitedStorage` - Store data locally
- `tabs`, `tabGroups` - Manage browser tabs
- `sidePanel` - Display AI chat in side panel
- `scripting`, `activeTab` - Interact with web pages
- `webNavigation` - Track navigation
- `history`, `bookmarks` - Access browsing data
- `notifications` - Show notifications

### API Keys

For AI features, you may need to configure API keys in the extension options.

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

### Quick Contribution Steps

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📖 Documentation

- [Setup Guide](./SETUP.md) - Detailed setup instructions
- [Contributing Guide](./CONTRIBUTING.md) - How to contribute
- [Plasmo Documentation](https://docs.plasmo.com/) - Framework documentation
- [Chrome Extension Docs](https://developer.chrome.com/docs/extensions/) - Chrome API reference

## 🛣️ Roadmap

- [ ] Multi-model AI support
- [ ] Advanced workflow automation
- [ ] Voice interaction
- [ ] Cross-browser support (Firefox, Edge)
- [ ] Cloud sync (optional)
- [ ] Plugin system
- [ ] Mobile companion app

## ⚖️ License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## 👨‍💻 Author

**codewarnab**
- Email: dev@codewarnab.in
- GitHub: [@codewarnab](https://github.com/codewarnab)

## 🙏 Acknowledgments

- Built with [Plasmo](https://www.plasmo.com/)
- Powered by [Google Generative AI](https://ai.google.dev/)
- UI components from [Radix UI](https://www.radix-ui.com/)
- Icons from [Lucide](https://lucide.dev/)

## 📞 Support

- 🐛 [Report a Bug](https://github.com/codewarnab/cognito-ai/issues/new?template=bug_report.md)
- 💡 [Request a Feature](https://github.com/codewarnab/cognito-ai/issues/new?template=feature_request.md)
- 💬 [Discussions](https://github.com/codewarnab/cognito-ai/discussions)

---

<div align="center">

**Made with ❤️ by [codewarnab](https://github.com/codewarnab)**

⭐ Star this repo if you find it useful!

</div>
