/* CSD US Content Hub — single-page app (no dependencies).
 *
 * Base catalog comes from js/data.js (generated from the two source
 * spreadsheets). Admin changes are stored as an overlay in localStorage so
 * the generated file is never mutated; "Export catalog" downloads the merged
 * result for republishing.
 */
(function () {
  "use strict";

  const BASE = window.CSD_DATA || { folders: [], assets: {} };
  const LS_OVERRIDES = "csdHub.overrides.v1";
  const LS_ADMIN_HASH = "csdHub.adminHash.v1";
  const LS_THEME = "csdHub.theme";
  const SS_AUTH = "csdHub.authed";
  const DEFAULT_PASSWORD = "admin123";
  const PAGE_SIZE = 50;

  /* ---------------- overrides store ---------------- */
  function loadOverrides() {
    try {
      const o = JSON.parse(localStorage.getItem(LS_OVERRIDES) || "{}");
      return { removed: o.removed || {}, edits: o.edits || {}, custom: o.custom || {} };
    } catch (e) {
      return { removed: {}, edits: {}, custom: {} };
    }
  }
  let overrides = loadOverrides();
  function saveOverrides() {
    localStorage.setItem(LS_OVERRIDES, JSON.stringify(overrides));
    rebuildIndexes();
  }

  /* ---------------- merged data access ---------------- */
  function getAsset(id) {
    const base = BASE.assets[id] || overrides.custom[id];
    if (!base) return null;
    const edit = overrides.edits[id];
    return edit ? Object.assign({}, base, edit) : base;
  }
  function isRemoved(id) { return !!overrides.removed[id]; }

  function assetCategory(a) {
    const t = (a.type || "").toLowerCase();
    if (t.includes("pdf")) return "pdf";
    if (t.startsWith("video")) return "video";
    if (t.startsWith("image")) return "image";
    if (t.includes("presentation") || t.includes("word") || t.includes("msword") || t.includes("document")) return "doc";
    if (t.includes("zip")) return "zip";
    return "other";
  }
  const CAT_LABELS = { pdf: "PDF", video: "Video", image: "Image", doc: "Document", zip: "Archive", other: "Other" };

  /* ---------------- folder tree ---------------- */
  let root, nodeById, assetFolderIds, allLiveAssetIds;

  function buildTree() {
    root = { id: "root", name: "CSD US", children: new Map(), folder: null, parent: null };
    nodeById = new Map([["root", root]]);
    let synth = 0;

    BASE.folders.forEach(function (f) {
      // path[0] is always the root ("CSD US"); walk/create the rest.
      let node = root;
      for (let i = 1; i < f.path.length; i++) {
        const name = f.path[i];
        if (!node.children.has(name)) {
          const child = { id: "n" + (++synth), name: name, children: new Map(), folder: null, parent: node };
          node.children.set(name, child);
          nodeById.set(child.id, child);
        }
        node = node.children.get(name);
      }
      if (f.path.length === 1) node = root;
      node.folder = f;
      if (f.globalId) {
        nodeById.delete(node.id);
        node.id = f.globalId;
      }
      nodeById.set(node.id, node);
    });
  }

  function nodeAssets(node) {
    const ids = [];
    if (node.folder) {
      node.folder.assetIds.forEach(function (id) { if (!isRemoved(id) && getAsset(id)) ids.push(id); });
    }
    Object.keys(overrides.custom).forEach(function (id) {
      if (isRemoved(id)) return;
      const folders = overrides.custom[id].folderIds || [];
      if (folders.indexOf(node.id) !== -1 && ids.indexOf(id) === -1) ids.push(id);
    });
    return ids;
  }

  function subtreeCount(node) {
    let n = nodeAssets(node).length;
    node.children.forEach(function (c) { n += subtreeCount(c); });
    return n;
  }

  function rebuildIndexes() {
    assetFolderIds = new Map();
    allLiveAssetIds = [];
    const seen = new Set();
    (function walk(node) {
      nodeAssets(node).forEach(function (id) {
        if (!assetFolderIds.has(id)) assetFolderIds.set(id, []);
        assetFolderIds.get(id).push(node.id);
        if (!seen.has(id)) { seen.add(id); allLiveAssetIds.push(id); }
      });
      node.children.forEach(walk);
    })(root);
  }

  function nodePath(node) {
    const parts = [];
    for (let n = node; n; n = n.parent) parts.unshift(n);
    return parts;
  }

  function sortedChildren(node) {
    return Array.from(node.children.values()).sort(function (a, b) {
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
  }

  /* ---------------- utilities ---------------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function formatSize(bytes) {
    if (bytes == null) return "";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(0) + " KB";
    if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + " MB";
    return (bytes / 1073741824).toFixed(2) + " GB";
  }
  function toast(msg) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.classList.remove("show"); }, 2400);
  }
  async function sha256(text) {
    if (window.crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
      return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, "0"); }).join("");
    }
    // Non-secure-context fallback (plain FNV-1a) — demo-grade only.
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return "fnv:" + h.toString(16);
  }
  function extractAssetId(url) {
    const m = String(url).match(/\/media\/(\d+)[A-Za-z]?\b/) || String(url).match(/[?&]id=(\d+)/);
    return m ? m[1] : null;
  }
  function inferType(url) {
    const m = String(url).toLowerCase().match(/\.([a-z0-9]{2,5})(?:[?#]|$)/);
    const ext = m ? m[1] : "";
    const map = {
      pdf: "application/pdf", mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm",
      jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp",
      zip: "application/zip",
      ppt: "application/vnd.ms-powerpoint",
      pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    };
    return map[ext] || "";
  }

  /* ---------------- icons ---------------- */
  const ICONS = {
    pdf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z"/><path d="M14 2v5h5"/><path d="M9 15h6M9 11.5h6"/></svg>',
    video: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 9.5l5 2.5-5 2.5z" fill="currentColor" stroke="none"/></svg>',
    image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="M4 18l5-5 4 4 3-3 4 4"/></svg>',
    doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z"/><path d="M14 2v5h5"/><path d="M9 13h6M9 16.5h4"/></svg>',
    zip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M12 3v3m0 2v2m0 2v2"/><rect x="10.5" y="14" width="3" height="3.5" rx="1"/></svg>',
    other: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.07 0l2.5-2.5a5 5 0 0 0-7.07-7.07L11 4.93"/><path d="M14 11a5 5 0 0 0-7.07 0l-2.5 2.5a5 5 0 0 0 7.07 7.07L13 19.07"/></svg>',
    folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2.2 2.5H19a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
    open: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5.5"/><path d="M14 3h7v7"/><path d="M10 14L21 3"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
    searchOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4.2-4.2M8.5 8.5l5 5M13.5 8.5l-5 5"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m0 0l-4.5-4.5M12 15l4.5-4.5"/><path d="M4 19h16"/></svg>',
    table: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 10v10"/></svg>',
    play: '<svg viewBox="0 0 24 24"><path d="M8 5.5l11 6.5-11 6.5z" fill="currentColor"/></svg>',
    folderSm: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2.2 2.5H19a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>'
  };

  /* ---------------- routing ---------------- */
  function route() {
    const hash = location.hash || "#/";
    if (hash.startsWith("#/admin")) return { view: "admin" };
    if (hash.startsWith("#/search/")) return { view: "search", q: decodeURIComponent(hash.slice(9)) };
    if (hash.startsWith("#/f/")) return { view: "folder", id: decodeURIComponent(hash.slice(4)) };
    return { view: "folder", id: "root" };
  }
  function go(hash) { location.hash = hash; }

  /* ---------------- sidebar tree ---------------- */
  const openNodes = new Set(["root"]);

  function renderTree(activeId) {
    const el = document.getElementById("folderTree");
    function renderNode(node) {
      const kids = sortedChildren(node);
      const count = subtreeCount(node);
      const isOpen = openNodes.has(node.id);
      const isActive = node.id === activeId;
      let html = '<li class="tree-item' + (isOpen ? " open" : "") + '" data-node="' + esc(node.id) + '">';
      html += '<div class="tree-row' + (isActive ? " active" : "") + '" data-go="' + esc(node.id) + '">';
      html += '<span class="tree-toggle' + (kids.length ? "" : " leaf") + '" data-toggle="' + esc(node.id) + '">' + ICONS.chevron + "</span>";
      html += '<span class="tree-label" title="' + esc(node.name) + '">' + esc(node.name) + "</span>";
      if (count) html += '<span class="tree-count">' + count + "</span>";
      html += "</div>";
      if (kids.length) html += '<ul class="tree-group">' + kids.map(renderNode).join("") + "</ul>";
      html += "</li>";
      return html;
    }
    el.innerHTML = '<ul class="tree-group">' + renderNode(root) + "</ul>";
  }

  function expandTo(nodeId) {
    const node = nodeById.get(nodeId);
    if (!node) return;
    nodePath(node).forEach(function (n) { openNodes.add(n.id); });
  }

  /* ---------------- asset row ---------------- */
  function assetUrl(a) {
    // Videos play through Brightcove/YouTube (the MWS video URLs are bare
    // stubs with no file behind them); everything else uses the MWS file URL.
    return a.playUrl || a.url || "https://multimedia.3m.com/mws/media/" + a.id + "O";
  }

  let THUMBS = new Set(); // asset ids with a local thumbs/<id>.jpg (see manifest)

  function thumbHtml(a) {
    const cat = assetCategory(a);
    let img = "";
    if (cat === "image" && a.url) img = a.url;
    else if (a.ytId) img = "https://img.youtube.com/vi/" + a.ytId + "/mqdefault.jpg";
    else if (THUMBS.has(a.id)) img = "thumbs/" + a.id + ".jpg";
    // The icon sits underneath; if the image 404s it is removed and the icon shows.
    const imgTag = img
      ? '<img src="' + esc(img) + '" loading="lazy" alt="" onerror="this.remove()">'
      : "";
    return '<span class="thumb tb-' + cat + '" title="' + esc(a.type || "link") + '">' +
      ICONS[cat] + imgTag +
      (cat === "video" ? '<span class="play-badge">' + ICONS.play + "</span>" : "") +
      "</span>";
  }

  function assetRow(id, opts) {
    opts = opts || {};
    const a = getAsset(id);
    if (!a) return "";
    const url = assetUrl(a);
    const meta = [];
    meta.push(esc(CAT_LABELS[assetCategory(a)]));
    if (a.size) meta.push(formatSize(a.size));
    if (a.litNumber) meta.push("Lit. " + esc(a.litNumber));
    meta.push('<span class="m-id">ID ' + esc(a.id) + "</span>");
    if (opts.showPath) {
      const fids = assetFolderIds.get(id) || [];
      const node = fids.length ? nodeById.get(fids[0]) : null;
      if (node) {
        meta.unshift('<a class="m-folder" href="#/f/' + encodeURIComponent(node.id) +
          '" title="' + esc(nodePath(node).map(function (n) { return n.name; }).join(" / ")) + '">' +
          ICONS.folderSm + esc(node.name) + "</a>");
      }
    }
    const tip = a.description ? a.title + " — " + a.description : a.title;
    const isCustom = !!overrides.custom[id];
    return (
      '<article class="asset-row">' + thumbHtml(a) +
        '<a class="row-title" href="' + esc(url) + '" target="_blank" rel="noopener" title="' + esc(tip) + '">' +
          esc(a.title || "Untitled asset " + a.id) +
          (isCustom ? ' <span class="tag-new">New</span>' : "") + "</a>" +
        '<span class="row-meta">' + meta.join('<span class="dot">·</span>') + "</span>" +
        '<span class="row-actions">' +
          '<a class="icon-btn" href="' + esc(url) + '" target="_blank" rel="noopener" title="Open asset" aria-label="Open asset">' + ICONS.open + "</a>" +
          '<button class="icon-btn" data-copy="' + esc(url) + '" title="Copy link" aria-label="Copy link">' + ICONS.copy + "</button>" +
        "</span>" +
      "</article>"
    );
  }

  /* ---------------- filter toolbar ---------------- */
  let activeCat = "all";

  function catToolbar(ids, countLabel) {
    const cats = {};
    ids.forEach(function (id) {
      const a = getAsset(id);
      if (a) cats[assetCategory(a)] = (cats[assetCategory(a)] || 0) + 1;
    });
    const keys = Object.keys(cats);
    if (activeCat !== "all" && !cats[activeCat]) activeCat = "all";
    let html = '<div class="toolbar">';
    html += '<button class="chip' + (activeCat === "all" ? " active" : "") + '" data-cat="all">All (' + ids.length + ")</button>";
    ["pdf", "video", "image", "doc", "zip", "other"].forEach(function (c) {
      if (!keys.includes(c)) return;
      html += '<button class="chip' + (activeCat === c ? " active" : "") + '" data-cat="' + c + '">' + CAT_LABELS[c] + " (" + cats[c] + ")</button>";
    });
    html += '<span class="spacer"></span><span class="result-count">' + esc(countLabel) + "</span></div>";
    return html;
  }
  function filterByCat(ids) {
    if (activeCat === "all") return ids;
    return ids.filter(function (id) { const a = getAsset(id); return a && assetCategory(a) === activeCat; });
  }
  function normalizeCat(ids) {
    if (activeCat === "all") return;
    const any = ids.some(function (id) { const a = getAsset(id); return a && assetCategory(a) === activeCat; });
    if (!any) activeCat = "all";
  }

  /* ---------------- folder view ---------------- */
  function renderFolder(id) {
    const node = nodeById.get(id) || root;
    expandTo(node.id);
    renderTree(node.id);

    const parts = nodePath(node);
    const crumbs = parts.map(function (n, i) {
      if (i === parts.length - 1) return '<span class="current">' + esc(n.name) + "</span>";
      return '<a href="#/f/' + encodeURIComponent(n.id) + '">' + esc(n.name) + '</a><span class="sep">/</span>';
    }).join("");

    const kids = sortedChildren(node);
    const ids = nodeAssets(node).sort(function (x, y) {
      const ax = getAsset(x), ay = getAsset(y);
      return (ax.title || "").localeCompare(ay.title || "", undefined, { sensitivity: "base" });
    });
    normalizeCat(ids);
    const shown = filterByCat(ids);

    let html = '<div class="breadcrumbs">' + crumbs + "</div>";
    html += '<div class="page-head"><h1>' + esc(node.name) + "</h1>";
    const desc = node.folder && node.folder.description;
    const totalInTree = subtreeCount(node);
    html += '<p class="sub">' + (desc ? esc(desc) + " · " : "") + totalInTree + " asset" + (totalInTree === 1 ? "" : "s") +
      (kids.length ? " · " + kids.length + " subfolder" + (kids.length === 1 ? "" : "s") : "") + "</p></div>";

    if (kids.length) {
      html += '<h2 class="section-title">Folders</h2><div class="folder-grid">';
      kids.forEach(function (k) {
        const c = subtreeCount(k);
        html += '<a class="folder-card" href="#/f/' + encodeURIComponent(k.id) + '">' +
          '<span class="f-icon">' + ICONS.folder + "</span>" +
          '<span><span class="f-name">' + esc(k.name) + '</span><div class="f-meta">' + c + " asset" + (c === 1 ? "" : "s") + "</div></span></a>";
      });
      html += "</div>";
    }

    if (ids.length) {
      html += '<h2 class="section-title">Assets</h2>';
      html += catToolbar(ids, shown.length + " shown");
      html += '<div class="asset-list">' + shown.map(function (i) { return assetRow(i); }).join("") + "</div>";
    } else if (!kids.length) {
      html += emptyState("This folder is empty", "No assets have been published here yet.");
    }
    setMain(html);
  }

  /* ---------------- search view ---------------- */
  function searchAssets(q) {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    return allLiveAssetIds.filter(function (id) {
      const a = getAsset(id);
      const hay = (a.title + " " + a.description + " " + a.id + " " + (a.litNumber || "")).toLowerCase();
      return terms.every(function (t) { return hay.includes(t); });
    }).sort(function (x, y) {
      const ax = getAsset(x), ay = getAsset(y);
      const q0 = terms[0];
      const sx = (ax.title || "").toLowerCase().indexOf(q0) !== -1 ? 0 : 1;
      const sy = (ay.title || "").toLowerCase().indexOf(q0) !== -1 ? 0 : 1;
      if (sx !== sy) return sx - sy;
      return (ax.title || "").localeCompare(ay.title || "");
    });
  }

  function renderSearch(q) {
    renderTree(null);
    document.getElementById("searchInput").value = q;
    document.getElementById("searchClear").hidden = !q;
    const ids = searchAssets(q);
    normalizeCat(ids);
    const shown = filterByCat(ids);
    let html = '<div class="page-head"><h1>Search results</h1>' +
      '<p class="sub">' + ids.length + " match" + (ids.length === 1 ? "" : "es") + ' for &ldquo;' + esc(q) + "&rdquo;</p></div>";
    if (ids.length) {
      html += catToolbar(ids, shown.length + " shown");
      html += '<div class="asset-list">' + shown.map(function (i) { return assetRow(i, { showPath: true }); }).join("") + "</div>";
    } else {
      html += emptyState("No results", "Try a different keyword, an asset ID, or a literature number.");
    }
    setMain(html);
  }

  function emptyState(title, sub) {
    return '<div class="empty">' + ICONS.searchOff + '<div class="t">' + esc(title) + '</div><div class="s">' + esc(sub) + "</div></div>";
  }

  /* ---------------- admin ---------------- */
  let adminFilter = { q: "", status: "all", page: 0 };

  async function adminHash() {
    return localStorage.getItem(LS_ADMIN_HASH) || await sha256(DEFAULT_PASSWORD);
  }
  function isAuthed() { return sessionStorage.getItem(SS_AUTH) === "1"; }

  function renderAdmin() {
    renderTree(null);
    if (!isAuthed()) return renderLogin();
    renderDashboard();
  }

  function renderLogin() {
    setMain(
      '<div class="login-wrap"><form class="login-card" id="loginForm">' +
        "<h1>Admin sign in</h1>" +
        '<p class="sub">Enter the administrator password to manage the asset catalog.</p>' +
        '<div class="field"><label for="pw">Password</label>' +
        '<input id="pw" type="password" autocomplete="current-password" required autofocus>' +
        '<div class="err" id="pwErr" hidden>Incorrect password. Please try again.</div>' +
        '<div class="hint">Default password is <code>admin123</code> until changed in the dashboard.</div></div>' +
        '<button class="btn btn-primary" style="width:100%;justify-content:center" type="submit">Sign in</button>' +
      "</form></div>"
    );
    document.getElementById("loginForm").addEventListener("submit", async function (e) {
      e.preventDefault();
      const pw = document.getElementById("pw").value;
      if ((await sha256(pw)) === (await adminHash())) {
        sessionStorage.setItem(SS_AUTH, "1");
        renderDashboard();
      } else {
        document.getElementById("pwErr").hidden = false;
      }
    });
  }

  function folderOptions(selectedId) {
    const opts = [];
    (function walk(node, depth) {
      const label = "  ".repeat(depth) + node.name;
      opts.push('<option value="' + esc(node.id) + '"' + (node.id === selectedId ? " selected" : "") + ">" + label + "</option>");
      sortedChildren(node).forEach(function (c) { walk(c, depth + 1); });
    })(root, 0);
    return opts.join("");
  }

  function adminRows() {
    const rows = [];
    allLiveAssetIds.forEach(function (id) { rows.push(id); });
    Object.keys(overrides.removed).forEach(function (id) { if (getAsset(id)) rows.push(id); });
    // de-dup, search, status filter
    const seen = new Set();
    const q = adminFilter.q.toLowerCase();
    return rows.filter(function (id) {
      if (seen.has(id)) return false;
      seen.add(id);
      const a = getAsset(id);
      if (!a) return false;
      const status = isRemoved(id) ? "removed" : (overrides.custom[id] ? "custom" : (overrides.edits[id] ? "edited" : "live"));
      if (adminFilter.status !== "all" && status !== adminFilter.status &&
          !(adminFilter.status === "live" && status === "edited")) return false;
      if (q && (a.title + " " + a.id + " " + (a.litNumber || "")).toLowerCase().indexOf(q) === -1) return false;
      return true;
    }).sort(function (x, y) {
      return (getAsset(x).title || "").localeCompare(getAsset(y).title || "", undefined, { sensitivity: "base" });
    });
  }


  /* ---------------- link checker (admin) ---------------- */
  const LINK_TIMEOUT_MS = 5000;
  let lcRunning = false;

  function probeLink(url) {
    const started = performance.now();
    return new Promise(function (resolve) {
      const finish = function (ok, reason) {
        resolve({ ok: ok, ms: Math.round(performance.now() - started), reason: reason || "" });
      };
      if (/\.(jpe?g|png|gif|webp)([?#]|$)/i.test(url)) {
        const img = new Image();
        const t = setTimeout(function () { img.src = ""; finish(false, "timeout"); }, LINK_TIMEOUT_MS);
        img.onload = function () { clearTimeout(t); finish(true); };
        img.onerror = function () { clearTimeout(t); finish(false, "not found / blocked"); };
        img.src = url;
        return;
      }
      const ctrl = new AbortController();
      const t = setTimeout(function () { ctrl.abort(); }, LINK_TIMEOUT_MS);
      fetch(url, { mode: "no-cors", cache: "no-store", redirect: "follow", signal: ctrl.signal })
        .then(function () {
          clearTimeout(t);
          const ms = performance.now() - started;
          ctrl.abort(); // stop any body download
          if (ms > LINK_TIMEOUT_MS) finish(false, "timeout");
          else finish(true);
        })
        .catch(function (e) {
          clearTimeout(t);
          finish(false, e && e.name === "AbortError" ? "timeout" : "network error");
        });
    });
  }

  async function runLinkCheck() {
    if (lcRunning) return;
    lcRunning = true;
    const progress = document.getElementById("lcProgress");
    const ids = allLiveAssetIds.slice();
    const failures = [];
    let done = 0;
    const queue = ids.slice();
    async function worker() {
      while (queue.length) {
        const id = queue.shift();
        const a = getAsset(id);
        const res = await probeLink(assetUrl(a));
        done++;
        if (!res.ok) failures.push({ id: id, reason: res.reason, ms: res.ms });
        if (done % 5 === 0 || done === ids.length) {
          progress.textContent = "Checked " + done + " / " + ids.length +
            (failures.length ? " — " + failures.length + " failed" : "");
        }
      }
    }
    await Promise.all([1, 2, 3, 4, 5, 6].map(worker));
    lcRunning = false;
    progress.textContent = "Done: " + ids.length + " checked, " + failures.length + " failed (>" +
      (LINK_TIMEOUT_MS / 1000) + "s or unreachable)";
    renderLcResults(failures, "browser check");
  }

  function loadServerReport() {
    const progress = document.getElementById("lcProgress");
    fetch("reports/link-report.json", { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("no report"); return r.json(); })
      .then(function (rep) {
        const verdictByUrl = {};
        rep.links.forEach(function (row) { verdictByUrl[row.url] = row; });
        const failures = [];
        allLiveAssetIds.forEach(function (id) {
          const a = getAsset(id);
          const row = verdictByUrl[assetUrl(a)];
          if (row && row.verdict !== "ok") {
            failures.push({ id: id, reason: row.verdict + (row.status ? " (HTTP " + row.status + ")" : ""), ms: row.elapsedMs });
          }
        });
        progress.textContent = "Server report from " + (rep.generated || "?") + ": " +
          failures.length + " of " + allLiveAssetIds.length + " assets failed";
        renderLcResults(failures, "server report");
      })
      .catch(function () {
        progress.textContent = "No server report found (reports/link-report.json). Run the \u201cCheck asset links\u201d GitHub Action first.";
      });
  }

  function renderLcResults(failures, source) {
    const wrap = document.getElementById("lcResults");
    if (!failures.length) {
      wrap.innerHTML = '<p class="hint" style="margin-top:10px">No failing links \u2014 nothing to remove.</p>';
      return;
    }
    let html = '<div class="table-toolbar" style="margin-top:14px">' +
      '<button class="btn btn-danger" id="lcRemoveAll">Remove all ' + failures.length + " failed assets</button></div>";
    html += '<div class="admin-table-wrap"><table class="admin-table"><thead><tr>' +
      "<th>Title</th><th>ID</th><th>Result (" + esc(source) + ")</th><th>Time</th><th></th></tr></thead><tbody>";
    failures.forEach(function (f) {
      const a = getAsset(f.id);
      if (!a) return;
      html += '<tr data-lcrow="' + esc(f.id) + '">' +
        '<td class="t-title"><a href="' + esc(assetUrl(a)) + '" target="_blank" rel="noopener">' + esc(a.title || "Untitled") + "</a></td>" +
        "<td>" + esc(f.id) + "</td>" +
        "<td>" + esc(f.reason) + "</td>" +
        "<td>" + (f.ms != null ? f.ms + " ms" : "") + "</td>" +
        '<td class="actions-cell"><button class="btn btn-danger btn-sm" data-lcremove="' + esc(f.id) + '">Remove</button></td></tr>';
    });
    html += "</tbody></table></div>";
    wrap.innerHTML = html;
    wrap.querySelector("#lcRemoveAll").addEventListener("click", function () {
      if (!confirm("Remove all " + failures.length + " assets with failing links?\n\nThey can be restored from the \u201cRemoved\u201d filter.")) return;
      failures.forEach(function (f) { overrides.removed[f.id] = true; });
      saveOverrides();
      toast("Removed " + failures.length + " assets");
      renderDashboard();
    });
    wrap.querySelectorAll("[data-lcremove]").forEach(function (b) {
      b.addEventListener("click", function () {
        const id = b.getAttribute("data-lcremove");
        overrides.removed[id] = true;
        saveOverrides();
        const tr = wrap.querySelector('[data-lcrow="' + id + '"]');
        if (tr) tr.remove();
        toast("Removed");
      });
    });
  }

  function renderDashboard() {
    const totalLive = allLiveAssetIds.length;
    const removedCount = Object.keys(overrides.removed).length;
    const customCount = Object.keys(overrides.custom).length;
    const editCount = Object.keys(overrides.edits).length;
    const folderCount = nodeById.size;

    let html = '<div class="admin-head"><h1>Admin dashboard</h1>' +
      '<button class="btn btn-ghost" id="exportBtn">' + ICONS.download + " Export catalog</button>" +
      '<button class="btn btn-ghost" id="pwBtn">Change password</button>' +
      '<button class="btn btn-ghost" id="logoutBtn">Sign out</button></div>';

    html += '<div class="stat-row">' +
      '<div class="stat"><div class="v">' + totalLive + '</div><div class="l">Published assets</div></div>' +
      '<div class="stat"><div class="v">' + folderCount + '</div><div class="l">Folders</div></div>' +
      '<div class="stat"><div class="v">' + customCount + '</div><div class="l">Added by admin</div></div>' +
      '<div class="stat"><div class="v">' + editCount + '</div><div class="l">Titles edited</div></div>' +
      '<div class="stat"><div class="v">' + removedCount + '</div><div class="l">Removed</div></div></div>';

    // Add asset panel
    html += '<div class="panel"><h2>' + ICONS.plus + " Add a new asset</h2>" +
      '<form id="addForm"><div class="form-grid">' +
        '<div class="field full"><label for="addUrl">Asset URL *</label>' +
        '<input id="addUrl" type="url" required placeholder="https://multimedia.3m.com/mws/media/1234567O/example.pdf">' +
        '<div class="hint" id="addUrlHint">The asset ID is read automatically from the URL when present.</div></div>' +
        '<div class="field"><label for="addTitle">Asset title *</label>' +
        '<input id="addTitle" type="text" required placeholder="e.g. Product Bulletin 40C"></div>' +
        '<div class="field"><label for="addFolder">Folder *</label>' +
        '<select id="addFolder">' + folderOptions(null) + "</select></div>" +
        '<div class="field full"><label for="addDesc">Description (optional)</label>' +
        '<textarea id="addDesc" rows="2" placeholder="Short description shown on the asset card"></textarea></div>' +
      '</div><button class="btn btn-primary" type="submit">' + ICONS.plus + " Add asset</button></form></div>";

    // Link check panel
    html += '<div class="panel"><h2>' + ICONS.other + " Link check</h2>" +
      '<p class="hint" style="margin-bottom:12px">Tests every published asset link with a ' + (LINK_TIMEOUT_MS / 1000) +
      "-second budget. The browser check catches unreachable and slow links; the server report (from the " +
      '\u201cCheck asset links\u201d GitHub Action) also catches 404s and other HTTP errors.</p>' +
      '<div class="table-toolbar">' +
        '<button class="btn btn-primary" id="lcStart">Check all links now</button>' +
        '<button class="btn btn-ghost" id="lcReport">Load server report</button>' +
        '<span class="result-count" id="lcProgress" style="align-self:center"></span></div>' +
      '<div id="lcResults"></div></div>';

    // Asset table
    html += '<div class="panel"><h2>' + ICONS.table + " Manage assets</h2>" +
      '<div class="table-toolbar">' +
        '<input id="adminSearch" type="search" placeholder="Filter by title, ID or literature number…" value="' + esc(adminFilter.q) + '">' +
        '<select id="adminStatus">' +
          '<option value="all"' + (adminFilter.status === "all" ? " selected" : "") + ">All statuses</option>" +
          '<option value="live"' + (adminFilter.status === "live" ? " selected" : "") + ">Live</option>" +
          '<option value="custom"' + (adminFilter.status === "custom" ? " selected" : "") + ">Added by admin</option>" +
          '<option value="removed"' + (adminFilter.status === "removed" ? " selected" : "") + ">Removed</option>" +
        "</select></div>" +
      '<div id="adminTable"></div></div>';

    setMain(html);
    renderAdminTable();

    document.getElementById("logoutBtn").addEventListener("click", function () {
      sessionStorage.removeItem(SS_AUTH);
      go("#/");
      toast("Signed out");
    });
    document.getElementById("exportBtn").addEventListener("click", exportCatalog);
    document.getElementById("pwBtn").addEventListener("click", changePasswordModal);
    document.getElementById("lcStart").addEventListener("click", runLinkCheck);
    document.getElementById("lcReport").addEventListener("click", loadServerReport);

    document.getElementById("addUrl").addEventListener("input", function () {
      const id = extractAssetId(this.value);
      document.getElementById("addUrlHint").textContent = id
        ? "Detected asset ID: " + id
        : "The asset ID is read automatically from the URL when present.";
    });
    document.getElementById("addForm").addEventListener("submit", function (e) {
      e.preventDefault();
      const url = document.getElementById("addUrl").value.trim();
      const title = document.getElementById("addTitle").value.trim();
      const desc = document.getElementById("addDesc").value.trim();
      const folderId = document.getElementById("addFolder").value;
      if (!url || !title) return;
      let id = extractAssetId(url);
      if (!id || getAsset(id)) {
        if (id && getAsset(id) && !overrides.custom[id]) {
          toast("Asset " + id + " already exists in the catalog");
          return;
        }
        if (!id) id = "custom-" + Date.now();
      }
      overrides.custom[id] = {
        id: id, title: title, description: desc, url: url,
        type: inferType(url), size: null, created: new Date().toISOString(),
        litNumber: "", folderIds: [folderId]
      };
      delete overrides.removed[id];
      saveOverrides();
      toast("Added “" + title + "”");
      renderDashboard();
    });

    let t;
    document.getElementById("adminSearch").addEventListener("input", function () {
      clearTimeout(t);
      const v = this.value;
      t = setTimeout(function () { adminFilter.q = v; adminFilter.page = 0; renderAdminTable(); }, 150);
    });
    document.getElementById("adminStatus").addEventListener("change", function () {
      adminFilter.status = this.value; adminFilter.page = 0; renderAdminTable();
    });
  }

  function renderAdminTable() {
    const ids = adminRows();
    const pages = Math.max(1, Math.ceil(ids.length / PAGE_SIZE));
    if (adminFilter.page >= pages) adminFilter.page = pages - 1;
    const slice = ids.slice(adminFilter.page * PAGE_SIZE, (adminFilter.page + 1) * PAGE_SIZE);

    let html = '<div class="admin-table-wrap"><table class="admin-table"><thead><tr>' +
      "<th>Title</th><th>ID</th><th>Type</th><th>Folder</th><th>Status</th><th></th></tr></thead><tbody>";
    slice.forEach(function (id) {
      const a = getAsset(id);
      const removed = isRemoved(id);
      const custom = !!overrides.custom[id];
      const fids = custom ? (overrides.custom[id].folderIds || []) : (assetFolderIds.get(id) || []);
      const fnames = fids.map(function (fid) {
        const n = nodeById.get(fid); return n ? n.name : fid;
      });
      const status = removed
        ? '<span class="pill pill-removed">Removed</span>'
        : custom ? '<span class="pill pill-custom">Added</span>' : '<span class="pill pill-live">Live</span>';
      html += "<tr>" +
        '<td class="t-title">' + esc(a.title || "Untitled") +
          (a.litNumber ? '<div class="t-sub">Lit. ' + esc(a.litNumber) + "</div>" : "") + "</td>" +
        "<td>" + esc(a.id) + "</td>" +
        "<td>" + esc(CAT_LABELS[assetCategory(a)]) + "</td>" +
        '<td>' + esc(fnames.slice(0, 2).join(", ") || "—") + (fnames.length > 2 ? " +" + (fnames.length - 2) : "") + "</td>" +
        "<td>" + status + "</td>" +
        '<td class="actions-cell">' +
          '<button class="btn btn-ghost btn-sm" data-edit="' + esc(id) + '">Edit</button> ' +
          (removed
            ? '<button class="btn btn-ghost btn-sm" data-restore="' + esc(id) + '">Restore</button>'
            : '<button class="btn btn-danger btn-sm" data-remove="' + esc(id) + '">Remove</button>') +
        "</td></tr>";
    });
    html += "</tbody></table></div>";
    if (!slice.length) html = emptyState("No matching assets", "Adjust the filter or search term.");
    html += '<div class="pager">' +
      '<span>Page ' + (adminFilter.page + 1) + " of " + pages + " · " + ids.length + " assets</span>" +
      '<button class="btn btn-ghost btn-sm" id="prevPage"' + (adminFilter.page === 0 ? " disabled" : "") + ">Prev</button>" +
      '<button class="btn btn-ghost btn-sm" id="nextPage"' + (adminFilter.page >= pages - 1 ? " disabled" : "") + ">Next</button></div>";

    const wrap = document.getElementById("adminTable");
    wrap.innerHTML = html;
    wrap.querySelector("#prevPage").addEventListener("click", function () { adminFilter.page--; renderAdminTable(); });
    wrap.querySelector("#nextPage").addEventListener("click", function () { adminFilter.page++; renderAdminTable(); });

    wrap.querySelectorAll("[data-remove]").forEach(function (b) {
      b.addEventListener("click", function () {
        const id = b.getAttribute("data-remove");
        const a = getAsset(id);
        if (!confirm('Remove "' + (a.title || id) + '" from the catalog?\n\nIt can be restored later from the "Removed" filter.')) return;
        overrides.removed[id] = true;
        saveOverrides();
        toast("Removed “" + (a.title || id) + "”");
        renderDashboard();
      });
    });
    wrap.querySelectorAll("[data-restore]").forEach(function (b) {
      b.addEventListener("click", function () {
        const id = b.getAttribute("data-restore");
        delete overrides.removed[id];
        saveOverrides();
        toast("Restored");
        renderDashboard();
      });
    });
    wrap.querySelectorAll("[data-edit]").forEach(function (b) {
      b.addEventListener("click", function () { editModal(b.getAttribute("data-edit")); });
    });
  }

  function modal(innerHtml) {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = '<div class="modal">' + innerHtml + "</div>";
    overlay.addEventListener("click", function (e) { if (e.target === overlay) overlay.remove(); });
    document.addEventListener("keydown", function esc_(e) {
      if (e.key === "Escape") { overlay.remove(); document.removeEventListener("keydown", esc_); }
    });
    document.body.appendChild(overlay);
    return overlay;
  }

  function editModal(id) {
    const a = getAsset(id);
    const custom = overrides.custom[id];
    const overlay = modal(
      "<h2>Edit asset</h2>" +
      '<div class="field"><label>Title</label><input id="eTitle" type="text" value="' + esc(a.title) + '"></div>' +
      '<div class="field"><label>Description</label><textarea id="eDesc" rows="3">' + esc(a.description) + "</textarea></div>" +
      (custom
        ? '<div class="field"><label>URL</label><input id="eUrl" type="url" value="' + esc(a.url) + '"></div>' +
          '<div class="field"><label>Folder</label><select id="eFolder">' + folderOptions((custom.folderIds || [])[0]) + "</select></div>"
        : '<div class="field"><div class="hint">URL and folder placement of catalog assets come from the source spreadsheets. ID ' + esc(id) + " · " + esc(a.url) + "</div></div>") +
      '<div class="modal-actions"><button class="btn btn-ghost" id="eCancel">Cancel</button>' +
      '<button class="btn btn-primary" id="eSave">Save changes</button></div>'
    );
    overlay.querySelector("#eCancel").addEventListener("click", function () { overlay.remove(); });
    overlay.querySelector("#eSave").addEventListener("click", function () {
      const title = overlay.querySelector("#eTitle").value.trim();
      const desc = overlay.querySelector("#eDesc").value.trim();
      if (!title) { toast("Title is required"); return; }
      if (custom) {
        custom.title = title;
        custom.description = desc;
        custom.url = overlay.querySelector("#eUrl").value.trim() || custom.url;
        custom.folderIds = [overlay.querySelector("#eFolder").value];
      } else {
        overrides.edits[id] = { title: title, description: desc };
        const base = BASE.assets[id];
        if (base && base.title === title && base.description === desc) delete overrides.edits[id];
      }
      saveOverrides();
      overlay.remove();
      toast("Saved");
      renderDashboard();
    });
  }

  function changePasswordModal() {
    const overlay = modal(
      "<h2>Change admin password</h2>" +
      '<div class="field"><label>Current password</label><input id="cCur" type="password" autocomplete="current-password"></div>' +
      '<div class="field"><label>New password</label><input id="cNew" type="password" autocomplete="new-password">' +
      '<div class="hint">At least 8 characters. Stored locally in this browser only.</div></div>' +
      '<div class="field"><label>Confirm new password</label><input id="cNew2" type="password" autocomplete="new-password">' +
      '<div class="err" id="cErr" hidden></div></div>' +
      '<div class="modal-actions"><button class="btn btn-ghost" id="cCancel">Cancel</button>' +
      '<button class="btn btn-primary" id="cSave">Update password</button></div>'
    );
    overlay.querySelector("#cCancel").addEventListener("click", function () { overlay.remove(); });
    overlay.querySelector("#cSave").addEventListener("click", async function () {
      const err = overlay.querySelector("#cErr");
      const cur = overlay.querySelector("#cCur").value;
      const nw = overlay.querySelector("#cNew").value;
      const nw2 = overlay.querySelector("#cNew2").value;
      err.hidden = true;
      if ((await sha256(cur)) !== (await adminHash())) { err.textContent = "Current password is incorrect."; err.hidden = false; return; }
      if (nw.length < 8) { err.textContent = "New password must be at least 8 characters."; err.hidden = false; return; }
      if (nw !== nw2) { err.textContent = "New passwords do not match."; err.hidden = false; return; }
      localStorage.setItem(LS_ADMIN_HASH, await sha256(nw));
      overlay.remove();
      toast("Password updated");
    });
  }

  function exportCatalog() {
    const folders = BASE.folders.map(function (f) {
      return Object.assign({}, f, {
        assetIds: f.assetIds.filter(function (id) { return !isRemoved(id); })
      });
    });
    const assets = {};
    allLiveAssetIds.forEach(function (id) { assets[id] = getAsset(id); });
    // append custom assets to their folder rows
    Object.keys(overrides.custom).forEach(function (id) {
      if (isRemoved(id)) return;
      (overrides.custom[id].folderIds || []).forEach(function (fid) {
        const f = folders.find(function (x) { return x.globalId === fid; });
        if (f && f.assetIds.indexOf(id) === -1) f.assetIds.push(id);
      });
    });
    const blob = new Blob(
      [JSON.stringify({ exported: new Date().toISOString(), folders: folders, assets: assets }, null, 2)],
      { type: "application/json" }
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "csd-catalog-export-" + new Date().toISOString().slice(0, 10) + ".json";
    a.click();
    URL.revokeObjectURL(a.href);
    toast("Catalog exported");
  }

  /* ---------------- shell wiring ---------------- */
  function setMain(html) {
    const main = document.getElementById("main");
    main.innerHTML = html;
    main.scrollTop = 0;
    window.scrollTo(0, 0);
    closeSidebar();
  }

  function render() {
    const r = route();
    if (r.view !== "search") activeCat = "all";
    if (r.view === "admin") renderAdmin();
    else if (r.view === "search") renderSearch(r.q);
    else renderFolder(r.id);
    if (r.view !== "search") {
      document.getElementById("searchInput").value = "";
      document.getElementById("searchClear").hidden = true;
    }
  }

  function openSidebar() {
    document.getElementById("sidebar").classList.add("open");
    document.getElementById("scrim").classList.add("show");
  }
  function closeSidebar() {
    document.getElementById("sidebar").classList.remove("open");
    document.getElementById("scrim").classList.remove("show");
  }

  function initTheme() {
    // Light theme by default; dark only when the user has chosen it.
    const dark = localStorage.getItem(LS_THEME) === "dark";
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  }

  function init() {
    initTheme();
    buildTree();
    rebuildIndexes();
    render();
    fetch("thumbs/manifest.json")
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (ids) {
        if (ids && ids.length) { THUMBS = new Set(ids); render(); }
      })
      .catch(function () {});

    window.addEventListener("hashchange", render);

    document.getElementById("menuBtn").addEventListener("click", function () {
      const sb = document.getElementById("sidebar");
      sb.classList.contains("open") ? closeSidebar() : openSidebar();
    });
    document.getElementById("scrim").addEventListener("click", closeSidebar);

    document.getElementById("themeBtn").addEventListener("click", function () {
      const cur = document.documentElement.getAttribute("data-theme");
      const next = cur === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem(LS_THEME, next);
    });

    // Search: live with debounce
    let t;
    const input = document.getElementById("searchInput");
    input.addEventListener("input", function () {
      clearTimeout(t);
      const q = input.value.trim();
      document.getElementById("searchClear").hidden = !q;
      t = setTimeout(function () {
        if (q) go("#/search/" + encodeURIComponent(q));
        else if (route().view === "search") go("#/");
      }, 250);
    });
    document.getElementById("searchClear").addEventListener("click", function () {
      input.value = "";
      go("#/");
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) {
        e.preventDefault();
        input.focus();
      }
    });

    // Delegated: tree navigation + toggles, chips, copy buttons
    document.getElementById("folderTree").addEventListener("click", function (e) {
      const tog = e.target.closest("[data-toggle]");
      if (tog && tog.closest(".tree-toggle") && !tog.classList.contains("leaf")) {
        const id = tog.getAttribute("data-toggle");
        openNodes.has(id) ? openNodes.delete(id) : openNodes.add(id);
        const r = route();
        renderTree(r.view === "folder" ? (nodeById.get(r.id) || root).id : null);
        e.stopPropagation();
        return;
      }
      const row = e.target.closest("[data-go]");
      if (row) go("#/f/" + encodeURIComponent(row.getAttribute("data-go")));
    });

    document.getElementById("main").addEventListener("click", function (e) {
      const chip = e.target.closest("[data-cat]");
      if (chip) {
        activeCat = chip.getAttribute("data-cat");
        const r = route();
        r.view === "search" ? renderSearch(r.q) : renderFolder(r.id);
        return;
      }
      const copy = e.target.closest("[data-copy]");
      if (copy) {
        const url = copy.getAttribute("data-copy");
        (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject())
          .then(function () { toast("Link copied to clipboard"); })
          .catch(function () {
            const ta = document.createElement("textarea");
            ta.value = url; document.body.appendChild(ta); ta.select();
            document.execCommand("copy"); ta.remove();
            toast("Link copied to clipboard");
          });
      }
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
