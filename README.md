# tabelle

> The URL is the interface. Every sort, every filter, every view of the table is an address you can share, bookmark, and query.

| Field | Value |
| --- | --- |
| Package | `tabelle` |
| Artifact | one ES module + one theme stylesheet |
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
    externalHint: "work",        // column whose link underlines on hover
    columns: [
      { id: "designer", param: "designer", sortable: true, group: true,
        width: "30%", variants: ["strong"],
        key: (r) => r.designer, label: (r) => r.designer, value: (r) => r.designer },
      { id: "work", label: (r) => r.work, href: (r) => r.url, width: "40%" },
      { id: "year", param: "year", sortable: true, variants: ["mono"],
        key: (r) => r.year, label: (r) => String(r.year), value: (r) => String(r.year) },
      { id: "kind", param: "kind", variants: ["tag", "muted"],
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
| click a header | sort cycles: descending → ascending → unsorted |
| click a cell value | filter to that value; click it again to clear |
| click a filtered header | clear that filter (× appears on hover) |
| click anywhere else in a row | navigate to the row's source link |
| middle-click / modifier-click a row | open the source in a new tab |
| Escape | clear all filters and sorting |
| back / forward | walk your view history; state is the URL |

Constants are lifted: when every visible row shares a value, its column header carries it instead of repeating it down the page. Grouped values pin under the header while their rows scroll past, with a hairline marking the extent of the run.

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

---

## 07 — Title-bar chrome

| Export | Renders |
| --- | --- |
| `initListTable(config)` | the table; returns `{ apply }` for re-rendering |
| `initAbout({ container, html })` | an *about* dropdown in the title bar |
| `initSubscribe({ container, feeds })` | a *subscribe* dropdown: feed selector + google / apple / outlook / ics / rss links |

---

## 08 — Demo

```console
$ npm run demo
```

Serves [demo/](demo/) — the Swiss graphic design canon as a tabelle: group by designer, filter by kind, sort by year.

---

License: MIT
