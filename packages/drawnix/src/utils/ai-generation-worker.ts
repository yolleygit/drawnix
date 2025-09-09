/**
 * AI图像生成后台工作器
 * 
 * 单例模式的后台任务处理器，负责：
 * 1. 异步处理AI图像生成请求
 * 2. 自动替换占位符为生成的图像
 * 3. 创建智能箭头连接
 * 4. 错误处理和重试机制
 * 
 * @author Claude Code
 */

import { PlaitBoard } from '@plait/core';
import { AIGenerationTask } from '../hooks/use-ai-generation-tasks';
import { replacePlaceholderWithImage, createSmartArrowConnection, updatePlaceholderProgress } from './ai-generation-placeholder';

interface SettingsData {
  geminiApiKey: string;
  baseUrl?: string;
  imageGenerationModel?: string;
  promptOptimizationModel?: string;
}

const SETTINGS_STORAGE_KEY = 'drawnix_settings';

/**
 * 异步图像生成工作器
 */
const PATH_CACHE_KEY = 'drawnix_api_path_cache';

function getPathCache(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(PATH_CACHE_KEY) || '{}');
  } catch {
    return {};
  }
}

function setPathCache(baseUrl: string, template: string) {
  const cache = getPathCache();
  cache[baseUrl] = template;
  localStorage.setItem(PATH_CACHE_KEY, JSON.stringify(cache));
}

function getCachedTemplate(baseUrl: string): string | undefined {
  const cache = getPathCache();
  return cache[baseUrl];
}

export class AIGenerationWorker {
  private static instance: AIGenerationWorker;
  private processingQueue: Set<string> = new Set();
  private board: PlaitBoard | null = null;

  static getInstance(): AIGenerationWorker {
    if (!AIGenerationWorker.instance) {
      AIGenerationWorker.instance = new AIGenerationWorker();
    }
    return AIGenerationWorker.instance;
  }

  setBoard(board: PlaitBoard) {
    this.board = board;
  }

