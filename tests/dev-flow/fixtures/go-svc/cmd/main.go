package main

import (
	"fmt"
	"os"

	"example.com/svc/internal/queue"
)

func Serve(line string) string {
	jobs := queue.Push(nil, queue.Job{ID: line, Priority: 1})
	return fmt.Sprintf("%d", queue.Depth(jobs))
}

func main() {
	fmt.Fprintln(os.Stdout, Serve("x"))
}
