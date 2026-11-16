// Funciones de aptitud de la arquitectura hexagonal (ADR-001): reglas de dependencias que
// el pipeline revisa en cada cambio con dependency-cruiser ("npm run arquitectura").
// Si una regla se viola, el comando termina con error y el job "Reglas de arquitectura" falla.
//
// Regla principal del estilo: las dependencias apuntan HACIA el núcleo.
//   dominio  <-  aplicacion  <-  adaptadores        (puertos = interfaces del núcleo)
// Solo configuracion.js conoce a la vez el núcleo y los adaptadores.
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
    forbidden: [
        {
            name: 'dominio-independiente',
            severity: 'error',
            comment:
                'El dominio solo puede depender de otras clases del dominio: nada de aplicación, puertos, ' +
                'adaptadores, librerías (express, sql.js, qrcode) ni módulos de Node (fs, http, crypto).',
            from: { path: '^src/dominio/' },
            to: { pathNot: '^src/dominio/' },
        },
        {
            name: 'aplicacion-sin-infraestructura',
            severity: 'error',
            comment:
                'Los casos de uso solo conocen el dominio y los puertos. Si un caso de uso necesita la BD, ' +
                'el QR o los mapas, lo pide por un puerto; nunca importa un adaptador ni una librería externa.',
            from: { path: '^src/aplicacion/' },
            to: { pathNot: '^src/(dominio|puertos|aplicacion)/' },
        },
        {
            name: 'puertos-sin-implementaciones',
            severity: 'error',
            comment: 'Los puertos son interfaces del núcleo: no pueden depender de adaptadores ni de librerías.',
            from: { path: '^src/puertos/' },
            to: { pathNot: '^src/(puertos|dominio)/' },
        },
        {
            name: 'entrada-no-usa-salida',
            severity: 'error',
            comment:
                'El adaptador HTTP traduce peticiones a casos de uso. No puede saltarse el núcleo ' +
                'usando directamente la base de datos, el QR, los mapas o los notificadores.',
            from: { path: '^src/adaptadores/entrada/' },
            to: { path: '^src/adaptadores/salida/' },
        },
        {
            name: 'solo-configuracion-conecta-adaptadores',
            severity: 'error',
            comment:
                'Solo configuracion.js crea los adaptadores de salida y los conecta con los puertos ' +
                '(inyección de dependencias). Ningún otro archivo los importa.',
            from: { path: '^src/', pathNot: '^src/(configuracion\\.js$|adaptadores/salida/)' },
            to: { path: '^src/adaptadores/salida/' },
        },
        {
            name: 'sin-ciclos',
            severity: 'error',
            comment: 'Una dependencia circular rompe la dirección de las capas.',
            from: { path: '^src/' },
            to: { circular: true },
        },
        {
            name: 'codigo-no-usa-dependencias-de-desarrollo',
            severity: 'error',
            comment: 'El código de producción no puede depender de librerías de desarrollo (no van en la imagen).',
            from: { path: '^src/' },
            to: { dependencyTypes: ['npm-dev'] },
        },
    ],
    options: {
        // Se analizan también los módulos de Node (fs, crypto...) y las librerías de npm,
        // para que una importación de infraestructura en el núcleo no pase desapercibida.
        doNotFollow: { path: 'node_modules' },
        exclude: { path: '^tests/' },
        moduleSystems: ['cjs'],
    },
};
