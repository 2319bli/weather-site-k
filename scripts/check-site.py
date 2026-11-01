#!/usr/bin/env python3
"""Check links and original inline JavaScript before deploying the static site."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1] / 'public'
class Page(HTMLParser):
    def __init__(self, path):
        super().__init__()
        self.path = path
        self.inline_script = False
        self.scripts = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        for key in ('src', 'href'):
            value = attrs.get(key, '')
            if not value or value.startswith(('#', 'https://', 'http://', 'data:')):
                continue
            assert not value.startswith('/'), f'Root-relative URL breaks project Pages: {value}'
            target = (ROOT / unquote(urlsplit(value).path)).resolve()
            assert target.is_relative_to(ROOT), f'URL escapes published site: {value}'
            assert target.is_file(), f'Missing asset: {self.path.name}: {value}'
        if tag == 'script':
            self.inline_script = 'src' not in attrs and attrs.get('type') != 'application/json'

    def handle_data(self, data):
        if self.inline_script:
            self.scripts.append(data)

    def handle_endtag(self, tag):
        if tag == 'script':
            self.inline_script = False

with tempfile.TemporaryDirectory() as directory:
    for page in [*ROOT.glob('*.html'), *(ROOT.parent / 'worker').glob('*.html')]:
        html = page.read_text()
        assert '../orig/' not in html, f'Unpublished data path: {page}'
        parser = Page(page)
        parser.feed(html)
        for index, script in enumerate(parser.scripts):
            path = Path(directory) / f'{page.stem}-{index}.js'
            path.write_text(script)
            subprocess.run(['node', '--check', str(path)], check=True)
for script in [*ROOT.glob('*.js'), *ROOT.glob('*.mjs')]:
    subprocess.run(['node', '--check', str(script)], check=True)
for data in ['MeanTempCET.csv', 'PrecipitationEWP.csv', 'forecast_2026.csv', 'hottest_days.csv', 'coldest_days.csv']:
    assert (ROOT / 'data' / data).is_file()
print('PASS: original pages, local assets, data paths and inline JavaScript syntax')
