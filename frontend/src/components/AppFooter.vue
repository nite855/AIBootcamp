<script setup>
defineProps({
  statusMessage: {
    type: String,
    default: "",
  },
  isError: {
    type: Boolean,
    default: false,
  },
});
</script>

<template>
  <div>
    <p
      id="feedback"
      class="status"
      :class="{ error: isError }"
      :role="isError ? 'alert' : 'status'"
    >
      {{ statusMessage }}
    </p>
    <footer>
      <span>EVERY DAY IS A LITTLE ART.</span>
      <span>나만의 속도로 기록해요 ✧</span>
    </footer>
  </div>
</template>
