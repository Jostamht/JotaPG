// Arma un archivo de Excel (.xlsx) de una sola hoja, sin librerías de afuera.
// Un .xlsx es un ZIP con unos cuantos archivos XML adentro; aquí se escribe ese ZIP "sin comprimir".
//
// crearXlsx({ hoja: "Invitados", anchos: [28, 16, ...], filas: [[...], ...] }) -> Blob
// La primera fila es el encabezado (negrita, con color y fija al desplazarse). Un número se guarda
// como número; cualquier otra cosa, como texto (los textos nunca se leen como fórmula).

(function () {
  const codificador = new TextEncoder();

  // --- CRC32, que el formato ZIP pide para cada archivo ---
  const TABLA_CRC = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = TABLA_CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  // --- ZIP sin compresión ---
  function crearZip(archivos) {
    const ahora = new Date();
    const hora = (ahora.getHours() << 11) | (ahora.getMinutes() << 5) | (ahora.getSeconds() >> 1);
    const fecha = ((ahora.getFullYear() - 1980) << 9) | ((ahora.getMonth() + 1) << 5) | ahora.getDate();

    const partes = [];
    const central = [];
    let posicion = 0;

    for (const [nombre, contenido] of archivos) {
      const nom = codificador.encode(nombre);
      const datos = codificador.encode(contenido);
      const crc = crc32(datos);

      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true);
      local.setUint16(4, 20, true); // versión mínima
      local.setUint16(6, 0, true); // sin opciones especiales
      local.setUint16(8, 0, true); // método 0 = guardado sin comprimir
      local.setUint16(10, hora, true);
      local.setUint16(12, fecha, true);
      local.setUint32(14, crc, true);
      local.setUint32(18, datos.length, true);
      local.setUint32(22, datos.length, true);
      local.setUint16(26, nom.length, true);
      local.setUint16(28, 0, true);
      partes.push(new Uint8Array(local.buffer), nom, datos);

      const ficha = new DataView(new ArrayBuffer(46));
      ficha.setUint32(0, 0x02014b50, true);
      ficha.setUint16(4, 20, true);
      ficha.setUint16(6, 20, true);
      ficha.setUint16(8, 0, true);
      ficha.setUint16(10, 0, true);
      ficha.setUint16(12, hora, true);
      ficha.setUint16(14, fecha, true);
      ficha.setUint32(16, crc, true);
      ficha.setUint32(20, datos.length, true);
      ficha.setUint32(24, datos.length, true);
      ficha.setUint16(28, nom.length, true);
      ficha.setUint32(42, posicion, true); // dónde empieza este archivo
      central.push(new Uint8Array(ficha.buffer), nom);

      posicion += 30 + nom.length + datos.length;
    }

    const tamanoCentral = central.reduce((s, p) => s + p.length, 0);
    const fin = new DataView(new ArrayBuffer(22));
    fin.setUint32(0, 0x06054b50, true);
    fin.setUint16(8, archivos.length, true);
    fin.setUint16(10, archivos.length, true);
    fin.setUint32(12, tamanoCentral, true);
    fin.setUint32(16, posicion, true);

    return [...partes, ...central, new Uint8Array(fin.buffer)];
  }

  // --- XML ---
  function escapar(texto) {
    return String(texto)
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g, "") // caracteres que Excel no acepta
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function letraDeColumna(n) {
    let letra = "";
    for (n += 1; n > 0; n = Math.floor((n - 1) / 26)) letra = String.fromCharCode(65 + ((n - 1) % 26)) + letra;
    return letra;
  }

  const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  const NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
  const NS_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  const NS_PAQUETE = "http://schemas.openxmlformats.org/package/2006/relationships";

  function celda(valor, columna, fila, estilo) {
    const ref = letraDeColumna(columna) + fila;
    if (valor === null || valor === undefined || valor === "") return "";
    if (typeof valor === "number" && Number.isFinite(valor)) return `<c r="${ref}" s="${estilo}"><v>${valor}</v></c>`;
    return `<c r="${ref}" s="${estilo}" t="inlineStr"><is><t xml:space="preserve">${escapar(valor)}</t></is></c>`;
  }

  function crearXlsx({ hoja, anchos, filas }) {
    const columnas = filas[0].length;
    const ultima = letraDeColumna(columnas - 1) + filas.length;

    const cuerpo = filas
      .map((fila, i) => {
        const n = i + 1;
        // estilo 1 = encabezado; estilo 2 = texto que se ajusta a la celda; 0 = normal
        const celdas = fila.map((v, c) => celda(v, c, n, i === 0 ? 1 : c === columnas - 1 ? 2 : 0)).join("");
        return `<row r="${n}">${celdas}</row>`;
      })
      .join("");

    const columnasXml = anchos
      .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
      .join("");

    const hojaXml =
      XML +
      `<worksheet xmlns="${NS}">` +
      `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
      `<cols>${columnasXml}</cols>` +
      `<sheetData>${cuerpo}</sheetData>` +
      `<autoFilter ref="A1:${ultima}"/>` +
      `</worksheet>`;

    const archivos = [
      [
        "[Content_Types].xml",
        XML +
          `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
          `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
          `<Default Extension="xml" ContentType="application/xml"/>` +
          `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
          `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
          `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
          `</Types>`,
      ],
      [
        "_rels/.rels",
        XML +
          `<Relationships xmlns="${NS_PAQUETE}">` +
          `<Relationship Id="rId1" Type="${NS_REL}/officeDocument" Target="xl/workbook.xml"/>` +
          `</Relationships>`,
      ],
      [
        "xl/workbook.xml",
        XML +
          `<workbook xmlns="${NS}" xmlns:r="${NS_REL}">` +
          `<sheets><sheet name="${escapar(hoja)}" sheetId="1" r:id="rId1"/></sheets>` +
          `<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">${escapar(hoja)}!$A$1:$${letraDeColumna(columnas - 1)}$${filas.length}</definedName></definedNames>` +
          `</workbook>`,
      ],
      [
        "xl/_rels/workbook.xml.rels",
        XML +
          `<Relationships xmlns="${NS_PAQUETE}">` +
          `<Relationship Id="rId1" Type="${NS_REL}/worksheet" Target="worksheets/sheet1.xml"/>` +
          `<Relationship Id="rId2" Type="${NS_REL}/styles" Target="styles.xml"/>` +
          `</Relationships>`,
      ],
      [
        "xl/styles.xml",
        XML +
          `<styleSheet xmlns="${NS}">` +
          `<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>` +
          `<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>` +
          `<fill><patternFill patternType="solid"><fgColor rgb="FFEDE9FE"/><bgColor indexed="64"/></patternFill></fill></fills>` +
          `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
          `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
          `<cellXfs count="3">` +
          `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
          `<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>` +
          `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>` +
          `</cellXfs>` +
          `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
          `</styleSheet>`,
      ],
      ["xl/worksheets/sheet1.xml", hojaXml],
    ];

    return new Blob(crearZip(archivos), {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
  }

  window.crearXlsx = crearXlsx;
})();
