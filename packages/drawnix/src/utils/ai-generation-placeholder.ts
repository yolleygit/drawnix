import { PlaitBoard, Point, PlaitElement, getSelectedElements, CoreTransforms, Transforms } from '@plait/core';
import { DrawTransforms, PlaitDrawElement, createArrowLineElement, ArrowLineShape, ArrowLineMarkerType, ArrowLineHandle } from '@plait/draw';
import { PlaceholderImage } from '../hooks/use-ai-generation-tasks';
import { drawImageWithResize } from './image';

// 使用外部映射表来跟踪占位符，避免直接修改不可扩展的对象
const placeholderRegistry = new Map<string, string>(); // elementId -> taskId

/**
 * 注册表管理工具函数
 */
export const PlaceholderRegistry = {
  register: (elementId: string, taskId: string) => {
    placeholderRegistry.set(elementId, taskId);
  },
  unregister: (elementId: string) => {
    placeholderRegistry.delete(elementId);
  },
  getTaskId: (elementId: string) => {
    return placeholderRegistry.get(elementId);
  },
  isPlaceholder: (elementId: string) => {
    return placeholderRegistry.has(elementId);
  },
  clear: () => {
    placeholderRegistry.clear();
  }
};

/**
 * 生成占位符SVG图像
 * @param prompt 提示词
 * @param stage 当前阶段描述
 * @param progressPercent 进度百分比 (0-100)
 * @param width SVG宽度
 * @param height SVG高度
 * @returns SVG的data URL
 */
export const generatePlaceholderSVG = (
  prompt: string, 
  stage: string, 
  progressPercent: number,
  width: number = 200, 
  height: number = 200
): string => {
  // 准备显示的文本
  const displayPrompt = prompt && prompt.length > 50 ? 
    prompt.substring(0, 47) + '...' : (prompt || 'AI 图像生成');
  
  const progressWidth = Math.max(100, width * 0.6); // 进度条宽度
  const progressFill = progressWidth * (progressPercent / 100); // 进度填充宽度
  
  // 创建现代化的AI占位符SVG
  const placeholderSvg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <!-- 渐变背景 -->
        <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#f0f9ff;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#e0f2fe;stop-opacity:1" />
        </linearGradient>
        
        <!-- 进度条渐变 -->
        <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#1d4ed8;stop-opacity:1" />
        </linearGradient>
        
        <!-- 动画效果 -->
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge> 
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/> 
          </feMerge>
        </filter>
      </defs>
      
      <!-- 背景边框 -->
      <rect width="100%" height="100%" fill="url(#bgGradient)" stroke="#0ea5e9" stroke-width="2" 
            stroke-dasharray="10,5" rx="12" ry="12">
        <animate attributeName="stroke-dashoffset" values="0;15" dur="2s" repeatCount="indefinite"/>
      </rect>
      
      <!-- 中心内容区域 -->
      <g transform="translate(${width/2}, ${height/2})">
        
        <!-- AI图标 -->
        <g transform="translate(0, ${-height/4})">
          <circle cx="0" cy="0" r="20" fill="#3b82f6" opacity="0.2" filter="url(#glow)">
            <animate attributeName="opacity" values="0.2;0.4;0.2" dur="2s" repeatCount="indefinite"/>
            <animate attributeName="r" values="20;22;20" dur="2s" repeatCount="indefinite"/>
          </circle>
          <text x="0" y="6" text-anchor="middle" fill="#1e40af" font-family="Arial, sans-serif" 
                font-size="16" font-weight="bold">AI</text>
        </g>
        
        <!-- 提示词显示 -->
        <text x="0" y="${-height/8}" text-anchor="middle" fill="#374151" 
              font-family="Arial, sans-serif" font-size="${Math.min(12, width/20)}" 
              font-weight="500">${displayPrompt}</text>
        
        <!-- 进度条背景 -->
        <rect x="${-progressWidth/2}" y="${height/8}" width="${progressWidth}" height="8" 
              fill="#e5e7eb" rx="4" ry="4"/>
        
        <!-- 进度条填充 -->
        <rect x="${-progressWidth/2}" y="${height/8}" width="${progressFill}" height="8" 
              fill="url(#progressGradient)" rx="4" ry="4">
          <animate attributeName="opacity" values="0.8;1;0.8" dur="1.5s" repeatCount="indefinite"/>
        </rect>
        
        <!-- 进度百分比 -->
        <text x="0" y="${height/8 + 25}" text-anchor="middle" fill="#6b7280" 
              font-family="Arial, sans-serif" font-size="12">${progressPercent}%</text>
              
        <!-- 加载动画点 -->
        <g transform="translate(0, ${height/4})">
          <circle cx="-12" cy="0" r="2" fill="#3b82f6">
            <animate attributeName="opacity" values="0.3;1;0.3" dur="1.5s" begin="0s" repeatCount="indefinite"/>
          </circle>
          <circle cx="0" cy="0" r="2" fill="#3b82f6">
            <animate attributeName="opacity" values="0.3;1;0.3" dur="1.5s" begin="0.5s" repeatCount="indefinite"/>
          </circle>
          <circle cx="12" cy="0" r="2" fill="#3b82f6">
            <animate attributeName="opacity" values="0.3;1;0.3" dur="1.5s" begin="1s" repeatCount="indefinite"/>
          </circle>
        </g>
        
      </g>
    </svg>
  `;

  // 将SVG转换为data URL
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(placeholderSvg)))}`;
};

