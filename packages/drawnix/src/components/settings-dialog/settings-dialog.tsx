import React, { useState, useEffect } from 'react';
import { useDrawnix } from '../../hooks/use-drawnix';
import { useI18n } from '../../i18n';
import './settings-dialog.scss';

interface SettingsData {
  geminiApiKey: string;
  baseUrl?: string;
  imageGenerationModel?: string;
  promptOptimizationModel?: string;
}

const SETTINGS_STORAGE_KEY = 'drawnix_settings';

export const SettingsDialog: React.FC = () => {
  const { appState, setAppState } = useDrawnix();
  const { t } = useI18n();
  const [settings, setSettings] = useState<SettingsData>({
    geminiApiKey: '',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    imageGenerationModel: 'gemini-2.5-flash-image-preview',
    promptOptimizationModel: 'gemini-2.5-flash',
  });
  const [modelStatus, setModelStatus] = useState<{
    imageModel: 'checking' | 'available' | 'error' | null;
    promptModel: 'checking' | 'available' | 'error' | null;
    error?: string;
  }>({ imageModel: null, promptModel: null });

  useEffect(() => {
    // 从 localStorage 加载设置
    const savedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (savedSettings) {
      try {
        const parsedSettings = JSON.parse(savedSettings);
        
        // 检查是否需要迁移模型名称格式
        const isOpenRouter = parsedSettings.baseUrl?.includes('openrouter.ai');
        let needsUpdate = false;
        
        if (isOpenRouter) {
          // 如果使用 OpenRouter 但模型名称是原生格式，则转换为 OpenRouter 格式
          if (parsedSettings.imageGenerationModel && !parsedSettings.imageGenerationModel.startsWith('google/')) {
            // 转换生图模型
            if (parsedSettings.imageGenerationModel === 'gemini-2.5-flash-image-preview') {
              parsedSettings.imageGenerationModel = 'google/gemini-2.5-flash-image-preview';
              needsUpdate = true;
            } else if (parsedSettings.imageGenerationModel === 'gemini-2.5-pro-image-preview') {
              parsedSettings.imageGenerationModel = 'google/gemini-2.5-pro-image-preview';
              needsUpdate = true;
            }
          }
          
          if (parsedSettings.promptOptimizationModel && !parsedSettings.promptOptimizationModel.startsWith('google/')) {
            // 转换提示词优化模型
            if (parsedSettings.promptOptimizationModel === 'gemini-2.5-flash') {
              parsedSettings.promptOptimizationModel = 'google/gemini-2.5-flash';
              needsUpdate = true;
            } else if (parsedSettings.promptOptimizationModel === 'gemini-2.5-pro') {
              parsedSettings.promptOptimizationModel = 'google/gemini-2.5-pro';
              needsUpdate = true;
            }
          }
        } else {
          // 如果不使用 OpenRouter 但模型名称是 OpenRouter 格式，则转换为原生格式
          if (parsedSettings.imageGenerationModel?.startsWith('google/')) {
            if (parsedSettings.imageGenerationModel === 'google/gemini-2.5-flash-image-preview') {
              parsedSettings.imageGenerationModel = 'gemini-2.5-flash-image-preview';
              needsUpdate = true;
            } else if (parsedSettings.imageGenerationModel === 'google/gemini-2.5-pro-image-preview') {
              parsedSettings.imageGenerationModel = 'gemini-2.5-pro-image-preview';
              needsUpdate = true;
            }
          }
          
          if (parsedSettings.promptOptimizationModel?.startsWith('google/')) {
            if (parsedSettings.promptOptimizationModel === 'google/gemini-2.5-flash') {
              parsedSettings.promptOptimizationModel = 'gemini-2.5-flash';
              needsUpdate = true;
            } else if (parsedSettings.promptOptimizationModel === 'google/gemini-2.5-pro') {
              parsedSettings.promptOptimizationModel = 'gemini-2.5-pro';
              needsUpdate = true;
            }
          }
        }
        
        setSettings(parsedSettings);
        
        // 如果需要更新，立即保存迁移后的设置
        if (needsUpdate) {
          console.log('设置对话框: 检测到模型名称格式不匹配，自动迁移', {
            isOpenRouter,
            oldImageModel: JSON.parse(savedSettings).imageGenerationModel,
            newImageModel: parsedSettings.imageGenerationModel,
            oldPromptModel: JSON.parse(savedSettings).promptOptimizationModel,
            newPromptModel: parsedSettings.promptOptimizationModel
          });
          localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(parsedSettings));
        }
      } catch (e) {
        console.error('Failed to parse settings:', e);
      }
    }
  }, []);

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
    return getPathCache()[baseUrl];
  }

  // 检测模型可用性
  const checkModelAvailability = async (apiKey: string, baseUrl: string, modelName: string): Promise<boolean> => {
    // 根据baseUrl判断使用哪种API密钥传递方式和路径格式
    const isOfficialApi = baseUrl.includes('googleapis.com');
    const isOpenRouter = baseUrl.includes('openrouter.ai');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (isOfficialApi) {
      // Google官方API使用x-goog-api-key
      headers['x-goog-api-key'] = apiKey;
    } else {
      // 第三方代理（包括OpenRouter）使用Authorization Bearer
      headers['Authorization'] = `Bearer ${apiKey}`;
      if (isOpenRouter) {
        headers['HTTP-Referer'] = window.location.origin;
        headers['X-Title'] = 'Drawnix';
      }
    }
    
    // 根据模型类型创建不同的测试请求体
    const isImageModel = modelName.includes('image-preview') || modelName.includes('dall-e') || modelName.includes('midjourney');
    
    let requestBody;
    if (isOpenRouter) {
      // OpenRouter 使用 OpenAI 兼容格式
      requestBody = JSON.stringify({
        model: modelName,
        messages: [{
          role: "user",
          content: isImageModel 
            ? "Generate a simple test image: a small red circle on white background"
            : "Hello, this is a test message to verify model availability. Please respond with OK."
        }],
        max_tokens: isImageModel ? 50 : 10,
        temperature: 0.1
      });
    } else {
      // Gemini 格式（兼容原有格式）
      requestBody = isImageModel 
        ? JSON.stringify({
            // 图像生成模型的测试请求格式（参考 doc/gemini-api.md）
            contents: [{
              role: "user",
              parts: [{
                text: "Create a simple test image: a red circle on white background"
              }]
            }],
            generationConfig: {
              responseModalities: ["IMAGE", "TEXT"],
              maxOutputTokens: 1024,
              temperature: 0.1
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
          })
        : JSON.stringify({
            // 文本模型的测试请求格式
            contents: [{
              role: "user",
              parts: [{
                text: 'Hello, this is a test message to verify model availability. Please respond with OK.'
              }]
            }],
            generationConfig: {
              maxOutputTokens: 10,
              temperature: 0.1
            }
          });
    }
    
    // 优先使用缓存模板
    const cachedTemplate = getCachedTemplate(baseUrl);
    if (cachedTemplate) {
      const url = cachedTemplate.replace('{baseUrl}', baseUrl).replace('{model}', modelName);
      try {
        console.log(`设置对话框: 使用缓存模板: ${url}`);
        const response = await fetch(url, { method: 'POST', headers, body: requestBody });
        if (response.status !== 404) {
          return await processApiResponse(response);
        }
        console.warn('设置对话框: 缓存路径出现404，将回退到自动探测');
      } catch (e) {
        console.warn('设置对话框: 缓存路径请求失败，回退到自动探测', e);
      }
    }

    // 尝试不同的API路径格式（自动探测并缓存）
    let apiPathTemplates;
    if (isOpenRouter) {
      // OpenRouter 使用正确的 API 端点
      apiPathTemplates = [
        '{baseUrl}/api/v1/chat/completions', // OpenRouter 正确路径
      ];
    } else {
      // Gemini 和其他代理服务的多种路径格式（保持向后兼容）
      apiPathTemplates = [
        '{baseUrl}/v1beta/models/{model}:generateContent', // cf-gemini-proxy标准格式
        '{baseUrl}/models/{model}:generateContent', // Google官方格式
        '{baseUrl}/v1/models/{model}:generateContent', // v1前缀
        '{baseUrl}/{model}:generateContent', // 去掉models前缀
        '{baseUrl}/api/generate', // 通用generate端点
      ];
    }
    
    // 依次尝试不同的API路径
    for (const template of apiPathTemplates) {
      const apiUrl = isOpenRouter 
        ? template.replace('{baseUrl}', baseUrl)
        : template.replace('{baseUrl}', baseUrl).replace('{model}', modelName);
      
      try {
        console.log(`设置对话框: 尝试API路径: ${apiUrl}`);
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers,
          body: requestBody
        });
        
        console.log(`设置对话框: API路径 ${apiUrl} 返回状态: ${response.status}`);
        
        // 如果不是404，说明路径存在，缓存模板并继续处理响应
        if (response.status !== 404) {
          setPathCache(baseUrl, template);
          return await processApiResponse(response);
        }
        
      } catch (error) {
        console.log(`设置对话框: API路径 ${apiUrl} 请求失败:`, error);
        // 继续尝试下一个路径
      }
    }
    
    console.log('所有API路径都尝试失败');
    return false;
  };
  
  // 处理API响应的公共逻辑
  function processApiResponse(response: Response): Promise<boolean> {
    return (async () => {
      // 只有200状态码才认为模型真正可用
      if (response.status === 200) {
        console.log('检测成功: 模型响应正常');
        return true;
      }
      
      // 对于非200状态码，解析具体错误原因
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        // 无法解析响应体，根据状态码给出通用错误信息
        console.log(`检测失败: HTTP ${response.status} - ${response.statusText}`);
        return false;
      }
      
      // 分析错误信息并给出具体原因
      const errorMessage = errorData.error?.message || '';
      
      if (response.status === 400) {
        if (errorMessage.includes('API key not valid') || 
            errorMessage.includes('invalid API key') ||
            errorMessage.includes('Invalid API key')) {
          console.log('检测失败: API Key无效');
        } else if (errorMessage.includes('model') && errorMessage.includes('not found')) {
          console.log('检测失败: 模型不存在');
        } else {
          console.log('检测失败: 请求参数错误或模型不支持此请求格式');
        }
        return false;
      }
      
      if (response.status === 401) {
        console.log('检测失败: 认证失败，请检查 API Key 或 PROXY_KEY');
        return false;
      }
      
      if (response.status === 403) {
        console.log('检测失败: 权限不足，请检查 API Key 权限');
        return false;
      }
      
      if (response.status === 404) {
        console.log('检测失败: API 端点或模型不存在');
        return false;
      }
      
      if (response.status === 500) {
        console.log('检测失败: 服务器内部错误，可能是代理配置或 API Key 问题');
        return false;
      }
      
      // 其他错误状态码
      console.log(`检测失败: HTTP ${response.status} - ${errorMessage || response.statusText}`);
      return false;
    })().catch(error => {
      console.error('Model availability check failed:', error);
      return false;
    });
  }

  const handleSave = () => {
    // 直接保存设置，不在进行检测
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    setAppState({ ...appState, openSettings: false });
  };

  // 检测单个模型
  const handleTestModel = async (modelType: 'image' | 'prompt') => {
    if (!settings.geminiApiKey.trim()) {
      alert('请先输入 API Key');
      return;
    }

    const baseUrl = settings.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
    const modelName = modelType === 'image' 
      ? (settings.imageGenerationModel || 'gemini-2.5-flash-image-preview')
      : (settings.promptOptimizationModel || 'gemini-2.5-flash');

    // 设置当前模型为棆测中
    setModelStatus(prev => ({
      ...prev,
      [modelType === 'image' ? 'imageModel' : 'promptModel']: 'checking'
    }));

    try {
      const isAvailable = await checkModelAvailability(settings.geminiApiKey, baseUrl, modelName);
      
      setModelStatus(prev => ({
        ...prev,
        [modelType === 'image' ? 'imageModel' : 'promptModel']: isAvailable ? 'available' : 'error'
      }));
      
      // 给用户反馈
      if (isAvailable) {
        console.log(`✅ 模型 ${modelName} 检测成功！模型正常响应。`);
      } else {
        console.warn(`❌ 模型 ${modelName} 检测失败。\n请检查以下项目：\n1. API Key 是否正确且有效\n2. Base URL 是否正确\n3. 网络连接是否正常\n4. 代理服务器配置是否正确\n5. 模型名称是否支持`);
      }
    } catch (error) {
      console.error(`${modelType} model check failed:`, error);
      setModelStatus(prev => ({
        ...prev,
        [modelType === 'image' ? 'imageModel' : 'promptModel']: 'error'
      }));
      
      // 提供更友好的错误信息
      console.error(`模型 ${modelName} 检测遇到错误：${error}\n请检查网络连接和 API 配置`);
    }
  };

  const handleReset = () => {
    if (confirm('确定要重置所有设置吗？这将清空所有配置信息。')) {
      const defaultSettings: SettingsData = {
        geminiApiKey: '',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        imageGenerationModel: 'gemini-2.5-flash-image-preview',
        promptOptimizationModel: 'gemini-2.5-flash',
      };
      setSettings(defaultSettings);
      setModelStatus({ imageModel: null, promptModel: null });
      localStorage.removeItem(SETTINGS_STORAGE_KEY);
      alert('设置已重置为默认值');
    }
  };

  const handleCancel = () => {
    setAppState({ ...appState, openSettings: false });
  };

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSettings({ ...settings, geminiApiKey: e.target.value });
  };

  const handleBaseUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newBaseUrl = e.target.value;
    const isOpenRouter = newBaseUrl.includes('openrouter.ai');
    
    // 当切换到 OpenRouter 时，自动设置默认的 Gemini 模型
    let updatedSettings = { ...settings, baseUrl: newBaseUrl };
    
    if (isOpenRouter) {
      // 使用 OpenRouter 格式的 Gemini 模型名称
      if (!settings.imageGenerationModel?.startsWith('google/')) {
        updatedSettings.imageGenerationModel = 'google/gemini-2.5-flash-image-preview';
      }
      if (!settings.promptOptimizationModel?.startsWith('google/')) {
        updatedSettings.promptOptimizationModel = 'google/gemini-2.5-flash';
      }
    } else {
      // 使用原生 Gemini 模型名称
      if (settings.imageGenerationModel?.startsWith('google/')) {
        updatedSettings.imageGenerationModel = 'gemini-2.5-flash-image-preview';
      }
      if (settings.promptOptimizationModel?.startsWith('google/')) {
        updatedSettings.promptOptimizationModel = 'gemini-2.5-flash';
      }
    }
    
    setSettings(updatedSettings);
  };

  const handleImageModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSettings({ ...settings, imageGenerationModel: e.target.value });
  };

  const handlePromptModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSettings({ ...settings, promptOptimizationModel: e.target.value });
  };

  if (!appState.openSettings) {
    return null;
  }

  return (
    <div className="settings-dialog-overlay">
      <div className="settings-dialog">
        <div className="settings-header">
          <h2>{t('settings.title')}</h2>
        </div>
        
        <div className="settings-content">
          <div className="settings-tabs">
            <div className="tab active">API 配置</div>
            <div className="tab">显示模板</div>
          </div>
          
          <div className="settings-form">
            <div className="form-group">
              <label htmlFor="gemini-api-key">Gemini-api-key</label>
              <input
                id="gemini-api-key"
                type="password"
                value={settings.geminiApiKey}
                onChange={handleApiKeyChange}
                placeholder="输入您的 Gemini API 密钥"
                className="form-input"
              />
              <div className="form-help">
                API Key将安全储存在地端浏览器中
              </div>
            </div>
            
            <div className="form-group">
              <label htmlFor="base-url">Base URL</label>
              <input
                id="base-url"
                type="text"
                value={settings.baseUrl || ''}
                onChange={handleBaseUrlChange}
                placeholder="API 接口地址"
                className="form-input"
              />
              <div className="form-help">
                自定义 API 接口地址，默认为官方地址
              </div>
            </div>
            
            <div className="form-group">
              <label htmlFor="image-model">生图模型</label>
              <div className="model-input-container">
                <select
                  id="image-model"
                  value={settings.imageGenerationModel || (settings.baseUrl?.includes('openrouter.ai') ? 'google/gemini-2.5-flash-image-preview' : 'gemini-2.5-flash-image-preview')}
                  onChange={handleImageModelChange}
                  className="form-select"
                >
                  {settings.baseUrl?.includes('openrouter.ai') ? (
                    // OpenRouter模型选项（支持Gemini模型）
                    <>
                      <option value="google/gemini-2.5-flash-image-preview">Gemini 2.5 Flash Image Preview（推荐生图）</option>
                      <option value="google/gemini-2.5-pro-image-preview">Gemini 2.5 Pro Image Preview</option>
                      <option value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet（仅文本）</option>
                      <option value="openai/gpt-4o">GPT-4o（仅文本）</option>
                      <option value="openai/gpt-4-turbo">GPT-4 Turbo（仅文本）</option>
                    </>
                  ) : (
                    // Gemini模型选项
                    <>
                      <option value="gemini-2.5-flash-image-preview">gemini-2.5-flash-image-preview（默认）</option>
                      <option value="gemini-2.5-pro-image-preview">gemini-2.5-pro-image-preview</option>
                    </>
                  )}
                </select>
                <button 
                  className="test-model-btn"
                  onClick={() => handleTestModel('image')}
                  disabled={modelStatus.imageModel === 'checking' || !settings.geminiApiKey.trim()}
                  title="检测模型可用性"
                >
                  🧪
                </button>
                {modelStatus.imageModel === 'checking' && (
                  <span className="model-status checking">🔄</span>
                )}
                {modelStatus.imageModel === 'available' && (
                  <span className="model-status available">✓</span>
                )}
                {modelStatus.imageModel === 'error' && (
                  <span className="model-status error">✗</span>
                )}
              </div>
              <div className="form-help">
                {settings.baseUrl?.includes('openrouter.ai') 
                  ? '选择用于图像生成的 OpenRouter 模型（推荐使用 Gemini 2.5 系列支持图像生成）'
                  : '选择用于图像生成的 AI 模型'
                }
              </div>
            </div>
            
            <div className="form-group">
              <label htmlFor="prompt-model">提示词优化模型</label>
              <div className="model-input-container">
                <select
                  id="prompt-model"
                  value={settings.promptOptimizationModel || (settings.baseUrl?.includes('openrouter.ai') ? 'google/gemini-2.5-flash' : 'gemini-2.5-flash')}
                  onChange={handlePromptModelChange}
                  className="form-select"
                >
                  {settings.baseUrl?.includes('openrouter.ai') ? (
                    // OpenRouter模型选项（支持Gemini模型）
                    <>
                      <option value="google/gemini-2.5-flash">Gemini 2.5 Flash（推荐）</option>
                      <option value="google/gemini-2.5-pro">Gemini 2.5 Pro</option>
                      <option value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet</option>
                      <option value="openai/gpt-4o">GPT-4o</option>
                      <option value="openai/gpt-4-turbo">GPT-4 Turbo</option>
                      <option value="meta-llama/llama-3.1-70b-instruct">Llama 3.1 70B</option>
                      <option value="meta-llama/llama-3.1-8b-instruct">Llama 3.1 8B</option>
                    </>
                  ) : (
                    // Gemini模型选项
                    <>
                      <option value="gemini-2.5-flash">gemini-2.5-flash（默认）</option>
                      <option value="gemini-2.5-pro">gemini-2.5-pro</option>
                    </>
                  )}
                </select>
                <button 
                  className="test-model-btn"
                  onClick={() => handleTestModel('prompt')}
                  disabled={modelStatus.promptModel === 'checking' || !settings.geminiApiKey.trim()}
                  title="检测模型可用性"
                >
                  🧪
                </button>
                {modelStatus.promptModel === 'checking' && (
                  <span className="model-status checking">🔄</span>
                )}
                {modelStatus.promptModel === 'available' && (
                  <span className="model-status available">✓</span>
                )}
                {modelStatus.promptModel === 'error' && (
                  <span className="model-status error">✗</span>
                )}
              </div>
              <div className="form-help">
                {settings.baseUrl?.includes('openrouter.ai') 
                  ? '选择用于提示词优化的 OpenRouter 模型'
                  : '选择用于提示词优化的 AI 模型'
                }
              </div>
            </div>
          </div>
        </div>
        
        <div className="settings-footer">
          <div className="footer-left">
            <button onClick={handleReset} className="btn btn-reset">
              重置
            </button>
          </div>
          <div className="footer-right">
            <button onClick={handleCancel} className="btn btn-cancel">
              取消
            </button>
            <button 
              onClick={handleSave} 
              className="btn btn-save"
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};