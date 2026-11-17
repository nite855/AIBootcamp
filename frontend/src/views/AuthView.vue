<script setup>
import { computed, reactive, ref, watch } from "vue";
import { useAuthStore } from "../composables/useAuthStore.js";

const auth = useAuthStore();

const mode = ref("login"); // "login" | "register"
const form = reactive({
  loginId: "",
  email: "",
  password: "",
  nickname: "",
});
const consentChecks = reactive({});
const localError = ref("");

const activeConsentPolicies = computed(() => {
  if (auth.consentRequired.value) {
    return auth.consents.value;
  }
  return auth.policies.value;
});

watch(
  activeConsentPolicies,
  (list) => {
    for (const item of list) {
      if (!(item.code in consentChecks)) {
        consentChecks[item.code] = Boolean(auth.consentRequired.value && item.agreed);
      }
    }
  },
  { immediate: true },
);

const allChecked = computed(
  () =>
    activeConsentPolicies.value.length > 0 &&
    activeConsentPolicies.value.every((p) => Boolean(consentChecks[p.code])),
);

const missingRequired = computed(() =>
  activeConsentPolicies.value.filter((p) => p.is_required && !consentChecks[p.code]),
);

function toggleAllConsents(event) {
  const checked = Boolean(event.target.checked);
  for (const item of activeConsentPolicies.value) {
    consentChecks[item.code] = checked;
  }
}

function switchMode(nextMode) {
  mode.value = nextMode;
  localError.value = "";
  auth.authError.value = "";
  if (nextMode === "register" && !auth.policies.value.length) {
    void auth.loadPolicies();
  }
}

function buildConsentInput() {
  return activeConsentPolicies.value.map((p) => ({
    code: p.code,
    version: p.version,
    agreed: Boolean(consentChecks[p.code]),
  }));
}

async function onLoginSubmit() {
  localError.value = "";
  if (!form.loginId.trim() || !form.password) {
    localError.value = "아이디와 비밀번호를 모두 입력해 주세요.";
    return;
  }
  try {
    await auth.login({
      loginId: form.loginId.trim(),
      password: form.password,
    });
    form.password = "";
  } catch (error) {
    localError.value = error.message || "로그인에 실패했어요.";
  }
}

async function onRegisterSubmit() {
  localError.value = "";
  if (!form.loginId.trim() || !form.email.trim() || !form.password) {
    localError.value = "아이디, 이메일, 비밀번호를 모두 입력해 주세요.";
    return;
  }
  if (missingRequired.value.length > 0) {
    localError.value = `필수 동의 항목을 확인해 주세요: ${missingRequired.value.map((p) => p.title).join(", ")}`;
    return;
  }
  try {
    await auth.register({
      loginId: form.loginId.trim(),
      email: form.email.trim(),
      password: form.password,
      nickname: form.nickname.trim() || null,
      consentsInput: buildConsentInput(),
    });
    form.password = "";
  } catch (error) {
    localError.value = error.message || "회원가입에 실패했어요.";
  }
}

async function onConsentGateSubmit() {
  localError.value = "";
  if (missingRequired.value.length > 0) {
    localError.value = "필수 개인정보 및 민감정보 처리 동의가 완료되어야 이용할 수 있어요.";
    return;
  }
  try {
    await auth.submitConsentGate(buildConsentInput());
  } catch (error) {
    localError.value = error.message || "동의 저장에 실패했어요.";
  }
}

const errorMessage = computed(() => localError.value || auth.authError.value);
</script>

