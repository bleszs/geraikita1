"""Failure handling tests; synthetic audio here does not measure ASR accuracy."""
import importlib.util
from pathlib import Path
from types import SimpleNamespace
import unittest
from test_voice import wav
import numpy as np

spec = importlib.util.spec_from_file_location('order_voice', Path(__file__).resolve().parents[1] / 'server/ml/transcribe-orders.py')
orders = importlib.util.module_from_spec(spec)
spec.loader.exec_module(orders)


class OrderVoiceTests(unittest.TestCase):
    def test_loop_detection_uses_words_and_hyphens(self):
        for text in ['pes-pes-pes-pes-pes', 'pes -pes- pes pes', 'dua kopi dua kopi dua kopi']:
            self.assertTrue(orders.repetitive(text), text)
        for text in ['dua kopi dan tiga teh', 'es teh dan es jeruk', 'pesan dua pesanan']:
            self.assertFalse(orders.repetitive(text), text)

    def test_reject_whole_order_when_one_segment_is_unclear(self):
        from transcribe import AudioError
        audio = wav(np.sin(np.arange(32000) * 0.1) * 4000)
        good = dict(text='dua kopi', compression_ratio=1, no_speech_prob=0.1, avg_logprob=-0.2)
        class Model:
            def __init__(self, second): self.second = second
            def transcribe(self, *args, **kwargs): return iter([SimpleNamespace(**good), SimpleNamespace(**self.second)]), None
        for second, code in [({**good, 'text': 'pes-pes-pes-pes'}, 'unreliable_speech'), ({**good, 'text': 'tiga teh', 'avg_logprob': -2}, 'no_speech')]:
            with self.assertRaises(AudioError) as caught:
                orders.transcribe(audio, Model(second))
            self.assertEqual(caught.exception.code, code)
        self.assertEqual(orders.transcribe(audio, Model({**good, 'text': 'tiga teh'}))['text'], 'dua kopi tiga teh')


if __name__ == '__main__': unittest.main()
