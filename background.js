console.log('background.js executing...')

// 辅助函数：向 content script 发送消息
function sendMessageToContentScript(message, tabId) {
    if (tabId) {
        // 使用指定的 tab ID 发送消息
        chrome.tabs.sendMessage(tabId, message)
            .catch(error => {
                // 如果没有 content script 监听，忽略错误（这是正常的，如果页面刚加载）
                console.log('background.js: No content script listener (this is OK if page just loaded):', error.message);
            });
    } else {
        // 如果没有指定 tab ID，查询活动标签页
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            if (tabs && tabs.length > 0) {
                chrome.tabs.sendMessage(tabs[0].id, message)
                    .catch(error => {
                        console.log('background.js: No content script listener (this is OK if page just loaded):', error.message);
                    });
            } else {
                console.log('background.js: No active tabs found');
            }
        });
    }
}

function sendToAI(conversationHistory, table_info) {
  const token = 'sk-d2537aef97064bbfa709dc1accb6f79d';
  const url = 'https://api.deepseek.com/chat/completions';
  
  // 构建消息列表：系统消息 + 对话历史
  const messages = [
    {
        content: `你是一个数据库专家，能够根据给定的表信息和用户请求，生成SQL查询语句。\n\n表信息：\n${table_info}\n\n请按照用户的要求生成SQL查询语句，只需要输出SQL语句，不需要其他内容。`,
        role: 'system'
    }
  ];
  
  // 添加对话历史（只保留最近20轮对话，避免超出 token 限制）
  const recentHistory = conversationHistory.slice(-20);
  messages.push(...recentHistory);
  
  const data = {
    messages: messages,
    model: 'deepseek-chat',
    frequency_penalty: 0,
    max_tokens: 4096,
    presence_penalty: 0,
    response_format: {
      type: 'text'
    },
    stop: null,
    stream: false,
    stream_options: null,
    temperature: 1,
    top_p: 1,
    tools: null,
    tool_choice: 'none',
    logprobs: false,
    top_logprobs: null
  };

  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  };
  console.log('background.js: AI req sent: ', options);
  
  // 返回 Promise，正确处理异步响应
  return fetch(url, options)
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(responseData => {
      console.log('background.js: AI response received: ', responseData);
      // 提取 AI 的回复内容
      if (responseData.choices && responseData.choices.length > 0) {
        return responseData.choices[0].message.content || '';
      }
      return '';
    })
    .catch(error => {
      console.error('background.js: AI request error: ', error);
      throw error;
    });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => { 
    // 获取发送消息的 tab ID
    const tabId = sender.tab ? sender.tab.id : null;
    
    if (request.type === 'tableInfo') {
        console.log('background.js: tableInfo received, contextId: ', request.contextId);
        console.log('background.js: tabId: ', tabId);
        if (!request.contextId) {
            console.error('background.js: contextId is missing');
            sendResponse({ status: 'ERROR', error: 'contextId is required' });
            return true;
        }
        if (!tabId) {
            console.error('background.js: tabId is missing');
            sendResponse({ status: 'ERROR', error: 'tabId is required' });
            return true;
        }
        
        try {
            // 使用 tabId 和 contextId 作为 key 存储 tableInfo，防止多标签页冲突
            const tableInfoKey = `tableInfo_${tabId}_${request.contextId}`;
            chrome.storage.local.set({ [tableInfoKey]: request.tableInfo }, function() {
                console.log('background.js: tableInfo saved for tabId:', tabId, 'contextId:', request.contextId);
                sendResponse({ status: 'SUCCESS' });
            });
        } catch (error) {
            console.error('background.js: 保存数据失败：', error);
            sendResponse({ status: 'ERROR', error: error.message });
        }
        return true;
    }
    if (request.type === 'askAI') {
        console.log('background.js: askAI received: ', request.question);
        console.log('background.js: contextId: ', request.contextId);
        console.log('background.js: starting ai processing...');
        
        // 检查 contextId
        if (!request.contextId) {
            console.error('background.js: contextId is missing in askAI request');
            sendMessageToContentScript({ 
                type: 'aiResp', 
                status: 'ERROR', 
                error: 'contextId is required' 
            }, tabId);
            return true;
        }
        
        // 发送处理中消息（使用发送方的 tab ID）
        sendMessageToContentScript({ type: 'aiResp', status: 'PROCESSING' }, tabId);

        // 开始处理AI请求
        if (!tabId) {
            sendMessageToContentScript({ 
                type: 'aiResp', 
                status: 'ERROR', 
                error: '无法获取标签页信息' 
            }, tabId);
            return true;
        }
        
        // 使用 tabId 和 contextId 获取对话历史和表信息，防止多标签页冲突
        const contextId = request.contextId;
        const tableInfoKey = `tableInfo_${tabId}_${contextId}`;
        const conversationKey = `conversation_${tabId}_${contextId}`;
        
        console.log('background.js: tableInfoKey: ', tableInfoKey);
        console.log('background.js: conversationKey: ', conversationKey);
        
        chrome.storage.local.get([tableInfoKey, conversationKey], async function(result) {
            try {
                const tableInfo = result[tableInfoKey];
                
                if (tableInfo) {
                    console.log('background.js: tableInfo found for contextId:', contextId);
                    
                    // 获取或初始化对话历史
                    let conversationHistory = result[conversationKey] || [];
                    
                    // 添加用户问题到对话历史
                    conversationHistory.push({
                        role: 'user',
                        content: request.question
                    });
                    
                    // 等待 AI 响应
                    const aiResponse = await sendToAI(conversationHistory, tableInfo);
                    
                    // 添加 AI 回复到对话历史
                    conversationHistory.push({
                        role: 'assistant',
                        content: aiResponse
                    });
                    
                    // 保存更新后的对话历史（只保留最近30轮对话）
                    if (conversationHistory.length > 30) {
                        conversationHistory = conversationHistory.slice(-30);
                    }
                    chrome.storage.local.set({ [conversationKey]: conversationHistory });
                    
                    // 发送成功响应（使用发送方的 tab ID）
                    sendMessageToContentScript({ 
                        type: 'aiResp', 
                        status: 'SUCCESS', 
                        result: aiResponse 
                    }, tabId);
                } else {
                    console.log('background.js: No tableInfo found for contextId:', contextId);
                    sendMessageToContentScript({ 
                        type: 'aiResp', 
                        status: 'ERROR', 
                        error: '未找到表信息，请先获取表结构' 
                    }, tabId);
                }
            } catch (error) {
                console.error('background.js: AI 处理失败：', error);
                sendMessageToContentScript({ 
                    type: 'aiResp', 
                    status: 'ERROR', 
                    error: error.message || 'AI 请求失败' 
                }, tabId);
            }
        });
        return true;
    }
    
    // 获取对话历史
    if (request.type === 'getConversation') {
        console.log('background.js: getConversation received, contextId: ', request.contextId);
        console.log('background.js: tabId: ', tabId);
        if (!request.contextId) {
            console.error('background.js: contextId is missing in getConversation request');
            sendResponse({ status: 'ERROR', error: 'contextId is required' });
            return true;
        }
        if (!tabId) {
            console.error('background.js: tabId is missing in getConversation request');
            sendResponse({ status: 'ERROR', error: 'tabId is required' });
            return true;
        }
        
        const contextId = request.contextId;
        const conversationKey = `conversation_${tabId}_${contextId}`;
        chrome.storage.local.get([conversationKey], function(result) {
            const conversationHistory = result[conversationKey] || [];
            console.log('background.js: conversation history retrieved for tabId:', tabId, 'contextId:', contextId, conversationHistory);
            sendResponse({ status: 'SUCCESS', conversation: conversationHistory });
        });
        return true;
    }
    
    // 清空对话历史
    if (request.type === 'clearConversation') {
        console.log('background.js: clearConversation received, contextId: ', request.contextId);
        console.log('background.js: tabId: ', tabId);
        if (!request.contextId) {
            console.error('background.js: contextId is missing in clearConversation request');
            sendResponse({ status: 'ERROR', error: 'contextId is required' });
            return true;
        }
        if (!tabId) {
            console.error('background.js: tabId is missing in clearConversation request');
            sendResponse({ status: 'ERROR', error: 'tabId is required' });
            return true;
        }
        
        const contextId = request.contextId;
        const conversationKey = `conversation_${tabId}_${contextId}`;
        chrome.storage.local.remove(conversationKey, function() {
            console.log('background.js: conversation cleared for tabId:', tabId, 'contextId:', contextId);
            sendResponse({ status: 'SUCCESS' });
        });
        return true;
    }

    if (request.type === 'test') {
        console.log('background.js: test');
        return true;
    }
});

