declare module "pdf-parse" {
  interface PDFData { text: string; numpages: number; info?: unknown; metadata?: unknown; }
  function pdfParse(dataBuffer: Buffer): Promise<PDFData>;
  export default pdfParse;
}
