/** 触发浏览器下载 Blob 文件 */
export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename || 'download'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function filenameFromDisposition(header) {
  if (!header) return null
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header)
  if (utf8) {
    try {
      return decodeURIComponent(utf8[1])
    } catch {
      return utf8[1]
    }
  }
  const plain = /filename="([^"]+)"/i.exec(header)
  return plain ? plain[1] : null
}

export async function downloadApiBlob(getPromise, fallbackName) {
  const res = await getPromise
  const name = filenameFromDisposition(res.headers?.['content-disposition']) || fallbackName
  saveBlob(res.data, name)
}
