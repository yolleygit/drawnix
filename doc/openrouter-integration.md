# OpenRouter API 集成文档

## 概述

Drawnix 现已完全支持 OpenRouter API，同时保持对原生 Gemini API 的完整向后兼容性。用户可以通过 OpenRouter 使用 Gemini 2.5 系列模型进行 AI 图像生成和提示词优化。

## 功能特性

### 🔄 智能 API 检测
- 自动识别 API 类型（Google 官方、OpenRouter、第三方代理）
- 基于 `baseUrl` 自动切换 API 调用方式
- 智能选择认证头格式（`x-goog-api-key` vs `Authorization Bearer`）

### 🔧 自动模型格式迁移
- 自动检测并转换模型名称格式
- OpenRouter 格式：`google/gemini-2.5-flash-image-preview`
- 原生格式：`gemini-2.5-flash-image-preview`
- 无缝迁移用户现有配置

### 📡 多路径探测与缓存
- 支持多种 API 端点格式的自动探测
- 缓存有效的 API 路径，提高后续请求效率
- 智能错误处理和重试机制

## 支持的 API 端点

### OpenRouter API
```
https://openrouter.ai/api/v1/chat/completions
```

### Gemini API (多种格式)
- Google 官方：`{baseUrl}/models/{model}:generateContent`
- v1beta 版本：`{baseUrl}/v1beta/models/{model}:generateContent`
- v1 版本：`{baseUrl}/v1/models/{model}:generateContent`
- 简化格式：`{baseUrl}/{model}:generateContent`
- 通用端点：`{baseUrl}/api/generate`

## 配置方式

### OpenRouter 配置
1. **API Key**: 输入你的 OpenRouter API Key
2. **Base URL**: `https://openrouter.ai`
3. **生图模型**: `google/gemini-2.5-flash-image-preview`（推荐）
4. **提示词优化模型**: `google/gemini-2.5-flash`（推荐）

### 原生 Gemini 配置
1. **API Key**: 输入你的 Gemini API Key
2. **Base URL**: `https://generativelanguage.googleapis.com/v1beta`
3. **生图模型**: `gemini-2.5-flash-image-preview`
4. **提示词优化模型**: `gemini-2.5-flash`

## 支持的模型

### OpenRouter 平台可用模型
- `google/gemini-2.5-flash-image-preview` - 支持图像生成（推荐）
- `google/gemini-2.5-pro-image-preview` - 高级图像生成
- `google/gemini-2.5-flash` - 文本生成和提示词优化（推荐）
- `google/gemini-2.5-pro` - 高级文本生成
- `anthropic/claude-3.5-sonnet` - 仅文本生成
- `openai/gpt-4o` - 仅文本生成
- `openai/gpt-4-turbo` - 仅文本生成

### 原生 Gemini 模型
- `gemini-2.5-flash-image-preview` - 支持图像生成
- `gemini-2.5-pro-image-preview` - 高级图像生成
- `gemini-2.5-flash` - 文本生成
- `gemini-2.5-pro` - 高级文本生成

## API 响应格式处理

### OpenRouter 响应格式
```json
{
  "choices": [{
    "message": {
      "content": "描述文本",
      "images": [{
        "image_url": {
          "url": "data:image/png;base64,..."
        }
      }]
    }
  }]
}
```

### Gemini 响应格式
```json
{
  "candidates": [{
    "content": {
      "parts": [{
        "inlineData": {
          "mimeType": "image/png",
          "data": "base64数据"
        }
      }]
    }
  }]
}
```

## 错误处理

### 自动重试机制
- 404 错误：自动尝试其他 API 端点格式
- 网络错误：智能重试和错误提示
- 模型不可用：提供用户友好的错误信息

### 用户友好的错误提示
- API Key 无效：提示检查密钥和权限
- 模型不支持：建议使用支持图像生成的模型
- 网络问题：提供详细的调试信息

## 向后兼容性

### 无缝迁移
- 现有用户配置自动迁移到正确格式
- 保持所有原有功能完整性
- 无需手动更新配置

### 智能切换
- 根据 URL 自动选择 API 类型
- 动态调整模型选项显示
- 保持用户体验一致性

## 使用示例

### JavaScript/TypeScript 调用示例

```typescript
// OpenRouter API 调用
const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
    'HTTP-Referer': 'https://drawnix.com',
    'X-Title': 'Drawnix'
  },
  body: JSON.stringify({
    model: 'google/gemini-2.5-flash-image-preview',
    messages: [{
      role: 'user',
      content: 'Create a beautiful sunset landscape'
    }],
    max_tokens: 1000,
    temperature: 0.7
  })
});
```

### Python 调用示例

```python
import requests

url = "https://openrouter.ai/api/v1/chat/completions"
headers = {
    "Authorization": f"Bearer {api_key}",
    "HTTP-Referer": "https://drawnix.com",
    "X-Title": "Drawnix",
    "Content-Type": "application/json"
}

data = {
    "model": "google/gemini-2.5-flash-image-preview",
    "messages": [
        {
            "role": "user", 
            "content": "Create a beautiful sunset landscape"
        }
    ],
    "max_tokens": 1000,
    "temperature": 0.7
}

response = requests.post(url, headers=headers, json=data)
```

## 技术实现细节

### 关键文件
- `packages/drawnix/src/components/settings-dialog/settings-dialog.tsx` - 设置界面和模型选择
- `packages/drawnix/src/components/ai-generate-dialog/ai-generate-dialog.tsx` - AI 生成对话框
- `packages/drawnix/src/utils/ai-generation-worker.ts` - 后台 AI 生成工作器

### 核心功能
1. **API 类型检测**: 基于 `baseUrl.includes('openrouter.ai')` 判断
2. **模型名称转换**: 自动在 OpenRouter 格式和原生格式间转换
3. **响应解析**: 智能解析不同 API 的响应格式
4. **缓存机制**: 缓存有效的 API 路径模板

## 故障排除

### 常见问题

**Q: 提示 "模型不是有效的模型 ID"**
A: 检查模型名称格式是否正确，OpenRouter 需要使用 `google/` 前缀

**Q: 无法连接到 API**
A: 检查网络连接和 API Key 是否有效

**Q: 图像生成失败**
A: 确保选择的模型支持图像生成（如 `gemini-2.5-flash-image-preview`）

### 调试信息
应用会在浏览器控制台输出详细的调试日志，包括：
- API 调用详情
- 模型选择过程
- 错误原因分析
- 自动迁移信息

## 更新历史

### v1.1.1 (2025-01-09)
- ✅ 完整 OpenRouter API 支持
- ✅ 自动模型格式迁移
- ✅ 智能 API 检测和切换
- ✅ 多路径探测和缓存
- ✅ 向后兼容性保证
- ✅ 用户友好的错误处理

---

如需技术支持或反馈问题，请访问项目的 GitHub 仓库。