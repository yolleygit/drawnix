import { useState, useEffect } from 'react';
import { initializeData } from './initialize-data';            // 导入初始化数据
import { Drawnix } from '@drawnix/drawnix';                      // 导入核心白板组件
import { PlaitBoard, PlaitElement, PlaitTheme, Viewport } from '@plait/core';  // 导入 Plait 核心类型
import localforage from 'localforage';                          // 导入本地存储库

// 主要白板内容在 LocalForage 中的存储键名
const MAIN_BOARD_CONTENT_KEY = 'main_board_content';

// 配置 LocalForage 本地存储
localforage.config({
  name: 'Drawnix',                                            // 数据库名称
  storeName: 'drawnix_store',                                  // 存储空间名称
  driver: [localforage.INDEXEDDB, localforage.LOCALSTORAGE],  // 优先使用 IndexedDB，备选 LocalStorage
});

/**
 * 主应用组件，管理整个白板应用的状态和数据持久化
 */
export function App() {
  // 白板状态，包含元素、视口和主题信息
  const [value, setValue] = useState<{
    children: PlaitElement[];    // 白板上的所有元素（思维导图节点、绘图元素等）
    viewport?: Viewport;         // 视口信息（缩放、位置等）
    theme?: PlaitTheme;          // 主题配置
  }>({ children: [] });

  // 组件加载时从本地存储恢复数据
  useEffect(() => {
    const loadData = async () => {
      // 尝试从 LocalForage 中读取保存的白板数据
      const storedData = await localforage.getItem(MAIN_BOARD_CONTENT_KEY);
      if (storedData) {
        // 如果有保存的数据，则恢复它
        setValue(storedData as any);
        return;
      }
      // 如果没有保存的数据，则使用初始化数据
      setValue({ children: initializeData });
    };

    loadData();
  }, []);
  return (
    <Drawnix
      value={value.children}       {/* 白板上的元素 */}
      viewport={value.viewport}    {/* 视口信息 */}
      theme={value.theme}         {/* 主题配置 */}
      onChange={(value) => {
        // 当白板内容变化时，保存到 LocalForage 并更新状态
        localforage.setItem(MAIN_BOARD_CONTENT_KEY, value);
        setValue(value);
      }}
      afterInit={(board) => {
        // 白板初始化完成时的回调
        console.log('board initialized');
        /*
        console.log(
          `add __drawnix__web__debug_log to window, so you can call add log anywhere, like: window.__drawnix__web__console('some thing')`
        );
        (window as any)['__drawnix__web__console'] = (value: string) => {
          addDebugLog(board, value);
        };
        */
      }}
    ></Drawnix>
  );
}

/**
 * 添加调试日志到白板容器中
 * @param board Plait 白板实例
 * @param value 要显示的调试信息
 */
const addDebugLog = (board: PlaitBoard, value: string) => {
  // 获取白板容器元素
  const container = PlaitBoard.getBoardContainer(board).closest(
    '.drawnix'
  ) as HTMLElement;
  // 查找或创建控制台容器
  let consoleContainer = container.querySelector('.drawnix-console');
  if (!consoleContainer) {
    consoleContainer = document.createElement('div');
    consoleContainer.classList.add('drawnix-console');
    container.append(consoleContainer);
  }
  // 创建新的日志元素并添加到控制台
  const div = document.createElement('div');
  div.innerHTML = value;
  consoleContainer.append(div);
};

export default App;
