const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os");
const { pathToFileURL } = require("node:url");
const { chromium } = require(
  process.env.CARDEX_PLAYWRIGHT ||
    path.join(
      os.tmpdir(),
      "aibootcamp-frontend-review/node_modules/playwright",
    ),
);
const base = path.resolve(__dirname, "../docs/wireframes");
(async () => {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(base, "manifest.json"), "utf8"),
  );
  assert.equal(manifest.screens.length, 26);
  assert.equal(new Set(manifest.screens.map((s) => s.id)).size, 26);
  const browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.CARDEX_CHROMIUM ||
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });
  let count = 0;
  const errors = [],
    requests = [];
  try {
    const context = await browser.newContext({ offline: true });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("request", (r) => {
      if (/^https?:/.test(r.url())) requests.push(r.url());
    });
    for (const device of ["desktop", "mobile"])
      for (const screen of manifest.screens) {
        const file = path.join(base, "svg", device, screen.id + ".svg");
        const source = fs.readFileSync(file, "utf8");
        assert.ok(!/<(?:image|foreignObject)\b/i.test(source));
        for (const match of source.matchAll(/data-target="([^"]+)"/g))
          assert.ok(manifest.screens.some((s) => s.id === match[1]));
        await page.goto(pathToFileURL(file).href);
        await page.evaluate(() => document.fonts.ready);
        assert.equal(await page.locator("parsererror").count(), 0);
        const escaped = await page.evaluate(() => {
          const svg = document.documentElement,
            v = svg.viewBox.baseVal;
          return [...document.querySelectorAll("text,rect")]
            .filter((el) => {
              const b = el.getBBox();
              return (
                b.x < -0.5 ||
                b.y < -0.5 ||
                b.x + b.width > v.width + 0.5 ||
                b.y + b.height > v.height + 0.5
              );
            })
            .map((el) => el.textContent || el.outerHTML.slice(0, 80));
        });
        assert.deepEqual(escaped, [], device + "/" + screen.id);
        count++;
      }
    await page.goto(pathToFileURL(path.join(base, "index.html")).href);
    await page.locator("#device").selectOption("mobile");
    await page.locator("#screen").selectOption("WF-06");
    await page.locator('[data-target="WF-02"]').click();
    assert.equal(await page.locator("#screen").inputValue(), "WF-02");
    await page.locator("#back").click();
    assert.equal(await page.locator("#screen").inputValue(), "WF-06");
    await page.locator("#screen").selectOption("WF-08");
    await page.locator('[data-target="WF-10"]').click();
    await page.locator('[data-target="WF-04"]').first().click();
    await page.locator('[data-target="WF-10"]').click();
    await page.locator('[data-target="WF-07"]').first().click();
    assert.equal(await page.locator("#screen").inputValue(), "WF-08");
    for (const size of [
      { width: 1366, height: 768 },
      { width: 390, height: 844 },
      { width: 320, height: 568 },
    ]) {
      await page.setViewportSize(size);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
    }
    const links = await page
      .locator("#frame a[data-target]")
      .evaluateAll((as) => as.map((a) => a.dataset.target));
    assert.ok(links.every((id) => manifest.screens.some((s) => s.id === id)));
    const svg = await page.locator("#frame svg").evaluate((el) => el.outerHTML);
    const actual = fs.readFileSync(
      path.join(base, "svg/mobile/WF-08.svg"),
      "utf8",
    );
    assert.ok(
      svg.includes('viewBox="0 0 390 844"') &&
        actual.includes('viewBox="0 0 390 844"'),
    );
    await page.screenshot({
      path: path.join(os.tmpdir(), "diary-wireframes-mobile.png"),
      fullPage: true,
    });
    assert.deepEqual(errors, []);
    assert.deepEqual(requests, []);
    console.log(
      JSON.stringify(
        {
          svgChecks: count,
          navigation: "passed",
          responsive: "1366 / 390 / 320",
          errors,
          requests,
        },
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
