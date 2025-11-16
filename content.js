// 当前活动的上下文 ID（基于 tableInfo 内容生成的唯一标识）
let currentContextId = null;
let iframeObserver = null;

// 生成唯一标识的函数（基于 tableInfo 内容生成 Hash）
function generateContextId(tableInfoArray) {
    if (!tableInfoArray || tableInfoArray.length === 0) {
        return null;
    }
    
    // 将 tableInfo 数组转换为排序后的字符串（确保相同内容生成相同 hash）
    const content = tableInfoArray.slice().sort().join('|');
    
    // 生成简单 hash
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
        const char = content.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    
    return 'ctx_' + Math.abs(hash).toString(36);
}

// 格式化 tableInfo 为字符串
function formatTableInfo(tableInfoArray) {
    if (!tableInfoArray || tableInfoArray.length === 0) {
        return '';
    }
    
    // 这里可以根据实际需求格式化
    // 暂时返回简单的文本格式
    return tableInfoArray.join('\n');
}

// 处理 iframe 加载
function handleIframeLoad(iframe) {
    // 如果已经添加过监听器，不再重复添加
    if (iframe.dataset.listenerAdded === 'true') {
        return;
    }
    iframe.dataset.listenerAdded = 'true';
    
    const loadHandler = function() {
        console.log('content.js: Frame loaded');
        try {
            const frameDoc = iframe.contentDocument || iframe.contentWindow.document;
            const targetDiv = frameDoc.getElementById('tools-list');
            
            if (targetDiv) {
                console.log('content.js: targetDiv found: ', targetDiv);
                const listItems = targetDiv.querySelectorAll('h4');
                const tableInfo = [];
                
                listItems.forEach(h4Ele => {
                    tableInfo.push(h4Ele.textContent.trim());
                });

                console.log('content.js: tableInfo extracted: ', tableInfo);

                //在这里设置测试tableInfo的值
                var tableInfo1 = `{'表名':'person','表结构': {'pid': '人员id', 'name': '姓名', 'age': '年龄'}}`;
                var tableInfo2 = `{'表名':'shopping','表结构': {'pid': '人员id', 'goods': '物品', 'time': '购物时间', 'price': '价格'}}`;
                tableInfo.length = 0;//清空tableInfo数组
                tableInfo.push(tableInfo1);
                tableInfo.push(tableInfo2);//添加测试tableInfo
                console.log('content.js: test tableInfo set: ', tableInfo);

                if (tableInfo && tableInfo.length > 0) {
                    // 生成唯一标识
                    const contextId = generateContextId(tableInfo);
                    currentContextId = contextId;
                    
                    console.log('content.js: Generated contextId: ', contextId);
                    
                    // 格式化 tableInfo
                    const tableInfoString = formatTableInfo(tableInfo);
                    
                    // 发送给 background.js，携带 contextId
                    chrome.runtime.sendMessage({
                        type: 'tableInfo',
                        contextId: contextId,
                        tableInfo: tableInfoString
                    }, function(response) { 
                        console.log('content.js: tableInfo sent, response: ', response);
                        if (response && response.status === 'SUCCESS') {
                            showMinimizedIcon();
                        }
                    });
                } else {
                    console.log('content.js: tableInfo is empty');
                }
            } else {
                console.log('content.js: targetDiv not found');
            }
        } catch (error) {
            console.log('content.js: Error reading iframe:', error);
        }
    };
    
    iframe.addEventListener('load', loadHandler);
    
    // 如果 iframe 已经加载完成，立即触发
    if (iframe.contentDocument && iframe.contentDocument.readyState === 'complete') {
        loadHandler();
    }
}

// 处理 iframe 关闭
function handleIframeClose() {
    console.log('content.js: iframe closed');
    
    // 隐藏对话框和图标
    hideChatWindow();
    if (globalMinimizedIcon) {
        globalMinimizedIcon.style.display = 'none';
    }
    
    // 清理当前上下文
    currentContextId = null;
    
    console.log('content.js: Context cleared');
}

// 设置 iframe 监听器
function setupIframeObserver() {
    // 先检查是否已经存在 iframe
    let myFrame = document.getElementById('content-frame');
    if (myFrame && !myFrame.dataset.tracked) {
        myFrame.dataset.tracked = 'true';
        handleIframeLoad(myFrame);
    }
    
    // 使用 MutationObserver 监听 iframe 的创建和销毁
    iframeObserver = new MutationObserver(function(mutations) {
        const iframe = document.getElementById('content-frame');
        
        if (iframe) {
            // iframe 存在
            if (!iframe.dataset.tracked) {
                // 新创建的 iframe，标记并处理
                iframe.dataset.tracked = 'true';
                console.log('content.js: New iframe detected');
                handleIframeLoad(iframe);
            }
        } else {
            // iframe 不存在
            if (currentContextId) {
                // 之前有活动的 iframe，现在被移除了
                handleIframeClose();
            }
        }
    });
    
    // 开始观察
    iframeObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    console.log('content.js: Iframe observer setup complete');
}

// 初始化：等待 DOM 加载完成后设置监听器
if (document.body) {
    setupIframeObserver();
} else {
    document.addEventListener('DOMContentLoaded', setupIframeObserver);
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






