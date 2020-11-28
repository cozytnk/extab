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
    tabs: [],
    filters: { title: '', url: '' },
    settings: {},
    debug: false,
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
  methods: {
    async updateQuality (e) {
      let value = e.target.value
      const { settings } = await browser.storage.local.get([ 'settings' ])
      settings.quality = value
      chrome.storage.local.set({ settings })
    },
    async update (tabId) {
      const tab = await browser.tabs.get(tabId)
      const [ currentTab ] = await browser.tabs.query({ active: true, currentWindow: true })
      if (tab.windowId !== currentTab.windowId) return

      tab.thumbnail = await getThumbnail(tabId)
      const i = this.tabs.findIndex(tab => tab.id === tabId)
      if (i === -1) {
        this.tabs.splice(tab.index, 0, tab) // tab.index番目にリアクティブに挿入
      } else {
        this.tabs.splice(i, 1, tab) // i番目をリアクティブに差し替え
      }
    },
    remove (tabId) {
      console.log(`@app.remove ${tabId}`)
      const i = this.tabs.findIndex(tab => tab.id === tabId)
      if (i !== -1) this.tabs.splice(i, 1) // リアクティブにi番目の要素を削除
    },
    async setThumbnail (tabId, thumbnail) {
      const i = this.tabs.findIndex(tab => tab.id === tabId)
      // console.log(`@app.setThumbnail ${tabId} ${typeof tabId} ${Boolean(thumbnail)} ${i}`)
      if (i !== -1)  this.$set(this.tabs[i], 'thumbnail', thumbnail) // リアクティブに値を変更
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

const load = async () => {
  console.log('@load')
  const tabs = await browser.tabs.query({ currentWindow: true })
  for (const tab of tabs) tab.thumbnail = await getThumbnail(tab.id)
  Vue.set(app, 'tabs', tabs)
}


/**
 * events
 */

window.onload = async () => {
  await load()
}

document.querySelector('#reload').onclick = async () => {
  console.log('@reload')
  await load()
}

// DEBUG:
document.querySelector('#log-storage').onclick = () => {
  console.log('@log-storage')
  chrome.storage.local.get(null, items => console.log(items))
}

document.querySelector('#clear-storage').onclick = () => {
  console.log('@clear-storage')
  chrome.storage.local.clear()
}


/**
 * タブの情報更新時に自動で表示を更新
 */

chrome.tabs.onActivated.addListener(async activeInfo => {
  console.log(`@chrome.tabs.onActivated\n  activeInfo.tabId: ${activeInfo.tabId}\n  activeInfo.windowId: ${activeInfo.windowId}`)

  const tabId = activeInfo.tabId
  app.update(tabId)
})

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  console.log(`@chrome.tabs.onUpdated\n  tabId: ${tabId}`)
  console.log(changeInfo)

  if (changeInfo.status === 'complete') {
    app.update(tabId)
  }

})

chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  console.log(`@chrome.tabs.onRemoved\n  tabId: ${tabId}\n  removeInfo: ${removeInfo}`)

  app.remove(tabId)
})



/**
 */

chrome.storage.onChanged.addListener((changes, namespace) => {
  console.log(`@chrome.storage.onChanged\n  changes: ${changes}\n  namespace: ${namespace}`)
  console.log(changes)

  console.assert(namespace === 'local')

  if (changes.settings) {
    Vue.set(app, 'settings', changes.settings.newValue)
  } else {
    for (const key in changes) {
      const tabId = Number(key)
      const change = changes[key]
      if (!change.newValue) continue
      app.setThumbnail(tabId, change.newValue.dataUrl)
    }
  }

})