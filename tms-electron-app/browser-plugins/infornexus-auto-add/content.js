(function () {
  'use strict';

  const COL_IDX = 1; // 第二列 (0-based)

  function createUploadButton() {
    const id = 'infornexus-xls-upload-btn';
    if (document.getElementById(id)) return;

    const btn = document.createElement('button');
    btn.id = id;
    btn.textContent = '上传 XLS/XLSX';
    Object.assign(btn.style, {
      position: 'fixed',
      zIndex: 2147483647,
      bottom: '20px',
      right: '20px',
      padding: '8px 16px',
      background: '#2563eb',
      color: '#fff',
      border: 'none',
      borderRadius: '6px',
      cursor: 'pointer',
      fontSize: '14px',
      fontFamily: 'system-ui, sans-serif',
      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
    });

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    input.style.display = 'none';

    btn.addEventListener('click', () => input.click());
    input.addEventListener('change', (e) => handleFile(e.target.files[0]));

    document.body.appendChild(input);
    document.body.appendChild(btn);
  }

  function extractIdsFromSheet(jsonData) {
    const ids = [];
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      if (row && row[COL_IDX] != null && String(row[COL_IDX]).trim()) {
        ids.push(String(row[COL_IDX]).trim());
      }
    }
    return ids;
  }

  function handleFile(file) {
    if (!file) return;
    if (typeof XLSX === 'undefined') {
      alert('XLSX 库未加载');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

        let ids = extractIdsFromSheet(jsonData);
        //过滤一下把位数不为10位的数字去掉
        ids = ids.filter(id => id.length === 10);
        chrome.storage.local.set({ xlsIds: ids });
        console.log('[infornexus] 提取到 ID:', ids);
        await searchAndAdd();
        alert(`已搜索并添加 ${ids.length} 个 ID\n已存入 chrome.storage.local.xlsIds`);
      } catch (err) {
        console.error('[infornexus] 解析失败:', err);
        alert('解析失败: ' + (err.message || err));
      }
    };
    reader.readAsArrayBuffer(file);
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'getXlsIds') {
      chrome.storage.local.get('xlsIds', (r) => sendResponse(r.xlsIds || []));
      return true;
    }
  });

  function init() {
    if (document.body) {
      createUploadButton();
    } else {
      document.addEventListener('DOMContentLoaded', createUploadButton);
    }
  }

  init();
})();

window.addEventListener('DOMContentLoaded', async () => {
  console.log(0);
  let searchText = localStorage.getItem('searchText');
  if (!searchText) return;
  await waitForSelectorWithText('.listtablerowodd .listtablecell', searchText);
  console.log(1);
  let ids = await chrome.storage.local.get('xlsIds');
  if (ids.xlsIds.length === 0) return;
  let count = 0;
  console.log(2);
  let i = 0;
  while (true) {
    i++;
    if (i > 20) {
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
    count = 0
    document.querySelectorAll('.listtablecell').forEach(cell => {
      if (cell.textContent.includes(searchText)) {
        count++;
      }
    });
    if (count == 2) {
      break;
    }
  }
  if (count === 0) return;
  console.log(3);
  console.log("count:", count);
  if (count == 1) {
    document.querySelector('.listtablerowodd [type="checkbox"]').click()
    await new Promise(resolve => setTimeout(resolve, 100));
    document.querySelector('[name="searchResults"] [type="button"]').click();
  }
  if (count == 2) {
    //从xlsIds中删除已经搜索过的id
    ids.xlsIds = ids.xlsIds.filter(id => !id.includes(searchText));
    await chrome.storage.local.set({ xlsIds: ids.xlsIds });
    searchAndAdd();
    return;
  }
});

async function searchAndAdd() {
  while (true) {
    await new Promise(resolve => setTimeout(resolve, 100));
    const xlsIds = await chrome.storage.local.get('xlsIds');
    if (xlsIds.xlsIds.length === 0) continue;
    const id = xlsIds.xlsIds[0];
    console.log("id:", id);
    let input = document.querySelector('[name="tradecardForm"] [name="TradeSearchCriteria_newSearchParams_searchText"]');
    localStorage.setItem('searchText', id);
    simulateTextareaInput(input, id);
    await new Promise(resolve => setTimeout(resolve, 100));
    let button = document.querySelector('[value="Search"]');
    button.click();
    console.log(4);
    return;
  }
}

const waitForSelectorWithText = async (selector, text, timeout = 30000) => {
  const startTime = Date.now()
  while (Date.now() - startTime < timeout) {
    const elements = document.querySelectorAll(selector)
    for (const element of elements) {
      if (element.textContent && element.textContent.includes(text)) {
        return element
      }
    }
    await delay(100)
  }
  try {
    throw new Error(`未找到包含文本 "${text}" 的元素: ${selector}`)
  } catch (error) {
    // console.error(error)
    return null
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// 等待元素出现
const waitForSelector = async (selector, timeout = 30000) => {
  const startTime = Date.now()
  while (Date.now() - startTime < timeout) {
    const element = document.querySelector(selector)
    if (element) {
      return element
    }
    await delay(100)
  }
  return null
}


function triggerMoreEvents(element) {
  // keydown
  element.dispatchEvent(new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    key: "a"
  }));

  // keyup
  element.dispatchEvent(new KeyboardEvent("keyup", {
    bubbles: true,
    cancelable: true,
    key: "a"
  }));

  // blur（极其重要，很多后台用 blur 决定“添加一行”）
  element.dispatchEvent(new Event("blur", { bubbles: true }));
}

/**
 * 模拟向 textarea 或 input 元素输入文本
 * @param {HTMLTextAreaElement|HTMLInputElement} element 目标元素
 * @param {string} text 要输入的文本
 */
function simulateTextareaInput(element, text) {
  if (!element) return;

  // 1. 获取元素原型上的 value setter
  // 这样做是为了绕过 React 等框架对 .value 属性的重写
  const lastValue = element.value;
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(element),
    'value'
  ).set;

  // 2. 调用原生 setter 修改值
  nativeInputValueSetter.call(element, text);

  // 3. 手动触发 input 事件，通知框架（如 Vue/React）数据已更改
  const event = new Event('input', { bubbles: true });

  // React 特有的兼容处理：React 16+ 会监听这个属性来同步状态
  event.simulated = true;

  element.dispatchEvent(event);

  // 4. (可选) 如果需要模拟用户按下回车或失去焦点，可以追加 change 事件
  const changeEvent = new Event('change', { bubbles: true });
  element.dispatchEvent(changeEvent);
}

/**
 * 在任意框架下模拟鼠标进入事件
 * @param {HTMLElement} element - 目标元素
 */
function simulateMouseEnter(element) {
  if (!element) {
    console.warn('simulateMouseEnter: 目标元素不存在');
    return;
  }

  // 模拟 mouseover 事件，确保 React 等框架能捕获
  const mouseOverEvent = new MouseEvent('mouseover', {
    bubbles: true,
    cancelable: true,
    view: window,
    relatedTarget: null, // 来自外部元素
    clientX: 0,
    clientY: 0
  });
  element.dispatchEvent(mouseOverEvent);

  // 再模拟 mouseenter 事件
  const mouseEnterEvent = new MouseEvent('mouseenter', {
    bubbles: false, // mouseenter 默认不冒泡
    cancelable: true,
    view: window,
    relatedTarget: null,
    clientX: 0,
    clientY: 0
  });
  element.dispatchEvent(mouseEnterEvent);
}
