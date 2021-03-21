<template>
<div class="tab-card"
  :class="[ `tab-card-index-${index}` ]"
  tabindex="0"
  @keydown="onkeydown"
  @keydown.enter="jump"
  @keydown.delete="close"
>

  <div class="card-thumbnail">
    <img :src="tab.thumbnail || tab.favIconUrl" @click="updateThumbnail" />
    <div class="thumbnail-overlap">
      <i class="material-icons" @click="jump">north_east</i>
      <i class="material-icons" @click="close">close</i>
    </div>
  </div>

  <div class="card-content">
    <div class="card-title"><b>{{ tab.title }}</b></div>
    <div v-if="debug">
      id: {{ tab.id }}<br>
      windowId: {{ tab.windowId }}<br>
      thumbnail: {{ tab.thumbnail?.length / 1024 }} kb<br>
      url: {{ tab.url }}<br>
    </div>
  </div>

  <div class="card-footer">
    <img :src="tab.favIconUrl" width="16" height="16" />
    <span class="host">{{ host }}</span>
    <span style="margin-left: auto;">{{ index + 1 }}</span>
  </div>

</div>
</template>


<script>
module.exports = {
  props: [ 'tab', 'index', 'debug' ],
  data () { return {} },
  computed: {
    host () {
      const regx = /^.+?:\/\/(?<host>[^\/]+)\//
      return this.tab.url.match(regx)?.groups.host || ''
    },
  },
  methods: {
    updateThumbnail () {
      getThumbnail(this.tab.id).then(thumbnail => {
        this.$set(this.tab, 'thumbnail', thumbnail)
      })
    },
    jump () {
      chrome.tabs.update(this.tab.id, { active: true })
    },
    close () {
      this.$root.focusTab(Math.max(this.index - 1, 0))
      chrome.tabs.remove(this.tab.id)
    },
    onkeydown (event) {
      const gridComputedStyle = window.getComputedStyle(document.querySelector('.tab-cards'))
      const gridColumnCount = gridComputedStyle.getPropertyValue('grid-template-columns').split(' ').length
      const shift = event.key === 'ArrowRight' ? 1
        :           event.key === 'ArrowLeft'  ? -1
        :           event.key === 'ArrowUp'    ? -gridColumnCount
        :           event.key === 'ArrowDown'  ? gridColumnCount
        :           0
      this.$root.focusTab(this.index + shift)
    },
  },
}
</script>


<style scoped>
.tab-card {
  border-bottom: solid 1px #ddd;
  display: grid;
  grid-template:
    "thumbnail" auto
    "content  " 1fr
    "footer   " auto
    /     100%;
  grid-template-rows: auto 1fr auto;
  padding: 1px; /* focus時にoutlineに重ならないようにする */
}

.card-thumbnail {
  height: 180px;
  background-color: #ddd;
  border: 1px solid #ddd;
  border-radius: 6px;
  position: relative;
  overflow: hidden;
}
.card-thumbnail > img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.card-thumbnail > .thumbnail-overlap {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  color: #fff;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 36px;
  opacity: 0;
  transition: opacity .3s ease;
}
.card-thumbnail > .thumbnail-overlap:hover {
  opacity: 1;
}
.card-thumbnail > .thumbnail-overlap > i {
  font-size: 48px;
  font-weight: bold;
  cursor: pointer;
}

.card-content {
  overflow: hidden;
  word-break: normal;
  padding: 6px 6px 0;
}
.card-title {
  font-size: 18px;
}

.card-footer {
  overflow: hidden;
  padding: 16px 2px 2px 2px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.card-footer > span {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 16px;
}
.card-footer > .host {
  font-size: 14px;
}
</style>