import importlib.util
import os
from pathlib import Path
import unittest
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('orders',Path(__file__).resolve().parents[1]/'server/ml/transcribe-orders.py')
orders=importlib.util.module_from_spec(spec);spec.loader.exec_module(orders)

class VocabularyTests(unittest.TestCase):
    def test_hint_is_bounded_and_cleaned(self):
        with patch.dict(os.environ,{'GERAI_SPEECH_VOCABULARY':'Nasi goreng, Es teh <>&'+('x'*500)}):
            hint=orders.vocabulary_hint()
            self.assertLessEqual(len(hint),400)
            self.assertNotIn('<',hint)
            self.assertIn('Es teh',hint)

    def test_empty_hint_does_not_invent_menu(self):
        with patch.dict(os.environ,{'GERAI_SPEECH_VOCABULARY':''}):
            self.assertEqual(orders.vocabulary_hint(),'')
        self.assertTrue(orders.repetitive('pes pes pes pes pes'))

if __name__=='__main__':unittest.main()
