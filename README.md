<p align="center">
  <picture style="width: 320px">
    <source media="(prefers-color-scheme: light)" srcset="https://github.com/plait-board/drawnix/blob/develop/apps/web/public/logo/logo_drawnix_h.svg?raw=true" />
    <source media="(prefers-color-scheme: dark)" srcset="https://github.com/plait-board/drawnix/blob/develop/apps/web/public/logo/logo_drawnix_h_dark.svg?raw=true" />
    <img src="https://github.com/plait-board/drawnix/blob/develop/apps/web/public/logo/logo_drawnix_h.svg?raw=true" width="360" alt="Drawnix logo and name" />
  </picture>
</p>
<div align="center">
  <h2>
    开源白板工具（SaaS），一体化白板，包含思维导图、流程图、自由画等
  <br />
  </h2>
</div>

<div align="center">
  <figure>
    <a target="_blank" rel="noopener">
      <img src="https://github.com/plait-board/drawnix/blob/develop/apps/web/public/product_showcase/case-2.png" alt="Product showcase" width="80%" />
    </a>
    <figcaption>
      <p align="center">
        All in one 白板，思维导图、流程图、自由画等
      </p>
    </figcaption>
  </figure>
  <a href="https://hellogithub.com/repository/plait-board/drawnix" target="_blank">
    <picture style="width: 250">
      <source media="(prefers-color-scheme: light)" srcset="https://abroad.hellogithub.com/v1/widgets/recommend.svg?rid=4dcea807fab7468a962c153b07ae4e4e&claim_uid=zmFSY5k8EuZri43&theme=neutral" />
      <source media="(prefers-color-scheme: dark)" srcset="https://abroad.hellogithub.com/v1/widgets/recommend.svg?rid=4dcea807fab7468a962c153b07ae4e4e&claim_uid=zmFSY5k8EuZri43&theme=dark" />
      <img src="https://abroad.hellogithub.com/v1/widgets/recommend.svg?rid=4dcea807fab7468a962c153b07ae4e4e&claim_uid=zmFSY5k8EuZri43&theme=neutral" alt="Featured｜HelloGitHub" style="width: 250px; height: 54px;" width="250" height="54"/>
    </picture>
  </a>

  <br />

  <a href="https://trendshift.io/repositories/13979" target="_blank"><img src="https://trendshift.io/api/badge/repositories/13979" alt="plait-board%2Fdrawnix | Trendshift" style="width: 250px; height: 55px;" width="250" height="55"/></a>
</div>

