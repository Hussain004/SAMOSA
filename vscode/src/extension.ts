import * as path from 'node:path';
import * as vscode from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from 'vscode-languageclient/node';
import { check, explainAll } from '../../src/core/index.ts';
import { shareLink } from '../../src/core/share.ts';

/**
 * The SAMOSA extension.
 *
 * A thin client: the engine lives in the language server, one worker
 * thread per check. The commands here need the editor, so they run in the
 * extension host and never touch the network either: the share link is
 * built locally and opened only when the user invokes the command.
 */

const SHARE_BASE = process.env.SAMOSA_SHARE_BASE ?? 'https://samosa-math.vercel.app';

let client: LanguageClient | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const serverModule = context.asAbsolutePath(path.join('dist', 'server.cjs'));

  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: { execArgv: ['--nolazy', '--inspect=6319'] },
    },
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { scheme: 'file', language: 'latex' },
      { scheme: 'file', language: 'markdown' },
      { scheme: 'untitled', language: 'latex' },
      { scheme: 'untitled', language: 'markdown' },
      { scheme: 'file', pattern: '**/*.tex' },
      { scheme: 'file', pattern: '**/*.md' },
    ],
    synchronize: {
      // the editor writes the file; the server reads the buffer, not the disk
      fileEvents: [],
    },
  };

  client = new LanguageClient('samosa', 'SAMOSA', serverOptions, clientOptions);
  await client.start();

  context.subscriptions.push(
    vscode.commands.registerCommand('samosa.openInBrowser', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        void vscode.window.showInformationMessage('SAMOSA: no editor is open');
        return;
      }
      const src = editor.document.getText();
      // the link carries the derivation in its fragment; nothing is uploaded
      const url = shareLink(SHARE_BASE, { src });
      await vscode.env.openExternal(vscode.Uri.parse(url));
    }),

    vscode.commands.registerCommand('samosa.copyCounterexample', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        void vscode.window.showInformationMessage('SAMOSA: no editor is open');
        return;
      }
      const src = editor.document.getText();
      // the verdicts and the counterexample come from the engine in this
      // process, not from the server's cache, so the command works even
      // before the first check lands
      const report = check(src, {});
      const wrong = report.steps.find((s) => s.verdict === 'wrong');
      if (!wrong) {
        void vscode.window.showInformationMessage('SAMOSA: no wrong row in this document');
        return;
      }
      const explanations = explainAll(src, {}, 1, report);
      const explanation = explanations.get(wrong.id);
      const numpy = explanation?.counterexample?.numpy;
      if (!numpy) {
        void vscode.window.showInformationMessage('SAMOSA: no small counterexample was found');
        return;
      }
      await vscode.env.clipboard.writeText(numpy);
      void vscode.window.showInformationMessage('SAMOSA: counterexample copied as NumPy');
    }),

    {
      dispose: () => {
        void client?.stop();
        client = undefined;
      },
    },
  );
}

export async function deactivate(): Promise<void> {
  await client?.stop();
  client = undefined;
}
