// dominio/Vehiculo.js
// Carro con el que el conductor hace sus viajes (Reto 1).
// El pasajero aceptado ve la placa y la descripción para saber a qué carro subirse.
class Vehiculo {
    constructor(conductorId, placa, descripcion) {
        const placaLimpia = Vehiculo.normalizarPlaca(placa);
        const descripcionLimpia = String(descripcion || '').trim();
        if (!conductorId || !placaLimpia || !descripcionLimpia) {
            throw new Error('Faltan la placa o la descripción del vehículo');
        }
        // Placa de carro en Colombia: tres letras y tres números (ABC123).
        if (!/^[A-Z]{3}\d{3}$/.test(placaLimpia)) {
            throw new Error('La placa debe tener tres letras y tres números, por ejemplo ABC123');
        }
        if (descripcionLimpia.length < 3 || descripcionLimpia.length > 100) {
            throw new Error('La descripción debe tener entre 3 y 100 caracteres');
        }
        this.conductorId = conductorId;
        this.placa = placaLimpia;
        this.descripcion = descripcionLimpia;
    }

    // "abc 123" o "abc-123" quedan como "ABC123".
    static normalizarPlaca(placa) {
        return String(placa || '').toUpperCase().replace(/[\s-]/g, '');
    }
}

module.exports = Vehiculo;
