/**
 * Exportadores del reporte de asistencia a PDF (jspdf + autotable) y DOCX
 * (docx). Las librerías se cargan con import() dinámico así no pesan en el
 * bundle inicial de la PWA: solo se descargan al exportar por primera vez.
 */

import {
  fmtFecha,
  fmtHoras,
  nombreDia,
  nombrePropio,
  type EmpleadoReporte,
  type DiaReporte,
  type Reporte,
} from './asistencia'

const EMERALD = '#059669'
const SLATE_900 = '#0f172a'
const SLATE_500 = '#64748b'

function tituloPeriodo(rep: Reporte): string {
  return `Período ${fmtFecha(rep.desde)} al ${fmtFecha(rep.hasta)}`
}

function nombreArchivo(rep: Reporte, ext: string): string {
  return `registro-llegadas_${rep.desde}_a_${rep.hasta}.${ext}`
}

function obsDe(d: DiaReporte): string {
  const obs: string[] = []
  if (d.tardeMin !== null) obs.push(`Tarde +${d.tardeMin} min`)
  if (d.incompleto) obs.push('Falta una marca')
  // Turnos extra (más de 2) van como texto para no agrandar la tabla.
  for (const t of d.turnos.slice(2)) {
    obs.push(`Turno extra ${t.entrada}–${t.salida ?? '—'}`)
  }
  return obs.join(' · ')
}

function filaDia(d: DiaReporte): string[] {
  const t1 = d.turnos[0]
  const t2 = d.turnos[1]
  return [
    `${fmtFecha(d.fecha).slice(0, 5)} ${nombreDia(d.fecha)}`,
    t1?.entrada ?? '—',
    t1?.salida ?? '—',
    t2?.entrada ?? '—',
    t2?.salida ?? '—',
    d.minutos > 0 ? fmtHoras(d.minutos) : '—',
    obsDe(d),
  ]
}

const CABECERA_DIAS = ['Fecha', 'Entrada', 'Salida', 'Entrada', 'Salida', 'Horas', 'Observaciones']

function filaResumen(e: EmpleadoReporte): string[] {
  return [
    nombrePropio(e.nombre),
    String(e.diasTrabajados),
    fmtHoras(e.totalMinutos),
    String(e.tardanzas),
    String(e.ausencias.length),
  ]
}

const CABECERA_RESUMEN = ['Empleado', 'Días trabajados', 'Horas totales', 'Tardanzas', 'Ausencias']

function ausenciasTexto(e: EmpleadoReporte): string {
  if (e.ausencias.length === 0) return ''
  return `Ausencias (${e.ausencias.length}): ${e.ausencias
    .map((f) => `${nombreDia(f)} ${fmtFecha(f).slice(0, 5)}`)
    .join(', ')}`
}

