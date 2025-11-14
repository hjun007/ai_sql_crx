

const url = window.location.href;
console.log('url: ', url);
 
var rightPage = false;
var tableInfo = [];

chrome.runtime.sendMessage({
  type: 'test'
});

var myFrame = document.getElementById('content-frame');
if(!myFrame) {
  console.log('myFrame not found');
  // 如果没有找到 iframe，隐藏弹窗
  hideChatWindow();
} else {
  myFrame.addEventListener('load', function() {
  console.log('content.js: Frame loaded');
  try {
    var frameDoc = myFrame.contentDocument || myFrame.contentWindow.document;

    // const targetDiv = frameDoc.querySelector('div.lg:col-span-2');
    const targetDiv = frameDoc.getElementById('tools-list');
    if(targetDiv) {
    console.log('content.js: targetDiv: ', targetDiv);
    const listItems = targetDiv.querySelectorAll('h4');

    listItems.forEach(h4Ele => {
      tableInfo.push(h4Ele.textContent);
    });

    console.log('content.js: tableInfo set: ', tableInfo);

    if (tableInfo) {
      console.log('content.js: tableInfo get: ', tableInfo);
      var table1 = `表名：person
        表结构：
        pid 人员id
        name 姓名
        age 年龄

        表名：shopping
        表结构：
        pid 人员id
        goods 物品
        time 购物时间
        price 价格`;
      //tableInfo = table1;
      chrome.runtime.sendMessage({
        type: 'tableInfo',
        tableInfo: table1
      }, function(response) { 
        console.log('content.js: resp received: ', response);
      });
    }else{
      console.log('content.js: tableInfo not get, page incorrect.');
    }
    rightPage = true;
    console.log('content.js: rightPage set: ', rightPage);

    showChatWindow();
    return;
  }else
    console.log('content.js: targetDiv not found');
} catch (error) {
  console.log('content.js: Error: ', error);
}
  });
}



// 将 shadowRoot 定义为全局变量，以便在消息监听器中访问
let globalShadowRoot = null;

// 隐藏聊天窗口的函数
function hideChatWindow() {
  console.log('content.js: hide chat window...');
  const pluginContainer = document.getElementById('chat-container');
  if (pluginContainer) {
    pluginContainer.style.display = 'none';
    globalShadowRoot = null;
    console.log('content.js: chat window hidden');
  }
}

