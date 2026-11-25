import { logClientError } from './errorLogger';

/**
 * Safely removes a DOM node from its actual parent without throwing NotFoundError
 * if the node was already removed or moved by the browser/extension.
 */
export function safeRemoveNode(node: Node | null | undefined): void {
  if (!node) return;
  try {
    if (node.parentNode) {
      node.parentNode.removeChild(node);
    }
  } catch (err) {
    logClientError({
      error: err,
      errorName: 'SafeRemoveNodeNotice',
      errorMessage: err instanceof Error ? err.message : 'Unable to detach temporary node',
      componentName: 'domSafety',
      source: 'dom_reconciliation_guard'
    });
  }
}

/**
 * Safely triggers a file download using a detached temporary anchor element
 * and cleans it up safely without risking NotFoundError on document.body.removeChild.
 */
export function triggerSafeAnchorDownload(
  href: string,
  fileName: string,
  options?: { revokeObjectUrl?: boolean; cleanupDelayMs?: number }
): void {
  if (typeof document === 'undefined' || !document.body) return;
  const link = document.createElement('a');
  link.href = href;
  link.download = fileName;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();

  const cleanup = () => {
    safeRemoveNode(link);
    if (options?.revokeObjectUrl && typeof URL !== 'undefined') {
      try {
        URL.revokeObjectURL(href);
      } catch {
        // Ignore revoke errors
      }
    }
  };

  const delay = options?.cleanupDelayMs ?? 150;
  if (delay > 0) {
    window.setTimeout(cleanup, delay);
  } else {
    cleanup();
  }
}

/**
 * Finds the direct child of `parent` that contains `descendant`
 * (for example, when Chrome/Edge Auto-Translate wraps a React Text node inside <font><font>...</font></font>).
 */
function findDirectChildContaining(parent: Node, descendant: Node | null): Node | null {
  let cursor: Node | null = descendant;
  while (cursor && cursor.parentNode && cursor.parentNode !== parent) {
    cursor = cursor.parentNode;
  }
  return cursor && cursor.parentNode === parent ? cursor : null;
}

let domGuardInstalled = false;

/**
 * Protects React DOM reconciliation from third-party DOM mutations caused by
 * browser built-in translators (Google Chrome Translate / Microsoft Edge Translate)
 * or popular browser extensions that wrap Text nodes in <font> or <span> elements.
 *
 * - Normal DOM operations run through the native prototype methods untouched.
 * - Only intervenes when a browser/extension has reparented a child node outside
 *   the parent expected by React, preventing fatal NotFoundError crashes while
 *   still recording a structured diagnostic warning.
 */
export function installReactDomExtensionGuard(): void {
  if (typeof window === 'undefined' || typeof Node === 'undefined' || domGuardInstalled) {
    return;
  }
  domGuardInstalled = true;

  const originalRemoveChild = Node.prototype.removeChild;
  const originalInsertBefore = Node.prototype.insertBefore;

  Node.prototype.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child && child.parentNode !== this) {
      // Check if an external translator/extension wrapped `child` inside a descendant (e.g., <font>) of `this`
      const wrapperInThis = findDirectChildContaining(this, child);
      if (wrapperInThis) {
        logClientError({
          errorName: 'ExternalDomMutationRecovered',
          errorMessage: 'Browser translator or extension wrapped a React child node during removeChild; detached wrapper safely.',
          componentName: 'Node.removeChild',
          source: 'dom_reconciliation_guard'
        });
        // Remove the child from its wrapper; if wrapper becomes empty (<font>), remove wrapper from `this` too
        if (child.parentNode) {
          originalRemoveChild.call(child.parentNode, child);
        }
        if (
          wrapperInThis.parentNode === this &&
          wrapperInThis.nodeName === 'FONT' &&
          !wrapperInThis.textContent
        ) {
          originalRemoveChild.call(this, wrapperInThis);
        }
        return child;
      }

      logClientError({
        errorName: 'ExternalDomMutationRecovered',
        errorMessage: 'Skipped removeChild on a node already detached or moved by browser extension/translator.',
        componentName: 'Node.removeChild',
        source: 'dom_reconciliation_guard'
      });
      return child;
    }
    return originalRemoveChild.call(this, child) as T;
  };

  Node.prototype.insertBefore = function <T extends Node>(
    this: Node,
    newNode: T,
    referenceNode: Node | null
  ): T {
    if (referenceNode && referenceNode.parentNode !== this) {
      // If referenceNode was wrapped inside a translator <font> element that is still a child of `this`,
      // insert before that wrapper so DOM ordering remains accurate.
      const wrapperInThis = findDirectChildContaining(this, referenceNode);
      if (wrapperInThis) {
        logClientError({
          errorName: 'ExternalDomMutationRecovered',
          errorMessage: 'Adjusted insertBefore anchor to browser-wrapped parent node to preserve React DOM order.',
          componentName: 'Node.insertBefore',
          source: 'dom_reconciliation_guard'
        });
        return originalInsertBefore.call(this, newNode, wrapperInThis) as T;
      }

      logClientError({
        errorName: 'ExternalDomMutationRecovered',
        errorMessage: 'Reference node was detached by browser extension/translator during insertBefore; appended cleanly.',
        componentName: 'Node.insertBefore',
        source: 'dom_reconciliation_guard'
      });
      return originalInsertBefore.call(this, newNode, null) as T;
    }
    return originalInsertBefore.call(this, newNode, referenceNode) as T;
  };
}