<template>
  <section class="panel auth-panel" aria-labelledby="auth-heading">
    <template v-if="auth.consentRequired.value">
      <div class="auth-head">
        <span class="eyebrow">PRIVACY &amp; SENSITIVE DATA CONSENT</span>
        <h1 id="auth-heading">개인정보 및 민감정보 처리 동의 확인</h1>
        <p class="muted">
          「개인정보 보호법」에 따라 최신 개인정보·민감정보 처리 동의가 필요합니다.
          기존 계정({{ auth.user.value?.login_id }})의 동의를 확인한 뒤 계속 이용해 주세요.
        </p>
      </div>

      <form class="auth-form" @submit.prevent="onConsentGateSubmit">
        <div class="consent-box">
          <label class="consent-all">
            <input
              type="checkbox"
              :checked="allChecked"
              @change="toggleAllConsents"
            />
            <strong>필수 및 선택 동의 항목 모두 동의하기 (개별 선택 가능)</strong>
          </label>

          <div
            v-for="policy in activeConsentPolicies"
            :key="`${policy.code}-${policy.version}`"
            class="consent-item"
            :data-sensitive="String(policy.is_sensitive)"
          >
            <label class="consent-check">
              <input
                v-model="consentChecks[policy.code]"
                type="checkbox"
                :data-consent-code="policy.code"
              />
              <span>
                <strong>{{ policy.title }}</strong>
                <span v-if="policy.is_sensitive" class="consent-badge sensitive">민감정보 별도 동의</span>
                <span v-else-if="policy.is_required" class="consent-badge required">필수</span>
                <span v-else class="consent-badge optional">선택</span>
              </span>
            </label>
            <p class="muted">{{ policy.summary }}</p>
            <details class="consent-details">
              <summary>고지 내용 자세히 보기 (목적·항목·보유기간·거부 시 불이익)</summary>
              <ul>
                <li><strong>수집·이용 목적:</strong> {{ policy.purpose }}</li>
                <li><strong>수집·처리 항목:</strong> {{ policy.items }}</li>
                <li><strong>보유·이용 기간:</strong> {{ policy.retention_period }}</li>
                <li><strong>거부 권리 및 불이익:</strong> {{ policy.refusal_notice }}</li>
              </ul>
            </details>
          </div>
        </div>

        <p v-if="errorMessage" class="auth-error" role="alert">{{ errorMessage }}</p>

        <div class="row">
          <button type="submit" class="primary" :disabled="auth.busy.value">
            {{ auth.busy.value ? "확인 중…" : "동의하고 서비스 계속하기" }}
          </button>
          <button type="button" class="quiet" :disabled="auth.busy.value" @click="auth.logout()">
            로그아웃
          </button>
        </div>
      </form>
    </template>

    <template v-else>
      <div class="auth-head">
        <span class="eyebrow">TODAY'S MOMENT · ACCOUNT</span>
        <h1 id="auth-heading">{{ mode === "login" ? "로그인" : "회원가입" }}</h1>
        <p class="muted">
          계정별 대화·일기 기록과 수집한 감정 카드는 로그인 후 안전하게 보관돼요.
        </p>
      </div>

      <div class="auth-tabs" role="tablist" aria-label="계정 메뉴">
        <button
          type="button"
          role="tab"
          data-auth-tab="login"
          :class="mode === 'login' ? 'primary' : 'quiet'"
          :aria-selected="String(mode === 'login')"
          @click="switchMode('login')"
        >
          로그인
        </button>
        <button
          type="button"
          role="tab"
          data-auth-tab="register"
          :class="mode === 'register' ? 'primary' : 'quiet'"
          :aria-selected="String(mode === 'register')"
          @click="switchMode('register')"
        >
          회원가입
        </button>
      </div>

      <form v-if="mode === 'login'" class="auth-form" @submit.prevent="onLoginSubmit">
        <label class="field">
          <span>아이디</span>
          <input
            id="login-id"
            v-model="form.loginId"
            type="text"
            autocomplete="username"
            placeholder="영문 소문자·숫자 4~32자"
            required
          />
        </label>
        <label class="field">
          <span>비밀번호</span>
          <input
            id="login-password"
            v-model="form.password"
            type="password"
            autocomplete="current-password"
            placeholder="비밀번호 입력"
            required
          />
        </label>

        <p class="muted">
          로그인 시 최신 개인정보·민감정보 처리 동의 여부를 함께 확인해요.
        </p>
        <p v-if="errorMessage" class="auth-error" role="alert">{{ errorMessage }}</p>

        <button type="submit" class="primary" data-action="login-submit" :disabled="auth.busy.value">
          {{ auth.busy.value ? "로그인 중…" : "로그인" }}
        </button>
      </form>

      <form v-else class="auth-form" @submit.prevent="onRegisterSubmit">
        <div class="auth-fields-grid">
          <label class="field">
            <span>아이디 (필수)</span>
            <input
              id="register-login-id"
              v-model="form.loginId"
              type="text"
              autocomplete="username"
              placeholder="영문 소문자·숫자·_.- (4~32자)"
              required
            />
          </label>
          <label class="field">
            <span>이메일 (필수)</span>
            <input
              id="register-email"
              v-model="form.email"
              type="email"
              autocomplete="email"
              placeholder="name@example.com (형식만 확인)"
              required
            />
          </label>
          <label class="field">
            <span>비밀번호 (필수)</span>
            <input
              id="register-password"
              v-model="form.password"
              type="password"
              autocomplete="new-password"
              placeholder="8자 이상"
              required
            />
          </label>
          <label class="field">
            <span>닉네임 (선택)</span>
            <input
              id="register-nickname"
              v-model="form.nickname"
              type="text"
              autocomplete="nickname"
              placeholder="미입력 시 아이디로 표시"
            />
          </label>
        </div>

        <fieldset class="consent-box">
          <legend>개인정보 및 민감정보 제공·활용 동의 (한국 개인정보 보호법 준수)</legend>
          <label class="consent-all">
            <input
              type="checkbox"
              :checked="allChecked"
              @change="toggleAllConsents"
            />
            <strong>전체 동의하기 (선택 기능이며 아래 항목별 개별 선택·해제 가능)</strong>
          </label>

          <div
            v-for="policy in activeConsentPolicies"
            :key="`${policy.code}-${policy.version}`"
            class="consent-item"
            :data-sensitive="String(policy.is_sensitive)"
          >
            <label class="consent-check">
              <input
                v-model="consentChecks[policy.code]"
                type="checkbox"
                :data-consent-code="policy.code"
              />
              <span>
                <strong>{{ policy.title }}</strong>
                <span v-if="policy.is_sensitive" class="consent-badge sensitive">민감정보 별도 동의</span>
                <span v-else-if="policy.is_required" class="consent-badge required">필수</span>
                <span v-else class="consent-badge optional">선택</span>
              </span>
            </label>
            <p class="muted">{{ policy.summary }}</p>
            <details class="consent-details">
              <summary>법정 고지 내용 보기 (목적·항목·보유기간·거부권)</summary>
              <ul>
                <li><strong>수집·이용 목적:</strong> {{ policy.purpose }}</li>
                <li><strong>수집·처리 항목:</strong> {{ policy.items }}</li>
                <li><strong>보유·이용 기간:</strong> {{ policy.retention_period }}</li>
                <li><strong>거부 권리 및 불이익:</strong> {{ policy.refusal_notice }}</li>
              </ul>
            </details>
          </div>
        </fieldset>

        <p v-if="errorMessage" class="auth-error" role="alert">{{ errorMessage }}</p>

        <button type="submit" class="primary" data-action="register-submit" :disabled="auth.busy.value">
          {{ auth.busy.value ? "가입 처리 중…" : "동의하고 가입하기" }}
        </button>
      </form>
    </template>
  </section>
</template>
