

const url = window.location.href;
console.log('url: ', url);
 
var rightPage = false;

function getTitles() {
  var myFrame = document.getElementById('content-frame');
  myFrame.addEventListener('load', function() {
    console.log('Frame loaded');
    try {
      var frameDoc = myFrame.contentDocument || myFrame.contentWindow.document;

      // const targetDiv = frameDoc.querySelector('div.lg:col-span-2');
      const targetDiv = frameDoc.getElementById('tools-list');
      if(targetDiv) {
      console.log('targetDiv: ', targetDiv);
      const listItems = targetDiv.querySelectorAll('h4');
      const titles = [];
  
      listItems.forEach(h4Ele => {
        titles.push(h4Ele.textContent);
      });
  
      console.log(titles);
      rightPage = true;
      console.log('rightPage set: ', rightPage);
    }else
      console.log('targetDiv not found');
  } catch (error) {
    console.log('Error: ', error);
  }
});
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
      }
    ],
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
  fetch(url, options)
    .then(response => response.json())
    .then(data => console.log(data))
    .catch(error => console.error(error));
}
// window.myFunc = sendToAI;

var req1 = `找出年龄最大的10个人的购物情况，包括人员姓名和购物情况。`;
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



// window.myReq1 = req1;
// window.myTable1 = table1;

getTitles();

if (rightPage) {
  console.log('rightPage read: ', rightPage);
  sendToAI(req1, table1);
}

chrome.commands.onCommand.addListener((command) => {
  if (command === 'show-chat') {
    console.log('show-chat command');
    chrome.window.create({
      url: 'chat.html',
      type: 'popup',
      width: 400,
      height: 300
    });
  }
});
