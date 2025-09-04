import { PlaitBoard, Point, Transforms } from '@plait/core';
import { 
  createArrowLineElement, 
  ArrowLineShape, 
  ArrowLineMarkerType,
  PlaitArrowLine,
  ArrowLineHandle 
} from '@plait/draw';

/**
 * 程序化创建箭头线工具类
 * 提供低级 API 来直接创建箭头线元素，绕过交互式绘制模式
 */
export class ProgrammaticArrowCreator {
  
  /**
   * 在画板上创建一条简单的箭头线
   * @param board Plait画板实例
   * @param startPoint 起始点坐标 [x, y]
   * @param endPoint 终点坐标 [x, y]
   * @param options 箭头选项
   * @returns 创建的箭头线元素
   */
  static createSimpleArrow(
    board: PlaitBoard,
    startPoint: Point,
    endPoint: Point,
    options: {
      shape?: ArrowLineShape;
      startMarker?: ArrowLineMarkerType;
      endMarker?: ArrowLineMarkerType;
      strokeColor?: string;
      strokeWidth?: number;
    } = {}
  ): PlaitArrowLine {
    
    const {
      shape = ArrowLineShape.straight,
      startMarker = ArrowLineMarkerType.none,
      endMarker = ArrowLineMarkerType.arrow,
      strokeColor = '#000000',
      strokeWidth = 2
    } = options;

    // 创建源和目标句柄
    const sourceHandle: ArrowLineHandle = {
      marker: startMarker
    };

    const targetHandle: ArrowLineHandle = {
      marker: endMarker
    };

    // 创建箭头线元素
    const arrowElement = createArrowLineElement(
      shape,
      [startPoint, endPoint],
      sourceHandle,
      targetHandle,
      [], // 暂时不添加文本
      {
        strokeColor,
        strokeWidth
      }
    );

    // 直接插入到画板中
    Transforms.insertNode(board, arrowElement, [board.children.length]);

    return arrowElement;
  }

  /**
   * 创建带文本的箭头线
   * @param board Plait画板实例
   * @param startPoint 起始点
   * @param endPoint 终点
   * @param text 箭头上的文本
   * @param options 箭头选项
   */
  static createArrowWithText(
    board: PlaitBoard,
    startPoint: Point,
    endPoint: Point,
    text: string,
    options: {
      shape?: ArrowLineShape;
      startMarker?: ArrowLineMarkerType;
      endMarker?: ArrowLineMarkerType;
      strokeColor?: string;
      strokeWidth?: number;
    } = {}
  ): PlaitArrowLine {
    
    const {
      shape = ArrowLineShape.straight,
      startMarker = ArrowLineMarkerType.none,
      endMarker = ArrowLineMarkerType.arrow,
      strokeColor = '#000000',
      strokeWidth = 2
    } = options;

    const sourceHandle: ArrowLineHandle = {
      marker: startMarker
    };

    const targetHandle: ArrowLineHandle = {
      marker: endMarker
    };

    // 创建文本元素（这里需要导入slate相关的文本处理）
    // TODO: 添加文本支持
    const texts: any[] = [];

    const arrowElement = createArrowLineElement(
      shape,
      [startPoint, endPoint],
      sourceHandle,
      targetHandle,
      texts,
      {
        strokeColor,
        strokeWidth
      }
    );

    Transforms.insertNode(board, arrowElement, [board.children.length]);

    return arrowElement;
  }

  /**
   * 创建弯曲箭头线
   * @param board Plait画板实例
   * @param startPoint 起始点
   * @param endPoint 终点
   * @param options 箭头选项
   */
  static createCurvedArrow(
    board: PlaitBoard,
    startPoint: Point,
    endPoint: Point,
    options: {
      startMarker?: ArrowLineMarkerType;
      endMarker?: ArrowLineMarkerType;
      strokeColor?: string;
      strokeWidth?: number;
    } = {}
  ): PlaitArrowLine {
    
    return this.createSimpleArrow(board, startPoint, endPoint, {
      ...options,
      shape: ArrowLineShape.curve
    });
  }

  /**
   * 创建肘形箭头线（直角转折）
   * @param board Plait画板实例
   * @param startPoint 起始点
   * @param endPoint 终点
   * @param options 箭头选项
   */
  static createElbowArrow(
    board: PlaitBoard,
    startPoint: Point,
    endPoint: Point,
    options: {
      startMarker?: ArrowLineMarkerType;
      endMarker?: ArrowLineMarkerType;
      strokeColor?: string;
      strokeWidth?: number;
    } = {}
  ): PlaitArrowLine {
    
    return this.createSimpleArrow(board, startPoint, endPoint, {
      ...options,
      shape: ArrowLineShape.elbow
    });
  }

