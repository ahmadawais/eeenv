import { Command, Option } from "commander";
import { runHide } from "./commands/hide.js";
import { runRestore } from "./commands/restore.js";
import { runStatus } from "./commands/status.js";
import { printBanner } from "./lib/banner.js";
import { err } from "./lib/log.js";
import { readVersion } from "./lib/version.js";

const VERSION = readVersion();

// `-v` / `--version` should print version and nothing else (no banner).
const argv = process.argv.slice(2);
if (argv.length === 1 && (argv[0] === "-v" || argv[0] === "--version")) {
	process.stdout.write(`${VERSION}\n`);
	process.exit(0);
}

const program = new Command();

program
	.name("eeenv")
	.description(
		"Hide your project .env files in a per-project global vault\n" +
			"(~/.eeenv/vault/<project-path>) so coding agents can't read them.",
	)
	.version(VERSION, "-v, --version", "output the version number")
	.helpOption("-h, --help", "display help for command")
	.addOption(new Option("--cwd <dir>", "override working directory").hideHelp())
	.showHelpAfterError();

program
	.command("hide")
	.description(
		"Copy real .env* files into the vault, then replace local values with random tokens.",
	)
	.action(async (_opts, cmd: Command) => {
		await runHide(getCwd(cmd));
	});

program
	.command("restore")
	.description("Restore real values from the vault back into the project.")
	.action(async (_opts, cmd: Command) => {
		await runRestore(getCwd(cmd));
	});

program
	.command("status")
	.description("Show vault state for this project.")
	.action(async (_opts, cmd: Command) => {
		await runStatus(getCwd(cmd));
	});

if (argv.length === 0) {
	printBanner("eeenv", "Hide envs from coding agents.");
	program.outputHelp();
	process.exit(0);
}

program.parseAsync(process.argv).catch((e: unknown) => {
	const msg = e instanceof Error ? e.message : String(e);
	err(msg);
	process.exit(1);
});

function getCwd(cmd: Command): string {
	const opts = cmd.optsWithGlobals<{ cwd?: string }>();
	return opts.cwd ?? process.cwd();
}