[*English README*](https://github.com/plait-board/drawnix/blob/develop/README_en.md)

## 特性

### 🎨 基础功能
- 💯 免费 + 开源
- ⚒️ 思维导图、流程图
- 🖌 画笔
- 😀 插入图片
- 🚀 基于插件机制
- 🖼️ 📃 导出为 PNG, JSON(`.drawnix`)
- 💾 自动保存（浏览器缓存）
- ⚡ 编辑特性：撤销、重做、复制、粘贴等
- 🌌 无限画布：缩放、滚动
- 🎨 主题模式
- 📱 移动设备适配
- 📈 支持 mermaid 语法转流程图
- ✨ 支持 markdown 文本转思维导图

### 🤖 AI 绘图功能 `NEW!`

> **全新升级的 AI 生图功能，让创意无限延展！**

#### ✨ 核心特性
- 🎯 **智能图像转换**：选中已有图片，AI 根据提示词进行创意变换
- 🪄 **提示词优化**：一键优化提示词，让 AI 生成更精准的图像
- 🔗 **智能箭头连接**：自动创建从原图到生成图的弯曲箭头，直观展示变换关系
- ⚡ **异步生成**：后台处理，不阻塞操作，实时显示生成进度
- 🎨 **动态占位符**：蓝色动画占位符，优雅展示生成状态
- 🌐 **多代理支持**：支持官方 Gemini API 和第三方代理服务
- 🔄 **自动路径探测**：智能识别不同 API 端点格式

#### 🚀 使用流程
1. **选中原图** → 在白板上框选一张或多张图片
2. **打开AI生图** → 系统自动识别选中图像 
3. **输入描述** → 描述期望的变化或修改
4. **优化提示词** → 点击 🪄 按钮让 AI 优化提示词（可选）
5. **异步生成** → 立即显示蓝色动画占位符，后台处理
6. **自动替换** → 生成完成后自动替换占位符为真实图像
7. **智能连接** → 自动绘制弯曲箭头连接原图与生成图

#### ⚙️ 高级配置
- **自定义 API 端点**：支持配置 Base URL，适配各种代理服务
- **模型选择**：
  - 图像生成模型：`gemini-2.5-flash-image-preview`（默认）
  - 提示词优化模型：`gemini-2.5-flash`（默认）
- **多图像处理**：支持同时基于多张图片进行 AI 生成
- **智能连接**：支持多对一的箭头连接关系


## 关于名称

***Drawnix***  ，源于绘画(  ***Draw***  )与凤凰(  ***Phoenix***  )的灵感交织。

凤凰象征着生生不息的创造力，而 *Draw* 代表着人类最原始的表达方式。在这里，每一次创作都是一次艺术的涅槃，每一笔绘画都是灵感的重生。

创意如同凤凰，浴火方能重生，而  ***Drawnix***  要做技术与创意之火的守护者。

*Draw Beyond, Rise Above.*


## 与 Plait 画图框架

*Drawnix* 的定位是一个开箱即用、开源、免费的工具产品，它的底层是 *Plait* 框架，*Plait* 是我司开源的一款画图框架，代表着公司在知识库产品([PingCode Wiki](https://pingcode.com/product/wiki?utm_source=drawnix))上的重要技术沉淀。


Drawnix 是插件架构，与前面说到开源工具比技术架构更复杂一些，但是插件架构也有优势，比如能够支持多种 UI 框架（*Angular、React*），能够集成不同富文本框架（当前仅支持 *Slate* 框架），在开发上可以很好的实现业务的分层，开发各种细粒度的可复用插件，可以扩展更多的画板的应用场景。


## 仓储结构

```
drawnix/
├── apps/
│   ├── web                   # drawnix.com
│   │    └── index.html       # HTML
├── dist/                     # 构建产物
├── packages/
│   └── drawnix/              # 白板应用
│   └── react-board/          # 白板 React 视图层
│   └── react-text/           # 文本渲染模块
├── package.json
├── ...
└── README.md
└── README_en.md

```

## 应用

[*https://drawnix.com*](https://drawnix.com) 是 *drawnix* 的最小化应用。

近期会高频迭代 drawnix.com，直到发布 *Dawn（破晓）* 版本。

## 🤖 AI 绘图快速开始

### 1. 获取 Gemini API Key
1. 访问 [Google AI Studio](https://aistudio.google.com/apikey)
2. 创建 API Key（免费额度足够体验）
3. 复制您的 API Key

### 2. 配置 API
1. 在 Drawnix 中打开「设置」
2. 填入您的 Gemini API Key
3. 可选：配置自定义 Base URL（支持代理服务）

### 3. 开始使用
1. **上传或绘制图片**到白板
2. **选中图片**（可多选）
3. **打开 AI 生图对话框**
4. **输入描述**（如："把这个苹果变成橙子"）
5. **点击生成**，享受 AI 创作的乐趣！

> 💡 **提示**：使用「🪄 优化提示词」功能可以获得更好的生成效果

---

## 开发

```
npm install

npm run start
```

## Docker

```
docker pull pubuzhixing/drawnix:latest
```

## 依赖

- [plait](https://github.com/worktile/plait) - 开源画图框架
- [slate](https://github.com/ianstormtaylor/slate)  - 富文本编辑器框架
- [floating-ui](https://github.com/floating-ui/floating-ui)  - 一个超级好用的创建弹出层基础库



## 贡献

欢迎任何形式的贡献：

- 提 Bug

- 贡献代码

## 感谢支持

特别感谢公司对开源项目的大力支持，也感谢为本项目贡献代码、提供建议的朋友。

<p align="left">
  <a href="https://pingcode.com?utm_source=drawnix" target="_blank">
      <img src="https://cdn-aliyun.pingcode.com/static/site/img/pingcode-logo.4267e7b.svg" width="120" alt="PingCode" />
  </a>
</p>

## License

[MIT License](https://github.com/plait-board/drawnix/blob/master/LICENSE)  