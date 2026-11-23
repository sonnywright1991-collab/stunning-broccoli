"""Self-learning chatbot. Stdlib only.

Knowledge sources
  * memory.json   - things you taught it (always preferred)
  * library.json  - optional document chunks from `python3 ingest.py PATH`

Learning
  * unknown question -> it asks you for the answer and stores it
  * `wrong` -> you give the right answer, old one is down-weighted/replaced
  * `good`  -> reinforces the last answer

Answering
  * With ANTHROPIC_API_KEY set, Claude answers using the best taught facts +
    library chunks as context (taught facts win on conflict).
  * Without a key, it replies with the best matching taught answer or library excerpt.
"""
import json, math, os, re, sys, urllib.request
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
MEM = os.path.join(HERE, "memory.json")
LIB = os.path.join(HERE, "library.json")
THRESHOLD = 0.35
LIB_THRESHOLD = 0.12
MODEL = os.environ.get("LEARNBOT_MODEL", "claude-sonnet-5-5")
STOP = set("the a an of to in is are was what how do does i you it and or for on with that this be can".split())


def tokens(text):
    return [t for t in re.findall(r"[a-z0-9']+", text.lower()) if t not in STOP]


class Index:
    """TF-IDF cosine retrieval with an inverted index (fast on thousands of docs)."""

    def __init__(self, texts):
        self.tf = [Counter(tokens(t)) for t in texts]
        df = Counter(t for d in self.tf for t in d)
        n = len(texts) + 1
        self.idf = {t: math.log(n / c) + 1 for t, c in df.items()}
        self.post = defaultdict(list)
        self.norm = []
        for i, d in enumerate(self.tf):
            w = {t: c * self.idf[t] for t, c in d.items()}
            self.norm.append(math.sqrt(sum(v * v for v in w.values())) or 1.0)
            for t, v in w.items():
                self.post[t].append((i, v))

    def search(self, query, k=5):
        q = Counter(tokens(query))
        qw = {t: c * self.idf[t] for t, c in q.items() if t in self.idf}
        qn = math.sqrt(sum(v * v for v in qw.values()))
        if not qn:
            return []
        scores = defaultdict(float)
        for t, qv in qw.items():
            for i, dv in self.post[t]:
                scores[i] += qv * dv
        res = [(s / (qn * self.norm[i]), i) for i, s in scores.items()]
        return sorted(res, reverse=True)[:k]


class Bot:
    def __init__(self, path=MEM, lib_path=LIB):
        self.path = path
        self.facts = json.load(open(path)) if os.path.exists(path) else []
        self.lib = json.load(open(lib_path)) if lib_path and os.path.exists(lib_path) else []
        self._fi = self._li = None

    def save(self):
        with open(self.path, "w") as f:
            json.dump(self.facts, f, indent=1)
        self._fi = None

    def _fact_index(self):
        if self._fi is None:
            self._fi = Index([f["q"] for f in self.facts])
        return self._fi

    def _lib_index(self):
        if self._li is None:
            self._li = Index([c["head"] + " " + c["text"] for c in self.lib])
        return self._li

    def taught(self, query, k=3):
        """[(fact_idx, sim)] for taught facts above threshold."""
        if not self.facts:
            return []
        hits = [(s * self.facts[i]["score"], i) for s, i in self._fact_index().search(query, k)]
        return [(i, s) for s, i in sorted(hits, reverse=True) if s >= THRESHOLD]

    def library(self, query, k=4):
        if not self.lib:
            return []
        return [self.lib[i] for s, i in self._lib_index().search(query, k) if s >= LIB_THRESHOLD]

    def ask(self, query):
        """Return (fact_idx or None, answer or None)."""
        t = self.taught(query)
        ctx = self.library(query)
        key = os.environ.get("ANTHROPIC_API_KEY")
        if key and (t or ctx):
            try:
                return (t[0][0] if t else None), self._claude(query, t, ctx, key)
            except Exception as e:  # network/API problems: degrade gracefully
                print(f"[claude unavailable: {e}]")
        if t:
            return t[0][0], self.facts[t[0][0]]["a"]
        if ctx:
            c = ctx[0]
            return None, f"{c['text'][:600]}\n  [source: {c['src']} > {c['head']}]"
        return None, None

    def _claude(self, query, taught, ctx, key):
        parts = []
        if taught:
            parts.append("TAUGHT FACTS (user-verified; trust over documents):\n" +
                         "\n".join(f"Q: {self.facts[i]['q']}\nA: {self.facts[i]['a']}" for i, _ in taught))
        if ctx:
            parts.append("DOCUMENTS:\n" + "\n\n".join(f"[{c['src']} > {c['head']}]\n{c['text']}" for c in ctx))
        body = json.dumps({
            "model": MODEL, "max_tokens": 600,
            "system": "Answer concisely using only the provided context. If it is insufficient, say you don't know.",
            "messages": [{"role": "user", "content": "\n\n".join(parts) + f"\n\nQUESTION: {query}"}],
        }).encode()
        req = urllib.request.Request(
            "https://api.anthropic.com/v1/messages", body,
            {"x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"})
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.load(r)["content"][0]["text"].strip()

    def teach(self, q, a):
        for f in self.facts:
            if f["q"].lower() == q.lower():
                f["a"], f["score"] = a, 1.0
                break
        else:
            self.facts.append({"q": q, "a": a, "score": 1.0})
        self.save()

    def feedback(self, idx, good):
        f = self.facts[idx]
        f["score"] = min(2.0, f["score"] * 1.2) if good else max(0.2, f["score"] * 0.6)
        self.save()


def main():
    bot = Bot()
    mode = "Claude" if os.environ.get("ANTHROPIC_API_KEY") else "local"
    print(f"Self-learning bot [{mode}] - {len(bot.facts)} taught facts, {len(bot.lib)} library chunks. "
          "Commands: good, wrong, quit")
    last_q, last_i = None, None
    while True:
        try:
            line = input("you> ").strip()
        except EOFError:
            break
        if not line:
            continue
        low = line.lower()
        if low in ("quit", "exit"):
            break
        if low == "good" and last_i is not None:
            bot.feedback(last_i, True); print("bot> Noted, thanks."); continue
        if low == "wrong" and last_q:
            if last_i is not None:
                bot.feedback(last_i, False)
            a = input("bot> What should I have said? ").strip()
            if a:
                bot.teach(last_q, a); print("bot> Learned.")
            continue
        i, ans = bot.ask(line)
        if ans is None:
            a = input("bot> I don't know that yet. What should I say? (blank to skip) ").strip()
            if a:
                bot.teach(line, a); print("bot> Learned.")
            last_q, last_i = line, None
        else:
            print("bot>", ans)
            last_q, last_i = line, i


if __name__ == "__main__":
    main()