  /**
   * 添加任务到处理队列
   */
  async processTask(
    task: AIGenerationTask,
    onStatusUpdate: (taskId: string, status: AIGenerationTask['status'], updates?: any) => void
  ): Promise<void> {
    console.log('Worker: 开始处理任务', task.id);
    
    if (this.processingQueue.has(task.id)) {
      console.warn(`Task ${task.id} is already being processed`);
      return;
    }

    this.processingQueue.add(task.id);
    
    try {
      // 更新状态为生成中
      console.log('Worker: 更新状态为生成中', task.id);
      onStatusUpdate(task.id, 'generating', { progress: 0.2, progressStage: '初始化请求...' });
      
      // 模拟进度更新
      if (this.board) {
        updatePlaceholderProgress(this.board, task.id, 0.2, '初始化请求...');
      }

      // 获取API配置
      console.log('Worker: 获取API配置');
      const settings = this.getSettings();
      if (!settings.geminiApiKey) {
        throw new Error('请先配置 Gemini API Key');
      }
      console.log('Worker: API Key已配置，开始调用生成API');
      
      // 更新进度到 40%
      onStatusUpdate(task.id, 'generating', { progress: 0.4, progressStage: '连接API服务器...' });
      if (this.board) {
        updatePlaceholderProgress(this.board, task.id, 0.4, '连接API服务器...');
      }
      
      // 添加一个小延时，让用户看到进度变化
      await new Promise(resolve => setTimeout(resolve, 500));

      // 更新进度到 60%
      onStatusUpdate(task.id, 'generating', { progress: 0.6, progressStage: '发送生成请求...' });
      if (this.board) {
        updatePlaceholderProgress(this.board, task.id, 0.6, '发送生成请求...');
      }
      
      // 调用生成API，确保使用用户选择的模型
      const imageModel = settings.imageGenerationModel || (
        settings.baseUrl?.includes('openrouter.ai') 
          ? 'google/gemini-2.5-flash-image-preview'
          : 'gemini-2.5-flash-image-preview'
      );
      
      console.log('Worker: 使用的生图模型', { 
        imageModel, 
        isOpenRouter: settings.baseUrl?.includes('openrouter.ai'),
        baseUrl: settings.baseUrl 
      });
      
      const generatedImageUrl = await this.generateImageWithGemini(
        task.prompt,
        settings.geminiApiKey,
        settings.baseUrl || 'https://generativelanguage.googleapis.com/v1beta',
        imageModel,
        task.selectedImages
      );
      
      // 更新进度到 90%
      onStatusUpdate(task.id, 'generating', { progress: 0.9, progressStage: '处理生成的图像...' });
      if (this.board) {
        updatePlaceholderProgress(this.board, task.id, 0.9, '处理生成的图像...');
      }
      
      console.log('Worker: 图像生成完成', generatedImageUrl ? '成功' : '失败');

      // 更新任务状态到完成
      onStatusUpdate(task.id, 'completed', { 
        generatedImageUrl, 
        progress: 1.0, 
        progressStage: '生成完成!' 
      });

      // 如果有画布引用，自动替换占位符
      console.log('Worker: 开始替换占位符', { 
        boardExists: !!this.board, 
        taskId: task.id,
        generatedImageUrl: generatedImageUrl ? '已生成' : '未生成',
        boardChildrenCount: this.board?.children.length
      });
      
      if (this.board && generatedImageUrl) {
        try {
          // 等待短暂时间确保最后的进度更新完成
          await new Promise(resolve => setTimeout(resolve, 100));
          
          console.log('Worker: 即将替换占位符，停止进度更新');
          const newImageId = await replacePlaceholderWithImage(
            this.board,
            task.id,
            generatedImageUrl
          );
          console.log('Worker: 占位符替换结果', { success: !!newImageId, newImageId });
          
          if (!newImageId) {
            console.error('Worker: 占位符替换失败 - 未返回新图像ID');
            return; // 早期返回，避免后续代码执行
          }
          
          // 创建箭头连接
          if (newImageId && task.sourceImageIds && task.sourceImageIds.length > 0) {
            console.log('Worker: 开始创建箭头连接', {
              sourceImageIds: task.sourceImageIds,
              targetImageId: newImageId
            });
            
            // 为了确保新图像已经被正确渲染，我们稍微延迟一下
            setTimeout(() => {
              console.log('Worker: 延迟后开始创建箭头连接');
              try {
                // 创建智能箭头连接
                createSmartArrowConnection(
                  this.board!,
                  task.sourceImageIds!,
                  newImageId
                );
                console.log('Worker: 箭头连接创建完成');
              } catch (error) {
                console.error('Worker: 箭头连接创建失败', error);
              }
            }, 100);
          } else {
            console.log('Worker: 跳过箭头连接创建', {
              hasNewImageId: !!newImageId,
              hasSourceImageIds: !!(task.sourceImageIds && task.sourceImageIds.length > 0),
              sourceImageIds: task.sourceImageIds
            });
          }
          
        } catch (error) {
          console.error('Worker: 占位符替换过程中发生异常:', error);
        }
      } else {
        console.warn('Worker: 没有画布引用或未生成图像，无法替换占位符');
      }

    } catch (error) {
      console.error('AI Generation failed:', error);
      
      // 检查是否为 PROHIBITED_CONTENT 错误
      const errorMessage = error instanceof Error ? error.message : '生成图像失败';
      
      if (errorMessage.includes('PROHIBITED_CONTENT:')) {
        // 对于 PROHIBITED_CONTENT 错误，显示特殊的错误占位符
        onStatusUpdate(task.id, 'error', { 
          error: '内容被模型拒绝生成'
        });
        
        // 在画布上显示友好的错误提示
        if (this.board) {
          try {
            const { showProhibitedContentPlaceholder } = await import('./ai-generation-placeholder');
            await showProhibitedContentPlaceholder(
              this.board,
              task.id,
              task.prompt || '生成请求'
            );
            console.log('Worker: 已显示 PROHIBITED_CONTENT 错误占位符');
          } catch (placeholderError) {
            console.error('Worker: 显示错误占位符失败', placeholderError);
          }
        }
      } else {
        // 其他错误的常规处理
        onStatusUpdate(task.id, 'error', { 
          error: errorMessage
        });
      }
    } finally {
      this.processingQueue.delete(task.id);
    }
  }

