import React, { useState, useEffect } from 'react';
import { useBoard } from '@plait-board/react-board';
import { useDrawnix } from '../../hooks/use-drawnix';
import { useI18n } from '../../i18n';
import { PlaitBoard, getSelectedElements } from '@plait/core';
import { PlaitDrawElement } from '@plait/draw';
import { drawImageWithResize } from '../../utils/image';
import { useAIGenerationTasks } from '../../hooks/use-ai-generation-tasks';
import { createAIPlaceholder } from '../../utils/ai-generation-placeholder';
import { AIGenerationWorker } from '../../utils/ai-generation-worker';
import './ai-generate-dialog.scss';

const SETTINGS_STORAGE_KEY = 'drawnix_settings';
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

interface SettingsData {
  geminiApiKey: string;
  baseUrl?: string;
  imageGenerationModel?: string;
  promptOptimizationModel?: string;
}

interface SelectedImageData {
  url: string;
  base64: string;
  mimeType: string;
}

// 辅助函数：从 URL 获取图像的 base64 数据（智能压缩）
const getImageBase64 = async (url: string, maxWidth = 1536, quality = 0.85): Promise<{ base64: string; mimeType: string }> => {
  // 如果已经是 data URL 格式，需要解析并可能压缩
  if (url.startsWith('data:')) {
    try {
      const match = url.match(/^data:(.+);base64,(.+)$/);
      if (match) {
        const originalMimeType = match[1];
        const originalBase64 = match[2];
        console.log('图片已是 data URL 格式，检查大小:', { 
          mimeType: originalMimeType, 
          base64Length: originalBase64.length,
          estimatedSizeMB: (originalBase64.length * 0.75 / 1024 / 1024).toFixed(2)
        });
        
        // 提高压缩阈值到 3MB，并优先保持图像质量
        if (originalBase64.length > 4200000) { // 约 3MB
          console.log('图片较大，进行轻度压缩保持质量...');
          return await compressImage(url, maxWidth, quality);
        }
        
        console.log('图片尺寸合适，直接使用原图');
        return { base64: originalBase64, mimeType: originalMimeType };
      } else {
        throw new Error('无效的 data URL 格式');
      }
    } catch (error) {
      console.error('解析 data URL 失败:', error);
      throw error;
    }
  }

  // 对于外部 URL，使用轻度压缩策略
  return await compressImage(url, maxWidth, quality);
};

// 图像智能压缩函数，保持更好的质量
const compressImage = async (url: string, maxWidth = 1536, quality = 0.85): Promise<{ base64: string; mimeType: string }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('无法创建 canvas 上下文'));
          return;
        }
        
        // 智能尺寸计算：只有在必要时才压缩
        let { width, height } = img;
        const originalAspectRatio = width / height;
        
        // 只有当图像宽度超过阈值时才缩放
        if (width > maxWidth) {
          width = maxWidth;
          height = Math.round(width / originalAspectRatio);
          console.log(`图像尺寸超过${maxWidth}px，进行缩放保持纵横比`);
        } else {
          console.log('图像尺寸合适，保持原尺寸');
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // 使用高质量绘制
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
        
        // 优先使用 PNG 保持透明度，只有在文件太大时才使用 JPEG
        let dataURL = canvas.toDataURL('image/png');
        let mimeType = 'image/png';
        
        // 如果 PNG 文件太大，则使用高质量 JPEG
        if (dataURL.length > 4200000) { // 大于 3MB 才转 JPEG
          dataURL = canvas.toDataURL('image/jpeg', quality);
          mimeType = 'image/jpeg';
          console.log('PNG文件较大，转换为高质量JPEG');
        }
        
        const base64 = dataURL.split(',')[1];
        
        console.log('图像处理完成:', {
          originalSize: `${img.width}x${img.height}`,
          processedSize: `${width}x${height}`,
          format: mimeType,
          base64Length: base64.length,
          estimatedSizeMB: (base64.length * 0.75 / 1024 / 1024).toFixed(2),
          qualityPreserved: width === img.width && height === img.height
        });
        
        resolve({ base64, mimeType });
      } catch (error) {
        console.error('图像处理失败:', error);
        reject(error);
      }
    };
    
    img.onerror = (error) => {
      console.error('图片加载失败:', url, error);
      reject(new Error('无法加载图像: ' + url));
    };
    
    img.src = url;
  });
};

