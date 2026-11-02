#!/usr/bin/env python3
"""Checks that every internal link, anchor, image, script and stylesheet in the wiki resolves.

Run:  python3 wiki/tools/check_links.py
Exits 1 and lists the problems if anything is broken. Also flags absolute internal paths (they break under /backrooms-wiki/).
Standard library only.
"""
import json
import os
import re
import sys
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote

WIKI = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class Refs(HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs, self.ids = [], set()

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if 'id' in a:
            self.ids.add(a['id'])
        for k in ('href', 'src'):
            if a.get(k):
                self.refs.append((tag, k, a[k]))
        if a.get('style'):
            for u in re.findall(r'url\(["\']?([^"\')]+)', a['style']):
                self.refs.append((tag, 'style', u))


def main():
    pages = {f: Refs() for f in os.listdir(WIKI) if f.endswith('.html')}
    for f, p in pages.items():
        with open(os.path.join(WIKI, f), encoding='utf-8') as fh:
            p.feed(fh.read())
    bad, checked = [], 0

    def check(src, ref, kind, base=None):
        nonlocal checked
        if ref.startswith(('http://', 'https://', 'mailto:', 'data:', '//')):
            return
        checked += 1
        if ref.startswith('/'):
            bad.append('%s: absolute path %s (breaks under /backrooms-wiki/)' % (src, ref))
            return
        parts = urlsplit(ref)
        path = unquote(parts.path)
        target = os.path.normpath(os.path.join(WIKI, os.path.dirname(src if base is None else base), path)) if path else os.path.join(WIKI, src)
        if not os.path.exists(target):
            bad.append('%s: %s %s does not exist' % (src, kind, ref))
            return
        if parts.fragment and target.endswith('.html'):
            name = os.path.relpath(target, WIKI)
            if name in pages and parts.fragment not in pages[name].ids:
                bad.append('%s: anchor #%s missing in %s' % (src, parts.fragment, name))

    for f, p in sorted(pages.items()):
        for tag, attr, ref in p.refs:
            check(f, ref, '%s %s' % (tag, attr))

    css = os.path.join(WIKI, 'assets', 'style.css')
    with open(css, encoding='utf-8') as fh:
        for u in re.findall(r'url\(["\']?([^"\')]+)', fh.read()):
            check('assets/style.css', u, 'css url')

    idx = os.path.join(WIKI, 'assets', 'search-index.json')
    if os.path.exists(idx):
        with open(idx, encoding='utf-8') as fh:
            for e in json.load(fh):
                check('assets/search-index.json', e['url'] + ('#' + e['anchor'] if e['anchor'] else ''), 'search entry', base='index.html')
    else:
        bad.append('assets/search-index.json is missing (run tools/search_index.py)')

    if bad:
        print('\n'.join(bad))
        print('%d problems in %d references' % (len(bad), checked))
        sys.exit(1)
    print('all %d internal references resolve (%d pages)' % (checked, len(pages)))


if __name__ == '__main__':
    main()
