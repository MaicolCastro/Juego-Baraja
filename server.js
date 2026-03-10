const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// -----------------------------
// CONFIGURACIÓN BASE DE DATOS
// -----------------------------

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

async function initDB() {
  // Tabla de usuarios
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      points INTEGER NOT NULL DEFAULT 1000,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  // Tabla de apuestas
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bets (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      mesa INTEGER NOT NULL,
      palo TEXT NOT NULL,
      puntos INTEGER NOT NULL,
      estado TEXT NOT NULL DEFAULT 'pendiente',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  // Tabla de compras de puntos
  await pool.query(`
    CREATE TABLE IF NOT EXISTS purchases (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      paquetes INTEGER NOT NULL,
      puntos INTEGER NOT NULL,
      precio_total INTEGER NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  console.log("Tablas verificadas/creadas.");
}

// -----------------------------
// LÓGICA DEL JUEGO
// -----------------------------

const palos = ["espadas", "oros", "copas", "bastos"];
const META = 5;

// Posiciones por mesa (1 a 4), cada una con las posiciones de los palos
const posicionesPorMesa = {
  1: { espadas: 0, oros: 0, copas: 0, bastos: 0 },
  2: { espadas: 0, oros: 0, copas: 0, bastos: 0 },
  3: { espadas: 0, oros: 0, copas: 0, bastos: 0 },
  4: { espadas: 0, oros: 0, copas: 0, bastos: 0 },
};

function sacarCarta() {
  return palos[Math.floor(Math.random() * palos.length)];
}

// -----------------------------
// ENDPOINTS DE USUARIOS
// -----------------------------

// Registro: crea usuario con 1000 puntos si no existe
app.post("/api/register", async (req, res) => {
  const { name } = req.body || {};
  if (!name || typeof name !== "string") {
    return res.status(400).json({ error: "Nombre requerido" });
  }

  try {
    const existing = await pool.query("SELECT * FROM users WHERE name = $1", [
      name,
    ]);

    if (existing.rows.length > 0) {
      return res
        .status(400)
        .json({ error: "Ya existe un usuario con ese nombre" });
    }

    const result = await pool.query(
      "INSERT INTO users (name, points) VALUES ($1, $2) RETURNING id, name, points",
      [name, 1000],
    );

    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Error registrando usuario" });
  }
});

// Login: devuelve usuario existente
app.post("/api/login", async (req, res) => {
  const { name } = req.body || {};
  if (!name || typeof name !== "string") {
    return res.status(400).json({ error: "Nombre requerido" });
  }

  try {
    const result = await pool.query(
      "SELECT id, name, points FROM users WHERE name = $1",
      [name],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Error iniciando sesión" });
  }
});

// Obtener datos de usuario
app.get("/api/users/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) {
    return res.status(400).json({ error: "ID inválido" });
  }

  try {
    const result = await pool.query(
      "SELECT id, name, points FROM users WHERE id = $1",
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Error obteniendo usuario" });
  }
});

// -----------------------------
// ENDPOINTS DE PUNTOS / COMPRAS
// -----------------------------

// Comprar paquetes de 1000 puntos a 10.000 COP
app.post("/api/comprar-puntos", async (req, res) => {
  const { userId, paquetes } = req.body || {};

  const id = parseInt(userId, 10);
  const cantPaquetes = parseInt(paquetes, 10);

  if (!id || !cantPaquetes || cantPaquetes <= 0) {
    return res.status(400).json({ error: "Datos inválidos para la compra" });
  }

  const puntos = 1000 * cantPaquetes;
  const precioTotal = 10000 * cantPaquetes;

  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const userRes = await client.query(
        "SELECT id, points FROM users WHERE id = $1 FOR UPDATE",
        [id],
      );
      if (userRes.rows.length === 0) {
        await client.query("ROLLBACK");
        client.release();
        return res.status(404).json({ error: "Usuario no encontrado" });
      }

      const newPoints = userRes.rows[0].points + puntos;

      await client.query(
        "UPDATE users SET points = $1 WHERE id = $2",
        [newPoints, id],
      );

      await client.query(
        "INSERT INTO purchases (user_id, paquetes, puntos, precio_total) VALUES ($1, $2, $3, $4)",
        [id, cantPaquetes, puntos, precioTotal],
      );

      await client.query("COMMIT");

      client.release();

      return res.json({
        userId: id,
        puntosAgregados: puntos,
        precioTotal,
        puntosActuales: newPoints,
      });
    } catch (err) {
      await client.query("ROLLBACK");
      client.release();
      console.error(err);
      return res.status(500).json({ error: "Error procesando la compra" });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Error de conexión a la base de datos" });
  }
});

// -----------------------------
// ENDPOINTS DE APUESTAS Y JUEGO
// -----------------------------

// Crear apuesta para una mesa y un palo
// Regla: hasta 4 usuarios distintos por mesa con apuestas pendientes.
app.post("/api/apostar", async (req, res) => {
  const { userId, mesa, palo, puntos } = req.body || {};

  const id = parseInt(userId, 10);
  const mesaNum = parseInt(mesa, 10);
  const puntosApuesta = parseInt(puntos, 10);

  if (!id || !mesaNum || mesaNum < 1 || mesaNum > 4) {
    return res.status(400).json({ error: "Mesa o usuario inválidos" });
  }

  if (!palos.includes(palo)) {
    return res.status(400).json({ error: "Palo inválido" });
  }

  if (!puntosApuesta || puntosApuesta <= 0) {
    return res
      .status(400)
      .json({ error: "La cantidad de puntos apostados debe ser mayor que 0" });
  }

  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const userRes = await client.query(
        "SELECT id, points FROM users WHERE id = $1 FOR UPDATE",
        [id],
      );

      if (userRes.rows.length === 0) {
        await client.query("ROLLBACK");
        client.release();
        return res.status(404).json({ error: "Usuario no encontrado" });
      }

      if (userRes.rows[0].points < puntosApuesta) {
        await client.query("ROLLBACK");
        client.release();
        return res.status(400).json({ error: "Puntos insuficientes" });
      }

      // Máximo 4 usuarios distintos por mesa con apuestas pendientes
      const mesaRes = await client.query(
        "SELECT COUNT(DISTINCT user_id) AS cnt FROM bets WHERE mesa = $1 AND estado = 'pendiente'",
        [mesaNum],
      );
      const countUsersMesa = parseInt(mesaRes.rows[0].cnt, 10);

      if (countUsersMesa >= 4) {
        const yaTieneApuesta = await client.query(
          "SELECT 1 FROM bets WHERE mesa = $1 AND estado = 'pendiente' AND user_id = $2 LIMIT 1",
          [mesaNum, id],
        );
        if (yaTieneApuesta.rows.length === 0) {
          await client.query("ROLLBACK");
          client.release();
          return res.status(400).json({
            error:
              "Esta mesa ya tiene 4 usuarios apostando. Intenta en otra mesa.",
          });
        }
      }

      const nuevosPuntosUser = userRes.rows[0].points - puntosApuesta;

      await client.query(
        "UPDATE users SET points = $1 WHERE id = $2",
        [nuevosPuntosUser, id],
      );

      const betRes = await client.query(
        `INSERT INTO bets (user_id, mesa, palo, puntos, estado)
         VALUES ($1, $2, $3, $4, 'pendiente')
         RETURNING id, user_id, mesa, palo, puntos, estado, created_at`,
        [id, mesaNum, palo, puntosApuesta],
      );

      await client.query("COMMIT");
      client.release();

      return res.json({
        apuesta: betRes.rows[0],
        puntosActuales: nuevosPuntosUser,
      });
    } catch (err) {
      await client.query("ROLLBACK");
      client.release();
      console.error(err);
      return res.status(500).json({ error: "Error creando apuesta" });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Error de conexión a la base de datos" });
  }
});

// Sacar carta para una mesa y resolver apuestas pendientes
app.post("/api/mesa/:mesa/sacar", async (req, res) => {
  const mesaNum = parseInt(req.params.mesa, 10);
  if (!mesaNum || mesaNum < 1 || mesaNum > 4) {
    return res.status(400).json({ error: "Mesa inválida" });
  }

  const posicionesMesa = posicionesPorMesa[mesaNum];

  const palo = sacarCarta();
  posicionesMesa[palo]++;

  let ganador = null;

  if (posicionesMesa[palo] >= META) {
    ganador = palo;
  }

  let usuariosActualizados = [];

  if (ganador) {
    try {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        const apuestasGanadoras = await client.query(
          `SELECT id, user_id, puntos
           FROM bets
           WHERE mesa = $1 AND estado = 'pendiente' AND palo = $2
           FOR UPDATE`,
          [mesaNum, ganador],
        );

        const apuestasPerdedoras = await client.query(
          `SELECT id
           FROM bets
           WHERE mesa = $1 AND estado = 'pendiente' AND palo <> $2`,
          [mesaNum, ganador],
        );

        for (const row of apuestasGanadoras.rows) {
          const premio = row.puntos * 5;
          const userRow = await client.query(
            "SELECT id, points FROM users WHERE id = $1 FOR UPDATE",
            [row.user_id],
          );
          if (userRow.rows.length > 0) {
            const nuevoTotal = userRow.rows[0].points + premio;
            await client.query(
              "UPDATE users SET points = $1 WHERE id = $2",
              [nuevoTotal, row.user_id],
            );
            usuariosActualizados.push({
              userId: row.user_id,
              puntosActuales: nuevoTotal,
            });
          }
        }

        if (apuestasGanadoras.rows.length > 0) {
          const idsGanadoras = apuestasGanadoras.rows.map((r) => r.id);
          await client.query(
            `UPDATE bets SET estado = 'ganada' WHERE id = ANY($1)`,
            [idsGanadoras],
          );
        }

        if (apuestasPerdedoras.rows.length > 0) {
          const idsPerdedoras = apuestasPerdedoras.rows.map((r) => r.id);
          await client.query(
            `UPDATE bets SET estado = 'perdida' WHERE id = ANY($1)`,
            [idsPerdedoras],
          );
        }

        await client.query("COMMIT");
        client.release();
      } catch (err) {
        await client.query("ROLLBACK");
        client.release();
        console.error(err);
      }
    } catch (err) {
      console.error(err);
    }
  }

  return res.json({
    carta: palo,
    posiciones: posicionesMesa,
    ganador,
    mesa: mesaNum,
    usuariosActualizados,
  });
});

// -----------------------------
// INICIO DEL SERVIDOR
// -----------------------------

const PORT = process.env.PORT || 3000;

initDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log("Servidor corriendo en puerto " + PORT);
    });
  })
  .catch((err) => {
    console.error("Error inicializando base de datos:", err);
    process.exit(1);
  });