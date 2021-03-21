console.log(`${chrome.runtime.id} background.js`)
chrome.storage.local.set({ settings: { quality: 100 } })


/**
 * utls
 */

const resizeImage = (base64Str, maxWidth, maxHeight) => {
  // See https://gist.github.com/ORESoftware/ba5d03f3e1826dc15d5ad2bcec37f7bf#gistcomment-3014639
  return new Promise((resolve) => {
    let img = new Image()
    img.src = base64Str
    img.onload = () => {
      let canvas = document.createElement('canvas')
      const MAX_WIDTH = maxWidth
      const MAX_HEIGHT = maxHeight
      let width = img.width
      let height = img.height

      if (width > height) {
        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width
          width = MAX_WIDTH
        }
      } else {
        if (height > MAX_HEIGHT) {
          width *= MAX_HEIGHT / height
          height = MAX_HEIGHT
        }
      }
      canvas.width = width
      canvas.height = height
      let ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL())
    }
  })
}

const openExtab = async () => {

  const [ extab ] = await browser.tabs.query({ title: 'extab', currentWindow: true })
  if (extab) {
    chrome.tabs.update(extab.id, { active: true })
  } else {
    chrome.tabs.create({ url: 'tabs-view/index.html' })
  }
}


/**
 * アイコン押下時に既定ページを開く
 */

chrome.browserAction.onClicked.addListener(async tab => {
  await openExtab()
})


/**
 * onActivated/onUpdated/onRemoved 時にタブキャプチャを更新しローカルストレージに保存
 */

const captureCurrentTab = async () => {
  try {
    const [ currentTab ] = await browser.tabs.query({ active: true, currentWindow: true })
    let dataUrl = await browser.tabs.captureVisibleTab({ format: 'png' })
    dataUrl = await resizeImage(dataUrl, 300, 300)
    chrome.storage.local.set({ [`${currentTab.id}`]: { dataUrl } })
  } catch (error) {
    // console.error(error)
    // console.error(error.message)
  }
}

chrome.tabs.onActivated.addListener(async activeInfo => {
  console.log(`@chrome.tabs.onActivated\n`, activeInfo)
  // const tabId = activeInfo.tabId
  captureCurrentTab()
})

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  console.log(`@chrome.tabs.onUpdated\n`, changeInfo)

  if (changeInfo.status === 'complete') captureCurrentTab()
  // captureCurrentTab()
})

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  console.log(`@chrome.tabs.onRemoved\n`, removeInfo)

  chrome.storage.local.remove([`${tabId}`])
})


/**
 * ショートカット
 */

chrome.commands.onCommand.addListener(async cmd => {
  console.log(`@onCommand`, cmd)

  if (cmd === 'Delete') {
    let [ currentTab ] = await browser.tabs.query({ active: true, currentWindow: true })
    await browser.tabs.remove(currentTab.id)
  }

  if (cmd === 'Right') {
    let tabs = await browser.tabs.query({ currentWindow: true })
    let [ currentTab ] = await browser.tabs.query({ active: true, currentWindow: true })
    let newIndex = (currentTab.index + 1 + tabs.length) % tabs.length
    let newtab = tabs[newIndex]
    await browser.tabs.update(newtab.id, { active: true })
  }

  if (cmd === 'Left') {
    let tabs = await browser.tabs.query({ currentWindow: true })
    let [ currentTab ] = await browser.tabs.query({ active: true, currentWindow: true })
    let newIndex = (currentTab.index - 1 + tabs.length) % tabs.length
    let newtab = tabs[newIndex]
    await browser.tabs.update(newtab.id, { active: true })
  }

  if (cmd === 'OpenExtab') {
    await openExtab()
  }

})

