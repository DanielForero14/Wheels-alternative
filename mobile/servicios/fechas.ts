// servicios/fechas.ts
// Ayudas para mostrar y escribir fechas en formato AAAA-MM-DD.
export function fechaEnDias(dias: number): string {
  const fecha = new Date(Date.now() + dias * 24 * 60 * 60 * 1000);
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

// "2026-10-05" -> "5 oct"
export function fechaCorta(fecha: string): string {
  const [, mes, dia] = fecha.split('-');
  return `${Number(dia)} ${MESES[Number(mes) - 1]}`;
}

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// "2026-10-01" -> "Jueves 1 de octubre"
export function fechaLarga(fecha: string): string {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const diaSemana = new Date(anio, mes - 1, dia).getDay();
  return `${DIAS_SEMANA[diaSemana]} ${dia} de ${MESES_LARGOS[mes - 1]}`;
}
