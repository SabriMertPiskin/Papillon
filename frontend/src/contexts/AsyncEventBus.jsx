import React, { createContext, useCallback, useRef, useState, useContext } from 'react';

/**
 * AsyncEventBus - Basit asenkron event sistemi
 * Component'ler arası task enqueueing ve event tracking
 */
const AsyncEventBusContext = createContext(null);

export function AsyncEventBusProvider({ children }) {
  const [tasks, setTasks] = useState({});
  const eventListenersRef = useRef({});
  const taskQueueRef = useRef(new Map());

  /**
   * Event listener ekle
   * Örn: listenEvent('task:complete', (data) => console.log(data))
   */
  const onEvent = useCallback((eventType, handler) => {
    if (!eventListenersRef.current[eventType]) {
      eventListenersRef.current[eventType] = [];
    }
    eventListenersRef.current[eventType].push(handler);
    
    // Cleanup function
    return () => {
      eventListenersRef.current[eventType] = 
        eventListenersRef.current[eventType].filter(h => h !== handler);
    };
  }, []);

  /**
   * Event emit et (asenkron)
   */
  const emitEvent = useCallback((eventType, data) => {
    setTimeout(() => {
      if (eventListenersRef.current[eventType]) {
        eventListenersRef.current[eventType].forEach(handler => {
          try {
            handler(data);
          } catch (err) {
            console.error(`Error in event handler for ${eventType}:`, err);
          }
        });
      }
    }, 0);
  }, []);

  /**
   * Task enqueue (asenkron iş başlat)
   * Returns taskId
   */
  const enqueueTask = useCallback((taskType, payload) => {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const taskData = {
      id: taskId,
      type: taskType,
      payload,
      status: 'pending',
      progress: 0,
      result: null,
      error: null,
      createdAt: new Date(),
      startedAt: null,
      completedAt: null
    };

    // Task'i queue'ya ekle
    taskQueueRef.current.set(taskId, taskData);
    
    // State'i güncelle
    setTasks(prev => ({
      ...prev,
      [taskId]: taskData
    }));

    // Event emit et
    emitEvent('task:enqueued', { taskId, taskType, payload });

    // Simüle et: task hemen başlasın
    setTimeout(() => {
      startTask(taskId);
    }, 100);

    return taskId;
  }, [emitEvent]);

  /**
   * Task'ı başlat (state'i "running" yap)
   */
  const startTask = useCallback((taskId) => {
    setTasks(prev => {
      if (!prev[taskId]) return prev;
      return {
        ...prev,
        [taskId]: {
          ...prev[taskId],
          status: 'running',
          startedAt: new Date()
        }
      };
    });
    emitEvent('task:started', { taskId });
  }, [emitEvent]);

  /**
   * Task'ın progress'ini güncelle (örn: %25 tamamlandı)
   */
  const updateTaskProgress = useCallback((taskId, progress) => {
    setTasks(prev => {
      if (!prev[taskId]) return prev;
      return {
        ...prev,
        [taskId]: {
          ...prev[taskId],
          progress: Math.min(progress, 100)
        }
      };
    });
    emitEvent('task:progress', { taskId, progress });
  }, [emitEvent]);

  /**
   * Task'ı tamamla
   */
  const completeTask = useCallback((taskId, result) => {
    setTasks(prev => {
      if (!prev[taskId]) return prev;
      return {
        ...prev,
        [taskId]: {
          ...prev[taskId],
          status: 'success',
          progress: 100,
          result,
          completedAt: new Date()
        }
      };
    });
    emitEvent('task:complete', { taskId, result });
  }, [emitEvent]);

  /**
   * Task'ı hata dengan kapat
   */
  const failTask = useCallback((taskId, error) => {
    setTasks(prev => {
      if (!prev[taskId]) return prev;
      return {
        ...prev,
        [taskId]: {
          ...prev[taskId],
          status: 'error',
          error: error || 'Unknown error',
          completedAt: new Date()
        }
      };
    });
    emitEvent('task:failed', { taskId, error });
  }, [emitEvent]);

  /**
   * Task'ı iptal et
   */
  const cancelTask = useCallback((taskId) => {
    setTasks(prev => {
      if (!prev[taskId]) return prev;
      return {
        ...prev,
        [taskId]: {
          ...prev[taskId],
          status: 'cancelled',
          completedAt: new Date()
        }
      };
    });
    emitEvent('task:cancelled', { taskId });
  }, [emitEvent]);

  /**
   * Task durum sorgula
   */
  const getTaskStatus = useCallback((taskId) => {
    return tasks[taskId] || null;
  }, [tasks]);

  /**
   * Tüm task'ları getir
   */
  const getAllTasks = useCallback(() => {
    return Object.values(tasks);
  }, [tasks]);

  /**
   * Task'ı sil
   */
  const removeTask = useCallback((taskId) => {
    setTasks(prev => {
      const newTasks = { ...prev };
      delete newTasks[taskId];
      return newTasks;
    });
    taskQueueRef.current.delete(taskId);
  }, []);

  const value = {
    // Event system
    onEvent,
    emitEvent,
    
    // Task management
    enqueueTask,
    startTask,
    updateTaskProgress,
    completeTask,
    failTask,
    cancelTask,
    getTaskStatus,
    getAllTasks,
    removeTask,
    
    // State
    tasks
  };

  return (
    <AsyncEventBusContext.Provider value={value}>
      {children}
    </AsyncEventBusContext.Provider>
  );
}

/**
 * useAsyncEventBus Hook - Context'e erişmek için
 */
export function useAsyncEventBus() {
  const context = useContext(AsyncEventBusContext);
  if (!context) {
    throw new Error('useAsyncEventBus must be used within AsyncEventBusProvider');
  }
  return context;
}

/**
 * useAsyncTask Hook - Basit task enqueueing ve tracking
 */
export function useAsyncTask() {
  const { enqueueTask, getTaskStatus, completeTask, failTask, updateTaskProgress, onEvent } = useAsyncEventBus();
  const [currentTask, setCurrentTask] = useState(null);

  const execute = useCallback((taskType, payload, simulationTime = 3000) => {
    const taskId = enqueueTask(taskType, payload);
    setCurrentTask(taskId);

    // Simülasyon: her 500ms'de progress güncelle
    const progressInterval = setInterval(() => {
      updateTaskProgress(taskId, Math.min((Math.random() * 50) + parseInt(getTaskStatus(taskId)?.progress || 0), 99));
    }, 500);

    // Simülasyon: belirlenen süre sonra tamamla
    setTimeout(() => {
      clearInterval(progressInterval);
      completeTask(taskId, { success: true, data: payload });
    }, simulationTime);

    return taskId;
  }, [enqueueTask, completeTask, updateTaskProgress, getTaskStatus]);

  return { execute, currentTask };
}
