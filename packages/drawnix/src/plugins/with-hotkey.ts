import {
  BoardTransforms,
  getSelectedElements,
  PlaitBoard,
  PlaitPointerType,
} from '@plait/core';
import { isHotkey } from 'is-hotkey';
import { addImage, saveAsImage } from '../utils/image';
import { saveAsJSON } from '../data/json';
import { DrawnixState } from '../hooks/use-drawnix';
import { BoardCreationMode, setCreationMode } from '@plait/common';
import { MindPointerType } from '@plait/mind';
import { FreehandShape } from './freehand/type';
import { ArrowLineShape, BasicShapes } from '@plait/draw';

// 根据指针类型推断创建模式
const inferCreationModeFromPointer = (pointer: string): BoardCreationMode => {
  // 需要dnd模式的工具：文本和思维导图
  if (pointer === MindPointerType.mind || pointer === BasicShapes.text) {
    return BoardCreationMode.dnd;
  }
  
  // 其他所有工具都使用drawing模式（包括基础指针）
  return BoardCreationMode.drawing;
};

export const buildDrawnixHotkeyPlugin = (
  updateAppState: (appState: Partial<DrawnixState>) => void
) => {
  // Alt键切换状态管理
  let previousPointerType: string | null = null; // 保存上Alt键切换前的模式
  let previousCreationMode: BoardCreationMode | null = null; // 保存上次的创建模式
  
  const withDrawnixHotkey = (board: PlaitBoard) => {
    const { globalKeyDown, keyDown } = board;
    const originalGlobalKeyUp = (board as any).globalKeyUp;
    board.globalKeyDown = (event: KeyboardEvent) => {
      const isTypingNormal =
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement;
        
      // 检测 Alt 键按下，实现来回切换模式
      if (!isTypingNormal && event.key === 'Alt' && event.type === 'keydown') {
        console.log('Alt键按下，开始模式切换', {
          currentPointer: board.pointer,
          previousPointer: previousPointerType
        });
        
        if (board.pointer === PlaitPointerType.hand) {
          // 当前是手型模式，切换回上一个模式
          if (previousPointerType && previousCreationMode !== null) {
            console.log('从手型切换回上一个模式:', previousPointerType);
            
            // 恢复上一个模式
            const isBasicPointer = (
              previousPointerType === PlaitPointerType.hand || 
              previousPointerType === PlaitPointerType.selection
            );
            
            if (isBasicPointer) {
              // 基础指针直接设置
              BoardTransforms.updatePointerType(board, previousPointerType);
              updateAppState({ pointer: previousPointerType as any });
            } else {
              // 非基础指针使用工具栏逻辑
              setCreationMode(board, BoardCreationMode.dnd);
              BoardTransforms.updatePointerType(board, previousPointerType);
              updateAppState({ pointer: previousPointerType as any });
              setTimeout(() => {
                setCreationMode(board, BoardCreationMode.drawing);
              }, 0);
            }
            
            // 清理上一个模式的保存
            previousPointerType = null;
            previousCreationMode = null;
          } else {
            console.log('没有上一个模式，切换到箭头模式');
            // 没有上一个模式，默认切换到箭头模式
            BoardTransforms.updatePointerType(board, PlaitPointerType.selection);
            updateAppState({ pointer: PlaitPointerType.selection });
          }
        } else {
          // 当前不是手型模式，保存当前模式并切换到手型
          console.log('从当前模式切换到手型:', board.pointer);
          
          // 保存当前模式
          previousPointerType = board.pointer;
          previousCreationMode = inferCreationModeFromPointer(board.pointer);
          
          // 切换到手型模式
          BoardTransforms.updatePointerType(board, PlaitPointerType.hand);
          updateAppState({ pointer: PlaitPointerType.hand });
        }
        
        event.preventDefault();
        return;
      }
      
      if (
        !isTypingNormal &&
        (PlaitBoard.getMovingPointInBoard(board) ||
          PlaitBoard.isMovingPointInBoard(board)) &&
        !PlaitBoard.hasBeenTextEditing(board)
      ) {
        if (isHotkey(['mod+shift+e'], { byKey: true })(event)) {
          saveAsImage(board, true);
          event.preventDefault();
          return;
        }
        if (isHotkey(['mod+s'], { byKey: true })(event)) {
          saveAsJSON(board);
          event.preventDefault();
          return;
        }
        if (
          isHotkey(['mod+backspace'])(event) ||
          isHotkey(['mod+delete'])(event)
        ) {
          updateAppState({
            openCleanConfirm: true,
          });
          event.preventDefault();
          return;
        }
        if (isHotkey(['mod+u'])(event)) {
          addImage(board);
        }
        if (!event.altKey && !event.metaKey && !event.ctrlKey) {
          if (event.key === 'h') {
            BoardTransforms.updatePointerType(board, PlaitPointerType.hand);
            updateAppState({ pointer: PlaitPointerType.hand });
          }
          if (event.key === 'v') {
            BoardTransforms.updatePointerType(
              board,
              PlaitPointerType.selection
            );
            updateAppState({ pointer: PlaitPointerType.selection });
          }
          if (event.key === 'm') {
            setCreationMode(board, BoardCreationMode.dnd);
            BoardTransforms.updatePointerType(board, MindPointerType.mind);
            updateAppState({ pointer: MindPointerType.mind });
          }
          if (event.key === 'e') {
            setCreationMode(board, BoardCreationMode.drawing);
            BoardTransforms.updatePointerType(board, FreehandShape.eraser);
            updateAppState({ pointer: FreehandShape.eraser });
          }
          if (event.key === 'p') {
            setCreationMode(board, BoardCreationMode.drawing);
            BoardTransforms.updatePointerType(board, FreehandShape.feltTipPen);
            updateAppState({ pointer: FreehandShape.feltTipPen });
          }
          if (event.key === 'a' && !isHotkey(['mod+a'])(event)) {
            // will trigger editing text
            if (getSelectedElements(board).length === 0) {
              setCreationMode(board, BoardCreationMode.drawing);
              BoardTransforms.updatePointerType(board, ArrowLineShape.straight);
              updateAppState({ pointer: ArrowLineShape.straight });
            }
          }
          if (event.key === 'r' || event.key === 'o' || event.key === 't') {
            const keyToPointer = {
              r: BasicShapes.rectangle,
              o: BasicShapes.ellipse,
              t: BasicShapes.text,
            };
            if (keyToPointer[event.key] === BasicShapes.text) {
              setCreationMode(board, BoardCreationMode.dnd);
            } else {
              setCreationMode(board, BoardCreationMode.drawing);
            }
            BoardTransforms.updatePointerType(board, keyToPointer[event.key]);
            updateAppState({ pointer: keyToPointer[event.key] });
          }
          event.preventDefault();
          return;
        }
      }
      globalKeyDown(event);
    };
    
    // 清理函数（备用）
    const cleanup = () => {
      // 未来可能需要的清理逻辑
    };
    
    // 保留原始的globalKeyUp处理器（如果存在）
    if (originalGlobalKeyUp) {
      (board as any).globalKeyUp = originalGlobalKeyUp;
    }

    board.keyDown = (event: KeyboardEvent) => {
      if (isHotkey(['mod+z'], { byKey: true })(event)) {
        board.undo();
        event.preventDefault();
        return;
      }

      if (isHotkey(['mod+shift+z'], { byKey: true })(event)) {
        board.redo();
        event.preventDefault();
        return;
      }

      keyDown(event);
    };
    
    // 在 board 对象上添加清理方法
    (board as any).cleanupAltToggle = cleanup;

    return board;
  };
  return withDrawnixHotkey;
};
