<template>
  <div style="position: relative">
    <div style="min-height: 36px">
      <slot name="prepend"/>
    </div>
    <div :style="'position: absolute; top: 0;' + ($vuetify.rtl ? 'left: 0' : 'right: 0')">
      <v-btn icon
             :disabled="!canScrollBackward"
             @click="doScroll('backward')">
        <rtl-icon icon="mdi-chevron-left" rtl="mdi-chevron-right"/>
      </v-btn>
      <v-btn icon
             :disabled="!canScrollForward"
             @click="doScroll('forward')">
        <rtl-icon icon="mdi-chevron-right" rtl="mdi-chevron-left"/>
      </v-btn>
    </div>

    <div class="scrolling-wrapper"
         :id="id"
         :ref="id"
         @scroll="computeScrollability"
         v-resize="computeScrollability"
    >
      <slot name="content" class="content"/>
    </div>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import RtlIcon from '@/components/RtlIcon.vue'

export default Vue.extend({
  name: 'HorizontalScroller',
  components: {RtlIcon},
  data: function () {
    const uniqueId = this.$_.uniqueId()
    return {
      id: uniqueId,
      canScrollBackward: false,
      canScrollForward: true,
      container: this.$refs[uniqueId] as HTMLElement,
      adjustment: 100,
    }
  },
  mounted() {
    this.container = this.$refs[this.id] as HTMLElement
    this.computeScrollability()
  },
  methods: {
    computeScrollability() {
      if (this.container !== undefined) {
        if (this.$vuetify.rtl) {
          this.canScrollBackward = Math.round(this.container.scrollLeft) < 0
          this.canScrollForward = (Math.round(this.container.scrollLeft) - this.container.clientWidth) > -this.container.scrollWidth
        } else {
          this.canScrollBackward = Math.round(this.container.scrollLeft) > 0
          this.canScrollForward = (Math.round(this.container.scrollLeft) + this.container.clientWidth) < this.container.scrollWidth
        }
      }
    },
    doScroll(direction: string) {
      if (this.container !== undefined) {
        let increment = (this.container.clientWidth - this.adjustment)
        let scrollLeft = Math.round(this.container.scrollLeft)
        let target
        if (this.$vuetify.rtl) {
          if (direction === 'backward')
            target = scrollLeft + increment
          else
            target = scrollLeft - increment
        } else {
          if (direction === 'backward')
            target = scrollLeft - increment
          else
            target = scrollLeft + increment
        }
        this.container.scrollTo({
          top: 0,
          left: target,
          behavior: 'smooth',
        })
      }
    },
  },
})
</script>

<style scoped>
.scrolling-wrapper {
  -webkit-overflow-scrolling: touch;
  display: flex;
  flex-wrap: nowrap;
  overflow-x: auto;
}

.scrolling-wrapper::-webkit-scrollbar {
  display: none;
}

.content {
  flex: 0 0 auto
}
</style>
