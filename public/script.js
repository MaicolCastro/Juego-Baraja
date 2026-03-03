const meta = 8;
const palos = ["espadas", "oros", "copas", "bastos"];

let posiciones = {
    espadas: 0,
    oros: 0,
    copas: 0,
    bastos: 0
};

// Crear tablero visual
function crearTablero() {
    palos.forEach(palo => {
        const fila = document.getElementById(palo);
        fila.innerHTML = "";

        for (let i = 0; i < meta; i++) {
            const casilla = document.createElement("div");
            casilla.classList.add("casilla");
            fila.appendChild(casilla);
        }
    });
}

crearTablero();

async function sacarCarta() {

    const respuesta = await fetch("/sacar");
    const datos = await respuesta.json();

    const carta = document.getElementById("cartaVisual");

    carta.innerHTML = simboloPalo(datos.carta);
    carta.classList.add("animar");

    setTimeout(() => {
        carta.classList.remove("animar");
    }, 300);

    posiciones = datos.posiciones;

    actualizarTablero();

    if (datos.ganador) {
        document.getElementById("ganador").innerText =
            "🏆 Ganó " + datos.ganador.toUpperCase();
    }
}

function actualizarTablero() {
    palos.forEach(palo => {
        const fila = document.getElementById(palo);
        const casillas = fila.children;

        for (let i = 0; i < meta; i++) {
            casillas[i].classList.remove("ficha");
        }

        if (posiciones[palo] > 0 && posiciones[palo] <= meta) {
            casillas[posiciones[palo] - 1].classList.add("ficha");
        }
    });
}

function simboloPalo(palo) {
    switch (palo) {
        case "espadas": return "🗡 ESPADAS";
        case "oros": return "🥇 OROS";
        case "copas": return "🏆 COPAS";
        case "bastos": return "🪵 BASTOS";
    }
}