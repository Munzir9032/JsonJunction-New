(function () {
  // --- Helpers ---
  const $ = (id) => document.getElementById(id);
  const escapeHTML = (str) =>
    String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  const isPlainObject = (v) =>
    v !== null && typeof v === "object" && !Array.isArray(v);
  const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  function tryParse(jsonText) {
    try {
      return { ok: true, value: JSON.parse(jsonText) };
    } catch (e) {
      const match = e.message.match(/line (\d+)/i);
      return {
        ok: false,
        error: e,
        lineNumber: match ? parseInt(match[1], 10) - 1 : -1,
      };
    }
  }

  function prettyInline(v) {
    if (isPlainObject(v) || Array.isArray(v)) return JSON.stringify(v);
    if (typeof v === "string") return `"${v}"`;
    return String(v);
  }

  // --- Diff Engine ---
  function diffValues(a, b, key = null) {
    if (isPlainObject(a) && isPlainObject(b)) {
      const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
      const children = Array.from(allKeys, (k) => diffValues(a[k], b[k], k));
      const type = children.every((c) => c.type === "unchanged")
        ? "unchanged"
        : "nested";
      return { key, type, valueA: a, valueB: b, children };
    }
    if (Array.isArray(a) && Array.isArray(b)) {
      const max = Math.max(a.length, b.length);
      const children = Array.from({ length: max }, (_, i) =>
        diffValues(a[i], b[i], i)
      );
      const type = children.every((c) => c.type === "unchanged")
        ? "unchanged"
        : "nested";
      return { key, type, valueA: a, valueB: b, children };
    }
    if (typeof a === "undefined")
      return { key, type: "added", valueA: a, valueB: b };
    if (typeof b === "undefined")
      return { key, type: "removed", valueA: a, valueB: b };
    const same = JSON.stringify(a) === JSON.stringify(b);
    return { key, type: same ? "unchanged" : "changed", valueA: a, valueB: b };
  }

  // --- Renderers ---
  function renderSummary(root) {
    const counts = { added: 0, removed: 0, changed: 0 };
    (function walk(node) {
      if (!node) return;
      if (counts[node.type] !== undefined) counts[node.type]++;
      if (node.children) node.children.forEach(walk);
    })(root);
    return `<div class="text-sm space-y-1">
            <div><strong>Added:</strong> <span class="text-green-600">${counts.added}</span></div>
            <div><strong>Removed:</strong> <span class="text-red-600">${counts.removed}</span></div>
            <div><strong>Changed:</strong> <span class="text-yellow-600">${counts.changed}</span></div>
        </div>`;
  }

  function renderDiffNode(node, depth = 0) {
    if (!node || node.type === "unchanged") return "";
    const pad = `style="padding-left:${depth * 12}px"`;
    const keyLabel =
      node.key !== null
        ? `<span class="font-semibold text-gray-700 mr-1">${escapeHTML(
            String(node.key)
          )}:</span>`
        : "";

    if (node.type === "nested") {
      const inner = node.children
        .map((child) => renderDiffNode(child, depth + 1))
        .join("");
      return `<div>
                <div ${pad} class="text-sm text-gray-700">${keyLabel}<span class="text-gray-500">Object/Array</span></div>
                <div class="ml-2 border-l pl-2">${inner}</div>
            </div>`;
    }
    if (node.type === "added") {
      return `<div ${pad} class="text-sm text-green-700 bg-green-50 p-1 rounded-sm">${keyLabel}<span class="font-mono">${escapeHTML(
        prettyInline(node.valueB)
      )}</span> <span class="text-xs text-green-600 ml-2">+ added</span></div>`;
    }
    if (node.type === "removed") {
      return `<div ${pad} class="text-sm text-red-700 bg-red-50 p-1 rounded-sm">${keyLabel}<span class="font-mono line-through">${escapeHTML(
        prettyInline(node.valueA)
      )}</span> <span class="text-xs text-red-600 ml-2">- removed</span></div>`;
    }
    if (node.type === "changed") {
      return `<div ${pad} class="text-sm p-1 rounded-sm bg-yellow-50">
                ${keyLabel}
                <div class="flex gap-3 items-start">
                    <div class="text-red-600 font-mono"><strong>from:</strong> ${escapeHTML(
                      prettyInline(node.valueA)
                    )}</div>
                    <div class="text-green-600 font-mono"><strong>to:</strong> ${escapeHTML(
                      prettyInline(node.valueB)
                    )}</div>
                </div>
                <div class="text-xs text-yellow-700 mt-1">~ changed</div>
            </div>`;
    }
    return "";
  }

  // --- Editor and Highlighting ---
  let editorLeft, editorRight;
  let leftMarkers = [],
    rightMarkers = [];
  let errorMarkers = { left: null, right: null };

  function setupEditors() {
    if (typeof ace === "undefined")
      return console.error("Ace editor not loaded");
    [editorLeft, editorRight] = ["editor-left", "editor-right"].map((id) => {
      const ed = ace.edit(id);
      ed.setTheme("ace/theme/tomorrow");
      ed.session.setMode("ace/mode/json");
      ed.session.setUseWrapMode(true);
      ed.setOptions({ fontSize: "13px", fontFamily: "monospace" });
      return ed;
    });
    if (!editorLeft.getValue())
      editorLeft.setValue(
        JSON.stringify({ example: "A", value: 1 }, null, 2),
        -1
      );
    if (!editorRight.getValue())
      editorRight.setValue(
        JSON.stringify({ example: "B", value: 2 }, null, 2),
        -1
      );
  }

  function clearMarkers() {
    const allMarkers = [
      ...leftMarkers.map((id) => ({ id, editor: editorLeft })),
      ...rightMarkers.map((id) => ({ id, editor: editorRight })),
    ];
    if (errorMarkers.left)
      allMarkers.push({ id: errorMarkers.left, editor: editorLeft });
    if (errorMarkers.right)
      allMarkers.push({ id: errorMarkers.right, editor: editorRight });

    allMarkers.forEach(({ id, editor }) => {
      try {
        editor.session.removeMarker(id);
      } catch {}
    });

    leftMarkers = [];
    rightMarkers = [];
    errorMarkers = { left: null, right: null };
  }

  function addMarker(editor, line, cssClass, isError = false, side) {
    if (line < 0) return;
    const Range = ace.require("ace/range").Range;
    const range = new Range(line, 0, line, 1);
    const id = editor.session.addMarker(range, cssClass, "fullLine");
    if (isError) errorMarkers[side] = id;
    else (editor === editorLeft ? leftMarkers : rightMarkers).push(id);
  }

  function findLineForNode(editor, item) {
    const lines = editor.getValue().split('\n');
    const lastKey = item.path[item.path.length - 1];
    
    if (typeof lastKey === 'string') {
        const keyRegex = new RegExp(`^\\s*"${escapeRegex(lastKey)}"\\s*:`); 
        const line = lines.findIndex(l => keyRegex.test(l));
        if (line !== -1) return line;
    }

    const targetValue = prettyInline(editor === editorLeft ? item.node.valueA : item.node.valueB);
    if (targetValue === 'undefined') return -1;
    const valueRegex = new RegExp(escapeRegex(targetValue));
    return lines.findIndex(l => valueRegex.test(l));
}


  function highlightDiffs(root) {
    clearMarkers();
    if (!root) return;
    const items = (function collect(node, path = [], results = []) {
      if (!node) return results;
      const p = node.key === null ? path : path.concat([node.key]);
      if (["added", "removed", "changed"].includes(node.type))
        results.push({ node, path: p });
      if (node.children)
        node.children.forEach((child) => collect(child, p, results));
      return results;
    })(root, []);

    items.forEach((item) => {
      if (item.node.type === "changed") {
        addMarker(
          editorLeft,
          findLineForNode(editorLeft, item),
          "ace_line_diff_changed"
        );
        addMarker(
          editorRight,
          findLineForNode(editorRight, item),
          "ace_line_diff_changed"
        );
      } else if (item.node.type === "added") {
        addMarker(
          editorRight,
          findLineForNode(editorRight, item),
          "ace_line_diff_added"
        );
      } else if (item.node.type === "removed") {
        addMarker(
          editorLeft,
          findLineForNode(editorLeft, item),
          "ace_line_diff_removed"
        );
      }
    });
  }

  // --- Actions ---
  function doCompare() {
    clearMarkers();
    const pA = tryParse(editorLeft.getValue());
    const pB = tryParse(editorRight.getValue());

    if (!pA.ok || !pB.ok) {
      const errors = [];
      if (!pA.ok) {
        errors.push(`Left JSON error: ${pA.error.message}`);
        addMarker(editorLeft, pA.lineNumber, "ace_line_error", true, "left");
      }
      if (!pB.ok) {
        errors.push(`Right JSON error: ${pB.error.message}`);
        addMarker(editorRight, pB.lineNumber, "ace_line_error", true, "right");
      }
      $(
        "diff-summary"
      ).innerHTML = `<div class="text-sm text-red-600">${errors.join(
        "<br>"
      )}</div>`;
      $(
        "diff-result"
      ).innerHTML = `<div class="text-sm text-red-600">Fix JSON syntax errors to compare.</div>`;
      return;
    }

    const root = diffValues(pA.value, pB.value);
    $('diff-summary').innerHTML = renderSummary(root);
    $('diff-result').innerHTML = renderDiffNode(root) || '<p class="text-gray-400">No differences found.</p>';
    highlightDiffs(root);

  }

  function formatEditors() {
    [editorLeft, editorRight].forEach((ed) => {
      const p = tryParse(ed.getValue());
      if (p.ok) ed.setValue(JSON.stringify(p.value, null, 2), -1);
    });
  }

  // --- Init ---
  document.addEventListener("DOMContentLoaded", () => {
    setupEditors();

    $("compare-btn").addEventListener("click", () => {
      formatEditors();
      doCompare();
    });
    $("clear-left-btn").addEventListener("click", () =>
      editorLeft.setValue("{}", -1)
    );
    $("clear-right-btn").addEventListener("click", () =>
      editorRight.setValue("{}", -1)
    );
    $("swap-btn").addEventListener("click", () => {
      const a = editorLeft.getValue();
      editorLeft.setValue(editorRight.getValue(), -1);
      editorRight.setValue(a, -1);
    });

    let timer;
    [editorLeft, editorRight].forEach((ed) => {
      ed.session.on("change", () => {
        clearTimeout(timer);
        timer = setTimeout(doCompare, 400);
      });
    });

    $("diff-summary").innerHTML =
      '<div class="text-sm text-gray-400">Ready. Paste JSON and click Compare.</div>';
    $("diff-result").innerHTML =
      '<div class="text-sm text-gray-400">Detailed diff will appear here.</div>';
  });
})();
