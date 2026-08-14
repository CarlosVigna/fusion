import NeverCommunicatedPanel from "../components/operational/panels/NeverCommunicatedPanel";

export default function NoCommunication() {
    return (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <h1 className="mb-6 text-xl font-semibold">Sem Comunicação</h1>
            <NeverCommunicatedPanel />
        </div>
    );
}
