const url = window.location.href;
console.log('url: ', url);
 
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
    }else
      console.log('targetDiv not found');
  } catch (error) {
    console.log('Error: ', error);
  }
});

