console.log(`${chrome.runtime.id} tabs.js`)


const tabsManagerMixin = {
  data: {
    windows: [],
    currentWindowId: null,
    selectedWindowId: null,
    tabs: [],
  },
  watch: {
    selectedWindowId () {
      this.updateAllTabs()
    },
  },
  async mounted () {

    /* monitor tabs */

    chrome.tabs.onActivated.addListener(async activeInfo => {
      console.log(`@chrome.tabs.onActivated\n  activeInfo.tabId: ${activeInfo.tabId}\n  activeInfo.windowId: ${activeInfo.windowId}`)

      const tabId = activeInfo.tabId
      this.updateTab(tabId)
      // this.updateAllTabs()
    })

    chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
      console.log(`@chrome.tabs.onUpdated\n  tabId: ${tabId}`)
      console.log(changeInfo)

      if (changeInfo.status === 'complete') {
        this.updateTab(tabId)
        // this.updateAllTabs()
      }

    })

    chrome.tabs.onMoved.addListener(async (tabId, moveInfo) => {
      const { fromIndex, toIndex, windowId } = moveInfo
      if (windowId === this.selectedWindowId) {
        this.removeTab(tabId)
        this.updateTab(tabId)
      }
    })

    chrome.tabs.onDetached.addListener(async (tabId, detachInfo) => {
      const { oldPosition, oldWindowId } = detachInfo
      if (oldWindowId === this.selectedWindowId) {
        this.removeTab(tabId)
      }
    })

    chrome.tabs.onAttached.addListener(async (tabId, attachInfo) => {
      const { newPosition, newWindowId } = attachInfo
      if (newWindowId === this.selectedWindowId) {
        this.updateTab(tabId)
      }
    })

    chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
      console.log(`@chrome.tabs.onRemoved\n  tabId: ${tabId}\n  removeInfo: ${removeInfo}`)

      this.removeTab(tabId)
      // app.updateAllTabs()
    })

    /* monitor windows */

    chrome.windows.onCreated.addListener(window => {
      this.updateWindows()
    })

    chrome.windows.onRemoved.addListener(windowId => {
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
      console.log(`@app.removeTab ${tabId}`)
      const i = this.tabs.findIndex(tab => tab.id === tabId)
      if (i !== -1) this.tabs.splice(i, 1) // リアクティブにi番目の要素を削除
    },
  },
}



Vue.use(httpVueLoader)

/**
 * vue instance
 */
const app = new Vue({
  el: '#app',
  components: [ 'url:tab-card.vue' ],
  mixins: [ tabsManagerMixin ],
  data: {
    filters: { title: '', url: '' },
    settings: {},
    debug: false,
    bytesInUse_XB: 0,
  },
  computed: {
    filteredTabs () {
      const filterRegx = {
        title: new RegExp(this.filters.title),
        url: new RegExp(this.filters.url),
      }
      return this.tabs.filter((tab, index) => {
        return filterRegx.title.test(tab.title) && filterRegx.url.test(tab.url)
      })
    },
  },
  async mounted () {
    const { settings } = await browser.storage.local.get({ settings: {} })
    this.settings = settings
  },
  methods: {
    async setThumbnail (tabId, thumbnail) {
      const i = this.tabs.findIndex(tab => tab.id === tabId)
      if (i !== -1) this.$set(this.tabs[i], 'thumbnail', thumbnail) // リアクティブに値を変更
    },
    async updateQuality (e) {
      let value = Number(e.target.value) || 0
      if ((value < 1) || (100 < value)) {
        alert(`@updateQuality: invalid value.`)
        return
      }
      const { settings } = await browser.storage.local.get([ 'settings' ])
      settings.quality = value
      chrome.storage.local.set({ settings })
    },
    debug_ () {
      this.debug ^= true
      const tab = { id: -1, index: 0, title: '123', url: 'http://qwertyuiopasdfghjklzxcvbnmqwertyuiopasdfghjklzxcvbnmqwertyuiopasdfghjklzxcvbnm/12345678901234567890' }
      this.tabs.splice(tab.index, 0, tab) // tab.index番目にリアクティブに挿入
    },
    async clearStorage () {
      chrome.storage.local.clear()
    },
    focusTab (index) {
      index = Math.max(index, 0)
      index = Math.min(index, this.tabs.length - 1)
      document.querySelector(`.tab-card-index-${index}`)?.focus()
    },
  },
})


/**
 * utils
 */

const getThumbnail = async (tabId) => {
  const key = `${tabId}`
  const items = await browser.storage.local.get({ [key]: { dataUrl: null } })
  return items[key].dataUrl
}


/**
 * monitor local storage
 */

chrome.storage.onChanged.addListener(async (changes, namespace) => {
  console.log(`@chrome.storage.onChanged\n  changes: ${changes}\n  namespace: ${namespace}`)

  console.assert(namespace === 'local')

  for (const key in changes) {

    if (key === 'settings') {
      Vue.set(app, 'settings', changes.settings.newValue)
    } else {
      const tabId = Number(key)
      const change = changes[key]
      if (!change.newValue) continue
      app.setThumbnail(tabId, change.newValue.dataUrl)
    }
  }

  const bytesInUse = await browser.storage.local.getBytesInUse(null)
  const bytesInUse_XB = bytesInUse &&
    (bytesInUse < 1024   ) ? `${bytesInUse} B` :
    (bytesInUse < 1048576) ? `${(bytesInUse / 1024).toFixed(2)} KB` :
    `${(bytesInUse / 1048576).toFixed(2)} MB`
  Vue.set(app, 'bytesInUse_XB', bytesInUse_XB)

})


