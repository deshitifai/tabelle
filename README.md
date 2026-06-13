# tabelle

> The URL is the interface. Every sort, every filter, every view of the table is an address you can share, bookmark, and query.

| Field | Value |
| --- | --- |
| Package | `tabelle` |
| Artifact | one ES module + one theme stylesheet (calendar/map companions live in-repo, not yet published) |
| Dependencies | none |
| Inspiration | [swiss.ziki.boo](https://swiss.ziki.boo) |
| In production | the table listings on lite.cat sites ([bayai.lite.cat](https://bayai.lite.cat), …) and mve.cat sites |
| Pairs with | [sapi](https://github.com/mrjf/sapi) — the page and the API share one query function |

---

## 01 — Install

```console
$ npm install github:mrjf/tabelle
```

Or copy the two files; they are the whole library.

```console
$ cp node_modules/tabelle/listtable.js .
$ cp node_modules/tabelle/themes/swiss.css .
```

---

## 02 — Use

One table element, one dataset, one query function, one column spec.

```html
<link rel="stylesheet" href="themes/swiss.css">
<h1>swiss graphic design</h1>
<table id="works"></table>
<script type="module">
  import { initListTable } from "./listtable.js";
  import query from "./query.js";

  initListTable({
    table: "#works",
    data,
    query,                       // query(data, params) -> rows
    rowHref: (r) => r.url,       // click a row, go to its source
    defaultSort: "designer",     // the order the data already arrives in
    columns: [
      { id: "designer", param: "designer", sortable: true, group: true,
        width: "30%", variants: ["strong"],
        key: (r) => r.designer, label: (r) => r.designer, value: (r) => r.designer },
      { id: "work", label: (r) => r.work, href: (r) => r.url, width: "40%" },
      { id: "year", param: "year", sortable: true, variants: ["mono"],
        key: (r) => r.year, label: (r) => String(r.year), value: (r) => String(r.year) },
      { id: "kind", param: "kind", group: true, variants: ["tag", "muted"],
        key: (r) => r.kind, label: (r) => r.kind, value: (r) => r.kind },
    ],
  });
</script>
```

All state lives in the URL. `?designer=Max+Bill&sort=-year` is a view; reload it, share it, point an agent at it.

---

## 03 — Column spec

| Key | Meaning |
| --- | --- |
| `id` | cell class name; also the sort key when `param` is absent |
| `name` | column name revealed on header hover (defaults to `id`) |
| `param` | URL parameter the column filters on (omit for display-only) |
| `sortable` | include in header sort cycling (uses `param` as the sort key) |
| `group` | collapse runs of equal values into one rowspan cell; its label sticks under the header |
| `width` | colgroup width, e.g. `"27%"` |
| `variants` | theme hook class suffixes, e.g. `["strong"]` → `.lt-strong` |
| `key(row)` | identity used for grouping and constant detection |
| `label(row)` | display text |
| `value(row)` | URL parameter value |
| `href(row)` | render the cell as a plain external link instead of a filter |
| `multi(row)` | per-row list of `{ label, value }` filter chips (e.g. showtimes) |

---

## 04 — Interaction model

| Gesture | Result |
| --- | --- |
| click a header | sort cycles: descending → ascending → unsorted; the `defaultSort` column just toggles |
| hover a header | the column's name appears (headers stay bare otherwise) |
| click a cell value | filter to that value; click it again to clear |
| hover a cell value | underline — the sign that a click here filters; rows the filter would remove fade back |
| click a filtered header | clear that filter (× appears on hover) |
| click anywhere else in a row | navigate to the row's source link |
| hover where a click would go external | the destination URL appears in a corner status chip |
| middle-click / modifier-click a row | open the source in a new tab |
| Escape | clear all filters and sorting |
| back / forward | walk your view history; state is the URL |

Constants are lifted: when every visible row shares a value, its column header carries it instead of repeating it down the page. Grouped values pin under the header while their rows scroll past, with a hairline marking the extent of the run.

The sort arrow always tells the truth: declare `defaultSort` (`"key"` or `"-key"`) when the dataset already arrives ordered, and that column shows a fainter arrow even before anyone clicks — the default order is real, it just isn't a URL state.

---

## 05 — Theme

`themes/swiss.css` is the complete look of a page: monochrome stone palette, IBM Plex, hairline rules, a sticky title and header stack, automatic dark mode. Structural rules the engine depends on live in the theme — a theme is not decoration over a default.

| Hook | Use |
| --- | --- |
| `--bg` `--fg` `--muted` `--line` | palette, light and dark |
| `--title-size` `--title-block` | sticky title geometry |
| `.lt-strong` | medium weight |
| `.lt-mono` | IBM Plex Mono, small |
| `.lt-muted` | secondary ink |
| `.lt-tag` | uppercase, letterspaced |
| `.lt-nowrap` | no wrapping |

---

## 06 — One query function, two consumers

`query(data, params)` is the only logic tabelle asks of you, and it is the same function a [sapi](https://github.com/mrjf/sapi) site serves to agents as `query.js`. The page filters with it in the browser; clients run it locally against `data.json`. One function, so the page and the API can never disagree.

Sort semantics live there too: a sort key need not be a raw field. The demo's `query.js` keeps a `SORT_KEYS` map of derived comparables — `sort=designer` orders by last name, because that is how people sort names — and the engine never knows; it only writes `?sort=` into the URL.

---

## 07 — Title-bar chrome

| Export | Renders |
| --- | --- |
| `initListTable(config)` | the table; returns `{ apply, rows }` |
| `initDownload({ container, filename, rows })` | a *download* dropdown: json / csv / xml of the current view |
| `initAbout({ container, html })` | an *about* dropdown in the title bar |
| `initSubscribe({ container, feeds })` | a *subscribe* dropdown: feed selector + google / apple / outlook / ics / rss links |

The download dropdown is on by default: `initListTable` adds it to the page's `<h1>` without being asked. Disable it with `download: false`, name the file with `downloadFilename`, or point `chromeContainer` at a different title element.

### Companions (not yet published)

`calendar.js` and `map.js` live in this repo but are **not part of the published `@mrjf/tabelle` package yet** — they'll ship in a later release. Until then, vendor a copy from this repo if you want them.

### Calendar companion

`tabelle/calendar.js` exports `initCalendar({ container, events, date, end, label })` — one bare-bones Sunday-first week grid covering the rows, showing only the weeks that contain events; there are no month headers (the first of a month is labeled `aug 1`), and multi-day events land on every day they cover. It holds no state: pair its returned `render()` with `initListTable`'s `onApply(rows)` hook and the calendar mirrors every filter and sort.

### Map companion

`tabelle/map.js` exports `initMap({ container, events, where, places, onHover })` — real outlines on the barest tiles: a Leaflet map over CARTO's *no-label* basemap (light/dark follows the color scheme; OpenStreetMap data, attribution kept — the tiles require it), carrying nothing except what the rows mention. Every place becomes a labeled dot (`places` is a `{ name: [lat, lon] }` legend); a row whose `where` is a trajectory (`"A → B"`, any number of stops) draws a hairline through its stops, and a single-place row draws a ring around its dot. The view refits to the filtered rows on every `render()`. Bring your own Leaflet (global `L`, or pass `leaflet:`) — tabelle itself stays dependency-free; override tiles with `tileUrl`/`tileAttribution`. Same contract as the calendar: `render()`, `highlight(row|null)`, `onHover`.

Hovering an entry in any companion spotlights it everywhere: cross-wire each side's `onHover` to the others' `highlight`.

```js
let calendar;
const table = initListTable({
  ...,
  onApply: () => calendar?.render(),
  onHover: (row) => calendar?.highlight(row),
});
calendar = initCalendar({
  container: "#calendar",
  events: () => table.rows(),
  date: (r) => r.start, end: (r) => r.end, label: (r) => r.title,
  onHover: (row) => table.highlight(row),
});
```

---

## 08 — Demo

[demo/index.html](demo/index.html) is one self-contained file — engine, theme, data, and query inlined. Open it straight from disk; no server, no build step, no network. Filtering and sorting work on `file://` (the URL just can't reflect state there).

```console
$ open demo/index.html
```

| Part | Role |
| --- | --- |
| `demo/data.json` | the dataset — the Swiss graphic design canon |
| `demo/query.js` | the query function, sapi-conformant |
| `demo/schema.json` | JSON Schema + `x-sapi` parameter docs |
| `demo/page.js` | column spec and page chrome |
| `demo/index.html` | the build product — do not edit by hand |

Edit the parts, then rebuild with `npm run build:demo` (or `npm run demo` to build and serve). Served over http, the demo directory is also a complete [sapi](https://github.com/mrjf/sapi) site: agents can query `data.json` with `query.js` instead of reading the page.

---

License: MIT
