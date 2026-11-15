// =====================================================
// 1. CONEXIÓN CON SUPABASE
// =====================================================
// "supabase" viene de la librería que cargamos en index.html.
// createClient crea un objeto que sabe hablar con TU base de datos.
const cliente = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

// Lista con los dos ID de usuario de config.js.
const ids = Object.keys(CONFIG.PERSONAS);

// ID de quien tiene la sesión iniciada en este teléfono (null si nadie).
let idActual = null;


// =====================================================
// 2. REFERENCIAS A ELEMENTOS DE LA PÁGINA
// =====================================================
// --- Inicio de sesión ---
const pantallaLogin     = document.getElementById("pantalla-login");
const pantallaPrincipal = document.getElementById("pantalla-principal");
const formLogin         = document.getElementById("form-login");
const inputCorreo       = document.getElementById("login-correo");
const inputClave        = document.getElementById("login-clave");
const botonEntrar       = document.getElementById("boton-entrar");
const textoError        = document.getElementById("login-error");
const textoSaludo       = document.getElementById("saludo");
const botonSalir        = document.getElementById("boton-salir");

// --- Formulario de movimientos ---
const formMov             = document.getElementById("form-movimiento");
const inputDescripcion    = document.getElementById("mov-descripcion");
const inputMonto          = document.getElementById("mov-monto");
const inputFecha          = document.getElementById("mov-fecha");
const etiquetaPagador     = document.getElementById("etiqueta-pagador");
const selectPagador       = document.getElementById("mov-pagador");
const bloqueDivision      = document.getElementById("bloque-division");
const bloquePersonalizada = document.getElementById("bloque-personalizada");
const etiquetaParte       = document.getElementById("etiqueta-parte");
const inputParte          = document.getElementById("mov-parte");
const textoResumen        = document.getElementById("resumen");
const bloqueCuotas        = document.getElementById("bloque-cuotas");
const bloqueNumCuotas     = document.getElementById("bloque-num-cuotas");
const inputCuotas         = document.getElementById("mov-cuotas");
const etiquetaMes         = document.getElementById("etiqueta-mes");
const inputMes            = document.getElementById("mov-mes");
const botonGuardar        = document.getElementById("boton-guardar");
const textoMensaje        = document.getElementById("mov-mensaje");

// --- Saldo y lista ---
const textoSaldo      = document.getElementById("saldo-texto");
const textoSaldoDet   = document.getElementById("saldo-detalle");
const bloqueProximos  = document.getElementById("bloque-proximos");
const listaProximos   = document.getElementById("lista-proximos");
const listaMov        = document.getElementById("lista-movimientos");
const textoNotaLista  = document.getElementById("lista-nota");

// --- Registro de borrados y aviso "Deshacer" ---
const listaBorrados         = document.getElementById("lista-borrados");
const textoCantidadBorrados = document.getElementById("cantidad-borrados");
const contadorMovimientos   = document.getElementById("contador-movimientos");
const textoNotaBorrados     = document.getElementById("borrados-nota");
const aviso                 = document.getElementById("aviso");
const textoAviso            = document.getElementById("aviso-texto");
const botonDeshacer         = document.getElementById("aviso-deshacer");

// Cuántos movimientos mostrar en la lista (el saldo usa TODOS igual).
const MAXIMO_EN_LISTA = 50;


// =====================================================
// 3. FUNCIONES DE APOYO
// =====================================================

// Devuelve el nombre asociado a un ID de usuario (según config.js).
function nombreDe(id) {
  return CONFIG.PERSONAS[id] || "¿Desconocido?";
}

// Dado un ID, devuelve el de la otra persona.
function otroDe(id) {
  return ids.find((otro) => otro !== id);
}

// Convierte lo escrito ("24.990", "$24990") en un número entero (24990).
function leerMonto(texto) {
  const soloDigitos = texto.replace(/\D/g, "");   // \D = "todo lo que NO es dígito"
  return soloDigitos ? parseInt(soloDigitos, 10) : 0;
}

// Convierte 24990 en "$24.990".
function formatoPesos(numero) {
  return "$" + numero.toLocaleString("es-CL");
}

