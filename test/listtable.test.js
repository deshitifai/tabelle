// Behavior tests for initListTable under jsdom: rendering, URL-backed
// filtering and sort cycling, grouping, constant lifting, Escape.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import query from "../demo/query.js";
import data from "../demo/data.json" with { type: "json" };

let initListTable;
let dom;

function setDom(url = "https://tabelle.test/", markup = '<!doctype html><html><body><table id="t"></table></body></html>') {
  dom = new JSDOM(markup, { url });
  // listtable.js resolves these as bare globals at call time
  global.window = dom.window;
  global.document = dom.window.document;
  global.location = dom.window.location;
  global.history = dom.window.history;
  global.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
}

const COLUMNS = [
  {
    id: "designer", param: "designer", sortable: true, group: true, width: "28%",
    variants: ["strong"],
    key: (r) => r.designer, label: (r) => r.designer, value: (r) => r.designer,
  },
  { id: "work", width: "44%", label: (r) => r.work, href: (r) => r.url },
  {
    id: "year", param: "year", sortable: true, variants: ["mono"],
    key: (r) => r.year, label: (r) => String(r.year), value: (r) => String(r.year),
  },
  {
    id: "kind", param: "kind", group: true, variants: ["tag", "muted"],
    key: (r) => r.kind, label: (r) => r.kind, value: (r) => r.kind,
  },
];

function init(extra = {}) {
  return initListTable({
    table: dom.window.document.querySelector("#t"),
    data,
    query,
    rowHref: (r) => r.url,
    columns: COLUMNS,
    ...extra,
  });
}

function rows() {
  return [...dom.window.document.querySelectorAll("tbody tr")];
}

function click(el) {
  el.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true }));
}

beforeEach(async () => {
  setDom();
  ({ initListTable } = await import("../listtable.js"));
});

test("renders every row with a colgroup and a built header", () => {
  init();
  assert.equal(rows().length, data.works.length);
  assert.equal(dom.window.document.querySelectorAll("colgroup col").length, COLUMNS.length);
  assert.equal(dom.window.document.querySelectorAll("thead th").length, COLUMNS.length);
  assert.ok(dom.window.document.querySelector("th.designer.lt-strong.lt-group"));
});

test("groups consecutive equal values into rowspan cells", () => {
  init();
  const brockmann = [...dom.window.document.querySelectorAll("td.designer")]
    .find((td) => td.textContent.includes("Müller-Brockmann"));
  assert.equal(brockmann.rowSpan, 6, "six Müller-Brockmann works share one cell");
  // grouped column renders fewer cells than rows
  assert.ok(dom.window.document.querySelectorAll("td.designer").length < rows().length);
});

test("clicking a value filters, updates the URL, and clicking again clears", () => {
  init();
  const chip = [...dom.window.document.querySelectorAll('a[data-filter]')]
    .find((a) => a.dataset.filter === "kind=typeface");
  click(chip);
  assert.equal(rows().length, 7, "seven typefaces in the canon");
  assert.equal(dom.window.location.search, "?kind=typeface");
  const th = dom.window.document.querySelector('th[data-param="kind"]');
  assert.ok(th.classList.contains("filtered"));
  assert.equal(th.querySelector(".clear").hidden, false);

  const active = [...dom.window.document.querySelectorAll('a[data-filter]')]
    .find((a) => a.dataset.filter === "kind=typeface");
  click(active);
  assert.equal(rows().length, data.works.length);
  assert.equal(dom.window.location.search, "");
});

test("filtering a grouped column to one value lifts it into the header", () => {
  init();
  const chip = [...dom.window.document.querySelectorAll('a[data-filter]')]
    .find((a) => a.dataset.filter === "designer=Max Bill");
  click(chip);
  assert.equal(rows().length, 4);
  const th = dom.window.document.querySelector('th[data-param="designer"]');
  assert.ok(th.classList.contains("has-value"));
  assert.ok(th.classList.contains("filtered"));
});

test("every grouped column collapses runs, not just the first", () => {
  init();
  const runs = [...dom.window.document.querySelectorAll("td.kind[rowspan]")];
  assert.ok(runs.length >= 1, "kind has collapsed runs");
  const typefaces = runs.find((td) => td.textContent.includes("typeface"));
  assert.equal(typefaces.rowSpan, 5, "Eidenbenz's Clarendon and Frutiger's four faces share one kind cell");
  assert.ok(dom.window.document.querySelectorAll("td.kind").length < rows().length);
});

