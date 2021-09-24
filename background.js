console.log(chrome.runtime.id)


const browser = (() => {
  const browser = {}

  for (const name of ['tabs', 'windows']) {
    browser[name] = {}
    for (const [key, value] of Object.entries(chrome[name] || {})) {
      browser[name][key] = (...args) => new Promise(resolve => value?.(...args, resolve))
    }
  }

  return browser
}) ()


const openPage = async () => {
  const [ tab ] = await browser.tabs.query({ url: chrome.runtime.getURL('tabs-view/index.html'), currentWindow: true })
  if (tab) {
    chrome.tabs.update(tab.id, { active: true })
  } else {
    chrome.tabs.create({ url: 'tabs-view/index.html' })
  }
}


/**
 * アイコン押下時
 */

chrome.browserAction.onClicked.addListener(async tab => {
  await openPage()
})


/**
 * ショートカット
 */

chrome.commands.onCommand.addListener(async cmd => {
  console.log(`@onCommand`, cmd)

  if (cmd === 'Delete') {
    const [ currentTab ] = await browser.tabs.query({ active: true, currentWindow: true })
    await browser.tabs.remove(currentTab.id)
  }

  if (cmd === 'Right') {
    const tabs = await browser.tabs.query({ currentWindow: true })
    const [ currentTab ] = await browser.tabs.query({ active: true, currentWindow: true })
    const newIndex = (currentTab.index + 1 + tabs.length) % tabs.length
    const newtab = tabs[newIndex]
    await browser.tabs.update(newtab.id, { active: true })
  }

  if (cmd === 'Left') {
    const tabs = await browser.tabs.query({ currentWindow: true })
    const [ currentTab ] = await browser.tabs.query({ active: true, currentWindow: true })
    const newIndex = (currentTab.index - 1 + tabs.length) % tabs.length
    const newtab = tabs[newIndex]
    await browser.tabs.update(newtab.id, { active: true })
  }

  if (cmd === 'OpenExtab') {
    await openPage()
  }

})

