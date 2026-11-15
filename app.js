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
const botonGuardar        = document.getElementById("boton-guardar");
const textoMensaje        = document.getElementById("mov-mensaje");

// --- Saldo y lista ---
const textoSaldo      = document.getElementById("saldo-texto");
const listaMov        = document.getElementById("lista-movimientos");
const textoNotaLista  = document.getElementById("lista-nota");

// --- Registro de borrados y aviso "Deshacer" ---
const listaBorrados         = document.getElementById("lista-borrados");
const textoCantidadBorrados = document.getElementById("cantidad-borrados");
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

// Ajusta lo que se ve en el formulario cada vez que algo cambia.
function actualizarFormulario() {
  const esPago   = valorElegido("tipo") === "pago";
  const division = valorElegido("division");
  const pagador  = selectPagador.value;
  const otro     = otroDe(pagador);

  // Mostrar u ocultar bloques
  bloqueDivision.classList.toggle("oculta", esPago);
  bloquePersonalizada.classList.toggle("oculta", esPago || division !== "personalizada");

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
  } else {
    textoResumen.textContent =
      `${nombreDe(otro)} queda debiendo ${formatoPesos(parte)} a ${nombreDe(pagador)}.`;
  }
}

// Deja el formulario como nuevo, con los valores por defecto.
function reiniciarFormulario() {
  formMov.reset();                    // vuelve a "Gasto" y "Mitad y mitad"
  inputFecha.value = hoy();
  selectPagador.value = idActual; // por defecto, pagó quien está usando la app
  actualizarFormulario();
}

// Mientras se escriben montos: poner puntos de miles y actualizar el resumen.
inputMonto.addEventListener("input", () => { formatearCampo(inputMonto); actualizarFormulario(); });
inputParte.addEventListener("input", () => { formatearCampo(inputParte); actualizarFormulario(); });

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

  mostrarMensaje("✓ Guardado", false);
  reiniciarFormulario();
  cargarMovimientos();      // para que el saldo y la lista muestren lo recién guardado
  setTimeout(() => mostrarMensaje("", false), 3000);   // borra el aviso a los 3 segundos
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

// Saldo desde el punto de vista de quien usa la app:
// positivo = el otro me debe; negativo = yo le debo.
function calcularSaldo(movimientos) {
  let saldo = 0;
  movimientos.forEach((m) => {
    if (m.pagado_por === idActual) {
      saldo += m.parte_otro;   // pagué yo: al otro le toca su parte
    } else {
      saldo -= m.parte_otro;   // pagó el otro: a mí me toca mi parte
    }
  });
  return saldo;
}

function mostrarSaldo(saldo) {
  const otro = nombreDe(otroDe(idActual));
  if (saldo > 0) {
    textoSaldo.textContent = `${otro} te debe ${formatoPesos(saldo)}`;
  } else if (saldo < 0) {
    textoSaldo.textContent = `Le debes ${formatoPesos(-saldo)} a ${otro}`;
  } else {
    textoSaldo.textContent = "Están a mano ✓";
  }
}

// Texto chico bajo la descripción: quién pagó y cómo se dividió.
function detalleDe(m) {
  const pagador = nombreDe(m.pagado_por);
  const otro    = nombreDe(otroDe(m.pagado_por));
  const fecha   = formatoFecha(m.fecha);

  if (m.tipo === "pago") return `${fecha} · ${pagador} le pagó a ${otro}`;
  if (m.division === "mitad") return `${fecha} · Pagó ${pagador} · Mitad y mitad`;
  if (m.division === "total") return `${fecha} · Pagó ${pagador} · Todo de ${otro}`;
  return `${fecha} · Pagó ${pagador} · Parte de ${otro}: ${formatoPesos(m.parte_otro)}`;
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

    mostrarSaldo(calcularSaldo(vigentes));   // ¡el saldo solo cuenta los vigentes!
    dibujarLista(vigentes);
    dibujarBorrados(borrados);
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
const SEGUNDOS_AVISO = 8;

function mostrarAvisoDeshacer(m) {
  movimientoRecienBorrado = m;
  textoAviso.textContent = `Se borró "${m.descripcion}"`;
  aviso.classList.remove("oculta");

  clearTimeout(temporizadorAviso);   // si había otro aviso, se reemplaza
  temporizadorAviso = setTimeout(ocultarAviso, SEGUNDOS_AVISO * 1000);
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
// 8. VIGILAR CAMBIOS DE SESIÓN
// =====================================================
function actualizarSegunSesion(sesion) {
  if (!sesion) {
    idActual = null;
    desconectarTiempoReal();
    ocultarAviso();
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
}

cliente.auth.onAuthStateChange((_evento, sesion) => {
  actualizarSegunSesion(sesion);
});


// =====================================================
// 9. TIEMPO REAL: enterarse al instante de lo que anota el otro
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
// 10. INSTALAR EL SERVICE WORKER (para que sea app instalable)
// =====================================================
// Solo funciona cuando la página está publicada (https), no al abrirla
// con doble clic desde el computador; por eso revisamos el protocolo.
if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("sw.js");
}
