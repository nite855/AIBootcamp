"""Static and structural checks for OPS-01 Docker, Compose, and Nginx configuration."""

from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]


class OpsConfigTests(unittest.TestCase):
    def test_compose_separates_web_and_api_without_reload_or_source_mounts(self) -> None:
        compose = (ROOT / "compose.yaml").read_text(encoding="utf-8")
        self.assertIn("dockerfile: infra/docker/frontend.Dockerfile", compose)
        self.assertIn("dockerfile: backend/Dockerfile", compose)
        self.assertIn('"${WEB_PORT:-8080}:80"', compose)
        self.assertIn("read_only: true", compose)
        self.assertIn("create_host_path: false", compose)
        self.assertNotIn("--reload", compose)
        self.assertNotIn("./src", compose)
        self.assertNotIn("./static", compose)

    def test_backend_dockerfile_uses_single_entrypoint_and_worker(self) -> None:
        dockerfile = (ROOT / "backend" / "Dockerfile").read_text(encoding="utf-8")
        self.assertIn("backend.app.main:app", dockerfile)
        self.assertIn('"--workers", "1"', dockerfile)
        self.assertNotIn("--reload", dockerfile)
        self.assertNotIn("frontend/", dockerfile)

    def test_frontend_dockerfile_uses_multistage_nginx(self) -> None:
        dockerfile = (ROOT / "infra" / "docker" / "frontend.Dockerfile").read_text(
            encoding="utf-8"
        )
        self.assertIn("AS builder", dockerfile)
        self.assertIn("npm run build", dockerfile)
        self.assertIn("nginx:1.27-alpine", dockerfile)
        self.assertIn("infra/nginx/default.conf", dockerfile)

    def test_nginx_preserves_api_prefix_and_returns_404_for_missing_assets(self) -> None:
        conf = (ROOT / "infra" / "nginx" / "default.conf").read_text(encoding="utf-8")
        self.assertIn("location ^~ /api/", conf)
        self.assertIn("http://api:8000;", conf)
        self.assertNotIn("http://api:8000/;", conf)
        self.assertIn("location ^~ /assets/", conf)
        self.assertIn("try_files $uri =404;", conf)
        self.assertIn("location = /assets/cards/manifest.json", conf)
        self.assertIn("client_max_body_size 256k;", conf)

    def test_dockerignore_excludes_sensitive_and_legacy_artifacts(self) -> None:
        dockerignore = (ROOT / ".dockerignore").read_text(encoding="utf-8")
        for expected in (".env", ".backups/", "models/", "artifacts/", "design-lab/", "reports/"):
            self.assertIn(expected, dockerignore)


if __name__ == "__main__":
    unittest.main()
