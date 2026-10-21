import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate';

/**
 * The share codec.
 *
 * A share link carries the whole derivation in the fragment of the URL, so
 * nothing is uploaded and the link works with no server at all. The payload
 * is deflated and then written in the base64 alphabet of a URL.
 *
 * The codec lives in the core, so the app, the CLI and the MCP server all
 * write links the app can open.
 */

export interface SharePayload {
  /** the derivation, as it was written */
  src: string;
  /** the declarations, in the compact syntax */
  decls?: string;
  /** the preset, if one is used */
  preset?: string;
  /** anything else the app wants to keep */
  settings?: Record<string, unknown>;
}

/** The version of the format, so a link from the future is not misread. */
export const SHARE_VERSION = 'v1';

/** Encodes a payload into the fragment of a share link. */
export function encodeShare(payload: SharePayload): string {
  const json = JSON.stringify(payload);
  const compressed = deflateSync(strToU8(json), { level: 9 });
  return bytesToBase64Url(compressed);
}

/** Decodes the fragment of a share link. */
export function decodeShare(hash: string): SharePayload {
  const compressed = base64UrlToBytes(hash);
  return JSON.parse(strFromU8(inflateSync(compressed))) as SharePayload;
}

/**
 * The link to the app, with the derivation in the fragment.
 *
 * The app reads the fragment when it opens, so the link works with no server
 * and no database.
 */
export function shareLink(base: string, payload: SharePayload): string {
  const root = base.replace(/\/+$/, '');
  return `${root}/app/#${SHARE_VERSION}.${encodeShare(payload)}`;
}

/** The payload of a link, whatever shape the link has. */
export function readShareLink(url: string): SharePayload | null {
  const at = url.indexOf('#');
  if (at < 0) return null;
  const hash = url.slice(at + 1);
  const dot = hash.indexOf('.');
  if (dot < 0) return null;
  if (hash.slice(0, dot) !== SHARE_VERSION) return null;
  try {
    return decodeShare(hash.slice(dot + 1));
  } catch {
    return null;
  }
}

/**
 * The base64 alphabet, in the order the standard uses.
 *
 * The codec is written out rather than taken from the environment, because
 * the core runs in a worker, in the CLI and in the MCP server, and the one
 * thing they share is no globals.
 */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function bytesToBase64Url(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    out += ALPHABET[a >> 2];
    out += ALPHABET[((a & 3) << 4) | (b === undefined ? 0 : b >> 4)];
    out += b === undefined ? '' : ALPHABET[((b & 15) << 2) | (c === undefined ? 0 : c >> 6)];
    out += c === undefined ? '' : ALPHABET[c & 63];
  }
  return out.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(text: string): Uint8Array {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/');
  const clean = padded.replace(/[^A-Za-z0-9+/]/g, '');
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const a = ALPHABET.indexOf(clean[i]);
    const b = ALPHABET.indexOf(clean[i + 1]);
    const c = clean[i + 2] ? ALPHABET.indexOf(clean[i + 2]) : 0;
    const d = clean[i + 3] ? ALPHABET.indexOf(clean[i + 3]) : 0;
    bytes.push(((a << 2) | (b >> 4)) & 255);
    if (clean[i + 2]) bytes.push(((b << 4) | (c >> 2)) & 255);
    if (clean[i + 3]) bytes.push(((c << 6) | d) & 255);
  }
  return new Uint8Array(bytes);
}
