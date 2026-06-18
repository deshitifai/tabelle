// Event-listing demonstrator for the thin dateline. Like demo/page.js,
// this is a plain script that the build inlines after the engines, query, and
// data, so those names are available as globals.
const events = initListTable({
  table: "#events",
  data,
  query,
  rowHref: (r) => r.url,
  defaultSort: "date",
  downloadFilename: "bay-area-events",

  columns: [
    {
      id: "date", param: "date", sortable: true, group: true,
      width: "16%", mobileWidth: "21%", variants: ["mono"],
      key: (r) => r.date,
      label: (r) => r.end && r.end !== r.date ? `${r.date.slice(5)} to ${r.end.slice(5)}` : r.date.slice(5),
      value: (r) => r.date,
    },
    {
      id: "event", width: "40%", mobileWidth: "37%", variants: ["strong"],
      label: (r) => r.title, href: (r) => r.url,
    },
    {
      id: "city", param: "city", sortable: true, group: true,
      width: "18%", mobileWidth: "20%",
      key: (r) => r.city, label: (r) => r.city, value: (r) => r.city,
    },
    {
      id: "kind", param: "kind", group: true,
      width: "14%", mobileWidth: "22%", variants: ["tag", "muted"],
      key: (r) => r.kind, label: (r) => r.kind, value: (r) => r.kind,
    },
    {
      id: "venue", width: "12%", variants: ["muted"], mobileHidden: true,
      label: (r) => r.venue,
    },
  ],
});

initDateline({
  container: "#event-dateline",
  table: events,
  events: () => data.events,
  date: (r) => r.date,
  end: (r) => r.end,
});

initAbout({
  container: "#title",
  html: "<p>This page demonstrates <strong>dateline.js</strong> for event listings. Click a date to filter, drag across dates for a range, shift-click to extend from the anchor, and command-click to add or remove discontinuous dates.</p>",
});