  /**
   * 创建双向箭头
   * @param board Plait画板实例
   * @param startPoint 起始点
   * @param endPoint 终点
   * @param options 箭头选项
   */
  static createBidirectionalArrow(
    board: PlaitBoard,
    startPoint: Point,
    endPoint: Point,
    options: {
      shape?: ArrowLineShape;
      strokeColor?: string;
      strokeWidth?: number;
    } = {}
  ): PlaitArrowLine {
    
    return this.createSimpleArrow(board, startPoint, endPoint, {
      ...options,
      startMarker: ArrowLineMarkerType.arrow,
      endMarker: ArrowLineMarkerType.arrow
    });
  }

  /**
   * 批量创建多个箭头线
   * @param board Plait画板实例
   * @param arrows 箭头配置数组
   */
  static createMultipleArrows(
    board: PlaitBoard,
    arrows: Array<{
      startPoint: Point;
      endPoint: Point;
      options?: {
        shape?: ArrowLineShape;
        startMarker?: ArrowLineMarkerType;
        endMarker?: ArrowLineMarkerType;
        strokeColor?: string;
        strokeWidth?: number;
      };
    }>
  ): PlaitArrowLine[] {
    
    return arrows.map(({ startPoint, endPoint, options = {} }) => 
      this.createSimpleArrow(board, startPoint, endPoint, options)
    );
  }
}

/**
 * 数据结构参考和示例
 * 
 * PlaitArrowLine 接口结构:
 * {
 *   type: 'arrow-line',
 *   shape: ArrowLineShape, // straight | curve | elbow
 *   points: Point[], // 箭头的关键点坐标
 *   source: ArrowLineHandle, // 源端处理器
 *   target: ArrowLineHandle, // 目标端处理器
 *   texts: ArrowLineText[], // 箭头上的文本
 *   strokeColor?: string, // 线条颜色
 *   strokeWidth?: number, // 线条宽度
 *   strokeStyle?: StrokeStyle, // 线条样式
 *   opacity: number // 透明度
 * }
 * 
 * ArrowLineHandle 接口结构:
 * {
 *   boundId?: string, // 绑定元素的ID
 *   connection?: PointOfRectangle, // 连接点
 *   marker: ArrowLineMarkerType // 标记类型
 * }
 * 
 * ArrowLineMarkerType 枚举:
 * - arrow: 标准箭头
 * - none: 无标记
 * - openTriangle: 开放三角形
 * - solidTriangle: 实心三角形
 * - sharpArrow: 锐角箭头
 * - oneSideUp: 单边向上
 * - oneSideDown: 单边向下
 * - hollowTriangle: 空心三角形
 * - singleSlash: 单斜杠
 */

// 使用示例和测试函数
export const exampleUsage = {
  /**
   * 基本箭头创建示例
   */
  createBasicArrow: (board: PlaitBoard) => {
    return ProgrammaticArrowCreator.createSimpleArrow(
      board,
      [100, 100], // 起始点
      [200, 150], // 终点
      {
        shape: ArrowLineShape.straight,
        endMarker: ArrowLineMarkerType.arrow,
        strokeColor: '#FF0000',
        strokeWidth: 3
      }
    );
  },

  /**
   * 弯曲箭头示例
   */
  createCurveArrow: (board: PlaitBoard) => {
    return ProgrammaticArrowCreator.createCurvedArrow(
      board,
      [50, 50],
      [250, 200],
      {
        strokeColor: '#0066CC',
        strokeWidth: 2
      }
    );
  },

  /**
   * 批量创建箭头示例
   */
  createFlowchart: (board: PlaitBoard) => {
    return ProgrammaticArrowCreator.createMultipleArrows(board, [
      {
        startPoint: [100, 50],
        endPoint: [200, 50],
        options: { endMarker: ArrowLineMarkerType.arrow }
      },
      {
        startPoint: [200, 50],
        endPoint: [200, 150],
        options: { endMarker: ArrowLineMarkerType.arrow }
      },
      {
        startPoint: [200, 150],
        endPoint: [300, 150],
        options: { endMarker: ArrowLineMarkerType.arrow }
      }
    ]);
  }
};