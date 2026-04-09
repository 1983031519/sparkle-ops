declare module 'html2pdf.js' {
  interface Html2PdfOptions {
    margin?: number | number[]
    filename?: string
    image?: { type?: string; quality?: number }
    html2canvas?: Record<string, unknown>
    jsPDF?: { unit?: string; format?: string; orientation?: string }
    pagebreak?: { mode?: string | string[]; before?: string | string[]; after?: string | string[]; avoid?: string | string[] }
  }
  interface Html2Pdf {
    set(options: Html2PdfOptions): Html2Pdf
    from(element: HTMLElement | null): Html2Pdf
    save(): Promise<void>
    toPdf(): Html2Pdf
    get(type: string): Promise<unknown>
  }
  export default function html2pdf(): Html2Pdf
}
