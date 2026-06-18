// dateline — a thin event-date filter companion for listtable.
//
// Renders one horizontal strip of calendar days grouped by month. Clicking a
// date selects that day, dragging selects a continuous range, shift-click
// extends a continuous range from the anchor, and command/control-click toggles
// discontinuous days. The selected dates are serialized into a URL/table param
// as comma-separated ISO dates.
//
// Config:
//   container       - element or selector the dateline renders into
//   table           - initListTable return value; used for params/setParam
//   events()        - rows to derive available days from
//   date(row)       - ISO local date/datetime ("YYYY-MM-DD" or "YYYY-MM-DDTHH:MM")
//   end(row)        - optional, same format; defaults to the start day
//   param           - URL parameter to drive (defaults to "date")
//   weekStart       - "sun", "mon", 0, or 1; line breaks before that weekday
//   ariaLabel       - accessible label for the control

export function initDateline(config) {
  const container =
    typeof config.container === "string" ? document.querySelector(config.container) : config.container;
  const root = document.createElement("div");
  root.className = "lt-dateline";
  root.setAttribute("role", "group");
  root.setAttribute("aria-label", config.ariaLabel || "event dateline filter");
  container.appendChild(root);

  const param = config.param || "date";
  const weekStart = config.weekStart === "mon" || config.weekStart === "monday" || config.weekStart === 1 ? 1 : 0;
  let days = [];
  let available = new Set();
  let buttons = [];
  let selected = new Set(readSelected());
  let anchor = selected.size ? [...selected].sort()[0] : "";
  let dragStart = "";
  let dragging = false;
  let dragMoved = false;

  function dayKey(value) {
    return value ? String(value).slice(0, 10) : "";
  }

  function fmt(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function readSelected() {
    const params = config.table && config.table.params ? config.table.params() : Object.fromEntries(new URLSearchParams(location.search));
    return String(params[param] || "")
      .split(",")
      .map((date) => date.trim())
      .filter(Boolean);
  }

  function syncFromState(params) {
    selected = new Set(
      String(params[param] || "")
        .split(",")
        .map((date) => date.trim())
        .filter((date) => available.has(date)),
    );
    if (anchor && !selected.has(anchor) && !available.has(anchor)) anchor = selected.size ? [...selected].sort()[0] : "";
    sync();
  }

  function range(from, to) {
    if (!from || !to) return [];
    const start = from <= to ? from : to;
    const end = from <= to ? to : from;
    return days.filter((day) => available.has(day) && day >= start && day <= end);
  }

  function write(next) {
    selected = new Set([...next].filter((day) => available.has(day)));
    const value = [...selected].sort().join(",");
    if (config.table && config.table.setParam) config.table.setParam(param, value);
    else {
      const params = new URLSearchParams(location.search);
      if (value) params.set(param, value);
      else params.delete(param);
      history.replaceState(null, "", params.toString() ? `?${params}` : location.pathname);
    }
    sync();
  }

  function sync() {
    const active = selected.size > 0;
    for (const { button, day, selectable } of buttons) {
      const isSelected = selected.has(day);
      button.classList.toggle("lt-selected", isSelected);
      button.setAttribute("aria-pressed", isSelected ? "true" : "false");
      button.tabIndex = selectable && (!active || isSelected) ? 0 : -1;
    }
  }

  function choose(day, event) {
    if (!available.has(day)) return;
    if (event.metaKey || event.ctrlKey) {
      const next = new Set(selected);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      anchor = day;
      write(next);
      return;
    }
    if (event.shiftKey && anchor) {
      write(range(anchor, day));
      return;
    }
    if (selected.size === 1 && selected.has(day)) {
      anchor = "";
      write([]);
      return;
    }
    anchor = day;
    write([day]);
  }

  function render() {
    const present = new Set();
    let min = "";
    let max = "";
    for (const row of config.events() || []) {
      const start = dayKey(config.date(row));
      if (!start) continue;
      let end = dayKey(config.end ? config.end(row) : "") || start;
      if (end < start) end = start;
      const cursor = new Date(start + "T00:00:00");
      while (fmt(cursor) <= end) {
        present.add(fmt(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }
      if (!min || start < min) min = start;
      if (!max || end > max) max = end;
    }

    available = present;
    days = [];
    if (min) {
      const cursor = new Date(min + "T00:00:00");
      while (fmt(cursor) <= max) {
        days.push(fmt(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }
    }
    selected = new Set(readSelected().filter((day) => present.has(day)));
    if (anchor && !present.has(anchor)) anchor = selected.size ? [...selected].sort()[0] : "";

    root.textContent = "";
    buttons = [];
    if (!days.length) return;

    let currentMonth = "";
    let month = null;
    for (const day of days) {
      const d = new Date(day + "T00:00:00");
      const monthKey = day.slice(0, 7);
      if (monthKey !== currentMonth) {
        currentMonth = monthKey;
        month = document.createElement("div");
        month.className = "lt-dateline-month";
        const label = document.createElement("div");
        label.className = "lt-dateline-month-label";
        label.textContent = d.toLocaleDateString("en-US", { month: "long" }).toLowerCase();
        const row = document.createElement("div");
        row.className = "lt-dateline-days";
        month.append(label, row);
        root.appendChild(month);
      }

      const selectable = present.has(day);
      const cell = document.createElement("div");
      cell.className = "lt-dateline-cell";
      if (d.getDay() === weekStart) cell.classList.add("lt-week-start");
      cell.title = d.toLocaleDateString("en-US", { weekday: "long" });

      const button = document.createElement("button");
      button.type = "button";
      button.className = "lt-dateline-day";
      button.disabled = !selectable;
      button.dataset.date = day;
      button.textContent = String(d.getDate());
      button.title = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
      button.setAttribute("aria-label", button.title);
      if (selectable) {
        button.addEventListener("click", (event) => {
          if (dragMoved) {
            event.preventDefault();
            dragMoved = false;
            return;
          }
          choose(day, event);
        });
        button.addEventListener("pointerdown", (event) => {
          if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
          dragging = true;
          dragMoved = false;
          dragStart = day;
        });
        button.addEventListener("pointerenter", () => {
          if (dragging && dragStart) {
            dragMoved = day !== dragStart;
            write(range(dragStart, day));
          }
        });
      }
      cell.appendChild(button);
      month.querySelector(".lt-dateline-days").appendChild(cell);
      buttons.push({ button, day, selectable });
    }
    sync();
  }

  document.addEventListener("pointerup", () => {
    if (dragging && dragStart) anchor = dragStart;
    dragging = false;
    dragStart = "";
  });

  root.addEventListener("mouseover", (event) => {
    const button = event.target.closest(".lt-dateline-day");
    if (!button || button.disabled || !root.contains(button)) return;
    if (config.table && config.table.previewParam) config.table.previewParam(param, button.dataset.date);
  });
  root.addEventListener("mouseout", (event) => {
    if (event.relatedTarget && root.contains(event.relatedTarget)) return;
    if (config.table && config.table.clearPreview) config.table.clearPreview();
  });

  window.addEventListener("popstate", () => {
    selected = new Set(readSelected());
    sync();
  });
  if (config.table && config.table.onState) config.table.onState(syncFromState);
  window.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    // listtable also handles Escape; read on the next turn so its URL/table
    // state has already cleared before the dateline mirrors it.
    setTimeout(() => {
      selected = new Set(readSelected().filter((day) => available.has(day)));
      sync();
      if (root.contains(document.activeElement)) document.activeElement.blur();
    }, 0);
  });

  render();
  return { render, selected: () => [...selected].sort() };
}
