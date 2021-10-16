console.log(chrome.runtime.id)


const browser = (() => {
  const browser = {}

  for (const name of ['tabs', 'windows']) {
    browser[name] = {}
    for (const [key, value] of Object.entries(chrome[name] || {})) {
      browser[name][key] = (...args) => new Promise(resolve => value?.(...args, resolve))
    }
  }

  browser.tabs.utls = {
    executeScript: (tabId, f) => browser.tabs.executeScript(tabId, { code: `(${f}) ()` }),
  }

  return browser
}) ()


const app = new Vue({
  el: '#app',
  data: {
    windowId: null,
    windows: [],
    items: [],
    //
    itemsLayout: 'list',
    //
    filter: { text: '', usesRegExp: false },
    //
  },
  computed: {
    filteredItems () {
      return this.items.filter(item => item.title.includes(this.filter.text) || item.url.includes(this.filter.text))
    },
  },
  watch: {
    async windowId () {
      this.items = await browser.tabs.query({ windowId: this.windowId })
    },
  },
  async mounted () {
    this.windows = await browser.windows.getAll()
    this.windowId = (await browser.windows.getCurrent()).id
    this.items = await browser.tabs.query({ windowId: this.windowId })
  },
  methods: {
    //
    updateItem (item) {
      const { id, index } = item
      const i = this.items.findIndex(item => item.id === id)
      if (i === -1) {
        this.items.splice(index, 0, item) // index番目にリアクティブに挿入
      } else {
        this.items.splice(i, 1, item) // i番目をリアクティブに差し替え
      }
      for (const [j, item] of this.items.entries()) item.index = j
    },
    removeItem (id) {
      const i = this.items.findIndex(item => item.id === id)
      if (i !== -1) this.items.splice(i, 1) // リアクティブにi番目の要素を削除
      for (const [j, item] of this.items.entries()) item.index = j
    },
    //
    open (id) {
      chrome.tabs.update(id, { active: true })
    },
    close (id) {
      const focusedItemIndex = Number(document.querySelector('.item:focus')?.getAttribute?.('index') ?? -1)
      focusedItemIndex > -1 && this.focusItem(Math.max(focusedItemIndex - 1, 0))
      chrome.tabs.remove(id)
    },
    focusItem (index) {
      console.log(index)
      index = Math.max(index, 0)
      index = Math.min(index, this.filteredItems.length - 1)
      document.querySelector(`.item[index="${index}"]`).focus()
    },
    onkeydown (event) {
      const computedStyle = window.getComputedStyle(document.querySelector('.items'))
      const gridColumnCount = computedStyle.getPropertyValue('grid-template-columns').split(' ').length
      // NOTE: display: flex; の場合も ['none'].length = 1 となりOK
      const shift = event.key === 'ArrowRight' ? 1
        :           event.key === 'ArrowLeft'  ? -1
        :           event.key === 'ArrowUp'    ? -gridColumnCount
        :           event.key === 'ArrowDown'  ? gridColumnCount
        :           0
      const index = Number(event.target.getAttribute('index'))
      this.focusItem(index + shift)
    },
    async scrape (item) {
      return
      // TODO:
      const [ret] = await browser.tabs.utls.executeScript(item.id, () => document.title)
      alert(JSON.stringify(ret, null, 2))
    },
    //
    checkDuplicates () {
      const duplicates = []
      for (const [i, item] of this.items.entries()) {
        for (const [j, item2] of this.items.entries()) {
          if (i >= j) continue
          if (item.url === item2.url) {
            // item.duplicate = true
            // item2.duplicate = true
            // this.$set(item, 'duplicate', true)
            // this.$set(item2, 'duplicate', true)
            duplicates.push(item.title)
          }
        }
      }
      alert(`${duplicates.length} duplicated tabs:\n  ${duplicates.join('\n  ')}`)
    },
    favicon (item) {
      return item.url === 'chrome://extensions/' ? '../assets/baseline_extension_black_48dp.png'
        :    item.url === chrome.runtime.getURL('tabs-view/index.html') ? '../assets/favicon.png'
        :    /(png|jpe?g|gif)([^a-zA-Z\d]|$)/i.test(item.url) ? item.url
        :    /pdf([^a-zA-Z\d]|$)/i.test(item.url) ? '../assets/PDF.png'
        :    item.favIconUrl
    },
  },
})


/* monitor tabs and windows */
{
  chrome.tabs.onActivated.addListener(async activeInfo => {
    console.debug(`@chrome.tabs.onActivated`, activeInfo)
    const { tabId, windowId } = activeInfo
    if (windowId === app.windowId) {
      const oldActiveTab = app.items.find(item => item.active)
      oldActiveTab && app.updateItem({ ...oldActiveTab, active: false })
      const tab = await browser.tabs.get(tabId)
      app.updateItem(tab)
    }
  })

  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    console.debug(`@chrome.tabs.onUpdated`, tabId, changeInfo, tab)
    const { status } = changeInfo
    if (status === 'complete') {
      const tab = await browser.tabs.get(tabId)
      if (tab.windowId === app.windowId) {
        app.updateItem(tab)
      }
    }
  })

  chrome.tabs.onMoved.addListener(async (tabId, moveInfo) => {
    console.debug(`@chrome.tabs.onMoved`, tabId, moveInfo)
    const { fromIndex, toIndex, windowId } = moveInfo
    if (windowId === app.windowId) {
      const tab = await browser.tabs.get(tabId)
      app.removeItem(tabId)
      app.updateItem(tab)
    }
  })

  chrome.tabs.onDetached.addListener(async (tabId, detachInfo) => {
    console.debug(`@chrome.tabs.onDetached`, tabId, detachInfo)
    const { oldPosition, oldWindowId } = detachInfo
    if (oldWindowId === app.windowId) {
      app.removeItem(tabId)
    }
  })

  chrome.tabs.onAttached.addListener(async (tabId, attachInfo) => {
    console.debug(`@chrome.tabs.onAttached`, tabId, attachInfo)
    const { newPosition, newWindowId } = attachInfo
    if (newWindowId === app.windowId) {
      const tab = await browser.tabs.get(tabId)
      app.updateItem(tab)
    }
  })

  chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
    console.debug(`@chrome.tabs.onRemoved`, tabId, removeInfo)
    app.removeItem(tabId)
  })

  chrome.windows.onCreated.addListener(async window => {
    console.debug(`@chrome.windows.onCreated`, window)
    Vue.set(app, 'windows', await browser.windows.getAll())
  })

  chrome.windows.onRemoved.addListener(async windowId => {
    console.debug(`@chrome.windows.onRemoved`, windowId)
    Vue.set(app, 'windows', await browser.windows.getAll())
  })
}