// listtable — a single-page, URL-addressable list table.
//
// Renders any dataset as one flat table with: three-state sortable headers
// (desc -> asc -> unsorted), cell-click filtering with per-column clear,
// values constant across the result set lifted into the header (explicit
// filters at full strength, incidental constants fainter), runs of equal
// values collapsed into rowspan cells whose labels stick under the header,
// and row-level navigation to an external source with a hover hint.
//
// All state lives in the URL, and filtering/sorting goes through the caller's
// query(data, params) function — the same one served to sapi clients — so the
// page and the API can never disagree. Pair with a theme stylesheet (e.g.
// themes/swiss.css).
//
// Column spec:
//   id        - cell class name (also the sort key when sortable)
//   param     - URL parameter for filtering (omit for display-only)
//   sortable  - include in sort cycling (uses `param` as the sort key)
//   group     - collapse consecutive equal values into one rowspan cell
//   width     - colgroup width, e.g. "27%"
//   variants  - theme hook class suffixes, e.g. ["strong"] -> .lt-strong
//   key(row)   - identity used for grouping / constant detection
//   label(row) - display text
//   value(row) - URL parameter value
//   href(row)  - render the cell as a plain external link instead of a
//                filter (for values that are unique per row)
//   multi(row) - instead of key/label/value: per-row list of
//                { label, value } filter chips (e.g. showtimes)

