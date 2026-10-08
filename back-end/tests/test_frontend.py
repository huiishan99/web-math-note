from pathlib import Path
import tempfile
import unittest

from fastapi import FastAPI
from fastapi.testclient import TestClient
from apps.frontend import mount_frontend


class FrontendMountTest(unittest.TestCase):
    def test_frontend_assets_and_api_can_share_one_app(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / 'index.html').write_text('<html><body>Notebook</body></html>')
            (root / 'assets').mkdir()
            (root / 'assets' / 'app.js').write_text('window.notebook=true;')
            app = FastAPI()
            @app.get('/api/health')
            def health():
                return {'ok': True}
            mount_frontend(app, root)
            client = TestClient(app)
            self.assertIn('Notebook', client.get('/').text)
            self.assertIn('text/html', client.get('/').headers['content-type'])
            self.assertEqual(client.get('/assets/app.js').status_code, 200)
            self.assertEqual(client.get('/api/health').json(), {'ok': True})
            self.assertEqual(client.get('/missing.js').status_code, 404)

    def test_missing_build_does_not_prevent_backend_startup(self):
        app = FastAPI()
        mount_frontend(app, Path('/nonexistent-math-note-build'))
        self.assertEqual(TestClient(app).get('/').status_code, 404)
