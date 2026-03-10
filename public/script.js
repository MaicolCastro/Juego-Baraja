const meta = 5;
const palos = ["espadas", "oros", "copas", "bastos"];

let posiciones = {
  espadas: 0,
  oros: 0,
  copas: 0,
  bastos: 0,
};

let usuarioActual = null;
let seats = {
  1: null,
  2: null,
  3: null,
  4: null,
};

function crearTablero() {
  palos.forEach((palo) => {
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

function simboloPalo(palo) {
  switch (palo) {
    case "espadas":
      return "🗡 ESPADAS";
    case "oros":
      return "🥇 OROS";
    case "copas":
      return "🏆 COPAS";
    case "bastos":
      return "🪵 BASTOS";
    default:
      return "?";
  }
}

function actualizarTablero() {
  palos.forEach((palo) => {
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

function refrescarUsuarioEnPantalla() {
  const infoUsuario = document.getElementById("infoUsuario");
  const labelNombre = document.getElementById("labelNombre");
  const labelPuntos = document.getElementById("labelPuntos");

  if (usuarioActual) {
    infoUsuario.style.display = "block";
    labelNombre.textContent = usuarioActual.name;
    labelPuntos.textContent = usuarioActual.points;
  } else {
    infoUsuario.style.display = "none";
    labelNombre.textContent = "";
    labelPuntos.textContent = "";
  }
}

async function registrarUsuario() {
  const nombre = document.getElementById("nombreUsuario").value.trim();
  const mensajeAuth = document.getElementById("mensajeAuth");
  mensajeAuth.textContent = "";

  if (!nombre) {
    mensajeAuth.textContent = "Ingresa un nombre de usuario.";
    return;
  }

  try {
    const resp = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nombre }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      mensajeAuth.textContent = data.error || "Error al registrar.";
      return;
    }

    usuarioActual = data;
    refrescarUsuarioEnPantalla();
    mensajeAuth.textContent = "Usuario registrado correctamente. Tienes 1000 puntos.";
  } catch (e) {
    console.error(e);
    mensajeAuth.textContent = "Error de comunicación con el servidor.";
  }
}

async function loginUsuario() {
  const nombre = document.getElementById("nombreUsuario").value.trim();
  const mensajeAuth = document.getElementById("mensajeAuth");
  mensajeAuth.textContent = "";

  if (!nombre) {
    mensajeAuth.textContent = "Ingresa un nombre de usuario.";
    return;
  }

  try {
    const resp = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nombre }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      mensajeAuth.textContent = data.error || "Error al iniciar sesión.";
      return;
    }

    usuarioActual = data;
    refrescarUsuarioEnPantalla();
    mensajeAuth.textContent = "Sesión iniciada.";
  } catch (e) {
    console.error(e);
    mensajeAuth.textContent = "Error de comunicación con el servidor.";
  }
}

async function comprarPuntos() {
  const paquetesInput = document.getElementById("inputPaquetes");
  const mensajeCompra = document.getElementById("mensajeCompra");
  mensajeCompra.textContent = "";

  const paquetes = parseInt(paquetesInput.value, 10);
  if (!paquetes || paquetes <= 0) {
    mensajeCompra.textContent = "Debes indicar al menos 1 paquete.";
    return;
  }

  try {
    const resp = await fetch("/api/comprar-puntos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paquetes }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      mensajeCompra.textContent = data.error || "Error al comprar puntos.";
      return;
    }

    usuarioActual.points = data.puntosActuales;
    refrescarUsuarioEnPantalla();
    mensajeCompra.textContent =
      "Compra realizada. Puntos actuales: " + usuarioActual.points;
  } catch (e) {
    console.error(e);
    mensajeCompra.textContent = "Error de comunicación con el servidor.";
  }
}

async function apostarYJugar() {
  const mensajeJuego = document.getElementById("mensajeJuego");
  const ganadorLabel = document.getElementById("ganador");
  mensajeJuego.textContent = "";
  ganadorLabel.textContent = "";

  const mesa = parseInt(document.getElementById("selectMesa").value, 10);
  const palo = document.getElementById("selectPalo").value;
  const puntosApuesta = parseInt(
    document.getElementById("inputPuntosApuesta").value,
    10,
  );

  if (!puntosApuesta || puntosApuesta <= 0) {
    mensajeJuego.textContent = "Indica una cantidad válida de puntos a apostar.";
    return;
  }

  try {
    const respApuesta = await fetch("/api/apostar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mesa,
        palo,
        puntos: puntosApuesta,
      }),
    });

    const dataApuesta = await respApuesta.json();

    if (!respApuesta.ok) {
      mensajeJuego.textContent = dataApuesta.error || "Error al apostar.";
      return;
    }

    if (usuarioActual) {
      usuarioActual.points = dataApuesta.puntosActuales;
      refrescarUsuarioEnPantalla();
    }

    const respJuego = await fetch(`/api/mesa/${mesa}/sacar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    const dataJuego = await respJuego.json();

    if (!respJuego.ok) {
      mensajeJuego.textContent = dataJuego.error || "Error en el juego.";
      return;
    }

    const carta = document.getElementById("cartaVisual");
    carta.innerHTML = simboloPalo(dataJuego.carta);
    carta.classList.add("animar");

    setTimeout(() => {
      carta.classList.remove("animar");
    }, 300);

    posiciones = dataJuego.posiciones;
    actualizarTablero();

    if (dataJuego.ganador) {
      ganadorLabel.innerText = "🏆 Ganó " + dataJuego.ganador.toUpperCase();

      const actualizado = dataJuego.usuariosActualizados.find(
        (u) => u.userId === usuarioActual.id,
      );
      if (actualizado) {
        usuarioActual.points = actualizado.puntosActuales;
        localStorage.setItem("usuarioJuego", JSON.stringify(usuarioActual));
        refrescarUsuarioEnPantalla();
        mensajeJuego.textContent =
          "¡Ganaste! Se multiplicaron tus puntos apostados por 5.";
      } else {
        mensajeJuego.textContent = "Esta ronda no te favoreció.";
      }
    } else {
      mensajeJuego.textContent =
        "Aún no hay ganador en la mesa. Sigue jugando.";
    }
  } catch (e) {
    console.error(e);
    mensajeJuego.textContent = "Error de comunicación con el servidor.";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  // Intentar recuperar usuario desde la cookie de sesión
  fetch("/api/users/me", {
    method: "GET",
    credentials: "include",
  })
    .then((r) => r.json())
    .then((u) => {
      if (!u || u.error) {
        usuarioActual = null;
      } else {
        usuarioActual = u;
      }
      refrescarUsuarioEnPantalla();
    })
    .catch(() => {
      usuarioActual = null;
      refrescarUsuarioEnPantalla();
    });

  document
    .getElementById("btnRegistrar")
    .addEventListener("click", registrarUsuario);
  document
    .getElementById("btnLogin")
    .addEventListener("click", loginUsuario);
  document
    .getElementById("btnComprar")
    .addEventListener("click", comprarPuntos);
  document
    .getElementById("btnApostarJugar")
    .addEventListener("click", apostarYJugar);

  // Eventos para los 4 asientos
  document.querySelectorAll(".seat").forEach((seatEl) => {
    const seatNumber = parseInt(seatEl.dataset.seat, 10);
    const nombreInput = seatEl.querySelector(".seat-nombre");
    const btnVincular = seatEl.querySelector(".seat-vincular");
    const estado = seatEl.querySelector(".seat-estado");

    btnVincular.addEventListener("click", async () => {
      const nombre = nombreInput.value.trim();
      if (!nombre) {
        estado.textContent = "Escribe un nombre para este asiento.";
        return;
      }

      try {
        // Intentar login primero
        let resp = await fetch("/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: nombre }),
        });
        let data = await resp.json();

        if (!resp.ok && data.error === "Usuario no encontrado") {
          // Si no existe, crearlo
          resp = await fetch("/api/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: nombre }),
          });
          data = await resp.json();
          if (!resp.ok) {
            estado.textContent = data.error || "No se pudo crear el usuario.";
            return;
          }
        } else if (!resp.ok) {
          estado.textContent = data.error || "No se pudo iniciar sesión.";
          return;
        }

        seats[seatNumber] = {
          name: data.name,
        };
        estado.textContent = `Vinculado a ${data.name}`;
      } catch (e) {
        console.error(e);
        estado.textContent = "Error de comunicación con el servidor.";
      }
    });
  });
});