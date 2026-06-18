import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { JSDOM } from "jsdom";
import { initDateline } from "../dateline.js";

let dom;

const data = [
  { date: "2026-06-01", end: "2026-06-01" },
  { date: "2026-06-03", end: "2026-06-05" },
  { date: "2026-07-01", end: "2026-07-02" },
];

function setDom(url = "https://tabelle.test/") {
  dom = new JSDOM('<!doctype html><html><body><div id="dates"></div></body></html>', { url });
  global.window = dom.window;
  global.document = dom.window.document;
  global.location = dom.window.location;
  global.history = dom.window.history;
}

function fakeTable() {
  const params = new URLSearchParams(dom.window.location.search);
  const listeners = new Set();
  const previews = [];
  const snapshot = () => Object.fromEntries(params);
  return {
    previews,
    params: snapshot,
    setParam: (key, value) => {
      if (value) params.set(key, value);
      else params.delete(key);
      for (const listener of listeners) listener(snapshot());
    },
    previewParam: (key, value) => previews.push({ key, value }),
    clearPreview: () => previews.push(null),
    onState: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

function init(extra = {}) {
  const table = fakeTable();
  const selector = initDateline({
    container: "#dates",
    table,
    events: () => data,
    date: (r) => r.date,
    end: (r) => r.end,
    ...extra,
  });
  return { table, selector };
}

function click(button, options = {}) {
  button.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true, ...options }));
}

beforeEach(() => {
  setDom();
});

test("renders every date in the event span under month labels", () => {
  init();
  const labels = [...dom.window.document.querySelectorAll(".lt-dateline-month-label")].map((el) => el.textContent);
  const days = [...dom.window.document.querySelectorAll(".lt-dateline-day")].map((el) => el.dataset.date);
  assert.deepEqual(labels, ["june", "july"]);
  assert.equal(days.length, 32);
  assert.equal(days[0], "2026-06-01");
  assert.equal(days.at(-1), "2026-07-02");
  assert.ok(days.includes("2026-06-02"), "empty dates stay visible");
});

test("dates without events are gray disabled buttons with day-of-week hover text", () => {
  init();
  const empty = dom.window.document.querySelector('.lt-dateline-day[data-date="2026-06-02"]');
  const busy = dom.window.document.querySelector('.lt-dateline-day[data-date="2026-06-03"]');
  assert.equal(empty.disabled, true);
  assert.equal(empty.tabIndex, -1);
  assert.equal(empty.closest(".lt-dateline-cell").title, "Tuesday");
  assert.match(empty.title, /^Tuesday,/);
  assert.equal(busy.disabled, false);
});

test("click selects one date and command-click toggles discontinuous dates", () => {
  const { table, selector } = init();
  const button = (date) => dom.window.document.querySelector(`.lt-dateline-day[data-date="${date}"]`);
  click(button("2026-06-01"));
  assert.equal(table.params().date, "2026-06-01");
  click(button("2026-07-01"), { metaKey: true });
  assert.equal(table.params().date, "2026-06-01,2026-07-01");
  assert.deepEqual(selector.selected(), ["2026-06-01", "2026-07-01"]);
  click(button("2026-06-01"), { metaKey: true });
  assert.equal(table.params().date, "2026-07-01");
});

test("clicking the only selected date clears the date filter", () => {
  const { table, selector } = init();
  const button = dom.window.document.querySelector('.lt-dateline-day[data-date="2026-06-01"]');
  click(button);
  assert.equal(table.params().date, "2026-06-01");
  click(button);
  assert.equal(table.params().date, undefined);
  assert.deepEqual(selector.selected(), []);
  assert.equal(button.getAttribute("aria-pressed"), "false");
});

test("shift-click selects the continuous range but skips disabled dates", () => {
  const { table } = init();
  const button = (date) => dom.window.document.querySelector(`.lt-dateline-day[data-date="${date}"]`);
  click(button("2026-06-01"));
  click(button("2026-06-05"), { shiftKey: true });
  assert.equal(table.params().date, "2026-06-01,2026-06-03,2026-06-04,2026-06-05");
  assert.equal(button("2026-06-02").getAttribute("aria-pressed"), "false");
  assert.equal(button("2026-06-04").getAttribute("aria-pressed"), "true");
});

test("clicking one date in an existing range narrows to only that date", () => {
  const { table, selector } = init();
  const button = (date) => dom.window.document.querySelector(`.lt-dateline-day[data-date="${date}"]`);
  click(button("2026-06-01"));
  click(button("2026-06-05"), { shiftKey: true });
  click(button("2026-06-04"));
  assert.equal(table.params().date, "2026-06-04");
  assert.deepEqual(selector.selected(), ["2026-06-04"]);
  assert.equal(button("2026-06-01").getAttribute("aria-pressed"), "false");
  assert.equal(button("2026-06-04").getAttribute("aria-pressed"), "true");
});

test("table-originated param changes update the selected dateline date", () => {
  const { table, selector } = init();
  const june3 = dom.window.document.querySelector('.lt-dateline-day[data-date="2026-06-03"]');
  const june4 = dom.window.document.querySelector('.lt-dateline-day[data-date="2026-06-04"]');
  table.setParam("date", "2026-06-04");
  assert.deepEqual(selector.selected(), ["2026-06-04"]);
  assert.equal(june3.getAttribute("aria-pressed"), "false");
  assert.equal(june4.getAttribute("aria-pressed"), "true");

  table.setParam("date", "");
  assert.deepEqual(selector.selected(), []);
  assert.equal(june4.getAttribute("aria-pressed"), "false");
});

test("hovering a dateline date previews that date filter through the table", () => {
  const { table } = init();
  const button = dom.window.document.querySelector('.lt-dateline-day[data-date="2026-06-04"]');
  button.dispatchEvent(new dom.window.MouseEvent("mouseover", { bubbles: true }));
  assert.deepEqual(table.previews.at(-1), { key: "date", value: "2026-06-04" });

  dom.window.document.querySelector(".lt-dateline").dispatchEvent(
    new dom.window.MouseEvent("mouseout", { bubbles: true }),
  );
  assert.equal(table.previews.at(-1), null);
});

test("week-start line breaks default to sunday and can be set to monday", () => {
  init();
  assert.ok(
    dom.window.document
      .querySelector('.lt-dateline-day[data-date="2026-06-07"]')
      .closest(".lt-dateline-cell")
      .classList.contains("lt-week-start"),
  );
  assert.ok(
    !dom.window.document
      .querySelector('.lt-dateline-day[data-date="2026-06-01"]')
      .closest(".lt-dateline-cell")
      .classList.contains("lt-week-start"),
  );

  setDom();
  init({ weekStart: "mon" });
  assert.ok(
    dom.window.document
      .querySelector('.lt-dateline-day[data-date="2026-06-01"]')
      .closest(".lt-dateline-cell")
      .classList.contains("lt-week-start"),
  );
});

test("escape mirrors cleared table params by removing selected styling", async () => {
  const { table, selector } = init();
  const button = dom.window.document.querySelector('.lt-dateline-day[data-date="2026-06-01"]');
  click(button);
  assert.deepEqual(selector.selected(), ["2026-06-01"]);
  assert.ok(button.classList.contains("lt-selected"));
  button.focus();
  assert.equal(dom.window.document.activeElement, button);

  dom.window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") table.setParam("date", "");
  });
  dom.window.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await delay(0);

  assert.deepEqual(selector.selected(), []);
  assert.ok(!button.classList.contains("lt-selected"));
  assert.notEqual(dom.window.document.activeElement, button);
});
