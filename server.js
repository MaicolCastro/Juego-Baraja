const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const palos = ["espadas", "oros", "copas", "bastos"];

let posiciones = {
    espadas: 0,
    oros: 0,
    copas: 0,
    bastos: 0
};

let meta = 5;

function sacarCarta() {
    return palos[Math.floor(Math.random() * palos.length)];
}

app.get("/sacar", (req, res) => {

    const palo = sacarCarta();
    posiciones[palo]++;

    let ganador = null;

    if (posiciones[palo] >= meta) {
        ganador = palo;
    }

    res.json({
        carta: palo,
        posiciones: posiciones,
        ganador: ganador
    });

});

app.listen(5000, () => {
    console.log("Servidor corriendo en http://localhost:5000");
});