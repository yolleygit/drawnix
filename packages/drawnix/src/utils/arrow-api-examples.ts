import { PlaitBoard, Point, Transforms } from '@plait/core';
import { 
  createArrowLineElement, 
  ArrowLineShape, 
  ArrowLineMarkerType,
  ArrowLineHandle,
  PlaitArrowLine,
  DrawTransforms 
} from '@plait/draw';

/**
 * Plait 箭头线 API 使用示例和最佳实践
 * 
 * 这个文件展示了如何在 Drawnix 中程序化创建箭头线，
 * 基于对 @plait/draw 库的深入分析和 Mermaid-to-Drawnix 的实现参考
 */

/**
 * 基础箭头创建示例
 * 演示最简单的箭头线创建方法
 */
export function createBasicArrowExample(board: PlaitBoard): PlaitArrowLine {
  // 定义起始和结束点
  const startPoint: Point = [100, 100];
  const endPoint: Point = [200, 150];

  // 创建源句柄（起始端，无箭头标记）
  const sourceHandle: ArrowLineHandle = {
    marker: ArrowLineMarkerType.none
  };

  // 创建目标句柄（结束端，带箭头标记）
  const targetHandle: ArrowLineHandle = {
    marker: ArrowLineMarkerType.arrow
  };

  // 使用核心API创建箭头线元素
  const arrowElement = createArrowLineElement(
    ArrowLineShape.straight,  // 直线箭头
    [startPoint, endPoint],   // 点数组
    sourceHandle,             // 源句柄
    targetHandle,             // 目标句柄
    [],                       // 文本数组（暂时为空）
    {
      strokeColor: '#000000', // 黑色线条
      strokeWidth: 2          // 2px 宽度
    }
  );

  // 插入到画板中
  Transforms.insertNode(board, arrowElement, [board.children.length]);

  return arrowElement;
}

/**
 * 不同箭头形状示例
 */
export function createDifferentShapeArrows(board: PlaitBoard): PlaitArrowLine[] {
  const basePoint: Point = [50, 50];
  const offset = 150;
  const results: PlaitArrowLine[] = [];

  // 直线箭头
  const straightArrow = createArrowLineElement(
    ArrowLineShape.straight,
    [basePoint, [basePoint[0] + offset, basePoint[1]]],
    { marker: ArrowLineMarkerType.none },
    { marker: ArrowLineMarkerType.arrow },
    [],
    { strokeColor: '#FF0000', strokeWidth: 2 }
  );
  Transforms.insertNode(board, straightArrow, [board.children.length]);
  results.push(straightArrow);

  // 弯曲箭头
  const curveArrow = createArrowLineElement(
    ArrowLineShape.curve,
    [[basePoint[0], basePoint[1] + offset], [basePoint[0] + offset, basePoint[1] + offset]],
    { marker: ArrowLineMarkerType.none },
    { marker: ArrowLineMarkerType.arrow },
    [],
    { strokeColor: '#00FF00', strokeWidth: 2 }
  );
  Transforms.insertNode(board, curveArrow, [board.children.length]);
  results.push(curveArrow);

  // 肘形箭头（直角转折）
  const elbowArrow = createArrowLineElement(
    ArrowLineShape.elbow,
    [[basePoint[0], basePoint[1] + offset * 2], [basePoint[0] + offset, basePoint[1] + offset * 2]],
    { marker: ArrowLineMarkerType.none },
    { marker: ArrowLineMarkerType.arrow },
    [],
    { strokeColor: '#0000FF', strokeWidth: 2 }
  );
  Transforms.insertNode(board, elbowArrow, [board.children.length]);
  results.push(elbowArrow);

  return results;
}

/**
 * 不同箭头标记类型示例
 */
