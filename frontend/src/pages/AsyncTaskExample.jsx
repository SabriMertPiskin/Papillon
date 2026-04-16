import React, { useState, useEffect } from 'react';
import { useAsyncEventBus, useAsyncTask } from '../contexts/AsyncEventBus';

/**
 * AsyncTaskExample Component
 * Async Event Bus'ı demonstrates
 */
export default function AsyncTaskExample() {
  const { enqueueTask, completeTask, failTask, updateTaskProgress, onEvent, getTaskStatus, getAllTasks } = useAsyncEventBus();
  const [activeTasks, setActiveTasks] = useState([]);
  const [logs, setLogs] = useState([]);

  const addLog = (msg) => {
    setLogs(prev => [...prev, { id: Date.now(), msg, time: new Date().toLocaleTimeString() }]);
  };

  useEffect(() => {
    // Task enqueue event listener
    const unsubscribeEnqueued = onEvent('task:enqueued', ({ taskId, taskType, payload }) => {
      addLog(`✅ Task enqueued: ${taskType} (ID: ${taskId.substring(0, 8)}...)`);
      setActiveTasks(prev => [...prev, taskId]);
    });

    // Task started event listener
    const unsubscribeStarted = onEvent('task:started', ({ taskId }) => {
      addLog(`🚀 Task started: ${taskId.substring(0, 8)}...`);
    });

    // Task progress event listener
    const unsubscribeProgress = onEvent('task:progress', ({ taskId, progress }) => {
      if (progress % 25 === 0) {
        addLog(`📊 Task progress: ${taskId.substring(0, 8)}... - ${progress}%`);
      }
    });

    // Task complete event listener
    const unsubscribeComplete = onEvent('task:complete', ({ taskId, result }) => {
      addLog(`✨ Task completed: ${taskId.substring(0, 8)}... - Result: ${JSON.stringify(result)}`);
      setActiveTasks(prev => prev.filter(id => id !== taskId));
    });

    // Task failed event listener
    const unsubscribeFailed = onEvent('task:failed', ({ taskId, error }) => {
      addLog(`❌ Task failed: ${taskId.substring(0, 8)}... - Error: ${error}`);
      setActiveTasks(prev => prev.filter(id => id !== taskId));
    });

    // Task cancelled event listener
    const unsubscribeCancelled = onEvent('task:cancelled', ({ taskId }) => {
      addLog(`⏸️ Task cancelled: ${taskId.substring(0, 8)}...`);
      setActiveTasks(prev => prev.filter(id => id !== taskId));
    });

    return () => {
      unsubscribeEnqueued();
      unsubscribeStarted();
      unsubscribeProgress();
      unsubscribeComplete();
      unsubscribeFailed();
      unsubscribeCancelled();
    };
  }, [onEvent]);

  // Task başlat
  const handleStartTask = (taskType) => {
    const payload = { 
      type: taskType, 
      timestamp: new Date().toISOString(),
      data: `Test data for ${taskType}`
    };
    const taskId = enqueueTask(taskType, payload);
    
    // Simüle et: rastgele başarı/başarısızlık
    setTimeout(() => {
      if (Math.random() > 0.2) {
        completeTask(taskId, { success: true, processed: true });
      } else {
        failTask(taskId, 'Random failure for demo');
      }
    }, 3000);
  };

  // Task'ı manuel olarak tamamla
  const handleCompleteTask = (taskId) => {
    completeTask(taskId, { success: true, manual: true });
  };

  // Task'ı iptal et
  const handleCancelTask = (taskId) => {
    setActiveTasks(prev => prev.filter(id => id !== taskId));
  };

  const allTasks = getAllTasks();

  return (
    <div style={{
      padding: '20px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      maxWidth: '1200px',
      margin: '0 auto'
    }}>
      <h1>🚀 Async Event Bus Demo</h1>
      <p style={{ color: '#666' }}>
        Bu component, frontend'de asenkron task management sistem gösterir.
        Component'ler arası event-driven iletişim için kullanılır.
      </p>

      {/* Task Enqueue Buttons */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '10px',
        marginBottom: '30px'
      }}>
        <button onClick={() => handleStartTask('scan')} style={buttonStyle}>
          🔍 Scan Task
        </button>
        <button onClick={() => handleStartTask('fetch')} style={buttonStyle}>
          📡 Fetch Task
        </button>
        <button onClick={() => handleStartTask('process')} style={buttonStyle}>
          ⚙️ Process Task
        </button>
        <button onClick={() => handleStartTask('analyze')} style={buttonStyle}>
          📊 Analyze Task
        </button>
      </div>

      {/* Active Tasks */}
      <div style={{
        background: '#f5f5f5',
        borderRadius: '8px',
        padding: '20px',
        marginBottom: '30px'
      }}>
        <h2>Active Tasks ({allTasks.filter(t => t.status === 'running' || t.status === 'pending').length})</h2>
        
        {allTasks.filter(t => t.status === 'running' || t.status === 'pending').length === 0 ? (
          <p style={{ color: '#999' }}>No active tasks</p>
        ) : (
          <div style={{ display: 'grid', gap: '10px' }}>
            {allTasks.filter(t => t.status === 'running' || t.status === 'pending').map(task => (
              <div key={task.id} style={{
                background: 'white',
                border: '1px solid #ddd',
                borderRadius: '6px',
                padding: '15px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: '5px' }}>
                    {task.type.toUpperCase()} • {task.id.substring(0, 12)}...
                  </div>
                  <div style={{
                    background: '#f0f0f0',
                    borderRadius: '4px',
                    height: '8px',
                    marginBottom: '5px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      background: '#4caf50',
                      height: '100%',
                      width: `${task.progress}%`,
                      transition: 'width 0.3s'
                    }} />
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#666' }}>
                    {task.progress}% • {task.status}
                  </div>
                </div>
                <button 
                  onClick={() => handleCompleteTask(task.id)}
                  style={{ ...buttonStyle, background: '#2196F3' }}
                >
                  Complete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Completed Tasks */}
      <div style={{
        background: '#f9f9f9',
        borderRadius: '8px',
        padding: '20px',
        marginBottom: '30px'
      }}>
        <h2>All Tasks History ({allTasks.length})</h2>
        
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '0.9rem'
        }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #ddd' }}>
              <th style={{ padding: '10px', textAlign: 'left' }}>Task ID</th>
              <th style={{ padding: '10px', textAlign: 'left' }}>Type</th>
              <th style={{ padding: '10px', textAlign: 'left' }}>Status</th>
              <th style={{ padding: '10px', textAlign: 'left' }}>Progress</th>
              <th style={{ padding: '10px', textAlign: 'left' }}>Duration</th>
            </tr>
          </thead>
          <tbody>
            {allTasks.map(task => (
              <tr key={task.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '10px', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                  {task.id.substring(0, 16)}...
                </td>
                <td style={{ padding: '10px' }}>
                  <span style={{
                    background: '#e3f2fd',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '0.85rem'
                  }}>
                    {task.type}
                  </span>
                </td>
                <td style={{ padding: '10px' }}>
                  <span style={{
                    background: getStatusColor(task.status),
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '0.85rem'
                  }}>
                    {task.status}
                  </span>
                </td>
                <td style={{ padding: '10px' }}>{task.progress}%</td>
                <td style={{ padding: '10px' }}>
                  {task.completedAt && task.startedAt
                    ? `${(task.completedAt - task.startedAt) / 1000}s`
                    : '-'
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Event Log */}
      <div style={{
        background: '#1e1e1e',
        color: '#d4d4d4',
        borderRadius: '8px',
        padding: '20px',
        fontFamily: 'monospace',
        fontSize: '0.9rem',
        maxHeight: '300px',
        overflowY: 'auto'
      }}>
        <h2 style={{ color: '#4ec9b0', marginTop: 0 }}>📝 Event Log</h2>
        {logs.length === 0 ? (
          <p style={{ color: '#666' }}>No events yet. Click a button to start a task!</p>
        ) : (
          logs.map(log => (
            <div key={log.id} style={{ marginBottom: '8px', color: '#ce9178' }}>
              <span style={{ color: '#9cdcfe' }}>[{log.time}]</span> {log.msg}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const buttonStyle = {
  padding: '10px 16px',
  background: '#4caf50',
  color: 'white',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '0.95rem',
  fontWeight: '600',
  transition: 'all 0.2s'
};

function getStatusColor(status) {
  switch (status) {
    case 'success': return '#4caf50';
    case 'pending': return '#ff9800';
    case 'running': return '#2196f3';
    case 'error': return '#f44336';
    case 'cancelled': return '#9e9e9e';
    default: return '#757575';
  }
}
