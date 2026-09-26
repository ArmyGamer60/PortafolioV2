/* ====================================================================
   ZENITH — MÁQUINA DE ESTADOS DEL PORTAFOLIO
   Fuente de verdad única. JS plano, sin dependencias, sin DOM.
   Sirve igual al Design Component y a portafolio.php.

   REGLA 1  Un solo enum de estados, dos proyecciones:
              fase          → estado global de interacción (exclusiva)
              estadoDe(id)  → estado de UNA tarjeta (derivado de la fase)
   REGLA 2  La geometría NO se guarda. Se deriva de orden[categoria].
              Lo único mutable es el arreglo de ids.
   REGLA 3  Ningún consumidor guarda estado propio. Solo lee y despacha.

   BARAJA FÍSICA — distancia LINEAL, no cíclica.
   El ciclo por camino más corto obligaba a una tarjeta a teletransportarse
   de un extremo al otro en cada giro. Con distancia lineal (d = i - iAct)
   ninguna tarjeta salta nunca: todo movimiento es un deslizamiento corto.
   El abanico no se dispara porque los desplazamientos se COMPRIMEN
   geométricamente (serie con razón `compresion`), así que las posiciones
   lejanas se saturan y toda la baraja cabe siempre en cuadro.
   ==================================================================== */
