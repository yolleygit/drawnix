import { PlaitBoard, Point, PlaitElement, getSelectedElements, CoreTransforms, Transforms } from '@plait/core';
import { DrawTransforms, PlaitDrawElement, createArrowLineElement, ArrowLineShape, ArrowLineMarkerType, ArrowLineHandle } from '@plait/draw';
import { PlaceholderImage } from '../hooks/use-ai-generation-tasks';

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
 * 创建AI生成占位符图片
 * 自动匹配选中图像的尺寸
 */
export const createAIPlaceholder = (
  board: PlaitBoard,
  taskId: string,
  targetPoint?: Point,
  width?: number,
  height?: number
): PlaceholderImage => {
  // 如果没有指定尺寸，尝试从选中的图像获取尺寸
  let placeholderWidth = width || 200;
  let placeholderHeight = height || 200;
  
  if (!width || !height) {
    const selectedElements = getSelectedElements(board);
    const selectedImages = selectedElements.filter(el => 
      PlaitDrawElement.isImage && PlaitDrawElement.isImage(el)
    );
    
    if (selectedImages.length > 0) {
      // 使用最后一个选中图像的尺寸
      const lastImage = selectedImages[selectedImages.length - 1] as any;
      const imageWidth = lastImage.points[1][0] - lastImage.points[0][0];
      const imageHeight = lastImage.points[1][1] - lastImage.points[0][1];
      
      placeholderWidth = imageWidth;
      placeholderHeight = imageHeight;
      
      console.log('Placeholder: 使用选中图像尺寸', {
        originalWidth: imageWidth,
        originalHeight: imageHeight,
        aspectRatio: (imageWidth / imageHeight).toFixed(2)
      });
    }
  }
  // 创建浅蓝色占位符图片 SVG，使用动态尺寸
  const placeholderSvg = `
    <svg width="${placeholderWidth}" height="${placeholderHeight}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="dots" patternUnits="userSpaceOnUse" width="20" height="20">
          <circle cx="10" cy="10" r="2" fill="#93c5fd" opacity="0.3"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="#e0f2fe" stroke="#0ea5e9" stroke-width="2" stroke-dasharray="8,4" rx="8"/>
      <rect width="100%" height="100%" fill="url(#dots)"/>
      <g transform="translate(${placeholderWidth/2 - 40}, ${placeholderHeight/2 - 20})">
        <circle cx="40" cy="20" r="15" fill="#0ea5e9" opacity="0.2">
          <animate attributeName="opacity" values="0.2;0.6;0.2" dur="2s" repeatCount="indefinite"/>
        </circle>
        <text x="40" y="26" text-anchor="middle" fill="#0ea5e9" font-family="Arial, sans-serif" font-size="12" font-weight="bold">AI</text>
        <text x="40" y="45" text-anchor="middle" fill="#0369a1" font-family="Arial, sans-serif" font-size="8">生成中...</text>
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
 * 替换占位符为真实图片
 * @returns 新插入图像的ID，失败时返回null
 */
export const replacePlaceholderWithImage = (
  board: PlaitBoard,
  taskId: string,
  generatedImageUrl: string
): string | null => {
  console.log('Placeholder: 查找占位符', taskId);
  const placeholder = findPlaceholderByTaskId(board, taskId);
  if (!placeholder) {
    console.log('Placeholder: 未找到占位符', taskId);
    return null;
  }
  console.log('Placeholder: 找到占位符，开始替换', placeholder);

  // 获取占位符的位置和尺寸
  const position = placeholder.points[0];
  const width = placeholder.points[1][0] - placeholder.points[0][0];
  const height = placeholder.points[1][1] - placeholder.points[0][1];

  try {
    // 创建新图片项
    const imageItem = {
      url: generatedImageUrl,
      width,
      height
    };

    console.log('Placeholder: 准备插入新图片到位置:', position);
    
    // 在占位符位置插入新图片
    DrawTransforms.insertImage(board, imageItem, position);
    console.log('Placeholder: 新图片插入成功');

    // 获取刚插入的图像元素（最后一个元素）
    const newImageElement = board.children[board.children.length - 1] as any;
    const newImageId = newImageElement.id;
    console.log('Placeholder: 新图像ID:', newImageId);

    // 使用正确的Plait API安全删除占位符
    console.log('Placeholder: 开始删除占位符');
    CoreTransforms.removeElements(board, [placeholder]);
    console.log('Placeholder: 占位符删除成功');
    
    // 清理注册表
    if (placeholder.id) {
      PlaceholderRegistry.unregister(placeholder.id);
    }
    
    return newImageId;

  } catch (error) {
    console.error('Placeholder: 替换过程中出错:', error);
    
    // 如果出错，至少清理注册表
    if (placeholder.id) {
      PlaceholderRegistry.unregister(placeholder.id);
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