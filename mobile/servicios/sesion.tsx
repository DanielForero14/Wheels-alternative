// servicios/sesion.tsx
// Guarda en memoria quién ingresó y su token de sesión. Al cerrar la app hay que volver a ingresar.
import { createContext, ReactNode, useContext, useState } from 'react';
import { Usuario, usarToken } from './api';

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

  const iniciarSesion = (nuevo: Usuario) => {
    usarToken(nuevo.token); // desde aquí cada petición lleva "Authorization: Bearer <token>"
    setUsuario(nuevo);
  };
  const cerrarSesion = () => {
    usarToken(null);
    setUsuario(null);
  };

  return (
    <ContextoSesion.Provider value={{ usuario, iniciarSesion, cerrarSesion }}>
      {children}
    </ContextoSesion.Provider>
  );
}

export function useSesion() {
  return useContext(ContextoSesion);
}