// Reescribe el campo con puntos de miles mientras se escribe.
function formatearCampo(input) {
  const numero = leerMonto(input.value);
  input.value = numero ? numero.toLocaleString("es-CL") : "";
}

// Fecha de hoy en formato AAAA-MM-DD, según la hora LOCAL del teléfono.
function hoy() {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, "0");   // los meses parten en 0
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

// ----- Meses -----
// Un mes se representa como el día 1 de ese mes: "2026-12-01".
const NOMBRES_MES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
                     "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// "2026-11-15" → "2026-11-01"
function mesDeFecha(fecha) {
  return fecha.slice(0, 7) + "-01";
}

// Suma (o resta) meses: sumarMeses("2026-11-01", 3) → "2027-02-01".
// Truco: contar los meses desde el año 0 (año × 12 + mes), sumar, y volver a separar.
function sumarMeses(mes, cantidad) {
  const [anio, numMes] = mes.split("-").map(Number);
  const total = anio * 12 + (numMes - 1) + cantidad;
  const anio2 = Math.floor(total / 12);
  const mes2  = (total % 12) + 1;
  return `${anio2}-${String(mes2).padStart(2, "0")}-01`;
}

// "2026-12-01" → "Diciembre 2026"
function nombreMes(mes) {
  const [anio, numMes] = mes.split("-").map(Number);
  const nombre = NOMBRES_MES[numMes - 1];
  return nombre[0].toUpperCase() + nombre.slice(1) + " " + anio;
}

// ----- Cuotas -----
// Reparte un total en n cuotas redondeadas a la centena.
// La última cuota absorbe la diferencia, así la suma da EXACTAMENTE el total.
// dividirEnCuotas(450000, 7) → [64300, 64300, 64300, 64300, 64300, 64300, 64200]
function dividirEnCuotas(total, n) {
  if (n <= 1) return [total];
  let base = Math.round(total / n / 100) * 100;
  // Con montos muy chicos, redondear hacia arriba podría pasarse del total:
  // en ese caso redondeamos hacia abajo.
  if (base * (n - 1) > total) base = Math.floor(total / n / 100) * 100;
  // Y si el monto es tan chico que la centena da 0, repartimos sin redondear.
  if (base === 0) base = Math.floor(total / n);
  const lista = Array(n - 1).fill(base);
  lista.push(total - base * (n - 1));
  return lista;
}

// Todas las cuotas de un movimiento: número, mes, valor de la cuota y parte del otro.
// Un movimiento sin cuotas es simplemente "1 cuota".
function cuotasDe(m) {
  const n = m.cuotas || 1;
  const montos = dividirEnCuotas(m.monto, n);
  const partes = dividirEnCuotas(m.parte_otro, n);
  return montos.map((monto, i) => ({
    numero: i + 1,
    mes:    sumarMeses(m.mes_inicio, i),
    monto:  monto,
    parte:  partes[i],
  }));
}

// Devuelve el valor del botón redondo elegido en un grupo ("tipo" o "division").
function valorElegido(nombreGrupo) {
  return document.querySelector(`input[name="${nombreGrupo}"]:checked`).value;
}

// Muestra un mensaje bajo el botón Guardar (verde si salió bien, rojo si no).
function mostrarMensaje(texto, esError) {
  textoMensaje.textContent = texto;
  textoMensaje.classList.toggle("error", esError);
  textoMensaje.classList.toggle("exito", !esError);
}

// Convierte "2026-11-15" (como lo guarda la base de datos) en "15/11/2026".
// No usamos new Date("2026-11-15"): lo interpreta como medianoche UTC,
// que en Chile es el día ANTERIOR a las 21:00, y mostraría la fecha corrida.
function formatoFecha(textoFecha) {
  const [anio, mes, dia] = textoFecha.split("-");
  return `${dia}/${mes}/${anio}`;
}

// Muestra una pantalla y oculta la otra.
function mostrarPantalla(cual) {
  pantallaLogin.classList.toggle("oculta", cual !== "login");
  pantallaPrincipal.classList.toggle("oculta", cual !== "principal");
}


// =====================================================
// 4. LÓGICA DEL FORMULARIO
// =====================================================

