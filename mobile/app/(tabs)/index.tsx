// app/(tabs)/index.tsx
// Primera pestaña: el pasajero busca viajes y el conductor programa los suyos.
import BuscarViajes from '@/components/wheels/BuscarViajes';
import MisViajesConductor from '@/components/wheels/MisViajesConductor';
import { useSesion } from '@/servicios/sesion';

export default function Inicio() {
  const { usuario } = useSesion();
  return usuario?.rol === 'conductor' ? <MisViajesConductor /> : <BuscarViajes />;
}
