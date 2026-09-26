/* ====================================================================
   ZENITH — CONTENIDO DEL PORTAFOLIO

   Ya NO se editan tarjetas aquí. El contenido vive en la base de
   datos y se administra desde el panel:

       zenithestudios.com/admin/portafolio.php

   Este archivo sólo hace tres cosas:
     1. pedir los datos a Hostinger,
     2. adaptarlos a la forma que espera la vista,
     3. publicar window.ZnContenido.

   La vista tolera que esto tarde: si ZnContenido todavía no existe
   pinta el armazón y reintenta cada 60 ms hasta 3,6 s.

   Para editar contenido sin panel (o para desarrollar sin red),
   ver `zn-contenido.ejemplo.js`: tiene el formato completo con
   datos de muestra.
   ==================================================================== */
(function (global) {
  "use strict";

  /* El runtime .dc.html re-inyecta los scripts del <helmet> en cada
     render. El archivo original era un objeto estático, así que
     repetirlo no costaba nada; éste hace red, y sin este guard
     lanzaría una petición por render. Se carga una sola vez. */
  if (global.__znContenidoIniciado) return;
  global.__znContenidoIniciado = true;

  /* Origen de los datos. En producción apunta al dominio principal;
     en local, al servidor de desarrollo si lo hay. */
  var ORIGEN = (function () {
    var h = global.location && global.location.hostname;
    /* En desarrollo la vista corre en :8123 y el PHP en :8124. */
    if (h === "localhost" || h === "127.0.0.1") return "http://localhost:8124";
    return "https://zenithestudios.com";
  })();
  /* ?demo=1 usa el JSON local: sirve para probar la vista sin base de datos. */
  var DEMO = /[?&]demo=1/.test(global.location.search);
  var URL_DATOS = DEMO ? "./datos-demo.json" : ORIGEN + "/portafolio-datos.php";

  var TIPOS = ["mosaico", "carrusel", "presentacion", "reel", "cine"];
  var VISOR_MINIMO = { tipo: "mosaico", piezas: 1, nota: "", chips: [] };

  /* Estado local, reemplazado en cuanto llegan los datos */
  var grupos = [];
  var proyectos = [];

  function activos() {
    return proyectos.filter(function (p) { return p.activo !== false; });
  }
  function deCategoria(catId) {
    return activos().filter(function (p) { return p.categoria === catId; });
  }
  function proyecto(id) {
    for (var i = 0; i < proyectos.length; i++) if (proyectos[i].id === id) return proyectos[i];
    return null;
  }

  /* Resuelve el visor de un proyecto y normaliza `piezas` para que
     nunca rompa el render (el contador y las flechas asumen >= 1). */
  function visorDe(id) {
    var p = proyecto(id);
    if (!p) return null;
    var d = p.visor || VISOR_MINIMO;
    var tipo = TIPOS.indexOf(d.tipo) >= 0 ? d.tipo : VISOR_MINIMO.tipo;
    var piezas = Math.max(1, Math.min(12, parseInt(d.piezas, 10) || 1));
    return { tipo: tipo, piezas: piezas, nota: d.nota || "", chips: d.chips || [] };
  }

  /* Imágenes reales de una pieza. Vienen de uploads/ en Hostinger,
     ya subidas con el editor del panel. Devuelve null si esa pieza
     todavía no tiene imagen: la vista pinta el hueco vacío. */
  function piezaDe(id, n) {
    var p = proyecto(id);
    if (!p || !p.piezas) return null;
    return p.piezas[n - 1] || null;
  }

  /* La tarjeta del abanico usa la versión ligera (~28 KB), no la del
     visor (~82 KB). Con muchas tarjetas en pantalla la diferencia
     decide si la página entra en un segundo o en cinco. */
  function portadaDe(id) {
    var p = proyecto(id);
    if (!p) return null;
    if (p.portada) return { url: p.portada, texto: "", foco: "50% 50%" };
    /* Datos de la v2 (sin `portada`): se cae a la primera pieza. */
    return (p.piezas && p.piezas[0]) || null;
  }

  /* Cuántos trabajos de una categoría caben en el abanico. El resto
     vive en «Ver todo»: con más de 5 el abanico los esconde unos
     detrás de otros y deja de enseñar el trabajo. */
  var TOPE_ABANICO = 5;

  function deCategoriaAbanico(catId) {
    return deCategoria(catId).slice(0, TOPE_ABANICO);
  }
  function deCategoriaResto(catId) {
    return deCategoria(catId).slice(TOPE_ABANICO);
  }

  function validar() {
    var problemas = [];
    var idsGrupo = grupos.map(function (g) { return g.id; });
    var vistos = {};
    if (!grupos.length) problemas.push("no llegó ninguna categoría");
    grupos.forEach(function (g) {
      if (!/^[a-z0-9-]+$/.test(g.id)) problemas.push("id de grupo inválido: " + g.id);
      if (!/^\d{1,3},\s*\d{1,3},\s*\d{1,3}$/.test(String(g.acento))) {
        problemas.push("acento de " + g.id + ' debe ser "R,G,B"');
      }
    });
    proyectos.forEach(function (p) {
      if (vistos[p.id]) problemas.push("id repetido: " + p.id);
      vistos[p.id] = true;
      if (idsGrupo.indexOf(p.categoria) < 0) problemas.push(p.id + ": categoría desconocida " + p.categoria);
      if (p.visor && TIPOS.indexOf(p.visor.tipo) < 0) problemas.push(p.id + ": tipo de visor desconocido " + p.visor.tipo);
    });
    return problemas;
  }

  function publicar(silencioso) {
    global.ZnContenido = {
      version: 2,
      grupos: grupos,
      proyectos: activos(),
      tipos: TIPOS,
      proyecto: proyecto,
      deCategoria: deCategoria,
      visorDe: visorDe,
      piezaDe: piezaDe,
      portadaDe: portadaDe,
      deCategoriaAbanico: deCategoriaAbanico,
      deCategoriaResto: deCategoriaResto,
      topeAbanico: TOPE_ABANICO,
      validar: validar
    };
    var fallas = silencioso ? [] : validar();
    if (fallas.length && global.console) {
      console.warn("[zn-contenido] revisar:\n· " + fallas.join("\n· "));
    }
    global.dispatchEvent(new Event("zn-contenido-listo"));
  }

  function aplicar(datos) {
    grupos = (datos && datos.grupos) || [];
    proyectos = (datos && datos.proyectos) || [];
    publicar();
  }

  /* ── Carga ─────────────────────────────────────────────────────
     Si falla (sin red, CORS mal configurado, servidor caído) se
     publica igualmente un ZnContenido vacío: la página se ve, con
     sus módulos y su mensaje de "aún no hay trabajo", en vez de
     quedarse en blanco. El error queda en consola. */
  /* cache: "no-cache" = preguntar siempre al servidor antes de usar la
     copia guardada. Si nada cambió responde 304 y no se descarga nada;
     si se guardó algo en el panel, llega al instante. Antes el
     navegador reutilizaba su copia hasta 5 minutos sin preguntar. */
  fetch(URL_DATOS, { credentials: "omit", cache: "no-cache" })
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(aplicar)
    .catch(function (e) {
      if (global.console) {
        console.error(
          "[zn-contenido] no se pudieron cargar los datos desde " + URL_DATOS +
          "\n· " + e.message +
          "\n· Si es un error de CORS, añade este origen (" + global.location.origin +
          ") a PORTAFOLIO_ORIGENES en includes/config.php"
        );
      }
      aplicar({ grupos: [], proyectos: [] });
    });

  /* Publica de inmediato un objeto vacío para que la vista tenga
     siempre algo que leer mientras el fetch está en vuelo. En silencio:
     avisar de que "no hay categorías" antes de pedirlas es ruido. */
  publicar(true);
})(typeof window !== "undefined" ? window : globalThis);
