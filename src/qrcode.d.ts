declare module "qrcode" {
  interface QRCodeColorOptions {
    dark?: string;
    light?: string;
  }

  interface QRCodeToDataURLOptions {
    margin?: number;
    width?: number;
    color?: QRCodeColorOptions;
  }

  const QRCode: {
    toDataURL(text: string, options?: QRCodeToDataURLOptions): Promise<string>;
  };

  export default QRCode;
}
