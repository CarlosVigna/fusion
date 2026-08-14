import { FusionLogo } from "../assets/FusionLogo";

export default function Home() {
    return (
        <div className="flex h-full flex-col items-center justify-center gap-8 text-center">
            <div className="opacity-90">
                <FusionLogo size={96} />
            </div>
            <div>
                <h1 className="text-5xl font-bold tracking-tight text-white">
                    Fusion
                </h1>
                <p className="mt-3 text-sm text-zinc-500 tracking-widest uppercase">
                    Plataforma operacional corporativa
                </p>
            </div>
        </div>
    );
}
