import { computed, ref } from "vue";
import {
  clearAccessToken,
  fetchConsentPolicies,
  loginAccount,
  logoutAccount,
  onSessionExpired,
  refreshSession,
  registerAccount,
  submitConsents,
  withdrawAccount,
} from "../services/authClient.mjs";

let authSingleton = null;

export function useAuthStore() {
  if (authSingleton) return authSingleton;

  const initializing = ref(true);
  const authenticated = ref(false);
  const consentRequired = ref(false);
  const missingRequiredCodes = ref([]);
  const user = ref(null);
  const policies = ref([]);
  const consents = ref([]);
  const busy = ref(false);
  const authError = ref("");

  const canAccessApp = computed(
    () => authenticated.value && !consentRequired.value && Boolean(user.value),
  );

  function applyAuthPayload(payload) {
    authenticated.value = true;
    consentRequired.value = Boolean(payload?.consent_required);
    missingRequiredCodes.value = Array.isArray(payload?.missing_required_codes)
      ? payload.missing_required_codes
      : [];
    user.value = payload?.user || null;
    consents.value = Array.isArray(payload?.consents) ? payload.consents : [];
    authError.value = "";
  }

  function resetAuthState(errorMessage = "") {
    clearAccessToken();
    authenticated.value = false;
    consentRequired.value = false;
    missingRequiredCodes.value = [];
    user.value = null;
    consents.value = [];
    authError.value = errorMessage;
  }

  onSessionExpired(() => {
    resetAuthState("로그인 세션이 만료되었어요. 다시 로그인해 주세요.");
  });

  async function loadPolicies() {
    try {
      policies.value = await fetchConsentPolicies();
    } catch {
      policies.value = [];
    }
  }

  async function bootstrapSession() {
    initializing.value = true;
    authError.value = "";
    try {
      const payload = await refreshSession();
      applyAuthPayload(payload);
    } catch {
      resetAuthState("");
      await loadPolicies();
    } finally {
      initializing.value = false;
    }
  }

  async function login({ loginId, password }) {
    busy.value = true;
    authError.value = "";
    try {
      const payload = await loginAccount({ loginId, password });
      applyAuthPayload(payload);
      return payload;
    } catch (error) {
      authError.value = error.message || "로그인에 실패했어요.";
      throw error;
    } finally {
      busy.value = false;
    }
  }

  async function register({ loginId, email, password, nickname, consentsInput }) {
    busy.value = true;
    authError.value = "";
    try {
      const payload = await registerAccount({
        loginId,
        email,
        password,
        nickname,
        consents: consentsInput,
      });
      applyAuthPayload(payload);
      return payload;
    } catch (error) {
      authError.value = error.message || "회원가입에 실패했어요.";
      throw error;
    } finally {
      busy.value = false;
    }
  }

  async function submitConsentGate(consentsInput) {
    busy.value = true;
    authError.value = "";
    try {
      const payload = await submitConsents(consentsInput);
      applyAuthPayload(payload);
      return payload;
    } catch (error) {
      authError.value = error.message || "동의 처리에 실패했어요.";
      throw error;
    } finally {
      busy.value = false;
    }
  }

  async function toggleOptionalConsent(code, version, agreed) {
    busy.value = true;
    authError.value = "";
    try {
      const payload = await submitConsents([{ code, version, agreed }]);
      applyAuthPayload(payload);
      return payload;
    } catch (error) {
      authError.value = error.message || "동의 설정 변경에 실패했어요.";
      throw error;
    } finally {
      busy.value = false;
    }
  }

  async function logout() {
    busy.value = true;
    try {
      await logoutAccount();
    } catch {
      // Ignore network errors on logout; clear client state regardless.
    } finally {
      resetAuthState("");
      await loadPolicies();
      busy.value = false;
    }
  }

  async function withdraw(password) {
    busy.value = true;
    authError.value = "";
    try {
      await withdrawAccount(password);
      resetAuthState("");
      await loadPolicies();
      return true;
    } catch (error) {
      authError.value = error.message || "회원 탈퇴 처리에 실패했어요.";
      throw error;
    } finally {
      busy.value = false;
    }
  }

  authSingleton = {
    initializing,
    authenticated,
    consentRequired,
    missingRequiredCodes,
    user,
    policies,
    consents,
    busy,
    authError,
    canAccessApp,
    loadPolicies,
    bootstrapSession,
    login,
    register,
    submitConsentGate,
    toggleOptionalConsent,
    logout,
    withdraw,
    resetAuthState,
  };

  return authSingleton;
}
