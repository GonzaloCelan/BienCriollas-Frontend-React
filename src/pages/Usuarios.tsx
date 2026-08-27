import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  KeyRound,
  LoaderCircle,
  Plus,
  RefreshCw,
  ShieldCheck,
  UserRoundCheck,
  UserRoundX,
  X,
} from "lucide-react";

import { useAuth } from "../context/useAuth";
import type { RolUsuario, Usuario } from "../services/authApi";
import { ApiError } from "../services/httpClient";
import {
  cambiarEstadoUsuarioApi,
  cambiarRolUsuarioApi,
  crearUsuarioApi,
  listarUsuariosApi,
  restablecerPasswordUsuarioApi,
} from "../services/usuariosApi";

import "../styles/usuarios.css";

const initialCreate = {
  nombre: "",
  username: "",
  password: "",
  rol: "EMPLEADO" as RolUsuario,
};

function mensajeError(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

function Usuarios() {
  const { usuario: usuarioActual } = useAuth();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [procesandoId, setProcesandoId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [createDraft, setCreateDraft] = useState(initialCreate);
  const [creando, setCreando] = useState(false);
  const [resetUsuario, setResetUsuario] = useState<Usuario | null>(null);
  const [resetPassword, setResetPassword] = useState("");

  const activos = useMemo(
    () => usuarios.filter((usuario) => usuario.activo).length,
    [usuarios]
  );

  async function cargarUsuarios() {
    try {
      setLoading(true);
      setError("");
      setUsuarios(await listarUsuariosApi());
    } catch (loadError) {
      setError(mensajeError(loadError, "No se pudieron cargar los usuarios."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const initialLoad = window.setTimeout(cargarUsuarios, 0);
    return () => window.clearTimeout(initialLoad);
  }, []);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setCreando(true);
      setError("");
      const creado = await crearUsuarioApi({
        nombre: createDraft.nombre.trim(),
        username: createDraft.username.trim(),
        password: createDraft.password,
        rol: createDraft.rol,
      });
      setUsuarios((actuales) => [...actuales, creado]);
      setCreateDraft(initialCreate);
      setShowCreate(false);
    } catch (createError) {
      setError(mensajeError(createError, "No se pudo crear el usuario."));
    } finally {
      setCreando(false);
    }
  }

  async function cambiarEstado(item: Usuario) {
    try {
      setProcesandoId(item.id);
      setError("");
      const actualizado = await cambiarEstadoUsuarioApi(item.id, !item.activo);
      setUsuarios((actuales) =>
        actuales.map((usuario) =>
          usuario.id === actualizado.id ? actualizado : usuario
        )
      );
    } catch (stateError) {
      setError(mensajeError(stateError, "No se pudo cambiar el estado."));
    } finally {
      setProcesandoId(null);
    }
  }

  async function cambiarRol(item: Usuario, rol: RolUsuario) {
    if (rol === item.rol) return;

    try {
      setProcesandoId(item.id);
      setError("");
      const actualizado = await cambiarRolUsuarioApi(item.id, rol);
      setUsuarios((actuales) =>
        actuales.map((usuario) =>
          usuario.id === actualizado.id ? actualizado : usuario
        )
      );
    } catch (roleError) {
      setError(mensajeError(roleError, "No se pudo cambiar el rol."));
    } finally {
      setProcesandoId(null);
    }
  }

  async function guardarResetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!resetUsuario) return;

    if (resetPassword.length < 10 || resetPassword.length > 72) {
      setError("La contraseña debe tener entre 10 y 72 caracteres.");
      return;
    }

    try {
      setProcesandoId(resetUsuario.id);
      setError("");
      await restablecerPasswordUsuarioApi(resetUsuario.id, resetPassword);
      setResetUsuario(null);
      setResetPassword("");
    } catch (resetError) {
      setError(mensajeError(resetError, "No se pudo cambiar la contraseña."));
    } finally {
      setProcesandoId(null);
    }
  }

  return (
    <section className="users-page">
      <header className="users-page__header">
        <div>
          <p>SEGURIDAD Y ACCESOS</p>
          <h2>Usuarios</h2>
          <span>Administrá quién puede ingresar y qué permisos tiene.</span>
        </div>
        <div className="users-page__header-actions">
          <button type="button" className="users-refresh" onClick={() => void cargarUsuarios()} disabled={loading} title="Actualizar">
            <RefreshCw size={17} className={loading ? "users-spin" : ""} />
          </button>
          <button type="button" className="users-create-button" onClick={() => setShowCreate(true)}>
            <Plus size={17} /> Nuevo usuario
          </button>
        </div>
      </header>

      <div className="users-summary">
        <div><ShieldCheck size={21} /><span><strong>{usuarios.length}</strong> usuarios</span></div>
        <div><UserRoundCheck size={21} /><span><strong>{activos}</strong> activos</span></div>
        <div><UserRoundX size={21} /><span><strong>{usuarios.length - activos}</strong> inactivos</span></div>
      </div>

      {error && <div className="users-error">{error}</div>}

      <div className="users-table-wrap">
        <table className="users-table">
          <thead><tr><th>Usuario</th><th>Nombre</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody>
            {usuarios.map((item) => {
              const esPropio = item.id === usuarioActual?.id;
              const procesando = procesandoId === item.id;
              return (
                <tr key={item.id}>
                  <td data-label="Usuario"><strong>{item.username}</strong>{esPropio && <small>Tu cuenta</small>}</td>
                  <td data-label="Nombre">{item.nombre}</td>
                  <td data-label="Rol">
                    <select value={item.rol} onChange={(event) => void cambiarRol(item, event.target.value as RolUsuario)} disabled={esPropio || procesando}>
                      <option value="EMPLEADO">Empleado</option>
                      <option value="ADMINISTRADOR">Administrador</option>
                    </select>
                  </td>
                  <td data-label="Estado"><span className={`users-status users-status--${item.activo ? "active" : "inactive"}`}>{item.activo ? "Activo" : "Inactivo"}</span></td>
                  <td data-label="Acciones">
                    <div className="users-actions">
                      <button type="button" onClick={() => { setResetUsuario(item); setResetPassword(""); }} disabled={procesando} title="Restablecer contraseña"><KeyRound size={16} /></button>
                      <button type="button" className={item.activo ? "users-actions__disable" : "users-actions__enable"} onClick={() => void cambiarEstado(item)} disabled={esPropio || procesando}>
                        {procesando ? <LoaderCircle size={16} className="users-spin" /> : item.activo ? "Desactivar" : "Activar"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {!loading && usuarios.length === 0 && <div className="users-empty">Todavía no hay usuarios para mostrar.</div>}
        {loading && <div className="users-empty"><LoaderCircle size={22} className="users-spin" /> Cargando usuarios…</div>}
      </div>

      {showCreate && (
        <div className="users-modal-overlay">
          <section className="users-modal" role="dialog" aria-modal="true">
            <header><div><span>NUEVO ACCESO</span><h3>Crear usuario</h3></div><button type="button" onClick={() => setShowCreate(false)}><X size={19} /></button></header>
            <form onSubmit={handleCreate}>
              <label>Nombre completo<input value={createDraft.nombre} onChange={(e) => setCreateDraft((d) => ({ ...d, nombre: e.target.value }))} maxLength={100} required /></label>
              <label>Usuario<input value={createDraft.username} onChange={(e) => setCreateDraft((d) => ({ ...d, username: e.target.value }))} minLength={3} maxLength={80} pattern="[A-Za-z0-9._-]+" required /></label>
              <label>Contraseña inicial<input type="password" value={createDraft.password} onChange={(e) => setCreateDraft((d) => ({ ...d, password: e.target.value }))} minLength={10} maxLength={72} required /></label>
              <label>Rol<select value={createDraft.rol} onChange={(e) => setCreateDraft((d) => ({ ...d, rol: e.target.value as RolUsuario }))}><option value="EMPLEADO">Empleado</option><option value="ADMINISTRADOR">Administrador</option></select></label>
              <div className="users-modal__actions"><button type="button" onClick={() => setShowCreate(false)}>Cancelar</button><button type="submit" disabled={creando}>{creando ? "Creando…" : "Crear usuario"}</button></div>
            </form>
          </section>
        </div>
      )}

      {resetUsuario && (
        <div className="users-modal-overlay">
          <section className="users-modal users-modal--small" role="dialog" aria-modal="true">
            <header><div><span>SEGURIDAD</span><h3>Nueva contraseña</h3></div><button type="button" onClick={() => setResetUsuario(null)}><X size={19} /></button></header>
            <p>Restableciendo la contraseña de <strong>{resetUsuario.nombre}</strong>. Sus sesiones actuales se cerrarán.</p>
            <form onSubmit={guardarResetPassword}>
              <label>Nueva contraseña<input autoFocus type="password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} minLength={10} maxLength={72} required /></label>
              <div className="users-modal__actions"><button type="button" onClick={() => setResetUsuario(null)}>Cancelar</button><button type="submit" disabled={procesandoId === resetUsuario.id}>{procesandoId === resetUsuario.id ? "Guardando…" : "Restablecer"}</button></div>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}

export default Usuarios;