export function initListTable(config) {
  const { data, query, columns, rowKey, rowHref, externalHint } = config;
  const table = typeof config.table === "string" ? document.querySelector(config.table) : config.table;
  table.classList.add("lt");
  if (rowHref) table.classList.add("lt-rowlink");

  if (!table.querySelector("colgroup")) {
    const colgroup = document.createElement("colgroup");
    for (const col of columns) {
      const colEl = document.createElement("col");
      if (col.width) colEl.style.width = col.width;
      colgroup.appendChild(colEl);
    }
    table.prepend(colgroup);
  }

  let thead = table.querySelector("thead");
  if (!thead) {
    thead = document.createElement("thead");
    table.insertBefore(thead, table.querySelector("tbody"));
  }
  thead.textContent = "";
  const headRow = document.createElement("tr");
  for (const col of columns) {
    const th = document.createElement("th");
    th.className = variantClasses(col);
    if (col.sortable) th.dataset.sort = col.param || col.id;
    if (col.param) th.dataset.param = col.param;
    if (col.sortable) {
      const sortLink = document.createElement("a");
      sortLink.href = `?sort=-${col.param}`;
      sortLink.appendChild(spanned("arrow"));
      th.appendChild(sortLink);
    }
    if (col.param) {
      const clear = document.createElement("a");
      clear.className = "clear";
      clear.hidden = true;
      clear.textContent = "×";
      clear.setAttribute("aria-label", `clear ${col.id} filter`);
      th.appendChild(clear);
    }
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);

  const tbody = table.querySelector("tbody") || table.appendChild(document.createElement("tbody"));
  const groupCols = columns.filter((c) => c.group);
  let renderedRows = [];

  function spanned(cls) {
    const span = document.createElement("span");
    span.className = cls;
    return span;
  }

  function variantClasses(col) {
    const classes = [col.id, ...(col.variants || []).map((v) => `lt-${v}`)];
    if (col.group) classes.push("lt-group");
    return classes.join(" ");
  }

  // Param state is held in memory and mirrored to the URL when the browser
  // allows it (file:// documents reject replaceState) — filtering must never
  // depend on the URL actually having changed.
  let params = new URLSearchParams(location.search);

  function currentParams() {
    return Object.fromEntries(params);
  }

  function setParams(mutate) {
    mutate(params);
    const qs = params.toString();
    try {
      history.replaceState(null, "", qs ? `?${qs}` : location.pathname);
    } catch (error) {
      // URL stops reflecting state on file://; in-memory state still applies.
    }
    apply();
  }

  function filterLink(param, value, label) {
    const a = document.createElement("a");
    a.dataset.filter = `${param}=${value}`;
    a.href = `?${param}=${encodeURIComponent(value)}`;
    a.textContent = label;
    return a;
  }

  function apply() {
    const params = currentParams();
    const rows = query(data, params);

    const constant = {};
    for (const col of groupCols) {
      constant[col.id] =
        rows.length && rows.every((r) => col.key(r) === col.key(rows[0])) ? col.key(rows[0]) : null;
    }

    tbody.textContent = "";
    renderedRows = [];
    groupSpans = [];
    let hintTd = null;
    rows.forEach((row, i) => {
      const tr = document.createElement("tr");
      const href = rowHref ? rowHref(row) : null;
      if (href) tr.dataset.href = href;
      for (const col of columns) {
        if (col.multi) {
          const td = document.createElement("td");
          td.className = variantClasses(col);
          col.multi(row).forEach((item, j) => {
            if (j) td.appendChild(document.createTextNode(", "));
            if (col.param && item.value) {
              const chip = filterLink(col.param, item.value, item.label);
              if (params[col.param] === item.value) chip.classList.add("lt-active-filter");
              td.appendChild(chip);
            } else {
              td.appendChild(document.createTextNode(item.label));
            }
          });
          tr.appendChild(td);
          continue;
        }
        if (col.group && i > 0 && col.key(row) === col.key(rows[i - 1])) continue;
        let span = 1;
        if (col.group) {
          while (i + span < rows.length && col.key(rows[i + span]) === col.key(row)) span += 1;
        }
        const td = document.createElement("td");
        td.className = variantClasses(col);
        if (span > 1) {
          td.rowSpan = span;
          groupSpans.push({ td, lastIndex: i + span - 1 });
        }
        let content;
        const externalUrl = col.href ? col.href(row) : null;
        const cellValue = !col.href && col.param ? col.value(row) : null;
        if (externalUrl) {
          content = document.createElement("a");
          content.href = externalUrl;
          content.textContent = col.label(row);
        } else if (cellValue) {
          content = filterLink(col.param, cellValue, col.label(row));
        } else {
          content = document.createTextNode(col.label(row));
        }
        if (cellValue && col.group && params[col.param]) {
          content.classList.add("lt-active-filter");
          const pin = document.createElement("span");
          pin.className = "lt-pin";
          pin.appendChild(content);
          const clear = document.createElement("a");
          clear.className = "clear";
          clear.dataset.clear = col.param;
          clear.textContent = "×";
          clear.setAttribute("aria-label", `clear ${col.id} filter`);
          pin.appendChild(clear);
          td.appendChild(pin);
        } else {
          td.appendChild(content);
        }
        tr.appendChild(td);
        if (col.id === externalHint) hintTd = td;
      }
      tr._hintTd = hintTd;
      tbody.appendChild(tr);
      renderedRows.push(tr);
    });

    for (const col of columns) {
      if (!col.param) continue;
      const th = thead.querySelector(`th[data-param="${col.param}"]`);
      th.classList.toggle("has-value", Boolean(col.group && constant[col.id] !== null && rows.length));
      th.classList.toggle("filtered", !!params[th.dataset.param]);
      th.querySelector(".clear").hidden = !params[th.dataset.param];
    }

    const sort = params.sort || "";
    const sortKey = sort.replace(/^-/, "");
    for (const th of thead.querySelectorAll("th[data-sort]")) {
      const active = th.dataset.sort === sortKey;
      th.classList.toggle("sorted", active);
      th.querySelector(".arrow").textContent =
        th.classList.contains("has-value") ? "" : !active ? "" : sort.startsWith("-") ? "↓" : "↑";
    }

    adjustStickyRanges();
    updateExternalTarget();
  }

  // A pinned group label must never sit lower than the top of the last row it
  // applies to: shrinking its sticky travel by (last row height - label height)
  // makes it ride the last row's top edge out instead of lingering to the
  // cell's bottom.
  let groupSpans = [];

  // Batch all layout reads before any style writes: interleaving them forces
  // a full table relayout per group and freezes the page on large datasets.
  function adjustStickyRanges() {
    const measured = [];
    for (const { td, lastIndex } of groupSpans) {
      const label = td.firstElementChild;
      const lastRow = renderedRows[lastIndex];
      if (!label || !lastRow) continue;
      const style = getComputedStyle(td);
      measured.push({
        td,
        label,
        labelHeight: label.getBoundingClientRect().height,
        lastHeight: lastRow.getBoundingClientRect().height,
        padTop: parseFloat(style.paddingTop),
        padBottom: parseFloat(style.paddingBottom),
      });
    }
    for (const m of measured) {
      const slack = m.lastHeight - m.labelHeight - m.padTop - m.padBottom;
      m.label.style.marginBottom = `${Math.max(0, slack)}px`;
    }
  }


  window.addEventListener("resize", adjustStickyRanges);

  function modifiedClick(event) {
    return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
  }

  // Header click cycles: sort desc -> sort asc -> unsorted (never on constant columns).
  for (const th of thead.querySelectorAll("th[data-sort]")) {
    th.addEventListener("click", (event) => {
      if (modifiedClick(event) && event.target.closest("a[href]")) return;
      event.preventDefault();
      if (event.target.closest(".clear") || th.classList.contains("has-value")) return;
      setParams((next) => {
        const current = next.get("sort") || "";
        const key = th.dataset.sort;
        if (current === `-${key}`) next.set("sort", key);
        else if (current === key) next.delete("sort");
        else next.set("sort", `-${key}`);
      });
    });
  }

  // Clicking anywhere in a filtered header cell clears that filter.
  for (const th of thead.querySelectorAll("th[data-param]")) {
    th.addEventListener("click", (event) => {
      if (!th.classList.contains("filtered")) return;
      event.preventDefault();
      setParams((next) => next.delete(th.dataset.param));
    });
  }

  // The row under the cursor, by geometry. closest("tr") is wrong inside a
  // tall rowspan cell — it resolves to the group head, not the visual row.
  function rowAtY(y) {
    let lo = 0;
    let hi = renderedRows.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const rect = renderedRows[mid].getBoundingClientRect();
      if (y < rect.top) hi = mid - 1;
      else if (y >= rect.bottom) lo = mid + 1;
      else return renderedRows[mid];
    }
    return null;
  }

  // Cells with values filter (clicking the active value clears it); clicking
  // anywhere else in a row goes to the row's source link.
  tbody.addEventListener("click", (event) => {
    const bodyClear = event.target.closest("a[data-clear]");
    if (bodyClear) {
      event.preventDefault();
      setParams((next) => next.delete(bodyClear.dataset.clear));
      return;
    }
    const link = event.target.closest("a[data-filter]");
    if (link) {
      if (modifiedClick(event)) return; // let the browser open the href in a new tab
      event.preventDefault();
      const [key, value] = link.dataset.filter.split(/=(.*)/);
      setParams((next) => {
        if (next.get(key) === value) next.delete(key);
        else next.set(key, value);
      });
      return;
    }
    if (event.target.closest("a[href]")) return; // plain links navigate natively
    const tr = rowAtY(event.clientY) || event.target.closest("tr");
    if (!tr || !tr.dataset.href) return;
    if (modifiedClick(event)) window.open(tr.dataset.href, "_blank");
    else location.assign(tr.dataset.href);
  });

  // middle-click on a row background opens the source in a new tab
  tbody.addEventListener("auxclick", (event) => {
    if (event.button !== 1 || event.target.closest("a")) return;
    const tr = rowAtY(event.clientY) || event.target.closest("tr");
    if (tr && tr.dataset.href) window.open(tr.dataset.href, "_blank");
  });

  // Underline the external destination hint for the row under the cursor,
  // tracking both pointer movement and scroll beneath a stationary pointer.
  let externalTarget = null;
  let pointerX = -1;
  let pointerY = -1;

  function updateExternalTarget() {
    let link = null;
    if (pointerY >= 0) {
      const el = document.elementFromPoint(pointerX, pointerY);
      if (el && tbody.contains(el) && !el.closest("a[data-filter]")) {
        const tr = rowAtY(pointerY);
        if (tr && tr.dataset.href && tr._hintTd) link = tr._hintTd.querySelector("a");
      }
    }
    if (externalTarget && externalTarget !== link) externalTarget.classList.remove("ext");
    externalTarget = link || null;
    if (link) link.classList.add("ext");
  }

  tbody.addEventListener("mousemove", (event) => {
    pointerX = event.clientX;
    pointerY = event.clientY;
    updateExternalTarget();
  });
  tbody.addEventListener("mouseleave", () => {
    pointerX = -1;
    pointerY = -1;
    updateExternalTarget();
  });
  // Escape clears all filters and sorting.
  window.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    setParams((next) => {
      for (const key of [...next.keys()]) next.delete(key);
    });
  });
  // Keep scroll handling near-zero-cost: forced layout here lags the sticky
  // header on the main thread. The hover hint can update after scroll settles.
  let scrollSettle = 0;
  window.addEventListener(
    "scroll",
    () => {
      clearTimeout(scrollSettle);
      scrollSettle = setTimeout(updateExternalTarget, 80);
    },
    { passive: true }
  );
  window.addEventListener("popstate", () => {
    params = new URLSearchParams(location.search);
    apply();
  });

  apply();
  return { apply };
}

