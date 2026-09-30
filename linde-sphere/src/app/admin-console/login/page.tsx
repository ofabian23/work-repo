import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminPage, button, input, Notice } from "@/features/admin/admin-ui";
import { getAdminContext } from "@/server/admin";
import { ADMIN_COOKIE } from "@/server/admin/admin-session";

export default async function AdminLoginPage({ searchParams }: PageProps<"/admin-console/login">) {
  const ctx = getAdminContext();
  const base = ctx.config.basePath;
  if (ctx.sessions.validate((await cookies()).get(ADMIN_COOKIE)?.value)) redirect(base);
  const { error } = await searchParams;
  return (
    <AdminPage title="Iniciar sesión" lead="Escriba la frase de acceso configurada en este equipo.">
      {error === "invalid" && <Notice tone="error">La frase de acceso no es correcta.</Notice>}
      {error === "locked" && (
        <Notice tone="error">Demasiados intentos fallidos. Espere unos minutos e inténtelo de nuevo.</Notice>
      )}
      <form
        method="post"
        action={`${base}/api/login`}
        className="flex max-w-md flex-col gap-4"
        data-testid="admin-login"
      >
        <label className="text-label text-ink flex flex-col gap-2 font-semibold">
          Frase de acceso
          <input
            className={input}
            type="password"
            name="passphrase"
            required
            autoComplete="off"
            autoFocus
            data-testid="admin-passphrase"
          />
        </label>
        <button type="submit" className={button} data-testid="admin-login-submit">
          Entrar
        </button>
      </form>
    </AdminPage>
  );
}
