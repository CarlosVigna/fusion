import PendingChangesPanel from "../components/operational/panels/PendingChangesPanel";

export default function PendingChanges() {
    return (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <h1 className="mb-6 text-xl font-semibold">Mudanças Pendentes</h1>
            <PendingChangesPanel />
        </div>
    );
}