test("headers reveal the column name", () => {
  init();
  const names = [...dom.window.document.querySelectorAll("th .name")].map((s) => s.textContent);
  assert.deepEqual(names, ["designer", "work", "year", "kind"]);
});

test("sorting designers uses the query's derived key: last name", () => {
  init();
  const th = dom.window.document.querySelector('th[data-sort="designer"]');
  click(th); // descending
  assert.equal(rows()[0].querySelector("td.designer").textContent.trim(), "Wolfgang Weingart");
  click(th); // ascending
  assert.equal(
    rows()[0].querySelector("td.designer").textContent.trim(),
    "Théo Ballmer",
    "ascending by LAST name puts Ballmer first, not Adrian Frutiger",
  );
});

test("header clicks cycle sort desc -> asc -> unsorted", () => {
  init();
  const th = dom.window.document.querySelector('th[data-sort="year"]');
  click(th);
  assert.equal(dom.window.location.search, "?sort=-year");
  assert.equal(rows()[0].querySelector("td.year").textContent.trim(), "1988");
  click(th);
  assert.equal(dom.window.location.search, "?sort=year");
  assert.equal(rows()[0].querySelector("td.year").textContent.trim(), "1926");
  click(th);
  assert.equal(dom.window.location.search, "");
});

test("defaultSort shows an implied arrow without touching the URL", () => {
  init({ defaultSort: "designer" });
  const arrow = dom.window.document.querySelector('th[data-sort="designer"] .arrow');
  assert.equal(arrow.textContent, "↑");
  assert.ok(arrow.classList.contains("implied"));
  assert.equal(dom.window.location.search, "", "the default order is not a URL state");
});

test("the default-sort column toggles direction instead of cycling to unsorted", () => {
  init({ defaultSort: "designer" });
  const th = dom.window.document.querySelector('th[data-sort="designer"]');
  const arrow = th.querySelector(".arrow");
  click(th);
  assert.equal(dom.window.location.search, "?sort=-designer");
  assert.equal(arrow.textContent, "↓");
  assert.ok(!arrow.classList.contains("implied"));
  click(th);
  assert.equal(dom.window.location.search, "", "ascending is the default order — param removed");
  assert.equal(arrow.textContent, "↑");
  assert.ok(arrow.classList.contains("implied"));
});

test("an explicit sort elsewhere overrides the implied arrow, and clearing restores it", () => {
  init({ defaultSort: "designer" });
  const designerArrow = dom.window.document.querySelector('th[data-sort="designer"] .arrow');
  const yearTh = dom.window.document.querySelector('th[data-sort="year"]');
  click(yearTh);
  assert.equal(dom.window.location.search, "?sort=-year");
  assert.equal(designerArrow.textContent, "");
  assert.equal(yearTh.querySelector(".arrow").textContent, "↓");
  assert.ok(!yearTh.querySelector(".arrow").classList.contains("implied"));
  click(yearTh); // asc
  click(yearTh); // unsorted -> back to the implied default
  assert.equal(dom.window.location.search, "");
  assert.equal(designerArrow.textContent, "↑");
  assert.ok(designerArrow.classList.contains("implied"));
});

test("initial state comes from the page URL", async () => {
  setDom("https://tabelle.test/?designer=Adrian+Frutiger");
  ({ initListTable } = await import("../listtable.js"));
  init();
  assert.equal(rows().length, 4);
  assert.ok(
    rows().every((tr) => tr.dataset.href.includes("wikipedia")),
  );
});

test("escape clears all filters and sorting", () => {
  init();
  const chip = [...dom.window.document.querySelectorAll('a[data-filter]')]
    .find((a) => a.dataset.filter === "kind=poster");
  click(chip);
  assert.notEqual(rows().length, data.works.length);
  dom.window.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  assert.equal(rows().length, data.works.length);
  assert.equal(dom.window.location.search, "");
});

function hover(target, el) {
  // jsdom has no layout, so hit-testing is stubbed; the engine only asks
  // elementFromPoint what sits under the pointer
  dom.window.document.elementFromPoint = () => el;
  target.dispatchEvent(
    new dom.window.MouseEvent("mousemove", { bubbles: true, clientX: 10, clientY: 10 }),
  );
}

