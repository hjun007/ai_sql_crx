// popup.js - 弹出窗口的主要逻辑

document.addEventListener('DOMContentLoaded', () => {
  const toggleBtn = document.getElementById('toggle-btn');
  
  // 加载当前状态
  chrome.storage.local.get(['interceptEnabled'], (data) => {
    const enabled = data.interceptEnabled !== false; // 默认启用
    updateButton(enabled);
  });
  
  // 切换开关
  toggleBtn.addEventListener('click', () => {
    chrome.storage.local.get(['interceptEnabled'], (data) => {
      const currentState = data.interceptEnabled !== false;
      const newState = !currentState;
      
      chrome.storage.local.set({ interceptEnabled: newState }, () => {
        updateButton(newState);
        
        
      });
    });
  });
  
  function updateButton(enabled) {
    toggleBtn.textContent = enabled ? '禁用监听' : '启用监听';
    toggleBtn.className = enabled ? 'toggle-btn enabled' : 'toggle-btn disabled';
  }
});
