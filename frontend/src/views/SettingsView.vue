<script setup>
import { computed, ref } from "vue";
import { THEME_SCENES } from "../services/assets.js";
import { useTheme } from "../composables/useTheme.js";
import { useAuthStore } from "../composables/useAuthStore.js";
import { useDiaryStore } from "../composables/useDiaryStore.js";

const auth = useAuthStore();
const store = useDiaryStore();
const { themes, theme, mode, motion, toggleMotion } = useTheme();

const withdrawPassword = ref("");
const withdrawConfirm = ref(false);
const accountMessage = ref("");
const accountError = ref("");

const selectedTheme = computed(
  () => themes.find((t) => t.id === theme.value) || themes[0] || { id: theme.value, name: theme.value },
);
const modeName = computed(() => (mode.value === "dark" ? "다크" : "라이트"));
const sceneUrl = computed(() => THEME_SCENES[selectedTheme.value.id] || null);

const planSummaryText = computed(() => {
  const plan = store.backupPlan.value;
  if (!plan) return "";
  if (plan.overLimit) return "합친 기록이 100편을 초과해요.";
  if (plan.conflicts) return "내용이 다른 같은 ID가 있어요. 기존 기록은 유지됩니다.";
  return "동일 기록은 건너뛰고 새 기록만 추가해요.";
});

function onBackupFileChange(event) {
  const file = event.target.files?.[0];
  void store.selectBackupFile(file);
}

async function onToggleOptionalConsent(consent, event) {
  accountMessage.value = "";
  accountError.value = "";
  const agreed = Boolean(event.target.checked);
  try {
    await auth.toggleOptionalConsent(consent.code, consent.version, agreed);
    accountMessage.value = agreed
      ? "선택 동의 항목을 허용했어요."
      : "선택 동의 항목을 철회했어요. 기본 서비스는 계속 이용할 수 있어요.";
  } catch (error) {
    accountError.value = error.message || "동의 설정을 변경하지 못했어요.";
    event.target.checked = !agreed;
  }
}

async function onWithdrawSubmit(event) {
  accountMessage.value = "";
  accountError.value = "";
  if (!withdrawPassword.value || !withdrawConfirm.value) {
    accountError.value = "비밀번호 입력과 탈퇴 확인 체크가 필요해요.";
    return;
  }
  const accepted = await store.askConfirm(
    "회원 탈퇴 시 계정, 모든 대화·일기 기록, 수집한 감정 카드 도감 및 개인정보·민감정보가 지체 없이 파기되며 복구할 수 없습니다. 탈퇴를 진행할까요?",
    event.currentTarget,
    { title: "회원 탈퇴 및 정보 파기", accept: "탈퇴 및 파기" },
  );
  if (!accepted) return;

  try {
    await auth.withdraw(withdrawPassword.value);
    store.resetAccountState({ clearDraft: true });
  } catch (error) {
    accountError.value = error.message || "회원 탈퇴에 실패했어요.";
  }
}
</script>

