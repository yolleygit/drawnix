# Plait 箭头线程序化创建 API 参考

基于对 Drawnix/Plait 代码库的深入分析，以下是箭头线程序化创建的完整API参考。

## 核心发现

### 1. 箭头线元素结构

**PlaitArrowLine 接口** (`@plait/draw/interfaces/arrow-line.d.ts`):

```typescript
interface PlaitArrowLine extends PlaitElement {
  type: 'arrow-line';
  shape: ArrowLineShape; // straight | curve | elbow
  points: Point[]; // 箭头的关键点坐标 [x, y][]
  source: ArrowLineHandle; // 源端句柄
  target: ArrowLineHandle; // 目标端句柄
  texts: ArrowLineText[]; // 箭头上的文本标签
  strokeColor?: string; // 线条颜色
  strokeWidth?: number; // 线条宽度
  strokeStyle?: StrokeStyle; // 线条样式
  opacity: number; // 透明度
}
```

### 2. 箭头句柄结构

**ArrowLineHandle 接口**:

```typescript
interface ArrowLineHandle {
  boundId?: string; // 绑定到的元素ID
  connection?: PointOfRectangle; // 连接点位置
  marker: ArrowLineMarkerType; // 箭头标记类型
}
```

### 3. 箭头标记类型

**ArrowLineMarkerType 枚举**:

- `arrow` - 标准箭头
- `none` - 无标记
- `openTriangle` - 开放三角形  
- `solidTriangle` - 实心三角形
- `sharpArrow` - 锐角箭头
- `oneSideUp` - 单边向上
- `oneSideDown` - 单边向下
- `hollowTriangle` - 空心三角形
- `singleSlash` - 单斜杠

### 4. 箭头形状类型

**ArrowLineShape 枚举**:

- `straight` - 直线箭头
- `curve` - 弯曲箭头
- `elbow` - 肘形箭头（直角转折）

## 核心 API

### 1. 创建箭头元素

**来源**: `@plait/draw/utils/arrow-line/arrow-line-basic.d.ts`

```typescript
import { createArrowLineElement } from '@plait/draw';

const arrowElement = createArrowLineElement(
  shape: ArrowLineShape,
  points: [Point, Point], // [起始点, 终点]
  source: ArrowLineHandle, // 源句柄
  target: ArrowLineHandle, // 目标句柄
  texts: ArrowLineText[], // 文本数组
  options?: Pick<PlaitArrowLine, "strokeColor" | "strokeWidth"> // 样式选项
): PlaitArrowLine
```

### 2. 插入到画板

**来源**: `@plait/core/transforms/node.d.ts`

```typescript
import { Transforms } from '@plait/core';

Transforms.insertNode(
  board: PlaitBoard,
  node: PlaitArrowLine, 
  path: Path // 通常使用 [board.children.length]
): void
```

### 3. 删除元素

**来源**: `@plait/core/transforms/element.d.ts`

```typescript
import { CoreTransforms } from '@plait/core';

CoreTransforms.removeElements(
  board: PlaitBoard,
  elements: PlaitElement[]
): void
```

## 实际应用示例

### 基础箭头创建

```typescript
import { PlaitBoard, Point, Transforms } from '@plait/core';
import { 
  createArrowLineElement, 
  ArrowLineShape, 
  ArrowLineMarkerType,
  ArrowLineHandle 
} from '@plait/draw';

function createSimpleArrow(board: PlaitBoard, start: Point, end: Point) {
  const sourceHandle: ArrowLineHandle = {
    marker: ArrowLineMarkerType.none
  };
  
  const targetHandle: ArrowLineHandle = {
    marker: ArrowLineMarkerType.arrow
  };
  
  const arrow = createArrowLineElement(
    ArrowLineShape.straight,
    [start, end],
    sourceHandle,
    targetHandle,
    [],
    {
      strokeColor: '#000000',
      strokeWidth: 2
    }
  );
  
  Transforms.insertNode(board, arrow, [board.children.length]);
  return arrow;
}
```

### 连接两个图像的箭头

```typescript
function createImageConnectionArrow(
  board: PlaitBoard,
  sourceImage: any,
  targetImage: any
) {
  // 计算图像中心点
  const sourceCenter: Point = [
    (sourceImage.points[0][0] + sourceImage.points[1][0]) / 2,
    (sourceImage.points[0][1] + sourceImage.points[1][1]) / 2
  ];
  
  const targetCenter: Point = [
    (targetImage.points[0][0] + targetImage.points[1][0]) / 2,
    (targetImage.points[0][1] + targetImage.points[1][1]) / 2
  ];
  
  const arrow = createArrowLineElement(
    ArrowLineShape.curve, // 弯曲箭头更美观
    [sourceCenter, targetCenter],
    { marker: ArrowLineMarkerType.none },
    { marker: ArrowLineMarkerType.arrow },
    [],
    {
      strokeColor: '#0ea5e9',
      strokeWidth: 2
    }
  );
  
  // 可选：绑定到元素
  if (sourceImage.id) arrow.source.boundId = sourceImage.id;
  if (targetImage.id) arrow.target.boundId = targetImage.id;
  
  Transforms.insertNode(board, arrow, [board.children.length]);
  return arrow;
}
```

## 发现来源

以下是在代码库中找到相关API使用的关键文件：

1. **Mermaid 转换器实现**:
   - `/node_modules/@plait-board/mermaid-to-drawnix/dist/converter/transformToDrawnixElement.js`
   - 第18行和第66行展示了 `createArrowLineElement` 的实际使用

2. **现有的程序化创建示例**:
   - `/packages/drawnix/src/plugins/freehand/with-freehand-create.ts` 第44行
   - 展示了 `Transforms.insertNode` 的使用模式

3. **AI 占位符创建**:
   - `/packages/drawnix/src/utils/ai-generation-placeholder.ts` 第251-264行
   - 已经应用了发现的API来创建智能箭头连接

## 性能考虑

- `createArrowLineElement` 是纯函数，不会直接修改画板
- `Transforms.insertNode` 会触发画板重渲染
- 批量创建时考虑使用事务或批处理机制
- 绑定元素ID可以实现自动连接点更新

## 限制和注意事项

1. **文本支持**: 箭头文本需要使用 Slate.js 元素结构
2. **连接点**: 自动连接到形状边界需要额外的几何计算  
3. **撤销/重做**: 需要确保操作符合Plait的历史管理机制
4. **性能**: 大量箭头可能影响渲染性能

## 扩展API

基于发现的核心API，已创建以下扩展工具：

- `/packages/drawnix/src/utils/programmatic-arrow-creation.ts` - 简化的箭头创建类
- `/packages/drawnix/src/utils/arrow-api-examples.ts` - 完整的示例和测试套件

这些工具提供了更高级的抽象，简化了常见的箭头创建场景。