  /**
   * 获取API设置
   */
  private getSettings(): SettingsData {
    const savedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
    let settings: SettingsData = { geminiApiKey: '' };
    
    if (savedSettings) {
      try {
        settings = JSON.parse(savedSettings);
      } catch (e) {
        console.error('Failed to parse settings:', e);
      }
    }

    return settings;
  }

  /**
   * 异步调用AI API生成图像
   */
  private async generateImageWithGemini(
    prompt: string,
    apiKey: string,
    baseUrl: string,
    imageModel: string,
    selectedImages: AIGenerationTask['selectedImages'] = []
  ): Promise<string> {
    try {
      console.log('Worker: generateImageWithGemini 开始', { prompt, baseUrl, selectedImagesCount: selectedImages.length });
      
      // 检测API类型：OpenRouter vs Gemini
      const isOpenRouter = baseUrl.includes('openrouter.ai');
      const isOfficialGemini = baseUrl.includes('googleapis.com');
      
      if (isOpenRouter) {
        return await this.generateImageWithOpenRouter(prompt, apiKey, baseUrl, imageModel, selectedImages);
      } else {
        return await this.generateImageWithGeminiAPI(prompt, apiKey, baseUrl, imageModel, selectedImages);
      }
    } catch (error) {
      console.error('Worker: Error generating image:', error);
      throw error;
    }
  }
  
