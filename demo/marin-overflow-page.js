// Marin-style overflow demonstrator: narrow date/time columns followed by a
// title column. The long time values should stay inside their own column.
initListTable({
  table: "#marin-events",
  data,
  query,
  rowHref: (r) => r.url,
  download: false,

  columns: [
    {
      id: "date", param: "date",
      width: "28%", mobileWidth: "30%", variants: ["mono", "nowrap"],
      label: (r) => r.date, value: (r) => r.date,
    },
    {
      id: "time",
      width: "32%", mobileWidth: "34%", variants: ["mono", "muted", "nowrap"],
      label: (r) => r.time,
    },
    {
      id: "event",
      width: "40%", mobileWidth: "36%", variants: ["strong"],
      label: (r) => r.title, href: (r) => r.url,
    },
  ],
});

initAbout({
  container: "#title",
  html: "<p>This demo mirrors the narrow date/time/event layout used by Marin-style listings. Long time values are clipped at their column edge instead of bleeding into the event title.</p>",
});
