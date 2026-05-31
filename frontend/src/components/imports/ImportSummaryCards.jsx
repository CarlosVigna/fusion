export default function ImportSummaryCards({
  preview,
}) {
  if (!preview) {
    return null;
  }

  const cards = [
    {
      label: "TOTAL",
      value: preview.total,
    },

    {
      label: "CREATE",
      value: preview.creates,
    },

    {
      label: "UPDATE",
      value: preview.updates,
    },

    {
      label: "NO CHANGES",
      value: preview.noChanges,
    },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="
            rounded-2xl border
            border-zinc-800
            bg-zinc-950 p-5
          "
        >
          <p className="text-sm text-zinc-500">
            {card.label}
          </p>

          <h2 className="mt-3 text-3xl font-bold">
            {card.value}
          </h2>
        </div>
      ))}
    </div>
  );
}