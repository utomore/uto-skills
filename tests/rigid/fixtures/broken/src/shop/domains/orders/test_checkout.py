import pytest


@pytest.mark.law("LAW-7")
def test_tags_a_law_that_does_not_exist() -> None:
    assert True


@pytest.mark.law("law-x")
def test_tags_a_law_with_a_bad_id() -> None:
    assert True
