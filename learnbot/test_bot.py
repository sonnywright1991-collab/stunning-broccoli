import os, tempfile, unittest
from bot import Bot


class T(unittest.TestCase):
    def setUp(self):
        self.p = os.path.join(tempfile.mkdtemp(), "m.json")
        self.b = Bot(self.p, None)

    def test_unknown_then_learns_and_persists(self):
        self.assertEqual(self.b.ask("what is the capital of france")[1], None)
        self.b.teach("what is the capital of france", "Paris")
        self.assertEqual(Bot(self.p, None).ask("capital of france?")[1], "Paris")

    def test_correction_overwrites(self):
        self.b.teach("favourite colour", "red")
        self.b.teach("favourite colour", "blue")
        self.assertEqual(self.b.ask("favourite colour")[1], "blue")

    def test_bad_feedback_eventually_makes_it_unsure(self):
        self.b.teach("hello there", "hi")
        i, _ = self.b.ask("hello there")
        for _ in range(4):
            self.b.feedback(i, False)
        self.assertIsNone(self.b.ask("hello there")[1])

    def test_unrelated_is_unknown(self):
        self.b.teach("capital of france", "Paris")
        self.assertIsNone(self.b.ask("how do I bake bread")[1])

    def test_library_fallback_and_taught_priority(self):
        b = Bot(self.p, None)
        b.lib = [{"src": "x.md", "head": "RAG", "text": "Retrieval augmented generation fetches documents before answering " * 3},
                 {"src": "y.md", "head": "Other", "text": "Quantization shrinks model weights to fewer bits " * 3}]
        self.assertIn("x.md", b.ask("what is retrieval augmented generation")[1])
        b.teach("what is retrieval augmented generation", "RAG = search + LLM")
        self.assertEqual(b.ask("what is retrieval augmented generation")[1], "RAG = search + LLM")


if __name__ == "__main__":
    unittest.main()
