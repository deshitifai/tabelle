const SORT_KEYS = {
  date: (r) => r.date,
  city: (r) => r.city,
};

function eventDays(row) {
  const days = [];
  const start = String(row.date).slice(0, 10);
  const end = String(row.end || row.date).slice(0, 10);
  const cursor = new Date(start + "T00:00:00");
  const fmt = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  while (fmt(cursor) <= end) {
    days.push(fmt(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export default function query(data, params) {
  let rows = data.events;
  if (params.date) {
    const selected = new Set(String(params.date).split(",").filter(Boolean));
    rows = rows.filter((r) => eventDays(r).some((day) => selected.has(day)));
  }
  for (const key of ["city", "kind"]) {
    if (params[key]) rows = rows.filter((r) => String(r[key]) === String(params[key]));
  }
  const sort = params.sort || "date";
  const key = sort.replace(/^-/, "");
  if (key) {
    const dir = sort.startsWith("-") ? -1 : 1;
    const val = SORT_KEYS[key] || ((r) => r[key]);
    rows = [...rows].sort((a, b) => {
      const x = val(a);
      const y = val(b);
      return (x < y ? -1 : x > y ? 1 : 0) * dir;
    });
  }
  return rows;
}