// Llena la lista "¿Quién pagó?" con los dos nombres.
function llenarPagadores() {
  selectPagador.innerHTML = "";
  ids.forEach((id) => {
    const opcion = document.createElement("option");
    opcion.value = id;                 // lo que se guarda: el ID
    opcion.textContent = nombreDe(id); // lo que se ve: el nombre
    selectPagador.append(opcion);
  });
}

// Calcula cuánto le corresponde a quien NO pagó (la columna parte_otro).
function calcularParteOtro() {
  const monto = leerMonto(inputMonto.value);
  if (valorElegido("tipo") === "pago") return monto;   // un pago descuenta el total

  const division = valorElegido("division");
  if (division === "mitad") return Math.round(monto / 2);
  if (division === "total") return monto;
  return leerMonto(inputParte.value);                   // personalizada
}

// ¿El usuario cambió el mes a mano? Si es así, ya no lo cambiamos solos.
let mesTocado = false;
inputMes.addEventListener("input", () => { mesTocado = true; });

function enCuotas() {
  return valorElegido("en-cuotas") === "si";
}

function numeroDeCuotas() {
  return enCuotas() ? (parseInt(inputCuotas.value, 10) || 0) : 1;
}

// Sin cuotas: el mes de la fecha. Con cuotas: el mes siguiente.
function mesPorDefecto() {
  const base = mesDeFecha(inputFecha.value || hoy());
  return enCuotas() ? sumarMeses(base, 1) : base;
}

// El mes elegido en el formulario, como "AAAA-MM-01".
function mesElegido() {
  return inputMes.value ? inputMes.value + "-01" : mesPorDefecto();
}

// Ajusta lo que se ve en el formulario cada vez que algo cambia.
function actualizarFormulario() {
  const esPago   = valorElegido("tipo") === "pago";
  const division = valorElegido("division");
  const pagador  = selectPagador.value;
  const otro     = otroDe(pagador);

  // Mostrar u ocultar bloques
  bloqueDivision.classList.toggle("oculta", esPago);
  bloquePersonalizada.classList.toggle("oculta", esPago || division !== "personalizada");
  bloqueCuotas.classList.toggle("oculta", esPago);
  bloqueNumCuotas.classList.toggle("oculta", esPago || !enCuotas());

  // Mes de pago: etiqueta y valor por defecto (si no lo cambiaron a mano)
  etiquetaMes.textContent = enCuotas() ? "Mes de la primera cuota" : "Mes de pago";
  if (!mesTocado) inputMes.value = mesPorDefecto().slice(0, 7);   // "2026-12-01" → "2026-12"

  // Textos que cambian según el tipo
  etiquetaPagador.textContent  = esPago ? "¿Quién transfiere?" : "¿Quién pagó?";
  inputDescripcion.placeholder = esPago ? "Pago de deuda (opcional)" : "Ej: Supermercado";
  etiquetaParte.textContent    = "Parte de " + nombreDe(otro) + " ($)";

  // Frase de resumen
  const monto = leerMonto(inputMonto.value);
  const parte = calcularParteOtro();

  if (monto === 0) {
    textoResumen.textContent = "";
  } else if (esPago) {
    textoResumen.textContent =
      `Se descuentan ${formatoPesos(monto)} de lo que ${nombreDe(pagador)} le debe a ${nombreDe(otro)}.`;
  } else if (parte > monto) {
    textoResumen.textContent = `⚠️ La parte de ${nombreDe(otro)} no puede ser mayor que el monto.`;
  } else if (enCuotas()) {
    const n = numeroDeCuotas();
    if (n < 2 || n > 60) {
      textoResumen.textContent = "Indica la cantidad de cuotas (entre 2 y 60).";
      return;
    }
    // "Simulamos" el movimiento para calcular sus cuotas con la misma función de la lista.
    const cuotas = cuotasDe({ monto: monto, parte_otro: parte, cuotas: n, mes_inicio: mesElegido() });
    const primera = cuotas[0];
    const ultima  = cuotas[cuotas.length - 1];
    const lineas = [
      `${nombreDe(otro)} queda debiendo ${formatoPesos(parte)} a ${nombreDe(pagador)}, en ${n} cuotas.`,
      `Cuota: ${formatoPesos(primera.monto)} · Parte de ${nombreDe(otro)}: ${formatoPesos(primera.parte)} al mes.`,
    ];
    if (ultima.monto !== primera.monto || ultima.parte !== primera.parte) {
      lineas.push(`Última cuota: ${formatoPesos(ultima.monto)} · Parte de ${nombreDe(otro)}: ${formatoPesos(ultima.parte)}.`);
    }
    lineas.push(`De ${nombreMes(primera.mes)} a ${nombreMes(ultima.mes)}.`);
    textoResumen.textContent = lineas.join("\n");
  } else {
    textoResumen.textContent =
      `${nombreDe(otro)} queda debiendo ${formatoPesos(parte)} a ${nombreDe(pagador)}.\n` +
      `Se paga en ${nombreMes(mesElegido())}.`;
  }
}