export function createDifferentMarkerArrows(board: PlaitBoard): PlaitArrowLine[] {
  const results: PlaitArrowLine[] = [];
  const startX = 300;
  const startY = 50;
  const spacing = 60;

  // 所有可用的箭头标记类型
  const markerTypes = [
    ArrowLineMarkerType.arrow,
    ArrowLineMarkerType.openTriangle,
    ArrowLineMarkerType.solidTriangle,
    ArrowLineMarkerType.sharpArrow,
    ArrowLineMarkerType.oneSideUp,
    ArrowLineMarkerType.oneSideDown,
    ArrowLineMarkerType.hollowTriangle,
    ArrowLineMarkerType.singleSlash
  ];

  markerTypes.forEach((markerType, index) => {
    const y = startY + index * spacing;
    const arrow = createArrowLineElement(
      ArrowLineShape.straight,
      [[startX, y], [startX + 100, y]],
      { marker: ArrowLineMarkerType.none },
      { marker: markerType },
      [],
      { strokeColor: '#666666', strokeWidth: 2 }
    );
    Transforms.insertNode(board, arrow, [board.children.length]);
    results.push(arrow);
  });

  return results;
}

/**
 * 双向箭头示例
 */
export function createBidirectionalArrowExample(board: PlaitBoard): PlaitArrowLine {
  const arrow = createArrowLineElement(
    ArrowLineShape.straight,
    [[500, 100], [600, 100]],
    { marker: ArrowLineMarkerType.arrow }, // 起始端也有箭头
    { marker: ArrowLineMarkerType.arrow }, // 结束端有箭头
    [],
    { strokeColor: '#800080', strokeWidth: 3 }
  );

  Transforms.insertNode(board, arrow, [board.children.length]);
  return arrow;
}

/**
 * 连接两个图像的箭头创建示例
 * 基于现有图像元素创建连接箭头
 */
export function createImageConnectionArrow(
  board: PlaitBoard,
  sourceImageElement: any,
  targetImageElement: any,
  options: {
    shape?: ArrowLineShape;
    color?: string;
    width?: number;
  } = {}
): PlaitArrowLine | null {
  
  if (!sourceImageElement || !targetImageElement) {
    console.warn('源图像或目标图像不存在');
    return null;
  }

  // 计算图像中心点
  const sourceCenter: Point = [
    (sourceImageElement.points[0][0] + sourceImageElement.points[1][0]) / 2,
    (sourceImageElement.points[0][1] + sourceImageElement.points[1][1]) / 2
  ];

  const targetCenter: Point = [
    (targetImageElement.points[0][0] + targetImageElement.points[1][0]) / 2,
    (targetImageElement.points[0][1] + targetImageElement.points[1][1]) / 2
  ];

  const {
    shape = ArrowLineShape.curve,
    color = '#0ea5e9',
    width = 2
  } = options;

  // 创建连接箭头
  const connectionArrow = createArrowLineElement(
    shape,
    [sourceCenter, targetCenter],
    { marker: ArrowLineMarkerType.none },
    { marker: ArrowLineMarkerType.arrow },
    [],
    {
      strokeColor: color,
      strokeWidth: width
    }
  );

  // 可选：绑定到源和目标元素
  if (sourceImageElement.id) {
    connectionArrow.source.boundId = sourceImageElement.id;
  }
  if (targetImageElement.id) {
    connectionArrow.target.boundId = targetImageElement.id;
  }

  Transforms.insertNode(board, connectionArrow, [board.children.length]);
  
  return connectionArrow;
}

/**
 * 批量创建流程图箭头
 * 演示如何创建一系列连接的箭头来构建流程图
 */
export function createFlowchartArrows(board: PlaitBoard): PlaitArrowLine[] {
  const results: PlaitArrowLine[] = [];
  
  // 流程图节点位置定义
  const nodes = [
    { x: 100, y: 300 },  // 开始
    { x: 250, y: 300 },  // 处理1
    { x: 400, y: 300 },  // 判断
    { x: 400, y: 450 },  // 处理2（向下）
    { x: 550, y: 300 },  // 结束（向右）
  ];

  // 创建连接箭头
  const connections = [
    [0, 1], // 开始 → 处理1
    [1, 2], // 处理1 → 判断
    [2, 3], // 判断 → 处理2（向下分支）
    [2, 4], // 判断 → 结束（向右分支）
    [3, 4], // 处理2 → 结束（从下方连接）
  ];

  connections.forEach(([startIdx, endIdx], index) => {
    const startNode = nodes[startIdx];
    const endNode = nodes[endIdx];
    
    // 根据连接类型选择不同的颜色
    const colors = ['#4CAF50', '#2196F3', '#FF9800', '#FF5722', '#9C27B0'];
    
    const arrow = createArrowLineElement(
      // 对于向下或复杂路径使用肘形，简单的水平连接使用直线
      (startNode.y !== endNode.y && Math.abs(startNode.x - endNode.x) > 50) 
        ? ArrowLineShape.elbow 
        : ArrowLineShape.straight,
      [[startNode.x, startNode.y], [endNode.x, endNode.y]],
      { marker: ArrowLineMarkerType.none },
      { marker: ArrowLineMarkerType.arrow },
      [],
      {
        strokeColor: colors[index % colors.length],
        strokeWidth: 2
      }
    );

    Transforms.insertNode(board, arrow, [board.children.length]);
    results.push(arrow);
  });

  return results;
}