// Title-bar chrome: about/subscribe dropdowns share a right-aligned group.
function ensureChrome(container) {
  let chrome = container.querySelector(":scope > .lt-chrome");
  if (!chrome) {
    chrome = document.createElement("div");
    chrome.className = "lt-chrome";
    container.appendChild(chrome);
  }
  return chrome;
}

function chromeDropdown(container, className, label) {
  const details = document.createElement("details");
  details.className = className;
  const summary = document.createElement("summary");
  summary.textContent = label;
  details.appendChild(summary);
  const panel = document.createElement("div");
  panel.className = `${className}-panel lt-panel`;
  details.appendChild(panel);
  ensureChrome(
    typeof container === "string" ? document.querySelector(container) : container
  ).appendChild(details);
  document.addEventListener("click", (event) => {
    if (details.open && !details.contains(event.target)) details.open = false;
  });
  return { details, panel };
}

// About dialog: free-form HTML provided by the page.
export function initAbout(config) {
  const { details, panel } = chromeDropdown(config.container, "lt-about", config.label || "about");
  panel.innerHTML = config.html;
  return details;
}

// Subscribe dialog: a feed selector and one row of links. Each feed:
// { label, feedUrl?, rssUrl?, webcalUrl?, googleUrl?, outlookUrl? }
export function initSubscribe(config) {
  const feeds = config.feeds || [];
  if (!feeds.length) return null;
  const { details, panel } = chromeDropdown(config.container, "lt-subscribe", config.label || "subscribe");
  const row = document.createElement("div");
  row.className = "lt-subscribe-row";

  let current = feeds[0];
  if (feeds.length > 1) {
    const select = document.createElement("select");
    feeds.forEach((feed, i) => {
      const option = document.createElement("option");
      option.value = String(i);
      option.textContent = feed.label;
      select.appendChild(option);
    });
    select.addEventListener("change", () => {
      current = feeds[Number(select.value)];
      sync();
    });
    row.appendChild(select);
  }

  const links = {};
  for (const [key, text] of [
    ["googleUrl", "google"],
    ["webcalUrl", "apple"],
    ["outlookUrl", "outlook"],
    ["feedUrl", "ics"],
    ["rssUrl", "rss"],
  ]) {
    const a = document.createElement("a");
    a.textContent = text;
    links[key] = a;
    row.appendChild(a);
  }

  function sync() {
    for (const [key, a] of Object.entries(links)) {
      a.hidden = !current[key];
      if (current[key]) a.href = current[key];
    }
  }
  sync();

  panel.appendChild(row);
  return details;
}