<template>
  <section class="panel settings-panel">
    <div class="row">
      <h2>설정</h2>
    </div>
    <div class="panel-body">
      <fieldset class="account-summary">
        <legend>로그인 계정</legend>
        <div class="row">
          <div>
            <strong>{{ auth.user.value?.nickname || auth.user.value?.login_id }}</strong>
            <small class="muted">
              @{{ auth.user.value?.login_id }} · {{ auth.user.value?.email }}
            </small>
          </div>
          <button
            type="button"
            class="quiet"
            data-action="logout"
            :disabled="auth.busy.value"
            @click="auth.logout()"
          >
            로그아웃
          </button>
        </div>
        <p class="muted">
          기록과 수집한 감정 카드는 로그인 계정에 보관돼요 (계정당 최대 100편).
        </p>
      </fieldset>

      <fieldset v-if="store.legacyMigrationEntries.value.length" class="legacy-migration-box">
        <legend>이 브라우저의 이전 기록 가져오기</legend>
        <p>
          이 브라우저 로컬 저장소에 남아 있던 기록 {{ store.legacyMigrationEntries.value.length }}편이 있어요.
          현재 로그인 계정({{ auth.user.value?.login_id }})으로 가져올까요?
        </p>
        <div class="row">
          <button
            type="button"
            class="primary"
            data-action="migrate-legacy"
            @click="store.migrateLegacyRecords()"
          >
            계정으로 가져오기
          </button>
          <button
            type="button"
            class="quiet"
            data-action="dismiss-legacy"
            @click="store.dismissLegacyMigration()"
          >
            가져오지 않기
          </button>
        </div>
      </fieldset>

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

      <details>
        <summary>기록 방식</summary>
        <p class="muted">작성 화면의 기록 방식을 선택해요.</p>
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
          <p>기록과 즐겨찾기를 JSON 파일로 보관해요. 초안·화면 설정은 포함하지 않아요.</p>
          <p class="muted">계정당 최대 100편 · 편당 10,000자 · 복원 파일 최대 5MiB. 파일에는 일기 원문이 담겨요.</p>
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
          기록 전체 삭제 시 수집·해금된 카드 도감 기록도 함께 삭제되며 2차 확인을 거쳐요.
          <button
            type="button"
            data-action="delete-all"
            class="quiet danger"
            @click="(e) => store.deleteAllRecords(e.currentTarget)"
          >
            계정의 기록 전체 삭제
          </button>
        </p>
      </details>

      <details>
        <summary>개인정보·민감정보 동의 및 회원 탈퇴</summary>
        <div class="consent-box">
          <div
            v-for="item in auth.consents.value"
            :key="`${item.code}-${item.version}`"
            class="consent-item"
          >
            <div class="row">
              <div>
                <strong>{{ item.title }}</strong>
                <span v-if="item.is_sensitive" class="consent-badge sensitive">민감정보</span>
                <span v-else-if="item.is_required" class="consent-badge required">필수</span>
                <span v-else class="consent-badge optional">선택</span>
              </div>
              <label v-if="!item.is_required" class="consent-switch">
                <input
                  type="checkbox"
                  :checked="item.agreed"
                  :disabled="auth.busy.value"
                  @change="(e) => onToggleOptionalConsent(item, e)"
                />
                <span>{{ item.agreed ? "동의함" : "철회됨" }}</span>
              </label>
              <span v-else class="muted">
                {{ item.agreed ? "동의 완료" : "미동의" }}
              </span>
            </div>
            <p class="muted">
              목적: {{ item.purpose }} · 보유기간: {{ item.retention_period }}
            </p>
          </div>
        </div>

        <p v-if="accountMessage" class="muted" role="status">{{ accountMessage }}</p>
        <p v-if="accountError" class="auth-error" role="alert">{{ accountError }}</p>

        <fieldset class="withdraw-box">
          <legend>필수·민감정보 동의 철회 및 회원 탈퇴</legend>
          <p class="muted">
            필수 개인정보 및 민감정보 처리 동의를 철회하면 회원 탈퇴로 처리되어 계정·대화 기록·수집 카드가 지체 없이 파기됩니다.
          </p>
          <label class="field">
            <span>비밀번호 확인</span>
            <input
              v-model="withdrawPassword"
              type="password"
              autocomplete="current-password"
              placeholder="현재 비밀번호 입력"
            />
          </label>
          <label class="consent-check">
            <input v-model="withdrawConfirm" type="checkbox" />
            <span>계정, 대화·일기 기록 및 수집 카드 파기에 동의하며 탈퇴합니다.</span>
          </label>
          <button
            type="button"
            class="quiet danger"
            data-action="withdraw-account"
            :disabled="auth.busy.value"
            @click="onWithdrawSubmit"
          >
            회원 탈퇴 및 정보 파기
          </button>
        </fieldset>
      </details>
    </div>
  </section>
</template>