// Deja el formulario como nuevo, con los valores por defecto.
function reiniciarFormulario() {
  formMov.reset();                    // vuelve a "Gasto", "Mitad y mitad" y "Sin cuotas"
  inputFecha.value = hoy();
  mesTocado = false;                  // el mes vuelve a calcularse solo
  selectPagador.value = idActual; // por defecto, pagó quien está usando la app
  actualizarFormulario();
}

// Mientras se escriben montos: poner puntos de miles y actualizar el resumen.
inputMonto.addEventListener("input", () => { formatearCampo(inputMonto); actualizarFormulario(); });
inputParte.addEventListener("input", () => { formatearCampo(inputParte); actualizarFormulario(); });
inputCuotas.addEventListener("input", actualizarFormulario);

// Cualquier cambio en botones redondos o en la lista "¿Quién pagó?".
formMov.addEventListener("change", actualizarFormulario);


// =====================================================
// 5. GUARDAR UN MOVIMIENTO
// =====================================================
formMov.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  mostrarMensaje("", false);

  const tipo  = valorElegido("tipo");
  const monto = leerMonto(inputMonto.value);
  const parte = calcularParteOtro();
  let descripcion = inputDescripcion.value.trim();

  // --- Validaciones (primera barrera; la base de datos es la segunda) ---
  if (monto <= 0) {
    return mostrarMensaje("Ingresa un monto mayor que 0.", true);
  }
  if (tipo === "gasto" && descripcion === "") {
    return mostrarMensaje("Escribe una descripción.", true);
  }
  if (parte > monto) {
    return mostrarMensaje("La parte del otro no puede ser mayor que el monto.", true);
  }
  if (tipo === "gasto" && enCuotas()) {
    const n = numeroDeCuotas();
    if (n < 2 || n > 60) {
      return mostrarMensaje("La cantidad de cuotas debe ser entre 2 y 60.", true);
    }
  }
  if (tipo === "gasto" && !inputMes.value) {
    return mostrarMensaje("Elige el mes de pago.", true);
  }
  if (tipo === "pago" && descripcion === "") {
    descripcion = "Pago de deuda";
  }

  // --- La fila que se guardará, con los mismos nombres de columnas de la tabla ---
  const fila = {
    tipo:        tipo,
    descripcion: descripcion,
    monto:       monto,
    fecha:       inputFecha.value,
    pagado_por:  selectPagador.value,
    division:    tipo === "pago" ? "total" : valorElegido("division"),
    parte_otro:  parte,
    // Un pago de deuda cuenta en el mes en que se hace.
    cuotas:      tipo === "pago" ? 1 : numeroDeCuotas(),
    mes_inicio:  tipo === "pago" ? mesDeFecha(inputFecha.value) : mesElegido(),
  };

  botonGuardar.disabled = true;
  botonGuardar.textContent = "Guardando…";

  const { error } = await cliente.from("movimientos").insert(fila);

  botonGuardar.disabled = false;
  botonGuardar.textContent = "Guardar";

  if (error) {
    console.error(error);   // el detalle técnico queda en la consola (F12)
    mostrarMensaje("No se pudo guardar. Revisa tu conexión e intenta de nuevo.", true);
    return;
  }

  reiniciarFormulario();
  cargarMovimientos();      // para que el saldo y la lista muestren lo recién guardado
  history.back();           // volver al inicio, donde se ve el saldo actualizado
  mostrarAviso("✓ Guardado", 3);
});


