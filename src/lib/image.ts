async function draw(file: File, w: number, h: number, sx = 0, sy = 0, sw?: number, sh?: number): Promise<Blob> {
  const bmp = await createImageBitmap(file)
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  c.getContext('2d')!.drawImage(bmp, sx, sy, sw ?? bmp.width, sh ?? bmp.height, 0, 0, w, h)
  return new Promise((res, rej) =>
    c.toBlob(b => (b ? res(b) : rej(new Error('No se pudo procesar la imagen. Prueba con JPG o PNG.'))), 'image/jpeg', 0.82))
}

/** Recorta al centro en cuadrado (foto de perfil) */
export async function toSquareJpeg(file: File, size = 400): Promise<Blob> {
  const bmp = await createImageBitmap(file)
  const s = Math.min(bmp.width, bmp.height)
  return draw(file, size, size, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s)
}

/** Reduce el tamaño conservando proporción (fotos de progreso) */
export async function resizeJpeg(file: File, max = 1080): Promise<Blob> {
  const bmp = await createImageBitmap(file)
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height))
  return draw(file, Math.round(bmp.width * k), Math.round(bmp.height * k))
}