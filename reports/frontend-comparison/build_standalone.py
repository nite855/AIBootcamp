"""Bundle the report and its linked files: python reports/frontend-comparison/build_standalone.py."""

import base64
import json
import re
from html import unescape
from pathlib import Path
from urllib.parse import urlsplit


REPORT_DIR = Path(__file__).resolve().parent
ROOT = REPORT_DIR.parent.parent
ATTRIBUTE = re.compile(r'\b(?P<name>href|src)=(?P<quote>["\'])(?P<value>.*?)(?P=quote)')


def build() -> Path:
    """Keep index.html intact and embed every local link target once."""
    source = (REPORT_DIR / "index.html").read_text(encoding="utf-8")
    resources: dict[str, dict[str, str]] = {}
    resource_ids: dict[Path, str] = {}

    def embed(match: re.Match[str]) -> str:
        value = unescape(match["value"])
        url = urlsplit(value)
        if not value or value.startswith("#") or url.scheme or url.netloc:
            return match[0]
        if url.query or url.fragment:
            raise ValueError(f"Unsupported local URL: {value}")
        path = (REPORT_DIR / value).resolve()
        if not path.is_relative_to(ROOT):
            raise ValueError(f"Link escapes the project: {value}")
        if not path.is_file():
            raise FileNotFoundError(f"Missing report resource: {value}")
        if path not in resource_ids:
            key = f"resource-{len(resources)}"
            resource_ids[path] = key
            mime = {".png": "image/png", ".html": "text/html;charset=utf-8"}.get(
                path.suffix.lower(), "text/plain;charset=utf-8"
            )
            resources[key] = {
                "path": path.relative_to(ROOT).as_posix(),
                "type": mime,
                "data": base64.b64encode(path.read_bytes()).decode("ascii"),
            }
        key = resource_ids[path]
        if match["name"] == "href":
            return f'href="#{key}" data-embedded-href="{key}" target="_blank" rel="noopener"'
        return f'data-embedded-src="{key}"'

    html = ATTRIBUTE.sub(embed, source)
    html = html.replace(
        "보고서와 screenshots 폴더를 함께 보관하세요.",
        "독립형 HTML: 이미지·앱·근거 파일이 모두 내장되어 이 파일만 보관하면 됩니다. 링크는 새 탭에서 열립니다.",
    )
    payload = json.dumps(resources, ensure_ascii=True, separators=(",", ":"))
    # Escape '<' so a future resource name cannot terminate the JSON script element.
    payload = payload.replace("<", "\\u003c")
    runtime = """
<script id="embedded-resources" type="application/json">PAYLOAD</script>
<script>
(() => {
  const resources = JSON.parse(document.getElementById('embedded-resources').textContent);
  const urls = new Map();
  function resourceUrl(id) {
    if (!urls.has(id)) {
      const resource = resources[id];
      const bytes = Uint8Array.from(atob(resource.data), char => char.charCodeAt(0));
      urls.set(id, URL.createObjectURL(new Blob([bytes], {type: resource.type})));
    }
    return urls.get(id);
  }
  document.querySelectorAll('[data-embedded-src]').forEach(image => {
    image.src = resourceUrl(image.dataset.embeddedSrc);
  });
  document.querySelectorAll('[data-embedded-href]').forEach(link => {
    link.href = resourceUrl(link.dataset.embeddedHref);
  });
  // Keep URLs alive while the report is open, including after back/forward navigation.
})();
</script>
<noscript><p>내장 이미지와 링크를 사용하려면 브라우저에서 JavaScript를 허용하세요.</p></noscript>
""".replace("PAYLOAD", payload)
    html = html.replace("</body>", runtime + "</body>")
    output = REPORT_DIR / "standalone.html"
    output.write_text(html, encoding="utf-8")
    print(f"Created {output.name}: {len(resources)} resources, {output.stat().st_size / 1024**2:.2f} MiB")
    return output


if __name__ == "__main__":
    build()