// =====================================================
// 6. LEER MOVIMIENTOS, CALCULAR EL SALDO Y DIBUJAR LA LISTA
// =====================================================

// Trae TODOS los movimientos, del más nuevo al más antiguo.
// Supabase entrega como máximo 1000 filas por consulta, así que pedimos
// "páginas" de 1000 hasta que llegue una incompleta (señal de que no hay más).
async function traerTodosLosMovimientos() {
  const TAMANO_PAGINA = 1000;
  const todos = [];
  let desde = 0;

  while (true) {
    const { data, error } = await cliente
      .from("movimientos")
      .select("*")
      .order("fecha", { ascending: false })   // más recientes primero
      .order("id",    { ascending: false })   // mismo día: el último anotado primero
      .range(desde, desde + TAMANO_PAGINA - 1);

    if (error) throw error;                   // "lanza" el error a quien llamó la función
    todos.push(...data);
    if (data.length < TAMANO_PAGINA) break;   // página incompleta: no hay más
    desde += TAMANO_PAGINA;
  }
  return todos;
}

// Saldos desde el punto de vista de quien usa la app
// (positivo = el otro me debe; negativo = yo le debo):
//  - aLaFecha: cuotas de este mes y de meses anteriores (lo que hay que pagar ya).
//  - futuros:  un saldo por cada mes que viene, ej. { "2026-12-01": 37500, ... }
function calcularSaldos(movimientos) {
  const mesHoy = mesDeFecha(hoy());
  let aLaFecha = 0;
  const futuros = {};

  movimientos.forEach((m) => {
    const signo = m.pagado_por === idActual ? 1 : -1;   // pagué yo: +; pagó el otro: −
    cuotasDe(m).forEach((c) => {
      // Los meses "AAAA-MM-01" se pueden comparar como texto: "2026-11-01" < "2026-12-01"
      if (c.mes <= mesHoy) {
        aLaFecha += signo * c.parte;
      } else {
        futuros[c.mes] = (futuros[c.mes] || 0) + signo * c.parte;
      }
    });
  });
  return { aLaFecha, futuros };
}

// Frase para un saldo: "Camila te debe $X" / "Le debes $X a Camila" / "Están a mano ✓"
function fraseSaldo(saldo, verbo) {
  const otro = nombreDe(otroDe(idActual));
  if (saldo > 0) return verbo === "futuro" ? `${otro} te paga ${formatoPesos(saldo)}` : `${otro} te debe ${formatoPesos(saldo)}`;
  if (saldo < 0) return verbo === "futuro" ? `Le pagas ${formatoPesos(-saldo)}` : `Le debes ${formatoPesos(-saldo)} a ${otro}`;
  return "Están a mano ✓";
}

function mostrarSaldos({ aLaFecha, futuros }) {
  textoSaldo.textContent = fraseSaldo(aLaFecha);
  textoSaldoDet.textContent = `Incluye ${nombreMes(mesDeFecha(hoy())).toLowerCase()} y meses anteriores`;

  // Próximos meses: solo los que tienen algo pendiente, en orden.
  const meses = Object.keys(futuros).filter((mes) => futuros[mes] !== 0).sort();
  listaProximos.innerHTML = "";
  bloqueProximos.classList.toggle("oculta", meses.length === 0);

  let totalFuturo = 0;
  meses.forEach((mes) => {
    totalFuturo += futuros[mes];
    const fila = crearElemento("li", "fila-mes");
    fila.append(
      crearElemento("span", "mes", nombreMes(mes)),
      crearElemento("span", "valor", fraseSaldo(futuros[mes], "futuro"))
    );
    listaProximos.append(fila);
  });

  if (meses.length > 1) {
    const fila = crearElemento("li", "fila-mes total");
    fila.append(
      crearElemento("span", "mes", "Total por venir"),
      crearElemento("span", "valor", fraseSaldo(totalFuturo, "futuro"))
    );
    listaProximos.append(fila);
  }
}

