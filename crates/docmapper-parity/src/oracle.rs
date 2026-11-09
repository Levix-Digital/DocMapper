//! Client of the TypeScript oracle process (`parity/oracle/main.ts`, protocol in
//! `specs/006-m0-foundation/contracts/oracle-protocol.md`), for differential
//! fuzzing: Rust sends inputs and compares with what TypeScript returns.

use crate::fixture::Outcome;
use serde_json::{json, Value};
use std::fmt;
use std::io::{BufRead, BufReader, Write};
use std::path::Path;
use std::process::{Child, ChildStdin, ChildStdout, Command, Stdio};

/// Environment variable naming the Node.js binary (default `node`).
pub const NODE_ENV: &str = "PARITY_NODE";

/// Why the oracle could not answer. Never a match.
#[derive(Debug)]
pub enum OracleError {
    /// The process could not be started.
    Start(String),
    /// Writing the request or reading the response failed, or the process exited.
    Io(String),
    /// The response line is not a valid response.
    Protocol(String),
    /// The oracle rejected the request (unknown module or function, bad input).
    Failure(String),
}

impl fmt::Display for OracleError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            OracleError::Start(reason) => write!(f, "cannot start the oracle: {reason}"),
            OracleError::Io(reason) => write!(f, "oracle stream failed: {reason}"),
            OracleError::Protocol(reason) => write!(f, "invalid oracle response: {reason}"),
            OracleError::Failure(reason) => write!(f, "oracle rejected the request: {reason}"),
        }
    }
}

impl std::error::Error for OracleError {}

/// A running oracle process. It stops when dropped.
pub struct Oracle {
    child: Child,
    stdin: Option<ChildStdin>,
    stdout: BufReader<ChildStdout>,
    next_seq: u64,
}

impl Oracle {
    /// Starts the oracle of the repository at `root` with Node.js and the
    /// frontend's `tsx`.
    pub fn start(root: &Path) -> Result<Self, OracleError> {
        let tsx = root.join("frontend/node_modules/tsx/dist/cli.mjs");
        if !tsx.is_file() {
            return Err(OracleError::Start(format!(
                "{} not found; run `npm ci --prefix frontend`",
                tsx.display()
            )));
        }
        let node = std::env::var(NODE_ENV).unwrap_or_else(|_| "node".into());
        let mut child = Command::new(&node)
            .arg(tsx)
            .arg(root.join("parity/oracle/main.ts"))
            .current_dir(root)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .spawn()
            .map_err(|e| OracleError::Start(format!("{node}: {e}")))?;
        let stdin = child.stdin.take();
        let stdout = child
            .stdout
            .take()
            .map(BufReader::new)
            .ok_or_else(|| OracleError::Start("no stdout pipe".into()))?;
        Ok(Oracle {
            child,
            stdin,
            stdout,
            next_seq: 1,
        })
    }

    /// Starts the oracle of this repository.
    pub fn start_default() -> Result<Self, OracleError> {
        Self::start(&crate::workspace_root())
    }

    /// Calls `module.function(...input)` in TypeScript and returns its outcome.
    pub fn call(
        &mut self,
        module: &str,
        function: &str,
        input: &[Value],
    ) -> Result<Outcome, OracleError> {
        let seq = self.next_seq;
        self.next_seq += 1;
        let request = json!({"seq": seq, "module": module, "function": function, "input": input});
        let stdin = self
            .stdin
            .as_mut()
            .ok_or_else(|| OracleError::Io("stdin is closed".into()))?;
        writeln!(stdin, "{request}")
            .and_then(|()| stdin.flush())
            .map_err(|e| OracleError::Io(e.to_string()))?;
        let mut line = String::new();
        let read = self
            .stdout
            .read_line(&mut line)
            .map_err(|e| OracleError::Io(e.to_string()))?;
        if read == 0 {
            return Err(OracleError::Io("the oracle exited".into()));
        }
        parse_response(&line, seq)
    }
}

impl Drop for Oracle {
    fn drop(&mut self) {
        drop(self.stdin.take());
        if self.child.wait().is_err() {
            let _ = self.child.kill();
        }
    }
}

/// Parses one response line for the request numbered `seq`.
pub fn parse_response(line: &str, seq: u64) -> Result<Outcome, OracleError> {
    let protocol = |reason: String| OracleError::Protocol(format!("{reason}: {}", line.trim_end()));
    let value: Value = serde_json::from_str(line).map_err(|e| protocol(e.to_string()))?;
    let Value::Object(mut object) = value else {
        return Err(protocol("not an object".into()));
    };
    if let Some(failure) = object.get("failure") {
        return Err(OracleError::Failure(
            failure.as_str().unwrap_or_default().to_string(),
        ));
    }
    if object.get("seq").and_then(Value::as_u64) != Some(seq) {
        return Err(protocol(format!("expected seq {seq}")));
    }
    match (object.remove("output"), object.remove("error")) {
        (Some(output), None) => Ok(Outcome::Output(output)),
        (None, Some(Value::Object(error))) => {
            match (
                error.get("name").and_then(Value::as_str),
                error.get("message").and_then(Value::as_str),
            ) {
                (Some(name), Some(message)) => Ok(Outcome::error(name, message)),
                _ => Err(protocol("error without name or message".into())),
            }
        }
        _ => Err(protocol("needs exactly one of output and error".into())),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_outputs_errors_and_failures() {
        assert_eq!(
            parse_response(r#"{"seq":3,"output":{"a":1}}"#, 3).expect("output"),
            Outcome::Output(json!({"a": 1}))
        );
        assert_eq!(
            parse_response(r#"{"seq":3,"error":{"name":"E","message":"m"}}"#, 3).expect("error"),
            Outcome::error("E", "m")
        );
        assert!(matches!(
            parse_response(r#"{"seq":3,"failure":"unknown module 'x'"}"#, 3),
            Err(OracleError::Failure(reason)) if reason == "unknown module 'x'"
        ));
    }

    #[test]
    fn rejects_malformed_responses() {
        for line in [
            "nope",
            "[]",
            r#"{"seq":2,"output":1}"#,
            r#"{"seq":3}"#,
            r#"{"seq":3,"output":1,"error":{"name":"E","message":"m"}}"#,
            r#"{"seq":3,"error":{"name":"E"}}"#,
        ] {
            assert!(
                matches!(parse_response(line, 3), Err(OracleError::Protocol(_))),
                "{line}"
            );
        }
    }

    #[test]
    fn start_fails_without_tsx() {
        let missing = std::env::temp_dir().join("parity-no-frontend");
        assert!(matches!(
            Oracle::start(&missing),
            Err(OracleError::Start(_))
        ));
    }
}
