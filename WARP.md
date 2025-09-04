# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.
<!-- 此文件为 WARP (warp.dev) 在此代码仓库中工作提供指导 -->

## Project Overview 项目概述

Drawnix is an open-source whiteboard tool (SaaS) built on the Plait framework, supporting mind maps, flowcharts, and free drawing. It uses an Nx monorepo architecture with a plugin-based design.
<!-- Drawnix 是一个基于 Plait 框架的开源白板工具（SaaS），支持思维导图、流程图和自由绘画。采用 Nx 单体仓库架构和基于插件的设计。 -->

## Development Commands 开发命令

### Basic Commands 基础命令
```bash
# Install dependencies 安装依赖
npm install

# Start development server 启动开发服务器
npm run start
# or 或者
nx serve web --host=0.0.0.0

# Build all projects 构建所有项目
npm run build
# or 或者
nx run-many -t=build

# Build web app only 仅构建 Web 应用
npm run build:web
# or 或者
nx build web

# Run all tests 运行所有测试
npm run test
# or 或者
nx run-many -t=test

# Run tests for specific projects 运行特定项目的测试
nx test drawnix
nx test react-board
nx test react-text
nx test web

# Lint all projects 检查所有项目代码质量
nx run-many -t=lint

# Lint specific project 检查特定项目代码质量
nx lint drawnix
nx lint web

# Run E2E tests 运行端到端测试
nx e2e web-e2e

# Visualize project dependency graph 可视化项目依赖图
nx graph

# Alternative test runner (Vitest) 替代测试运行器（Vitest）
nx test <project-name> --runner=vitest
```

### Release Commands 发布命令
```bash
# Version release 版本发布
npm run release

# Build and publish packages 构建并发布包
npm run pub
```

### Docker Commands Docker 命令
```bash
# Build Docker image 构建 Docker 镜像
docker build -t drawnix .

# Run Docker container 运行 Docker 容器
docker run -p 8080:80 drawnix

# Pull official image 拉取官方镜像
docker pull pubuzhixing/drawnix:latest
```

## Architecture Overview 架构概述

### Monorepo Structure 单体仓库结构
- `apps/web/` - Main web application (React 18 + Vite) <!-- 主 Web 应用程序（React 18 + Vite） -->
- `packages/drawnix/` - Core whiteboard component with UI and business logic <!-- 核心白板组件，包含 UI 和业务逻辑 -->
- `packages/react-board/` - Whiteboard React rendering layer built on Plait core <!-- 白板 React 渲染层，基于 Plait 核心 -->
- `packages/react-text/` - Text rendering module for rich text editing <!-- 文本渲染模块，用于富文本编辑 -->

### Technology Stack 技术栈
- **Framework 框架**: React 18 + TypeScript
- **Build System 构建系统**: Nx + Vite
- **Testing 测试**: Jest + Playwright
- **Canvas Engine 画布引擎**: Plait Framework
- **Rich Text 富文本**: Slate.js
- **State Management 状态管理**: React state + LocalForage persistence
- **UI Components UI 组件**: Custom components + Floating UI
- **Styling 样式**: SCSS with theme support

### Plugin Architecture 插件架构
Drawnix is built on Plait's plugin system with these core plugins:
<!-- Drawnix 基于 Plait 的插件系统构建，核心插件包括： -->
- `withDraw` - Drawing functionality <!-- 绘图功能 -->
- `withMind` - Mind map support <!-- 思维导图支持 -->
- `withGroup` - Element grouping <!-- 元素分组 -->
- `withCommonPlugin` - Common features <!-- 通用功能 -->
- `withFreehand` - Free drawing <!-- 自由绘画 -->
- `withPencil` - Pencil tool <!-- 画笔工具 -->
- `withTextLink` - Text linking <!-- 文本链接 -->

### Data Flow 数据流
1. Main app (`apps/web/src/app/app.tsx`) manages top-level state <!-- 主应用程序管理顶层状态 -->
2. Uses LocalForage for data persistence (IndexedDB/LocalStorage) <!-- 使用 LocalForage 进行数据持久化 -->
3. Processes whiteboard logic through `@drawnix/drawnix` component <!-- 通过 `@drawnix/drawnix` 组件处理白板逻辑 -->
4. State changes sync via `onChange` callback <!-- 状态变化通过 `onChange` 回调同步 -->

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