// 清除指定 tabId 的 tableInfo 和对话历史的函数
function clearStorageDataForTab(tabId) {
    if (!tabId) {
        console.error('background.js: tabId is required for clearStorageDataForTab');
        return;
    }
    
    chrome.storage.local.get(null, function(allItems) {
        const keysToRemove = [];
        // 找出所有包含该 tabId 的 tableInfo_ 和 conversation_ 开头的 key
        // 格式: tableInfo_${tabId}_${contextId} 或 conversation_${tabId}_${contextId}
        const tabIdPrefix1 = `tableInfo_${tabId}_`;
        const tabIdPrefix2 = `conversation_${tabId}_`;
        
        for (const key in allItems) {
            if (key.startsWith(tabIdPrefix1) || key.startsWith(tabIdPrefix2)) {
                keysToRemove.push(key);
            }
        }
        
        if (keysToRemove.length > 0) {
            chrome.storage.local.remove(keysToRemove, function() {
                console.log('background.js: Cleared storage for tabId:', tabId, 'keys:', keysToRemove);
            });
        } else {
            console.log('background.js: No storage data found for tabId:', tabId);
        }
    });
}

// 监听标签页更新事件，当页面加载完成时清除该标签页的存储
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    // 当页面加载完成时（包括首次加载和刷新）
    if (changeInfo.status === 'complete' && tab.url) {
        console.log('background.js: Page loaded/refreshed, clearing storage for tab:', tabId);
        clearStorageDataForTab(tabId);
    }
});

// 监听标签页关闭事件，当页面关闭时清除该标签页的存储
chrome.tabs.onRemoved.addListener(function(tabId) {
    console.log('background.js: Tab closed, clearing storage for tab:', tabId);
    clearStorageDataForTab(tabId);
});

var req1 = `找出年龄最大的10个人的购物情况，包括人员姓名和购物情况。`;
var tableInfo1 = [
    {'表名':'person','表结构': {'pid': '人员id', 'name': '姓名', 'age': '年龄'}},
    {'表名':'shopping','表结构': {'pid': '人员id', 'goods': '物品', 'time': '购物时间', 'price': '价格'}}
  ];
