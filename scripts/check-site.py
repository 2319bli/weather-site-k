#!/usr/bin/env python3
"""Check the standalone site before publishing it to a project Pages URL."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
import subprocess

ROOT = Path(__file__).resolve().parents[1] / 'public'
class Links(HTMLParser):
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        for key in ('src', 'href'):
            value = attrs.get(key, '')
            if not value or value.startswith(('#', 'https://', 'http://', 'data:')):
                continue
            assert not value.startswith('/'), f'Root-relative URL breaks project Pages: {value}'
            target = (self.path.parent / unquote(urlsplit(value).path)).resolve()
            assert target.is_relative_to(ROOT), f'URL escapes published site: {value}'
            assert target.is_file(), f'Missing asset: {self.path.name}: {value}'
        assert not tag == 'script' or 'src' in attrs, 'Keep executable scripts in js/'

for page in ROOT.glob('*.html'):
    html = page.read_text()
    assert 'name="viewport"' in html, f'Missing mobile viewport: {page}'
    parser = Links()
    parser.path = page
    parser.feed(html)
for script in (ROOT / 'js').glob('*.js'):
    text = script.read_text()
    assert '/api/' not in text and '../orig/' not in text, f'Local server dependency: {script}'
    subprocess.run(['node', '--check', str(script)], check=True)
for data in ['MeanTempCET.csv', 'PrecipitationEWP.csv', 'forecast_2026.csv']:
    assert (ROOT / 'data' / data).is_file()
print('PASS: all six pages, assets, data paths and JavaScript syntax')
