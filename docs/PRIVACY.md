# Privacy

The short version: your derivation never leaves your machine.

## The web app

Everything runs in the browser:

* the engine is a Web Worker in the tab;
* the source, the declarations and the settings never leave the page;
* a share link keeps the whole thing in the fragment of the URL, which the
  browser does not send to the server;
* the only network request the page makes is the star count on the GitHub
  API, once, and it is cached in `localStorage` for an hour.

There is no account, no backend and no database. There is nothing to log,
because there is no server to log it.

## The CLI

The CLI reads the files you give it and writes to the standard output. It
makes no network requests, and it never writes to your files.

## The MCP server

The MCP server talks over the standard input and the standard output. It
reads the derivation from the tool call, checks it in the process, and
answers. It makes no network requests.

## The GitHub Action

The Action runs the CLI in the runner, exactly as you would run it locally.
The results are printed as workflow commands, so they show up as annotations
in the pull request. If you use the SARIF format, the results go to GitHub's
code scanning, which is the same service that stores the findings of any
other scanner you run.

## Analytics

The site uses Vercel's cookieless page view analytics, if it is enabled for
the project. No event payloads are sent: there are no custom events, and the
derivation is never an event.

To turn it off, set the analytics off for the project in the Vercel
dashboard. Nothing in the app depends on it.

## What is not private

* The derivation text, when you paste it into the editor, is in your
  browser's memory. A browser extension with enough permissions can read
  it, like any other page.
* A share link contains the derivation. It is in the URL, so treat it like
  any other link you send to somebody.
* The star count comes from the GitHub API, and the request says which
  repository it is about.
