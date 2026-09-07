package queue

import "testing"

func TestQueue(t *testing.T) {
	t.Run("F-001#LAW-1", func(t *testing.T) {
		if Depth(Push(nil, Job{})) != 1 {
			t.Fatal("bad")
		}
	})
	t.Run("F-001#LAW-2", func(t *testing.T) {
		if _, ok := Peek(nil); ok {
			t.Fatal("bad")
		}
	})
	t.Run("F-001#EX-1", func(t *testing.T) {
		if Depth(nil) != 0 {
			t.Fatal("bad")
		}
	})
}
