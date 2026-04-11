declare module 'pdfkit' {
  export default class PDFDocument {
    constructor(options?: any);
    on(event: string, handler: (...args: any[]) => void): this;
    fontSize(size: number): this;
    text(text: string, options?: any): this;
    moveDown(lines?: number): this;
    end(): void;
  }
}
