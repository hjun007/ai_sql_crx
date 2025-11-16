// 对话框相关的全局变量和函数

// 将 shadowRoot 定义为全局变量，以便在消息监听器中访问
let globalShadowRoot = null;
// 存储对话框容器和图标元素
let globalPluginContainer = null;
let globalMinimizedIcon = null;
// 图标拖拽相关变量
let iconDragging = false;
let iconDragStartX = 0;
let iconDragStartY = 0;
let iconInitialLeft = 0;
let iconInitialTop = 0;
let iconClickTime = 0;
let iconClickX = 0;
let iconClickY = 0;
let iconDragListenersAdded = false;

// 初始化图标拖拽的全局事件监听器（只添加一次）
function initIconDragListeners() {
  if (iconDragListenersAdded) return;
  iconDragListenersAdded = true;
  
  document.addEventListener('mousemove', function(e) {
    if (!iconDragging || !globalMinimizedIcon) return;
    
    const deltaX = e.clientX - iconDragStartX;
    const deltaY = e.clientY - iconDragStartY;
    
    let newLeft = iconInitialLeft + deltaX;
    let newTop = iconInitialTop + deltaY;
    
    // 限制在视窗内
    const maxLeft = window.innerWidth - globalMinimizedIcon.offsetWidth;
    const maxTop = window.innerHeight - globalMinimizedIcon.offsetHeight;
    
    newLeft = Math.max(0, Math.min(newLeft, maxLeft));
    newTop = Math.max(0, Math.min(newTop, maxTop));
    
    globalMinimizedIcon.style.left = newLeft + 'px';
    globalMinimizedIcon.style.top = newTop + 'px';
  });
  
  document.addEventListener('mouseup', function(e) {
    if (!iconDragging) return;
    
    iconDragging = false;
    
    // 判断是否为点击（移动距离小于5px且时间小于200ms）
    if (globalMinimizedIcon) {
      const moveDistance = Math.sqrt(
        Math.pow(e.clientX - iconClickX, 2) + 
        Math.pow(e.clientY - iconClickY, 2)
      );
      const clickDuration = Date.now() - iconClickTime;
      
      if (moveDistance < 5 && clickDuration < 200) {
        // 这是点击，展开对话框
        expandChatWindow();
      }
    }
  });
}

