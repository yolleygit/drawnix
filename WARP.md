# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

Drawnix is an open-source whiteboard tool (SaaS) built on the Plait framework, supporting mind maps, flowcharts, and free drawing. It uses an Nx monorepo architecture with a plugin-based design.

## Development Commands

### Basic Commands
```bash
# Install dependencies
npm install

# Start development server
npm run start
# or
nx serve web --host=0.0.0.0

# Build all projects
npm run build
# or
nx run-many -t=build

# Build web app only
npm run build:web
# or
nx build web

# Run all tests
npm run test
# or
nx run-many -t=test

# Run tests for specific projects
nx test drawnix
nx test react-board
nx test react-text
nx test web

# Lint all projects
nx run-many -t=lint

# Lint specific project
nx lint drawnix
nx lint web

# Run E2E tests
nx e2e web-e2e
```

### Release Commands
```bash
# Version release
npm run release

# Build and publish packages
npm run pub
```

## Architecture Overview

### Monorepo Structure
- `apps/web/` - Main web application (React 18 + Vite)
- `packages/drawnix/` - Core whiteboard component with UI and business logic
- `packages/react-board/` - Whiteboard React rendering layer built on Plait core
- `packages/react-text/` - Text rendering module for rich text editing

### Technology Stack
- **Framework**: React 18 + TypeScript
- **Build System**: Nx + Vite
- **Testing**: Jest + Playwright
- **Canvas Engine**: Plait Framework
- **Rich Text**: Slate.js
- **State Management**: React state + LocalForage persistence
- **UI Components**: Custom components + Floating UI
- **Styling**: SCSS with theme support

### Plugin Architecture
Drawnix is built on Plait's plugin system with these core plugins:
- `withDraw` - Drawing functionality
- `withMind` - Mind map support
- `withGroup` - Element grouping
- `withCommonPlugin` - Common features
- `withFreehand` - Free drawing
- `withPencil` - Pencil tool
- `withTextLink` - Text linking

### Data Flow
1. Main app (`apps/web/src/app/app.tsx`) manages top-level state
2. Uses LocalForage for data persistence (IndexedDB/LocalStorage)
3. Processes whiteboard logic through `@drawnix/drawnix` component
4. State changes sync via `onChange` callback

## Key Features

### Internationalization (i18n)
- Supports Chinese, English, Russian, Arabic
- Use `useI18n` hook for translation function
- Translation files in `packages/drawnix/src/i18n/`

### Mobile Support
- Uses `mobile-detect` library for device detection
- Mobile-specific interaction optimizations

### Theme System
- SCSS-based with theme switching support
- Uses `open-color` palette
- Light/dark mode support

### File Operations
- Uses `browser-fs-access` for file I/O
- Supports PNG, JSON (.drawnix) export formats

### Data Conversion
- Mermaid syntax to flowchart (`@plait-board/mermaid-to-drawnix`)
- Markdown to mind map (`@plait-board/markdown-to-drawnix`)

## Important Components

### Toolbar System
- `CreationToolbar` - Element creation tools
- `ZoomToolbar` - Zoom controls
- `PopupToolbar` - Context popup toolbar
- `AppToolbar` - Main application toolbar
- `ThemeToolbar` - Theme switching toolbar

### Dialogs and Modals
- `TTDDialog` - Text-to-diagram conversion
- `CleanConfirm` - Clear board confirmation
- `SettingsDialog` - Application settings
- `AIGenerateDialog` - AI generation features

## Testing Strategy

### Unit Tests
- Jest + Testing Library
- Each package has independent test configuration
- Run specific tests: `nx test <package-name>`

### E2E Tests  
- Playwright for end-to-end testing
- Main test suite: `nx e2e web-e2e`

## Development Guidelines

### Package Dependencies
- `@drawnix/drawnix` depends on `@plait-board/react-board`
- All packages share Plait core dependencies
- Nx enforces module boundaries via `@nx/enforce-module-boundaries`

### Working with Nx
- Use `nx graph` to visualize project dependencies
- Each project has a `project.json` for configuration
- Targets are auto-discovered by Nx plugins

### Debugging
- Development mode logs "board initialized" to console
- Use browser dev tools to inspect LocalForage storage
- Nx graph available at `nx graph` for dependency visualization

## Code Quality

### Linting and Formatting
- ESLint configuration in `.eslintrc.json`
- Prettier configuration in `.prettierrc`
- Run `nx run-many -t=lint` for code quality checks

### TypeScript Configuration
- Base config in `tsconfig.base.json`
- Each package has specific `tsconfig.json`
- Strict TypeScript settings enabled

## Important Context from Existing Documentation

From CLAUDE.md, key architectural principles:
- Plugin-based architecture allows multi-framework support (Angular, React)
- Rich text integration via Slate framework
- Business logic separation for reusable plugins
- Extensible design for various whiteboard scenarios

The project emphasizes:
- Free and open-source philosophy
- Multi-language support (i18n)
- Mobile-responsive design
- Auto-save functionality via browser storage
- Export capabilities (PNG, JSON)
- Infinite canvas with zoom/scroll
- Theming support
- Markdown and Mermaid syntax support
