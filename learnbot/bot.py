"""Self-learning chatbot. Stdlib only.

Learns in three ways:
  1. Taught directly: when it can't answer, it asks you what it should have said.
  2. Corrected: type `wrong` after a reply and give the right answer.
  3. Reinforced: type `good` to up-weight a reply that worked; `wrong` down-weights it.

Retrieval is TF-IDF cosine similarity over everything it has learned.
Knowledge persists in memory.json.
"""
import json, math, os, re, sys
from collections import Counter

MEM = os.path.join(os.path.dirname(os.path.abspath(__file__)), "memory.json")
THRESHOLD = 0.35  # below this similarity the bot admits it doesn't know


def tokens(text):
    return re.findall(r"[a-z0-9']+", text.lower())


class Bot:
    def __init__(self, path=MEM):
        self.path = path
        self.facts = []  # [{"q": str, "a": str, "score": float}]
        if os.path.exists(path):
            with open(path) as f:
                self.facts = json.load(f)

    def save(self):
        with open(self.path, "w") as f:
            json.dump(self.facts, f, indent=1)

    def _vectors(self, query):
        docs = [Counter(tokens(f["q"])) for f in self.facts]
        n = len(docs) + 1
        df = Counter(t for d in docs + [Counter(tokens(query))] for t in d)
        idf = lambda t: math.log(n / df[t]) + 1
        vec = lambda c: {t: c[t] * idf(t) for t in c}
        return [vec(d) for d in docs], vec(Counter(tokens(query)))

    @staticmethod
    def _cos(a, b):
        dot = sum(v * b.get(t, 0) for t, v in a.items())
        na = math.sqrt(sum(v * v for v in a.values()))
        nb = math.sqrt(sum(v * v for v in b.values()))
        return dot / (na * nb) if na and nb else 0.0

    def ask(self, query):
        """Return (fact_index, answer) or (None, None) if unknown."""
        if not self.facts:
            return None, None
        vecs, qv = self._vectors(query)
        best, best_s = None, 0.0
        for i, v in enumerate(vecs):
            s = self._cos(v, qv) * self.facts[i]["score"]
            if s > best_s:
                best, best_s = i, s
        if best is None or best_s < THRESHOLD:
            return None, None
        return best, self.facts[best]["a"]

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
    print(f"Self-learning bot ({len(bot.facts)} facts known). Commands: good, wrong, quit")
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
