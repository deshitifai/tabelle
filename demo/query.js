// The demo's query function — the same shape a sapi site would serve as
// query.js. Exact-match params per column, plus sort=key / sort=-key.
export default function query(data, params) {
  let rows = data.works;
  for (const key of ["designer", "kind", "year"]) {
    if (params[key]) rows = rows.filter((r) => String(r[key]) === String(params[key]));
  }
  const sort = params.sort || "";
  const key = sort.replace(/^-/, "");
  if (key) {
    const dir = sort.startsWith("-") ? -1 : 1;
    rows = [...rows].sort((a, b) => (a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0) * dir);
  }
  return rows;
}
