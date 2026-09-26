/* ====================================================================
   ZENITH — ARCHIVO DE ENTRADAS
   --------------------------------------------------------------------
   ESTE ES EL ÚNICO ARCHIVO QUE HAY QUE TOCAR PARA:
     · agregar una tarjeta            -> añade un objeto a `proyectos`
     · editar una tarjeta             -> cambia sus campos
     · eliminar una tarjeta           -> borra su objeto (o pon activo: false)
     · reordenar tarjetas             -> muévelas dentro del array
     · agregar / quitar categorías    -> `grupos`
     · cambiar el contenido que abre  -> el campo `visor` de cada proyecto

   No hay build ni dependencias: es un <script> normal que publica
   window.ZnContenido. Los estilos, la animación y el visor viven en
   "Portafolio Zenith v3.dc.html"; la física del abanico en zn-estado.js.
   Lee CLAUDE.md para el contexto completo.
   ==================================================================== */
(function (global) {
  "use strict";

  /* --------------------------------------------------------------
     1. CATEGORÍAS (módulos)
     El primer grupo del array es el que arranca en la posición
     principal (arriba, grande). Al hacer clic en el titular de otro
     módulo, ese pasa a principal y los demás rotan.

       id      identificador interno, sin espacios ni acentos
       nombre  texto visible del titular
       acento  color en formato "R,G,B" (sin rgb(), sin #)

     El ícono SVG de cada titular vive en el template del .dc.html,
     junto a su <section>. Si agregas un grupo nuevo hay que añadir
     también su <section> allí (ver CLAUDE.md → "Agregar una categoría").
     -------------------------------------------------------------- */
  var grupos = [
    { id: "contenido", nombre: "Contenido", acento: "138,180,248" },
    { id: "marketing", nombre: "Marketing", acento: "94,214,168"  },
    { id: "branding",  nombre: "Branding",  acento: "230,168,74"  },
    { id: "software",  nombre: "Software",  acento: "168,124,240" }
  ];

  /* --------------------------------------------------------------
     2. TARJETAS (proyectos)

       id         ÚNICO en todo el archivo. Se usa como llave de las
                  imágenes que el usuario arrastra en el visor
                  (los huecos se guardan como "zn-<id>-<n>"), así que
                  si cambias un id se pierden las imágenes de esa
                  tarjeta. Para renombrar: cambia `nombre`, no `id`.
       categoria  id de un grupo de arriba
       nombre     título de la tarjeta
       red        etiqueta de la píldora superior (Instagram, TikTok…)
       pags       texto monoespaciado pequeño (rango de páginas, fecha…)
       activo     opcional, false la oculta sin borrarla
       visor      opcional: el contenido que se abre al hacer clic en
                  la tarjeta cuando está al centro del módulo
                  principal. Si se omite se usa `visorPorCategoria`.

     VISOR — campos:
       tipo    uno de: "mosaico" | "carrusel" | "presentacion"
                       | "reel" | "cine"        (ver tabla abajo)
       piezas  cuántos huecos de imagen genera (1-12 recomendado)
       nota    una o dos líneas de descripción
       chips   etiquetas cortas; solo se muestran en "reel"

     TIPOS DE CONTENEDOR:
       mosaico       rejilla irregular de fotos, todas visibles a la vez
       carrusel      imagen 3:2 + flechas + tira numerada
       presentacion  lámina 16:9 + barra de láminas + Anterior/Siguiente
       reel          vertical 9:16 + segmentos tipo historia + escenas
       cine          video 16:9 + barra de progreso + capítulos

     El orden del array es el orden del abanico. La tarjeta que queda
     al centro al cargar es la de enmedio del grupo.
     -------------------------------------------------------------- */
  var proyectos = [
    {
      id: "c-beenais", categoria: "contenido",
      nombre: "Beenais", red: "Fotografía", pags: "Págs. 1-5",
      visor: {
        tipo: "mosaico", piezas: 6,
        nota: "Selección de fotografía de producto y detalle, en el orden de entrega.",
        chips: ["Fotografía", "Retoque"]
      }
    },
    {
      id: "c-zenith", categoria: "contenido",
      nombre: "Zenith Studio", red: "Instagram", pags: "Págs. 6-11",
      visor: {
        tipo: "presentacion", piezas: 8,
        nota: "Guía de contenido y plantillas para Instagram, lámina por lámina.",
        chips: ["Presentación"]
      }
    },
    {
      id: "c-modelaje", categoria: "contenido",
      nombre: "Modelaje", red: "Instagram", pags: "Págs. 12-16",
      visor: {
        tipo: "carrusel", piezas: 7,
        nota: "Carrete editorial completo en su orden de publicación.",
        chips: ["Carrusel"]
      }
    },
    {
      id: "c-company", categoria: "contenido",
      nombre: "Company", red: "TikTok", pags: "Págs. 17-21",
      visor: {
        tipo: "reel", piezas: 4,
        nota: "Reel vertical desglosado por escenas del guion.",
        chips: ["9:16", "TikTok"]
      }
    },
    {
      id: "c-myparts", categoria: "contenido",
      nombre: "My Parts", red: "Instagram", pags: "Págs. 22-25",
      visor: {
        tipo: "cine", piezas: 5,
        nota: "Video horizontal dividido en capítulos.",
        chips: ["16:9", "Video"]
      }
    },

    { id: "m-1", categoria: "marketing", nombre: "Modelaje", red: "Instagram", pags: "Págs. 1-4"  },
    { id: "m-2", categoria: "marketing", nombre: "Modelaje", red: "Instagram", pags: "Págs. 5-8"  },
    { id: "m-3", categoria: "marketing", nombre: "Modelaje", red: "Instagram", pags: "Págs. 9-12" },

    { id: "b-1", categoria: "branding", nombre: "Modelaje", red: "Instagram", pags: "Págs. 1-4"  },
    { id: "b-2", categoria: "branding", nombre: "Modelaje", red: "Instagram", pags: "Págs. 5-8"  },
    { id: "b-3", categoria: "branding", nombre: "Modelaje", red: "Instagram", pags: "Págs. 9-12" },

    { id: "s-1", categoria: "software", nombre: "Modelaje", red: "Instagram", pags: "Págs. 1-4"  },
    { id: "s-2", categoria: "software", nombre: "Modelaje", red: "Instagram", pags: "Págs. 5-8"  },
    { id: "s-3", categoria: "software", nombre: "Modelaje", red: "Instagram", pags: "Págs. 9-12" }
  ];

  /* --------------------------------------------------------------
     3. VISOR POR DEFECTO DE CADA CATEGORÍA
     Se usa en las tarjetas que no traen su propio `visor`.
     -------------------------------------------------------------- */
  var visorPorCategoria = {
    contenido: { tipo: "mosaico",      piezas: 6, nota: "Piezas del proyecto.", chips: ["Contenido"] },
    marketing: { tipo: "cine",         piezas: 4, nota: "Video de campaña por capítulos.", chips: ["16:9", "Campaña"] },
    branding:  { tipo: "mosaico",      piezas: 6, nota: "Sistema visual y sus aplicaciones.", chips: ["Identidad"] },
    software:  { tipo: "presentacion", piezas: 6, nota: "Recorrido de producto, pantalla por pantalla.", chips: ["Producto"] }
  };

  /* ============ de aquí para abajo no hace falta editar ============ */

  var TIPOS = ["mosaico", "carrusel", "presentacion", "reel", "cine"];
  var VISOR_MINIMO = { tipo: "mosaico", piezas: 6, nota: "", chips: [] };

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

  /* Resuelve el visor de un proyecto: el propio, el de su categoría, o
     el mínimo. Normaliza `piezas` para que nunca rompa el render. */
  function visorDe(id) {
    var p = proyecto(id);
    if (!p) return null;
    var d = p.visor || visorPorCategoria[p.categoria] || VISOR_MINIMO;
    var tipo = TIPOS.indexOf(d.tipo) >= 0 ? d.tipo : VISOR_MINIMO.tipo;
    var piezas = Math.max(1, Math.min(12, parseInt(d.piezas, 10) || 1));
    return { tipo: tipo, piezas: piezas, nota: d.nota || "", chips: d.chips || [] };
  }

  /* Chequeo de consistencia. Se ejecuta al cargar y avisa en consola;
     también se puede llamar a mano: ZnContenido.validar() */
  function validar() {
    var problemas = [];
    var idsGrupo = grupos.map(function (g) { return g.id; });
    var vistos = {};
    if (!grupos.length) problemas.push("no hay categorías en `grupos`");
    grupos.forEach(function (g) {
      if (!/^[a-z0-9-]+$/.test(g.id)) problemas.push("id de grupo inválido: " + g.id);
      if (!/^\d{1,3},\s*\d{1,3},\s*\d{1,3}$/.test(String(g.acento))) {
        problemas.push("acento de " + g.id + ' debe ser "R,G,B"');
      }
      if (!deCategoria(g.id).length) problemas.push("la categoría " + g.id + " no tiene tarjetas activas");
    });
    proyectos.forEach(function (p) {
      if (vistos[p.id]) problemas.push("id repetido: " + p.id);
      vistos[p.id] = true;
      if (idsGrupo.indexOf(p.categoria) < 0) problemas.push(p.id + ": categoría desconocida " + p.categoria);
      if (p.visor && TIPOS.indexOf(p.visor.tipo) < 0) problemas.push(p.id + ": tipo de visor desconocido " + p.visor.tipo);
    });
    return problemas;
  }

  global.ZnContenido = {
    version: 1,
    grupos: grupos,
    proyectos: activos(),
    visorPorCategoria: visorPorCategoria,
    tipos: TIPOS,
    proyecto: proyecto,
    deCategoria: deCategoria,
    visorDe: visorDe,
    validar: validar
  };

  var fallas = validar();
  if (fallas.length && global.console) {
    console.warn("[zn-contenido] revisar:\n· " + fallas.join("\n· "));
  }
})(typeof window !== "undefined" ? window : globalThis);