  /**
   * OpenRouter API调用
   */
  private async generateImageWithOpenRouter(
    prompt: string,
    apiKey: string,
    baseUrl: string,
    imageModel: string,
    selectedImages: AIGenerationTask['selectedImages'] = []
  ): Promise<string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://drawnix.com',
      'X-Title': 'Drawnix'
    };
    
    // 构建OpenAI格式的messages
    const messages: any[] = [];
    
    if (selectedImages.length > 0) {
      // 有图像时，构建多模态消息
      const content: any[] = [];
      
      // 添加图像
      selectedImages.forEach(imageData => {
        content.push({
          type: 'image_url',
          image_url: {
            url: `data:${imageData.mimeType};base64,${imageData.base64}`
          }
        });
      });
      
      // 添加文本提示
      const imageGenerationPrompt = `Transform the provided images based on this description: ${prompt}. Create a new photorealistic, high-quality image.`;
      content.push({
        type: 'text',
        text: imageGenerationPrompt
      });
      
      messages.push({
        role: 'user',
        content: content
      });
    } else {
      // 纯文本生图
      const imageGenerationPrompt = `Create a photorealistic, high-quality image: ${prompt}.`;
      messages.push({
        role: 'user',
        content: imageGenerationPrompt
      });
    }
    
    const requestBody = JSON.stringify({
      model: imageModel,
      messages: messages,
      max_tokens: 1000,
      temperature: 0.7
    });
    
    // OpenRouter 正确的 API 端点
    const apiUrl = `${baseUrl}/api/v1/chat/completions`;
    console.log(`Worker: OpenRouter API调用: ${apiUrl}`);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: requestBody
    });
    
    console.log(`Worker: OpenRouter API返回状态: ${response.status}`);
    
    if (!response.ok) {
      let errorMessage;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`;
      } catch {
        errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      }
      throw new Error(`Worker: OpenRouter API错误: ${errorMessage}`);
    }
    
    const data = await response.json();
    console.log('Worker: OpenRouter API Response:', JSON.stringify(data, null, 2));
    
    // 处理OpenRouter响应
    if (data.choices && data.choices.length > 0) {
      const choice = data.choices[0];
      if (choice.message) {
        // 检查是否有图像数据
        if (choice.message.images && choice.message.images.length > 0) {
          const imageData = choice.message.images[0];
          if (imageData.image_url && imageData.image_url.url) {
            console.log('Worker: OpenRouter返回图像URL格式');
            return imageData.image_url.url;
          }
        }
        
        // 检查文本内容中是否包含图像URL或base64
        if (choice.message.content) {
          const content = choice.message.content;
          
          // 检查是否包含图像URL
          const imageUrlMatch = content.match(/https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp)/i);
          if (imageUrlMatch) {
            console.log('Worker: OpenRouter返回图像URL');
            return imageUrlMatch[0];
          }
          
          // 检查是否是base64格式
          const base64Match = content.match(/data:image\/[^;]+;base64,([A-Za-z0-9+\/=]+)/);  
          if (base64Match) {
            console.log('Worker: OpenRouter返回base64图像');
            return base64Match[0];
          }
          
          // 如果没有找到图像，说明可能是纯文本响应
          console.log('Worker: OpenRouter返回纯文本响应，可能不支持图像生成:', content.substring(0, 100));
          throw new Error(`Worker: 所选模型不支持图像生成，仅返回文本描述。请在设置中选择支持图像生成的模型。`);
        }
      }
    }
    
    throw new Error('Worker: OpenRouter API返回了意外的响应格式');
  }
  
  /**
   * Gemini API调用（原有逻辑）
   */
  private async generateImageWithGeminiAPI(
    prompt: string,
    apiKey: string,
    baseUrl: string,
    imageModel: string,
    selectedImages: AIGenerationTask['selectedImages'] = []
  ): Promise<string> {
    try {
      // 构建请求内容
      const parts: any[] = [];
      
      // 添加选中的图像
      selectedImages.forEach(imageData => {
        parts.push({
          inline_data: {
            mime_type: imageData.mimeType,
            data: imageData.base64
          }
        });
      });
      
      // 添加文本提示
      const imageGenerationPrompt = selectedImages.length > 0 
        ? `Transform the provided images based on this description: ${prompt}. Create a new photorealistic, high-quality image. Generate the actual image, do not provide text descriptions.`
        : `Create a photorealistic, high-quality image: ${prompt}. Generate the actual image, do not provide text descriptions.`;
      
      parts.push({
        text: imageGenerationPrompt
      });

      // 根据baseUrl判断使用哪种API密钥传递方式
      const isOfficialApi = baseUrl.includes('googleapis.com');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (isOfficialApi) {
        // Google官方API使用x-goog-api-key
        headers['x-goog-api-key'] = apiKey;
      } else {
        // 第三方代理可能使用Authorization Bearer或其他方式
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
      
      // 根据 doc/gemini-api.md 修正图像生成的请求格式
      const requestBody = JSON.stringify({
        contents: [{
          role: "user",
          parts: parts
        }],
        generationConfig: {
          // 图像生成模型的特殊配置
          responseModalities: ["IMAGE", "TEXT"],
          maxOutputTokens: 8192,
          temperature: 0.4,
          topP: 0.95
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_NONE"
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH", 
            threshold: "BLOCK_NONE"
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_NONE"
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_NONE"
          }
        ]
      });
      
      // 如果已有缓存的可用路径模板，优先只用该模板
      const cachedTemplate = getCachedTemplate(baseUrl);
      if (cachedTemplate) {
        const apiUrl = cachedTemplate.replace('{baseUrl}', baseUrl).replace('{model}', imageModel);
        console.log(`Worker: 使用缓存的API路径: ${apiUrl}`);
        const response = await fetch(apiUrl, { method: 'POST', headers, body: requestBody });
        console.log(`Worker: 缓存路径返回状态: ${response.status}`);
        if (response.status !== 404) {
          return await this.processApiResponse(response);
        }
        console.warn('Worker: 缓存路径出现404，将回退到自动探测');
      }

      // 自动探测不同的API路径格式
      const apiPathTemplates = [
        '{baseUrl}/models/{model}:generateContent', // Google官方格式
        '{baseUrl}/v1beta/models/{model}:generateContent', // Cloudflare Worker 示例格式（v1beta）
        '{baseUrl}/v1/models/{model}:generateContent', // v1前缀
        '{baseUrl}/{model}:generateContent', // 去掉models前缀
        '{baseUrl}/api/generate', // 通用generate端点
      ];
      
      let lastError: Error | null = null;
      
      for (const template of apiPathTemplates) {
        const apiUrl = template.replace('{baseUrl}', baseUrl).replace('{model}', imageModel);
        try {
          console.log(`Worker: 尝试API路径: ${apiUrl}`);
          
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers,
            body: requestBody
          });
          
          console.log(`Worker: API路径 ${apiUrl} 返回状态: ${response.status}`);
          
          // 如果不是404，说明路径存在，缓存该模板并继续处理响应
          if (response.status !== 404) {
            setPathCache(baseUrl, template);
            return await this.processApiResponse(response);
          }
          
        } catch (error) {
          console.log(`Worker: API路径 ${apiUrl} 请求失败:`, error);
          lastError = error instanceof Error ? error : new Error(String(error));
        }
      }
      
      // 如果所有路径都失败，抛出最后一个错误
      throw lastError || new Error('所有API路径都尝试失败');
      
    } catch (error: any) {
      console.error('Error generating image:', error);
      throw error;
    }
  }
  
  /**
   * 处理API响应的公共逻辑
   */
  private async processApiResponse(response: Response): Promise<string> {
    if (!response.ok) {
      let errorMessage;
      let errorDetails = '';
      
      try {
        const errorData = await response.json();
        console.error('Worker: API 返回错误数据:', errorData);
        
        if (response.status === 500) {
          errorMessage = 'API服务器内部错误。请检查：\n' +
                        '1. API Key是否有效且具有图像生成权限\n' +
                        '2. 代理服务器是否正常运行\n' +
                        '3. 是否超出了API调用限制';
        } else if (response.status === 429) {
          errorMessage = 'API调用频率超限，请稍后再试';
        } else if (response.status === 401) {
          errorMessage = 'API Key无效或已过期，请更新API Key';
        } else if (response.status === 403) {
          errorMessage = 'API Key没有图像生成权限，请检查API Key设置';
        } else {
          errorMessage = errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`;
        }
        
        if (errorData.error?.details) {
          errorDetails = '\n详细信息: ' + JSON.stringify(errorData.error.details);
        }
        
      } catch (parseError) {
        console.error('Worker: 解析API错误响应失败:', parseError);
        
        if (response.status === 500) {
          errorMessage = 'API服务器内部错误 (500)。可能的原因：\n' +
                        '1. 代理服务器配置错误\n' +
                        '2. API Key权限不足\n' +
                        '3. 请求格式不正确';
        } else {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
      }
      
      throw new Error(errorMessage + errorDetails);
    }

    const data = await response.json();
    console.log('Gemini API Response:', JSON.stringify(data, null, 2));
    
    // 处理响应
    if (data.candidates && data.candidates.length > 0) {
      const candidate = data.candidates[0];
      
      if (candidate.finishReason === 'SAFETY') {
        throw new Error('SAFETY_BLOCKED:图像生成被安全过滤器阻止，请尝试其他描述');
      }
      
      if (candidate.finishReason === 'PROHIBITED_CONTENT') {
        throw new Error('PROHIBITED_CONTENT:内容被模型拒绝生成，可能包含不当内容。请修改提示词后重试。');
      }
      
      if (candidate.content && candidate.content.parts) {
        for (const part of candidate.content.parts) {
          if (part.inlineData && part.inlineData.data) {
            const mimeType = part.inlineData.mimeType || 'image/png';
            return `data:${mimeType};base64,${part.inlineData.data}`;
          }
          if (part.inline_data && part.inline_data.data) {
            const mimeType = part.inline_data.mime_type || 'image/png';
            return `data:${mimeType};base64,${part.inline_data.data}`;
          }
        }
      }
    }
    
    if (data.error) {
      throw new Error(data.error.message || '生成图像时发生错误');
    }
    
    if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
      const textPart = data.candidates[0].content.parts.find((part: any) => part.text);
      if (textPart) {
        throw new Error(`模型返回了文本响应而非图像: ${textPart.text.substring(0, 200)}...`);
      }
    }
    
    throw new Error('API 返回了意外的响应格式。请检查 API Key 是否有图像生成权限，或者模型是否支持图像生成。');
  }

  /**
   * 获取当前处理中的任务数量
   */
  getProcessingCount(): number {
    return this.processingQueue.size;
  }

  /**
   * 检查任务是否正在处理中
   */
  isProcessing(taskId: string): boolean {
    return this.processingQueue.has(taskId);
  }
}