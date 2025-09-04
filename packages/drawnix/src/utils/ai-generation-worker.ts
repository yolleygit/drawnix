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
import { replacePlaceholderWithImage, createSmartArrowConnection } from './ai-generation-placeholder';

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
      onStatusUpdate(task.id, 'generating');

      // 获取API配置
      console.log('Worker: 获取API配置');
      const settings = this.getSettings();
      if (!settings.geminiApiKey) {
        throw new Error('请先配置 Gemini API Key');
      }
      console.log('Worker: API Key已配置，开始调用生成API');

      // 调用生成API
      const generatedImageUrl = await this.generateImageWithGemini(
        task.prompt,
        settings.geminiApiKey,
        settings.baseUrl || 'https://generativelanguage.googleapis.com/v1beta',
        settings.imageGenerationModel || 'gemini-2.5-flash-image-preview',
        task.selectedImages
      );
      
      console.log('Worker: 图像生成完成', generatedImageUrl ? '成功' : '失败');

      // 更新任务状态
      onStatusUpdate(task.id, 'completed', { generatedImageUrl });

      // 如果有画布引用，自动替换占位符
      console.log('Worker: 开始替换占位符', { boardExists: !!this.board, placeholderId: task.placeholderId });
      if (this.board) {
        const newImageId = replacePlaceholderWithImage(
          this.board,
          task.id,
          generatedImageUrl
        );
        console.log('Worker: 占位符替换结果', { success: !!newImageId, newImageId });

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
                this.board,
                task.sourceImageIds,
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
      } else {
        console.warn('Worker: 没有画布引用，无法替换占位符');
      }

    } catch (error) {
      console.error('AI Generation failed:', error);
      onStatusUpdate(task.id, 'error', { 
        error: error instanceof Error ? error.message : '生成图像失败'
      });
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
   * 异步调用Gemini API生成图像
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
      
      const requestBody = JSON.stringify({
        contents: [{
          parts: parts
        }]
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
      
    } catch (error) {
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
      try {
        const errorData = await response.json();
        errorMessage = errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`;
      } catch {
        errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log('Gemini API Response:', JSON.stringify(data, null, 2));
    
    // 处理响应
    if (data.candidates && data.candidates.length > 0) {
      const candidate = data.candidates[0];
      
      if (candidate.finishReason === 'SAFETY') {
        throw new Error('图像生成被安全过滤器阻止，请尝试其他描述');
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