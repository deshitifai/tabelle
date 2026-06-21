export default function query(data, params) {
  let rows = data.events;
  for (const key of ["date", "kind"]) {
    if (params[key]) rows = rows.filter((r) => String(r[key]) === String(params[key]));
  }
  return rows;
}