(function (global) {
  "use strict";

  /* ---- Los seis estados. Aplican a UNA tarjeta. ---- */
  var ESTADO = {
    IDLE:          "IDLE",          // en reposo, ni activa ni apuntada
    HOVER:         "HOVER",          // puntero encima, no activa
    ACTIVE:        "ACTIVE",         // centrada en la composición
    SELECTING:     "SELECTING",      // intención confirmada, aún no se mueve
    TRANSITIONING: "TRANSITIONING",  // participa en el cambio en curso
    SETTLED:       "SETTLED"         // acaba de llegar; ventana de reposo
  };

  /* ---- Fase global. Exclusiva: solo una a la vez. ----
     IDLE ──puntero──▶ HOVER ──sale──▶ IDLE
     IDLE│HOVER ──intención──▶ SELECTING ──confirma──▶ TRANSITIONING
     TRANSITIONING ──fin──▶ SETTLED ──reposo──▶ IDLE
     ACTIVE no está aquí: es un ROL de tarjeta, no una fase. */
  var FASE = {
    IDLE:          "IDLE",
    HOVER:         "HOVER",
    SELECTING:     "SELECTING",
    TRANSITIONING: "TRANSITIONING",
    SETTLED:       "SETTLED"
  };

  /* ---- SISTEMA DE RANURAS ----
     Toda la composición se describe con UN entero por tarjeta: el rango.

            rango  -2   -1    0   +1   +2
                    │    │    │    │    │
                    └────┴──▲─┴────┴────┘
                            protagonista

     rango = índice de la tarjeta − índice del protagonista.
     Es lineal: no hay ciclo, así que ninguna tarjeta se teletransporta y
     el orden de la baraja nunca se rompe. El signo del rango ES la
     dirección: una tarjeta que va de +2 a 0 viaja hacia la izquierda.

     Las ranuras se SATURAN (serie geométrica de razón `compresion`), de
     modo que un rango ±5 sigue en cuadro, y el abanico se RECENTRA sobre
     el punto medio de sus extremos: elegir la tarjeta de una punta
     desplaza la baraja como un cuerpo rígido en vez de sacarla del marco.
     ---- */
  var GEOMETRIA = {
    paso:         112,  // px de la ranura ±1; las siguientes se comprimen
    caida:         14,  // px de arco en la ranura ±1
    giro:         3.8,  // grados de abanico en la ranura ±1
    escalaPaso: 0.040,  // reducción de escala en la ranura ±1
    opacidadPaso: 0.055,// atenuación en la ranura ±1 (nunca llega a 0)
    compresion:  0.85,  // razón de la serie: <1 satura el abanico
    anillo:     false,  // true: las demás se reparten alrededor de la elegida
    recentrar:   true,  // corrige la traslación cuando un extremo no cabe
    limite:         0,  // semiancho disponible en px (0 = sin corrección)
    margen:        10,  // holgura que se respeta en cada borde
    desvio:       1.7,  // grados de inclinación propia e invariable por tarjeta
    pivote:      "50% 100%", // rota desde el borde inferior: bases alineadas
    /* protagonista: ranura 0, avanza al frente */
    protaEscala:  0.05,
    protaAlzado:    12, // px hacia arriba
    protaEndereza: 0.35,// se endereza parcialmente al salir de la baraja
    retroEscala: 0.012, // las no protagonistas retroceden un poco
    retroAlzado:     4,
    /* hover: se SUMA al rol, nunca lo reemplaza. Casi imperceptible.
       Sobre la protagonista se aplica atenuado (ya viene adelantada). */
    hoverAlzado:     5,
    hoverEscala: 0.022,
    hoverFactorProta: 0.5,
    /* pulso táctil: vive en su PROPIA capa (un div interno), así que
       multiplica el movimiento espacial en vez de competir con él.
       1 → 0.985 (presión) → 1.018 (rebote breve) → 1 */
    pulsoPresion: 0.985,
    pulsoRebote:  1.018,
    /* borde y contraste: también interpolan */
    borde:       0.12,  // alfa del borde en reposo
    bordeProta:  0.17,
    bordeHover:  0.21,
    brillo:      1.00,  // filtro en reposo
    brilloHover: 1.045,
    contraste:   1.00,
    contrasteHover: 1.03,
    /* orden de pintado */
    zBase:        100,
    zPaso:          4,
    zProta:       140,
    zSaliente:    130,  // el que abandona el centro se retira POR ENCIMA
    /* ---- variantes de categoría (Marketing / Branding / Software) ----
       Mismo álgebra de rangos que las tarjetas, aplicada al CONTENEDOR:
       rango = índice del panel − índice del panel activo. El signo da la
       dirección de entrada y de salida. */
    /* contenido interno de la tarjeta protagonista */
    contEntraX:    14,  // px laterales desde los que entra, EN EL SENTIDO del viaje
    contEntraY:     6,  // px verticales (menor que el lateral: deriva, no slide)
    contSaleX:     12,
    contSaleY:      8,  // px que sube el texto que se va
    contIdle:    0.74,  // presencia del texto en una tarjeta no protagonista
    /* entrada de las tarjetas internas de cada categoría */
    hijoEntraX:    10,  // px laterales según la dirección del cambio de panel
    hijoAlzado:    12,  // px desde los que sube al entrar
    hijoEscala: 0.982,  // escala de partida
    hijoSalidaY:    6,  // px que cede al salir
    /* selección de una tarjeta interna */
    hijoSelEscala: 0.022,
    hijoSelAlzado:     6,
    hijoAtenuaEscala: 0.012,
    hijoAtenuaOpacidad: 0.55,
    hijoHoverEscala: 0.008,
    hijoHoverAlzado:     4,
    panelPaso:     86,  // px de desplazamiento por rango
    panelEscala: 0.055  // reducción de escala por rango
  };

  /* ---- TEMAS DE CATEGORÍA ----
     El acento es una PROPIEDAD de la categoría, no del componente. Cada
     tema publica su rgb y el consumidor solo compone cadenas; añadir una
     categoría = añadir una entrada aquí. Tonos desaturados a propósito:
     líneas finas de luz, no neón. */
  var TEMAS = {
    contenido: { rgb: "139,149,236", nombre: "índigo",  icono: "◐" },
    marketing: { rgb: "122,168,152", nombre: "teal",    icono: "◇" },
    branding:  { rgb: "198,170,116", nombre: "dorado",  icono: "◈" },
    software:  { rgb: "150,140,214", nombre: "violeta", icono: "◉" }
  };

  /* alfas de la línea por estado. La escala es común a todas las
     categorías, así que ninguna se ve más fuerte que otra por accidente. */
  var LINEA = {
    IDLE:          0.13,
    HOVER:         0.26,
    ACTIVE:        0.42,
    SELECTING:     0.30,
    TRANSITIONING: 0.34,
    SETTLED:       0.42
  };

  var HALO = { IDLE: 0, HOVER: 0.05, ACTIVE: 0.09, SELECTING: 0.06,
               TRANSITIONING: 0.07, SETTLED: 0.09 };

  /* tema resuelto: rgb crudo + colores ya compuestos por estado */
  function tema(cat) {
    var t = TEMAS[cat] || TEMAS.contenido;
    var rgba = function (a) { return "rgba(" + t.rgb + "," + a + ")"; };
    return {
      id: cat, rgb: t.rgb, nombre: t.nombre, icono: t.icono, rgba: rgba,
      acento: rgba(0.95),
      linea: { idle: rgba(LINEA.IDLE), hover: rgba(LINEA.HOVER), activo: rgba(LINEA.ACTIVE) },
      lineaDe: function (e) { return rgba(LINEA[e] != null ? LINEA[e] : LINEA.IDLE); },
      haloDe:  function (e) { return rgba(HALO[e]  != null ? HALO[e]  : 0); }
    };
  }

  var TIEMPOS = {
    seleccion:    0,   // ms en SELECTING antes de mover (0 = inmediato)
    transicion: 780,   // ms de TRANSITIONING (red de seguridad: dur + escalonado)
    asentado:   170,   // ms de SETTLED antes de volver a IDLE
    /* los consume el consumidor para construir la transición CSS */
    movimiento: 560,   // duración base del reacomodo
    saltoExtra:  45,   // ms más por cada ranura que recorre la baraja
    saltoTecho:   3,   // a partir de este salto la duración deja de crecer
    escalonado:  18,   // retardo por ranura de distancia al centro
    escalonMax:  54,   // techo del retardo
    reaccion:   300,   // duración de hover / presión
    presion:    110,   // duración de la compresión al presionar
    rebote:     170,   // duración del rebote y del regreso a 1
    curva:      "cubic-bezier(0.16, 1, 0.3, 1)",
    curvaCorta: "cubic-bezier(0.22, 0.85, 0.24, 1)",
    curvaPresion: "cubic-bezier(0.4, 0, 0.6, 1)",
    curvaRebote:  "cubic-bezier(0.3, 0.7, 0.3, 1)",
    /* variantes de categoría */
    panel:        700, // ms de la conmutación entre variantes
    panelEntrada:  45, // ms de retardo del panel que entra: la salida lidera
    panelAsentado: 90,
    /* tarjetas internas: el contenedor lidera, las tarjetas siguen */
    hijoEntrada:  460, // ms de la entrada de cada tarjeta
    hijoSalida:   240, // ms de la salida (más rápida: despeja el paso)
    hijoStagger:   60, // ms entre tarjeta y tarjeta
    hijoBase:      90, // ms desde que arranca el panel hasta la primera
    hijoStaggerMax: 360,
    hijoSeleccion: 420, // ms del borde/sombra al seleccionar una tarjeta interna
    hijoExpandir: 560, // ms del despliegue del detalle
    hijoContraer: 380,
    /* contenido interno: entra DESPUÉS de que la tarjeta arranca */
    contEntrada:  300,
    contSalida:   190,
    contStagger:   40, // ms entre categoría → metadata → título
    retrasoTrasero: 14 // ms extra para las tarjetas que quedan a la cola del giro
  };

  /* ---- prefers-reduced-motion ----
     No se apagan las animaciones a medias: se anulan los DESPLAZAMIENTOS de
     entrada/salida y las duraciones bajan al mínimo, conservando intacta la
     composición estática (abanico, ranuras, temas, jerarquía). */
  function reducirMovimiento(geo, tiempos) {
    ["contEntraX", "contEntraY", "contSaleX", "contSaleY", "hijoEntraX",
     "hijoAlzado", "hijoSalidaY", "hoverAlzado", "hijoHoverAlzado"].forEach(function (k) {
      geo[k] = 0;
    });
    geo.pulsoPresion = 1;
    geo.pulsoRebote = 1;
    ["saltoExtra", "reaccion", "presion", "rebote", "panelEntrada",
     "hijoEntrada", "hijoSalida", "hijoStagger", "hijoBase", "hijoStaggerMax",
     "hijoExpandir", "hijoContraer", "contEntrada", "contSalida",
     "contStagger", "escalonado", "escalonMax", "retrasoTrasero",
     "hijoSeleccion"].forEach(function (k) {
      tiempos[k] = 0;
    });
    tiempos.movimiento = 1;
    tiempos.panel = 1;
    tiempos.transicion = 60;
    return { geo: geo, tiempos: tiempos };
  }

  function prefiereMenosMovimiento() {
    return typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;
  }

  function mezclar(base, extra) {
    var r = {}, k;
    for (k in base) if (base.hasOwnProperty(k)) r[k] = base[k];
    for (k in extra || {}) if (extra.hasOwnProperty(k)) r[k] = extra[k];
    return r;
  }

  function signo(n) { return n > 0 ? 1 : n < 0 ? -1 : 0; }

  /* Suma geométrica: paso·(1 + k + k² + … + k^(abs-1)).
     Crece rápido cerca del centro y se satura al alejarse: abanico de mano. */
  function serie(paso, abs, k) {
    if (!abs) return 0;
    if (k === 1) return paso * abs;
    return paso * (1 - Math.pow(k, abs)) / (1 - k);
  }

  /* ==================================================================
     crearRanuras(geo) → función PURA rango → geometría de la ranura.
     Reutilizable: cualquier grupo de tarjetas (hoy Contenido, mañana
     Marketing/Branding/Software) puede pedir sus ranuras con otra
     geometría sin duplicar una línea de esta matemática.
     ================================================================== */
  function crearRanuras(geo) {
    var k = geo.compresion;
    return function ranura(rango) {
      var abs = Math.abs(rango);
      var sg = signo(rango);
      return {
        rango:       rango,
        x:           sg * serie(geo.paso, abs, k),
        y:           serie(geo.caida, abs, k),
        rotacion:    sg * serie(geo.giro, abs, k),
        escala:      1 - serie(geo.escalaPaso, abs, k),
        opacidad:    1 - serie(geo.opacidadPaso, abs, k),
        profundidad: geo.zBase - abs * geo.zPaso
      };
    };
  }

  /* Inclinación propia de cada tarjeta: determinista por id, nunca cambia.
     Es lo que hace que las rotaciones sean DISTINTAS entre sí y se
     conserven aunque la tarjeta cambie de posición. */
  function semilla(id) {
    var h = 0;
    for (var i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 100000;
    return (h % 1000) / 1000;
  }

  /* ==================================================================
     crearMaquina({ proyectos, categorias, categoria, geometria, tiempos })
     proyectos:  [{ id, nombre, red, formato, categoria }]
     categorias: [{ id, etiqueta }]
     ================================================================== */
  function crearMaquina(cfg) {
    cfg = cfg || {};

    var proyectos  = cfg.proyectos  || [];
    var categorias = cfg.categorias || [];
    var geo        = mezclar(GEOMETRIA, cfg.geometria);
    var tiempos    = mezclar(TIEMPOS,   cfg.tiempos);
    var reducido   = cfg.reducido != null ? cfg.reducido : prefiereMenosMovimiento();
    if (reducido) reducirMovimiento(geo, tiempos);

    /* índice por id: lectura O(1), nunca se muta */
    var porId = {};
    proyectos.forEach(function (p) { porId[p.id] = p; });

    var ranura = crearRanuras(geo);

    /* inclinación invariable, calculada una sola vez por tarjeta */
    var inclinacion = {};
    proyectos.forEach(function (p) {
      inclinacion[p.id] = (semilla(p.id) * 2 - 1) * geo.desvio;
    });

    /* ---- ÚNICO DATO MUTABLE DE COMPOSICIÓN ----
       orden[categoria] = [id, id, …]  ← el índice en este arreglo ES la
       posición en la composición. Intercambiar posiciones = mover ids aquí. */
    var orden = {};
    categorias.forEach(function (c) {
      orden[c.id] = proyectos
        .filter(function (p) { return p.categoria === c.id; })
        .map(function (p) { return p.id; });
    });

    var s = {
      fase:       FASE.IDLE,
      /* categoria = qué resalta el índice. baraja = de qué categoría son las
         tarjetas del abanico. Son preguntas distintas: separarlas evita que
         resaltar Branding recomponga la baraja de Contenido. */
      categoria:  cfg.categoria || (categorias[0] && categorias[0].id) || null,
      baraja:     cfg.baraja || cfg.categoria || (categorias[0] && categorias[0].id) || null,
      /* variantes de categoría que comparten un mismo escenario */
      variantes:  cfg.variantes || [],
      panel:      (cfg.variantes || [])[0] || null,
      panelPrevio: null,
      panelFase:  FASE.IDLE,
      panelSalto: 0,
      /* selección dentro de un panel: pequeña → seleccionada → expandida */
      hijoSel:    null,
      hijoFase:   FASE.IDLE,   // IDLE · ACTIVE (seleccionada) · SETTLED (expandida)
      hijoHover:  null,
      activo:     null,   // id centrado
      previo:     null,   // id que estaba centrado antes (anterior en el TIEMPO)
      hover:      null,   // id apuntado
      candidato:  null,   // id con intención de selección (fase SELECTING)
      origen:     null,   // id que sale del centro en la transición en curso
      destino:    null,   // id que entra al centro
      direccion:  0,      // -1 atrás · 0 ninguna · +1 adelante
      salto:      0,      // ranuras que recorre la baraja en la transición
      rebote:     null,   // id en el instante de rebote del pulso táctil
      ciclo:      0       // contador de transiciones completadas
    };
    s.activo = (orden[s.baraja] || [])[0] || null;

    var oyentes = [];
    var relojes = { seleccion: null, transicion: null, asentado: null, rebote: null,
                    panel: null, panelAsentado: null };

    function avisar() {
      for (var i = 0; i < oyentes.length; i++) oyentes[i](s);
    }
    function fijar(parche) {
      var cambio = false, k;
      for (k in parche) if (s[k] !== parche[k]) { s[k] = parche[k]; cambio = true; }
      if (cambio) avisar();
    }
    function limpiar() {
      for (var k in relojes) if (relojes[k]) { clearTimeout(relojes[k]); relojes[k] = null; }
    }

    /* ---------------- SELECTORES (nada de esto se guarda) ------------- */

    function lista() { return orden[s.baraja] || []; }

    /* RANGO: la única coordenada de la composición.
       `anillo: false` → lineal: el orden nunca se rompe, pero al elegir un
       extremo todas las demás quedan de un solo lado.
       `anillo: true`  → las demás se REPARTEN alrededor de la elegida por el
       camino más corto. El precio es que la carta del extremo opuesto cruza
       al otro lado: es la más ocluida y de menor opacidad del abanico. */
    function distancia(id) {
      var l = lista(), n = l.length;
      var i = l.indexOf(id), a = l.indexOf(s.activo);
      if (i < 0 || a < 0) return 0;
      var d = i - a;
      if (!geo.anillo || n < 3) return d;
      var arriba = Math.floor(n / 2);          // ranuras a la derecha
      var abajo = n - 1 - arriba;              // ranuras a la izquierda
      while (d > arriba) d -= n;
      while (d < -abajo) d += n;
      return d;
    }

    /* La ranura 0 ES el centro, sin excepciones: el protagonista siempre
       queda en x = 0 y el abanico nunca se traslada. */
    function recentrado() { return 0; }

    /* ---- COMPRESIÓN ASIMÉTRICA POR LADO ----
       Cada lado tiene un número distinto de tarjetas según dónde esté el
       protagonista. En vez de mover el abanico (que descolocaba la ranura 0),
       el lado cargado se comprime lo justo para caber en `limite`; el lado
       ligero conserva el paso completo. El factor solo cambia cuando cambia
       el protagonista —justo cuando las tarjetas ya están viajando—, así que
       la interpolación sigue siendo continua.
       `limite` = 0 desactiva la corrección (protagonista centrado igual). */
    function factorLado(cuantas) {
      if (!geo.limite || cuantas < 1) return 1;
      var extension = serie(geo.paso, cuantas, geo.compresion) + geo.margen;
      return extension > geo.limite ? geo.limite / extension : 1;
    }

    function factores() {
      var l = lista(), n = l.length;
      var a = l.indexOf(s.activo);
      if (a < 0) return { izq: 1, der: 1 };
      /* con `anillo` el reparto es fijo (la elegida siempre al centro), así
         que el factor no cambia nunca y el movimiento es del todo continuo */
      var der = geo.anillo && n >= 3 ? Math.floor(n / 2) : n - 1 - a;
      var izq = geo.anillo && n >= 3 ? n - 1 - Math.floor(n / 2) : a;
      return { izq: factorLado(izq), der: factorLado(der) };
    }

    /* Los SEIS estados, resueltos por prioridad. Única definición. */
    function estadoDe(id) {
      if (s.fase === FASE.TRANSITIONING && (id === s.origen || id === s.destino)) return ESTADO.TRANSITIONING;
      if (s.fase === FASE.SETTLED       && id === s.activo)                       return ESTADO.SETTLED;
      if (s.fase === FASE.SELECTING     && id === s.candidato)                    return ESTADO.SELECTING;
      if (id === s.activo)                                                        return ESTADO.ACTIVE;
      if (id === s.hover)                                                         return ESTADO.HOVER;
      return ESTADO.IDLE;
    }

    function enTransicion() {
      return s.fase === FASE.SELECTING || s.fase === FASE.TRANSITIONING;
    }

    /* Cada tarjeta lee su ranura por rango y le suma únicamente lo que
       depende de su ROL (protagonista, apuntada, presionada). Todo es
       interpolable: x, y, rotación, escala, opacidad, sombra y z.
       Nada produce opacidad 0 y ningún índice cambia: nada desaparece. */
    function composicion() {
      var moviendo = s.fase === FASE.TRANSITIONING || s.fase === FASE.SETTLED;
      var fac = factores();
      var salto = Math.abs(s.salto);
      var duracion = moviendo
        ? tiempos.movimiento + Math.min(salto, tiempos.saltoTecho) * tiempos.saltoExtra
        : tiempos.reaccion;

      return lista().map(function (id, i) {
        var rango = distancia(id);
        var abs = Math.abs(rango);
        var r = ranura(rango);

        var protagonista = id === s.activo;
        /* la reacción al puntero se suspende mientras la baraja se reacomoda:
           dos movimientos compitiendo se leen como tirón */
        var apuntada   = id === s.hover && !enTransicion();
        var presionada = id === s.candidato && s.fase === FASE.SELECTING;

        /* solo la posición se comprime; escala, giro y opacidad de la ranura
           se conservan, así que la lectura del abanico no cambia */
        var x = r.x * (rango < 0 ? fac.izq : fac.der);
        var y = r.y;
        var escala = r.escala;
        var rot = r.rotacion + inclinacion[id];
        var borde = geo.borde;
        var brillo = geo.brillo;
        var contraste = geo.contraste;
        var sombraAlcance = 20 + abs * 5;
        var sombraDifusion = 44 + abs * 9;
        var sombraAlfa = 0.44;

        if (protagonista) {
          y -= geo.protaAlzado;
          escala += geo.protaEscala;
          rot *= 1 - geo.protaEndereza;   // se endereza, conserva su sesgo
          borde = geo.bordeProta;
          sombraAlfa = 0.58;
        } else {
          y += geo.retroAlzado;
          escala -= geo.retroEscala;
        }
        /* el hover se SUMA: la protagonista sigue siendo protagonista */
        if (apuntada) {
          var f = protagonista ? geo.hoverFactorProta : 1;
          y -= geo.hoverAlzado * f;
          escala += geo.hoverEscala * f;
          borde = Math.max(borde, geo.bordeHover);
          brillo = geo.brilloHover;
          contraste = geo.contrasteHover;
          sombraAlcance += 7;
          sombraDifusion += 16;
          sombraAlfa += 0.09;
        }
        /* pulso táctil: capa propia, independiente del reacomodo espacial */
        var pulso = 1, pulsoDur = tiempos.rebote, pulsoCurva = tiempos.curvaRebote;
        if (presionada) {
          pulso = geo.pulsoPresion;
          pulsoDur = tiempos.presion;
          pulsoCurva = tiempos.curvaPresion;
        } else if (id === s.rebote) {
          pulso = geo.pulsoRebote;
        }

        var z = r.profundidad;
        if (protagonista) z = geo.zProta;
        else if (s.fase === FASE.TRANSITIONING && id === s.origen) z = geo.zSaliente;

        return {
          id:          id,
          proyecto:    porId[id],
          indice:      i,                       // posición en orden[]
          rango:       rango,                   // ranura ocupada: −2 −1 0 +1 +2
          distancia:   rango,                   // alias histórico
          posicion:    { x: x, y: y },
          rotacion:    rot,
          inclinacion: inclinacion[id],         // parte invariable de la rotación
          escala:      escala,
          profundidad: z,                       // z-index
          opacidad:    r.opacidad,
          borde:       borde,
          brillo:      brillo,
          contraste:   contraste,
          apuntada:    apuntada,
          presionada:  presionada,
          pulso:       pulso,
          pulsoDuracion: pulsoDur,
          pulsoCurva:  pulsoCurva,
          sombra:      { alcance: sombraAlcance, difusion: sombraDifusion, alfa: sombraAlfa },
          pivote:      geo.pivote,
          interactivo: true,                    // nunca se apagan los eventos
          moviendo:    moviendo,
          duracion:    duracion,                // crece con el salto de la baraja
          /* la onda del reacomodo avanza EN EL SENTIDO del giro: las tarjetas
             que quedan a la cola arrancan unos ms después. La que abandona el
             centro no espera: sale a la vez que entra el relevo. */
          retardo:     protagonista || id === s.origen || !moviendo ? 0
            : Math.min(abs * tiempos.escalonado, tiempos.escalonMax)
              + (s.direccion && signo(rango) === -s.direccion ? tiempos.retrasoTrasero : 0),
          protagonista: protagonista,
          /* el texto no es independiente: su retardo se mide sobre el propio
             movimiento de la tarjeta, así que primero se mueve y después
             su información toma protagonismo */
          contenido:   contenidoDe(id, protagonista),
          estado:      estadoDe(id)
        };
      });
    }

    /* Capa de contenido de UNA tarjeta. `orden` escalona categoría (0),
       metadata (1) y título (2) con 40ms entre sí.
       La DIRECCIÓN decide de qué lado entra y hacia dónde sale: el texto
       nuevo llega desde el lado por el que vino su tarjeta, y el viejo se
       va hacia donde su tarjeta se retira. A → B y B → A no se parecen. */
    function contenidoDe(id, protagonista) {
      var saliendo = s.fase === FASE.TRANSITIONING && id === s.origen;
      var dir = s.direccion || 1;
      if (saliendo) {
        /* el texto viejo lidera la salida: se va antes de que la tarjeta llegue,
           hacia el lado opuesto al que vino el relevo */
        return {
          opacidad: 0, x: -dir * geo.contSaleX, y: -geo.contSaleY,
          duracion: tiempos.contSalida,
          curva: tiempos.curvaCorta,
          retardoDe: function () { return 0; }
        };
      }
      if (protagonista) {
        /* mientras la tarjeta viaja, su texto espera desplazado hacia su lado
           de origen; al aterrizar (SETTLED) entra escalonado. El texto nunca
           se adelanta al movimiento: depende de él, no de un reloj propio. */
        if (s.fase === FASE.TRANSITIONING) {
          return {
            opacidad: 0, x: dir * geo.contEntraX, y: geo.contEntraY,
            duracion: tiempos.contSalida,
            curva: tiempos.curvaCorta,
            retardoDe: function () { return 0; }
          };
        }
        return {
          opacidad: 1, x: 0, y: 0,
          duracion: tiempos.contEntrada,
          curva: tiempos.curva,
          retardoDe: function (orden) { return orden * tiempos.contStagger; }
        };
      }
      return {
        opacidad: geo.contIdle, x: 0, y: 0,
        duracion: tiempos.contEntrada,
        curva: tiempos.curvaCorta,
        retardoDe: function () { return 0; }
      };
    }

    /* vecinos EN LA COMPOSICIÓN (cíclico solo para navegar, no para pintar) */
    function vecinos() {
      var l = lista(), n = l.length;
      if (!n) return { anterior: null, siguiente: null };
      var a = l.indexOf(s.activo);
      return {
        anterior:  l[(a - 1 + n) % n],
        siguiente: l[(a + 1) % n]
      };
    }

    function categoriaActiva() {
      return categorias.filter(function (c) { return c.id === s.categoria; })[0] || null;
    }

    /* ------------------------- ACCIONES ------------------------------ */

    /* puntero encima. No pisa una transición en curso. */
    function apuntar(id) {
      if (enTransicion()) { fijar({ hover: id }); return; }
      fijar({ hover: id, fase: id ? FASE.HOVER : FASE.IDLE });
    }
    function soltar() {
      if (enTransicion()) { fijar({ hover: null }); return; }
      fijar({ hover: null, fase: FASE.IDLE });
    }

    /* intención de selección (mousedown / focus / touchstart) */
    function seleccionar(id) {
      if (enTransicion() || id === s.activo || lista().indexOf(id) < 0) return;
      fijar({ fase: FASE.SELECTING, candidato: id });
      if (tiempos.seleccion > 0) {
        relojes.seleccion = setTimeout(function () { confirmar(id); }, tiempos.seleccion);
      }
    }
    function cancelarSeleccion() {
      if (s.fase !== FASE.SELECTING) return;
      limpiar();
      fijar({ fase: s.hover ? FASE.HOVER : FASE.IDLE, candidato: null });
    }

    /* confirma el cambio de tarjeta activa: única puerta de entrada
       a TRANSITIONING. girar() pasa por aquí. */
    function confirmar(id, dirForzada) {
      if (s.fase === FASE.TRANSITIONING || id === s.activo || lista().indexOf(id) < 0) return;
      limpiar();
      var l = lista();
      /* salto = ranuras que recorre TODA la baraja. Es el mismo número para
         cada tarjeta (rango_antes − rango_después), así que un solo valor
         describe el movimiento completo y de él sale la duración. */
      var salto = distancia(id);
      var dir = typeof dirForzada === "number" ? dirForzada : signo(salto);
      var saliendo = s.activo;
      fijar({
        fase:      FASE.TRANSITIONING,
        origen:    saliendo,
        destino:   id,
        previo:    saliendo,
        activo:    id,          // cambia YA: la geometría interpola desde aquí
        direccion: dir,
        salto:     salto,
        rebote:    id,
        candidato: null
      });
      relojes.rebote = setTimeout(function () { fijar({ rebote: null }); }, tiempos.rebote);
      relojes.transicion = setTimeout(finalizarTransicion, tiempos.transicion);
    }

    /* fin del movimiento. El consumidor lo llama desde transitionend;
       el reloj de arriba queda solo como red de seguridad. */
    function finalizarTransicion() {
      if (s.fase !== FASE.TRANSITIONING) return;
      limpiar();
      fijar({ fase: FASE.SETTLED, ciclo: s.ciclo + 1 });
      relojes.asentado = setTimeout(asentar, tiempos.asentado);
    }

    /* vuelta al reposo */
    function asentar() {
      limpiar();
      fijar({
        fase:      s.hover ? FASE.HOVER : FASE.IDLE,
        origen:    null,
        destino:   null,
        direccion: 0,
        salto:     0
      });
    }

    /* navegación relativa: ±1 posición. Con `anillo` da la vuelta;
       sin él se detiene en los extremos, como una baraja finita. */
    function girar(dir) {
      var l = lista(), n = l.length;
      if (!n || s.fase === FASE.TRANSITIONING) return;
      var a = l.indexOf(s.activo);
      var siguiente = a + dir;
      if (geo.anillo) siguiente = ((siguiente % n) + n) % n;
      else if (siguiente < 0 || siguiente >= n) return;
      confirmar(l[siguiente], signo(dir));
    }

    function puedeGirar(dir) {
      var l = lista();
      if (geo.anillo) return l.length > 1;
      var siguiente = l.indexOf(s.activo) + dir;
      return siguiente >= 0 && siguiente < l.length;
    }

    /* ---- VARIANTES DE CATEGORÍA ----
       Los tres paneles ocupan la MISMA celda y nunca se desmontan: pasan de
       un rango a otro interpolando posición, escala y opacidad. El que sale
       pierde protagonismo mientras el que entra lo gana, a la vez. */
    function panelRango(id) {
      var i = s.variantes.indexOf(id), a = s.variantes.indexOf(s.panel);
      if (i < 0 || a < 0) return 0;
      return i - a;
    }

    function composicionPaneles() {
      var moviendo = s.panelFase === FASE.TRANSITIONING;
      return s.variantes.map(function (id) {
        var rango = panelRango(id);
        var abs = Math.abs(rango);
        var activo = rango === 0;
        var saliendo = moviendo && id === s.panelPrevio;
        var est = activo
          ? (moviendo ? ESTADO.TRANSITIONING : ESTADO.ACTIVE)
          : saliendo ? ESTADO.TRANSITIONING : ESTADO.IDLE;
        var th = tema(id);
        return {
          id:        id,
          rango:     rango,
          tema:      th,
          /* la línea del panel: discreta en IDLE, clara en ACTIVE */
          linea:     th.lineaDe(est),
          lineaHover: th.linea.hover,
          halo:      th.haloDe(est),
          activo:    activo,
          saliendo:  saliendo,
          /* el signo del rango ES la dirección: a la derecha del activo
             entra/sale por la derecha, a la izquierda por la izquierda */
          x:         rango * geo.panelPaso,
          escala:    1 - abs * geo.panelEscala,
          opacidad:  activo ? 1 : 0,
          profundidad: activo ? 20 : saliendo ? 15 : 10,
          interactivo: activo,
          duracion:  tiempos.panel,
          retardo:   activo ? tiempos.panelEntrada : 0,
          estado:    est
        };
      });
    }

    /* Entrada/salida de UNA tarjeta interna de un panel.
       El contenedor lidera; las tarjetas siguen en cascada de 60ms.
       La salida no escalona: el panel que se va despeja el paso como
       bloque, para que las dos composiciones no se mezclen. */
    function hijo(panelId, i, id) {
      var activo = panelId === s.panel;
      var saliendo = s.panelFase === FASE.TRANSITIONING && panelId === s.panelPrevio;
      var base;
      var dirP = s.panelSalto > 0 ? 1 : s.panelSalto < 0 ? -1 : 0;
      if (activo) {
        base = {
          opacidad: 1, x: 0, y: 0, escala: 1,
          duracion: tiempos.hijoEntrada,
          retardo: tiempos.panelEntrada + tiempos.hijoBase +
                   Math.min(i * tiempos.hijoStagger, tiempos.hijoStaggerMax),
          curva: tiempos.curva,
          estado: s.panelFase === FASE.TRANSITIONING ? ESTADO.TRANSITIONING : ESTADO.ACTIVE
        };
      } else if (saliendo) {
        /* sale hacia el lado contrario al que llega la nueva categoría */
        base = {
          opacidad: 0, x: -dirP * geo.hijoEntraX, y: geo.hijoSalidaY, escala: geo.hijoEscala,
          duracion: tiempos.hijoSalida, retardo: 0,
          curva: tiempos.curvaCorta, estado: ESTADO.TRANSITIONING
        };
      } else {
        /* en reposo, fuera de cuadro: preparado para entrar desde su lado */
        base = {
          opacidad: 0, x: (panelRango(panelId) > 0 ? 1 : -1) * geo.hijoEntraX,
          y: geo.hijoAlzado, escala: geo.hijoEscala,
          duracion: 0, retardo: 0, curva: tiempos.curvaCorta, estado: ESTADO.IDLE
        };
      }

      /* ---- capa de selección: solo dentro del panel activo ---- */
      var th = tema(panelId);
      var hay = activo && s.hijoSel != null;
      var sel = hay && id != null && id === s.hijoSel;
      var expandida = sel && s.hijoFase === FASE.SETTLED;
      var atenuada = hay && !sel;
      var apuntada = activo && id != null && id === s.hijoHover && !sel;

      base.seleccionada = !!sel;
      base.expandida = !!expandida;
      base.atenuada = !!atenuada;

      if (sel) {
        base.escala = 1 + (expandida ? geo.hijoSelEscala * 0.4 : geo.hijoSelEscala);
        base.y = -(expandida ? geo.hijoSelAlzado * 0.5 : geo.hijoSelAlzado);
        base.x = 0;
        base.estado = expandida ? ESTADO.SETTLED : ESTADO.ACTIVE;
      } else if (atenuada && base.opacidad === 1) {
        base.escala = 1 - geo.hijoAtenuaEscala;
        base.opacidad = geo.hijoAtenuaOpacidad;
      } else if (apuntada && base.opacidad === 1) {
        base.escala = 1 + geo.hijoHoverEscala;
        base.y = -geo.hijoHoverAlzado;
        base.estado = ESTADO.HOVER;
      }

      /* borde, halo y profundidad: interpolan con el mismo tema */
      base.linea = th.lineaDe(sel ? (expandida ? "SETTLED" : "ACTIVE")
                                  : apuntada ? "HOVER" : "IDLE");
      base.halo = th.haloDe(sel ? "ACTIVE" : apuntada ? "HOVER" : "IDLE");
      base.sombra = sel ? (expandida ? 0.4 : 0.34) : atenuada ? 0.16 : 0.22;
      base.profundidad = sel ? 30 : apuntada ? 20 : 10;
      /* el detalle se despliega DENTRO de la tarjeta: 0fr → 1fr */
      base.detalle = {
        filas: expandida ? "1fr" : "0fr",
        opacidad: expandida ? 1 : 0,
        y: expandida ? 0 : -6,
        duracion: expandida ? tiempos.hijoExpandir : tiempos.hijoContraer,
        retardo: expandida ? 60 : 0
      };
      return base;
    }

    /* pequeña → seleccionada → expandida. Un solo camino, sin modal. */
    function elegirHijo(id) {
      if (s.hijoSel !== id) { fijar({ hijoSel: id, hijoFase: "ACTIVE" }); return; }
      fijar({ hijoFase: s.hijoFase === FASE.SETTLED ? "ACTIVE" : FASE.SETTLED });
    }
    function cerrarHijo() { fijar({ hijoSel: null, hijoFase: FASE.IDLE, hijoHover: null }); }
    function apuntarHijo(id) { fijar({ hijoHover: id }); }

    /* conmuta la variante visible. También resalta su pestaña en el índice. */
    function irPanel(id) {
      if (s.variantes.indexOf(id) < 0 || id === s.panel) { irCategoria(id); return; }
      if (relojes.panel) clearTimeout(relojes.panel);
      if (relojes.panelAsentado) clearTimeout(relojes.panelAsentado);
      fijar({
        panelPrevio: s.panel,
        panelSalto:  s.variantes.indexOf(id) - s.variantes.indexOf(s.panel),
        panel:       id,
        categoria:   id,
        hijoSel:     null,
        hijoFase:    FASE.IDLE,
        hijoHover:   null,
        panelFase:   FASE.TRANSITIONING
      });
      relojes.panel = setTimeout(function () {
        fijar({ panelFase: FASE.SETTLED });
        relojes.panelAsentado = setTimeout(function () {
          fijar({ panelFase: FASE.IDLE, panelPrevio: null, panelSalto: 0 });
        }, tiempos.panelAsentado);
      }, tiempos.panel + tiempos.panelEntrada);
    }

    /* resalta una categoría en el índice. NO toca la baraja ni los paneles. */
    function irCategoria(cat) {
      if (cat === s.categoria) return;
      fijar({ categoria: cat });
    }

    /* cambia de qué categoría son las tarjetas del abanico */
    function irBaraja(cat) {
      if (!orden[cat] || cat === s.baraja) return;
      limpiar();
      s.baraja = cat;
      fijar({
        fase:      FASE.IDLE,
        activo:    orden[cat][0] || null,
        previo:    null,
        hover:     null,
        candidato: null,
        origen:    null,
        destino:   null,
        direccion: 0,
        salto:     0,
        rebote:    null
      });
      avisar();
    }

    /* INTERCAMBIO DE POSICIONES — base de las animaciones futuras.
       Muta solo orden[]; toda la geometría se recalcula sola. */
    function intercambiar(idA, idB) {
      var l = lista();
      var a = l.indexOf(idA), b = l.indexOf(idB);
      if (a < 0 || b < 0 || a === b) return;
      l[a] = idB; l[b] = idA;
      avisar();
    }

    /* mueve una tarjeta a un índice concreto de la composición */
    function reubicar(id, indice) {
      var l = lista();
      var i = l.indexOf(id);
      if (i < 0 || indice < 0 || indice >= l.length || i === indice) return;
      l.splice(i, 1);
      l.splice(indice, 0, id);
      avisar();
    }

    /* ------------------------- LECTURA ------------------------------- */

    function instantanea() {
      var v = vecinos();
      return {
        fase:          s.fase,
        categoria:     s.categoria,
        baraja:        s.baraja,
        panel:         s.panel,
        panelPrevio:   s.panelPrevio,
        panelFase:     s.panelFase,
        panelSalto:    s.panelSalto,
        hijoSel:       s.hijoSel,
        hijoFase:      s.hijoFase,
        activo:        s.activo,
        previo:        s.previo,      // anterior en el tiempo
        anterior:      v.anterior,    // vecino izquierdo
        siguiente:     v.siguiente,   // vecino derecho
        hover:         s.hover,
        candidato:     s.candidato,
        origen:        s.origen,
        destino:       s.destino,
        direccion:     s.direccion,
        salto:         s.salto,
        ciclo:         s.ciclo,
        total:         lista().length,
        indiceActivo:  lista().indexOf(s.activo),
        enTransicion:  enTransicion(),
        puedeAtras:    puedeGirar(-1),
        puedeAdelante: puedeGirar(1)
      };
    }

    function suscribir(fn) {
      oyentes.push(fn);
      return function () { oyentes = oyentes.filter(function (f) { return f !== fn; }); };
    }

    function destruir() { limpiar(); oyentes = []; }

    return {
      ESTADO: ESTADO, FASE: FASE,
      geometria: geo, tiempos: tiempos, reducido: reducido,
      categorias: categorias, proyecto: function (id) { return porId[id]; },
      /* selectores */
      composicion: composicion, estadoDe: estadoDe, distancia: distancia,
      ranura: ranura, rango: distancia, recentrado: recentrado, factores: factores,
      composicionPaneles: composicionPaneles, panelRango: panelRango, hijo: hijo,
      tema: tema, temaActivo: function () { return tema(s.panel); },
      temaBaraja: function () { return tema(s.baraja); },
      vecinos: vecinos, categoriaActiva: categoriaActiva, puedeGirar: puedeGirar,
      lista: lista, instantanea: instantanea,
      /* acciones */
      apuntar: apuntar, soltar: soltar,
      seleccionar: seleccionar, cancelarSeleccion: cancelarSeleccion,
      confirmar: confirmar, finalizarTransicion: finalizarTransicion, asentar: asentar,
      girar: girar, irCategoria: irCategoria, irBaraja: irBaraja, irPanel: irPanel,
      elegirHijo: elegirHijo, cerrarHijo: cerrarHijo, apuntarHijo: apuntarHijo,
      intercambiar: intercambiar, reubicar: reubicar,
      /* ciclo de vida */
      suscribir: suscribir, destruir: destruir
    };
  }

  var api = { ESTADO: ESTADO, FASE: FASE, GEOMETRIA: GEOMETRIA, TIEMPOS: TIEMPOS,
              TEMAS: TEMAS, LINEA: LINEA, tema: tema, prefiereMenosMovimiento: prefiereMenosMovimiento,
              crearRanuras: crearRanuras, crearMaquina: crearMaquina };
  global.ZnEstado = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