const generateImageWithGemini = async (prompt: string, apiKey: string, baseUrl: string, imageModel: string, selectedImages: SelectedImageData[] = []): Promise<string> => {
  try {
    // 检测API类型：OpenRouter vs Gemini
    const isOpenRouter = baseUrl.includes('openrouter.ai');
    const isOfficialGemini = baseUrl.includes('googleapis.com');
    
    if (isOpenRouter) {
      return await generateImageWithOpenRouter(prompt, apiKey, baseUrl, imageModel, selectedImages);
    } else {
      return await generateImageWithGeminiAPI(prompt, apiKey, baseUrl, imageModel, selectedImages);
    }
  } catch (error) {
    console.error('Error generating image:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('生成图像时发生未知错误');
  }
};

// OpenRouter API调用
const generateImageWithOpenRouter = async (prompt: string, apiKey: string, baseUrl: string, imageModel: string, selectedImages: SelectedImageData[] = []): Promise<string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
    'HTTP-Referer': window.location.origin,
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
  console.log(`OpenRouter API调用: ${apiUrl}`);
  
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: requestBody
  });
  
  console.log(`OpenRouter API返回状态: ${response.status}`);
  
  if (!response.ok) {
    let errorMessage;
    try {
      const errorData = await response.json();
      errorMessage = errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`;
    } catch {
      errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    }
    throw new Error(`OpenRouter API错误: ${errorMessage}`);
  }
  
  const data = await response.json();
  console.log('OpenRouter API Response:', JSON.stringify(data, null, 2));
  
  // 处理OpenRouter响应
  if (data.choices && data.choices.length > 0) {
    const choice = data.choices[0];
    if (choice.message) {
      // 检查是否有图像数据
      if (choice.message.images && choice.message.images.length > 0) {
        const imageData = choice.message.images[0];
        if (imageData.image_url && imageData.image_url.url) {
          console.log('OpenRouter返回图像URL格式');
          return imageData.image_url.url;
        }
      }
      
      // 检查文本内容中是否包含图像URL或base64
      if (choice.message.content) {
        const content = choice.message.content;
        
        // 检查是否包含图像URL
        const imageUrlMatch = content.match(/https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp)/i);
        if (imageUrlMatch) {
          console.log('OpenRouter返回图像URL');
          return imageUrlMatch[0];
        }
        
        // 检查是否是base64格式
        const base64Match = content.match(/data:image\/[^;]+;base64,([A-Za-z0-9+\/=]+)/);
        if (base64Match) {
          console.log('OpenRouter返回base64图像');
          return base64Match[0];
        }
        
        // 如果没有找到图像，说明可能是纯文本响应
        console.log('OpenRouter返回纯文本响应，可能不支持图像生成:', content.substring(0, 100));
        throw new Error(`所选模型不支持图像生成，仅返回文本描述。请在设置中选择支持图像生成的模型。`);
      }
    }
  }
  
  throw new Error('OpenRouter API返回了意外的响应格式');
};

// Gemini API调用（原有逻辑）
const generateImageWithGeminiAPI = async (prompt: string, apiKey: string, baseUrl: string, imageModel: string, selectedImages: SelectedImageData[] = []): Promise<string> => {
  // 构建请求内容，包括文本和图像
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
  
  // 添加文本提示，使用更具体的图像生成指令
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
  
  // 若已有缓存模板，优先只使用该模板
  const cachedTemplate = getCachedTemplate(baseUrl);
  if (cachedTemplate) {
    const apiUrl = cachedTemplate.replace('{baseUrl}', baseUrl).replace('{model}', imageModel);
    console.log(`尝试Gemini API路径(缓存): ${apiUrl}`);
    const response = await fetch(apiUrl, { method: 'POST', headers, body: requestBody });
    console.log(`Gemini API路径(缓存) 返回状态: ${response.status}`);
    if (response.status !== 404) {
      return await processImageGenerationResponse(response);
    }
    console.warn('缓存路径出现404，将回退到自动探测');
  }

  // 自动探测不同的API路径模板
  const apiPathTemplates = [
    '{baseUrl}/models/{model}:generateContent',
    '{baseUrl}/v1beta/models/{model}:generateContent',
    '{baseUrl}/v1/models/{model}:generateContent',
    '{baseUrl}/{model}:generateContent',
    '{baseUrl}/api/generate',
  ];
  
  let lastError: Error | null = null;
  
  for (const template of apiPathTemplates) {
    const apiUrl = template.replace('{baseUrl}', baseUrl).replace('{model}', imageModel);
    try {
      console.log(`尝试Gemini API路径: ${apiUrl}`);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: requestBody
      });
      
      console.log(`Gemini API路径 ${apiUrl} 返回状态: ${response.status}`);
      
      // 如果不是404，说明路径存在，缓存模板并继续处理响应
      if (response.status !== 404) {
        setPathCache(baseUrl, template);
        return await processImageGenerationResponse(response);
      }
      
    } catch (error) {
      console.log(`Gemini API路径 ${apiUrl} 请求失败:`, error);
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }
  
  // 如果所有路径都失败，抛出最后一个错误
  throw lastError || new Error('所有Gemini API路径都尝试失败');
};

// 处理图像生成API响应的公共逻辑
function processImageGenerationResponse(response: Response): Promise<string> {
  return (async () => {
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
  
  // 处理 Gemini 的响应结构
  if (data.candidates && data.candidates.length > 0) {
    const candidate = data.candidates[0];
    
    // 检查是否被安全过滤器阻止
    if (candidate.finishReason === 'SAFETY') {
      throw new Error('图像生成被安全过滤器阻止，请尝试其他描述');
    }
    
    if (candidate.content && candidate.content.parts) {
      for (const part of candidate.content.parts) {
        // 检查 inlineData 字段（根据文档，这是正确的格式）
        if (part.inlineData && part.inlineData.data) {
          const mimeType = part.inlineData.mimeType || 'image/png';
          return `data:${mimeType};base64,${part.inlineData.data}`;
        }
        // 检查 inline_data 字段（备选格式）
        if (part.inline_data && part.inline_data.data) {
          const mimeType = part.inline_data.mime_type || 'image/png';
          return `data:${mimeType};base64,${part.inline_data.data}`;
        }
      }
    }
  }
  
  // 如果响应中包含错误信息
  if (data.error) {
    throw new Error(data.error.message || '生成图像时发生错误');
  }
  
  // 尝试查找是否有文本响应而不是图像
  if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
    const textPart = data.candidates[0].content.parts.find((part: any) => part.text);
    if (textPart) {
      throw new Error(`模型返回了文本响应而非图像: ${textPart.text.substring(0, 200)}...`);
    }
  }
  
  throw new Error('API 返回了意外的响应格式。请检查 API Key 是否有图像生成权限，或者模型是否支持图像生成。');
  })();
}

export const AIGenerateDialog: React.FC = () => {
  const board = useBoard();
  const { appState, setAppState } = useDrawnix();
  const { t } = useI18n();
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedImages, setSelectedImages] = useState<SelectedImageData[]>([]);
  const [isOptimizingPrompt, setIsOptimizingPrompt] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<'auto' | 'chinese' | 'english'>('english');
  const [aspectRatioMode, setAspectRatioMode] = useState<'original' | 'square' | 'landscape' | 'portrait'>('original');
  const { createTask, updateTaskStatus } = useAIGenerationTasks();

  // 检测并加载选中的图像
  useEffect(() => {
    const loadSelectedImages = async () => {
      if (!board) return;
      
      try {
        const selectedElements = getSelectedElements(board);
        const imageElements = selectedElements.filter((element: any) => 
          PlaitDrawElement.isImage && PlaitDrawElement.isImage(element)
        );
        
        if (imageElements.length === 0) {
          setSelectedImages([]);
          return;
        }
        
        const imageData: SelectedImageData[] = [];
        
        for (const imageElement of imageElements) {
          const imageEl = imageElement as any; // PlaitImage类型
          if (imageEl.url) {
            try {
              const { base64, mimeType } = await getImageBase64(imageEl.url);
              imageData.push({
                url: imageEl.url,
                base64,
                mimeType
              });
            } catch (error) {
              console.warn('无法加载图像:', imageEl.url, error);
            }
          }
        }
        
        setSelectedImages(imageData);
      } catch (error) {
        console.error('加载选中图像时出错:', error);
        setSelectedImages([]);
      }
    };

    if (appState.openAIGenerate) {
      loadSelectedImages();
    }
  }, [board, appState.openAIGenerate]);

  const handleClose = () => {
    setAppState({ ...appState, openAIGenerate: false });
    setPrompt('');
    setError(null);
    setSelectedImages([]);
    setIsGenerating(false); // 重置生成状态
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || !board) return;

    // 获取 API 配置
    const savedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
    let settings: SettingsData = { geminiApiKey: '' };
    
    if (savedSettings) {
      try {
        settings = JSON.parse(savedSettings);
      } catch (e) {
        console.error('Failed to parse settings:', e);
      }
    }

    if (!settings.geminiApiKey) {
      setError('请先在设置中配置 Gemini API Key');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // 获取当前选中图像的ID用于后续连接箭头
      const selectedElements = getSelectedElements(board);
      console.log('AI生成对话框: 获取选中的元素', {
        selectedElementsCount: selectedElements.length,
        selectedElements: selectedElements.map(el => ({ id: el.id, type: el.type }))
      });
      
      let sourceImageIds = selectedElements
        .filter((element: any) => {
          const isImage = PlaitDrawElement.isImage && PlaitDrawElement.isImage(element);
          console.log('AI生成对话框: 检查元素是否为图像', {
            elementId: element.id,
            elementType: element.type,
            isImage
          });
          return isImage;
        })
        .map((element: any) => {
          console.log('AI生成对话框: 映射图像元素ID', { elementId: element.id });
          return element.id;
        })
        .filter(Boolean);
      
      // 如果界面选择了图像但画布未选中，则使用界面选择的图像对应的元素ID作为箭头源
      if (sourceImageIds.length === 0 && selectedImages.length > 0) {
        // 尝试通过selectedImages的URL找到对应的画布元素ID
        const selectedImageUrls = selectedImages.map(img => img.url);
        const matchingElements = board.children
          .filter((element: any) => element.type === 'image' && selectedImageUrls.includes(element.url))
          .map((element: any) => element.id)
          .filter(Boolean);
        
        if (matchingElements.length > 0) {
          sourceImageIds = matchingElements;
          console.log('AI生成对话框: 使用界面选择的图像作为箭头源', {
            selectedImageUrls,
            matchingElementIds: matchingElements
          });
        }
      }
      
      console.log('AI生成对话框: 最终收集到的源图像ID', {
        sourceImageIds,
        count: sourceImageIds.length
      });

      // 创建生成任务
      const task = createTask(prompt, selectedImages, sourceImageIds);
      console.log('AI生成对话框: 创建的任务', {
        taskId: task.id,
        sourceImageIds: task.sourceImageIds,
        prompt: task.prompt
      });
      
      // 获取原始选中图像的尺寸信息
      let originalWidth: number | undefined;
      let originalHeight: number | undefined;
      let calculatedWidth: number | undefined;
      let calculatedHeight: number | undefined;
      
      if (sourceImageIds.length > 0) {
        // 从画布上找到对应的图像元素获取尺寸
        const firstSourceElement = board.children.find((element: any) => 
          element.id && sourceImageIds.includes(element.id) && element.type === 'image'
        ) as any;
        
        if (firstSourceElement && firstSourceElement.points) {
          originalWidth = firstSourceElement.points[1][0] - firstSourceElement.points[0][0];
          originalHeight = firstSourceElement.points[1][1] - firstSourceElement.points[0][1];
          console.log('AI生成对话框: 从选中元素获取到原始图像尺寸', {
            elementId: firstSourceElement.id,
            originalWidth,
            originalHeight,
            aspectRatio: (originalWidth / originalHeight).toFixed(2)
          });
          
          // 根据用户选择的横纵比模式计算尺寸
          const { width: newWidth, height: newHeight } = calculateAspectRatioSize(originalWidth, originalHeight, aspectRatioMode);
          calculatedWidth = newWidth;
          calculatedHeight = newHeight;
          console.log('AI生成对话框: 计算后的尺寸', {
            aspectRatioMode,
            originalSize: `${originalWidth}x${originalHeight}`,
            calculatedSize: `${calculatedWidth}x${calculatedHeight}`,
            aspectRatio: (calculatedWidth / calculatedHeight).toFixed(2)
          });
        }
      }
      
      // 立即创建占位符并插入到画布，使用计算后的尺寸和提示词
      const placeholder = createAIPlaceholder(
        board, 
        task.id, 
        undefined, // targetPoint
        calculatedWidth || originalWidth, 
        calculatedHeight || originalHeight,
        prompt.trim(), // 显示用户输入的提示词
        0.1 // 初始进度 10%
      );
      
      // 更新任务状态，记录占位符ID
      updateTaskStatus(task.id, 'pending', { placeholderId: (placeholder as any).id });

      // 设置画布引用给工作器
      const worker = AIGenerationWorker.getInstance();
      worker.setBoard(board);
      
      // 启动异步生成任务
      console.log('启动AI生成任务:', task);
      worker.processTask(task, updateTaskStatus).catch(error => {
        console.error('Background task failed:', error);
        // 更新任务为错误状态
        updateTaskStatus(task.id, 'error', { error: error.message });
      });

      // 任务启动成功后立即重置状态并关闭对话框
      setIsGenerating(false);
      handleClose();

    } catch (err) {
      console.error('Failed to start generation task:', err);
      setError(err instanceof Error ? err.message : '启动生成任务失败');
      setIsGenerating(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  };

  // 横纵比计算函数
  const calculateAspectRatioSize = (
    originalWidth: number, 
    originalHeight: number, 
    mode: 'original' | 'square' | 'landscape' | 'portrait'
  ): { width: number; height: number } => {
    switch (mode) {
      case 'original':
        return { width: originalWidth, height: originalHeight };
      
      case 'square':
        // 使用原图的最大边作为正方形的边长
        const maxSide = Math.max(originalWidth, originalHeight);
        return { width: maxSide, height: maxSide };
      
      case 'landscape':
        // 横向比例 16:9，保持原图面积的近似值
        const landscapeArea = originalWidth * originalHeight;
        const landscapeWidth = Math.sqrt(landscapeArea * 16 / 9);
        const landscapeHeight = landscapeWidth * 9 / 16;
        return { width: Math.round(landscapeWidth), height: Math.round(landscapeHeight) };
      
      case 'portrait':
        // 竖向比例 9:16，保持原图面积的近似值
        const portraitArea = originalWidth * originalHeight;
        const portraitHeight = Math.sqrt(portraitArea * 16 / 9);
        const portraitWidth = portraitHeight * 9 / 16;
        return { width: Math.round(portraitWidth), height: Math.round(portraitHeight) };
      
      default:
        return { width: originalWidth, height: originalHeight };
    }
  };

  // 语言检测辅助函数
  const detectLanguage = (text: string): 'chinese' | 'english' | 'auto' => {
    // 统计中文字符（包括中文标点）
    const chineseRegex = /[\u4e00-\u9fff\u3400-\u4dbf\u3000-\u303f\uff00-\uffef]/g;
    const chineseMatches = text.match(chineseRegex) || [];
    const chineseCount = chineseMatches.length;
    
    // 统计英文字符（字母和数字）
    const englishRegex = /[a-zA-Z0-9]/g;
    const englishMatches = text.match(englishRegex) || [];
    const englishCount = englishMatches.length;
    
    // 总字符数（不包括空格和标点）
    const totalCount = chineseCount + englishCount;
    
    if (totalCount === 0) return 'english'; // 默认英文
    
    const chineseRatio = chineseCount / totalCount;
    const englishRatio = englishCount / totalCount;
    
    // 判断主要语言
    if (chineseRatio >= 0.7) return 'chinese';
    if (englishRatio >= 0.7) return 'english';
    return 'auto'; // 如果两种语言都比较平衡，则返回auto
  };

  const optimizePromptWithGemini = async (prompt: string, apiKey: string, baseUrl: string, promptModel: string, selectedImages: SelectedImageData[] = []): Promise<string> => {
    try {
      // 检测API类型：OpenRouter vs Gemini
      const isOpenRouter = baseUrl.includes('openrouter.ai');
      
      if (isOpenRouter) {
        return await optimizePromptWithOpenRouter(prompt, apiKey, baseUrl, promptModel, selectedImages);
      } else {
        return await optimizePromptWithGeminiAPI(prompt, apiKey, baseUrl, promptModel, selectedImages);
      }
    } catch (error) {
      console.error('Error optimizing prompt:', error);
      throw error;
    }
  };
  
  // OpenRouter API优化提示词
  const optimizePromptWithOpenRouter = async (prompt: string, apiKey: string, baseUrl: string, promptModel: string, selectedImages: SelectedImageData[] = []): Promise<string> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Drawnix'
    };
    
    // 根据用户选择的语言选项确定使用的语言
    let languageToUse = selectedLanguage;
    if (selectedLanguage === 'auto') {
      languageToUse = detectLanguage(prompt);
    }
    console.log(`OpenRouter优化: 用户选择的语言: ${selectedLanguage}, 实际使用的语言: ${languageToUse}`);
    
    // 构建OpenAI格式的messages
    const messages: any[] = [];
    
    // 根据确定的语言构建不同的优化指令
    let optimizationPrompt = '';
    
    if (languageToUse === 'chinese') {
      optimizationPrompt = selectedImages.length > 0
        ? `请分析这些图像，并根据用户的描述："${prompt}"，生成一个更详细、更具体的中文图像生成提示词。请用纯中文描述，包含具体的视觉细节、风格、色彩、构图等要素，让AI能够生成更好的图像。只返回优化后的中文提示词，不要包含英文单词或其他说明。`
        : `请将这个图像生成提示词优化得更加详细和具体："${prompt}"。请用纯中文描述，包含具体的视觉细节、风格、色彩、构图等要素，让AI能够生成更好的图像。只返回优化后的中文提示词，不要包含英文单词或其他说明。`;
    } else if (languageToUse === 'english') {
      optimizationPrompt = selectedImages.length > 0
        ? `Please analyze these images and based on the user's description: "${prompt}", generate a more detailed and specific English image generation prompt. Use pure English to describe specific visual details, style, colors, composition and other elements to help AI generate better images. Only return the optimized English prompt, no Chinese characters or other explanations.`
        : `Please optimize this image generation prompt to be more detailed and specific: "${prompt}". Use pure English to describe specific visual details, style, colors, composition and other elements to help AI generate better images. Only return the optimized English prompt, no Chinese characters or other explanations.`;
    } else {
      optimizationPrompt = selectedImages.length > 0
        ? `请分析这些图像，并根据用户的描述："${prompt}"，生成一个更详细、更具体的图像生成提示词。请保持与用户输入相似的语言风格，包含具体的视觉细节、风格、色彩、构图等要素，让AI能够生成更好的图像。只返回优化后的提示词，不要包含其他说明。`
        : `请将这个图像生成提示词优化得更加详细和具体："${prompt}"。请保持与用户输入相似的语言风格，包含具体的视觉细节、风格、色彩、构图等要素，让AI能够生成更好的图像。只返回优化后的提示词，不要包含其他说明。`;
    }
    
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
      content.push({
        type: 'text',
        text: optimizationPrompt
      });
      
      messages.push({
        role: 'user',
        content: content
      });
    } else {
      // 纯文本优化
      messages.push({
        role: 'user',
        content: optimizationPrompt
      });
    }
    
    const requestBody = JSON.stringify({
      model: promptModel,
      messages: messages,
      max_tokens: 500,
      temperature: 0.3
    });
    
    const apiUrl = `${baseUrl}/api/v1/chat/completions`;
    console.log(`OpenRouter提示词优化API调用: ${apiUrl}`);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: requestBody
    });
    
    console.log(`OpenRouter提示词优化API返回状态: ${response.status}`);
    
    if (!response.ok) {
      let errorMessage;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`;
      } catch {
        errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      }
      throw new Error(`OpenRouter API错误: ${errorMessage}`);
    }
    
    const data = await response.json();
    console.log('OpenRouter提示词优化响应:', JSON.stringify(data, null, 2));
    
    if (data.choices && data.choices.length > 0) {
      const choice = data.choices[0];
      if (choice.message && choice.message.content) {
        return choice.message.content.trim();
      }
    }
    
    throw new Error('OpenRouter API返回了意外的响应格式');
  };
  
  // Gemini API优化提示词（原有逻辑）
  const optimizePromptWithGeminiAPI = async (prompt: string, apiKey: string, baseUrl: string, promptModel: string, selectedImages: SelectedImageData[] = []): Promise<string> => {
    try {
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
      
      // 根据用户选择的语言选项确定使用的语言
      let languageToUse = selectedLanguage;
      if (selectedLanguage === 'auto') {
        languageToUse = detectLanguage(prompt);
      }
      console.log(`Gemini优化: 用户选择的语言: ${selectedLanguage}, 实际使用的语言: ${languageToUse}, 原始提示词: "${prompt}"`);
      
      // 根据确定的语言构建不同的优化指令
      let optimizationPrompt = '';
      
      if (languageToUse === 'chinese') {
        // 中文输入 - 生成纯中文提示词
        optimizationPrompt = selectedImages.length > 0
          ? `请分析这些图像，并根据用户的描述："${prompt}"，生成一个更详细、更具体的中文图像生成提示词。请用纯中文描述，包含具体的视觉细节、风格、色彩、构图等要素，让AI能够生成更好的图像。只返回优化后的中文提示词，不要包含英文单词或其他说明。`
          : `请将这个图像生成提示词优化得更加详细和具体："${prompt}"。请用纯中文描述，包含具体的视觉细节、风格、色彩、构图等要素，让AI能够生成更好的图像。只返回优化后的中文提示词，不要包含英文单词或其他说明。`;
      } else if (languageToUse === 'english') {
        // 英文输入 - 生成纯英文提示词
        optimizationPrompt = selectedImages.length > 0
          ? `Please analyze these images and based on the user's description: "${prompt}", generate a more detailed and specific English image generation prompt. Use pure English to describe specific visual details, style, colors, composition and other elements to help AI generate better images. Only return the optimized English prompt, no Chinese characters or other explanations.`
          : `Please optimize this image generation prompt to be more detailed and specific: "${prompt}". Use pure English to describe specific visual details, style, colors, composition and other elements to help AI generate better images. Only return the optimized English prompt, no Chinese characters or other explanations.`;
      } else {
        // 混合语言输入 - 保持原有的混合策略但更明确
        optimizationPrompt = selectedImages.length > 0
          ? `请分析这些图像，并根据用户的描述："${prompt}"，生成一个更详细、更具体的图像生成提示词。请保持与用户输入相似的语言风格，包含具体的视觉细节、风格、色彩、构图等要素，让AI能够生成更好的图像。只返回优化后的提示词，不要包含其他说明。`
          : `请将这个图像生成提示词优化得更加详细和具体："${prompt}"。请保持与用户输入相似的语言风格，包含具体的视觉细节、风格、色彩、构图等要素，让AI能够生成更好的图像。只返回优化后的提示词，不要包含其他说明。`;
      }
      
      parts.push({
        text: optimizationPrompt
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
      
      // 优先使用缓存模板
      const cachedTemplate = getCachedTemplate(baseUrl);
      if (cachedTemplate) {
        const apiUrl = cachedTemplate.replace('{baseUrl}', baseUrl).replace('{model}', promptModel);
        console.log(`尝试Gemini提示词优化API路径(缓存): ${apiUrl}`);
        const response = await fetch(apiUrl, { method: 'POST', headers, body: requestBody });
        console.log(`Gemini提示词优化API路径(缓存) 返回状态: ${response.status}`);
        if (response.status !== 404) {
          return await processPromptOptimizationResponse(response);
        }
        console.warn('缓存路径出现404，将回退到自动探测');
      }

      const apiPathTemplates = [
        '{baseUrl}/models/{model}:generateContent',
        '{baseUrl}/v1beta/models/{model}:generateContent',
        '{baseUrl}/v1/models/{model}:generateContent',
        '{baseUrl}/{model}:generateContent',
        '{baseUrl}/api/generate',
      ];
      
      let lastError: Error | null = null;
      
      for (const template of apiPathTemplates) {
        const apiUrl = template.replace('{baseUrl}', baseUrl).replace('{model}', promptModel);
        try {
          console.log(`尝试Gemini提示词优化API路径: ${apiUrl}`);
          
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers,
            body: requestBody
          });
          
          console.log(`Gemini提示词优化API路径 ${apiUrl} 返回状态: ${response.status}`);
          
          // 如果不是404，说明路径存在，缓存模板并继续处理响应
          if (response.status !== 404) {
            setPathCache(baseUrl, template);
            return await processPromptOptimizationResponse(response);
          }
          
        } catch (error) {
          console.log(`Gemini提示词优化API路径 ${apiUrl} 请求失败:`, error);
          lastError = error instanceof Error ? error : new Error(String(error));
        }
      }
      
      // 如果所有路径都失败，抛出最后一个错误
      throw lastError || new Error('所有Gemini API路径都尝试失败');
    } catch (error) {
      console.error('Error optimizing prompt with Gemini:', error);
      throw error;
    }
  };

  
  // 处理提示词优化API响应的公共逻辑
  function processPromptOptimizationResponse(response: Response): Promise<string> {
    return (async () => {
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
    
    if (data.candidates && data.candidates.length > 0) {
      const candidate = data.candidates[0];
      
      if (candidate.finishReason === 'SAFETY') {
        throw new Error('提示词优化被安全过滤器阻止');
      }
      
      if (candidate.content && candidate.content.parts) {
        for (const part of candidate.content.parts) {
          if (part.text) {
            return part.text.trim();
          }
        }
      }
    }
    
    if (data.error) {
      throw new Error(data.error.message || '优化提示词时发生错误');
    }
    
    throw new Error('API 返回了意外的响应格式');
    })();
  }

  const handleOptimizePrompt = async () => {
    if (!prompt.trim()) {
      setError('请先输入提示词');
      return;
    }

    // 获取 API 配置
    const savedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
    let settings: SettingsData = { geminiApiKey: '' };
    
    if (savedSettings) {
      try {
        settings = JSON.parse(savedSettings);
      } catch (e) {
        console.error('Failed to parse settings:', e);
      }
    }

    if (!settings.geminiApiKey) {
      setError('请先在设置中配置 Gemini API Key');
      return;
    }

    setIsOptimizingPrompt(true);
    setError(null);

    try {
      // 确保使用用户选择的模型
      const promptModel = settings.promptOptimizationModel || (
        settings.baseUrl?.includes('openrouter.ai') 
          ? 'google/gemini-2.5-flash'
          : 'gemini-2.5-flash'
      );
      
      console.log('AI生成对话框: 使用的提示词优化模型', { 
        promptModel, 
        isOpenRouter: settings.baseUrl?.includes('openrouter.ai'),
        baseUrl: settings.baseUrl 
      });
      
      const optimizedPrompt = await optimizePromptWithGemini(
        prompt,
        settings.geminiApiKey,
        settings.baseUrl || 'https://generativelanguage.googleapis.com/v1beta',
        promptModel,
        selectedImages
      );
      
      // 将优化后的提示词重新填入输入框
      setPrompt(optimizedPrompt);
    } catch (err) {
      console.error('Failed to optimize prompt:', err);
      setError(err instanceof Error ? err.message : '优化提示词失败');
    } finally {
      setIsOptimizingPrompt(false);
    }
  };

  if (!appState.openAIGenerate) {
    return null;
  }

  return (
    <div className="ai-generate-dialog-overlay">
      <div className="ai-generate-dialog">
        <div className="ai-generate-header">
          <h2>{t('aiGenerate.title')}</h2>
        </div>
        
        <div className="ai-generate-content">
          {selectedImages.length > 0 && (
            <div className="selected-images-container">
              <div className="selected-images-title">
                选中的图像 ({selectedImages.length}):
              </div>
              <div className="selected-images-grid">
                {selectedImages.map((imageData, index) => (
                  <div key={index} className="selected-image-item">
                    <img 
                      src={imageData.url} 
                      alt={`Selected ${index + 1}`}
                      className="selected-image-preview"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className="prompt-input-container">
            <div className="language-selection-container">
              <label className="language-selection-label">优化语言:</label>
              <div className="language-selection-buttons">
                <button
                  className={`language-btn ${selectedLanguage === 'english' ? 'active' : ''}`}
                  onClick={() => setSelectedLanguage('english')}
                  disabled={isGenerating || isOptimizingPrompt}
                >
                  English
                </button>
                <button
                  className={`language-btn ${selectedLanguage === 'chinese' ? 'active' : ''}`}
                  onClick={() => setSelectedLanguage('chinese')}
                  disabled={isGenerating || isOptimizingPrompt}
                >
                  中文
                </button>
                <button
                  className={`language-btn ${selectedLanguage === 'auto' ? 'active' : ''}`}
                  onClick={() => setSelectedLanguage('auto')}
                  disabled={isGenerating || isOptimizingPrompt}
                >
                  自动检测
                </button>
              </div>
            </div>
            <div className="aspect-ratio-selection-container">
              <label className="aspect-ratio-selection-label">生成尺寸:</label>
              <div className="aspect-ratio-selection-buttons">
                <button
                  className={`aspect-ratio-btn ${aspectRatioMode === 'original' ? 'active' : ''}`}
                  onClick={() => setAspectRatioMode('original')}
                  disabled={isGenerating || isOptimizingPrompt}
                  title="保持原图尺寸"
                >
                  原图尺寸
                </button>
                <button
                  className={`aspect-ratio-btn ${aspectRatioMode === 'square' ? 'active' : ''}`}
                  onClick={() => setAspectRatioMode('square')}
                  disabled={isGenerating || isOptimizingPrompt}
                  title="正方形，适合头像、单个物体"
                >
                  正方形
                </button>
                <button
                  className={`aspect-ratio-btn ${aspectRatioMode === 'landscape' ? 'active' : ''}`}
                  onClick={() => setAspectRatioMode('landscape')}
                  disabled={isGenerating || isOptimizingPrompt}
                  title="横向比例 16:9，适合9宫格、拼图等"
                >
                  横向 16:9
                </button>
                <button
                  className={`aspect-ratio-btn ${aspectRatioMode === 'portrait' ? 'active' : ''}`}
                  onClick={() => setAspectRatioMode('portrait')}
                  disabled={isGenerating || isOptimizingPrompt}
                  title="竖向比例 9:16，适合手机屏幕"
                >
                  竖向 9:16
                </button>
              </div>
            </div>
            {/* 智能提示 */}
            {selectedImages.length > 0 && aspectRatioMode === 'original' && (
              <div className="smart-suggestion">
                <div className="suggestion-icon">💡</div>
                <div className="suggestion-text">
                  提示：您选中的是竖向图片，如果要生成复杂布局（如9宫格、拼图），建议选择“<strong>横向 16:9</strong>”获得更好的效果。
                </div>
              </div>
            )}
            <div className="prompt-input-wrapper">
              <textarea
                className="prompt-input"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={selectedImages.length > 0 
                  ? '基于选中的图像描述您想要的修改或变化...' 
                  : t('aiGenerate.prompt')
                }
                rows={4}
                disabled={isGenerating || isOptimizingPrompt}
              />
              <button 
                className="magic-optimize-btn"
                onClick={handleOptimizePrompt}
                disabled={!prompt.trim() || isGenerating || isOptimizingPrompt}
                title={selectedImages.length > 0 ? '优化提示词（结合图像分析）' : '优化提示词'}
              >
                {isOptimizingPrompt ? '✨' : '🪄'}
              </button>
            </div>
          </div>
          
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}
        </div>
        
        <div className="ai-generate-footer">
          <button 
            onClick={handleClose} 
            className="btn btn-cancel"
            disabled={isGenerating}
          >
            {t('aiGenerate.cancel')}
          </button>
          <button 
            onClick={handleGenerate} 
            className="btn btn-generate"
            disabled={!prompt.trim() || isGenerating}
          >
{isGenerating ? '启动中...' : t('aiGenerate.generate')}
          </button>
        </div>
      </div>
    </div>
  );
};