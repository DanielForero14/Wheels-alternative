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
