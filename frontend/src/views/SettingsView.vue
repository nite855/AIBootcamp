<script setup>
import { computed } from "vue";
import { THEME_SCENES } from "../services/assets.js";
import { useTheme } from "../composables/useTheme.js";
import { useDiaryStore } from "../composables/useDiaryStore.js";

const store = useDiaryStore();
const { themes, theme, mode, motion, toggleMotion } = useTheme();

const selectedTheme = computed(
  () => themes.find((t) => t.id === theme.value) || themes[0] || { id: theme.value, name: theme.value },
);
const modeName = computed(() => (mode.value === "dark" ? "다크" : "라이트"));
const sceneUrl = computed(() => THEME_SCENES[selectedTheme.value.id] || null);

const planSummaryText = computed(() => {
  const plan = store.backupPlan.value;
  if (!plan) return "";
  if (plan.overLimit) return "합친 기록이 30편을 초과해요.";
  if (plan.conflicts) return "내용이 다른 같은 ID가 있어요. 기존 기록은 유지됩니다.";
  return "동일 기록은 건너뛰고 새 기록만 추가해요.";
});

function onBackupFileChange(event) {
  const file = event.target.files?.[0];
  void store.selectBackupFile(file);
}
</script>

<template>
  <section class="panel settings-panel">
    <div class="row">
      <h2>설정</h2>
    </div>
    <div class="panel-body">
      <fieldset>
        <legend>화면 테마</legend>
        <button
          type="button"
          class="theme-settings-link"
          data-action="theme-gallery"
          @click="store.state.view = 'themes'"
        >
          <span class="theme-chip" :data-appearance="selectedTheme.id" aria-hidden="true">
            <img v-if="sceneUrl" class="theme-scenery" :src="sceneUrl" alt="" />
            <span v-else class="theme-scenery abstract-scenery" aria-hidden="true">✦</span>
          </span>
          <span>
            <strong>{{ selectedTheme.name }}</strong>
            <small>{{ modeName }} · 테마 둘러보기</small>
          </span>
          <span aria-hidden="true">›</span>
        </button>
      </fieldset>

      <fieldset>
        <legend>카드 효과</legend>
        <button
          type="button"
          class="quiet"
          data-card-motion-toggle
          :aria-pressed="String(motion === 'on')"
          aria-describedby="card-motion-help"
          @click="toggleMotion()"
        >
          {{ motion === "on" ? "카드 효과 켜짐" : "카드 효과 꺼짐" }}
        </button>
        <p id="card-motion-help" class="muted">
          버튼을 누르면 카드 효과를 켜거나 꺼요. 켜면 기기의 움직임 줄이기 설정과 관계없이
          빛·기울임·뒤집기 효과를 사용해요. 모바일에서는 본문 밖을 터치하고 움직여 보세요.
        </p>
      </fieldset>

      <p class="muted">디자인 선택을 이 브라우저에 보관해요.</p>

      <details>
        <summary>기록 방식</summary>
        <p class="muted">기록 방식도 이 브라우저에 보관해요.</p>
        <label class="settings-option">
          <input
            type="radio"
            name="policy"
            value="single"
            :checked="store.state.policy === 'single'"
            @change="store.setPolicy('single')"
          />
          <span>하루 한 편<br /><small class="muted">오늘의 기록을 이어서 수정해요.</small></span>
        </label>
        <label class="settings-option">
          <input
            type="radio"
            name="policy"
            value="multi"
            :checked="store.state.policy === 'multi'"
            @change="store.setPolicy('multi')"
          />
          <span>하루 여러 편<br /><small class="muted">순간마다 새로운 기록을 남겨요.</small></span>
        </label>
      </details>

      <details :open="Boolean(store.backupPlan.value)">
        <summary>데이터 관리</summary>
        <fieldset class="backup-panel">
          <legend>기록 보관하기</legend>
          <p>기록과 즐겨찾기를 JSON 파일로 보관해요. 초안·예시·화면 설정은 포함하지 않아요.</p>
          <p class="muted">최대 30편 · 편당 10,000자 · 복원 파일 최대 5MiB. 파일에는 일기 원문이 담겨요.</p>
          <div class="row">
            <button
              type="button"
              data-action="export-backup"
              class="quiet"
              @click="store.exportBackup()"
            >
              기록 내보내기
            </button>
            <label class="quiet file-label">
              백업 파일 선택
              <input
                id="backup-file"
                type="file"
                accept="application/json,.json"
                @change="onBackupFileChange"
              />
            </label>
          </div>
          <div id="backup-preview" role="status">
            <template v-if="store.backupPlan.value">
              <p>
                추가 {{ store.backupPlan.value.added }}편 · 동일
                {{ store.backupPlan.value.duplicates }}편 · 충돌
                {{ store.backupPlan.value.conflicts }}편
              </p>
              <p>{{ planSummaryText }}</p>
              <button
                type="button"
                data-action="confirm-import"
                class="primary"
                :disabled="
                  !store.backupPlan.value.allowed ||
                  !store.backupPlan.value.added ||
                  store.restoringBackup.value
                "
                @click="store.confirmBackupImport()"
              >
                확인하고 합치기
              </button>
              <button
                type="button"
                data-action="cancel-import"
                class="quiet"
                @click="store.cancelBackupImport()"
              >
                취소
              </button>
            </template>
            <template v-else>파일을 선택하면 합칠 내용을 먼저 확인할 수 있어요.</template>
          </div>
        </fieldset>
        <p class="muted">
          기록은 이 브라우저에만 보관돼요. 계정·동기화·서버 백업은 제공하지 않아요.
          <button
            type="button"
            data-action="delete-all"
            class="quiet danger"
            @click="(e) => store.deleteAllRecords(e.currentTarget)"
          >
            {{ store.state.clearAllConfirm ? "정말 모든 기록 삭제" : "이 브라우저의 기록 전체 삭제" }}
          </button>
        </p>
      </details>

      <details>
        <summary>예시 모드</summary>
        <label>
          <input
            type="checkbox"
            role="switch"
            data-action="preview"
            :checked="store.state.mode === 'example'"
            @change="store.toggleExampleMode()"
          />
          예시 모드 둘러보기
        </label>
      </details>
    </div>
  </section>
</template>
