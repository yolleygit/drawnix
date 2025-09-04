# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

Drawnix 是一个基于 Plait 框架的开源白板工具，支持思维导图、流程图、自由绘画等功能。使用 Nx 单体仓库架构，采用插件化设计。

## 开发命令

### 基础命令
```bash
# 安装依赖
npm install

# 启动开发服务器
npm run start
# 或者
nx serve web --host=0.0.0.0

# 构建所有项目
npm run build
# 或者
nx run-many -t=build

# 构建 Web 应用
npm run build:web
# 或者  
nx build web

# 运行所有测试
npm run test
# 或者
nx run-many -t=test

# 运行特定项目测试
nx test drawnix
nx test react-board
nx test react-text
nx test web

# 代码质量检查
nx run-many -t=lint

# 单个项目 lint
nx lint drawnix
nx lint web
```

### E2E 测试
```bash
# 运行端到端测试
nx e2e web-e2e
```

## 架构结构

### 单体仓库结构
- `apps/web/` - 主 Web 应用，基于 React 18 + Vite
- `packages/drawnix/` - 核心白板组件，主要业务逻辑和 UI 组件
- `packages/react-board/` - 白板 React 渲染层，基于 Plait 核心
- `packages/react-text/` - 文本渲染模块，处理富文本编辑

### 核心技术栈
- **框架**: React 18 + TypeScript
- **构建工具**: Nx + Vite
- **测试**: Jest + Playwright
- **画布引擎**: Plait Framework
- **富文本**: Slate.js
- **状态管理**: 本地 React state + LocalForage 持久化
- **UI 库**: 自定义组件 + Floating UI
- **样式**: SCSS

### 插件架构
Drawnix 基于 Plait 的插件系统构建，核心插件包括：
- `withDraw` - 绘图功能
- `withMind` - 思维导图
- `withGroup` - 元素分组
- `withCommonPlugin` - 通用功能
- `withFreehand` - 自由绘画
- `withPencil` - 画笔工具
- `withTextLink` - 文本链接

### 数据流
1. 主应用 (`apps/web/src/app/app.tsx`) 管理顶层状态
2. 使用 LocalForage 进行数据持久化 (IndexedDB/LocalStorage)
3. 通过 `@drawnix/drawnix` 组件处理白板逻辑
4. 状态变化通过 `onChange` 回调同步

## 开发注意事项

### 国际化 (i18n)
- 支持中文、英文、俄文、阿拉伯文
- 使用 `useI18n` hook 获取翻译函数
- 翻译文件位于 `packages/drawnix/src/i18n/`

### 移动端适配
- 使用 `mobile-detect` 库检测移动设备
- 针对移动端有专门的交互优化

### 样式系统
- 基于 SCSS，支持主题切换
- 使用 `open-color` 调色板
- 支持暗色/亮色主题模式

### 测试策略
- 单元测试：Jest + Testing Library
- E2E 测试：Playwright
- 每个包都有独立的测试配置

### 依赖关系
- `@drawnix/drawnix` 依赖 `@plait-board/react-board`
- 所有包共享 Plait 核心依赖 (@plait/core, @plait/draw, @plait/mind 等)
- 使用 Nx 的 `@nx/enforce-module-boundaries` 规则管理依赖边界

## 重要功能模块

### 工具栏系统
- `CreationToolbar` - 创建工具栏
- `ZoomToolbar` - 缩放工具栏  
- `PopupToolbar` - 弹出工具栏
- `AppToolbar` - 应用主工具栏
- `ThemeToolbar` - 主题切换工具栏

### 数据转换
- 支持 Mermaid 语法转流程图 (`@plait-board/mermaid-to-drawnix`)
- 支持 Markdown 转思维导图 (`@plait-board/markdown-to-drawnix`)

### 文件操作
- 使用 `browser-fs-access` 处理文件读写
- 支持导出 PNG、JSON (.drawnix) 格式

## 发布流程
```bash
# 版本发布
npm run release

# 构建并发布包
npm run pub
```

## 调试技巧
- 开发模式下，控制台会输出 "board initialized"
- 可以通过浏览器开发者工具查看 LocalForage 存储的数据
- 使用 Nx 的图形界面查看项目依赖：`nx graph`