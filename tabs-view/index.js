console.log(chrome.runtime.id)


const browser = (() => {
  const browser = {}

  for (const name of ['tabs', 'windows', 'storage']) {
    browser[name] = {}
    for (const [key, value] of Object.entries(chrome[name] || {})) {
      browser[name][key] = (...args) => new Promise(resolve => value?.(...args, resolve))
    }
  }

  return browser
}) ()



const tabsManagerMixin = {
  data: {
    windows: [],
    currentWindowId: null,
    selectedWindowId: null,
    tabs: [],
  },
  async mounted () {

    /* monitor tabs */

    chrome.tabs.onActivated.addListener(async activeInfo => {
      console.debug(`@chrome.tabs.onActivated`, activeInfo)
      const { tabId, windowId } = activeInfo
      this.updateTab(tabId)
      // this.updateAllTabs()
    })

    chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
      console.debug(`@chrome.tabs.onUpdated`, tabId, changeInfo, tab)
      const { status } = changeInfo
      if (status === 'complete') {
        this.updateTab(tabId)
        // this.updateAllTabs()
      }

    })

    chrome.tabs.onMoved.addListener(async (tabId, moveInfo) => {
      console.debug(`@chrome.tabs.onMoved`, tabId, moveInfo)
      const { fromIndex, toIndex, windowId } = moveInfo
      if (windowId === this.selectedWindowId) {
        this.removeTab(tabId)
        this.updateTab(tabId)
      }
    })

    chrome.tabs.onDetached.addListener(async (tabId, detachInfo) => {
      console.debug(`@chrome.tabs.onDetached`, tabId, detachInfo)
      const { oldPosition, oldWindowId } = detachInfo
      if (oldWindowId === this.selectedWindowId) {
        this.removeTab(tabId)
      }
    })

    chrome.tabs.onAttached.addListener(async (tabId, attachInfo) => {
      console.debug(`@chrome.tabs.onAttached`, tabId, attachInfo)
      const { newPosition, newWindowId } = attachInfo
      if (newWindowId === this.selectedWindowId) {
        this.updateTab(tabId)
      }
    })

    chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
      console.debug(`@chrome.tabs.onRemoved`, tabId, removeInfo)
      this.removeTab(tabId)
      // app.updateAllTabs()
    })

    /* monitor windows */

    chrome.windows.onCreated.addListener(window => {
      console.debug(`@chrome.windows.onCreated`, window)
      this.updateWindows()
    })

    chrome.windows.onRemoved.addListener(windowId => {
      console.debug(`@chrome.windows.onRemoved`, windowId)
      this.updateWindows()
    })

    /* init */
    await this.updateWindows()
    await this.updateAllTabs()
  },
  methods: {
    async updateWindows () {
      this.windows = await browser.windows.getAll()
      this.currentWindowId = (await browser.windows.getCurrent()).id
      if (this.windows.findIndex(win => win.id === this.selectedWindowId) === -1) this.selectedWindowId = this.currentWindowId
    },
    async updateAllTabs () {
      const tabs = await browser.tabs.query({ windowId: this.selectedWindowId })
      for (const tab of tabs) tab.thumbnail = await getThumbnail(tab.id)
      this.tabs = tabs
    },
    async updateTab (tabId) {
      const tab = await browser.tabs.get(tabId)
      if (tab.windowId !== this.selectedWindowId) return

      tab.thumbnail = await getThumbnail(tabId)
      const i = this.tabs.findIndex(tab => tab.id === tabId)
      if (i === -1) {
        this.tabs.splice(tab.index, 0, tab) // tab.index番目にリアクティブに挿入
      } else {
        this.tabs.splice(i, 1, tab) // i番目をリアクティブに差し替え
      }
    },
    removeTab (tabId) {
      console.debug(`@app.removeTab`, tabId)
      const i = this.tabs.findIndex(tab => tab.id === tabId)
      if (i !== -1) this.tabs.splice(i, 1) // リアクティブにi番目の要素を削除
    },
  },
}



/**
 * vue instance
 */
