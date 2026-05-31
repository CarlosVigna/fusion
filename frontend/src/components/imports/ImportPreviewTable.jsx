export default function ImportPreviewTable({
  preview,
}) {
  if (!preview) {
    return null;
  }

  return (
    <div
      className="
        overflow-x-auto rounded-2xl
        border border-zinc-800
        bg-zinc-900
      "
    >
      <table className="min-w-full">
        <thead className="bg-zinc-950">
          <tr className="text-left text-sm text-zinc-400">
            <th className="px-4 py-4">
              Placa
            </th>

            <th className="px-4 py-4">
              Tipo
            </th>

            <th className="px-4 py-4">
              Diferenças
            </th>
          </tr>
        </thead>

        <tbody>
          {preview.items.map((item) => (
            <tr
              key={item.plate}
              className="
                border-t border-zinc-800
              "
            >
              <td className="px-4 py-4 font-medium">
                {item.plate}
              </td>

              <td className="px-4 py-4">
                {item.type}
              </td>

              <td className="px-4 py-4">
                <div className="space-y-2">
                  {item.differences?.map(
                    (diff) => (
                      <div
                        key={diff.field}
                        className="
                          rounded-xl bg-zinc-950
                          p-3 text-sm
                        "
                      >
                        <p className="font-medium">
                          {diff.field}
                        </p>

                        <p className="text-zinc-500">
                          {diff.currentValue}
                          {" → "}
                          {diff.newValue}
                        </p>
                      </div>
                    )
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}