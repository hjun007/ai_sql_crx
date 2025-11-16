

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

    showMinimizedIcon();
    return;
  }else
    console.log('content.js: targetDiv not found');
} catch (error) {
  console.log('content.js: Error: ', error);
}
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "aiResp") {
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
                // 使用全局函数设置内容，支持代码块解析和复制功能
                setAIMessageContentWithCodeBlocks(aiMsg, request.result || 'AI 回复');
                // 滚动到底部
                chatHistory.scrollTop = chatHistory.scrollHeight;
              } else {
                // 如果没有找到现有消息，创建新的
                const newAiMsg = document.createElement('div');
                newAiMsg.className = 'assistant';
                // 使用全局函数设置内容
                setAIMessageContentWithCodeBlocks(newAiMsg, request.result || 'AI 回复');
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






