package queue

type Job struct {
	ID       string
	Priority int
}

type Queue struct {
	jobs []Job
}

const (
	Low  = 0
	High = 9
)

func Push(jobs []Job, j Job) []Job {
	return append(jobs, j)
}

func Peek(jobs []Job) (Job, bool) {
	if len(jobs) == 0 {
		return Job{}, false
	}
	best := 0
	for i, j := range jobs {
		if j.Priority > jobs[best].Priority {
			best = i
		}
	}
	return jobs[best], true
}

func Depth(jobs []Job) int {
	return len(jobs)
}

func (q *Queue) Size() int {
	return len(q.jobs)
}
