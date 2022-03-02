console.log('@index.js')


// ?view=grid|list windowid=123 demo
const getURLParamers = () => location.search.replace(/^\?/, '').split('&').reduce((params, s) => {
  const [k, v] = s.split('=')
  params[decodeURIComponent(k)] = decodeURIComponent(v)
  return params
}, {})


const dummyItems = [
  { id: 10, windowId: 100, url: 'http://dummy/aaa', title: 'A', favIconUrl: '' },
  {
    id: 11, windowId: 100, url: 'http://dummy/bbb', title: 'B', favIconUrl: '',
    active: true, audible: true, incognito: false,
    status: 'complete', // or 'unloaded', 'loading'
  },
  { id: 12, windowId: 100, url: 'http://dummy/ccc', title: 'C', favIconUrl: '' },
  { id: 13, windowId: 200, url: 'http://dummy/ddd', title: 'D', favIconUrl: '' },
  { id: 14, windowId: 200, url: 'http://dummy/eee', title: 'E', favIconUrl: '' },
]
for (let i = 0; i < 30; i++) {
  dummyItems.push({ id: 20+i, windowId: 100, url: 'http://dummy/eee', title: 'F', favIconUrl: '' })
}
dummyItems.forEach((item, index) => item.index = index)


const iframe = document.querySelector('iframe')


const reload = async () => {

  const tabs = await chrome.tabs.query({ windowType: 'normal' })

  for (const tab of tabs) {
    if (tab.status !== 'complete') continue;
    const [{ result: ogImage }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => document.querySelector('meta[property="og:image"]')?.content
    }).catch(err => [{}])
    // if (ogImage) console.log('aaa', ogImage)
    tab.ogImage = ogImage
  }

  iframe.contentWindow.postMessage({
    command: 'setItems',
    // args: [dummyItems],
    args: [tabs],
  }, '*')
}

iframe.onload = async () => {
  console.log('iframe.onload')

  if (getURLParamers().demo) {
    iframe.contentWindow.postMessage({ command: 'setItems', args: [dummyItems] }, '*')
    iframe.contentWindow.postMessage({ command: 'setWindowId', args: [dummyItems[0].windowId] }, '*')
    return
  }

  await reload()

  const [{ windowId }] = await chrome.tabs.query({ active: true, currentWindow: true })
  iframe.contentWindow.postMessage({
    command: 'setWindowId',
    args: [windowId],
  }, '*')
}

window.addEventListener('message', async event => {
  console.log('@message', event)
  // event.source.postMessage({ a: 123 }, event.origin)

  const { command, args } = event.data

  if (command === 'reload') {
    await reload()
  }

  else if (command === 'activate') {
    const [id] = args
    await chrome.tabs.update(id, { active: true })
  }

  else if (command === 'remove') {
    const [id] = args
    await chrome.tabs.remove(id)
  }

})

chrome.tabs.onActivated.addListener(async activeInfo => {
  console.log('onActivated', activeInfo)
  const { tabId, windowId } = activeInfo
  await reload()
})
chrome.tabs.onCreated.addListener(async tab => {
  console.log('onCreated', tab)
  await reload()
})
chrome.tabs.onDetached.addListener(async (tabId, detachInfo) => {
  console.log('onDetached', tabId, detachInfo)
  const { oldPosition, oldWindowId } = detachInfo
  await reload()
})
chrome.tabs.onMoved.addListener(async (tabId, moveInfo) => {
  console.log('onMoved', tabId, moveInfo)
  const { fromIndex, toIndex, windowId } = moveInfo
  await reload()
})
chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  console.log('onRemoved', tabId, removeInfo)
  const { isWindowClosing, windowId } = removeInfo
  await reload()
})
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  console.log('onUpdated', tabId, changeInfo, tab)
  const { audible, favIconUrl, groupId, mutedInfo, pinned, status, title, url } = changeInfo
  if (status === 'complete') {
    await reload()
  }
})