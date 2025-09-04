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
        setSettings(JSON.parse(savedSettings));
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
    
    // 优先使用缓存模板
    const cachedTemplate = getCachedTemplate(baseUrl);
    if (cachedTemplate) {
      const url = cachedTemplate.replace('{baseUrl}', baseUrl).replace('{model}', modelName);
      try {
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
    const apiPathTemplates = [
      '{baseUrl}/models/{model}:generateContent', // Google官方格式
      '{baseUrl}/v1beta/models/{model}:generateContent', // Cloudflare Worker 示例格式（v1beta）
      '{baseUrl}/v1/models/{model}:generateContent', // v1前缀
      '{baseUrl}/{model}:generateContent', // 去掉models前缀
      '{baseUrl}/api/generate', // 通用generate端点
    ];
    
    const requestBody = JSON.stringify({
      contents: [{
        parts: [{
          text: 'test' // 简单的测试请求
        }]
      }]
    });
    
    // 依次尝试不同的API路径
    for (const template of apiPathTemplates) {
      const apiUrl = template.replace('{baseUrl}', baseUrl).replace('{model}', modelName);
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
          return await processApiResponse(response);
        }
        
      } catch (error) {
        console.log(`API路径 ${apiUrl} 请求失败:`, error);
        // 继续尝试下一个路径
      }
    }
    
    console.log('所有API路径都尝试失败');
    return false;
  };
  
  // 处理API响应的公共逻辑
  function processApiResponse(response: Response): Promise<boolean> {
    return (async () => {
      // 检查响应内容来判断具体错误
      if (response.status === 200) {
        return true; // 请求成功
      }
      
      // 对于非200状态码，检查错误详情
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        // 无法解析响应体，根据状态码判断
        return response.status !== 401 && response.status !== 403 && response.status !== 404;
      }
      
      // 分析错误信息
      const errorMessage = errorData.error?.message || '';
      
      if (response.status === 400) {
        // 400错误需要具体分析
        if (errorMessage.includes('API key not valid') || 
            errorMessage.includes('invalid API key') ||
            errorMessage.includes('Invalid API key')) {
          console.log('检测失败: API Key无效');
          return false;
        }
        if (errorMessage.includes('model') && errorMessage.includes('not found')) {
          console.log('检测失败: 模型不存在');
          return false;
        }
        // 其他400错误（如参数格式问题）可能表示模型存在但请求格式有问题
        console.log('检测通过: 模型存在但请求参数有问题（预期行为）');
        return true;
      }
      
      if (response.status === 401 || response.status === 403) {
        console.log('检测失败: 认证失败');
        return false;
      }
      
      if (response.status === 404) {
        console.log('检测失败: 模型不存在');
        return false;
      }
      
      // 其他错误状态码
      console.log('检测失败: 未知错误', response.status, errorMessage);
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

    // 设置当前模型为检测中
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
    } catch (error) {
      console.error(`${modelType} model check failed:`, error);
      setModelStatus(prev => ({
        ...prev,
        [modelType === 'image' ? 'imageModel' : 'promptModel']: 'error'
      }));
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
    setSettings({ ...settings, baseUrl: e.target.value });
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
                  value={settings.imageGenerationModel || 'gemini-2.5-flash-image-preview'}
                  onChange={handleImageModelChange}
                  className="form-select"
                >
                  <option value="gemini-2.5-flash-image-preview">gemini-2.5-flash-image-preview（默认）</option>
                  <option value="gemini-2.5-pro-image-preview">gemini-2.5-pro-image-preview</option>
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
                选择用于图像生成的 AI 模型
              </div>
            </div>
            
            <div className="form-group">
              <label htmlFor="prompt-model">提示词优化模型</label>
              <div className="model-input-container">
                <select
                  id="prompt-model"
                  value={settings.promptOptimizationModel || 'gemini-2.5-flash'}
                  onChange={handlePromptModelChange}
                  className="form-select"
                >
                  <option value="gemini-2.5-flash">gemini-2.5-flash（默认）</option>
                  <option value="gemini-2.5-pro">gemini-2.5-pro</option>
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
                选择用于提示词优化的 AI 模型
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