use std::io;

use crate::core::span::{make, merge, width, Span};

pub fn run(line: &str) -> String {
    let parts: Vec<u32> = line.split(',').filter_map(|s| s.parse().ok()).collect();
    match make(parts[0], parts[1]) {
        Ok(s) => format!("{}", width(s)),
        Err(_) => "bad".to_string(),
    }
}

fn main() {
    let mut buf = String::new();
    io::stdin().read_line(&mut buf).unwrap();
    println!("{}", run(&buf));
}
