import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline";

/** Normal text prompt. */
export function prompt(question: string): Promise<string> {
	const rl = createInterface({ input: stdin, output: stdout });
	return new Promise((resolve) => {
		rl.question(question, (answer) => {
			rl.close();
			resolve(answer.trim());
		});
	});
}

/** Secret prompt that hides input (password-style). Falls back to visible prompt if not a TTY. */
export function promptSecret(question: string): Promise<string> {
	return new Promise((resolve, reject) => {
		// Check if stdin is a TTY for raw mode
		if (!stdin.isTTY) {
			stdout.write("(Warning: password input will be visible — not a TTY)\n");
			prompt(question).then(resolve).catch(reject);
			return;
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
					resolve(password);
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

		stdin.on("data", onData);
	});
}
