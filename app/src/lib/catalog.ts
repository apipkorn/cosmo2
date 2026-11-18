// Catalog types and the pure functions that work on them (no React, no I/O).

export type Kind = 'pdf' | 'video' | 'image' | 'doc' | 'file' | 'link';

export type Asset = {
  id: string;
  title: string;
  kind: Kind;
  url: string;
  /** e.g. "Product Bulletin". Shown as the badge; falls back to the kind. */
  docType?: string;
  description?: string;
  lit?: string;
  created?: string;
  size?: number;
  thumb?: string;
};

export type Folder = {
  id: string;
  name: string;
  parent: string | null;
  description: string;
  assetIds: string[];
};

export type Catalog = { version: string; folders: Folder[]; assets: Asset[] };

/** The catalog plus lookup tables, built once per catalog version. */
export type Index = {
  version: string;
  assets: Map<string, Asset>;
  folders: Map<string, Folder>;
  roots: Folder[];
  children: Map<string, Folder[]>;
  /** Assets in a folder and everything beneath it. */
  totals: Map<string, number>;
  /** Folders each asset sits in. */
  placements: Map<string, Folder[]>;
  searchable: { asset: Asset; title: string; rest: string }[];
};

export const KIND_LABEL: Record<Kind, string> = {
  pdf: 'PDF',
  video: 'Video',
  image: 'Image',
  doc: 'Document',
  file: 'File',
  link: 'Link',
};

/** True if `data` has the shape the app needs. Guards against a bad download. */
export function isCatalog(data: unknown): data is Catalog {
  const c = data as Catalog;
  return (
    !!c &&
    typeof c.version === 'string' &&
    Array.isArray(c.folders) &&
    Array.isArray(c.assets) &&
    c.assets.every((a) => a && typeof a.id === 'string' && typeof a.url === 'string') &&
    c.folders.every((f) => f && typeof f.id === 'string' && Array.isArray(f.assetIds))
  );
}

export function buildIndex(catalog: Catalog): Index {
  const assets = new Map(catalog.assets.map((a) => [a.id, a]));
  const folders = new Map(catalog.folders.map((f) => [f.id, f]));
  const roots: Folder[] = [];
  const children = new Map<string, Folder[]>();
  const placements = new Map<string, Folder[]>();

  for (const f of catalog.folders) {
    if (f.parent && folders.has(f.parent)) {
      children.set(f.parent, [...(children.get(f.parent) ?? []), f]);
    } else {
      roots.push(f);
    }
    for (const id of f.assetIds) {
      placements.set(id, [...(placements.get(id) ?? []), f]);
    }
  }

  const totals = new Map<string, number>();
  const collect = (f: Folder): Set<string> => {
    const ids = new Set(f.assetIds.filter((id) => assets.has(id)));
    for (const child of children.get(f.id) ?? []) {
      for (const id of collect(child)) ids.add(id);
    }
    totals.set(f.id, ids.size);
    return ids;
  };
  roots.forEach(collect);

  // Folders with nothing in or under them (e.g. all their assets are hidden)
  // are not shown.
  const hasContent = (f: Folder) => (totals.get(f.id) ?? 0) > 0;
  const shownRoots = roots.filter(hasContent);
  for (const [id, list] of children) children.set(id, list.filter(hasContent));

  const searchable = catalog.assets.map((asset) => ({
    asset,
    title: asset.title.toLowerCase(),
    rest: [asset.description, asset.lit, asset.id].filter(Boolean).join(' ').toLowerCase(),
  }));

  return { version: catalog.version, assets, folders, roots: shownRoots, children, totals, placements, searchable };
}

/**
 * Every word typed must appear somewhere in the asset. Assets whose title
 * contains all the words come first.
 */
export function search(index: Index, query: string): Asset[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const inTitle: Asset[] = [];
  const elsewhere: Asset[] = [];
  for (const s of index.searchable) {
    if (words.every((w) => s.title.includes(w))) inTitle.push(s.asset);
    else if (words.every((w) => s.title.includes(w) || s.rest.includes(w))) elsewhere.push(s.asset);
  }
  return [...inTitle, ...elsewhere];
}

/** Folder names from the top level down to `folderId`. */
export function folderPath(index: Index, folderId: string): Folder[] {
  const path: Folder[] = [];
  let current = index.folders.get(folderId);
  while (current) {
    path.unshift(current);
    current = current.parent ? index.folders.get(current.parent) : undefined;
  }
  return path;
}

export function formatSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// The library page: parts (top-level folders) > categories (the folders below
// them) > groups (deeper folders, labelled with their path).

export type Sort = 'new' | 'az';
export type Group = { label: string; assets: Asset[] };
export type Category = { id: string; name: string; count: number; groups: Group[] };
export type Part = { name: string; categories: Category[] };

function sortAssets(list: Asset[], sort: Sort): Asset[] {
  return [...list].sort((a, b) =>
    sort === 'az'
      ? a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' })
      : (b.created ?? '').localeCompare(a.created ?? ''),
  );
}

export function buildLibrary(index: Index, keep: (a: Asset) => boolean, sort: Sort): Part[] {
  const direct = (f: Folder) =>
    sortAssets(
      f.assetIds.map((id) => index.assets.get(id)).filter((a): a is Asset => !!a && keep(a)),
      sort,
    );

  const category = (top: Folder): Category => {
    const groups: Group[] = [];
    const walk = (f: Folder, trail: string[]) => {
      const assets = direct(f);
      if (assets.length) groups.push({ label: trail.join(' › '), assets });
      for (const child of index.children.get(f.id) ?? []) walk(child, [...trail, child.name]);
    };
    walk(top, []);
    const count = groups.reduce((n, g) => n + g.assets.length, 0);
    return { id: top.id, name: top.name, count, groups };
  };

  const parts: Part[] = [];
  for (const root of index.roots) {
    const own = direct(root);
    const categories: Category[] = [];
    if (own.length) categories.push({ id: root.id, name: root.name, count: own.length, groups: [{ label: '', assets: own }] });
    for (const child of index.children.get(root.id) ?? []) categories.push(category(child));
    const shown = categories.filter((c) => c.count > 0);
    if (shown.length) parts.push({ name: root.name, categories: shown });
  }
  return parts;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2025-12-08" -> "Dec 2025"; "n.d." when missing. */
export function dateLabel(created?: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(created ?? '');
  if (!m) return 'n.d.';
  return `${MONTHS[Number(m[2]) - 1] ?? ''} ${m[1]}`.trim();
}

/** Added within the last year (shown in red). */
export function isRecent(created: string | undefined, now = new Date()): boolean {
  if (!created) return false;
  const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return created >= yearAgo;
}

/** Badge text and style: instruction bulletins red, warranties outlined, others black. */
export function badge(asset: Asset): { text: string; style: 'red' | 'outline' | 'black' } {
  const text = asset.docType || KIND_LABEL[asset.kind];
  const low = text.toLowerCase();
  return { text, style: low.includes('instruction') ? 'red' : low.includes('warranty') ? 'outline' : 'black' };
}
