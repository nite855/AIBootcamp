<script setup>
import { computed, ref, watch } from "vue";
import { CardexCore, DiaryStatistics } from "../domain/index.js";
import { localDate, useDiaryStore } from "../composables/useDiaryStore.js";

const store = useDiaryStore();
const prevMonthBtnRef = ref(null);
const nextMonthBtnRef = ref(null);

const thisMonth = computed(() => localDate().slice(0, 7));

const stats = computed(() =>
  DiaryStatistics.monthSummary(store.queryRecords({ month: store.state.month }), store.state.month),
);

const availableDays = computed(() =>
  store.state.statsTab === "trend"
    ? stats.value.days.filter((x) => x.summary.validCount)
    : stats.value.days,
);

watch(
  availableDays,
  (list) => {
    if (!list.some((x) => x.date === store.state.statsDate)) {
      store.state.statsDate = list.at(-1)?.date || "";
    }
  },
  { immediate: true },
);

const selectedDay = computed(
  () => stats.value.days.find((x) => x.date === store.state.statsDate) || null,
);

const insight = computed(() => {
  if (!stats.value.total) return null;
  const s = DiaryStatistics.insight(stats.value);
  if (!s.ready) return { ready: false, valid: s.valid };
  const names = s.leafTies.map((id) => CardexCore.type(id).name).join("·");
  const parents = CardexCore.PARENTS.map(
    (p) => `${p.name} ${CardexCore.percent(s.parents[p.id])}`,
  ).join(" · ");
  return {
    ready: true,
    valid: s.valid,
    evenSpread: s.leafTies.length >= 3,
    tied: s.leafTies.length > 1,
    names,
    parents,
  };
});

const calendarData = computed(() => {
  const firstWeekday = new Date(`${store.state.month}-01T12:00:00`).getDay();
  const todayStr = localDate();
  const cells = stats.value.days.map((day, idx) => {
    const dayNum = idx + 1;
    const count = day.count || 0;
    const emotion = DiaryStatistics.dayEmotion(day);
    const isToday = day.date === todayStr;
    const label = `${day.date}${isToday ? ", 오늘" : ""}, 기록 ${count}편${
      emotion ? ", 대표 감정 " + CardexCore.type(emotion).name : ""
    }`;
    return {
      date: day.date,
      dayNum,
      count,
      emotion,
      isToday,
      label,
    };
  });
  return { firstWeekday, cells };
});

const trendChart = computed(() => {
  const days = stats.value.days;
  const x = (i) => 42 + (i * 640) / Math.max(1, days.length - 1);
  const y = (v) => 185 - v * 150;

  const guides = [0, 0.5, 1].map((value) => ({
    value,
    y: y(value),
    label: `${value * 100}%`,
  }));

  const series = CardexCore.PARENTS.map((p, index) => {
    const dash = ["0", "9 6", "2 6"][index];
    const points = days.map((d, i) =>
      d.summary.validCount ? [x(i), y(d.summary.parents[p.id])] : null,
    );
    const runs = DiaryStatistics.smoothSegments(points)
      .filter((run) => run.points.length > 1)
      .map((run) => ({
        areaD: `${run.d}L${run.end[0]} 185L${run.start[0]} 185Z`,
        lineD: run.d,
      }));
    const dots = days
      .map((d, i) =>
        d.summary.validCount
          ? {
              cx: x(i),
              cy: y(d.summary.parents[p.id]),
              title: `${i + 1}일 · ${p.name} ${CardexCore.percent(d.summary.parents[p.id])}`,
            }
          : null,
      )
      .filter(Boolean);
    return { id: p.id, name: p.name, dash, runs, dots };
  });

  const xLabels = days
    .map((d, i) =>
      i === 0 || i === days.length - 1 || (i + 1) % 5 === 0
        ? { x: x(i), text: `${i + 1}일` }
        : null,
    )
    .filter(Boolean);

  return { guides, series, xLabels };
});