function hoverChip(chip, type = "mouseover") {
  chip.dispatchEvent(new dom.window.MouseEvent(type, { bubbles: true }));
}

test("hovering a filter value fades the rows it would remove", () => {
  init();
  const chip = [...dom.window.document.querySelectorAll("a[data-filter]")]
    .find((a) => a.dataset.filter === "kind=typeface");
  hoverChip(chip);
  const dimmed = rows().filter((tr) => tr.classList.contains("lt-dim"));
  assert.equal(dimmed.length, data.works.length - 7, "every non-typeface row fades");
  assert.ok(!chip.closest("tr").classList.contains("lt-dim"), "the hovered row survives");

  const groupTd = (name) => [...dom.window.document.querySelectorAll("td.designer[rowspan]")]
    .find((td) => td.textContent.includes(name));
  assert.ok(!groupTd("Frutiger").classList.contains("lt-dim"), "all-typeface group stays");
  assert.ok(groupTd("Müller-Brockmann").classList.contains("lt-dim"), "no-typeface group fades");

  hoverChip(chip, "mouseout");
  assert.equal(rows().filter((tr) => tr.classList.contains("lt-dim")).length, 0);
});

test("a group cell stays lit while any row in its span survives the preview", () => {
  init();
  const chip = [...dom.window.document.querySelectorAll("a[data-filter]")]
    .find((a) => a.dataset.filter === "kind=book");
  hoverChip(chip);
  const hofmann = [...dom.window.document.querySelectorAll("td.designer[rowspan]")]
    .find((td) => td.textContent.includes("Hofmann"));
  // Hofmann's head row (a poster) fades, but his book keeps the group label lit
  assert.ok(hofmann.closest("tr").classList.contains("lt-dim"));
  assert.ok(!hofmann.classList.contains("lt-dim"));
});

test("hovering an active filter previews nothing — clicking it would clear, not narrow", () => {
  init();
  click([...dom.window.document.querySelectorAll("a[data-filter]")]
    .find((a) => a.dataset.filter === "kind=typeface"));
  const active = [...dom.window.document.querySelectorAll("a[data-filter]")]
    .find((a) => a.dataset.filter === "kind=typeface");
  hoverChip(active);
  assert.equal(dom.window.document.querySelectorAll(".lt-dim").length, 0);
});

test("hovering a row marks it and reports it via onHover", () => {
  const seen = [];
  const t = init({ onHover: (row) => seen.push(row) });
  const tr = rows()[3];
  tr.querySelector("td").dispatchEvent(new dom.window.MouseEvent("mouseover", { bubbles: true }));
  assert.ok(tr.classList.contains("lt-mark"), "the hovered row is marked");
  assert.equal(rows().filter((r) => r.classList.contains("lt-dim")).length, 0);
  assert.equal(seen.at(-1), t.rows()[3], "onHover reports the hovered row");

  dom.window.document.querySelector("tbody").dispatchEvent(
    new dom.window.MouseEvent("mouseout", { bubbles: true }),
  );
  assert.equal(dom.window.document.querySelectorAll(".lt-mark").length, 0, "leaving clears");
  assert.equal(seen.at(-1), null);
});

test("highlight(row) drives the same row mark from outside", () => {
  const t = init();
  t.highlight(t.rows()[0]);
  assert.equal(rows().filter((r) => r.classList.contains("lt-dim")).length, 0);
  assert.ok(rows()[0].classList.contains("lt-mark"));
  t.highlight(null);
  assert.equal(dom.window.document.querySelectorAll(".lt-mark").length, 0);
});

test("hovering an external link shows its url in the status chip", () => {
  init();
  const status = dom.window.document.querySelector(".lt-status");
  assert.ok(status, "status chip element exists");
  assert.equal(status.hidden, true, "hidden until an external hover");
  const work = rows()[0].querySelector("td.work a");
  hover(work, work);
  assert.equal(status.hidden, false);
  assert.ok(status.textContent.startsWith("https://en.wikipedia.org/"));
});

test("hovering a filter link keeps the status chip hidden", () => {
  init();
  const status = dom.window.document.querySelector(".lt-status");
  const chip = dom.window.document.querySelector("a[data-filter]");
  hover(chip, chip);
  assert.equal(status.hidden, true, "filter affordance is the underline, not the chip");
});

