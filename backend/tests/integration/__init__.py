import unittest


def load_tests(loader, tests, pattern):
    """Integration tests run via pytest only (`pytest -m integration`)."""
    return unittest.TestSuite()
