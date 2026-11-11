<script setup>
import { computed } from 'vue';
import { globalState } from './bus.js';

const themeLabel = computed(() => (globalState.theme === 'light' ? '切换到暗色' : '切换到亮色'));

function toggleTheme() {
  globalState.theme = globalState.theme === 'light' ? 'dark' : 'light';
}
</script>

<template>
  <div class="layout">
    <aside class="sidebar">
      <div class="brand">
        <span class="logo">Q</span>
        <div>
          <strong>主应用</strong>
          <small>qiankun container</small>
        </div>
      </div>

      <nav class="nav">
        <router-link to="/" class="nav-item">首页</router-link>
        <router-link to="/sub-app" class="nav-item">子应用</router-link>
      </nav>

      <div class="sidebar-footer">
        <div class="user">{{ globalState.user.name }} · {{ globalState.user.role }}</div>
        <div class="hint">子应用消息：{{ globalState.messageCount }}</div>
        <button class="btn ghost" @click="toggleTheme">{{ themeLabel }}</button>
      </div>
    </aside>

    <main class="content">
      <router-view />
    </main>
  </div>
</template>