function showChatWindow() {
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
      console.log('content.js: chat container re-shown');
    }
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

  // 为这个容器附加一个Shadow Root，开启隔离模式
  const shadowRoot = pluginContainer.attachShadow({ mode: 'open' });
  // 保存到全局变量
  globalShadowRoot = shadowRoot;

  // 在Shadow DOM内部定义你的UI结构和样式
  shadowRoot.innerHTML = `
    <style>
          /* 简单样式，让对话框更像聊天界面 */
          #plugin-ui {
              font-family: sans-serif;
              display: flex;
              flex-direction: column;
              height: 500px;
              width: 100%;
              border: 1px solid #ccc;
              border-radius: 8px;
              background: #fff;
              overflow: hidden;
          }
          #plugin-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 0.75rem 1rem;
              background: #007bff;
              color: #fff;
              font-weight: bold;
          }
          #header-buttons {
              display: flex;
              gap: 0.5rem;
              align-items: center;
          }
          #close-plugin, #clear-chat {
              background: transparent;
              border: none;
              color: #fff;
              font-size: 1.5rem;
              cursor: pointer;
              padding: 0;
              width: 24px;
              height: 24px;
              line-height: 1;
              display: flex;
              align-items: center;
              justify-content: center;
          }
          #clear-chat {
              font-size: 1rem;
              width: auto;
              padding: 0.25rem 0.5rem;
              border: 1px solid rgba(255,255,255,0.5);
              border-radius: 4px;
          }
          #close-plugin:hover, #clear-chat:hover {
              opacity: 0.8;
          }
          #chatHistory {
              flex: 1;
              overflow-y: auto;
              padding: 1rem;
              background: #ffffff;
              border-bottom: 1px solid #ddd;
          }
          #chatHistory div {
              margin-bottom: 0.5rem;
          }
          #chatHistory .user {
              text-align: right;
              color: #007bff;
          }
          #chatHistory .ai {
              text-align: left;
              color: #333;
          }
          #inputArea {
              display: flex;
              padding: 0.5rem;
              background: #fff;
          }
          #req {
              flex: 1;
              padding: 0.5rem;
              font-size: 1rem;
              border: 1px solid #ccc;
              border-radius: 4px;
              margin-right: 0.5rem;
          }
          #send {
              padding: 0.5rem 1rem;
              font-size: 1rem;
              border: none;
              background: #007bff;
              color: #fff;
              border-radius: 4px;
              cursor: pointer;
          }
          #send:hover {
              background: #0056b3;
          }
      </style>

      <div id="plugin-ui">
        <div id="plugin-header">
            <span>我的AI助手</span>
            <div id="header-buttons">
                <button id="clear-chat" title="清空对话">清空</button>
                <button id="close-plugin" title="关闭">×</button>
            </div>
        </div>

        <!-- 对话历史显示区域 -->
        <div id="chatHistory"></div>

        <!-- 输入区域：输入框 + 发送按钮 -->
        <div id="inputArea">
            <input type="text" id="req" placeholder="请输入需求">
            <button id="send">发送</button>
        </div>
      </div>
    `;

  const chatHistory = shadowRoot.getElementById('chatHistory');
  const input = shadowRoot.getElementById('req');
  const sendBtn = shadowRoot.getElementById('send');
  const closeBtn = shadowRoot.getElementById('close-plugin');
  const clearBtn = shadowRoot.getElementById('clear-chat');

  // 发送消息并更新对话历史
  function sendMsg() {
      const text = input.value.trim();
      if (!text) return;

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

      // 发送消息给 background script
      chrome.runtime.sendMessage({ type: 'askAI', question: text }, (response) => {
        console.log('content.js: resp received: ', response);
        // 响应处理在 onMessage 监听器中完成
      });

      input.value = '';
  }
  
  // 清空对话历史
  function clearChat() {
    if (confirm('确定要清空对话历史吗？')) {
      // 清空显示区域
      chatHistory.innerHTML = '';
      
      // 发送清空请求给 background script
      chrome.runtime.sendMessage({ type: 'clearConversation' }, (response) => {
        console.log('content.js: clearConversation response: ', response);
        if (response && response.status === 'SUCCESS') {
          console.log('content.js: conversation cleared');
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
  
  // 关闭按钮功能
  closeBtn.addEventListener('click', function() {
    pluginContainer.style.display = 'none';
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "aiResp") {
        console.log("content.js: received ai resp: ", request.result);

        if (request.status === 'SUCCESS') {
          console.log('content.js: ai resp success: ', request.result);
          // 更新AI回复框
          if (globalShadowRoot) {
            const chatHistory = globalShadowRoot.getElementById('chatHistory');
            if (chatHistory) {
              // 查找最后一个 assistant 消息（"AI 正在思考……"的占位符）
              const aiMsg = chatHistory.querySelector('.assistant:last-of-type');
              if (aiMsg) {
                console.log('content.js: aiMsg found: ', aiMsg);
                aiMsg.textContent = request.result || 'AI 回复';
                // 滚动到底部
                chatHistory.scrollTop = chatHistory.scrollHeight;
              } else {
                // 如果没有找到现有消息，创建新的
                const newAiMsg = document.createElement('div');
                newAiMsg.className = 'assistant';
                newAiMsg.textContent = request.result || 'AI 回复';
                chatHistory.appendChild(newAiMsg);
                chatHistory.scrollTop = chatHistory.scrollHeight;
              }
            }
          }
        } else if (request.status === 'ERROR') {
            // 任务失败，显示错误信息
            console.error('content.js: AI response error: ', request.error);
            if (globalShadowRoot) {
              const chatHistory = globalShadowRoot.getElementById('chatHistory');
              if (chatHistory) {
                // 查找最后一个 assistant 消息（"AI 正在思考……"的占位符）
                const aiMsg = chatHistory.querySelector('.assistant:last-of-type');
                if (aiMsg && aiMsg.textContent === 'AI 正在思考……') {
                  // 更新占位符为错误消息
                  aiMsg.textContent = '错误: ' + (request.error || '未知错误');
                  aiMsg.style.color = '#dc3545';
                } else {
                  // 如果没有找到占位符，创建新的错误消息
                  const errorMsg = document.createElement('div');
                  errorMsg.className = 'assistant';
                  errorMsg.style.color = '#dc3545';
                  errorMsg.textContent = '错误: ' + (request.error || '未知错误');
                  chatHistory.appendChild(errorMsg);
                }
                chatHistory.scrollTop = chatHistory.scrollHeight;
              }
            }
        }
    }
    // 对于其他action的消息，不做处理
    return true; // 保持消息通道开放
});