const app = new Vue({
  el: '#app',
  // mixins: [ tabsManagerMixin ],
  data: {
    windowId: null,
    windows: [],
    items: [],
    //
    filters: {
      title: { text: '', usesRegExp: false },
      url  : { text: '', usesRegExp: false },
    },
    //
    itemsLayout: 'list',
  },
  computed: {
    filteredTabs () {
      // const titleFilterFunc = this.$refs?.filterTitle?.test
      // const   urlFilterFunc = this.$refs?.filterUrl?.test
      // return this.tabs.filter((tab, index) => {
      //   return (titleFilterFunc ? titleFilterFunc(tab.title) : true)
      //     &&   (urlFilterFunc   ?   urlFilterFunc(tab.url  ) : true)
      // })
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
      console.debug(`@app.removeItem`, id)
      const i = this.items.findIndex(item => item.id === id)
      if (i !== -1) this.items.splice(i, 1) // リアクティブにi番目の要素を削除
      for (const [j, item] of this.items.entries()) item.index = j
    },
    //
    open (id) {
      chrome.tabs.update(id, { active: true })
    },
    close (id) {
      const focusedItemIndex = Number(document.querySelector('.items:focus')?.getAttribute?.('index') ?? -1)
      focusedItemIndex > -1 && this.focusItem(Math.max(focusedItemIndex - 1, 0))
      chrome.tabs.remove(id)
    },
    focusItem (index) {
      index = Math.max(index, 0)
      index = Math.min(index, this.items.length - 1)
      // document.querySelector(`.item-index-${index}`).focus()
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
      // console.log(index + shift)
      this.focusItem(index + shift)
    },
  },
})


/**
 * utils
 */

const getThumbnail = async (tabId) => {
  const key = `${tabId}`
  return ''
  // const items = await browser.storage.local.get({ [key]: { dataUrl: null } })
  // return items[key].dataUrl
}


/**
 * monitor local storage
 */

// chrome.storage.onChanged.addListener(async (changes, namespace) => {
//   console.debug(`@chrome.storage.onChanged`, changes, namespace)
//   console.assert(namespace === 'local')

//   for (const key in changes) {

//     if (key === 'settings') {
//       Vue.set(app, 'settings', changes.settings.newValue)
//     } else {
//       const tabId = Number(key)
//       const change = changes[key]
//       if (!change.newValue) continue
//       app.setThumbnail(tabId, change.newValue.dataUrl)
//     }
//   }

//   const bytesInUse = await browser.storage.local.getBytesInUse(null)
//   const bytesInUse_XB = bytesInUse &&
//     (bytesInUse < 1024   ) ? `${bytesInUse} B` :
//     (bytesInUse < 1048576) ? `${(bytesInUse / 1024).toFixed(2)} KB` :
//     `${(bytesInUse / 1048576).toFixed(2)} MB`
//   Vue.set(app, 'bytesInUse_XB', bytesInUse_XB)

// })


/* monitor tabs and windows */
{
  // chrome.tabs.onActivated.addListener(async activeInfo => {
  //   console.debug(`@chrome.tabs.onActivated`, activeInfo)
  //   const { tabId, windowId } = activeInfo
  //   this.updateTab(tabId)
  //   // this.updateAllTabs()
  // })

  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    console.debug(`@chrome.tabs.onUpdated`, tabId, changeInfo, tab)
    const { status } = changeInfo
    if (status === 'complete') {
      const tab = await browser.tabs.get(tabId)
      // if (tab.windowId !== this.selectedWindowId) return
      // tab.thumbnail = await getThumbnail(tabId)
      app.updateItem(tab)
      // this.updateAllTabs()
    }
  })

  chrome.tabs.onMoved.addListener(async (tabId, moveInfo) => {
    console.debug(`@chrome.tabs.onMoved`, tabId, moveInfo)
    const { fromIndex, toIndex, windowId } = moveInfo
    // if (windowId === this.selectedWindowId) {
      const tab = await browser.tabs.get(tabId)
      app.removeItem(tabId)
      app.updateItem(tab)
    // }
  })

  // chrome.tabs.onDetached.addListener(async (tabId, detachInfo) => {
  //   console.debug(`@chrome.tabs.onDetached`, tabId, detachInfo)
  //   const { oldPosition, oldWindowId } = detachInfo
  //   if (oldWindowId === this.selectedWindowId) {
  //     this.removeTab(tabId)
  //   }
  // })

  // chrome.tabs.onAttached.addListener(async (tabId, attachInfo) => {
  //   console.debug(`@chrome.tabs.onAttached`, tabId, attachInfo)
  //   const { newPosition, newWindowId } = attachInfo
  //   if (newWindowId === this.selectedWindowId) {
  //     this.updateTab(tabId)
  //   }
  // })

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