// Texto chico bajo la descripción: quién pagó y cómo se dividió.
function detalleDe(m) {
  const pagador = nombreDe(m.pagado_por);
  const otro    = nombreDe(otroDe(m.pagado_por));
  const fecha   = formatoFecha(m.fecha);

  if (m.tipo === "pago") return `${fecha} · ${pagador} le pagó a ${otro}`;

  let texto;
  if (m.division === "mitad")      texto = `${fecha} · Pagó ${pagador} · Mitad y mitad`;
  else if (m.division === "total") texto = `${fecha} · Pagó ${pagador} · Todo de ${otro}`;
  else texto = `${fecha} · Pagó ${pagador} · Parte de ${otro}: ${formatoPesos(m.parte_otro)}`;

  // Agregar cuándo se paga (solo si hay cuotas o si no es el mes de la fecha)
  if (m.cuotas > 1) {
    const ultimo = sumarMeses(m.mes_inicio, m.cuotas - 1);
    texto += ` · ${m.cuotas} cuotas: ${nombreMes(m.mes_inicio)} a ${nombreMes(ultimo)}`;
  } else if (m.mes_inicio !== mesDeFecha(m.fecha)) {
    texto += ` · Se paga en ${nombreMes(m.mes_inicio)}`;
  }
  return texto;
}

// Crea un elemento HTML con una clase y un texto (atajo para no repetir 3 líneas).
function crearElemento(etiqueta, clase, texto) {
  const el = document.createElement(etiqueta);
  el.className = clase;
  if (texto !== undefined) el.textContent = texto;
  return el;
}

