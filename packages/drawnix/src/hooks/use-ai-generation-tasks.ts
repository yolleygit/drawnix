/**
 * AI图像生成任务管理器
 * 
 * 这个Hook负责管理异步的AI图像生成任务，包括：
 * - 任务创建和状态跟踪
 * - 占位符管理
 * - 生成完成后的自动替换
 * 
 * @author Claude Code
 */

import { useState, useCallback, useRef } from 'react';
import { PlaitBoard, Point } from '@plait/core';
import { PlaitElement } from '@plait/core';

export interface AIGenerationTask {
  id: string;
  status: 'pending' | 'generating' | 'completed' | 'error';
  prompt: string;
  selectedImages: {
    url: string;
    base64: string;
    mimeType: string;
  }[];
  placeholderId?: string;
  sourceImageIds?: string[];
  generatedImageUrl?: string;
  error?: string;
  createdAt: number;
  completedAt?: number;
  // 新增进度相关字段
  progress?: number; // 0-1 之间的进度值
  progressStage?: string; // 进度阶段描述
}

export interface PlaceholderImage extends PlaitElement {
  type: 'image';
  points: [Point, Point];
  url: string;
  angle: number;
  isAIGenerationPlaceholder: boolean;
  taskId: string;
}

export const useAIGenerationTasks = () => {
  const [tasks, setTasks] = useState<AIGenerationTask[]>([]);
  const taskIdCounter = useRef(0);

  const createTask = useCallback((
    prompt: string,
    selectedImages: AIGenerationTask['selectedImages'],
    sourceImageIds: string[]
  ): AIGenerationTask => {
    const taskId = `ai-gen-${Date.now()}-${++taskIdCounter.current}`;
    const task: AIGenerationTask = {
      id: taskId,
      status: 'pending',
      prompt,
      selectedImages,
      sourceImageIds,
      createdAt: Date.now()
    };

    setTasks(prev => [...prev, task]);
    return task;
  }, []);

  const updateTaskStatus = useCallback((
    taskId: string,
    status: AIGenerationTask['status'],
    updates: Partial<Pick<AIGenerationTask, 'generatedImageUrl' | 'error' | 'placeholderId' | 'progress' | 'progressStage'>> = {}
  ) => {
    console.log('Hook: 更新任务状态', { taskId, status, updates });
    setTasks(prev => prev.map(task => 
      task.id === taskId 
        ? { 
            ...task, 
            status, 
            ...updates,
            ...(status === 'completed' && { completedAt: Date.now() })
          }
        : task
    ));
  }, []);

  const getTask = useCallback((taskId: string) => {
    return tasks.find(task => task.id === taskId);
  }, [tasks]);

  const removeTask = useCallback((taskId: string) => {
    setTasks(prev => prev.filter(task => task.id !== taskId));
  }, []);

  const getPendingTasks = useCallback(() => {
    return tasks.filter(task => task.status === 'pending');
  }, [tasks]);

  const getGeneratingTasks = useCallback(() => {
    return tasks.filter(task => task.status === 'generating');
  }, [tasks]);

  return {
    tasks,
    createTask,
    updateTaskStatus,
    getTask,
    removeTask,
    getPendingTasks,
    getGeneratingTasks
  };
};