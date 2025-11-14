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

function sendToAI(req, table_info) {
  const token = 'sk-d2537aef97064bbfa709dc1accb6f79d';
  const url = 'https://api.deepseek.com/chat/completions';
  const data = {
    messages: [
    {
        content: '你是一个数据库专家，能够根据给定的表信息和用户请求，生成SQL查询语句。',
        role: 'system'
    },
    {
        content: `请按照要求和给定的表信息生成SQL查询语句，要求: ${req}, 表信息: ${table_info}, 只需要输出SQL语句，不需要其他内容。`,
        role: 'user'
    }],
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
  console.log('AI req sent: ', options);
  
  // 返回 Promise，正确处理异步响应
  return fetch(url, options)
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(responseData => {
      console.log('AI response received: ', responseData);
      // 提取 AI 的回复内容
      if (responseData.choices && responseData.choices.length > 0) {
        return responseData.choices[0].message.content || '';
      }
      return '';
    })
    .catch(error => {
      console.error('AI request error: ', error);
      throw error;
    });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('background.js: msg recieved: ', request, sender);
    
    // 获取发送消息的 tab ID
    const tabId = sender.tab ? sender.tab.id : null;
    
    if (request.type === 'tableInfo') {
        console.log('background.js: tableInfo received: ', request.tableInfo);
        try {
            chrome.storage.local.set({ tableInfo: request.tableInfo });
            console.log('background.js: tableInfo saved: ', request.tableInfo);
            } catch (error) {
            console.error('background.js: 保存数据失败：', error);
        }
        sendResponse('SUCCESS');
        return true;
    }
    if (request.type === 'askAI') {
        console.log('background.js: askAI received: ', request.question);
        console.log('background.js: starting ai processing...');
        
        // 发送处理中消息（使用发送方的 tab ID）
        sendMessageToContentScript({ type: 'aiResp', status: 'PROCESSING' }, tabId);

        // 开始处理AI请求
        chrome.storage.local.get('tableInfo', async function(result) {
            try {
                if (result.tableInfo) {
                    console.log('background.js: tableInfo get: ', result.tableInfo);
                    const tableInfo = result.tableInfo;
                    
                    // 等待 AI 响应
                    const resp = await sendToAI(request.question, tableInfo);
                    
                    // 发送成功响应（使用发送方的 tab ID）
                    sendMessageToContentScript({ 
                        type: 'aiResp', 
                        status: 'SUCCESS', 
                        result: resp 
                    }, tabId);
                } else {
                    console.log('background.js: No tableInfo found');
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

    if (request.type === 'test') {
        console.log('background.js: test');
        return true;
    }
});



var req1 = `找出年龄最大的10个人的购物情况，包括人员姓名和购物情况。`;
var tableInfo1 = `表名：person
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

// chrome.commands.onCommand.addListener((command) => {
//     console.log('background.js: command: ', command);
//   if (command === 'open-chat-window') {
//     console.log('background.js: open-chat-window command');
//     chrome.windows.create({
//       url: 'chat.html',
//       type: 'popup',
//       width: 400,
//       height: 300
//     });
//   }
// });