const selectedDetailsText = computed(() => {
  const d = selectedDay.value;
  if (!d) return "";
  if (!d.summary.validCount) return `${d.count}편 · 감정 분석 없음`;
  const parts = CardexCore.PARENTS.map(
    (p) => `${p.name} ${CardexCore.percent(d.summary.parents[p.id])}`,
  ).join(" · ");
  return `${d.count}편 · ${parts}`;
});

function stepMonth(step) {
  store.state.month = DiaryStatistics.shiftMonth(store.state.month, step, thisMonth.value);
  store.state.statsDate = "";
  const target = step < 0 ? prevMonthBtnRef.value : nextMonthBtnRef.value;
  if (target?.disabled) {
    (step < 0 ? nextMonthBtnRef.value : prevMonthBtnRef.value)?.focus();
  }
}

function onMonthInputChange(event) {
  const value = event.target.value;
  if (!event.target.validity.valid || !/^\d{4}-\d{2}$/.test(value) || value > thisMonth.value) {
    event.target.value = store.state.month;
    return;
  }
  store.state.month = value;
  store.state.statsDate = "";
}

function openDateRecords(dateStr) {
  const sameDay = store.queryRecords({ date: dateStr });
  if (sameDay.length === 1) {
    store.state.dateFilter = dateStr;
    store.state.archiveTab = "records";
    store.state.returnToStats = true;
    store.state.entryFrom = "history";
    store.state.selected = sameDay[0].id;
    store.state.recordTab = "card";
    store.state.view = "entry";
    store.state.editing = false;
    store.state.deleteConfirm = false;
    return;
  }
  store.state.dateFilter = dateStr;
  store.state.page = 0;
  store.state.archiveTab = "records";
  store.state.search = "";
  store.state.favoritesOnly = false;
  store.state.returnToStats = true;
}

function onChartClick(event) {
  const rect = event.currentTarget.getBoundingClientRect();
  const fraction = Math.max(
    0,
    Math.min(1, (((event.clientX - rect.left) / rect.width) * 720 - 42) / 640),
  );
  const count = stats.value.days.length;
  const date = `${store.state.month}-${String(Math.round(fraction * (count - 1)) + 1).padStart(2, "0")}`;
  if (availableDays.value.some((d) => d.date === date)) {
    store.state.statsDate = date;
  }
}
</script>