/**
 * 创建AI生成占位符图片
 * 自动匹配选中图像的尺寸，显示提示词和进度
 */
export const createAIPlaceholder = (
  board: PlaitBoard,
  taskId: string,
  targetPoint?: Point,
  width?: number,
  height?: number,
  prompt?: string,
  progress?: number
): PlaceholderImage => {
  // 优先使用显式传入的尺寸参数
  let placeholderWidth = 200; // 默认尺寸
  let placeholderHeight = 200; // 默认尺寸
  let sizeSource = '默认尺寸';
  
  // 第一优先级：使用显式传入的尺寸参数
  if (width && height && width > 0 && height > 0) {
    placeholderWidth = width;
    placeholderHeight = height;
    sizeSource = '显式参数';
    console.log('Placeholder: 使用显式传入的尺寸参数', {
      width: placeholderWidth,
      height: placeholderHeight,
      aspectRatio: (placeholderWidth / placeholderHeight).toFixed(2)
    });
  }
  // 第二优先级：从当前选中的图像元素获取尺寸
  else {
    const selectedElements = getSelectedElements(board);
    const selectedImages = selectedElements.filter(el => 
      PlaitDrawElement.isImage && PlaitDrawElement.isImage(el)
    );
    
    if (selectedImages.length > 0) {
      // 使用最后一个选中图像的尺寸
      const lastImage = selectedImages[selectedImages.length - 1] as any;
      const imageWidth = lastImage.points[1][0] - lastImage.points[0][0];
      const imageHeight = lastImage.points[1][1] - lastImage.points[0][1];
      
      if (imageWidth > 0 && imageHeight > 0) {
        placeholderWidth = imageWidth;
        placeholderHeight = imageHeight;
        sizeSource = '选中图像元素';
        console.log('Placeholder: 从选中图像元素获取尺寸', {
          elementId: lastImage.id,
          originalWidth: imageWidth,
          originalHeight: imageHeight,
          aspectRatio: (imageWidth / imageHeight).toFixed(2)
        });
      }
    }
  }
  
  console.log('Placeholder: 最终尺寸确定', {
    width: placeholderWidth,
    height: placeholderHeight,
    sizeSource,
    aspectRatio: (placeholderWidth / placeholderHeight).toFixed(2)
  });
  // 准备显示的文本
  const displayPrompt = prompt ? (
    prompt.length > 50 ? prompt.substring(0, 47) + '...' : prompt
  ) : 'AI 图像生成';
  
  const progressPercent = Math.round((progress || 0) * 100);
  const progressWidth = Math.max(100, placeholderWidth * 0.6); // 进度条宽度
  const progressFill = progressWidth * (progress || 0); // 进度填充宽度
  
  // 创建现代化的AI占位符SVG，显示提示词和进度
  const placeholderSvg = `
    <svg width="${placeholderWidth}" height="${placeholderHeight}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <!-- 渐变背景 -->
        <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#f0f9ff;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#e0f2fe;stop-opacity:1" />
        </linearGradient>
        
        <!-- 进度条渐变 -->
        <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#1d4ed8;stop-opacity:1" />
        </linearGradient>
        
        <!-- 动画效果 -->
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge> 
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/> 
          </feMerge>
        </filter>
      </defs>
      
      <!-- 背景边框 -->
      <rect width="100%" height="100%" fill="url(#bgGradient)" stroke="#0ea5e9" stroke-width="2" 
            stroke-dasharray="10,5" rx="12" ry="12">
        <animate attributeName="stroke-dashoffset" values="0;15" dur="2s" repeatCount="indefinite"/>
      </rect>
      
      <!-- 中心内容区域 -->
      <g transform="translate(${placeholderWidth/2}, ${placeholderHeight/2})">
        
        <!-- AI图标 -->
        <g transform="translate(0, ${-placeholderHeight/4})">
          <circle cx="0" cy="0" r="20" fill="#3b82f6" opacity="0.2" filter="url(#glow)">
            <animate attributeName="opacity" values="0.2;0.4;0.2" dur="2s" repeatCount="indefinite"/>
            <animate attributeName="r" values="20;22;20" dur="2s" repeatCount="indefinite"/>
          </circle>
          <text x="0" y="6" text-anchor="middle" fill="#1e40af" font-family="Arial, sans-serif" 
                font-size="16" font-weight="bold">AI</text>
        </g>
        
        <!-- 提示词显示 -->
        <text x="0" y="${-placeholderHeight/8}" text-anchor="middle" fill="#374151" 
              font-family="Arial, sans-serif" font-size="${Math.min(14, placeholderWidth/20)}" 
              font-weight="500">${displayPrompt}</text>
        
        <!-- 进度条背景 -->
        <rect x="${-progressWidth/2}" y="${placeholderHeight/8}" width="${progressWidth}" height="8" 
              fill="#e5e7eb" rx="4" ry="4"/>
        
        <!-- 进度条填充 -->
        <rect x="${-progressWidth/2}" y="${placeholderHeight/8}" width="${progressFill}" height="8" 
              fill="url(#progressGradient)" rx="4" ry="4">
          <animate attributeName="opacity" values="0.8;1;0.8" dur="1.5s" repeatCount="indefinite"/>
        </rect>
        
        <!-- 进度百分比 -->
        <text x="0" y="${placeholderHeight/8 + 25}" text-anchor="middle" fill="#6b7280" 
              font-family="Arial, sans-serif" font-size="12">${progressPercent}%</text>
              
        <!-- 加载动画点 -->
        <g transform="translate(0, ${placeholderHeight/4})">
          <circle cx="-12" cy="0" r="2" fill="#3b82f6">
            <animate attributeName="opacity" values="0.3;1;0.3" dur="1.5s" begin="0s" repeatCount="indefinite"/>
          </circle>
          <circle cx="0" cy="0" r="2" fill="#3b82f6">
            <animate attributeName="opacity" values="0.3;1;0.3" dur="1.5s" begin="0.5s" repeatCount="indefinite"/>
          </circle>
          <circle cx="12" cy="0" r="2" fill="#3b82f6">
            <animate attributeName="opacity" values="0.3;1;0.3" dur="1.5s" begin="1s" repeatCount="indefinite"/>
          </circle>
        </g>
        
      </g>
    </svg>
  `;

  // 将SVG转换为data URL
  const dataUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(placeholderSvg)))}`;

  // 确定插入位置
  let insertPoint: Point;
  if (targetPoint) {
    insertPoint = targetPoint;
  } else {
    // 获取选中图像的位置，在其右侧插入占位符
    const selectedElements = getSelectedElements(board);
    const selectedImages = selectedElements.filter(el => 
      PlaitDrawElement.isImage && PlaitDrawElement.isImage(el)
    );
    
    if (selectedImages.length > 0) {
      const lastImage = selectedImages[selectedImages.length - 1] as any;
      const lastImageRect = {
        x: lastImage.points[0][0],
        y: lastImage.points[0][1],
        width: lastImage.points[1][0] - lastImage.points[0][0],
        height: lastImage.points[1][1] - lastImage.points[0][1]
      };
      // 在原图右侧适当距离插入，距离缩短为150px
      insertPoint = [lastImageRect.x + lastImageRect.width + 150, lastImageRect.y];
      console.log('Placeholder: 基于选中图像位置插入', {
        lastImageRect,
        insertPoint,
        selectedImagesCount: selectedImages.length
      });
    } else {
      // 查找画布上最后一张图片的位置
      const allImages = board.children.filter(el => el.type === 'image');
      if (allImages.length > 0) {
        const lastImage = allImages[allImages.length - 1] as any;
        const lastImageRect = {
          x: lastImage.points[0][0],
          y: lastImage.points[0][1],
          width: lastImage.points[1][0] - lastImage.points[0][0],
          height: lastImage.points[1][1] - lastImage.points[0][1]
        };
        // 在最后一张图片右侧插入
        insertPoint = [lastImageRect.x + lastImageRect.width + 150, lastImageRect.y];
        console.log('Placeholder: 基于最后一张图片位置插入', {
          lastImageRect,
          insertPoint,
          allImagesCount: allImages.length
        });
      } else {
        // 默认插入到画布中心偏右
        insertPoint = [300, 200];
        console.log('Placeholder: 使用默认位置插入', insertPoint);
      }
    }
  }

  // 创建占位符图像对象，使用动态尺寸
  const imageItem = {
    url: dataUrl,
    width: placeholderWidth,
    height: placeholderHeight
  };

  // 插入占位符到画布
  DrawTransforms.insertImage(board, imageItem, insertPoint);

  // 获取刚插入的元素并在注册表中标记为占位符
  const elements = board.children;
  const placeholderElement = elements[elements.length - 1] as any;
  
  // 使用注册表记录占位符关系，避免修改不可扩展的对象
  if (placeholderElement?.id) {
    PlaceholderRegistry.register(placeholderElement.id, taskId);
  }

  return placeholderElement as PlaceholderImage;
};

/**
 * 查找指定任务的占位符
 */
export const findPlaceholderByTaskId = (
  board: PlaitBoard,
  taskId: string
): PlaceholderImage | null => {
  console.log('Placeholder: 在画布中查找占位符', { 
    taskId, 
    childrenCount: board.children.length, 
    registrySize: placeholderRegistry.size 
  });
  
  for (const element of board.children) {
    const elementTaskId = element.id ? PlaceholderRegistry.getTaskId(element.id) : null;
    console.log('Placeholder: 检查元素', { 
      elementId: element.id, 
      elementTaskId, 
      match: elementTaskId === taskId 
    });
    
    if (element.id && elementTaskId === taskId) {
      console.log('Placeholder: 找到匹配的占位符', element);
      return element as PlaceholderImage;
    }
  }
  console.log('Placeholder: 未找到匹配的占位符');
  return null;
};

/**
 * 查找指定任务的所有占位符（包括所有进度状态）
 */
export const findAllPlaceholdersByTaskId = (
  board: PlaitBoard,
  taskId: string
): PlaceholderImage[] => {
  console.log('Placeholder: 查找任务的所有占位符', { 
    taskId, 
    childrenCount: board.children.length, 
    registrySize: placeholderRegistry.size 
  });
  
  const placeholders: PlaceholderImage[] = [];
  
  for (const element of board.children) {
    const elementTaskId = element.id ? PlaceholderRegistry.getTaskId(element.id) : null;
    
    if (element.id && elementTaskId === taskId) {
      console.log('Placeholder: 找到同任务占位符', { 
        elementId: element.id, 
        taskId: elementTaskId 
      });
      placeholders.push(element as PlaceholderImage);
    }
  }
  
  console.log('Placeholder: 找到总占位符数量', placeholders.length);
  return placeholders;
};

/**
 * 替换占位符为真实图片（清理所有同任务的占位符）
 * @returns 新插入图像的ID，失败时返回null
 */
export const replacePlaceholderWithImage = async (
  board: PlaitBoard,
  taskId: string,
  generatedImageUrl: string
): Promise<string | null> => {
  console.log('Placeholder: 开始替换占位符', {
    taskId, 
    generatedImageUrl: generatedImageUrl ? '已提供' : '未提供',
    boardChildrenCount: board.children.length
  });
  
  // 查找该任务的所有占位符
  const allPlaceholders = findAllPlaceholdersByTaskId(board, taskId);
  if (allPlaceholders.length === 0) {
    console.error('Placeholder: 未找到任何占位符', {
      taskId,
      boardChildrenCount: board.children.length,
      registrySize: placeholderRegistry.size,
      allElementIds: board.children.map(el => ({ id: el.id, type: el.type }))
    });
    return null;
  }
  
  // 使用最后一个占位符的位置和尺寸（最新的进度状态）
  const placeholder = allPlaceholders[allPlaceholders.length - 1];
  
  console.log('Placeholder: 找到占位符，开始替换', {
    placeholderId: placeholder.id,
    placeholderType: placeholder.type,
    placeholderPoints: placeholder.points
  });

  // 获取占位符的位置
  const position = placeholder.points[0];
  
  try {
    // 使用drawImageWithResize函数，让它自动处理尺寸
    console.log('Placeholder: 开始加载和插入生成的图片');
    
    // 创建 Image 对象加载图片
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    const imageLoadPromise = new Promise<void>((resolve, reject) => {
      img.onload = async () => {
        try {
          console.log('Placeholder: 图片加载成功，尺寸:', {
            width: img.width,
            height: img.height,
            aspectRatio: (img.width / img.height).toFixed(2)
          });
          
          // 使用 drawImageWithResize 函数自动处理尺寸
          await drawImageWithResize(
            board, 
            img, 
            position[0], 
            position[1],
            Math.max(img.width, 400) // 保持原始尺寸或最小400px
          );
          
          console.log('Placeholder: 图片插入成功');
          resolve();
        } catch (error) {
          console.error('Placeholder: 图片插入失败:', error);
          reject(error);
        }
      };
      
      img.onerror = (error) => {
        console.error('Placeholder: 图片加载失败:', error);
        reject(new Error('图片加载失败'));
      };
      
      img.src = generatedImageUrl;
    });
    
    await imageLoadPromise;

    // 获取刚插入的图像元素（最后一个元素）
    const newImageElement = board.children[board.children.length - 1] as any;
    const newImageId = newImageElement.id;
    console.log('Placeholder: 新图像ID:', newImageId);

    // 删除所有同任务的占位符（包括所有进度状态）
    console.log('Placeholder: 开始删除所有同任务占位符', {
      taskId,
      placeholderCount: allPlaceholders.length,
      placeholderIds: allPlaceholders.map(p => p.id),
      boardChildrenBefore: board.children.length
    });
    
    let deletedCount = 0;
    const failedDeletes: string[] = [];
    
    // 逐个删除所有占位符
    for (const placeholderToDelete of allPlaceholders) {
      try {
        CoreTransforms.removeElements(board, [placeholderToDelete]);
        deletedCount++;
        console.log('Placeholder: 成功删除占位符', placeholderToDelete.id);
      } catch (removeError) {
        console.warn('Placeholder: 占位符删除失败', {
          placeholderId: placeholderToDelete.id,
          error: removeError
        });
        failedDeletes.push(placeholderToDelete.id || 'unknown');
        
        // 尝试使用备用方法删除
        try {
          const elementIndex = board.children.findIndex(child => child.id === placeholderToDelete.id);
          if (elementIndex !== -1) {
            board.children.splice(elementIndex, 1);
            deletedCount++;
            console.log('Placeholder: 使用备用方法成功删除', placeholderToDelete.id);
          }
        } catch (fallbackError) {
          console.error('Placeholder: 备用删除方法也失败', fallbackError);
        }
      }
      
      // 清理注册表
      if (placeholderToDelete.id) {
        PlaceholderRegistry.unregister(placeholderToDelete.id);
      }
    }
    
    console.log('Placeholder: 占位符删除结果', {
      totalPlaceholders: allPlaceholders.length,
      deletedCount,
      failedCount: failedDeletes.length,
      failedIds: failedDeletes,
      boardChildrenAfter: board.children.length
    });
    
    return newImageId;

  } catch (error) {
    console.error('Placeholder: 替换过程中出错:', error);
    
    // 如果出错，清理所有同任务的占位符注册
    console.log('Placeholder: 错误恢复 - 清理所有同任务占位符注册');
    for (const placeholderToClean of allPlaceholders) {
      if (placeholderToClean.id) {
        PlaceholderRegistry.unregister(placeholderToClean.id);
        console.log('Placeholder: 清理注册表', placeholderToClean.id);
      }
    }
    
    return null;
  }
};

/**
 * 创建从原图到生成图的真正绑定连接
 * 这样移动图片时，箭头会自动跟随
 */
export const createSmartArrowConnection = (
  board: PlaitBoard,
  sourceImageIds: string[],
  targetImageId: string
): void => {
  console.log('箭头连接: 开始创建绑定箭头连接', {
    sourceImageIds,
    targetImageId,
    boardChildrenCount: board.children.length
  });
  
  if (!sourceImageIds || sourceImageIds.length === 0) {
    console.log('箭头连接: 没有源图像ID，跳过');
    return;
  }
  
  if (!targetImageId) {
    console.log('箭头连接: 没有目标图像ID，跳过');
    return;
  }

  // 找到源图像和目标图像
  const sourceImages: any[] = [];
  let targetImage: any = null;

  console.log('箭头连接: 开始在画布上查找图像元素...');
  for (const element of board.children) {
    console.log('箭头连接: 检查元素', {
      elementId: element.id,
      elementType: element.type,
      isImage: PlaitDrawElement.isImage ? PlaitDrawElement.isImage(element) : 'PlaitDrawElement.isImage不存在'
    });
    
    // 检查是否为图像元素 - 使用更宽松的条件
    if (element.type === 'image' || (PlaitDrawElement.isImage && PlaitDrawElement.isImage(element))) {
      const imageEl = element as any;
      console.log('箭头连接: 找到图像元素', { imageId: imageEl.id, points: imageEl.points });
      
      if (sourceImageIds.includes(imageEl.id!)) {
        console.log('箭头连接: 找到源图像', imageEl.id);
        sourceImages.push(imageEl);
      }
      
      if (imageEl.id === targetImageId) {
        console.log('箭头连接: 找到目标图像', imageEl.id);
        targetImage = imageEl;
      }
    }
  }

  console.log('箭头连接: 图像查找结果', {
    sourceImagesFound: sourceImages.length,
    targetImageFound: !!targetImage
  });

  if (sourceImages.length === 0) {
    console.warn('箭头连接: 未找到任何源图像');
    return;
  }
  
  if (!targetImage) {
    console.warn('箭头连接: 未找到目标图像');
    return;
  }

  // 为每个源图像创建真正的绑定连接
  sourceImages.forEach((sourceImage, index) => {
    try {
      console.log(`箭头连接: 开始创建第${index + 1}个绑定连接`, {
        sourceImageId: sourceImage.id,
        targetImageId,
        sourcePoints: sourceImage.points,
        targetPoints: targetImage.points
      });
      
      // 计算源图像和目标图像的中心点
      const sourceCenter: Point = [
        (sourceImage.points[0][0] + sourceImage.points[1][0]) / 2,
        (sourceImage.points[0][1] + sourceImage.points[1][1]) / 2
      ];

      const targetCenter: Point = [
        (targetImage.points[0][0] + targetImage.points[1][0]) / 2,
        (targetImage.points[0][1] + targetImage.points[1][1]) / 2
      ];
      
      // 计算方向来确定最佳连接点
      const dx = targetCenter[0] - sourceCenter[0];
      const dy = targetCenter[1] - sourceCenter[1];
      
      // 确定源图像的连接点（相对位置）
      let sourceConnection: [number, number];
      if (Math.abs(dx) > Math.abs(dy)) {
        // 主要是水平方向
        sourceConnection = dx > 0 ? [1, 0.5] : [0, 0.5]; // 右边中心 或 左边中心
      } else {
        // 主要是垂直方向
        sourceConnection = dy > 0 ? [0.5, 1] : [0.5, 0]; // 下边中心 或 上边中心
      }
      
      // 确定目标图像的连接点（相对位置，相对于源的反方向）
      let targetConnection: [number, number];
      if (Math.abs(dx) > Math.abs(dy)) {
        // 主要是水平方向
        targetConnection = dx > 0 ? [0, 0.5] : [1, 0.5]; // 左边中心 或 右边中心
      } else {
        // 主要是垂直方向
        targetConnection = dy > 0 ? [0.5, 0] : [0.5, 1]; // 上边中心 或 下边中心
      }
      
      console.log('箭头连接: 计算的连接点', {
        sourceConnection,
        targetConnection,
        direction: { dx, dy }
      });

      // 创建真正的绑定连线元素（使用 type: 'line'）
      const connectionElement = {
        id: `connection_${Date.now()}_${index}`,
        type: 'line',
        shape: 'curve', // 使用弯曲线条
        source: {
          marker: 'none',
          connection: sourceConnection,
          boundId: sourceImage.id
        },
        target: {
          marker: 'arrow',
          connection: targetConnection,
          boundId: targetImage.id
        },
        texts: [],
        opacity: 1,
        points: [
          // 这些点会由Plait根据绑定和连接点自动计算
          sourceCenter,
          targetCenter
        ],
        strokeColor: '#0ea5e9',
        strokeWidth: 2
      };
      
      console.log('箭头连接: 创建的绑定连线元素', {
        connectionId: connectionElement.id,
        source: connectionElement.source,
        target: connectionElement.target
      });

      // 插入连线到画板中
      Transforms.insertNode(board, connectionElement, [board.children.length]);
      
      console.log('箭头连接: 绑定连线插入成功', {
        connectionId: connectionElement.id,
        sourceImageId: sourceImage.id,
        targetImageId,
        newBoardChildrenCount: board.children.length
      });

    } catch (error) {
      console.error(`箭头连接: 创建第${index + 1}个绑定连线失败`, error, {
        sourceImage,
        targetImage,
        sourceImageId: sourceImage.id,
        targetImageId
      });
    }
  });
  
  console.log('箭头连接: 完成所有绑定连线创建');
};

/**
 * 更新占位符的进度显示
 */
export const updatePlaceholderProgress = (
  board: PlaitBoard,
  taskId: string,
  progress: number,
  stage?: string
): boolean => {
  console.log('Placeholder: 更新进度', { taskId, progress, stage });
  
  // 查找所有相关占位符
  const allPlaceholders = findAllPlaceholdersByTaskId(board, taskId);
  
  if (allPlaceholders.length === 0) {
    console.log('Placeholder: 未找到对应的占位符，创建新占位符', taskId);
    // 如果没有找到占位符，创建一个新的
    const newPlaceholder = createAIPlaceholder(
      board,
      taskId,
      [100, 100], // 默认位置
      200,        // 默认宽度 
      200,        // 默认高度
      stage || 'AI 图像生成',
      Math.max(0, Math.min(1, progress))
    );
    
    if (newPlaceholder.id) {
      PlaceholderRegistry.register(newPlaceholder.id, taskId);
    }
    
    return true;
  }
  
  // 获取第一个占位符作为主要占位符
  const mainPlaceholder = allPlaceholders[0];
  
  // 如果有多个占位符，先删除多余的（保留第一个）
  if (allPlaceholders.length > 1) {
    console.log('Placeholder: 检测到重复占位符，删除多余的', {
      totalCount: allPlaceholders.length,
      keepingId: mainPlaceholder.id,
      deletingIds: allPlaceholders.slice(1).map(p => p.id)
    });
    
    const duplicates = allPlaceholders.slice(1);
    for (const duplicate of duplicates) {
      try {
        // 先从注册表清理
        if (duplicate.id) {
          PlaceholderRegistry.unregister(duplicate.id);
        }
        
        // 尝试删除元素
        const index = board.children.findIndex(child => child.id === duplicate.id);
        if (index !== -1) {
          // 使用数组重建方式删除
          const newChildren = board.children.filter((_, i) => i !== index);
          board.children.length = 0;
          board.children.push(...newChildren);
          
          console.log('Placeholder: 成功删除重复占位符', duplicate.id);
        }
      } catch (error) {
        console.warn('Placeholder: 删除重复占位符失败', duplicate.id, error);
      }
    }
  }
  
  // 更新主占位符的内容（通过直接修改其SVG URL）
  try {
    // 获取原始提示词
    let originalPrompt = stage || 'AI 图像生成';
    if (mainPlaceholder.url && mainPlaceholder.url.includes('text')) {
      // 尝试从现有SVG中解析提示词
      const match = mainPlaceholder.url.match(/<text[^>]*>([^<]+)<\/text>/);
      if (match && match[1] && !match[1].includes('%') && !match[1].includes('AI')) {
        originalPrompt = match[1];
      }
    }
    
    // 获取占位符尺寸
    const width = mainPlaceholder.points[1][0] - mainPlaceholder.points[0][0];
    const height = mainPlaceholder.points[1][1] - mainPlaceholder.points[0][1];
    
    // 生成新的SVG
    const progressPercentage = Math.round(progress * 100);
    const newSvgUrl = generatePlaceholderSVG(
      originalPrompt,
      stage || `进度 ${progressPercentage}%`,
      progressPercentage
    );
    
    // 简化占位符更新机制 - 直接跳过复杂的更新操作
    // 在占位符阶段不强制更新，只记录进度
    console.log('Placeholder: 进度更新', {
      taskId,
      placeholderId: mainPlaceholder.id,
      progress: progressPercentage + '%',
      stage,
      note: '跳过URL更新以避免只读属性错误'
    });
    
    // 直接返回true，不强制更新占位符内容
    // 占位符的最终更新将在替换阶段完成
    return true;
    
  } catch (error) {
    console.error('Placeholder: 更新占位符内容失败', error);
    return false;
  }
};

/**
 * 清理失败或过期的占位符
 */
export const cleanupPlaceholders = (board: PlaitBoard, maxAge: number = 5 * 60 * 1000): void => {
  const now = Date.now();
  const placeholdersToRemove: any[] = [];

  for (const element of board.children) {
    if (element.id && PlaceholderRegistry.isPlaceholder(element.id)) {
      const taskId = PlaceholderRegistry.getTaskId(element.id)!;
      const taskCreatedAt = parseInt(taskId.split('-')[1]);
      if (now - taskCreatedAt > maxAge) {
        placeholdersToRemove.push(element);
      }
    }
  }

  // 移除过期占位符并清理注册表
  placeholdersToRemove.forEach(placeholder => {
    const index = board.children.indexOf(placeholder);
    if (index !== -1) {
      board.children.splice(index, 1);
      if (placeholder.id) {
        PlaceholderRegistry.unregister(placeholder.id);
      }
    }
  });
};

/**
 * 手动清理所有占位符（用于故障恢复）
 */
export const clearAllPlaceholders = (board: PlaitBoard): number => {
  console.log('Placeholder: 开始手动清理所有占位符');
  
  const placeholdersToRemove: any[] = [];
  let registryCount = 0;
  
  // 查找所有占位符
  for (const element of board.children) {
    if (element.id && PlaceholderRegistry.isPlaceholder(element.id)) {
      placeholdersToRemove.push(element);
      console.log('Placeholder: 找到占位符', {
        elementId: element.id,
        taskId: PlaceholderRegistry.getTaskId(element.id)
      });
    }
  }
  
  console.log('Placeholder: 共找到', placeholdersToRemove.length, '个占位符');
  
  // 删除所有占位符
  placeholdersToRemove.forEach((placeholder, index) => {
    try {
      CoreTransforms.removeElements(board, [placeholder]);
      console.log(`Placeholder: 成功删除第${index + 1}个占位符`, placeholder.id);
    } catch (error) {
      console.warn(`Placeholder: 占位符删除失败，尝试备用方法`, placeholder.id);
      try {
        const elementIndex = board.children.findIndex(child => child.id === placeholder.id);
        if (elementIndex !== -1) {
          board.children.splice(elementIndex, 1);
          console.log(`Placeholder: 使用备用方法成功删除`, placeholder.id);
        }
      } catch (fallbackError) {
        console.error(`Placeholder: 占位符删除完全失败`, placeholder.id, fallbackError);
      }
    }
    
    // 清理注册表
    if (placeholder.id) {
      PlaceholderRegistry.unregister(placeholder.id);
      registryCount++;
    }
  });
  
  console.log('Placeholder: 清理完成', {
    删除占位符数量: placeholdersToRemove.length,
    清理注册表数量: registryCount,
    剩余画布元素: board.children.length
  });
  
  return placeholdersToRemove.length;
};

/**
 * 生成 PROHIBITED_CONTENT 错误占位符SVG图像
 * @param prompt 原始提示词
 * @param width SVG宽度
 * @param height SVG高度
 * @returns SVG的data URL
 */
export const generateProhibitedContentSVG = (
  prompt: string,
  width: number = 200,
  height: number = 200
): string => {
  // 准备显示的文本
  const displayPrompt = prompt && prompt.length > 35 ? 
    prompt.substring(0, 32) + '...' : (prompt || '生成请求');
  
  // 根据占位符大小计算合适的字体尺寸
  const iconSize = Math.max(24, Math.min(40, width * 0.12)); // 图标大小：宽度的12%，最小24px，最大40px
  const titleFontSize = Math.max(16, Math.min(24, width * 0.08)); // 标题字体：宽度的8%，最小16px，最大24px
  const promptFontSize = Math.max(14, Math.min(18, width * 0.06)); // 提示词字体：宽度的6%，最小14px，最大18px
  const suggestionFontSize = Math.max(12, Math.min(16, width * 0.05)); // 建议字体：宽度的5%，最小12px，最大16px
  const technicalFontSize = Math.max(10, Math.min(14, width * 0.04)); // 技术说明字体：宽度的4%，最小10px，最大14px
  
  // 计算垂直间距
  const verticalSpacing = Math.max(20, height * 0.08); // 垂直间距：高度的8%，最小20px
  const iconY = -height * 0.25; // 图标位置
  const titleY = iconY + iconSize + verticalSpacing * 0.6; // 标题位置
  const promptY = titleY + titleFontSize + verticalSpacing * 0.8; // 提示词位置
  const suggestionY = promptY + promptFontSize + verticalSpacing * 0.8; // 建议位置
  const technicalY = suggestionY + suggestionFontSize + verticalSpacing * 0.6; // 技术说明位置
  
  // 创建错误提示占位符SVG
  const errorSvg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <!-- 警告渐变背景 -->
        <linearGradient id="warningGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#fef7ed;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#fed7aa;stop-opacity:1" />
        </linearGradient>
        
        <!-- 图标渐变 -->
        <linearGradient id="iconGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:#f59e0b;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#d97706;stop-opacity:1" />
        </linearGradient>
        
        <!-- 阴影效果 -->
        <filter id="textShadow">
          <feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="#00000020"/>
        </filter>
      </defs>
      
      <!-- 背景边框 -->
      <rect width="100%" height="100%" fill="url(#warningGradient)" stroke="#f59e0b" stroke-width="3" 
            stroke-dasharray="12,6" rx="16" ry="16">
        <animate attributeName="stroke-dashoffset" values="0;18" dur="3s" repeatCount="indefinite"/>
      </rect>
      
      <!-- 中心内容区域 -->
      <g transform="translate(${width/2}, ${height/2})">
        
        <!-- 警告图标 -->
        <g transform="translate(0, ${iconY})">
          <circle cx="0" cy="0" r="${iconSize * 0.8}" fill="url(#iconGradient)" opacity="0.15">
            <animate attributeName="opacity" values="0.15;0.3;0.15" dur="2s" repeatCount="indefinite"/>
            <animate attributeName="r" values="${iconSize * 0.8};${iconSize * 0.9};${iconSize * 0.8}" dur="2s" repeatCount="indefinite"/>
          </circle>
          <!-- 感叹号主体 -->
          <rect x="${-iconSize * 0.08}" y="${-iconSize * 0.4}" width="${iconSize * 0.16}" height="${iconSize * 0.6}" fill="#f59e0b" rx="${iconSize * 0.08}"/>
          <!-- 感叹号底部圆点 -->
          <circle cx="0" cy="${iconSize * 0.35}" r="${iconSize * 0.12}" fill="#f59e0b"/>
        </g>
        
        <!-- 主要错误信息 -->
        <text x="0" y="${titleY}" text-anchor="middle" fill="#dc2626" 
              font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" 
              font-size="${titleFontSize}" font-weight="bold" filter="url(#textShadow)">内容被模型拒绝</text>
        
        <!-- 原始提示词 -->
        <text x="0" y="${promptY}" text-anchor="middle" fill="#6b7280" 
              font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" 
              font-size="${promptFontSize}" font-weight="500">"${displayPrompt}"</text>
        
        <!-- 解决建议 -->
        <text x="0" y="${suggestionY}" text-anchor="middle" fill="#374151" 
              font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" 
              font-size="${suggestionFontSize}" font-weight="500">请修改提示词后重试</text>
              
        <!-- 技术说明 -->
        <text x="0" y="${technicalY}" text-anchor="middle" fill="#9ca3af" 
              font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" 
              font-size="${technicalFontSize}" font-weight="normal">模型安全机制触发</text>
        
      </g>
    </svg>
  `;

  // 将SVG转换为data URL
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(errorSvg)))}`;
};

/**
 * 显示 PROHIBITED_CONTENT 错误的友好占位符
 * @param board 画板实例
 * @param taskId 任务ID
 * @param originalPrompt 原始提示词
 * @returns 错误占位符图像元素
 */
export const showProhibitedContentPlaceholder = async (
  board: PlaitBoard,
  taskId: string,
  originalPrompt: string
): Promise<PlaceholderImage | null> => {
  console.log('ProhibitedContent: 开始显示错误占位符', { taskId, originalPrompt });
  
  try {
    // 查找并替换现有的占位符
    const existingPlaceholders = findAllPlaceholdersByTaskId(board, taskId);
    
    let targetPoint: Point;
    let placeholderWidth = 300;
    let placeholderHeight = 200;
    
    if (existingPlaceholders.length > 0) {
      // 使用现有占位符的位置和尺寸
      const placeholder = existingPlaceholders[0];
      targetPoint = placeholder.points[0];
      placeholderWidth = placeholder.points[1][0] - placeholder.points[0][0];
      placeholderHeight = placeholder.points[1][1] - placeholder.points[0][1];
      
      console.log('ProhibitedContent: 使用现有占位符位置', {
        targetPoint,
        width: placeholderWidth,
        height: placeholderHeight
      });
      
      // 删除所有现有占位符
      for (const existingPlaceholder of existingPlaceholders) {
        try {
          CoreTransforms.removeElements(board, [existingPlaceholder]);
          if (existingPlaceholder.id) {
            PlaceholderRegistry.unregister(existingPlaceholder.id);
          }
        } catch (removeError) {
          console.warn('ProhibitedContent: 删除现有占位符失败', existingPlaceholder.id, removeError);
        }
      }
    } else {
      // 使用默认位置
      targetPoint = [300, 200];
      console.log('ProhibitedContent: 使用默认位置', targetPoint);
    }
    
    // 生成错误占位符SVG
    const errorSvgUrl = generateProhibitedContentSVG(
      originalPrompt,
      placeholderWidth,
      placeholderHeight
    );
    
    // 创建错误占位符图像对象
    const errorImageItem = {
      url: errorSvgUrl,
      width: placeholderWidth,
      height: placeholderHeight
    };
    
    // 插入错误占位符到画布
    DrawTransforms.insertImage(board, errorImageItem, targetPoint);
    
    // 获取刚插入的元素
    const elements = board.children;
    const errorPlaceholderElement = elements[elements.length - 1] as any;
    
    // 在注册表中标记为特殊错误占位符
    if (errorPlaceholderElement?.id) {
      PlaceholderRegistry.register(errorPlaceholderElement.id, `error_${taskId}`);
    }
    
    console.log('ProhibitedContent: 错误占位符创建成功', {
      placeholderId: errorPlaceholderElement.id,
      taskId,
      position: targetPoint,
      size: { width: placeholderWidth, height: placeholderHeight }
    });
    
    return errorPlaceholderElement as PlaceholderImage;
    
  } catch (error) {
    console.error('ProhibitedContent: 创建错误占位符失败', error);
    return null;
  }
};