async function logoDataUrl(): Promise<string | null> {
  try {
    const res = await fetch('/logo-mghogar.png')
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise((resolve) => {
      const fr = new FileReader()
      fr.onload = () => resolve(fr.result as string)
      fr.onerror = () => resolve(null)
      fr.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

// ── PDF ─────────────────────────────────────────────────────────────────────

export async function exportarPDF(rep: Reporte): Promise<void> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const ancho = doc.internal.pageSize.getWidth()
  const logo = await logoDataUrl()

  // Encabezado de marca
  doc.setFillColor(EMERALD)
  doc.rect(0, 0, ancho, 26, 'F')
  if (logo) {
    try {
      doc.addImage(logo, 'PNG', 12, 5, 16, 16)
    } catch {
      /* sin logo, no pasa nada */
    }
  }
  doc.setTextColor('#ffffff')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text('Registro de llegadas y salidas', logo ? 32 : 12, 12)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`MG Hogar — ${tituloPeriodo(rep)}`, logo ? 32 : 12, 19)

  doc.setTextColor(SLATE_500)
  doc.setFontSize(8)
  doc.text(
    `Generado el ${new Date().toLocaleDateString('es-AR')} ${new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`,
    ancho - 12,
    31,
    { align: 'right' }
  )

  // Resumen general
  autoTable(doc, {
    startY: 36,
    head: [CABECERA_RESUMEN],
    body: rep.empleados.map(filaResumen),
    theme: 'striped',
    headStyles: { fillColor: EMERALD, fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 2.2 },
    margin: { left: 12, right: 12 },
  })

  // Detalle por empleado
  for (const emp of rep.empleados) {
    const yPrevio = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
    let y = yPrevio + 12
    if (y > doc.internal.pageSize.getHeight() - 40) {
      doc.addPage()
      y = 16
    }

    doc.setTextColor(SLATE_900)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text(nombrePropio(emp.nombre), 12, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(SLATE_500)
    doc.text(
      `${emp.diasTrabajados} días · ${fmtHoras(emp.totalMinutos)} · ${emp.tardanzas} tardanzas · ${emp.ausencias.length} ausencias`,
      12,
      y + 5
    )

    autoTable(doc, {
      startY: y + 8,
      head: [CABECERA_DIAS],
      body: emp.dias.map(filaDia),
      theme: 'grid',
      headStyles: { fillColor: EMERALD, fontStyle: 'bold', fontSize: 8 },
      styles: { fontSize: 8, cellPadding: 1.8 },
      columnStyles: { 6: { textColor: '#b45309' } },
      margin: { left: 12, right: 12 },
      didParseCell: (data) => {
        // Resalta la fila completa cuando hay tardanza
        if (data.section === 'body' && emp.dias[data.row.index]?.tardeMin !== null) {
          data.cell.styles.fillColor = '#fef3c7'
        }
      },
    })

    const aus = ausenciasTexto(emp)
    if (aus) {
      const yFin = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
      doc.setFontSize(8)
      doc.setTextColor('#b91c1c')
      doc.text(aus, 12, yFin + 5, { maxWidth: ancho - 24 })
    }
  }

  // Pie con número de página
  const paginas = doc.getNumberOfPages()
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(SLATE_500)
    doc.text(`Página ${i} de ${paginas}`, ancho / 2, doc.internal.pageSize.getHeight() - 6, {
      align: 'center',
    })
  }

  doc.save(nombreArchivo(rep, 'pdf'))
}

// ── DOCX ────────────────────────────────────────────────────────────────────

export async function exportarDOCX(rep: Reporte): Promise<void> {
  const docx = await import('docx')
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    Table,
    TableRow,
    TableCell,
    WidthType,
    AlignmentType,
    ShadingType,
  } = docx

  const celda = (texto: string, opts: { header?: boolean; fill?: string } = {}) =>
    new TableCell({
      shading: opts.header
        ? { type: ShadingType.CLEAR, fill: '059669' }
        : opts.fill
          ? { type: ShadingType.CLEAR, fill: opts.fill }
          : undefined,
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: texto,
              bold: opts.header,
              color: opts.header ? 'FFFFFF' : undefined,
              size: 18, // half-points → 9pt
            }),
          ],
        }),
      ],
    })

  const tabla = (cabecera: string[], filas: string[][], fills: (string | undefined)[] = []) =>
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({ tableHeader: true, children: cabecera.map((c) => celda(c, { header: true })) }),
        ...filas.map(
          (f, i) => new TableRow({ children: f.map((c) => celda(c, { fill: fills[i] })) })
        ),
      ],
    })

  const children: InstanceType<typeof Paragraph | typeof Table>[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: 'Registro de llegadas y salidas', bold: true, size: 34, color: '059669' }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
      children: [new TextRun({ text: `MG Hogar — ${tituloPeriodo(rep)}`, size: 22, color: '64748B' })],
    }),
    tabla(CABECERA_RESUMEN, rep.empleados.map(filaResumen)),
  ]

  for (const emp of rep.empleados) {
    children.push(
      new Paragraph({
        spacing: { before: 400, after: 80 },
        children: [new TextRun({ text: nombrePropio(emp.nombre), bold: true, size: 26 })],
      }),
      new Paragraph({
        spacing: { after: 120 },
        children: [
          new TextRun({
            text: `${emp.diasTrabajados} días · ${fmtHoras(emp.totalMinutos)} · ${emp.tardanzas} tardanzas · ${emp.ausencias.length} ausencias`,
            size: 18,
            color: '64748B',
          }),
        ],
      }),
      tabla(
        CABECERA_DIAS,
        emp.dias.map(filaDia),
        emp.dias.map((d) => (d.tardeMin !== null ? 'FEF3C7' : undefined))
      )
    )
    const aus = ausenciasTexto(emp)
    if (aus) {
      children.push(
        new Paragraph({
          spacing: { before: 120 },
          children: [new TextRun({ text: aus, size: 18, color: 'B91C1C' })],
        })
      )
    }
  }

  const doc = new Document({ sections: [{ children }] })
  const blob = await Packer.toBlob(doc)

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombreArchivo(rep, 'docx')
  a.click()
  URL.revokeObjectURL(url)
}