<template>
  <section class="panel archive-panel">
    <div class="row">
      <h2>감정 통계</h2>
    </div>

    <div class="month-nav">
      <button
        ref="prevMonthBtnRef"
        type="button"
        class="quiet"
        data-month-step="-1"
        aria-label="이전 달"
        @click="stepMonth(-1)"
      >
        ‹ 이전 달
      </button>
      <button
        ref="nextMonthBtnRef"
        type="button"
        class="quiet"
        data-month-step="1"
        aria-label="다음 달"
        :disabled="store.state.month >= thisMonth"
        @click="stepMonth(1)"
      >
        다음 달 ›
      </button>
    </div>

    <p v-if="insight && !insight.ready" class="month-insight muted" data-ready="false">
      분석된 기록이 {{ DiaryStatistics.INSIGHT_MINIMUM }}편 이상이면 이번 달 요약을 보여 드려요. (지금 {{ insight.valid }}편)
    </p>
    <p v-else-if="insight && insight.ready" class="month-insight" data-ready="true">
      <template v-if="insight.evenSpread">
        분석된 {{ insight.valid }}편에서 <strong>여러 감정이 고르게</strong> 나타났어요.
      </template>
      <template v-else>
        분석된 {{ insight.valid }}편에서 가장 큰 비중은 <strong>{{ insight.names }}</strong>{{ insight.tied ? "(같은 비중)" : "" }}이에요.
      </template>
      <span class="muted"> {{ insight.parents }} · 감정의 강도가 아닌 분류 확률이에요.</span>
    </p>

    <div class="month-controls">
      <label>
        월
        <input
          id="stats-month"
          type="month"
          :value="store.state.month"
          :max="thisMonth"
          @change="onMonthInputChange"
        />
      </label>
      <label>
        통계
        <select id="stats-kind" v-model="store.state.statsTab">
          <option value="trend">감정 추이</option>
          <option value="count">월간 기록</option>
          <option value="distribution">감정 분포</option>
        </select>
      </label>
    </div>

    <template v-if="store.state.statsTab === 'count'">
      <div class="month-summary">
        <strong>{{ stats.total }}편의 기록</strong>
        <span>{{ stats.writtenDays }}일의 순간</span>
      </div>
      <p class="muted">
        날짜를 누르면 그날의 글을 읽을 수 있어요. 점은 그날 분석된 대표 감정이에요. 미분석 기록에는 감정 색을 붙이지 않아요.
      </p>
      <div class="calendar-grid">
        <span v-for="w in ['일', '월', '화', '수', '목', '금', '토']" :key="w" class="weekday">{{ w }}</span>
        <span v-for="n in calendarData.firstWeekday" :key="'pad-' + n" aria-hidden="true" />
        <button
          v-for="cell in calendarData.cells"
          :key="cell.date"
          type="button"
          class="calendar-day"
          :class="{ 'has-records': cell.count, 'is-today': cell.isToday }"
          :data-month-date="cell.date"
          :aria-label="cell.label"
          :aria-current="cell.isToday ? 'date' : undefined"
          @click="openDateRecords(cell.date)"
        >
          <strong>{{ cell.dayNum }}</strong>
          <span>{{ cell.count ? cell.count + "편" : "·" }}</span>
          <i
            v-if="cell.emotion"
            class="day-emotion"
            :style="{ background: `var(--${cell.emotion})` }"
            aria-hidden="true"
          />
        </button>
      </div>
    </template>

    <template v-else>
      <p class="muted">
        {{ store.state.mode === "example" ? "예시 통계 · 실제 사용자 분석 아님" : "내 기록 통계 · 감정 분석은 준비 중" }}
      </p>
      <div class="stats-summary">
        기록 <strong>{{ stats.total }}</strong>편 · 작성한 날 <strong>{{ stats.writtenDays }}</strong>일<br />
        <small>
          분석 {{ stats.valid }}편 · 미분석 {{ stats.missing }}편{{
            store.state.statsTab === "trend" && availableDays.length === 1
              ? " · 비교할 날짜가 더 필요해요."
              : ""
          }}
        </small>
      </div>

      <div
        class="graph-space"
        :class="{ 'distribution-space': store.state.statsTab === 'distribution' }"
        :tabindex="store.state.statsTab === 'distribution' ? 0 : undefined"
        :role="store.state.statsTab === 'distribution' ? 'region' : undefined"
        :aria-label="store.state.statsTab === 'distribution' ? '감정 분포 상세' : undefined"
      >
        <div v-if="!stats.total" class="stats-empty">
          <p>아직 이 달의 기록이 없어요.</p>
          <button
            type="button"
            data-action="archive-records"
            class="quiet"
            @click="store.navigateTab('records')"
          >
            지난 기록 보기
          </button>
        </div>

        <div v-else-if="!stats.valid" class="stats-empty">
          <p>감정 분석은 준비 중이에요. 기록은 보관함에서 읽을 수 있어요.</p>
          <button
            type="button"
            data-action="archive-records"
            class="quiet"
            @click="store.navigateTab('records')"
          >
            지난 기록 보기
          </button>
        </div>

        <template v-else-if="store.state.statsTab === 'distribution'">
          <div class="distribution" aria-label="분석된 기록의 평균 분류 확률">
            <section
              v-for="p in CardexCore.PARENTS"
              :key="p.id"
              class="distribution-group"
              :aria-label="p.name"
            >
              <h3>
                {{ p.name }}<span>{{ CardexCore.percent(stats.distribution.parents[p.id]) }}</span>
              </h3>
              <div v-for="id in p.children" :key="id" class="distribution-row">
                <span>{{ CardexCore.type(id).name }}</span>
                <div>
                  <i
                    :style="{
                      width: `${stats.distribution.leaf[id] * 100}%`,
                      background: `var(--${id})`,
                    }"
                  />
                </div>
                <strong>{{ CardexCore.percent(stats.distribution.leaf[id]) }}</strong>
              </div>
            </section>
          </div>
          <p class="muted">
            분석된 기록의 평균 분류 확률이에요. 중립에는 객관적 서술·의문·놀람·당황을 포함해요.
          </p>
        </template>

        <template v-else>
          <svg
            class="stats-chart"
            viewBox="0 0 720 225"
            role="img"
            aria-label="날짜별 감정 비중, 기록 없는 구간은 공백"
            @click="onChartClick"
          >
            <defs>
              <linearGradient
                v-for="s in trendChart.series"
                :id="`trend-fill-${s.id}`"
                :key="s.id"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0" :stop-color="`var(--${s.id})`" stop-opacity=".26" />
                <stop offset="1" :stop-color="`var(--${s.id})`" stop-opacity="0" />
              </linearGradient>
            </defs>
            <g v-for="g in trendChart.guides" :key="g.value">
              <path
                :class="g.value ? 'chart-guide' : 'chart-base'"
                :d="`M42 ${g.y}H690`"
              />
              <text x="34" :y="g.y + 4" text-anchor="end">{{ g.label }}</text>
            </g>
            <template v-for="s in trendChart.series" :key="'series-' + s.id">
              <path
                v-for="(r, idx) in s.runs"
                :key="'area-' + s.id + '-' + idx"
                class="chart-area"
                :d="r.areaD"
                :fill="`url(#trend-fill-${s.id})`"
              />
              <path
                v-for="(r, idx) in s.runs"
                :key="'line-' + s.id + '-' + idx"
                class="chart-line"
                :d="r.lineD"
                :stroke="`var(--${s.id})`"
                :stroke-dasharray="s.dash"
              />
              <circle
                v-for="(dot, idx) in s.dots"
                :key="'dot-' + s.id + '-' + idx"
                class="chart-dot"
                :cx="dot.cx"
                :cy="dot.cy"
                r="4.5"
                :fill="`var(--${s.id})`"
              >
                <title>{{ dot.title }}</title>
              </circle>
            </template>
            <text
              v-for="lbl in trendChart.xLabels"
              :key="lbl.text"
              :x="lbl.x"
              y="211"
              text-anchor="middle"
            >
              {{ lbl.text }}
            </text>
          </svg>
          <div class="stats-legend">
            <span
              v-for="(p, i) in CardexCore.PARENTS"
              :key="p.id"
              class="legend-chip"
              :style="{ '--chip': `var(--${p.id})` }"
            >
              <svg width="22" height="8" aria-hidden="true">
                <path
                  d="M1 4H21"
                  :stroke="`var(--${p.id})`"
                  stroke-width="3"
                  stroke-linecap="round"
                  :stroke-dasharray="['0', '6 4', '2 4'][i]"
                />
              </svg>
              {{ p.name }}
            </span>
            <span class="legend-chip legend-gap" style="--chip: var(--muted)">
              <svg width="22" height="8" aria-hidden="true">
                <path
                  d="M1 4H7M15 4H21"
                  stroke="var(--muted)"
                  stroke-width="3"
                  stroke-linecap="round"
                />
              </svg>
              선 끊김 = 분석 없는 날
            </span>
          </div>
        </template>
      </div>

      <div v-if="store.state.statsTab !== 'distribution' && availableDays.length" class="stats-detail">
        <label>
          날짜
          <select id="stats-date" v-model="store.state.statsDate">
            <option v-for="d in availableDays" :key="d.date" :value="d.date">
              {{ d.date }}
            </option>
          </select>
        </label>
        <button
          type="button"
          data-action="date-records"
          class="quiet"
          @click="openDateRecords(store.state.statsDate)"
        >
          기록 보기
        </button>
        <p>{{ selectedDetailsText }}</p>
      </div>
      <p v-else class="muted">감정 비중은 감정의 강도나 심리 점수가 아니에요.</p>
    </template>
  </section>
</template>
