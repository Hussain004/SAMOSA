#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, extname } from 'node:path';
import { check, explainAll, type CheckOptions, type Report } from '../src/core/index.ts';
import { extractDocument } from './extract.ts';
import { expandGlob } from './glob.ts';
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
    /** the fixes and the counterexamples are not computed */
    noExplain: boolean;
    /** the report goes in this file, and not on the standard output */
    output?: string;
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
      noExplain: false,
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
      case '--no-explain':
        args.options.noExplain = true;
        break;
      case '--output':
        args.options.output = next();
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
  --no-explain                do not look for the fixes and the counterexamples
  --output <file>             write the report in a file, not on the output
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

  // The file arguments are glob patterns, so "**/*.tex" finds the files in
  // the folders as well. The shell does not do this on its own inside a
  // GitHub Action.
  const files = args.files.flatMap((pattern) => expandGlob(pattern));
  if (!files.length) {
    fail(`no file matches ${args.files.join(', ')}\n\n` + usage());
  }

  const reports: FileReport[] = [];
  for (const file of files) {
    const source = file === '-' ? readFileSync(0, 'utf8') : readFileSync(file, 'utf8');
    const isTex = file === '-' ? true : extname(file) === '.tex';
    const extraction = extractDocument(source, isTex);
    const decls = [args.options.decls, ...extraction.decls].filter(Boolean).join('; ');
    const rows = extraction.rows.map((r) => r.text).join('\\\\\n');
    const report = check(rows, { ...args.options, decls });
    // the line of every step, so the output can point at it
    for (const step of report.steps) {
      const row = extraction.rows.find((r) => step.text?.startsWith(r.text));
      step.line = row?.line ?? 0;
      step.column = 1;
    }
    // The fixes and the shrunk counterexample, so the CLI says what to do and
    // not only that the step is wrong. The rows that are wrong are few, so
    // this is affordable.
    if (!args.options.noExplain) {
      const explanations = explainAll(rows, { ...args.options, decls }, 8, report);
      for (const step of report.steps) {
        const explanation = explanations.get(step.id);
        if (!explanation) continue;
        step.fixes = explanation.fixes;
        if (explanation.counterexample) step.counterexample = explanation.counterexample;
      }
    }
    reports.push({ file: file === '-' ? 'stdin' : file, report, line: 0, column: 0 });
  }

  const text = (): string => {
    switch (args.options.format) {
      case 'json':
        return JSON.stringify(
          reports.length === 1
            ? reports[0].report
            : reports.map((r) => ({ file: r.file, ...r.report })),
          null,
          2,
        );
      case 'sarif':
        return formatSarif(reports.map((r) => ({ file: r.file, report: r.report })));
      case 'github':
        return formatGithub(reports.map((r) => ({ file: r.file, report: r.report })));
      default:
        return reports.map((r) => formatPretty(r.report, { file: r.file })).join('\n');
    }
  };

  // the report goes in a file when the caller asks for it, which is what the
  // GitHub Action does with the SARIF
  if (args.options.output) {
    writeFileSync(args.options.output, `${text()}\n`);
  } else {
    print(text());
  }

  const failing = reports.some((r) =>
    r.report.steps.some((step) => args.options.failOn.includes(step.verdict)),
  );
  process.exit(failing ? 1 : 0);
}

main();

export { basename };
