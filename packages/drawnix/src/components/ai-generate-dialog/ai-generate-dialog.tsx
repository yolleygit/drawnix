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

// 辅助函数：从 URL 获取图像的 base64 数据（带图像压缩）
const getImageBase64 = async (url: string, maxWidth: number = 1024, quality: number = 0.8): Promise<{ base64: string; mimeType: string }> => {
  // 如果已经是 data URL 格式，需要解析并可能压缩
  if (url.startsWith('data:')) {
    try {
      const match = url.match(/^data:(.+);base64,(.+)$/);
      if (match) {
        const originalMimeType = match[1];
        const originalBase64 = match[2];
        console.log('图片已是 data URL 格式，检查大小:', { mimeType: originalMimeType, base64Length: originalBase64.length });
        
        // 如果 base64 太大（超过 1MB），进行压缩
        if (originalBase64.length > 1400000) { // 约 1MB
          console.log('图片过大，开始压缩...');
          return await compressImage(url, maxWidth, quality);
        }
        
        return { base64: originalBase64, mimeType: originalMimeType };
      } else {
        throw new Error('无效的 data URL 格式');
      }
    } catch (error) {
      console.error('解析 data URL 失败:', error);
      throw error;
    }
  }

  // 对于外部 URL，使用 canvas 转换
  return await compressImage(url, maxWidth, quality);
};

// 图像压缩函数
const compressImage = async (url: string, maxWidth: number = 1024, quality: number = 0.8): Promise<{ base64: string; mimeType: string }> => {
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
        
        // 计算压缩后的尺寸
        let { width, height } = img;
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // 绘制压缩后的图像
        ctx.drawImage(img, 0, 0, width, height);
        
        // 输出为 JPEG 格式以进一步压缩
        const dataURL = canvas.toDataURL('image/jpeg', quality);
        const base64 = dataURL.split(',')[1];
        const mimeType = 'image/jpeg';
        
        console.log('图像压缩完成:', {
          originalSize: `${img.width}x${img.height}`,
          compressedSize: `${width}x${height}`,
          base64Length: base64.length,
          compressionRatio: (base64.length / (img.width * img.height * 4 * 1.37)).toFixed(2) // 估算压缩比
        });
        
        resolve({ base64, mimeType });
      } catch (error) {
        console.error('图像压缩失败:', error);
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
      console.log(`尝试API路径(缓存): ${apiUrl}`);
      const response = await fetch(apiUrl, { method: 'POST', headers, body: requestBody });
      console.log(`API路径(缓存) 返回状态: ${response.status}`);
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
        console.log(`尝试API路径: ${apiUrl}`);
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers,
          body: requestBody
        });
        
        console.log(`API路径 ${apiUrl} 返回状态: ${response.status}`);
        
        // 如果不是404，说明路径存在，缓存模板并继续处理响应
        if (response.status !== 404) {
          setPathCache(baseUrl, template);
          return await processImageGenerationResponse(response);
        }
        
      } catch (error) {
        console.log(`API路径 ${apiUrl} 请求失败:`, error);
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }
    
    // 如果所有路径都失败，抛出最后一个错误
    throw lastError || new Error('所有API路径都尝试失败');
    
  } catch (error) {
    console.error('Error generating image:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('生成图像时发生未知错误');
  }
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
      
      // 立即创建占位符并插入到画布
      const placeholder = createAIPlaceholder(board, task.id);
      
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

  const optimizePromptWithGemini = async (prompt: string, apiKey: string, baseUrl: string, promptModel: string, selectedImages: SelectedImageData[] = []): Promise<string> => {
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
      
      // 构建优化提示词的指令
      const optimizationPrompt = selectedImages.length > 0 
        ? `请分析这些图像，并根据用户的描述："${prompt}"，生成一个更详细、更具体的图像生成提示词。请用中英文混合的形式，包含具体的视觉细节、风格、色彩、构图等要素，让AI能够生成更好的图像。只返回优化后的提示词，不要包含其他说明。`
        : `请将这个图像生成提示词优化得更加详细和具体："${prompt}"。请用中英文混合的形式，包含具体的视觉细节、风格、色彩、构图等要素，让AI能够生成更好的图像。只返回优化后的提示词，不要包含其他说明。`;
      
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
        console.log(`尝试提示词优化API路径(缓存): ${apiUrl}`);
        const response = await fetch(apiUrl, { method: 'POST', headers, body: requestBody });
        console.log(`提示词优化API路径(缓存) 返回状态: ${response.status}`);
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
          console.log(`尝试提示词优化API路径: ${apiUrl}`);
          
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers,
            body: requestBody
          });
          
          console.log(`提示词优化API路径 ${apiUrl} 返回状态: ${response.status}`);
          
          // 如果不是404，说明路径存在，缓存模板并继续处理响应
          if (response.status !== 404) {
            setPathCache(baseUrl, template);
            return await processPromptOptimizationResponse(response);
          }
          
        } catch (error) {
          console.log(`提示词优化API路径 ${apiUrl} 请求失败:`, error);
          lastError = error instanceof Error ? error : new Error(String(error));
        }
      }
      
      // 如果所有路径都失败，抛出最后一个错误
      throw lastError || new Error('所有API路径都尝试失败');
    } catch (error) {
      console.error('Error optimizing prompt:', error);
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
      const optimizedPrompt = await optimizePromptWithGemini(
        prompt,
        settings.geminiApiKey,
        settings.baseUrl || 'https://generativelanguage.googleapis.com/v1beta',
        settings.promptOptimizationModel || 'gemini-2.5-flash',
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