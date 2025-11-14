chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('chat.js: msg recieved: ', request, sender);
    if (request.type === 'aiResp') {
    console.log('chat.js: aiResp received: ', request.aiResp);
    sendResponse('SUCCESS');
    document.getElementById('resp').innerHTML = resp;
    return true;
  }
});

// 为 chat.html 的按钮绑定点击事件
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('sendBtn'); // 确保 chat.html 中按钮 id 为 sendBtn
  if (btn) {
    btn.addEventListener('click', handleSend);
  }
});

// 点击按钮后执行的函数
function handleSend() {
  const input = document.getElementById('input').value.trim(); // 假设输入框 id 为 input
  if (!input) return;

  // 向 background 发送消息，请求 AI 回答
  chrome.runtime.sendMessage({ type: 'askAI', question: input }, (response) => {
    if (response && response.type === 'aiResp') {
      document.getElementById('resp').innerHTML = response.aiResp;
    }
  });
}
