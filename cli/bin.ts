#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { basename, extname } from 'node:path';
import { check, type CheckOptions, type Report } from '../src/core/index.ts';
import { extractDocument } from './extract.ts';
import { formatGithub, formatPretty, formatSarif } from './format.ts';

/**
 * The `samosa` command.
 *
 * It lints the math of a paper, of a Markdown note or of a derivation that
 * comes in on the standard input, and prints the verdicts in the format the
 * caller asked for.
 */

const VERSION = '1.0.0';

interface Args {
  command: string;
  files: string[];
  options: CheckOptions & {
    format: 'pretty' | 'json' | 'sarif' | 'github';
    failOn: string[];
  };
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    command: argv[0] ?? 'check',
    files: [],
    options: {
      format: 'pretty',
      failOn: ['wrong', 'shape'],
      decls: '',
      preset: undefined,
      seed: undefined,
      trials: undefined,
      layout: 'denominator',
    },
  };

  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => argv[++i];
    switch (arg) {
      case '--decls':
      case '--declarations':
        args.options.decls = next() ?? '';
        break;
      case '--preset':
        args.options.preset = next();
        break;
      case '--format':
        args.options.format = (next() ?? 'pretty') as Args['options']['format'];
        break;
      case '--fail-on':
        args.options.failOn = (next() ?? 'wrong,shape').split(',').map((s) => s.trim());
        break;
      case '--seed':
        args.options.seed = Number(next());
        break;
      case '--trials':
        args.options.trials = Number(next());
        break;
      case '--layout':
        args.options.layout = (next() === 'numerator' ? 'numerator' : 'denominator');
        break;
      case '--version':
      case '-v':
        print(`samosa ${VERSION}`);
        process.exit(0);
        break;
      case '--help':
      case '-h':
        print(usage());
        process.exit(0);
        break;
      default:
        // a single dash means the standard input
        if (arg === '-') {
          args.files.push(arg);
          continue;
        }
        if (arg.startsWith('-')) {
          fail(`unknown option ${arg}`);
        }
        args.files.push(arg);
    }
  }
  return args;
}

function usage(): string {
  return `samosa ${VERSION}

  samosa check paper.tex notes.md [options]
  cat derivation.tex | samosa check - --format json

Options:
  --decls "<declarations>"   the declarations, in the compact syntax
  --preset <id>               one of the presets
  --format <pretty|json|sarif|github>
  --fail-on <wrong,shape>     the verdicts that make the command fail
  --seed <number>             the seed of the sampling
  --trials <number>           the trials per size
  --layout <denominator|numerator>
  --version
`;
}

function print(text: string): void {
  process.stdout.write(text.endsWith('\n') ? text : `${text}\n`);
}

function fail(message: string): never {
  process.stderr.write(`samosa: ${message}\n`);
  process.exit(2);
}

interface FileReport {
  file: string;
  report: Report;
  line: number;
  column: number;
}

function main(): void {
  // the first two entries are the node binary and the script
  const args = parseArgs(process.argv.slice(2));
  if (args.command !== 'check') {
    fail(`unknown command ${args.command}\n\n${usage()}`);
  }
  if (!args.files.length) {
    fail('no file to check\n\n' + usage());
  }

  const reports: FileReport[] = [];
  for (const file of args.files) {
    const source = file === '-' ? readFileSync(0, 'utf8') : readFileSync(file, 'utf8');
    const isTex = file === '-' ? true : extname(file) === '.tex';
    const extraction = extractDocument(source, isTex);
    const decls = [args.options.decls, ...extraction.decls].filter(Boolean).join('; ');
    const report = check(extraction.rows.map((r) => r.text).join('\\\\\n'), {
      ...args.options,
      decls,
    });
    // the line of every step, so the output can point at it
    for (const step of report.steps) {
      const row = extraction.rows.find((r) => step.text?.startsWith(r.text));
      step.line = row?.line ?? 0;
      step.column = 1;
    }
    reports.push({ file: file === '-' ? 'stdin' : file, report, line: 0, column: 0 });
  }

  switch (args.options.format) {
    case 'json':
      print(
        JSON.stringify(
          reports.length === 1
            ? reports[0].report
            : reports.map((r) => ({ file: r.file, ...r.report })),
          null,
          2,
        ),
      );
      break;
    case 'sarif':
      print(formatSarif(reports.map((r) => ({ file: r.file, report: r.report }))));
      break;
    case 'github':
      print(formatGithub(reports.map((r) => ({ file: r.file, report: r.report }))));
      break;
    default:
      for (const r of reports) {
        print(formatPretty(r.report, { file: r.file }));
      }
  }

  const failing = reports.some((r) =>
    r.report.steps.some((step) => args.options.failOn.includes(step.verdict)),
  );
  process.exit(failing ? 1 : 0);
}

main();

export { basename };
