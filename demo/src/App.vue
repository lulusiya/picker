<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import TargetCard from './components/TargetCard.vue'

const helpDialog = ref<HTMLDialogElement | null>(null)

function openHelp() {
  helpDialog.value?.showModal()
}

function handleShortcut(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    openHelp()
  }
}

onMounted(() => window.addEventListener('keydown', handleShortcut))
onBeforeUnmount(() => window.removeEventListener('keydown', handleShortcut))
</script>

<template>
  <header class="site-header">
    <a class="brand" href="#playground">PickAI / Demo</a>
    <button class="command" type="button" aria-label="打开操作说明" @click="openHelp">
      <span>操作说明</span><kbd>Ctrl K</kbd>
    </button>
  </header>

  <main id="playground">
    <section class="intro">
      <p class="intro__status"><span></span>等待选取</p>
      <h1>验证元素定位，<br />不离开当前页面。</h1>
      <p class="intro__copy">
        按住 Alt 并点击下面任意元素。确认弹窗中的提示词可以组合源码位置与组件层级。
      </p>
    </section>

    <section class="playground" aria-labelledby="targets-title">
      <div class="playground__head">
        <h2 id="targets-title">选取目标</h2>
        <p>两个 Vue 组件实例，内部包含不同层级的原生 DOM。</p>
      </div>
      <div class="target-grid">
        <TargetCard
          title="Source Location"
          description="选择标题、段落或按钮，检查 src 是否包含绝对路径与准确行列。"
          tone="source"
        />
        <TargetCard
          title="Component Range"
          description="选择卡片内部元素，检查 range 是否显示 App > TargetCard。"
          tone="range"
        />
      </div>
    </section>

    <section class="checklist" aria-labelledby="checklist-title">
      <h2 id="checklist-title">手动验收</h2>
      <ol>
        <li><span>01</span>Alt 点击后，移动鼠标不改变已选目标。</li>
        <li><span>02</span>点击弹窗外部，弹窗与高亮同时消失。</li>
        <li><span>03</span>点击复制，底部提示“已保存到剪贴板”。</li>
      </ol>
    </section>
  </main>

  <footer>
    <p>PickAI Vue 3 integration · local package · development only</p>
  </footer>

  <dialog ref="helpDialog" @click.self="helpDialog?.close()">
    <div class="dialog__content">
      <h2>操作说明</h2>
      <p>按住 Alt，将鼠标移到目标元素并点击。输入修改要求后选择复制或暂存。</p>
      <button type="button" @click="helpDialog?.close()">关闭</button>
    </div>
  </dialog>
</template>