// HTML转义函数
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// HTML属性转义函数
function escapeHtmlAttribute(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// 判断文本是否看起来像SQL语句
function looksLikeSQL(text) {
  if (!text || text.trim().length === 0) return false;
  
  const trimmedText = text.trim();
  
  // 如果文本太短，不太可能是完整的SQL语句
  if (trimmedText.length < 10) return false;
  
  // SQL 关键字列表（按重要性排序）
  const sqlKeywords = [
    'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP',
    'FROM', 'WHERE', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'ON',
    'GROUP BY', 'ORDER BY', 'HAVING', 'UNION', 'DISTINCT',
    'COUNT', 'SUM', 'AVG', 'MAX', 'MIN', 'AS',
    'AND', 'OR', 'NOT', 'IN', 'LIKE', 'BETWEEN', 'IS NULL', 'IS NOT NULL',
    'LIMIT', 'OFFSET', 'TOP', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END'
  ];
  
  // 检查是否包含SQL关键字（使用单词边界匹配，避免误匹配）
  const hasSQLKeyword = sqlKeywords.some(keyword => {
    const regex = new RegExp('\\b' + keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
    return regex.test(trimmedText);
  });
  
  // 检查是否包含SQL常见的模式（以SQL命令开头）
  const hasSQLPattern = /^(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\s+/i.test(trimmedText);
  
  // 检查是否包含表名模式（如 FROM table_name 或 JOIN table_name）
  const hasTablePattern = /\bFROM\s+\w+/i.test(trimmedText) || /\bJOIN\s+\w+/i.test(trimmedText);
  
  // 如果包含SQL关键字或模式，认为是SQL
  // 主要检查：是否包含SQL关键字、是否以SQL命令开头、是否包含FROM/JOIN等表操作
  return hasSQLKeyword || hasSQLPattern || hasTablePattern;
}

// 解析文本中的代码块并转换为HTML
function parseMessageWithCodeBlocks(text) {
  if (!text) return '';
  
  // 匹配代码块：```语言类型\n代码内容\n``` 或 ```语言类型\n代码内容\n```
  // 支持可选的换行符
  const codeBlockRegex = /```(\w+)?\s*\n?([\s\S]*?)```/g;
  const parts = [];
  let lastIndex = 0;
  let match;
  let codeBlockIndex = 0;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    // 添加代码块之前的文本
    if (match.index > lastIndex) {
      const textPart = text.substring(lastIndex, match.index);
      if (textPart.trim()) {
        // 检查是否看起来像SQL
        if (looksLikeSQL(textPart)) {
          parts.push({ 
            type: 'code', 
            language: 'sql', 
            content: escapeHtml(textPart.trim()),
            rawContent: textPart.trim(),
            index: codeBlockIndex++
          });
        } else {
          parts.push({ type: 'text', content: escapeHtml(textPart) });
        }
      }
    }

    // 添加代码块
    const language = match[1] || 'text';
    const code = match[2].trim(); // 去除首尾空白
    parts.push({ 
      type: 'code', 
      language: language, 
      content: escapeHtml(code),
      rawContent: code, // 保存原始内容用于复制
      index: codeBlockIndex++
    });

    lastIndex = match.index + match[0].length;
  }

  // 添加剩余的文本
  if (lastIndex < text.length) {
    const textPart = text.substring(lastIndex);
    if (textPart.trim()) {
      // 检查是否看起来像SQL
      if (looksLikeSQL(textPart)) {
        parts.push({ 
          type: 'code', 
          language: 'sql', 
          content: escapeHtml(textPart.trim()),
          rawContent: textPart.trim(),
          index: codeBlockIndex++
        });
      } else {
        parts.push({ type: 'text', content: escapeHtml(textPart) });
      }
    }
  }

  // 如果没有匹配到代码块，检查整个文本是否像SQL
  if (parts.length === 0) {
    if (looksLikeSQL(text)) {
      parts.push({ 
        type: 'code', 
        language: 'sql', 
        content: escapeHtml(text.trim()),
        rawContent: text.trim(),
        index: codeBlockIndex++
      });
    } else {
      return escapeHtml(text);
    }
  }

  // 构建HTML
  let html = '';
  parts.forEach(part => {
    if (part.type === 'text') {
      html += `<div style="white-space: pre-wrap; word-wrap: break-word;">${part.content}</div>`;
    } else if (part.type === 'code') {
      html += `
        <div class="code-block-container">
          <div class="code-block-header">
            <span class="code-block-label">${part.language.toUpperCase()}</span>
            <button class="copy-code-btn" data-code-index="${part.index}" data-code="${escapeHtmlAttribute(part.rawContent)}">复制</button>
          </div>
          <div class="code-block-content">
            <pre>${part.content}</pre>
          </div>
        </div>
      `;
    }
  });

  return html;
}

// 设置AI消息内容并绑定复制按钮事件
function setAIMessageContentWithCodeBlocks(element, content) {
  const html = parseMessageWithCodeBlocks(content);
  element.innerHTML = html;
  
  // 为所有复制按钮绑定事件
  const copyButtons = element.querySelectorAll('.copy-code-btn');
  copyButtons.forEach(btn => {
    btn.addEventListener('click', function() {
      const code = this.getAttribute('data-code');
      if (!code) return;
      
      // 复制代码到剪贴板的函数
      const copyToClipboard = (text) => {
        // 优先使用现代 Clipboard API
        if (navigator.clipboard && navigator.clipboard.writeText) {
          return navigator.clipboard.writeText(text).then(() => true).catch(() => false);
        }
        
        // 回退到传统方法
        return new Promise((resolve) => {
          try {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.left = '-9999px';
            textarea.style.top = '-9999px';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.focus();
            textarea.select();
            
            const success = document.execCommand('copy');
            document.body.removeChild(textarea);
            resolve(success);
          } catch (err) {
            resolve(false);
          }
        });
      };
      
      // 执行复制
      copyToClipboard(code).then(success => {
        if (success) {
          // 复制成功，更新按钮状态
          const originalText = this.textContent;
          this.textContent = '已复制';
          this.classList.add('copied');
          
          setTimeout(() => {
            this.textContent = originalText;
            this.classList.remove('copied');
          }, 2000);
        } else {
          // 复制失败
          alert('复制失败，请手动复制代码');
        }
      });
    });
  });
}

// 隐藏聊天窗口的函数
function hideChatWindow() {
  console.log('content.js: hide chat window...');
  const pluginContainer = document.getElementById('chat-container');
  if (pluginContainer) {
    pluginContainer.style.display = 'none';
    globalShadowRoot = null;
    globalPluginContainer = null;
    // 如果存在图标，也移除
    if (globalMinimizedIcon) {
      globalMinimizedIcon.remove();
      globalMinimizedIcon = null;
    }
    console.log('content.js: chat window hidden');
  }
}

// 获取初始图标位置的函数
function getInitialIconPosition() {
  return {
    x: window.innerWidth - 70, // 右侧边界，留出一些边距
    y: window.innerHeight / 2 - 25 // 垂直居中
  };
}

// 缩小聊天窗口的函数
function minimizeChatWindow() {
  if (!globalPluginContainer) return;
  
  console.log('content.js: minimize chat window...');
  
  // 隐藏对话框
  globalPluginContainer.style.display = 'none';
  
  // 使用初始位置（右侧边界，垂直居中）
  const pos = getInitialIconPosition();
  const iconX = pos.x;
  const iconY = pos.y;
  
  // 创建或更新图标
  if (!globalMinimizedIcon) {
    globalMinimizedIcon = document.createElement('div');
    globalMinimizedIcon.id = 'chat-icon-minimized';
    globalMinimizedIcon.title = 'SQL智能助手';
    
    // 创建两行文字
    const line1 = document.createElement('div');
    line1.textContent = 'AI';
    line1.style.lineHeight = '1';
    line1.style.fontSize = '12px';
    
    const line2 = document.createElement('div');
    line2.textContent = 'SQL';
    line2.style.lineHeight = '1';
    line2.style.fontSize = '12px';
    
    globalMinimizedIcon.appendChild(line1);
    globalMinimizedIcon.appendChild(line2);
    
    // 直接应用样式（因为图标在主文档中，不在Shadow DOM中）
    Object.assign(globalMinimizedIcon.style, {
      position: 'fixed',
      width: '50px',
      height: '50px',
      background: '#007bff',
      borderRadius: '50%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'move',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      zIndex: '999998',
      transition: 'transform 0.2s, box-shadow 0.2s',
      color: '#fff',
      fontWeight: 'bold',
      userSelect: 'none'
    });
    
    // 添加悬停效果
    globalMinimizedIcon.addEventListener('mouseenter', function() {
      this.style.transform = 'scale(1.1)';
      this.style.boxShadow = '0 6px 16px rgba(0,0,0,0.2)';
    });
    globalMinimizedIcon.addEventListener('mouseleave', function() {
      this.style.transform = 'scale(1)';
      this.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    });
    
    // 初始化拖拽监听器（只添加一次）
    initIconDragListeners();
    
    // 图标拖拽功能（只在创建时添加一次事件监听器）
    globalMinimizedIcon.addEventListener('mousedown', function(e) {
      iconClickTime = Date.now();
      iconClickX = e.clientX;
      iconClickY = e.clientY;
      
      iconDragging = true;
      iconDragStartX = e.clientX;
      iconDragStartY = e.clientY;
      
      const rect = globalMinimizedIcon.getBoundingClientRect();
      iconInitialLeft = rect.left;
      iconInitialTop = rect.top;
      
      e.preventDefault();
    });
    
    document.body.appendChild(globalMinimizedIcon);
  }
  
  // 设置图标位置并显示
  globalMinimizedIcon.style.left = iconX + 'px';
  globalMinimizedIcon.style.top = iconY + 'px';
  globalMinimizedIcon.style.display = 'flex';
  
  console.log('content.js: chat window minimized');
}

// 展开聊天窗口的函数
function expandChatWindow() {
  if (!globalPluginContainer || !globalMinimizedIcon) return;
  
  console.log('content.js: expand chat window...');
  
  // 显示对话框
  globalPluginContainer.style.display = '';
  
  // 隐藏图标
  globalMinimizedIcon.style.display = 'none';
  
  // 如果有 contextId，恢复对话历史
  if (currentContextId && globalShadowRoot) {
    const chatHistory = globalShadowRoot.getElementById('chatHistory');
    if (chatHistory) {
      // 获取对话历史
      chrome.runtime.sendMessage({
        type: 'getConversation',
        contextId: currentContextId
      }, function(response) {
        if (response && response.status === 'SUCCESS' && response.conversation) {
          const conversation = response.conversation;
          console.log('content.js: Restoring conversation history:', conversation);
          
          // 清空当前显示
          chatHistory.innerHTML = '';
          
          // 恢复对话历史
          conversation.forEach(msg => {
            const msgDiv = document.createElement('div');
            if (msg.role === 'user') {
              msgDiv.className = 'user';
              msgDiv.textContent = msg.content;
            } else if (msg.role === 'assistant') {
              msgDiv.className = 'assistant';
              // 使用代码块解析函数来设置内容
              setAIMessageContentWithCodeBlocks(msgDiv, msg.content);
            }
            chatHistory.appendChild(msgDiv);
          });
          
          // 滚动到底部
          chatHistory.scrollTop = chatHistory.scrollHeight;
        }
      });
    }
  }
  
  console.log('content.js: chat window expanded');
}

// 只显示缩小图标的函数（默认状态）
async function showMinimizedIcon() {
  console.log('content.js: show minimized icon...');
  
  // 检查 body 是否存在
  if (!document.body) {
    console.log('content.js: document.body not ready, waiting...');
    setTimeout(showMinimizedIcon, 100);
    return;
  }
  
  // 确保对话框容器已创建（但不显示）
  if (!globalPluginContainer) {
    await showChatWindow();
    // 创建后立即隐藏
    if (globalPluginContainer) {
      globalPluginContainer.style.display = 'none';
    }
  }
  
  // 如果图标已存在，重置位置并显示
  if (globalMinimizedIcon) {
    const pos = getInitialIconPosition();
    globalMinimizedIcon.style.left = pos.x + 'px';
    globalMinimizedIcon.style.top = pos.y + 'px';
    globalMinimizedIcon.style.display = 'flex';
    return;
  }
  
  // 创建图标（位置在右侧边界）
  const pos = getInitialIconPosition();
  const iconX = pos.x;
  const iconY = pos.y;
  
  globalMinimizedIcon = document.createElement('div');
  globalMinimizedIcon.id = 'chat-icon-minimized';
  globalMinimizedIcon.title = 'SQL智能助手';
  
  // 创建两行文字
  const line1 = document.createElement('div');
  line1.textContent = 'AI';
  line1.style.lineHeight = '1';
  line1.style.fontSize = '12px';
  
  const line2 = document.createElement('div');
  line2.textContent = 'SQL';
  line2.style.lineHeight = '1';
  line2.style.fontSize = '12px';
  
  globalMinimizedIcon.appendChild(line1);
  globalMinimizedIcon.appendChild(line2);
  
  // 直接应用样式（因为图标在主文档中，不在Shadow DOM中）
  Object.assign(globalMinimizedIcon.style, {
    position: 'fixed',
    width: '50px',
    height: '50px',
    background: '#007bff',
    borderRadius: '50%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'move',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    zIndex: '999998',
    transition: 'transform 0.2s, box-shadow 0.2s',
    color: '#fff',
    fontWeight: 'bold',
    userSelect: 'none',
    left: iconX + 'px',
    top: iconY + 'px'
  });
  
  // 添加悬停效果
  globalMinimizedIcon.addEventListener('mouseenter', function() {
    this.style.transform = 'scale(1.1)';
    this.style.boxShadow = '0 6px 16px rgba(0,0,0,0.2)';
  });
  globalMinimizedIcon.addEventListener('mouseleave', function() {
    this.style.transform = 'scale(1)';
    this.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
  });
  
  // 初始化拖拽监听器（只添加一次）
  initIconDragListeners();
  
  // 图标拖拽功能
  globalMinimizedIcon.addEventListener('mousedown', function(e) {
    iconClickTime = Date.now();
    iconClickX = e.clientX;
    iconClickY = e.clientY;
    
    iconDragging = true;
    iconDragStartX = e.clientX;
    iconDragStartY = e.clientY;
    
    const rect = globalMinimizedIcon.getBoundingClientRect();
    iconInitialLeft = rect.left;
    iconInitialTop = rect.top;
    
    e.preventDefault();
  });
  
  document.body.appendChild(globalMinimizedIcon);
  console.log('content.js: minimized icon shown');
}

async function showChatWindow() {
  console.log('content.js: show chat window...');
  
  // 检查 body 是否存在
  if (!document.body) {
    console.log('content.js: document.body not ready, waiting...');
    setTimeout(showChatWindow, 100);
    return;
  }
  
  // 检查是否已经存在容器
  let pluginContainer = document.getElementById('chat-container');
  if (pluginContainer) {
    console.log('content.js: chat container already exists');
    // 如果容器存在但被隐藏，重新显示
    if (pluginContainer.style.display === 'none') {
      pluginContainer.style.display = '';
      // 如果存在图标，隐藏它
      if (globalMinimizedIcon) {
        globalMinimizedIcon.style.display = 'none';
      }
      console.log('content.js: chat container re-shown');
      
      // 恢复对话历史
      if (currentContextId && globalShadowRoot) {
        const chatHistory = globalShadowRoot.getElementById('chatHistory');
        if (chatHistory) {
          chrome.runtime.sendMessage({
            type: 'getConversation',
            contextId: currentContextId
          }, function(response) {
            if (response && response.status === 'SUCCESS' && response.conversation) {
              const conversation = response.conversation;
              console.log('content.js: Restoring conversation history:', conversation);
              
              // 清空当前显示
              chatHistory.innerHTML = '';
              
              // 恢复对话历史
              conversation.forEach(msg => {
                const msgDiv = document.createElement('div');
                if (msg.role === 'user') {
                  msgDiv.className = 'user';
                  msgDiv.textContent = msg.content;
                } else if (msg.role === 'assistant') {
                  msgDiv.className = 'assistant';
                  setAIMessageContentWithCodeBlocks(msgDiv, msg.content);
                }
                chatHistory.appendChild(msgDiv);
              });
              
              // 滚动到底部
              chatHistory.scrollTop = chatHistory.scrollHeight;
            }
          });
        }
      }
    }
    // 保存到全局变量
    globalPluginContainer = pluginContainer;
    return;
  }
  
  // 插件弹出窗口
  // 创建一个专属的容器div来承载插件UI
  pluginContainer = document.createElement('div');
  pluginContainer.id = 'chat-container';
  // 添加样式确保容器可见
  pluginContainer.style.position = 'fixed';
  pluginContainer.style.top = '20px';
  pluginContainer.style.right = '20px';
  pluginContainer.style.width = '400px';
  pluginContainer.style.zIndex = '999999';
  pluginContainer.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
  document.body.appendChild(pluginContainer);
  
  // 保存到全局变量
  globalPluginContainer = pluginContainer;

  // 为这个容器附加一个Shadow Root，开启隔离模式
  const shadowRoot = pluginContainer.attachShadow({ mode: 'open' });
  // 保存到全局变量
  globalShadowRoot = shadowRoot;

  // 加载外部 CSS 文件
  let cssContent = '';
  try {
    const cssUrl = chrome.runtime.getURL('chatWindow.css');
    const response = await fetch(cssUrl);
    cssContent = await response.text();
  } catch (error) {
    console.error('Failed to load CSS file:', error);
    // 如果加载失败，使用内联的默认样式
    cssContent = '/* CSS file not found */';
  }

  // 在Shadow DOM内部定义你的UI结构和样式
  shadowRoot.innerHTML = `
    <style>
      ${cssContent}
    </style>

    <div id="plugin-ui">
      <div id="plugin-header">
          <span>SQL智能助手</span>
          <div id="header-buttons">
              <button id="clear-chat" title="清空对话">清空</button>
              <button id="minimize-plugin" title="缩小">−</button>
          </div>
      </div>

      <!-- 对话历史显示区域 -->
      <div id="chatHistory"></div>

      <!-- 输入区域：输入框 + 发送按钮 -->
      <div id="inputArea">
          <input type="text" id="req" placeholder="请输入...">
          <button id="send">发送</button>
      </div>
    </div>
  `;

  const chatHistory = shadowRoot.getElementById('chatHistory');
  const input = shadowRoot.getElementById('req');
  const sendBtn = shadowRoot.getElementById('send');
  const clearBtn = shadowRoot.getElementById('clear-chat');
  const minimizeBtn = shadowRoot.getElementById('minimize-plugin');
  const header = shadowRoot.getElementById('plugin-header');

  // 发送消息并更新对话历史
  function sendMsg() {
      const text = input.value.trim();
      if (!text) return;
      
      // 检查是否有活动的 contextId
      if (!currentContextId) {
        alert('请先打开一个 iframe 以获取表信息');
        return;
      }

      // 添加用户消息
      const userMsg = document.createElement('div');
      userMsg.className = 'user';
      userMsg.textContent = text;
      chatHistory.appendChild(userMsg);
      console.log('content.js: userMsg added: ', userMsg);

      // 创建 AI 回复占位符
      const aiMsg = document.createElement('div');
      aiMsg.className = 'assistant';
      aiMsg.textContent = 'AI 正在思考……';
      chatHistory.appendChild(aiMsg);
      chatHistory.scrollTop = chatHistory.scrollHeight;

      // 发送消息给 background script，携带 contextId
      chrome.runtime.sendMessage({ 
        type: 'askAI', 
        question: text,
        contextId: currentContextId
      }, (response) => {
        console.log('content.js: resp received: ', response);
        // 响应处理在 onMessage 监听器中完成
      });

      input.value = '';
  }
  
  // 清空对话历史
  function clearChat() {
    if (confirm('确定要清空对话历史吗？')) {
      // 检查是否有活动的 contextId
      if (!currentContextId) {
        // 即使没有 contextId，也清空显示区域
        chatHistory.innerHTML = '';
        return;
      }
      
      // 清空显示区域
      chatHistory.innerHTML = '';
      
      // 发送清空请求给 background script，携带 contextId
      chrome.runtime.sendMessage({ 
        type: 'clearConversation',
        contextId: currentContextId
      }, (response) => {
        console.log('content.js: clearConversation response: ', response);
        if (response && response.status === 'SUCCESS') {
          console.log('content.js: conversation cleared for contextId:', currentContextId);
        }
      });
    }
  }

  sendBtn.addEventListener('click', sendMsg);
  
  // 输入框回车发送
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMsg();
    }
  });
  
  // 清空按钮功能
  clearBtn.addEventListener('click', clearChat);
  
  // 缩小按钮功能
  minimizeBtn.addEventListener('click', function() {
    minimizeChatWindow();
  });

  // 拖拽功能
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let initialLeft = 0;
  let initialTop = 0;

  header.addEventListener('mousedown', function(e) {
    // 如果点击的是按钮，不触发拖拽
    if (e.target.closest('button')) {
      return;
    }
    
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    
    // 获取当前容器的位置
    const rect = pluginContainer.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop = rect.top;
    
    // 防止文本选择
    e.preventDefault();
  });

  // 在 document 上监听鼠标移动和释放事件，确保即使鼠标移出容器也能继续拖拽
  document.addEventListener('mousemove', function(e) {
    if (!isDragging) return;
    
    const deltaX = e.clientX - dragStartX;
    const deltaY = e.clientY - dragStartY;
    
    // 计算新位置
    let newLeft = initialLeft + deltaX;
    let newTop = initialTop + deltaY;
    
    // 限制在视窗内
    const maxLeft = window.innerWidth - pluginContainer.offsetWidth;
    const maxTop = window.innerHeight - pluginContainer.offsetHeight;
    
    newLeft = Math.max(0, Math.min(newLeft, maxLeft));
    newTop = Math.max(0, Math.min(newTop, maxTop));
    
    // 更新位置
    pluginContainer.style.left = newLeft + 'px';
    pluginContainer.style.top = newTop + 'px';
    pluginContainer.style.right = 'auto'; // 清除 right 定位，改用 left
  });

  document.addEventListener('mouseup', function() {
    isDragging = false;
  });
  
  // 如果有 contextId，恢复对话历史
  if (currentContextId) {
    // 获取对话历史
    chrome.runtime.sendMessage({
      type: 'getConversation',
      contextId: currentContextId
    }, function(response) {
      if (response && response.status === 'SUCCESS' && response.conversation) {
        const conversation = response.conversation;
        console.log('content.js: Restoring conversation history in showChatWindow:', conversation);
        
        // 恢复对话历史
        conversation.forEach(msg => {
          const msgDiv = document.createElement('div');
          if (msg.role === 'user') {
            msgDiv.className = 'user';
            msgDiv.textContent = msg.content;
          } else if (msg.role === 'assistant') {
            msgDiv.className = 'assistant';
            // 使用代码块解析函数来设置内容
            setAIMessageContentWithCodeBlocks(msgDiv, msg.content);
          }
          chatHistory.appendChild(msgDiv);
        });
        
        // 滚动到底部
        chatHistory.scrollTop = chatHistory.scrollHeight;
      }
    });
  }
}