// Convierte un instante con hora (ej. borrado_en) en "15/11/2026, 16:20".
// Aquí SÍ usamos new Date: una columna timestamptz incluye la zona horaria,
// así que el teléfono la convierte bien a la hora de Chile.
function formatoFechaHora(instante) {
  return new Date(instante).toLocaleString("es-CL", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// Arma una fila de la lista. Sirve tanto para los movimientos vigentes
// (botón "Borrar") como para los borrados (botón "Restaurar").
function crearItem(m, detalle, textoBoton, claseBoton, accion) {
  const item = crearElemento("li", "item");
  const info = crearElemento("div", "item-info");
  info.append(
    crearElemento("div", "item-descripcion", m.descripcion),
    crearElemento("div", "item-detalle", detalle)
  );
  const monto = crearElemento("span", "item-monto", formatoPesos(m.monto));
  const boton = crearElemento("button", claseBoton, textoBoton);
  boton.addEventListener("click", () => accion(m));
  item.append(info, monto, boton);
  return item;
}

function dibujarLista(movimientos) {
  listaMov.innerHTML = "";   // vaciar la lista antes de volver a dibujarla

  if (movimientos.length === 0) {
    textoNotaLista.textContent = "Aún no hay movimientos.";
    return;
  }

  movimientos.slice(0, MAXIMO_EN_LISTA).forEach((m) => {
    listaMov.append(crearItem(m, detalleDe(m), "Borrar", "boton-borrar", borrarMovimiento));
  });

  textoNotaLista.textContent = movimientos.length > MAXIMO_EN_LISTA
    ? `Mostrando los ${MAXIMO_EN_LISTA} más recientes de ${movimientos.length}.`
    : "";
}

// Registro de borrados: qué se borró, quién y cuándo.
function dibujarBorrados(borrados) {
  listaBorrados.innerHTML = "";
  textoCantidadBorrados.textContent = borrados.length;

  if (borrados.length === 0) {
    textoNotaBorrados.textContent = "No se ha borrado nada.";
    return;
  }

  borrados.slice(0, MAXIMO_EN_LISTA).forEach((m) => {
    const detalle =
      `Borrado por ${nombreDe(m.borrado_por)} el ${formatoFechaHora(m.borrado_en)} · ` + detalleDe(m);
    listaBorrados.append(crearItem(m, detalle, "Restaurar", "boton-restaurar", restaurarMovimiento));
  });

  textoNotaBorrados.textContent = borrados.length > MAXIMO_EN_LISTA
    ? `Mostrando los ${MAXIMO_EN_LISTA} borrados más recientes de ${borrados.length}.`
    : "";
}

// Junta todo: traer, separar vigentes de borrados, calcular, mostrar.
async function cargarMovimientos() {
  try {
    const todos = await traerTodosLosMovimientos();

    // filter = "quedarse solo con los que cumplen la condición"
    const vigentes = todos.filter((m) => m.borrado_en === null);
    const borrados = todos
      .filter((m) => m.borrado_en !== null)
      .sort((a, b) => b.borrado_en.localeCompare(a.borrado_en));   // último borrado primero

    mostrarSaldos(calcularSaldos(vigentes));   // ¡el saldo solo cuenta los vigentes!
    dibujarLista(vigentes);
    dibujarBorrados(borrados);
    contadorMovimientos.textContent = vigentes.length;
  } catch (error) {
    console.error(error);
    textoSaldo.textContent = "No se pudo cargar";
    textoNotaLista.textContent = "Revisa tu conexión e intenta de nuevo.";
  }
}

// "Borrar" ya no elimina la fila: le pone fecha y autor de borrado.
// La fila sigue en la base de datos, así que siempre se puede recuperar.
async function borrarMovimiento(m) {
  const pregunta = `¿Borrar "${m.descripcion}" de ${formatoPesos(m.monto)}?`;
  if (!confirm(pregunta)) return;

  const { error } = await cliente
    .from("movimientos")
    .update({ borrado_en: new Date().toISOString(), borrado_por: idActual })
    .eq("id", m.id);

  if (error) {
    console.error(error);
    alert("No se pudo borrar. Intenta de nuevo.");
    return;
  }
  cargarMovimientos();
  mostrarAvisoDeshacer(m);
}

// Restaurar = quitarle la marca de borrado.
async function restaurarMovimiento(m) {
  const { error } = await cliente
    .from("movimientos")
    .update({ borrado_en: null, borrado_por: null })
    .eq("id", m.id);

  if (error) {
    console.error(error);
    alert("No se pudo restaurar. Intenta de nuevo.");
    return;
  }
  ocultarAviso();
  cargarMovimientos();
}

// ----- Aviso inferior con el botón "Deshacer" -----
let movimientoRecienBorrado = null;
let temporizadorAviso = null;
// Muestra el aviso inferior durante algunos segundos.
// Si recibe un movimiento, agrega el botón "Deshacer" para restaurarlo.
function mostrarAviso(texto, segundos, movimiento = null) {
  movimientoRecienBorrado = movimiento;
  textoAviso.textContent = texto;
  botonDeshacer.classList.toggle("oculta", movimiento === null);
  aviso.classList.remove("oculta");

  clearTimeout(temporizadorAviso);   // si había otro aviso, se reemplaza
  temporizadorAviso = setTimeout(ocultarAviso, segundos * 1000);
}

function mostrarAvisoDeshacer(m) {
  mostrarAviso(`Se borró "${m.descripcion}"`, 8, m);
}

function ocultarAviso() {
  clearTimeout(temporizadorAviso);
  aviso.classList.add("oculta");
  movimientoRecienBorrado = null;
}

botonDeshacer.addEventListener("click", () => {
  if (movimientoRecienBorrado) restaurarMovimiento(movimientoRecienBorrado);
});


// =====================================================
// 7. INICIAR Y CERRAR SESIÓN
// =====================================================
formLogin.addEventListener("submit", async (evento) => {
  evento.preventDefault();           // evita que la página se recargue al enviar el formulario
  textoError.textContent = "";
  botonEntrar.disabled = true;       // evita que se presione dos veces
  botonEntrar.textContent = "Entrando…";

  const { error } = await cliente.auth.signInWithPassword({
    email: inputCorreo.value.trim(),
    password: inputClave.value,
  });

  botonEntrar.disabled = false;
  botonEntrar.textContent = "Entrar";

  if (error) {
    textoError.textContent = "Correo o contraseña incorrectos.";
  } else {
    inputClave.value = "";           // no dejamos la contraseña escrita en pantalla
  }
});

botonSalir.addEventListener("click", async () => {
  await cliente.auth.signOut();
});


// =====================================================
// 8. NAVEGACIÓN ENTRE VISTAS (inicio, nuevo, movimientos, borrados)
// =====================================================
// Cada vista tiene su "dirección" después del # en la URL:
//   .../gastos-comunes/#nuevo   .../#movimientos   .../#borrados
// Así el botón "atrás" del teléfono vuelve a la vista anterior
// en vez de cerrar la app.
const vistas = {
  inicio:      document.getElementById("vista-inicio"),
  nuevo:       document.getElementById("vista-nuevo"),
  movimientos: document.getElementById("vista-movimientos"),
  borrados:    document.getElementById("vista-borrados"),
};

// Muestra la vista que indica el # de la URL (o el inicio si no hay).
function mostrarVista() {
  const pedida = location.hash.slice(1);             // "#nuevo" → "nuevo"
  const nombre = vistas[pedida] ? pedida : "inicio";  // si no existe, al inicio
  for (const [nombreVista, elemento] of Object.entries(vistas)) {
    elemento.classList.toggle("oculta", nombreVista !== nombre);
  }
  window.scrollTo(0, 0);                              // cada vista parte desde arriba
}

// Quita el # de la URL sin agregar un paso al historial.
function limpiarHash() {
  if (location.hash) history.replaceState(null, "", location.pathname + location.search);
}

// Botones del menú: cada uno dice a dónde ir en su atributo data-ir.
document.querySelectorAll("[data-ir]").forEach((boton) => {
  boton.addEventListener("click", () => {
    location.hash = boton.dataset.ir;
  });
});

// Botones "← Volver": hacen lo mismo que el botón atrás del teléfono.
document.querySelectorAll(".boton-volver").forEach((boton) => {
  boton.addEventListener("click", () => history.back());
});

// Cada vez que cambia el # (por un botón o por el "atrás"), mostrar la vista.
window.addEventListener("hashchange", mostrarVista);

// Al abrir la app, partir siempre en el inicio.
limpiarHash();


// =====================================================
// 9. VIGILAR CAMBIOS DE SESIÓN
// =====================================================
function actualizarSegunSesion(sesion) {
  if (!sesion) {
    idActual = null;
    desconectarTiempoReal();
    ocultarAviso();
    limpiarHash();
    mostrarVista();
    mostrarPantalla("login");
    return;
  }

  const id = sesion.user.id;

  // Solo preparamos todo si cambió la persona. Supabase también avisa cuando
  // renueva la sesión por dentro (cada cierto rato); sin este "if", el
  // formulario se borraría solo mientras alguien está escribiendo.
  if (id !== idActual) {
    idActual = id;
    textoSaludo.textContent = "Hola, " + nombreDe(id);
    llenarPagadores();
    reiniciarFormulario();
    cargarMovimientos();
    conectarTiempoReal();
  }
  mostrarPantalla("principal");
  mostrarVista();
}

cliente.auth.onAuthStateChange((_evento, sesion) => {
  actualizarSegunSesion(sesion);
});


// =====================================================
// 10. TIEMPO REAL: enterarse al instante de lo que anota el otro
// =====================================================
let canal = null;            // la "línea abierta" con Supabase
let temporizadorRecarga = null;

// Si llegan varios avisos seguidos (por ejemplo, borrar 3 cosas rápido),
// esperamos 300 ms y recargamos UNA sola vez en lugar de tres.
function pedirRecarga() {
  clearTimeout(temporizadorRecarga);
  temporizadorRecarga = setTimeout(cargarMovimientos, 300);
}

function conectarTiempoReal() {
  if (canal) return;         // ya estaba conectado: no abrir una segunda línea
  canal = cliente
    .channel("movimientos-en-vivo")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "movimientos" },  // "*" = insertar, editar o borrar
      () => pedirRecarga()
    )
    .subscribe();
}

function desconectarTiempoReal() {
  if (!canal) return;
  cliente.removeChannel(canal);
  canal = null;
}

// Plan B: los teléfonos "duermen" las apps en segundo plano y la línea
// puede cortarse. Cada vez que la app vuelve a la pantalla, recargamos.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && idActual) {
    pedirRecarga();
  }
});


// =====================================================
// 11. INSTALAR EL SERVICE WORKER (para que sea app instalable)
// =====================================================
// Solo funciona cuando la página está publicada (https), no al abrirla
// con doble clic desde el computador; por eso revisamos el protocolo.
if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("sw.js");
}
