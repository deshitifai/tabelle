// Behavior tests for initListTable under jsdom: rendering, URL-backed
// filtering and sort cycling, grouping, constant lifting, Escape.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import query from "../demo/query.js";
import data from "../demo/data.js";

let initListTable;
let dom;

function setDom(url = "https://tabelle.test/") {
  dom = new JSDOM('<!doctype html><html><body><table id="t"></table></body></html>', { url });
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
    id: "kind", param: "kind", variants: ["tag", "muted"],
    key: (r) => r.kind, label: (r) => r.kind, value: (r) => r.kind,
  },
];

function init() {
  return initListTable({
    table: dom.window.document.querySelector("#t"),
    data,
    query,
    rowHref: (r) => r.url,
    columns: COLUMNS,
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
  assert.equal(brockmann.rowSpan, 3, "three Müller-Brockmann works share one cell");
  // grouped column renders fewer cells than rows
  assert.ok(dom.window.document.querySelectorAll("td.designer").length < rows().length);
});

test("clicking a value filters, updates the URL, and clicking again clears", () => {
  init();
  const chip = [...dom.window.document.querySelectorAll('a[data-filter]')]
    .find((a) => a.dataset.filter === "kind=typeface");
  click(chip);
  assert.equal(rows().length, 3, "three typefaces in the canon");
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
  assert.equal(rows().length, 2);
  const th = dom.window.document.querySelector('th[data-param="designer"]');
  assert.ok(th.classList.contains("has-value"));
  assert.ok(th.classList.contains("filtered"));
});

test("header clicks cycle sort desc -> asc -> unsorted", () => {
  init();
  const th = dom.window.document.querySelector('th[data-sort="year"]');
  click(th);
  assert.equal(dom.window.location.search, "?sort=-year");
  assert.equal(rows()[0].querySelector("td.year").textContent.trim(), "1981");
  click(th);
  assert.equal(dom.window.location.search, "?sort=year");
  assert.equal(rows()[0].querySelector("td.year").textContent.trim(), "1945");
  click(th);
  assert.equal(dom.window.location.search, "");
});

test("initial state comes from the page URL", async () => {
  setDom("https://tabelle.test/?designer=Adrian+Frutiger");
  ({ initListTable } = await import("../listtable.js"));
  init();
  assert.equal(rows().length, 2);
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
