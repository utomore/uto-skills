from cart.basket import Item, add_item, total_cents


def test_f_001__law_1_add_grows():
    assert len(add_item([], Item("a", 1))) == 1


def test_f_001__law_2_total_nonneg():
    assert total_cents([Item("a", 1)]) >= 0


def test_f_001__ex_1():
    assert total_cents(add_item([], Item("a", 100))) == 100
