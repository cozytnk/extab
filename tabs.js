console.log(`${chrome.runtime.id} tabs.js`)


/**
 * component definitions
 */

Vue.component('tab-card', {
  template: `
    <div class="tab-card">
      <img class="card-thumbnail" :src="tab.thumbnail || tab.favIconUrl" @click="updateThumbnail" />
      <div class="card-content" @click="jump" style="cursor: pointer;">
        <div class="card-title"><b>{{ tab.title }}</b></div>
        <div v-if="debug">
        {{ tab.id }}<br>
        {{ tab.windowId }}<br>
        {{ tab.thumbnail ? tab.thumbnail.length / 1024 : '-' }} kb<br>
        {{ tab.url }}<br>
        </div>
      </div>
      <div class="card-footer">
        <img :src="tab.favIconUrl" width="16" height="16" />
        <div style="font-size: 0.8em;">{{ host }}</div>
        <div style="margin-left: auto;">{{ tab.index + 1 }}</div>
      </div>
    </div>`,
  props: [ 'tab', 'debug' ],
  data () { return {} },
  computed: {
    host () {
      const regx = /^.+?:\/\/(?<host>[^\/]+)\//
      return regx.test(this.tab.url) ? this.tab.url.match(regx).groups.host : ''
    },
  },
  methods: {
    updateThumbnail () {
      getThumbnail(this.tab.id).then(thumbnail => {
        // console.log(`[debug] thumbnail: ${thumbnail.length} bytes = ${thumbnail.length / 1000} kb = ${thumbnail.length / 1000000} mb`)
        this.$set(this.tab, 'thumbnail', thumbnail)
      })
    },
    titleWithFavicon (tab) {
      return tab.favIconUrl ? `<img src="${tab.favIconUrl}" width="15" />&nbsp;${tab.title}` : `&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${tab.title}`
    },
    jump () {
      chrome.tabs.update(this.tab.id, { active: true })
    },
  },
})


/**
 * vue instance
 */
const app = new Vue({
  el: '#app',
  data: {
    windows: [],
    currentWindowId: null,
    selectedWindowId: null,
    tabs: [],
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
  watch: {
    selectedWindowId () {
      this.updateAllTabs()
    },
  },
  async mounted () {
    await this.updateWindows()
    await this.updateAllTabs()
    const { settings } = await browser.storage.local.get({ settings: {} })
    this.settings = settings
  },
  methods: {
    async updateWindows () {
      this.windows = await browser.windows.getAll()
      this.currentWindowId = (await browser.windows.getCurrent()).id
      if (this.windows.findIndex(win => win.id === this.selectedWindowId) === -1) this.selectedWindowId = this.currentWindowId
    },
    async updateAllTabs () {
      // const tabs = await browser.tabs.query({ currentWindow: true })
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
    async setThumbnail (tabId, thumbnail) {
      const i = this.tabs.findIndex(tab => tab.id === tabId)
      if (i !== -1)  this.$set(this.tabs[i], 'thumbnail', thumbnail) // リアクティブに値を変更
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
 * events
 */




/**
 * monitor tabs
 */

chrome.tabs.onActivated.addListener(async activeInfo => {
  console.log(`@chrome.tabs.onActivated\n  activeInfo.tabId: ${activeInfo.tabId}\n  activeInfo.windowId: ${activeInfo.windowId}`)

  const tabId = activeInfo.tabId
  app.updateTab(tabId)
  // app.updateAllTabs()
})

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  console.log(`@chrome.tabs.onUpdated\n  tabId: ${tabId}`)
  console.log(changeInfo)

  if (changeInfo.status === 'complete') {
    app.updateTab(tabId)
    // app.updateAllTabs()
  }

})

chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  console.log(`@chrome.tabs.onRemoved\n  tabId: ${tabId}\n  removeInfo: ${removeInfo}`)

  app.removeTab(tabId)
  // app.updateAllTabs()
})

/**
 * monitor windows
 */
chrome.windows.onCreated.addListener(window => {
  app.updateWindows()
})

chrome.windows.onRemoved.addListener(windowId => {
  app.updateWindows()
})

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


/**
 * dev
 */

const dev = async () => {
  const windows = await browser.windows.getAll()
  console.log(`beta`)
  this.a = windows

  const currentWindow = await browser.windows.getCurrent()
  console.log(currentWindow.id)
}