test("leaving the table hides the status chip", () => {
  init();
  const status = dom.window.document.querySelector(".lt-status");
  const work = rows()[0].querySelector("td.work a");
  hover(work, work);
  assert.equal(status.hidden, false);
  dom.window.document.querySelector("tbody").dispatchEvent(
    new dom.window.MouseEvent("mouseleave"),
  );
  assert.equal(status.hidden, true);
});

test("display-only href columns render plain external links", () => {
  init();
  const work = rows()[0].querySelector("td.work a");
  assert.ok(work.href.startsWith("https://en.wikipedia.org/"));
  assert.equal(work.dataset.filter, undefined);
});

test("non-filter row areas open the row target link", () => {
  const opened = [];
  dom.window.open = (url, target) => opened.push({ url, target });
  initListTable({
    table: dom.window.document.querySelector("#t"),
    data: { works: [{ title: "Launch", kind: "talk", url: "https://example.test/launch" }] },
    query: (d) => d.works,
    rowHref: (r) => r.url,
    columns: [
      { id: "title", label: (r) => r.title },
      { id: "kind", param: "kind", label: (r) => r.kind, value: (r) => r.kind },
    ],
  });

  rows()[0].querySelector("td.title").dispatchEvent(
    new dom.window.MouseEvent("click", { bubbles: true, cancelable: true, metaKey: true }),
  );
  assert.deepEqual(opened, [{ url: "https://example.test/launch", target: "_blank" }]);

  rows()[0].querySelector("td.kind a[data-filter]").dispatchEvent(
    new dom.window.MouseEvent("click", { bubbles: true, cancelable: true }),
  );
  assert.equal(dom.window.location.search, "?kind=talk");
  assert.deepEqual(opened, [{ url: "https://example.test/launch", target: "_blank" }]);
});

test("a grouped year column collapses runs under sort and filter (vertical ditto)", () => {
  setDom("https://tabelle.test/?sort=-year&year=1981");
  const yearGrouped = COLUMNS.map((c) => (c.id === "year" ? { ...c, group: true } : c));
  init({ columns: yearGrouped });
  const yearCells = [...dom.window.document.querySelectorAll("tbody td.year")];
  // every visible row shares year=1981 -> exactly one rowspan ditto cell
  assert.equal(yearCells.length, 1);
  assert.ok(yearCells[0].rowSpan >= rows().length);
  assert.ok(yearCells[0].className.includes("lt-group"));
});

test("missing values render as empty cells, never the string 'undefined'", () => {
  initListTable({
    table: dom.window.document.querySelector("#t"),
    data: { works: [{ designer: "Max Bill" }] },
    query: (d) => d.works,
    columns: [
      { id: "designer", label: (r) => r.designer },
      { id: "work", label: (r) => r.work, href: (r) => r.url ?? "https://example.test/" },
      { id: "year", param: "year", key: (r) => r.year, label: (r) => r.year, value: (r) => "1950" },
      { id: "kind", multi: () => [{ label: undefined, value: undefined }], param: "kind" },
    ],
  });
  const text = dom.window.document.querySelector("tbody").textContent;
  assert.ok(!text.includes("undefined"), `no cell says undefined: ${JSON.stringify(text)}`);
});

const TITLED_PAGE = '<!doctype html><html><body><h1>works</h1><table id="t"></table></body></html>';

test("download chrome lands in the page title by default", async () => {
  setDom(undefined, TITLED_PAGE);
  ({ initListTable } = await import("../listtable.js"));
  init();
  assert.ok(dom.window.document.querySelector("h1 .lt-download"), "download dropdown is on by default");
});

test("download: false disables the default download chrome", async () => {
  setDom(undefined, TITLED_PAGE);
  ({ initListTable } = await import("../listtable.js"));
  init({ download: false });
  assert.equal(dom.window.document.querySelector(".lt-download"), null);
});

test("pages without a title get no download chrome and no crash", () => {
  init(); // default DOM has no h1
  assert.equal(dom.window.document.querySelector(".lt-download"), null);
});

test("rows() returns the currently filtered view for download serializers", () => {
  setDom("https://tabelle.test/?year=1981");
  const table = init();
  const current = table.rows();
  assert.ok(current.length > 0);
  assert.ok(current.every((r) => String(r.year) === "1981"));
  assert.equal(current.length, rows().length);
});