/**
 * 高级箭头创建：带绑定和连接点
 * 演示如何创建绑定到特定元素的箭头
 */
export function createBoundArrowExample(
  board: PlaitBoard,
  sourceElement: any,
  targetElement: any
): PlaitArrowLine | null {
  
  if (!sourceElement || !targetElement) {
    return null;
  }

  // 计算连接点（使用边缘而非中心）
  const sourceRect = {
    x: sourceElement.points[0][0],
    y: sourceElement.points[0][1],
    width: sourceElement.points[1][0] - sourceElement.points[0][0],
    height: sourceElement.points[1][1] - sourceElement.points[0][1]
  };

  const targetRect = {
    x: targetElement.points[0][0],
    y: targetElement.points[0][1],
    width: targetElement.points[1][0] - targetElement.points[0][0],
    height: targetElement.points[1][1] - targetElement.points[0][1]
  };

  // 右边缘到左边缘的连接
  const sourcePoint: Point = [sourceRect.x + sourceRect.width, sourceRect.y + sourceRect.height / 2];
  const targetPoint: Point = [targetRect.x, targetRect.y + targetRect.height / 2];

  const boundArrow = createArrowLineElement(
    ArrowLineShape.straight,
    [sourcePoint, targetPoint],
    { 
      marker: ArrowLineMarkerType.none,
      boundId: sourceElement.id // 绑定到源元素
    },
    { 
      marker: ArrowLineMarkerType.arrow,
      boundId: targetElement.id // 绑定到目标元素
    },
    [],
    {
      strokeColor: '#E91E63',
      strokeWidth: 2
    }
  );

  Transforms.insertNode(board, boundArrow, [board.children.length]);
  
  return boundArrow;
}

/**
 * 调试和验证工具
 */
export const ArrowAPIUtils = {
  /**
   * 验证箭头元素的结构
   */
  validateArrowElement(element: PlaitArrowLine): boolean {
    const required = [
      element.type === 'arrow-line',
      element.shape !== undefined,
      Array.isArray(element.points) && element.points.length >= 2,
      element.source && element.source.marker !== undefined,
      element.target && element.target.marker !== undefined,
      Array.isArray(element.texts)
    ];
    
    return required.every(Boolean);
  },

  /**
   * 打印箭头元素信息
   */
  logArrowInfo(element: PlaitArrowLine): void {
    console.log('箭头元素信息:', {
      id: element.id,
      type: element.type,
      shape: element.shape,
      points: element.points,
      source: element.source,
      target: element.target,
      style: {
        strokeColor: element.strokeColor,
        strokeWidth: element.strokeWidth,
        opacity: element.opacity
      },
      texts: element.texts.length
    });
  },

  /**
   * 获取画板中所有箭头元素
   */
  getAllArrows(board: PlaitBoard): PlaitArrowLine[] {
    return board.children.filter((element): element is PlaitArrowLine => 
      element.type === 'arrow-line'
    );
  }
};

/**
 * 导出的主要接口
 */
export const ArrowCreationAPI = {
  createBasicArrow: createBasicArrowExample,
  createDifferentShapes: createDifferentShapeArrows,
  createDifferentMarkers: createDifferentMarkerArrows,
  createBidirectional: createBidirectionalArrowExample,
  createImageConnection: createImageConnectionArrow,
  createFlowchart: createFlowchartArrows,
  createBoundArrow: createBoundArrowExample,
  utils: ArrowAPIUtils
};