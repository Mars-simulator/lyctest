<script setup>
/**
 * 子应用宿主页。
 * 只要保证 #sub-container 在 qiankun 挂载时存在即可，
 * 具体渲染什么完全由子应用决定。
 */
</script>

<template>
  <section class="page">
    <header class="page-header">
      <h1>子应用（qiankun 微前端）</h1>
      <p class="desc">
        下面的内容由独立的子应用渲染，主应用只负责提供容器、路由与共享状态。
      </p>
    </header>

    <!-- qiankun 会把子应用的 DOM 注入到这里 -->
    <div id="sub-container" class="sub-container"></div>
  </section>
</template>
