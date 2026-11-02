"""Flags writing that reads as machine-made, after Wikipedia's "Signs of AI writing" field guide: its word list, inflated
copulas, negative parallelisms, participle tails, chatbot phrasing, summaries, em dashes, curly quotes, emoji, title-case
headings and bold-led list items. Run it after editing any page; it prints each hit with its page and some context."""
import html, pathlib, re, sys
from html.parser import HTMLParser

WIKI = pathlib.Path(__file__).resolve().parent.parent
WORDS = r"additionally|align(?:s|ed)? with|boasts?|bolster(?:ed|s)?|crucial|delve|deep dive|emphasi[sz]ing|enduring|enhanc(?:e|es|ed|ing)|fostering|garner|highlight(?:s|ed|ing)?|interplay|intricate|intricacies|landscape|meticulous(?:ly)?|pivotal|robust|showcas(?:e|es|ed|ing)|tapestry|testament|underscor(?:e|es|ed|ing)|valuable|vibrant|leverag(?:e|es|ed|ing)|multifaceted|prioriti[sz]e|seamless(?:ly)?|elevate|unlock|empower|journey|realm|embark|navigate the|ever-evolving|game-chang|cutting-edge|nestled|in the heart of|groundbreaking|renowned|diverse array|rich (?:history|heritage)|profound|resonat(?:e|es)|stunning|immersive(?! portals)|captivating|whether you'?re"
PATTERNS = [
    ("ai word", re.compile(r"\b(?:" + WORDS + r")\b", re.I)),
    ("inflated copula", re.compile(r"\b(?:serves as|stands as|acts as a|functions as|is a testament|is a reminder|plays? a (?:key|vital|crucial|pivotal) role)\b", re.I)),
    ("negative parallelism", re.compile(r"\bnot only\b|\bnot just\b|\bit'?s not\b[^.]{0,40}\bit'?s\b|\bno [a-z]+, no [a-z]+, just\b", re.I)),
    ("participle tail", re.compile(r",\s(?:highlighting|underscoring|emphasizing|ensuring|reflecting|symbolizing|contributing to|fostering|cultivating|showcasing|creating a|making it)\b", re.I)),
    ("chatbot", re.compile(r"\b(?:i hope this helps|let me know|feel free to|it'?s (?:important|worth) (?:to note|noting)|in summary|in conclusion|overall,|dive in|let'?s (?:dive|explore))\b", re.I)),
    ("em dash", re.compile(r"[—–]")),
    ("curly quote", re.compile(r"[“”‘’]")),
    ("emoji", re.compile(r"[\U0001F300-\U0001FAFF✨✅❌⭐]")),
]

class Text(HTMLParser):
    SKIP = {"script", "style"}
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out, self.heads, self.boldli, self.skip, self.tag = [], [], [], 0, []
    def handle_starttag(self, tag, attrs):
        if tag in self.SKIP: self.skip += 1
        self.tag.append(tag)
        if tag in ("p", "li", "h1", "h2", "h3", "h4", "td", "figcaption", "dd", "dt", "div"): self.out.append("\n")
    def handle_endtag(self, tag):
        if tag in self.SKIP: self.skip -= 1
        while self.tag and self.tag.pop() != tag: pass
    def handle_data(self, d):
        if self.skip: return
        self.out.append(d)
        if self.tag and self.tag[-1] in ("h2", "h3") and d.strip(): self.heads.append(d.strip())

def scan(path):
    raw = path.read_text()
    p = Text(); p.feed(raw)
    text = "".join(p.out)
    hits = []
    for name, rx in PATTERNS:
        for m in rx.finditer(text):
            a, b = max(0, m.start() - 50), min(len(text), m.end() + 50)
            hits.append((name, " ".join(text[a:b].split())))
    for h in p.heads:
        words = [w for w in re.findall(r"[A-Za-z][a-z']+", h) if len(w) > 3]
        if len(words) >= 3 and all(w[0].isupper() for w in words) and "," not in h:
            hits.append(("title case heading", h))
    for m in re.finditer(r"<li>\s*<strong>[^<]{1,40}</strong>\s*[:.]", raw):
        hits.append(("bold-led list item", re.sub(r"<[^>]+>", "", m.group(0))))
    return hits

if __name__ == "__main__":
    total = 0
    for f in sorted(WIKI.glob("*.html")):
        for name, ctx in scan(f):
            total += 1
            print(f"{f.name}: [{name}] {ctx}")
    print(f"{total} hits")
    sys.exit(1 if total else 0)
