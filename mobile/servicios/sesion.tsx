// servicios/sesion.tsx
// Guarda en memoria quién ingresó. Al cerrar la app hay que volver a ingresar.
import { createContext, ReactNode, useContext, useState } from 'react';
import { Usuario } from './api';

type Sesion = {
  usuario: Usuario | null;
  iniciarSesion: (usuario: Usuario) => void;
  cerrarSesion: () => void;
};

const ContextoSesion = createContext<Sesion>({
  usuario: null,
  iniciarSesion: () => {},
  cerrarSesion: () => {},
});

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  return (
    <ContextoSesion.Provider
      value={{ usuario, iniciarSesion: setUsuario, cerrarSesion: () => setUsuario(null) }}>
      {children}
    </ContextoSesion.Provider>
  );
}

export function useSesion() {
  return useContext(ContextoSesion);
}
