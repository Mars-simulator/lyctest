<script setup>
import { ref } from 'vue';
import { globalState } from '../bus.js';

const count = ref(0);
</script>

<template>
  <section class="page">
    <h1>主应用首页</h1>
    <p class="desc">
      这是一个 Vue3 + Vite 的 qiankun 主应用。点击左侧「子应用」会加载独立部署的 Vue3 子应用，
      它的 DOM 会被挂载到本页的 <code>#sub-container</code> 中。
    </p>

    <div class="cards">
      <div class="card">
        <h3>主应用本地状态</h3>
        <p class="metric">{{ count }}</p>
        <button class="btn" @click="count++">点我 +1</button>
      </div>

      <div class="card">
        <h3>共享状态（会传给子应用）</h3>
        <p>用户：<b>{{ globalState.user.name }}</b></p>
        <p>主题：<b>{{ globalState.theme }}</b></p>
        <p>子应用消息数：<b>{{ globalState.messageCount }}</b></p>
      </div>

      <div class="card">
        <h3>架构说明</h3>
        <ul class="list">
          <li>主应用：5173（Vue3 + vite + vue-router）</li>
          <li>子应用：5174（Vue3 + vite + vite-plugin-qiankun）</li>
          <li>通信：props 传状态 + 事件总线发通知</li>
        </ul>
      </div>
    </div>
  </section>
</template>
