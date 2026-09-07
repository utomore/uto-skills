#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Span {
    pub start: u32,
    pub end: u32,
}

#[derive(Debug, PartialEq)]
pub enum SpanError {
    Inverted,
    Empty,
}

pub fn make(start: u32, end: u32) -> Result<Span, SpanError> {
    if end < start {
        return Err(SpanError::Inverted);
    }
    if end == start {
        return Err(SpanError::Empty);
    }
    Ok(Span { start, end })
}

pub fn width(s: Span) -> u32 {
    s.end - s.start
}

pub fn merge(a: Span, b: Span) -> Span {
    Span {
        start: if a.start < b.start { a.start } else { b.start },
        end: if a.end > b.end { a.end } else { b.end },
    }
}

impl Span {
    pub fn contains(&self, p: u32) -> bool {
        p >= self.start && p < self.end
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn f_001__law_1_merge_covers_both() {
        let a = make(0, 5).unwrap();
        let b = make(3, 9).unwrap();
        assert!(width(merge(a, b)) >= width(a));
    }

    #[test]
    fn f_001__law_2_make_is_total() {
        assert!(make(9, 1).is_err());
    }

    #[test]
    fn f_001__ex_1() {
        assert_eq!(width(merge(make(0, 5).unwrap(), make(3, 9).unwrap())), 9);
    }
}
