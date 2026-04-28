import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline";

// Store lines when reading from piped stdin
let pipedLines: string[] | null = null;
let pipedIndex = 0;

async function readPipedLines(): Promise<string[]> {
	if (pipedLines !== null) return pipedLines;
	
	const chunks: string[] = [];
	for await (const chunk of stdin) {
		chunks.push(chunk.toString());
	}
	pipedLines = chunks.join("").split("\n").map((l) => l.trim()).filter((l) => l);
	pipedIndex = 0;
	return pipedLines;
}

/** Normal text prompt. */
export async function prompt(question: string): Promise<string> {
	// If stdin is piped, read from pre-read lines
	if (!stdin.isTTY) {
		const lines = await readPipedLines();
		if (pipedIndex < lines.length) {
			const line = lines[pipedIndex++];
			stdout.write(`${question}${line}\n`);
			return line;
		}
		return "";
	}

	const rl = createInterface({ input: stdin, output: stdout });
	return new Promise((resolve) => {
		rl.question(question, (answer) => {
			rl.close();
			resolve(answer.trim());
		});
	});
}

/** Secret prompt that hides input (password-style). Falls back to visible prompt if not a TTY. */
export async function promptSecret(question: string): Promise<string> {
	// Check if stdin is a TTY for raw mode
	if (!stdin.isTTY) {
		stdout.write("(Warning: password input will be visible — not a TTY)\n");
		return prompt(question);
	}

	stdout.write(question);

	stdin.setRawMode(true);
	stdin.resume();
	stdin.setEncoding("utf8");

	let password = "";

	const onData = (ch: string) => {
		switch (ch) {
			case "\n":
			case "\r":
			case "\u0004": // Ctrl+D
				cleanup();
				stdout.write("\n");
				return;
			case "\u0003": // Ctrl+C
				cleanup();
				process.exit(130);
				return;
			case "\u007f": // Backspace
				if (password.length > 0) {
					password = password.slice(0, -1);
					stdout.write("\b \b");
				}
				return;
			default:
				// Only accept printable characters
				if (ch >= " " && ch <= "~") {
					password += ch;
					stdout.write("*");
				}
				return;
		}
	};

	const cleanup = () => {
		stdin.setRawMode(false);
		stdin.pause();
		stdin.removeListener("data", onData);
	};

	return new Promise((resolve) => {
		const wrappedOnData = (ch: string) => {
			if (ch === "\n" || ch === "\r" || ch === "\u0004") {
				cleanup();
				stdout.write("\n");
				resolve(password);
				return;
			}
			onData(ch);
		};
		stdin.on("data", wrappedOnData);
	});
}
