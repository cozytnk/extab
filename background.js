console.log(`${chrome.runtime.id} background.js`)

chrome.storage.local.set({ settings: { quality: 1 } })

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


/**
 * アイコン押下時に既定ページを開く
 */

chrome.browserAction.onClicked.addListener(async tab => {

  const tabs = await browser.tabs.query({ title: 'extab', currentWindow: true })
  if (tabs.length === 0) {
    chrome.tabs.create({ url: `tabs.html` })
  } else {
    chrome.tabs.update(tabs[0].id, { active: true })
  }
})


/**
 * onActivated/onRemoved 時にタブ情報を更新しローカルストレージに保存
 */

chrome.tabs.onActivated.addListener(async activeInfo => {
  const tabId = activeInfo.tabId

  // capture and store the activated tab

  try {
    const { settings } = await browser.storage.local.get([ 'settings' ])
    let dataUrl = await browser.tabs.captureVisibleTab({ format: 'jpeg', quality: settings.quality /* 1 ~ 100 */ })
    // dataUrl = await resizeImage(dataUrl, 300, 300)
    chrome.storage.local.set({ [`${tabId}`]: { dataUrl } })
  } catch {}

})

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  chrome.storage.local.remove([`${tabId}`])
})


/**
 * ショートカット wip
 */

chrome.commands.onCommand.addListener(async cmd => {
  console.log(`@onCommand: ${cmd}`)
  // alert(`@onCommand: ${cmd}`)

  if (cmd === 'Delete') {
    let [curtab] = await browser.tabs.query({ active: true, currentWindow: true })
    await browser.tabs.remove(curtab.id)
  }

  if (cmd === 'Right') {
    let tabs = await browser.tabs.query({ currentWindow: true })
    let [curtab] = await browser.tabs.query({ active: true, currentWindow: true })
    let newIndex = (curtab.index + 1 + tabs.length) % tabs.length
    let newtab = tabs[newIndex]
    await browser.tabs.update(newtab.id, { active: true })
  }

  if (cmd === 'Left') {
    let tabs = await browser.tabs.query({ currentWindow: true })
    let [curtab] = await browser.tabs.query({ active: true, currentWindow: true })
    let newIndex = (curtab.index - 1 + tabs.length) % tabs.length
    let newtab = tabs[newIndex]
    await browser.tabs.update(newtab.id, { active: true })
  }

})

