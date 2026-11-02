#!/usr/bin/env python3
"""Rebuilds assets/search-index.json from the wiki's HTML pages.

Run it after editing a page:  python3 wiki/tools/search_index.py
One entry per page (its lead) and one per h2/h3 section (the text up to the next heading).
Standard library only.
"""
import html
import json
import os
import re
from html.parser import HTMLParser

WIKI = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP = ('script', 'style', 'nav', 'aside')


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.title = ''
        self.sections = []          # [anchor, heading, [text]]
        self.in_article = 0
        self.in_head = None
        self.skip = 0
        self.head_text = []
        self.cur = [None, None, []]
        self.in_title = False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'title':
            self.in_title = True
        if tag == 'article':
            self.in_article += 1
        if not self.in_article:
            return
        if tag in SKIP:
            self.skip += 1
        if tag in ('h1', 'h2', 'h3'):
            self.in_head = (tag, a.get('id'))
            self.head_text = []

    def handle_endtag(self, tag):
        if tag == 'title':
            self.in_title = False
        if not self.in_article:
            return
        if tag in SKIP:
            self.skip = max(0, self.skip - 1)
        if self.in_head and tag == self.in_head[0]:
            text = ' '.join(''.join(self.head_text).split()).rstrip('#').strip()
            if self.in_head[0] == 'h1':
                self.cur = [None, text, self.cur[2]]
            else:
                self.sections.append(self.cur)
                self.cur = [self.in_head[1], text, []]
            self.in_head = None
        if tag == 'article':
            self.in_article -= 1
            self.sections.append(self.cur)

    def handle_data(self, data):
        if self.in_title:
            self.title += data
        if not self.in_article or self.skip:
            return
        if self.in_head:
            self.head_text.append(data)
        else:
            self.cur[2].append(data)


def main():
    pages = sorted(f for f in os.listdir(WIKI) if f.endswith('.html'))
    out = []
    for f in pages:
        p = Page()
        with open(os.path.join(WIKI, f), encoding='utf-8') as fh:
            p.feed(fh.read())
        page_title = p.title.replace(' - The Backrooms Update Wiki', '').strip() or f
        if f == 'index.html':
            page_title = 'Home'
        for anchor, heading, text in p.sections:
            body = ' '.join(html.unescape(' '.join(text)).split())
            if not heading and not body:
                continue
            out.append({
                'page': page_title,
                'url': f,
                'anchor': anchor or '',
                'title': (heading or page_title) if anchor else page_title,
                'text': body[:600],
            })
    with open(os.path.join(WIKI, 'assets', 'search-index.json'), 'w', encoding='utf-8') as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(',', ':'))
    print('search index: %d entries from %d pages' % (len(out), len(pages)))


if __name__ == '__main__':
    main()
