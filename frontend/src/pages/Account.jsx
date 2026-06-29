import { useState } from "react";

import toast from "react-hot-toast";

import { Check, Upload } from "lucide-react";

import { useAuthStore } from "../store/authStore";

import { useThemeStore } from "../store/themeStore";

import {
  changePassword,
  updateProfile,
} from "../services/authService";

const MAX_PHOTO_SIZE = 256;

const THEMES = [
  {
    key: "dark",
    label: "Escuro",
    swatch: ["#09090b", "#18181b", "#ffffff"],
  },
  {
    key: "light",
    label: "Claro",
    swatch: ["#fafafa", "#ffffff", "#18181b"],
  },
  {
    key: "blue",
    label: "Azul corporativo",
    swatch: ["#080b16", "#0f1426", "#ffffff"],
  },
];

function resizePhoto(file) {

  return new Promise((resolve, reject) => {

    const reader = new FileReader();

    reader.onerror = reject;

    reader.onload = () => {

      const img = new Image();

      img.onerror = reject;

      img.onload = () => {

        const scale = Math.min(
          1,
          MAX_PHOTO_SIZE / Math.max(img.width, img.height)
        );

        const canvas = document.createElement("canvas");

        canvas.width = img.width * scale;

        canvas.height = img.height * scale;

        const ctx = canvas.getContext("2d");

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        resolve(canvas.toDataURL("image/jpeg", 0.85));

      };

      img.src = reader.result;

    };

    reader.readAsDataURL(file);

  });

}

export default function Account() {

  const user = useAuthStore((state) => state.user);

  const setUser = useAuthStore((state) => state.setUser);

  const theme = useThemeStore((state) => state.theme);

  const setTheme = useThemeStore((state) => state.setTheme);

  const [name, setName] = useState(user?.name || "");

  const [photoPreview, setPhotoPreview] = useState(user?.photoUrl || null);

  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");

  const [newPassword, setNewPassword] = useState("");

  const [confirmPassword, setConfirmPassword] = useState("");

  const [savingPassword, setSavingPassword] = useState(false);

  async function handlePhotoChange(e) {

    const file = e.target.files?.[0];

    if (!file) {
      return;
    }

    try {

      const dataUrl = await resizePhoto(file);

      setPhotoPreview(dataUrl);

    } catch (error) {

      console.error(error);

      toast.error("Erro ao carregar imagem");

    }

  }

  async function handleSaveProfile(e) {

    e.preventDefault();

    setSavingProfile(true);

    try {

      const updated = await updateProfile({
        name,
        photoUrl: photoPreview,
      });

      setUser(updated);

      toast.success("Perfil atualizado");

    } catch (error) {

      console.error(error);

      toast.error("Erro ao atualizar perfil");

    } finally {

      setSavingProfile(false);

    }

  }

  async function handleChangePassword(e) {

    e.preventDefault();

    if (newPassword !== confirmPassword) {

      toast.error("As senhas não coincidem");

      return;

    }

    setSavingPassword(true);

    try {

      await changePassword({ currentPassword, newPassword });

      toast.success("Senha alterada");

      setCurrentPassword("");

      setNewPassword("");

      setConfirmPassword("");

    } catch (error) {

      console.error(error);

      toast.error(error.message || "Erro ao alterar senha");

    } finally {

      setSavingPassword(false);

    }

  }

  return (
    <div className="space-y-6">

      <div className="grid gap-4 lg:grid-cols-2">

        <form
          onSubmit={handleSaveProfile}
          className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6"
        >

          <h2 className="text-lg font-semibold">Dados pessoais</h2>

          <div className="mt-5 flex items-center gap-4">

            <div
              className="
                flex h-16 w-16 shrink-0 items-center
                justify-center overflow-hidden
                rounded-full bg-zinc-800 text-xl font-bold
              "
            >
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt="Foto de perfil"
                  className="h-full w-full object-cover"
                />
              ) : (
                name?.[0]?.toUpperCase() || "U"
              )}
            </div>

            <label
              className="
                flex items-center gap-2
                rounded-xl border border-zinc-700
                bg-zinc-950 px-4 py-2.5
                text-sm font-semibold
                transition hover:bg-zinc-800
                cursor-pointer
              "
            >
              <Upload size={14} />
              Alterar foto
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                className="hidden"
              />
            </label>

          </div>

          <div className="mt-5 space-y-4">

            <div>
              <label className="text-sm text-zinc-500">Nome</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="
                  mt-1 w-full rounded-xl border border-zinc-800
                  bg-zinc-950 px-4 py-2.5 text-sm outline-none
                "
              />
            </div>

            <div>
              <label className="text-sm text-zinc-500">E-mail</label>
              <input
                value={user?.email || ""}
                disabled
                className="
                  mt-1 w-full rounded-xl border border-zinc-800
                  bg-zinc-950 px-4 py-2.5 text-sm
                  text-zinc-500 outline-none
                "
              />
            </div>

          </div>

          <button
            type="submit"
            disabled={savingProfile}
            className="
              mt-5 rounded-2xl bg-white px-6 py-3
              text-sm font-semibold text-black
              transition hover:opacity-90
              disabled:opacity-50
            "
          >
            {savingProfile ? "Salvando..." : "Salvar perfil"}
          </button>

        </form>

        <form
          onSubmit={handleChangePassword}
          className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6"
        >

          <h2 className="text-lg font-semibold">Alterar senha</h2>

          <div className="mt-5 space-y-4">

            <div>
              <label className="text-sm text-zinc-500">Senha atual</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="
                  mt-1 w-full rounded-xl border border-zinc-800
                  bg-zinc-950 px-4 py-2.5 text-sm outline-none
                "
              />
            </div>

            <div>
              <label className="text-sm text-zinc-500">Nova senha</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="
                  mt-1 w-full rounded-xl border border-zinc-800
                  bg-zinc-950 px-4 py-2.5 text-sm outline-none
                "
              />
            </div>

            <div>
              <label className="text-sm text-zinc-500">
                Confirmar nova senha
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="
                  mt-1 w-full rounded-xl border border-zinc-800
                  bg-zinc-950 px-4 py-2.5 text-sm outline-none
                "
              />
            </div>

          </div>

          <button
            type="submit"
            disabled={savingPassword}
            className="
              mt-5 rounded-2xl bg-white px-6 py-3
              text-sm font-semibold text-black
              transition hover:opacity-90
              disabled:opacity-50
            "
          >
            {savingPassword ? "Salvando..." : "Alterar senha"}
          </button>

        </form>

      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

        <h2 className="text-lg font-semibold">Tema</h2>

        <p className="mt-1 text-sm text-zinc-500">
          Afeta só fundo, cards, menus e textos — cores de status e
          alertas continuam as mesmas em qualquer tema.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">

          {THEMES.map((option) => {

            const isActive = theme === option.key;

            return (
              <button
                key={option.key}
                onClick={() => setTheme(option.key)}
                className={`
                  relative rounded-2xl border p-4 text-left
                  transition
                  ${isActive
                    ? "border-white"
                    : "border-zinc-800 hover:border-zinc-600"}
                `}
              >

                {isActive && (
                  <span className="absolute right-3 top-3 rounded-full bg-white p-1 text-black">
                    <Check size={12} />
                  </span>
                )}

                <div className="flex gap-1.5">
                  {option.swatch.map((color, index) => (
                    <span
                      key={index}
                      className="h-8 w-8 rounded-lg border border-zinc-700"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>

                <p className="mt-3 text-sm font-semibold">
                  {option.label}
                </p>

              </button>
            );

          })}

        </div>

      </div>

    </div>
  );
}
